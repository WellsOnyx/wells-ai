/**
 * GRAIN Vault Withdrawal API
 *
 * COMPLETE WITHDRAWAL FLOW:
 * 1. User requests withdrawal of GRAIN
 * 2. Validate authentication, rate limits, emergency controls
 * 3. Check KYC level and daily limits
 * 4. Screen for AML compliance
 * 5. Calculate USD equivalent at current GRAIN price
 * 6. Deduct 0.25% withdrawal fee
 * 7. Create pending withdrawal transaction
 * 8. Initiate Circle payout or queue for manual processing
 * 9. Audit log all actions
 *
 * SECURITY:
 * - Rate limiting (withdrawal type)
 * - Emergency controls check
 * - Account freeze check
 * - AML screening for large withdrawals
 * - KYC level verification
 * - 2FA requirement for withdrawals over $5000 (placeholder)
 * - Comprehensive audit logging
 *
 * WITHDRAWAL LIMITS BY KYC LEVEL:
 * - Level 1: $500/day (basic email verification)
 * - Level 2: $5,000/day (ID verified)
 * - Level 3: $50,000/day (enhanced verification)
 * - Level 4: No limit (institutional/accredited)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limiter'
import { isOperationAllowed, isAccountFrozen } from '@/lib/security/emergency-controls'
import { screenTransaction, AML_THRESHOLDS } from '@/lib/security/aml-screening'
import { logFinancialEvent, logSecurityEvent } from '@/lib/security/audit-logger'

// ============================================================================
// CONSTANTS
// ============================================================================

const WITHDRAWAL_FEE_RATE = 0.0025 // 0.25%
const MIN_WITHDRAWAL_AMOUNT = 10 // $10 minimum
const TWO_FA_THRESHOLD = 5000 // Require 2FA for withdrawals over $5000

// KYC Level withdrawal limits (daily, in USD)
const KYC_WITHDRAWAL_LIMITS: Record<number, number> = {
  0: 0,        // Unverified - no withdrawals
  1: 500,      // Basic email verification
  2: 5000,     // ID verified
  3: 50000,    // Enhanced verification
  4: Infinity, // Institutional/accredited - no limit
}

// Estimated arrival times by method
const ESTIMATED_ARRIVAL: Record<string, string> = {
  ach: '2-3 business days',
  wire: '1-2 business days',
  instant: 'Within minutes',
  crypto: 'Within 1 hour',
}

// ============================================================================
// TYPES
// ============================================================================

interface WithdrawalRequest {
  grain_amount: number
  destination_method?: 'ach' | 'wire' | 'instant' | 'crypto'
  bank_account_id?: string
  crypto_address?: string
  two_fa_code?: string
}

interface WithdrawalResponse {
  success: boolean
  withdrawal?: {
    id: string
    grain_amount: number
    grain_price: number
    usd_amount: number
    fee: number
    net_amount: number
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'requires_review'
    estimated_arrival: string
    created_at: string
  }
  error?: string
  requires_2fa?: boolean
  requires_kyc_upgrade?: boolean
  current_kyc_level?: number
  daily_limit?: number
  daily_used?: number
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current GRAIN price from treasury
 */
async function getCurrentGrainPrice(): Promise<number> {
  try {
    const priceResult = await sql`SELECT * FROM get_grain_price()`
    if (priceResult.rows.length > 0) {
      return parseFloat(priceResult.rows[0].price_usd) || 1.0
    }
  } catch {
    // Function might not exist
  }

  // Fallback calculation
  try {
    const [supplyResult, treasuryResult] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0) as total FROM user_wallets`,
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM treasury_backing WHERE status = 'active'`
    ])

    const supply = parseFloat(supplyResult.rows[0]?.total) || 1
    const treasury = parseFloat(treasuryResult.rows[0]?.total) || 0

    return supply > 0 ? Math.max(treasury / supply, 1.0) : 1.0
  } catch {
    return 1.0
  }
}

/**
 * Get user's KYC verification level
 */
async function getUserKycLevel(userId: string): Promise<{
  level: number
  status: string
  dailyLimit: number
}> {
  try {
    const result = await sql`
      SELECT kyc_level, kyc_status
      FROM grain_user_profiles
      WHERE user_id = ${userId}
    `

    if (result.rows.length === 0) {
      return { level: 0, status: 'unverified', dailyLimit: 0 }
    }

    const level = parseInt(result.rows[0].kyc_level) || 0
    const status = result.rows[0].kyc_status || 'unverified'
    const dailyLimit = KYC_WITHDRAWAL_LIMITS[level] || 0

    return { level, status, dailyLimit }
  } catch {
    return { level: 0, status: 'unknown', dailyLimit: 0 }
  }
}

/**
 * Get user's daily withdrawal total
 */
async function getDailyWithdrawalTotal(userId: string): Promise<number> {
  try {
    const result = await sql`
      SELECT COALESCE(SUM(usd_amount), 0) as total
      FROM grain_transactions
      WHERE user_id = ${userId}
        AND type = 'withdrawal'
        AND status NOT IN ('failed', 'cancelled')
        AND created_at > NOW() - INTERVAL '24 hours'
    `

    return parseFloat(result.rows[0]?.total) || 0
  } catch {
    return 0
  }
}

/**
 * Get user's GRAIN balance
 */
async function getUserGrainBalance(userId: string): Promise<number> {
  try {
    const result = await sql`
      SELECT COALESCE(balance, 0) as balance
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    return parseFloat(result.rows[0]?.balance) || 0
  } catch {
    return 0
  }
}

/**
 * Generate unique withdrawal ID
 */
function generateWithdrawalId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `wd_${timestamp}${random}`
}

/**
 * Get client IP for audit logging
 */
function getClientIP(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return req.headers.get('x-real-ip') || 'unknown'
}

// ============================================================================
// POST: Process withdrawal request
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse<WithdrawalResponse>> {
  const requestId = crypto.randomUUID()
  const ipAddress = getClientIP(req)
  const userAgent = req.headers.get('user-agent') || undefined

  try {
    // -------------------------------------------------------------------------
    // 1. RATE LIMITING
    // -------------------------------------------------------------------------
    const rateLimitResult = await rateLimit(req, 'withdrawal')
    if (!rateLimitResult.success) {
      await logSecurityEvent('security.rate.limit.exceeded', 'anonymous', {
        endpoint: '/api/grain-vault/withdraw',
        type: 'withdrawal',
      }, { ipAddress, userAgent, result: 'blocked', requestId })

      return new NextResponse(
        JSON.stringify({ success: false, error: rateLimitResult.error }),
        { status: 429, headers: rateLimitResult.headers }
      ) as NextResponse<WithdrawalResponse>
    }

    // -------------------------------------------------------------------------
    // 2. AUTHENTICATION
    // -------------------------------------------------------------------------
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized. Please log in to continue.',
      }, { status: 401 })
    }

    // -------------------------------------------------------------------------
    // 3. EMERGENCY CONTROLS CHECK
    // -------------------------------------------------------------------------
    const operationCheck = await isOperationAllowed('withdrawal', userId)
    if (!operationCheck.allowed) {
      await logSecurityEvent('security.block.applied', userId, {
        reason: operationCheck.reason,
        operation: 'withdrawal',
      }, { ipAddress, userAgent, result: 'blocked', requestId })

      return NextResponse.json({
        success: false,
        error: operationCheck.reason || 'Withdrawals are temporarily disabled.',
      }, { status: 403 })
    }

    // -------------------------------------------------------------------------
    // 4. ACCOUNT FREEZE CHECK
    // -------------------------------------------------------------------------
    const freezeCheck = await isAccountFrozen(userId)
    if (freezeCheck.frozen) {
      await logSecurityEvent('security.block.applied', userId, {
        reason: freezeCheck.reason,
        status: freezeCheck.status,
        operation: 'withdrawal',
      }, { ipAddress, userAgent, result: 'blocked', requestId })

      return NextResponse.json({
        success: false,
        error: 'Your account is frozen. Please contact support.',
      }, { status: 403 })
    }

    // -------------------------------------------------------------------------
    // 5. PARSE AND VALIDATE REQUEST
    // -------------------------------------------------------------------------
    const body: WithdrawalRequest = await req.json().catch(() => ({ grain_amount: 0 }))
    const { grain_amount, destination_method = 'ach', two_fa_code } = body

    if (!grain_amount || grain_amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid withdrawal amount. Please specify a positive GRAIN amount.',
      }, { status: 400 })
    }

    // -------------------------------------------------------------------------
    // 6. GET CURRENT GRAIN PRICE AND CALCULATE USD EQUIVALENT
    // -------------------------------------------------------------------------
    const grainPrice = await getCurrentGrainPrice()
    const usdAmount = grain_amount * grainPrice

    // Check minimum withdrawal
    if (usdAmount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json({
        success: false,
        error: `Minimum withdrawal is $${MIN_WITHDRAWAL_AMOUNT}. Your withdrawal would be $${usdAmount.toFixed(2)}.`,
      }, { status: 400 })
    }

    // -------------------------------------------------------------------------
    // 7. CHECK USER GRAIN BALANCE
    // -------------------------------------------------------------------------
    const userBalance = await getUserGrainBalance(userId)
    if (grain_amount > userBalance) {
      return NextResponse.json({
        success: false,
        error: `Insufficient GRAIN balance. Available: ${userBalance.toFixed(6)} GRAIN.`,
      }, { status: 400 })
    }

    // -------------------------------------------------------------------------
    // 8. KYC LEVEL VERIFICATION
    // -------------------------------------------------------------------------
    const kycInfo = await getUserKycLevel(userId)

    if (kycInfo.level === 0) {
      return NextResponse.json({
        success: false,
        error: 'Please complete identity verification before withdrawing.',
        requires_kyc_upgrade: true,
        current_kyc_level: 0,
      }, { status: 403 })
    }

    // -------------------------------------------------------------------------
    // 9. CHECK DAILY WITHDRAWAL LIMITS
    // -------------------------------------------------------------------------
    const dailyUsed = await getDailyWithdrawalTotal(userId)
    const dailyLimit = kycInfo.dailyLimit
    const remainingLimit = dailyLimit - dailyUsed

    if (usdAmount > remainingLimit && dailyLimit !== Infinity) {
      return NextResponse.json({
        success: false,
        error: `This withdrawal exceeds your daily limit. Remaining: $${remainingLimit.toFixed(2)}. Upgrade your verification level for higher limits.`,
        requires_kyc_upgrade: usdAmount > KYC_WITHDRAWAL_LIMITS[kycInfo.level + 1] || false,
        current_kyc_level: kycInfo.level,
        daily_limit: dailyLimit,
        daily_used: dailyUsed,
      }, { status: 400 })
    }

    // -------------------------------------------------------------------------
    // 10. 2FA REQUIREMENT FOR LARGE WITHDRAWALS
    // -------------------------------------------------------------------------
    if (usdAmount > TWO_FA_THRESHOLD) {
      // TODO: Implement actual 2FA verification
      // For now, this is a placeholder that checks if 2FA code was provided
      if (!two_fa_code) {
        await logSecurityEvent('auth.mfa.challenge', userId, {
          amount: usdAmount,
          threshold: TWO_FA_THRESHOLD,
          operation: 'withdrawal',
        }, { ipAddress, userAgent, result: 'partial', requestId })

        return NextResponse.json({
          success: false,
          error: 'Two-factor authentication required for withdrawals over $5,000.',
          requires_2fa: true,
        }, { status: 403 })
      }

      // TODO: Verify 2FA code here
      // const isValid2FA = await verify2FACode(userId, two_fa_code)
      // if (!isValid2FA) {
      //   return NextResponse.json({
      //     success: false,
      //     error: 'Invalid 2FA code. Please try again.',
      //   }, { status: 403 })
      // }
    }

    // -------------------------------------------------------------------------
    // 11. AML SCREENING FOR LARGE WITHDRAWALS
    // -------------------------------------------------------------------------
    let requiresReview = false
    let screeningId: string | undefined

    if (usdAmount >= AML_THRESHOLDS.SAR_THRESHOLD) {
      const amlResult = await screenTransaction({
        id: generateWithdrawalId(),
        userId,
        type: 'withdraw',
        amount: usdAmount,
        currency: 'USD',
        paymentMethod: destination_method,
        createdAt: new Date(),
      })

      screeningId = amlResult.screeningId

      if (!amlResult.passed) {
        if (amlResult.action === 'block' || amlResult.action === 'report') {
          await logSecurityEvent('security.suspicious.activity', userId, {
            reason: 'AML screening failed',
            flags: amlResult.flags,
            riskScore: amlResult.riskScore,
            amount: usdAmount,
          }, { ipAddress, userAgent, result: 'blocked', requestId })

          return NextResponse.json({
            success: false,
            error: 'This withdrawal requires additional review. Our compliance team will contact you shortly.',
          }, { status: 403 })
        }

        if (amlResult.action === 'review') {
          requiresReview = true
        }
      }

      // Log CTR if required
      if (amlResult.requiresCTR) {
        await logFinancialEvent('financial.withdrawal.initiated', userId, usdAmount, {
          ctrRequired: true,
          screeningId: amlResult.screeningId,
        }, { transactionId: screeningId, ipAddress, userAgent, requestId })
      }
    }

    // -------------------------------------------------------------------------
    // 12. CALCULATE FEES
    // -------------------------------------------------------------------------
    const fee = Math.round(usdAmount * WITHDRAWAL_FEE_RATE * 100) / 100
    const netAmount = usdAmount - fee

    // -------------------------------------------------------------------------
    // 13. CREATE WITHDRAWAL TRANSACTION
    // -------------------------------------------------------------------------
    const withdrawalId = generateWithdrawalId()
    const status = requiresReview ? 'requires_review' : 'pending'
    const estimatedArrival = ESTIMATED_ARRIVAL[destination_method] || '2-3 business days'

    // Create grain_transactions record
    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        usd_amount,
        grain_amount,
        grain_price,
        fee_usd,
        payment_method,
        status,
        description,
        metadata,
        created_at,
        updated_at
      ) VALUES (
        ${withdrawalId},
        ${userId},
        'withdrawal',
        ${usdAmount},
        ${grain_amount},
        ${grainPrice},
        ${fee},
        ${destination_method},
        ${status},
        ${`Withdrawal of ${grain_amount.toFixed(6)} GRAIN ($${netAmount.toFixed(2)} after $${fee.toFixed(2)} fee)`},
        ${JSON.stringify({
          screeningId,
          requiresReview,
          estimatedArrival,
          kycLevel: kycInfo.level,
        })}::jsonb,
        NOW(),
        NOW()
      )
    `

    // Deduct from user's GRAIN balance
    await sql`
      UPDATE user_wallets
      SET
        balance = balance - ${grain_amount},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    // -------------------------------------------------------------------------
    // 14. INITIATE CIRCLE PAYOUT (or queue for manual processing)
    // -------------------------------------------------------------------------
    // TODO: Implement actual Circle payout integration
    // For now, we queue for manual processing
    if (!requiresReview) {
      try {
        // In production, this would call Circle's payout API
        // await initiateCirclePayout(withdrawalId, netAmount, destination)

        // Update status to processing
        await sql`
          UPDATE grain_transactions
          SET status = 'processing', updated_at = NOW()
          WHERE id = ${withdrawalId}
        `
      } catch (payoutError) {
        console.error('Circle payout initiation failed:', payoutError)
        // Keep as pending for manual processing
      }
    }

    // -------------------------------------------------------------------------
    // 15. AUDIT LOGGING
    // -------------------------------------------------------------------------
    await logFinancialEvent('financial.withdrawal.initiated', userId, usdAmount, {
      withdrawalId,
      grainAmount: grain_amount,
      grainPrice,
      fee,
      netAmount,
      destinationMethod: destination_method,
      status,
      kycLevel: kycInfo.level,
      screeningId,
    }, {
      transactionId: withdrawalId,
      ipAddress,
      userAgent,
      result: 'success',
      requestId,
    })

    // -------------------------------------------------------------------------
    // 16. RETURN SUCCESS RESPONSE
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawalId,
        grain_amount,
        grain_price: grainPrice,
        usd_amount: usdAmount,
        fee,
        net_amount: netAmount,
        status: status as 'pending' | 'processing' | 'requires_review',
        estimated_arrival: estimatedArrival,
        created_at: new Date().toISOString(),
      },
    })

  } catch (error) {
    console.error('Withdrawal error:', error)

    // Log the error
    await logSecurityEvent('security.alert.triggered', 'system', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: '/api/grain-vault/withdraw',
      requestId,
    }, { ipAddress, result: 'failure' }).catch(() => {})

    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    }, { status: 500 })
  }
}

// ============================================================================
// GET: Check withdrawal status and history
// ============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION
    // -------------------------------------------------------------------------
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const withdrawalId = searchParams.get('id')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    // -------------------------------------------------------------------------
    // 2. GET CURRENT GRAIN PRICE
    // -------------------------------------------------------------------------
    const grainPrice = await getCurrentGrainPrice()

    // -------------------------------------------------------------------------
    // 3. GET USER KYC INFO AND LIMITS
    // -------------------------------------------------------------------------
    const kycInfo = await getUserKycLevel(userId)
    const dailyUsed = await getDailyWithdrawalTotal(userId)
    const dailyRemaining = Math.max(0, kycInfo.dailyLimit - dailyUsed)

    // -------------------------------------------------------------------------
    // 4. FETCH SPECIFIC WITHDRAWAL OR LIST
    // -------------------------------------------------------------------------
    if (withdrawalId) {
      // Get specific withdrawal
      const result = await sql`
        SELECT
          id,
          type,
          usd_amount,
          grain_amount,
          grain_price,
          fee_usd,
          payment_method,
          status,
          description,
          metadata,
          created_at,
          updated_at
        FROM grain_transactions
        WHERE id = ${withdrawalId}
          AND user_id = ${userId}
          AND type = 'withdrawal'
      `

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
      }

      const withdrawal = result.rows[0]
      const metadata = withdrawal.metadata || {}

      return NextResponse.json({
        success: true,
        withdrawal: {
          id: withdrawal.id,
          grain_amount: parseFloat(withdrawal.grain_amount),
          grain_price: parseFloat(withdrawal.grain_price),
          usd_amount: parseFloat(withdrawal.usd_amount),
          fee: parseFloat(withdrawal.fee_usd || 0),
          net_amount: parseFloat(withdrawal.usd_amount) - parseFloat(withdrawal.fee_usd || 0),
          status: withdrawal.status,
          payment_method: withdrawal.payment_method,
          estimated_arrival: metadata.estimatedArrival || 'Unknown',
          requires_review: metadata.requiresReview || false,
          created_at: withdrawal.created_at,
          updated_at: withdrawal.updated_at,
        },
        fee_breakdown: {
          gross_amount: parseFloat(withdrawal.usd_amount),
          withdrawal_fee: parseFloat(withdrawal.fee_usd || 0),
          fee_rate: `${WITHDRAWAL_FEE_RATE * 100}%`,
          net_amount: parseFloat(withdrawal.usd_amount) - parseFloat(withdrawal.fee_usd || 0),
        },
      })
    }

    // Get withdrawal history
    let query = sql`
      SELECT
        id,
        usd_amount,
        grain_amount,
        grain_price,
        fee_usd,
        payment_method,
        status,
        description,
        metadata,
        created_at,
        updated_at
      FROM grain_transactions
      WHERE user_id = ${userId}
        AND type = 'withdrawal'
    `

    // Apply status filter if provided
    let withdrawals
    if (status && ['pending', 'processing', 'completed', 'failed', 'requires_review', 'cancelled'].includes(status)) {
      withdrawals = await sql`
        SELECT
          id,
          usd_amount,
          grain_amount,
          grain_price,
          fee_usd,
          payment_method,
          status,
          description,
          metadata,
          created_at,
          updated_at
        FROM grain_transactions
        WHERE user_id = ${userId}
          AND type = 'withdrawal'
          AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else {
      withdrawals = await sql`
        SELECT
          id,
          usd_amount,
          grain_amount,
          grain_price,
          fee_usd,
          payment_method,
          status,
          description,
          metadata,
          created_at,
          updated_at
        FROM grain_transactions
        WHERE user_id = ${userId}
          AND type = 'withdrawal'
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    // Format withdrawals
    const formattedWithdrawals = withdrawals.rows.map(w => {
      const metadata = w.metadata || {}
      return {
        id: w.id,
        grain_amount: parseFloat(w.grain_amount),
        grain_price: parseFloat(w.grain_price),
        usd_amount: parseFloat(w.usd_amount),
        fee: parseFloat(w.fee_usd || 0),
        net_amount: parseFloat(w.usd_amount) - parseFloat(w.fee_usd || 0),
        status: w.status,
        payment_method: w.payment_method,
        estimated_arrival: metadata.estimatedArrival || 'Unknown',
        created_at: w.created_at,
        updated_at: w.updated_at,
      }
    })

    // Calculate summary stats
    const pending = formattedWithdrawals.filter(w => ['pending', 'processing', 'requires_review'].includes(w.status))
    const completed = formattedWithdrawals.filter(w => w.status === 'completed')
    const totalPending = pending.reduce((sum, w) => sum + w.net_amount, 0)
    const totalCompleted = completed.reduce((sum, w) => sum + w.net_amount, 0)

    return NextResponse.json({
      success: true,
      withdrawals: formattedWithdrawals,
      summary: {
        pending_count: pending.length,
        pending_amount: totalPending,
        completed_count: completed.length,
        completed_amount: totalCompleted,
      },
      limits: {
        kyc_level: kycInfo.level,
        daily_limit: kycInfo.dailyLimit === Infinity ? 'Unlimited' : kycInfo.dailyLimit,
        daily_used: dailyUsed,
        daily_remaining: kycInfo.dailyLimit === Infinity ? 'Unlimited' : dailyRemaining,
        minimum_withdrawal: MIN_WITHDRAWAL_AMOUNT,
        withdrawal_fee_rate: `${WITHDRAWAL_FEE_RATE * 100}%`,
        two_fa_threshold: TWO_FA_THRESHOLD,
      },
      current_grain_price: grainPrice,
      estimated_arrival_times: ESTIMATED_ARRIVAL,
    })

  } catch (error) {
    console.error('Withdrawal status error:', error)
    return NextResponse.json({
      error: 'Failed to fetch withdrawal information',
    }, { status: 500 })
  }
}
