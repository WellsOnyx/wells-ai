/**
 * Circle Webhook Handler
 *
 * Receives notifications from Circle when:
 * 1. Wire/ACH deposits are received
 * 2. USDC transfers complete
 * 3. Wallet events occur
 *
 * Upon receiving a deposit:
 * 1. Match to user via Virtual Account Number
 * 2. Add USDC to treasury
 * 3. Credit GRAIN to user's ledger at current oracle price
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { headers } from 'next/headers'
import crypto from 'crypto'

// Circle webhook secret for signature verification
const CIRCLE_WEBHOOK_SECRET = process.env.CIRCLE_WEBHOOK_SECRET

// Webhook event types we handle
type CircleEventType =
  | 'wire.deposit.completed'
  | 'ach.deposit.completed'
  | 'transfer.completed'
  | 'wallet.inbound'

interface CircleWebhookPayload {
  Type: string
  MessageId: string
  Message: string  // JSON string of the actual event
  Timestamp: string
  Signature: string
  SignatureVersion: string
  SigningCertUrl: string
}

interface CircleEvent {
  id: string
  type: CircleEventType
  data: {
    id: string
    amount: {
      amount: string
      currency: string
    }
    status: string
    virtualAccountId?: string
    virtualAccountNumber?: string
    sourceWalletId?: string
    destinationWalletId?: string
    transactionHash?: string
    createDate: string
    updateDate: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const headersList = await headers()

    // Verify webhook signature if secret is configured
    if (CIRCLE_WEBHOOK_SECRET) {
      const signature = headersList.get('x-circle-signature')
      if (!verifySignature(body, signature)) {
        console.error('[Circle Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Parse webhook payload
    const payload: CircleWebhookPayload = JSON.parse(body)
    const event: CircleEvent = JSON.parse(payload.Message)

    console.log(`[Circle Webhook] Received event: ${event.type}, ID: ${event.id}`)

    // Handle based on event type
    switch (event.type) {
      case 'wire.deposit.completed':
      case 'ach.deposit.completed':
        await handleDepositCompleted(event)
        break

      case 'transfer.completed':
        await handleTransferCompleted(event)
        break

      case 'wallet.inbound':
        await handleWalletInbound(event)
        break

      default:
        console.log(`[Circle Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('[Circle Webhook] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Verify Circle webhook signature
 */
function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !CIRCLE_WEBHOOK_SECRET) return false

  const expectedSignature = crypto
    .createHmac('sha256', CIRCLE_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Handle wire/ACH deposit completed
 */
async function handleDepositCompleted(event: CircleEvent): Promise<void> {
  const { data } = event
  const amount = parseFloat(data.amount.amount)
  const virtualAccountNumber = data.virtualAccountNumber

  if (!virtualAccountNumber) {
    console.error('[Circle Webhook] Deposit missing virtual account number')
    return
  }

  // Find user by virtual account number
  const userResult = await sql`
    SELECT user_id FROM user_virtual_accounts
    WHERE virtual_account_number = ${virtualAccountNumber}
  `

  if (userResult.rows.length === 0) {
    console.error(`[Circle Webhook] No user found for VAN: ${virtualAccountNumber}`)
    // In production, this would go to a manual review queue
    return
  }

  const userId = userResult.rows[0].user_id

  // Check for duplicate processing
  const existingResult = await sql`
    SELECT id FROM grain_transactions
    WHERE circle_transfer_id = ${event.id}
    LIMIT 1
  `

  if (existingResult.rows.length > 0) {
    console.log(`[Circle Webhook] Deposit ${event.id} already processed`)
    return
  }

  // Get current GRAIN price from oracle
  const grainPrice = await getCurrentGrainPrice()

  // Calculate GRAIN to credit
  const grainAmount = amount / grainPrice

  // Add USDC to treasury
  await addToTreasury(amount, event.id, event.type)

  // Credit GRAIN to user
  await creditGrainToUser(userId, grainAmount, amount, grainPrice, event.id, event.type)

  // Update deposit session if exists
  await updateDepositSession(virtualAccountNumber, amount, grainAmount, grainPrice, event.id)

  console.log(`[Circle Webhook] Credited ${grainAmount} GRAIN to user ${userId} for $${amount} deposit`)
}

/**
 * Handle USDC transfer completed (crypto deposit)
 */
async function handleTransferCompleted(event: CircleEvent): Promise<void> {
  const { data } = event
  const amount = parseFloat(data.amount.amount)

  // This is for direct USDC transfers to the master wallet
  // We'd need to match by wallet address or memo
  console.log(`[Circle Webhook] Transfer completed: $${amount}`)

  // TODO: Match by memo/reference to user and credit GRAIN
}

/**
 * Handle inbound wallet transaction
 */
async function handleWalletInbound(event: CircleEvent): Promise<void> {
  const { data } = event
  const amount = parseFloat(data.amount.amount)

  console.log(`[Circle Webhook] Wallet inbound: $${amount}`)

  // Similar handling to transfer - match to user and credit
}

/**
 * Get current GRAIN price from oracle
 */
async function getCurrentGrainPrice(): Promise<number> {
  try {
    // Get treasury value
    const treasuryResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_value
      FROM grain_treasury
      WHERE status = 'active'
    `

    // Get total GRAIN supply
    const supplyResult = await sql`
      SELECT COALESCE(SUM(balance), 0) as total_supply
      FROM user_wallets
      WHERE user_id NOT IN ('WELLS_ESCROW_ACCOUNT', 'WELLS_TREASURY', 'SYSTEM')
        AND balance > 0
    `

    const treasuryValue = parseFloat(treasuryResult.rows[0]?.total_value || '0')
    const totalSupply = parseFloat(supplyResult.rows[0]?.total_supply || '0')

    if (treasuryValue > 0 && totalSupply > 0) {
      return treasuryValue / totalSupply
    }

    return 1.0  // Initial peg
  } catch (e) {
    console.error('[Circle Webhook] Error getting GRAIN price:', e)
    return 1.0
  }
}

/**
 * Add USDC to treasury
 */
async function addToTreasury(
  amount: number,
  circleTransferId: string,
  source: string
): Promise<void> {
  // Update or create USDC treasury entry
  await sql`
    INSERT INTO grain_treasury (
      asset_type,
      asset_name,
      amount,
      custodian,
      status,
      created_at,
      updated_at
    ) VALUES (
      'usdc',
      'Circle USDC',
      ${amount},
      'circle',
      'active',
      NOW(),
      NOW()
    )
    ON CONFLICT (asset_type) WHERE asset_type = 'usdc'
    DO UPDATE SET
      amount = grain_treasury.amount + ${amount},
      updated_at = NOW()
  `

  console.log(`[Treasury] Added $${amount} USDC from ${source}`)
}

/**
 * Credit GRAIN to user's ledger using Credit Line Engine
 *
 * NEW CREDIT LINE MODEL:
 * - Deposit goes to protected deposit (100% protected)
 * - Credit line created 1:1 at current GRAIN price
 * - 0% interest, 0% fees
 */
async function creditGrainToUser(
  userId: string,
  grainAmount: number,
  usdAmount: number,
  grainPrice: number,
  circleTransferId: string,
  source: string
): Promise<void> {
  // Import Credit Line Engine dynamically to avoid circular deps
  const { CreditLineEngine } = await import('@/lib/grain/credit-line-engine')

  // Use Credit Line Engine for deposit
  // This creates: protected deposit + credit line at current price
  const depositResult = await CreditLineEngine.deposit(userId, usdAmount)

  console.log(`[Circle Webhook] Credit Line Model deposit:`)
  console.log(`  User: ${userId}`)
  console.log(`  Protected Deposit: $${depositResult.position.protectedDeposit.toLocaleString()}`)
  console.log(`  Credit Line: ${depositResult.position.creditLineAvailable.toLocaleString()} GRAIN`)

  // Also maintain legacy user_wallets for backward compatibility
  await sql`
    INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
    VALUES (
      ${userId},
      ${'grain-' + userId.substring(0, 8) + '-' + Date.now().toString(36)},
      'custodial',
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING
  `

  await sql`
    UPDATE user_wallets
    SET
      balance = ${depositResult.position.creditLineAvailable + depositResult.position.appreciationGrain},
      updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Record in legacy grain_transactions table for backward compatibility
  const transactionId = `gv_${Date.now()}_${Math.random().toString(36).substring(7)}`

  await sql`
    INSERT INTO grain_transactions (
      id,
      user_id,
      type,
      amount,
      usd_amount,
      grain_amount,
      grain_price,
      payment_method,
      circle_transfer_id,
      status,
      reason,
      created_at,
      completed_at
    ) VALUES (
      ${transactionId},
      ${userId},
      'deposit',
      ${usdAmount},
      ${usdAmount},
      ${grainAmount},
      ${grainPrice},
      ${source.includes('wire') ? 'wire' : 'ach'},
      ${circleTransferId},
      'completed',
      ${`${source.includes('wire') ? 'Wire' : 'ACH'} deposit via Circle - Credit Line Model`},
      NOW(),
      NOW()
    )
  `
}

/**
 * Update deposit session status
 */
async function updateDepositSession(
  virtualAccountNumber: string,
  receivedAmount: number,
  grainCredited: number,
  grainPrice: number,
  circleTransferId: string
): Promise<void> {
  try {
    await sql`
      UPDATE grain_deposit_sessions
      SET
        status = 'credited',
        received_amount = ${receivedAmount},
        grain_credited = ${grainCredited},
        grain_price_at_credit = ${grainPrice},
        circle_transfer_id = ${circleTransferId},
        received_at = NOW(),
        credited_at = NOW()
      WHERE virtual_account_number = ${virtualAccountNumber}
        AND status = 'pending'
    `
  } catch (e) {
    console.warn('[Circle Webhook] Failed to update deposit session:', e)
  }
}

// Also handle GET for webhook verification (Circle sends a subscription confirmation)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('hub.challenge')

  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ status: 'Circle webhook endpoint active' })
}
