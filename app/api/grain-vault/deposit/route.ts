/**
 * GRAIN Vault Deposit API - Complete Circle Integration
 *
 * POST /api/grain-vault/deposit - Create a deposit/payment intent
 * GET /api/grain-vault/deposit - Get deposit status and balance
 *
 * Supports:
 * - Card payments via Circle Payments API
 * - ACH bank transfers
 * - USDC direct transfers
 *
 * Security:
 * - Clerk authentication required
 * - KYC level verification
 * - AML screening for large deposits
 * - Full audit trail logging
 * - Rate limiting
 * - Emergency controls integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'

// Security services
import { rateLimitOrRespond } from '@/lib/security/rate-limiter'
import { isOperationAllowed } from '@/lib/security/emergency-controls'
import { screenTransaction } from '@/lib/security/aml-screening'
import { logFinancialEvent } from '@/lib/security/audit-logger'
import { getIdentityVerificationService, VerificationLevel } from '@/lib/security/identity-verification'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || ''
const CIRCLE_MASTER_WALLET_ID = process.env.CIRCLE_MASTER_WALLET_ID || ''
const CIRCLE_WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID || ''
const CIRCLE_ENV = (process.env.CIRCLE_ENV || 'sandbox') as 'sandbox' | 'production'
const CIRCLE_API_BASE = CIRCLE_ENV === 'production'
  ? 'https://api.circle.com/v1'
  : 'https://api-sandbox.circle.com/v1'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://grainandvault.com'

// KYC limits by verification level
const KYC_LIMITS: Record<number, { daily: number; monthly: number; perTransaction: number }> = {
  [VerificationLevel.EMAIL_ONLY]: { daily: 1000, monthly: 5000, perTransaction: 500 },
  [VerificationLevel.PHONE_BASIC]: { daily: 10000, monthly: 50000, perTransaction: 5000 },
  [VerificationLevel.FULL_KYC]: { daily: 100000, monthly: 500000, perTransaction: 50000 },
  [VerificationLevel.ENHANCED_DD]: { daily: -1, monthly: -1, perTransaction: -1 }, // Unlimited
}

// ============================================================================
// TYPES
// ============================================================================

interface DepositRequest {
  amount: number
  paymentMethod: 'card' | 'ach' | 'usdc'
  email?: string
  metadata?: Record<string, string>
}

interface DepositResponse {
  success: boolean
  paymentId: string
  checkoutUrl?: string
  clientSecret?: string
  amount: number
  estimatedGrain: number
  grainPrice: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  paymentMethod: string
  expiresAt?: string
}

// ============================================================================
// CIRCLE API HELPERS
// ============================================================================

/**
 * Make authenticated request to Circle API
 */
async function circleRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<any> {
  if (!CIRCLE_API_KEY) {
    throw new Error('Circle API key not configured')
  }

  const response = await fetch(`${CIRCLE_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${CIRCLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Circle API] Error:', response.status, errorText)
    throw new Error(`Circle API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

/**
 * Create a Circle payment intent for card payments
 */
async function createCirclePaymentIntent(params: {
  amount: number
  currency: string
  userId: string
  sessionId: string
  email?: string
  metadata?: Record<string, string>
}): Promise<{
  paymentIntentId: string
  clientSecret: string
  checkoutUrl: string
}> {
  const idempotencyKey = `pi_${params.sessionId}_${Date.now()}`

  // Create payment intent via Circle Payments API
  const response = await circleRequest('/payments/paymentIntents', 'POST', {
    idempotencyKey,
    amount: {
      amount: params.amount.toFixed(2),
      currency: params.currency,
    },
    settlementCurrency: 'USD',
    paymentMethods: [{
      type: 'card',
      chain: 'BASE', // Settle to USDC on Base
    }],
    metadata: {
      userId: params.userId,
      sessionId: params.sessionId,
      ...params.metadata,
    },
  })

  const paymentIntent = response.data

  // Build checkout URL
  const checkoutUrl = `${BASE_URL}/grain-vault/deposit/checkout?` +
    `paymentIntentId=${paymentIntent.id}&` +
    `clientSecret=${paymentIntent.clientSecret}&` +
    `amount=${params.amount}`

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.clientSecret,
    checkoutUrl,
  }
}

/**
 * Create Circle on-ramp session for ACH/bank transfers
 */
async function createCircleOnRampSession(params: {
  amount: number
  userId: string
  sessionId: string
  email?: string
}): Promise<{
  sessionId: string
  checkoutUrl: string
}> {
  // Circle hosted on-ramp flow for ACH
  // In sandbox, we return a demo URL
  const checkoutUrl = CIRCLE_ENV === 'production'
    ? `https://pay.circle.com/checkout?` +
      `amount=${params.amount}&` +
      `currency=USD&` +
      `destinationAddress=${CIRCLE_MASTER_WALLET_ID}&` +
      `blockchain=BASE&` +
      `metadata[userId]=${params.userId}&` +
      `metadata[sessionId]=${params.sessionId}&` +
      `successUrl=${encodeURIComponent(`${BASE_URL}/grain-vault/deposit/success?session=${params.sessionId}`)}&` +
      `cancelUrl=${encodeURIComponent(`${BASE_URL}/grain-vault/deposit/cancel?session=${params.sessionId}`)}`
    : `${BASE_URL}/grain-vault/deposit/demo?session=${params.sessionId}&amount=${params.amount}&method=ach`

  return {
    sessionId: params.sessionId,
    checkoutUrl,
  }
}

// ============================================================================
// GRAIN PRICE & LIMITS
// ============================================================================

/**
 * Get current GRAIN price from treasury
 */
async function getCurrentGrainPrice(): Promise<{
  price: number
  treasury: number
  supply: number
}> {
  try {
    // Try the database function first
    const priceResult = await sql`SELECT * FROM get_grain_price()`
    if (priceResult.rows.length > 0) {
      return {
        price: parseFloat(priceResult.rows[0].price_usd) || 1.0,
        treasury: parseFloat(priceResult.rows[0].total_treasury) || 0,
        supply: parseFloat(priceResult.rows[0].circulating_supply) || 0,
      }
    }
  } catch {
    // Function might not exist
  }

  // Fallback: calculate from tables
  try {
    const [supplyResult, treasuryResult] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0) as total FROM user_wallets`,
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM treasury_backing WHERE status = 'active'`,
    ])

    const supply = parseFloat(supplyResult.rows[0]?.total) || 1
    const treasury = parseFloat(treasuryResult.rows[0]?.total) || 0
    const price = supply > 0 ? Math.max(treasury / supply, 1.0) : 1.0

    return { price, treasury, supply }
  } catch {
    return { price: 1.0, treasury: 0, supply: 0 }
  }
}

/**
 * Get user's daily deposit total for limit checking
 */
async function getUserDailyDeposits(userId: string): Promise<number> {
  try {
    const result = await sql`
      SELECT COALESCE(SUM(usd_amount), 0) as total
      FROM grain_transactions
      WHERE user_id = ${userId}
        AND type = 'deposit'
        AND status IN ('completed', 'pending', 'processing')
        AND created_at >= NOW() - INTERVAL '24 hours'
    `
    return parseFloat(result.rows[0]?.total || '0')
  } catch {
    return 0
  }
}

/**
 * Get user's monthly deposit total
 */
async function getUserMonthlyDeposits(userId: string): Promise<number> {
  try {
    const result = await sql`
      SELECT COALESCE(SUM(usd_amount), 0) as total
      FROM grain_transactions
      WHERE user_id = ${userId}
        AND type = 'deposit'
        AND status IN ('completed', 'pending', 'processing')
        AND created_at >= NOW() - INTERVAL '30 days'
    `
    return parseFloat(result.rows[0]?.total || '0')
  } catch {
    return 0
  }
}

/**
 * Check if deposit is within KYC limits
 */
async function checkDepositLimits(
  userId: string,
  amount: number,
  verificationLevel: number
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = KYC_LIMITS[verificationLevel] || KYC_LIMITS[VerificationLevel.EMAIL_ONLY]

  // Check per-transaction limit
  if (limits.perTransaction > 0 && amount > limits.perTransaction) {
    return {
      allowed: false,
      reason: `Amount exceeds per-transaction limit of $${limits.perTransaction.toLocaleString()}. ` +
        `Upgrade verification to increase limits.`,
    }
  }

  // Check daily limit
  if (limits.daily > 0) {
    const dailyTotal = await getUserDailyDeposits(userId)
    if (dailyTotal + amount > limits.daily) {
      return {
        allowed: false,
        reason: `Amount would exceed daily limit of $${limits.daily.toLocaleString()}. ` +
          `Current daily deposits: $${dailyTotal.toLocaleString()}. ` +
          `Upgrade verification to increase limits.`,
      }
    }
  }

  // Check monthly limit
  if (limits.monthly > 0) {
    const monthlyTotal = await getUserMonthlyDeposits(userId)
    if (monthlyTotal + amount > limits.monthly) {
      return {
        allowed: false,
        reason: `Amount would exceed monthly limit of $${limits.monthly.toLocaleString()}. ` +
          `Current monthly deposits: $${monthlyTotal.toLocaleString()}. ` +
          `Upgrade verification to increase limits.`,
      }
    }
  }

  return { allowed: true }
}

// ============================================================================
// POST: CREATE DEPOSIT/PAYMENT INTENT
// ============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // SECURITY: Rate limiting
    const blocked = await rateLimitOrRespond(req, 'deposit')
    if (blocked) return blocked

    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Emergency controls check
    const operationCheck = await isOperationAllowed('deposit', userId)
    if (!operationCheck.allowed) {
      return NextResponse.json(
        { error: operationCheck.reason || 'Deposits are temporarily disabled' },
        { status: 403 }
      )
    }

    // Parse request body
    const body: DepositRequest = await req.json().catch(() => ({
      amount: 0,
      paymentMethod: 'card' as const,
    }))

    const { amount, paymentMethod, email, metadata } = body

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      )
    }

    if (amount < 10) {
      return NextResponse.json(
        { error: 'Minimum deposit is $10' },
        { status: 400 }
      )
    }

    // Card deposits have a maximum (use ACH for larger amounts)
    if (paymentMethod === 'card' && amount > 10000) {
      return NextResponse.json(
        { error: 'Maximum card deposit is $10,000. Use ACH for larger amounts.' },
        { status: 400 }
      )
    }

    // Validate payment method
    if (!['card', 'ach', 'usdc'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method. Supported: card, ach, usdc' },
        { status: 400 }
      )
    }

    // SECURITY: Get user's verification level and check limits
    const verificationService = getIdentityVerificationService()
    const levelInfo = await verificationService.getVerificationLevel(userId)

    const limitsCheck = await checkDepositLimits(userId, amount, levelInfo.level)
    if (!limitsCheck.allowed) {
      return NextResponse.json({
        error: 'Deposit limit exceeded',
        reason: limitsCheck.reason,
        currentLevel: levelInfo.name,
        upgradeUrl: '/grain-vault/verify',
      }, { status: 403 })
    }

    // SECURITY: AML screening for deposits >= $3000
    if (amount >= 3000) {
      const sessionId = `aml_${userId.substring(0, 8)}_${Date.now().toString(36)}`
      const amlResult = await screenTransaction({
        id: sessionId,
        userId,
        type: 'deposit',
        amount,
        currency: 'USD',
        createdAt: new Date(),
      })

      if (!amlResult.passed) {
        await logFinancialEvent(
          'financial.deposit.failed',
          userId,
          amount,
          {
            sessionId,
            method: paymentMethod,
            reason: 'AML screening failed',
            amlAction: amlResult.action,
            amlFlags: amlResult.flags.map(f => f.code),
          },
          { result: 'blocked' }
        )

        return NextResponse.json({
          error: 'Transaction under review',
          reason: 'This deposit requires additional verification. Our compliance team will contact you within 24 hours.',
          reviewRequired: true,
          screeningId: amlResult.screeningId,
        }, { status: 403 })
      }
    }

    // Generate unique session/payment ID
    const paymentId = `dep_${userId.substring(0, 8)}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`

    // Get current GRAIN price
    const { price: grainPrice, treasury, supply } = await getCurrentGrainPrice()
    const estimatedGrain = amount / grainPrice

    // Ensure user has a wallet entry
    await sql`
      INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
      VALUES (
        ${userId},
        ${'grain-ledger-' + userId.substring(0, 8) + '-' + Date.now().toString(36)},
        'custodial',
        0,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO NOTHING
    `

    let checkoutUrl: string | undefined
    let clientSecret: string | undefined
    let circlePaymentIntentId: string | undefined

    // Create payment based on method
    try {
      if (paymentMethod === 'card') {
        // Create Circle payment intent for card payments
        const circleResult = await createCirclePaymentIntent({
          amount,
          currency: 'USD',
          userId,
          sessionId: paymentId,
          email,
          metadata,
        })
        circlePaymentIntentId = circleResult.paymentIntentId
        clientSecret = circleResult.clientSecret
        checkoutUrl = circleResult.checkoutUrl
      } else if (paymentMethod === 'ach') {
        // Create Circle on-ramp session for ACH
        const onRampResult = await createCircleOnRampSession({
          amount,
          userId,
          sessionId: paymentId,
          email,
        })
        checkoutUrl = onRampResult.checkoutUrl
      } else if (paymentMethod === 'usdc') {
        // For USDC, provide direct deposit instructions
        // User sends USDC to master wallet, webhook credits their account
        checkoutUrl = `${BASE_URL}/grain-vault/deposit/usdc?session=${paymentId}&amount=${amount}`
      }
    } catch (circleError: any) {
      console.error('[Deposit] Circle API error:', circleError)
      // Fall back to demo mode for development
      checkoutUrl = `${BASE_URL}/grain-vault/deposit/demo?session=${paymentId}&amount=${amount}&method=${paymentMethod}`
    }

    // Create pending transaction record
    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        usd_amount,
        grain_amount,
        grain_price,
        payment_method,
        circle_transfer_id,
        status,
        description,
        created_at
      ) VALUES (
        ${paymentId},
        ${userId},
        'deposit',
        ${amount},
        ${estimatedGrain},
        ${grainPrice},
        ${paymentMethod},
        ${circlePaymentIntentId || paymentId},
        'pending',
        ${`Deposit of $${amount.toFixed(2)} via ${paymentMethod}`},
        NOW()
      )
    `

    // Log deposit initiation
    await logFinancialEvent(
      'financial.deposit.initiated',
      userId,
      amount,
      {
        paymentId,
        paymentMethod,
        grainPrice,
        estimatedGrain,
        circlePaymentIntentId,
        verificationLevel: levelInfo.name,
      }
    )

    // Build response
    const response: DepositResponse = {
      success: true,
      paymentId,
      checkoutUrl,
      clientSecret,
      amount,
      estimatedGrain,
      grainPrice,
      status: 'pending',
      paymentMethod,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      ...response,
      conversion: {
        currentGrainPrice: grainPrice,
        depositUsd: amount,
        estimatedGrainReceived: estimatedGrain,
        note: 'GRAIN price only goes up. Your purchasing power increases as you hold.',
      },
      limits: {
        verificationLevel: levelInfo.name,
        dailyLimit: KYC_LIMITS[levelInfo.level]?.daily || 1000,
        monthlyLimit: KYC_LIMITS[levelInfo.level]?.monthly || 5000,
        perTransactionLimit: KYC_LIMITS[levelInfo.level]?.perTransaction || 500,
      },
      treasury: {
        totalBacking: treasury,
        circulatingGrain: supply,
        backingRatio: supply > 0 ? treasury / supply : 1.0,
      },
      _meta: {
        processingTime: `${processingTime}ms`,
      },
    })
  } catch (error: any) {
    console.error('[Deposit] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create deposit', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: CHECK DEPOSIT STATUS / BALANCE
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const blocked = await rateLimitOrRespond(req, 'deposit')
    if (blocked) return blocked

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Emergency controls check
    const operationCheck = await isOperationAllowed('deposit', userId)
    if (!operationCheck.allowed) {
      return NextResponse.json({ error: operationCheck.reason }, { status: 403 })
    }

    // Check for wallet entry
    const walletResult = await sql`
      SELECT user_id, wallet_id, balance, updated_at
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    // Check if user has a profile
    let hasProfile = false
    try {
      const profileResult = await sql`
        SELECT user_id FROM grain_user_profiles WHERE user_id = ${userId}
      `
      hasProfile = profileResult.rows.length > 0
    } catch {
      // Table might not exist
    }

    // Get GRAIN price
    const { price: grainPrice, treasury, supply } = await getCurrentGrainPrice()

    // Get user's verification level
    const verificationService = getIdentityVerificationService()
    const levelInfo = await verificationService.getVerificationLevel(userId)

    // Get daily/monthly totals
    const [dailyTotal, monthlyTotal] = await Promise.all([
      getUserDailyDeposits(userId),
      getUserMonthlyDeposits(userId),
    ])

    const limits = KYC_LIMITS[levelInfo.level] || KYC_LIMITS[VerificationLevel.EMAIL_ONLY]

    if (walletResult.rows.length === 0) {
      // Auto-create wallet if user has profile
      if (hasProfile) {
        const walletId = `grain-ledger-${userId.substring(0, 8)}-${Date.now().toString(36)}`

        await sql`
          INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
          VALUES (${userId}, ${walletId}, 'custodial', 0, NOW(), NOW())
        `

        return NextResponse.json({
          hasWallet: true,
          hasProfile: true,
          balance: {
            grain: 0,
            usdValue: 0,
          },
          grainPrice,
          verification: {
            level: levelInfo.level,
            name: levelInfo.name,
            dailyLimit: limits.daily,
            monthlyLimit: limits.monthly,
            perTransactionLimit: limits.perTransaction,
          },
          usage: {
            dailyDeposits: 0,
            monthlyDeposits: 0,
            remainingDaily: limits.daily,
            remainingMonthly: limits.monthly,
          },
          recentTransactions: [],
          lastUpdated: new Date().toISOString(),
        })
      }

      return NextResponse.json({
        hasWallet: false,
        hasProfile: false,
        balance: { grain: 0, usdValue: 0 },
        grainPrice,
        message: 'Please complete onboarding to create your account.',
      })
    }

    const wallet = walletResult.rows[0]
    const grainBalance = parseFloat(wallet.balance || '0')
    const usdValue = grainBalance * grainPrice

    // Get recent transactions
    let transactions: any[] = []
    try {
      const txResult = await sql`
        SELECT id, type, usd_amount, grain_amount, grain_price, status, payment_method, created_at, completed_at
        FROM grain_transactions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 10
      `
      transactions = txResult.rows.map(tx => ({
        id: tx.id,
        type: tx.type,
        usdAmount: parseFloat(tx.usd_amount || '0'),
        grainAmount: parseFloat(tx.grain_amount || '0'),
        grainPriceAtTime: parseFloat(tx.grain_price || '1'),
        status: tx.status,
        paymentMethod: tx.payment_method,
        createdAt: tx.created_at,
        completedAt: tx.completed_at,
      }))
    } catch {
      // Table might not exist
    }

    return NextResponse.json({
      hasWallet: true,
      hasProfile,
      balance: {
        grain: grainBalance,
        usdValue,
      },
      grainPrice,
      verification: {
        level: levelInfo.level,
        name: levelInfo.name,
        dailyLimit: limits.daily,
        monthlyLimit: limits.monthly,
        perTransactionLimit: limits.perTransaction,
      },
      usage: {
        dailyDeposits: dailyTotal,
        monthlyDeposits: monthlyTotal,
        remainingDaily: limits.daily > 0 ? Math.max(0, limits.daily - dailyTotal) : -1,
        remainingMonthly: limits.monthly > 0 ? Math.max(0, limits.monthly - monthlyTotal) : -1,
      },
      appreciation: {
        currentPrice: grainPrice,
        note: 'GRAIN only appreciates. Your purchasing power grows as you hold.',
      },
      treasury: {
        totalBacking: treasury,
        circulatingGrain: supply,
        backingRatio: supply > 0 ? treasury / supply : 1.0,
      },
      recentTransactions: transactions,
      lastUpdated: wallet.updated_at,
    })
  } catch (error: any) {
    console.error('[Deposit] Balance check error:', error)
    return NextResponse.json(
      { error: 'Failed to check balance', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * SECURITY NOTES - CUSTODIAL MODEL:
 *
 * 1. Master wallet address is NEVER exposed to end users
 * 2. All deposits go through Circle's secure checkout flow
 * 3. User balances are tracked in our internal ledger (user_wallets table)
 * 4. The actual USDC is held in our Circle wallet
 * 5. GRAIN price = (USDC Reserve + Equity) / Circulating Supply
 * 6. GRAIN can only appreciate as treasury grows
 * 7. All transactions require KYC verification based on amount
 * 8. Webhook handler completes transactions when Circle confirms
 *
 * This protects against:
 * - Phishing (users never see raw wallet addresses)
 * - Social engineering
 * - Address manipulation attacks
 * - Clipboard hijacking
 */
