/**
 * Grain & Vault - Bank Instructions API
 *
 * Returns Circle Mint wire/ACH deposit instructions with
 * Virtual Account Numbers (VAN) for auto-attribution.
 *
 * Circle Mint provides:
 * - Wire transfers with unique virtual account numbers
 * - ACH deposits (when enabled)
 * - Automatic attribution of deposits to customers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Circle API configuration
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY
const CIRCLE_API_URL = process.env.CIRCLE_ENV === 'production'
  ? 'https://api.circle.com/v1'
  : 'https://api-sandbox.circle.com/v1'

// Circle bank account details (from Circle Mint dashboard)
// These are the actual bank details customers send money to
const CIRCLE_BANK_DETAILS = {
  wire: {
    bankName: 'Customers Bank',
    routingNumber: '031100225',
    accountName: 'Circle Internet Financial LLC',
    swiftCode: 'CULOKHPP',
  },
  ach: {
    bankName: 'Customers Bank',
    routingNumber: '031100225',
    accountName: 'Circle Internet Financial LLC',
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Parse request
    const body = await req.json()
    const { amount, method } = body

    // Validate
    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: 'Minimum deposit is $100' },
        { status: 400 }
      )
    }

    if (!method || !['ach', 'wire'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid transfer method' },
        { status: 400 }
      )
    }

    // Get or create Virtual Account Number for this user
    const van = await getOrCreateVirtualAccountNumber(userId, user.emailAddresses[0]?.emailAddress || userId)

    // Create deposit session
    const sessionId = `dep_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Record pending deposit
    await sql`
      INSERT INTO grain_deposit_sessions (
        id,
        user_id,
        amount,
        method,
        virtual_account_number,
        status,
        created_at
      ) VALUES (
        ${sessionId},
        ${userId},
        ${amount},
        ${method},
        ${van.accountNumber},
        'pending',
        NOW()
      )
    `

    // Build bank instructions
    const bankDetails = CIRCLE_BANK_DETAILS[method as 'wire' | 'ach']

    const response = {
      sessionId,
      bankInstructions: {
        method,
        bankName: bankDetails.bankName,
        routingNumber: bankDetails.routingNumber,
        accountNumber: van.accountNumber,  // Virtual Account Number - unique per customer
        accountName: bankDetails.accountName,
        reference: `GV-${userId.substring(0, 8).toUpperCase()}`,
        ...(method === 'wire' && { swiftCode: bankDetails.swiftCode }),
      },
      estimatedCrediting: method === 'wire'
        ? 'Same business day or next business day'
        : '1-3 business days',
      amount,
      grainPriceAtRequest: await getCurrentGrainPrice(),
    }

    console.log(`[Bank Instructions] Created deposit session ${sessionId} for user ${userId}, method: ${method}, amount: $${amount}`)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('[Bank Instructions] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get deposit instructions' },
      { status: 500 }
    )
  }
}

/**
 * Get or create a Virtual Account Number for a user
 *
 * Circle Mint provides Virtual Account Numbers that allow
 * automatic attribution of incoming wire/ACH deposits to
 * specific customers. Each customer gets a unique VAN.
 */
async function getOrCreateVirtualAccountNumber(
  userId: string,
  email: string
): Promise<{ accountNumber: string; createdAt: Date }> {
  // Check if user already has a VAN
  const existingResult = await sql`
    SELECT virtual_account_number, created_at
    FROM user_virtual_accounts
    WHERE user_id = ${userId}
  `

  if (existingResult.rows.length > 0) {
    return {
      accountNumber: existingResult.rows[0].virtual_account_number,
      createdAt: existingResult.rows[0].created_at,
    }
  }

  // Create new VAN via Circle API (or generate if API not available)
  let van: string

  if (CIRCLE_API_KEY) {
    try {
      van = await createCircleVirtualAccount(userId, email)
    } catch (e) {
      console.warn('[VAN] Circle API unavailable, generating local VAN:', e)
      van = generateLocalVirtualAccountNumber(userId)
    }
  } else {
    // Development/demo mode - generate deterministic VAN
    van = generateLocalVirtualAccountNumber(userId)
  }

  // Store VAN in database
  await sql`
    INSERT INTO user_virtual_accounts (
      user_id,
      virtual_account_number,
      created_at
    ) VALUES (
      ${userId},
      ${van},
      NOW()
    )
  `

  return {
    accountNumber: van,
    createdAt: new Date(),
  }
}

/**
 * Create Virtual Account via Circle Mint API
 */
async function createCircleVirtualAccount(
  userId: string,
  email: string
): Promise<string> {
  const response = await fetch(`${CIRCLE_API_URL}/businessAccount/banks/wires/virtual`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CIRCLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotencyKey: `van-${userId}`,
      description: `GrainVault customer ${email}`,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Circle API error: ${error}`)
  }

  const result = await response.json()
  return result.data.virtualAccountNumber
}

/**
 * Generate local Virtual Account Number for development/demo
 *
 * In production, Circle provides real VANs that route to their bank.
 * For development, we generate deterministic account numbers that
 * can be used to test the deposit flow.
 */
function generateLocalVirtualAccountNumber(userId: string): string {
  // Generate a deterministic 12-digit account number from userId
  // Format: 8888 + 8 digits derived from userId hash
  const hash = simpleHash(userId)
  const accountDigits = (hash % 100000000).toString().padStart(8, '0')
  return `8888${accountDigits}`
}

/**
 * Simple hash function for generating deterministic numbers
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Get current GRAIN price from oracle
 * GRAIN Price = Treasury Value / Total Supply
 */
async function getCurrentGrainPrice(): Promise<number> {
  try {
    // Get treasury value (USDC + other assets)
    const treasuryResult = await sql`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN asset_type = 'usdc' THEN amount
            WHEN asset_type = 'tbill' THEN amount * 1.0  -- T-bills at face value
            ELSE amount
          END
        ), 0) as total_value
      FROM grain_treasury
      WHERE status = 'active'
    `

    // Get total GRAIN supply (sum of all user balances)
    const supplyResult = await sql`
      SELECT COALESCE(SUM(balance), 1) as total_supply
      FROM user_wallets
      WHERE user_id NOT IN ('WELLS_ESCROW_ACCOUNT', 'WELLS_TREASURY')
    `

    const treasuryValue = parseFloat(treasuryResult.rows[0]?.total_value || '0')
    const totalSupply = parseFloat(supplyResult.rows[0]?.total_supply || '1')

    // GRAIN price = Treasury / Supply
    // If no treasury yet, price is 1.00 (initial peg)
    if (treasuryValue === 0 || totalSupply === 0) {
      return 1.0
    }

    return treasuryValue / totalSupply
  } catch (e) {
    console.warn('[Price Oracle] Error calculating price:', e)
    return 1.0  // Default to 1.00 on error
  }
}
