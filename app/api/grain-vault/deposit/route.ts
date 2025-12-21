/**
 * Grain & Vault Deposit API
 *
 * Handles deposits via:
 * 1. Card (via Circle Payments API or Demo Mode)
 * 2. USDC transfer (via Circle Programmable Wallets)
 * 3. Bank/ACH (future)
 *
 * DEMO MODE: When Circle is not configured, uses sandbox checkout
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { rateLimit } from '@/lib/security/rate-limiter'
import {
  createPaymentIntent,
  CIRCLE_CONFIG,
  validateCircleConfig,
} from '@/lib/circle'

// Demo mode is OFF - always use real Circle payments
function isDemoMode(): boolean {
  return false
}

// =============================================================================
// POST - Create Deposit
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Apply rate limiting for deposits
    const rateLimitResult = await rateLimit(req, 'deposit')
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // SECURITY: Check if user is approved before allowing deposits
    // Handle case where approved column may not exist yet
    let isApproved = true // Default to approved if column doesn't exist
    try {
      const approvalCheck = await sql`
        SELECT approved FROM user_wallets WHERE user_id = ${userId}
      `
      if (approvalCheck.rows.length > 0 && approvalCheck.rows[0].approved === false) {
        isApproved = false
      }
    } catch (e: any) {
      // Column doesn't exist - allow deposits (backwards compatibility)
      if (!e.message?.includes('approved')) {
        throw e
      }
    }

    if (!isApproved) {
      return NextResponse.json(
        {
          error: 'Account pending approval',
          reason: 'Your account is currently under review. Deposits will be enabled once your account is approved.',
          pending_approval: true
        },
        { status: 403 }
      )
    }

    // Parse request
    const body = await req.json()
    // Accept both 'method' and 'paymentMethod' from frontend
    const { amount, method, paymentMethod } = body
    const depositMethod = method || paymentMethod || 'card'

    // Validate amount
    const depositAmount = parseFloat(amount)
    if (isNaN(depositAmount) || depositAmount < 1) {
      return NextResponse.json(
        { error: 'Minimum deposit is $1' },
        { status: 400 }
      )
    }
    if (depositAmount > 10000) {
      return NextResponse.json(
        { error: 'Maximum deposit is $10,000 per transaction' },
        { status: 400 }
      )
    }

    // Ensure user has wallet record
    await ensureUserWallet(userId)

    // Check KYC limits (skip in demo mode for simplicity)
    const demoMode = isDemoMode()
    if (!demoMode) {
      const limitCheck = await checkDepositLimits(userId, depositAmount)
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { error: limitCheck.reason, upgradeRequired: limitCheck.upgradeRequired },
          { status: 400 }
        )
      }
    }

    // Create deposit based on method
    if (depositMethod === 'card') {
      if (demoMode) {
        // Demo mode: Skip Circle, go straight to sandbox checkout
        return await handleDemoDeposit(userId, depositAmount, user.emailAddresses[0]?.emailAddress)
      } else {
        return await handleCardDeposit(userId, depositAmount, user.emailAddresses[0]?.emailAddress)
      }
    } else if (depositMethod === 'usdc' || depositMethod === 'crypto') {
      return await handleUSDCDeposit(userId, demoMode)
    } else if (depositMethod === 'ach') {
      // ACH not implemented yet - return helpful message
      return NextResponse.json({
        success: false,
        error: 'ACH deposits coming soon. Please use card or crypto for now.',
      }, { status: 400 })
    } else {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[Deposit] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create deposit' },
      { status: 500 }
    )
  }
}

// =============================================================================
// DEMO DEPOSIT (Sandbox Mode - No Circle)
// =============================================================================

async function handleDemoDeposit(
  userId: string,
  amount: number,
  email?: string
): Promise<NextResponse> {
  const sessionId = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`

  // Record pending transaction
  try {
    await sql`
      INSERT INTO grain_transactions (
        user_id,
        type,
        amount,
        reason,
        circle_transfer_id,
        status,
        created_at
      ) VALUES (
        ${userId},
        'deposit',
        ${amount},
        'Demo deposit (sandbox mode)',
        ${sessionId},
        'pending',
        NOW()
      )
    `
  } catch (e) {
    console.warn('[Demo Deposit] Failed to record pending transaction:', e)
  }

  // Build checkout URL for our demo checkout page
  // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > localhost
  let baseUrl = 'http://localhost:3000'
  if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  }
  // Remove trailing slash if present
  baseUrl = baseUrl.replace(/\/$/, '')
  const checkoutUrl = `${baseUrl}/grain-vault/deposit/checkout?session=${sessionId}&amount=${amount}&paymentIntentId=${sessionId}`

  console.log(`[Demo Deposit] Created demo session ${sessionId} for $${amount}`)

  return NextResponse.json({
    success: true,
    sessionId,
    paymentIntentId: sessionId,
    checkoutUrl,
    method: 'card',
    amount,
    demo: true,
  })
}

// =============================================================================
// CARD DEPOSIT (Circle Payments API)
// =============================================================================

async function handleCardDeposit(
  userId: string,
  amount: number,
  email?: string
): Promise<NextResponse> {
  const sessionId = crypto.randomUUID()

  // Create payment intent with Circle
  const result = await createPaymentIntent({
    amount,
    userId,
    sessionId,
    description: `GRAIN deposit - ${email || userId}`,
    metadata: {
      source: 'grain_vault',
      email: email || '',
    },
  })

  if (!result.success) {
    console.error('[Deposit] Failed to create payment intent:', result.error)
    return NextResponse.json(
      { error: result.error || 'Failed to create payment' },
      { status: 500 }
    )
  }

  // Record pending transaction
  try {
    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        usd_amount,
        grain_price,
        payment_method,
        payment_reference,
        status,
        reason,
        created_at
      ) VALUES (
        ${sessionId},
        ${userId},
        'deposit',
        ${amount},
        1.0,
        'card',
        ${result.paymentIntentId},
        'pending',
        'Card deposit via Circle',
        NOW()
      )
    `
  } catch (e) {
    console.warn('[Deposit] Failed to record pending transaction:', e)
  }

  return NextResponse.json({
    success: true,
    sessionId,
    paymentIntentId: result.paymentIntentId,
    checkoutUrl: result.checkoutUrl,
    expiresAt: result.expiresAt,
    method: 'card',
    amount,
  })
}

// =============================================================================
// USDC DEPOSIT (Circle Programmable Wallets)
// =============================================================================

async function handleUSDCDeposit(userId: string, demoMode: boolean = false): Promise<NextResponse> {
  // Get or create user's deposit address
  // For custodial model, this is the master wallet address
  const masterWalletAddress = CIRCLE_CONFIG.w3s.masterWalletAddress

  if (!masterWalletAddress && !demoMode) {
    return NextResponse.json(
      { error: 'USDC deposits not configured' },
      { status: 503 }
    )
  }

  // Demo mode: show placeholder address
  const displayAddress = masterWalletAddress || '0x1234...demo_mode'
  const chain = CIRCLE_CONFIG.defaultChain || 'Base'

  return NextResponse.json({
    success: true,
    method: 'usdc',
    depositAddress: displayAddress,
    blockchain: chain,
    instructions: demoMode
      ? 'DEMO MODE: USDC deposits are simulated. In production, send USDC to the displayed address.'
      : `Send USDC on ${chain} to ${displayAddress}. Your GRAIN balance will be credited after 1 confirmation.`,
    note: 'Include your user ID in the transaction memo if possible.',
    demo: demoMode,
  })
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function ensureUserWallet(userId: string): Promise<void> {
  try {
    const walletId = `grain_${userId.substring(0, 8)}_${Date.now().toString(36)}`
    await sql`
      INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
      VALUES (${userId}, ${walletId}, 'custodial', 0, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
    `
  } catch (e) {
    // Ignore - wallet may already exist
    console.warn('[Deposit] ensureUserWallet error (ignored):', e)
  }
}

async function checkDepositLimits(
  userId: string,
  amount: number
): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
  try {
    // Get user's verification level
    const profileResult = await sql`
      SELECT verification_level, daily_deposit_limit
      FROM grain_user_profiles
      WHERE user_id = ${userId}
    `

    let dailyLimit = 1000 // Default for unverified users
    let verificationLevel = 1

    if (profileResult.rows.length > 0) {
      verificationLevel = profileResult.rows[0].verification_level || 1
      dailyLimit = parseFloat(profileResult.rows[0].daily_deposit_limit || '1000')
    }

    // Check amount against daily limit
    if (amount > dailyLimit) {
      return {
        allowed: false,
        reason: `Amount exceeds your daily limit of $${dailyLimit}. Upgrade your verification to increase limits.`,
        upgradeRequired: true,
      }
    }

    // Check daily usage
    const usageResult = await sql`
      SELECT COALESCE(SUM(usd_amount), 0) as daily_total
      FROM grain_transactions
      WHERE user_id = ${userId}
        AND type = 'deposit'
        AND status IN ('completed', 'pending')
        AND created_at > NOW() - INTERVAL '24 hours'
    `

    const dailyUsed = parseFloat(usageResult.rows[0]?.daily_total || '0')
    const remaining = dailyLimit - dailyUsed

    if (amount > remaining) {
      return {
        allowed: false,
        reason: `Amount exceeds your remaining daily limit of $${remaining.toFixed(2)}. Try again tomorrow or upgrade your verification.`,
        upgradeRequired: remaining < 100,
      }
    }

    return { allowed: true }
  } catch (e) {
    console.warn('[Deposit] Failed to check limits:', e)
    // Allow deposit if we can't check limits (fail open for UX)
    return { allowed: true }
  }
}

// =============================================================================
// GET - Get Deposit Status
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      // Return deposit address for USDC deposits
      const masterWalletAddress = CIRCLE_CONFIG.w3s.masterWalletAddress
      return NextResponse.json({
        depositAddress: masterWalletAddress,
        blockchain: CIRCLE_CONFIG.defaultChain,
      })
    }

    // Get transaction status
    const result = await sql`
      SELECT
        id,
        type,
        usd_amount,
        grain_amount,
        status,
        payment_reference,
        created_at,
        completed_at
      FROM grain_transactions
      WHERE id = ${sessionId}
        AND user_id = ${userId}
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const tx = result.rows[0]

    return NextResponse.json({
      id: tx.id,
      status: tx.status,
      amount: parseFloat(tx.usd_amount),
      grainAmount: tx.grain_amount ? parseFloat(tx.grain_amount) : null,
      paymentReference: tx.payment_reference,
      createdAt: tx.created_at,
      completedAt: tx.completed_at,
    })
  } catch (error: any) {
    console.error('[Deposit] Get status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get deposit status' },
      { status: 500 }
    )
  }
}
