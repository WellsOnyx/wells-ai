/**
 * GRAIN Credit Line System
 *
 * Allows qualified buyers to transact beyond their USDC deposits.
 * This creates leverage for Wells AI treasury while providing
 * working capital flexibility to enterprise buyers.
 *
 * ECONOMICS:
 * - USDC deposits earn yield in Circle (4-5% APY)
 * - GRAIN credit lines charge 0-3% fee
 * - Backing ratio target: 0.7-1.0 (70-100% USDC backing)
 * - Max leverage: 1.5x (never exceed $1.50 GRAIN per $1 USDC)
 */

import { sql } from '@vercel/postgres'
import { getGrainBalance, transferGrain } from './circle-native'

// Credit tiers based on account history
export interface CreditTier {
  name: string
  maxLinePercent: number  // Max credit as % of average monthly volume
  interestRate: number    // Annual rate
  gracePeriodDays: number
  minAccountAgeDays: number
  minTransactionCount: number
}

export const CREDIT_TIERS: Record<string, CreditTier> = {
  starter: {
    name: 'Starter',
    maxLinePercent: 0,       // No credit
    interestRate: 0,
    gracePeriodDays: 0,
    minAccountAgeDays: 0,
    minTransactionCount: 0,
  },
  established: {
    name: 'Established',
    maxLinePercent: 25,      // 25% of monthly volume
    interestRate: 0.03,      // 3% APR
    gracePeriodDays: 15,
    minAccountAgeDays: 30,
    minTransactionCount: 5,
  },
  preferred: {
    name: 'Preferred',
    maxLinePercent: 50,      // 50% of monthly volume
    interestRate: 0.02,      // 2% APR
    gracePeriodDays: 30,
    minAccountAgeDays: 90,
    minTransactionCount: 20,
  },
  enterprise: {
    name: 'Enterprise',
    maxLinePercent: 100,     // 100% of monthly volume
    interestRate: 0.01,      // 1% APR
    gracePeriodDays: 45,
    minAccountAgeDays: 180,
    minTransactionCount: 50,
  },
}

// System-wide limits
const MAX_SYSTEM_LEVERAGE = 1.5    // Max 1.5 GRAIN per 1 USDC
const MIN_BACKING_RATIO = 0.67    // Min 67% USDC backing
const MAX_SINGLE_CREDIT_LINE = 1000000  // $1M max per account

export interface CreditLine {
  userId: string
  tier: string
  maxLimit: number
  currentBalance: number      // Amount currently borrowed
  availableCredit: number
  interestRate: number
  lastDrawDate: Date | null
  lastPaymentDate: Date | null
  status: 'active' | 'frozen' | 'delinquent'
}

export interface CreditDrawResult {
  success: boolean
  amountDrawn: number
  newBalance: number
  availableCredit: number
  error?: string
}

// ============================================================================
// CREDIT LINE MANAGEMENT
// ============================================================================

/**
 * Calculate credit tier for a user based on history
 */
export async function calculateCreditTier(userId: string): Promise<string> {
  const result = await sql`
    SELECT
      MIN(created_at) as first_transaction,
      COUNT(*) as transaction_count,
      COALESCE(AVG(amount), 0) as avg_amount,
      COALESCE(SUM(amount), 0) as total_volume
    FROM grain_transactions
    WHERE user_id = ${userId}
      AND type IN ('deposit', 'transfer')
      AND status = 'completed'
  `

  const row = result.rows[0]
  if (!row || row.transaction_count === 0) {
    return 'starter'
  }

  const accountAgeDays = row.first_transaction
    ? Math.floor((Date.now() - new Date(row.first_transaction).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  const txCount = parseInt(row.transaction_count)

  // Determine tier
  if (accountAgeDays >= 180 && txCount >= 50) {
    return 'enterprise'
  } else if (accountAgeDays >= 90 && txCount >= 20) {
    return 'preferred'
  } else if (accountAgeDays >= 30 && txCount >= 5) {
    return 'established'
  }

  return 'starter'
}

/**
 * Get or create credit line for user
 */
export async function getCreditLine(userId: string): Promise<CreditLine> {
  // Get existing credit line
  const existing = await sql`
    SELECT * FROM grain_credit_lines WHERE user_id = ${userId}
  `

  if (existing.rows.length > 0) {
    const row = existing.rows[0]
    return {
      userId: row.user_id,
      tier: row.tier,
      maxLimit: parseFloat(row.max_limit),
      currentBalance: parseFloat(row.current_balance),
      availableCredit: parseFloat(row.max_limit) - parseFloat(row.current_balance),
      interestRate: parseFloat(row.interest_rate),
      lastDrawDate: row.last_draw_date,
      lastPaymentDate: row.last_payment_date,
      status: row.status,
    }
  }

  // Calculate new credit line
  const tier = await calculateCreditTier(userId)
  const tierConfig = CREDIT_TIERS[tier]

  // Calculate max limit based on monthly volume
  const volumeResult = await sql`
    SELECT COALESCE(SUM(amount), 0) as monthly_volume
    FROM grain_transactions
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '30 days'
      AND type IN ('deposit', 'transfer')
      AND status = 'completed'
  `

  const monthlyVolume = parseFloat(volumeResult.rows[0]?.monthly_volume || 0)
  const maxLimit = Math.min(
    monthlyVolume * (tierConfig.maxLinePercent / 100),
    MAX_SINGLE_CREDIT_LINE
  )

  // Create credit line record
  await sql`
    INSERT INTO grain_credit_lines (
      user_id, tier, max_limit, current_balance, interest_rate, status, created_at
    ) VALUES (
      ${userId}, ${tier}, ${maxLimit}, 0, ${tierConfig.interestRate}, 'active', NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      tier = ${tier},
      max_limit = ${maxLimit},
      interest_rate = ${tierConfig.interestRate},
      updated_at = NOW()
  `

  return {
    userId,
    tier,
    maxLimit,
    currentBalance: 0,
    availableCredit: maxLimit,
    interestRate: tierConfig.interestRate,
    lastDrawDate: null,
    lastPaymentDate: null,
    status: 'active',
  }
}

/**
 * Check if system can support additional credit
 */
async function checkSystemCapacity(additionalCredit: number): Promise<boolean> {
  const result = await sql`
    SELECT
      (SELECT COALESCE(SUM(balance), 0) FROM user_wallets) as total_grain,
      (SELECT COALESCE(SUM(current_balance), 0) FROM grain_credit_lines) as total_credit
  `

  const totalGrain = parseFloat(result.rows[0]?.total_grain || 0)
  const totalCredit = parseFloat(result.rows[0]?.total_credit || 0)

  // Get USDC backing from Circle (simplified - would call Circle API)
  const usdcBacking = totalGrain - totalCredit // Assume all non-credit is backed

  const newTotalCredit = totalCredit + additionalCredit
  const newBackingRatio = usdcBacking / (totalGrain + additionalCredit)

  return newBackingRatio >= MIN_BACKING_RATIO
}

/**
 * Draw from credit line (borrow GRAIN)
 */
export async function drawCredit(
  userId: string,
  amount: number,
  reason: string
): Promise<CreditDrawResult> {
  const creditLine = await getCreditLine(userId)

  // Check credit line status
  if (creditLine.status !== 'active') {
    return {
      success: false,
      amountDrawn: 0,
      newBalance: creditLine.currentBalance,
      availableCredit: creditLine.availableCredit,
      error: `Credit line is ${creditLine.status}`,
    }
  }

  // Check available credit
  if (amount > creditLine.availableCredit) {
    return {
      success: false,
      amountDrawn: 0,
      newBalance: creditLine.currentBalance,
      availableCredit: creditLine.availableCredit,
      error: `Requested ${amount} exceeds available credit of ${creditLine.availableCredit}`,
    }
  }

  // Check system capacity
  const hasCapacity = await checkSystemCapacity(amount)
  if (!hasCapacity) {
    return {
      success: false,
      amountDrawn: 0,
      newBalance: creditLine.currentBalance,
      availableCredit: creditLine.availableCredit,
      error: 'System credit capacity temporarily limited',
    }
  }

  // Draw credit - credit GRAIN to user without USDC backing
  await sql`
    UPDATE user_wallets
    SET balance = balance + ${amount}, updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Update credit line
  await sql`
    UPDATE grain_credit_lines
    SET
      current_balance = current_balance + ${amount},
      last_draw_date = NOW(),
      updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Log transaction
  await sql`
    INSERT INTO grain_transactions (
      user_id, type, amount, reason, status, created_at
    ) VALUES (
      ${userId}, 'credit_draw', ${amount}, ${reason}, 'completed', NOW()
    )
  `

  return {
    success: true,
    amountDrawn: amount,
    newBalance: creditLine.currentBalance + amount,
    availableCredit: creditLine.availableCredit - amount,
  }
}

/**
 * Repay credit line
 */
export async function repayCredit(
  userId: string,
  amount: number
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const creditLine = await getCreditLine(userId)
  const grainBalance = await getGrainBalance(userId)

  // Check GRAIN balance
  if (grainBalance.grainBalance < amount) {
    return {
      success: false,
      newBalance: creditLine.currentBalance,
      error: 'Insufficient GRAIN balance for repayment',
    }
  }

  const repayAmount = Math.min(amount, creditLine.currentBalance)

  // Debit GRAIN from user
  await sql`
    UPDATE user_wallets
    SET balance = balance - ${repayAmount}, updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Update credit line
  await sql`
    UPDATE grain_credit_lines
    SET
      current_balance = current_balance - ${repayAmount},
      last_payment_date = NOW(),
      updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Log transaction
  await sql`
    INSERT INTO grain_transactions (
      user_id, type, amount, reason, status, created_at
    ) VALUES (
      ${userId}, 'credit_repay', ${repayAmount}, 'Credit line repayment', 'completed', NOW()
    )
  `

  return {
    success: true,
    newBalance: creditLine.currentBalance - repayAmount,
  }
}

// ============================================================================
// TREASURY ECONOMICS
// ============================================================================

export interface TreasuryMetrics {
  totalGrainSupply: number
  totalUsdcBacking: number
  backingRatio: number
  totalCreditExtended: number
  effectiveLeverage: number
  estimatedFloatIncome: number  // Annual
  creditInterestIncome: number  // Annual
  systemHealth: 'healthy' | 'caution' | 'critical'
}

/**
 * Get treasury economic metrics
 */
export async function getTreasuryMetrics(): Promise<TreasuryMetrics> {
  const result = await sql`
    SELECT
      (SELECT COALESCE(SUM(balance), 0) FROM user_wallets) as total_grain,
      (SELECT COALESCE(SUM(current_balance), 0) FROM grain_credit_lines) as total_credit,
      (SELECT COALESCE(SUM(current_balance * interest_rate), 0) FROM grain_credit_lines) as annual_interest
  `

  const totalGrain = parseFloat(result.rows[0]?.total_grain || 0)
  const totalCredit = parseFloat(result.rows[0]?.total_credit || 0)
  const annualInterest = parseFloat(result.rows[0]?.annual_interest || 0)

  // USDC backing = total GRAIN - credit (credit is unbacked GRAIN)
  const usdcBacking = totalGrain - totalCredit
  const backingRatio = totalGrain > 0 ? usdcBacking / totalGrain : 1
  const leverage = usdcBacking > 0 ? totalGrain / usdcBacking : 1

  // Estimate float income (4.5% APY on USDC)
  const floatIncome = usdcBacking * 0.045

  // Determine system health
  let health: 'healthy' | 'caution' | 'critical' = 'healthy'
  if (backingRatio < MIN_BACKING_RATIO) {
    health = 'critical'
  } else if (backingRatio < 0.8) {
    health = 'caution'
  }

  return {
    totalGrainSupply: totalGrain,
    totalUsdcBacking: usdcBacking,
    backingRatio,
    totalCreditExtended: totalCredit,
    effectiveLeverage: leverage,
    estimatedFloatIncome: floatIncome,
    creditInterestIncome: annualInterest,
    systemHealth: health,
  }
}
