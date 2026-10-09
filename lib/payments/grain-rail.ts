// @ts-nocheck
/**
 * GRAIN Payment Rail - The Unified Payment Infrastructure
 *
 * This is the core payment abstraction that makes GRAIN the default payment
 * mechanism across all of WellsAI and Grain & Vault.
 *
 * Philosophy:
 * - GRAIN is the FIRST option, always
 * - USDC is a fallback for users without GRAIN
 * - USD/fiat is the last resort for onboarding
 *
 * Every transaction should:
 * 1. Check GRAIN balance first
 * 2. Check credit line eligibility
 * 3. Offer conversion if needed
 * 4. Execute via optimal rail
 * 5. Collect fees in GRAIN
 * 6. Track in unified ledger
 */

import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// ============================================================================
// TYPES
// ============================================================================

export type PaymentRail = 'grain' | 'usdc' | 'usd'
export type PaymentMethod = 'balance' | 'credit_line' | 'deposit' | 'conversion'
export type TransactionType =
  | 'payment'
  | 'transfer'
  | 'escrow_fund'
  | 'escrow_release'
  | 'fee'
  | 'payroll'
  | 'refund'
  | 'credit_draw'
  | 'credit_repay'
  | 'deposit'
  | 'withdrawal'
  | 'conversion'

export interface PaymentRequest {
  // Who
  fromUserId: string
  toUserId?: string // Optional for deposits/withdrawals
  toAddress?: string // External wallet or bank

  // What
  amount: number
  currency: 'USD' | 'GRAIN' // Input currency
  preferredRail?: PaymentRail // Hint, not requirement

  // Why
  type: TransactionType
  reference?: string // Invoice ID, Deal ID, Job ID, etc.
  memo?: string

  // Options
  allowCreditLine?: boolean
  allowConversion?: boolean
  maxFeePercent?: number // User's max acceptable fee
  escrowUntil?: Date // For escrow transactions
}

export interface PaymentResult {
  success: boolean
  transactionId: string
  rail: PaymentRail
  method: PaymentMethod

  // Amounts
  inputAmount: number
  inputCurrency: string
  executedAmount: number
  executedCurrency: string
  feeAmount: number
  feeCurrency: string

  // For recipient
  recipientReceives: number
  recipientCurrency: string

  // Metadata
  creditLineUsed?: number
  conversionRate?: number
  escrowId?: string
  estimatedSettlement?: Date

  // Error handling
  error?: string
  failureReason?: string
}

export interface UserPaymentProfile {
  userId: string
  email: string

  // Balances
  grainBalance: number
  usdcBalance: number

  // Credit
  creditTier: 'none' | 'starter' | 'established' | 'preferred' | 'enterprise'
  creditLimit: number
  creditUsed: number
  creditAvailable: number
  creditApr: number

  // Limits
  dailyLimit: number
  dailyUsed: number
  monthlyLimit: number
  monthlyUsed: number

  // Status
  kycLevel: 'none' | 'basic' | 'verified' | 'enhanced'
  canUseCreditLine: boolean
  canWithdraw: boolean
}

// ============================================================================
// GRAIN ORACLE - Price Discovery
// ============================================================================

/**
 * Get current GRAIN price from treasury backing
 * Formula: GRAIN Price = (USDC Backing + Asset Value) / Total GRAIN Supply
 * Floor: $1.00 (GRAIN can never be worth less than $1)
 */
export async function getGrainPrice(): Promise<{
  price: number
  usdcBacking: number
  assetValue: number
  totalSupply: number
  backingRatio: number
}> {
  if (!sql) {
    return { price: 1.0, usdcBacking: 0, assetValue: 0, totalSupply: 0, backingRatio: 1.0 }
  }

  // Get treasury backing
  const [backing] = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN asset_type IN ('usdc', 'usd_cash') THEN current_value ELSE 0 END), 0) as usdc_backing,
      COALESCE(SUM(CASE WHEN asset_type NOT IN ('usdc', 'usd_cash') THEN current_value ELSE 0 END), 0) as asset_value
    FROM grain_asset_holdings
    WHERE is_active = true
  `

  // Get total GRAIN supply
  const [supply] = await sql`
    SELECT COALESCE(SUM(balance), 0) as total_supply
    FROM user_wallets
  `

  const usdcBacking = parseFloat(backing?.usdc_backing || '0')
  const assetValue = parseFloat(backing?.asset_value || '0')
  const totalSupply = parseFloat(supply?.total_supply || '0')

  // Calculate price with $1 floor
  const totalValue = usdcBacking + assetValue
  const calculatedPrice = totalSupply > 0 ? totalValue / totalSupply : 1.0
  const price = Math.max(1.0, calculatedPrice)
  const backingRatio = totalSupply > 0 ? totalValue / totalSupply : 1.0

  return {
    price,
    usdcBacking,
    assetValue,
    totalSupply,
    backingRatio,
  }
}

/**
 * Convert between USD and GRAIN
 */
export async function convertAmount(
  amount: number,
  from: 'USD' | 'GRAIN',
  to: 'USD' | 'GRAIN'
): Promise<{ amount: number; rate: number }> {
  if (from === to) {
    return { amount, rate: 1.0 }
  }

  const { price } = await getGrainPrice()

  if (from === 'USD' && to === 'GRAIN') {
    // USD → GRAIN: divide by price
    return { amount: amount / price, rate: 1 / price }
  } else {
    // GRAIN → USD: multiply by price
    return { amount: amount * price, rate: price }
  }
}

// ============================================================================
// USER PAYMENT PROFILE
// ============================================================================

/**
 * Get comprehensive payment profile for a user
 * Links treasury_accounts and users tables
 */
export async function getUserPaymentProfile(userId: string): Promise<UserPaymentProfile | null> {
  if (!sql) return null

  // Get user data from both systems
  const [profile] = await sql`
    SELECT
      u.id as user_id,
      u.email,
      COALESCE(w.balance, 0) as grain_balance,
      COALESCE(ub.usdc_balance, 0) as usdc_balance,
      COALESCE(cl.tier, 'none') as credit_tier,
      COALESCE(cl.max_limit, 0) as credit_limit,
      COALESCE(cl.current_balance, 0) as credit_used,
      COALESCE(cl.apr, 0) as credit_apr,
      COALESCE(ta.daily_deposit_limit, 10000) as daily_limit,
      COALESCE(ta.verification_level, 'none') as kyc_level
    FROM users u
    LEFT JOIN user_wallets w ON w.user_id = u.id
    LEFT JOIN user_balances ub ON ub.user_id = u.id
    LEFT JOIN grain_credit_lines cl ON cl.user_id = u.id AND cl.status = 'active'
    LEFT JOIN treasury_accounts ta ON ta.email = u.email
    WHERE u.id = $1
  `

  if (!profile) {
    // Try by email (for treasury-first users)
    const [treasuryProfile] = await sql`
      SELECT
        ta.id as user_id,
        ta.email,
        ta.grain_balance,
        0 as usdc_balance,
        COALESCE(cl.tier, 'none') as credit_tier,
        COALESCE(cl.max_limit, 0) as credit_limit,
        COALESCE(cl.current_balance, 0) as credit_used,
        COALESCE(cl.apr, 0) as credit_apr,
        ta.daily_deposit_limit as daily_limit,
        ta.verification_level as kyc_level
      FROM treasury_accounts ta
      LEFT JOIN grain_credit_lines cl ON cl.user_id = ta.id::text AND cl.status = 'active'
      WHERE ta.id::text = $1
    `

    if (!treasuryProfile) return null

    return {
      userId: treasuryProfile.user_id,
      email: treasuryProfile.email,
      grainBalance: parseFloat(treasuryProfile.grain_balance || '0'),
      usdcBalance: 0,
      creditTier: treasuryProfile.credit_tier,
      creditLimit: parseFloat(treasuryProfile.credit_limit || '0'),
      creditUsed: parseFloat(treasuryProfile.credit_used || '0'),
      creditAvailable: Math.max(0, parseFloat(treasuryProfile.credit_limit || '0') - parseFloat(treasuryProfile.credit_used || '0')),
      creditApr: parseFloat(treasuryProfile.credit_apr || '0'),
      dailyLimit: parseFloat(treasuryProfile.daily_limit || '10000'),
      dailyUsed: 0, // TODO: Calculate from today's transactions
      monthlyLimit: parseFloat(treasuryProfile.daily_limit || '10000') * 30,
      monthlyUsed: 0, // TODO: Calculate from this month's transactions
      kycLevel: treasuryProfile.kyc_level || 'none',
      canUseCreditLine: treasuryProfile.credit_tier !== 'none',
      canWithdraw: ['verified', 'enhanced'].includes(treasuryProfile.kyc_level || 'none'),
    }
  }

  return {
    userId: profile.user_id,
    email: profile.email,
    grainBalance: parseFloat(profile.grain_balance || '0'),
    usdcBalance: parseFloat(profile.usdc_balance || '0'),
    creditTier: profile.credit_tier,
    creditLimit: parseFloat(profile.credit_limit || '0'),
    creditUsed: parseFloat(profile.credit_used || '0'),
    creditAvailable: Math.max(0, parseFloat(profile.credit_limit || '0') - parseFloat(profile.credit_used || '0')),
    creditApr: parseFloat(profile.credit_apr || '0'),
    dailyLimit: parseFloat(profile.daily_limit || '10000'),
    dailyUsed: 0,
    monthlyLimit: parseFloat(profile.daily_limit || '10000') * 30,
    monthlyUsed: 0,
    kycLevel: profile.kyc_level || 'none',
    canUseCreditLine: profile.credit_tier !== 'none',
    canWithdraw: ['verified', 'enhanced'].includes(profile.kyc_level || 'none'),
  }
}

// ============================================================================
// PAYMENT ROUTING - The Core Logic
// ============================================================================

/**
 * Determine the optimal payment route for a request
 * Priority: GRAIN balance → Credit line → USDC → Conversion
 */
export async function routePayment(request: PaymentRequest): Promise<{
  rail: PaymentRail
  method: PaymentMethod
  grainAmount: number
  usdAmount: number
  fee: number
  creditDraw: number
  conversionNeeded: boolean
  canExecute: boolean
  reason?: string
}> {
  const profile = await getUserPaymentProfile(request.fromUserId)

  if (!profile) {
    return {
      rail: 'usd',
      method: 'deposit',
      grainAmount: 0,
      usdAmount: request.amount,
      fee: 0,
      creditDraw: 0,
      conversionNeeded: true,
      canExecute: false,
      reason: 'User profile not found',
    }
  }

  const { price } = await getGrainPrice()

  // Calculate GRAIN amount needed
  let grainNeeded: number
  let usdEquivalent: number

  if (request.currency === 'GRAIN') {
    grainNeeded = request.amount
    usdEquivalent = request.amount * price
  } else {
    grainNeeded = request.amount / price
    usdEquivalent = request.amount
  }

  // Calculate fee (1% in GRAIN)
  const feePercent = 0.01
  const feeInGrain = grainNeeded * feePercent
  const totalGrainNeeded = grainNeeded + feeInGrain

  // Strategy 1: Pay entirely from GRAIN balance
  if (profile.grainBalance >= totalGrainNeeded) {
    return {
      rail: 'grain',
      method: 'balance',
      grainAmount: totalGrainNeeded,
      usdAmount: usdEquivalent,
      fee: feeInGrain,
      creditDraw: 0,
      conversionNeeded: false,
      canExecute: true,
    }
  }

  // Strategy 2: Pay from GRAIN balance + credit line
  if (request.allowCreditLine !== false && profile.canUseCreditLine) {
    const fromBalance = profile.grainBalance
    const fromCredit = totalGrainNeeded - fromBalance

    if (fromCredit <= profile.creditAvailable) {
      return {
        rail: 'grain',
        method: 'credit_line',
        grainAmount: totalGrainNeeded,
        usdAmount: usdEquivalent,
        fee: feeInGrain,
        creditDraw: fromCredit,
        conversionNeeded: false,
        canExecute: true,
      }
    }
  }

  // Strategy 3: Pay from USDC balance (convert to GRAIN)
  if (request.allowConversion !== false && profile.usdcBalance >= usdEquivalent * 1.01) {
    return {
      rail: 'grain',
      method: 'conversion',
      grainAmount: totalGrainNeeded,
      usdAmount: usdEquivalent * 1.01, // Include conversion buffer
      fee: feeInGrain,
      creditDraw: 0,
      conversionNeeded: true,
      canExecute: true,
    }
  }

  // Strategy 4: Fallback to USDC rail (no conversion)
  if (profile.usdcBalance >= usdEquivalent * 1.01) {
    return {
      rail: 'usdc',
      method: 'balance',
      grainAmount: 0,
      usdAmount: usdEquivalent * 1.01, // 1% fee in USDC
      fee: usdEquivalent * 0.01,
      creditDraw: 0,
      conversionNeeded: false,
      canExecute: true,
    }
  }

  // Cannot execute - insufficient funds
  return {
    rail: 'grain',
    method: 'deposit',
    grainAmount: totalGrainNeeded,
    usdAmount: usdEquivalent,
    fee: feeInGrain,
    creditDraw: 0,
    conversionNeeded: true,
    canExecute: false,
    reason: `Insufficient funds. Need ${totalGrainNeeded.toFixed(2)} GRAIN or $${usdEquivalent.toFixed(2)} USD. Available: ${profile.grainBalance.toFixed(2)} GRAIN, $${profile.usdcBalance.toFixed(2)} USDC`,
  }
}

// ============================================================================
// PAYMENT EXECUTION
// ============================================================================

/**
 * Execute a payment through the GRAIN rail
 */
export async function executePayment(request: PaymentRequest): Promise<PaymentResult> {
  if (!sql) {
    return {
      success: false,
      transactionId: '',
      rail: 'grain',
      method: 'balance',
      inputAmount: request.amount,
      inputCurrency: request.currency,
      executedAmount: 0,
      executedCurrency: 'GRAIN',
      feeAmount: 0,
      feeCurrency: 'GRAIN',
      recipientReceives: 0,
      recipientCurrency: 'GRAIN',
      error: 'Database not configured',
    }
  }

  const transactionId = crypto.randomUUID()

  try {
    // Route the payment
    const route = await routePayment(request)

    if (!route.canExecute) {
      return {
        success: false,
        transactionId,
        rail: route.rail,
        method: route.method,
        inputAmount: request.amount,
        inputCurrency: request.currency,
        executedAmount: 0,
        executedCurrency: 'GRAIN',
        feeAmount: 0,
        feeCurrency: 'GRAIN',
        recipientReceives: 0,
        recipientCurrency: 'GRAIN',
        error: route.reason,
        failureReason: 'insufficient_funds',
      }
    }

    const { price } = await getGrainPrice()

    // Begin transaction
    // Deduct from sender
    if (route.rail === 'grain') {
      // Deduct GRAIN from sender's wallet
      const grainToDeduct = route.grainAmount - route.creditDraw

      if (grainToDeduct > 0) {
        await sql`
          UPDATE user_wallets
          SET balance = balance - ${grainToDeduct}, updated_at = NOW()
          WHERE user_id = ${request.fromUserId}
        `
      }

      // Draw from credit line if needed
      if (route.creditDraw > 0) {
        await sql`
          UPDATE grain_credit_lines
          SET
            current_balance = current_balance + ${route.creditDraw},
            updated_at = NOW()
          WHERE user_id = ${request.fromUserId} AND status = 'active'
        `

        // Record credit draw
        await sql`
          INSERT INTO unified_transactions (
            id, user_id, type, amount, currency, rail, method,
            fee_amount, reference, memo, status, created_at
          ) VALUES (
            ${crypto.randomUUID()}, ${request.fromUserId}, 'credit_draw',
            ${route.creditDraw}, 'GRAIN', 'grain', 'credit_line',
            0, ${request.reference}, 'Credit line draw for payment',
            'completed', NOW()
          )
        `
      }

      // Credit to recipient (minus fee)
      const recipientAmount = route.grainAmount - route.fee

      if (request.toUserId) {
        // Ensure recipient has a wallet
        await sql`
          INSERT INTO user_wallets (user_id, balance, created_at, updated_at)
          VALUES (${request.toUserId}, 0, NOW(), NOW())
          ON CONFLICT (user_id) DO NOTHING
        `

        await sql`
          UPDATE user_wallets
          SET balance = balance + ${recipientAmount}, updated_at = NOW()
          WHERE user_id = ${request.toUserId}
        `
      }

      // Fee goes to treasury
      await sql`
        INSERT INTO grain_asset_holdings (
          id, asset_type, symbol, quantity, current_value, source,
          is_active, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()}, 'fee_income', 'GRAIN', ${route.fee},
          ${route.fee * price}, 'transaction_fee', true, NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
      `

    } else {
      // USDC rail - deduct from USDC balance
      await sql`
        UPDATE user_balances
        SET usdc_balance = usdc_balance - ${route.usdAmount}, updated_at = NOW()
        WHERE user_id = ${request.fromUserId}
      `

      // Credit USDC to recipient (minus fee)
      const recipientAmount = route.usdAmount - route.fee

      if (request.toUserId) {
        await sql`
          INSERT INTO user_balances (user_id, usdc_balance, created_at, updated_at)
          VALUES (${request.toUserId}, 0, NOW(), NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            usdc_balance = user_balances.usdc_balance + ${recipientAmount},
            updated_at = NOW()
        `
      }
    }

    // Record in unified transaction ledger
    await sql`
      INSERT INTO unified_transactions (
        id, user_id, counterparty_id, type, amount, currency,
        rail, method, fee_amount, reference, memo, status,
        grain_price_at_execution, created_at
      ) VALUES (
        ${transactionId}, ${request.fromUserId}, ${request.toUserId},
        ${request.type}, ${route.grainAmount || route.usdAmount},
        ${route.rail === 'grain' ? 'GRAIN' : 'USDC'}, ${route.rail},
        ${route.method}, ${route.fee}, ${request.reference},
        ${request.memo}, 'completed', ${price}, NOW()
      )
    `

    const recipientReceives = route.rail === 'grain'
      ? route.grainAmount - route.fee
      : route.usdAmount - route.fee

    return {
      success: true,
      transactionId,
      rail: route.rail,
      method: route.method,
      inputAmount: request.amount,
      inputCurrency: request.currency,
      executedAmount: route.grainAmount || route.usdAmount,
      executedCurrency: route.rail === 'grain' ? 'GRAIN' : 'USDC',
      feeAmount: route.fee,
      feeCurrency: route.rail === 'grain' ? 'GRAIN' : 'USDC',
      recipientReceives,
      recipientCurrency: route.rail === 'grain' ? 'GRAIN' : 'USDC',
      creditLineUsed: route.creditDraw > 0 ? route.creditDraw : undefined,
      conversionRate: route.conversionNeeded ? price : undefined,
    }
  } catch (error: any) {
    console.error('[GRAIN Rail] Payment execution error:', error)

    // Record failed transaction
    await sql`
      INSERT INTO unified_transactions (
        id, user_id, type, amount, currency, rail, method,
        reference, memo, status, error_message, created_at
      ) VALUES (
        ${transactionId}, ${request.fromUserId}, ${request.type},
        ${request.amount}, ${request.currency}, 'grain', 'balance',
        ${request.reference}, ${request.memo}, 'failed',
        ${error.message}, NOW()
      )
    `.catch(() => {})

    return {
      success: false,
      transactionId,
      rail: 'grain',
      method: 'balance',
      inputAmount: request.amount,
      inputCurrency: request.currency,
      executedAmount: 0,
      executedCurrency: 'GRAIN',
      feeAmount: 0,
      feeCurrency: 'GRAIN',
      recipientReceives: 0,
      recipientCurrency: 'GRAIN',
      error: error.message,
      failureReason: 'execution_error',
    }
  }
}

// ============================================================================
// ESCROW OPERATIONS
// ============================================================================

export interface EscrowRequest {
  fromUserId: string
  toUserId: string
  amount: number
  currency: 'USD' | 'GRAIN'
  releaseConditions: string // Description of conditions
  releaseDate?: Date
  reference: string // Deal ID, RFQ ID, etc.
  allowPartialRelease?: boolean
}

export interface EscrowResult {
  success: boolean
  escrowId: string
  grainAmount: number
  grainPriceAtLock: number
  estimatedValueAtRelease?: number
  error?: string
}

/**
 * Create a GRAIN escrow for a deal
 * The escrow appreciates with GRAIN price during the lock period
 */
export async function createEscrow(request: EscrowRequest): Promise<EscrowResult> {
  if (!sql) {
    return { success: false, escrowId: '', grainAmount: 0, grainPriceAtLock: 1.0, error: 'Database not configured' }
  }

  const escrowId = crypto.randomUUID()
  const { price } = await getGrainPrice()

  // Convert to GRAIN if needed
  let grainAmount: number
  if (request.currency === 'GRAIN') {
    grainAmount = request.amount
  } else {
    grainAmount = request.amount / price
  }

  // Execute payment to escrow
  const paymentResult = await executePayment({
    fromUserId: request.fromUserId,
    amount: grainAmount,
    currency: 'GRAIN',
    type: 'escrow_fund',
    reference: request.reference,
    memo: `Escrow for ${request.reference}`,
    allowCreditLine: true,
  })

  if (!paymentResult.success) {
    return {
      success: false,
      escrowId,
      grainAmount: 0,
      grainPriceAtLock: price,
      error: paymentResult.error,
    }
  }

  // Create escrow record
  await sql`
    INSERT INTO grain_escrows (
      id, from_user_id, to_user_id, grain_amount, grain_price_at_lock,
      usd_equivalent_at_lock, release_conditions, release_date,
      reference, allow_partial_release, status, created_at
    ) VALUES (
      ${escrowId}, ${request.fromUserId}, ${request.toUserId},
      ${grainAmount}, ${price}, ${grainAmount * price},
      ${request.releaseConditions}, ${request.releaseDate},
      ${request.reference}, ${request.allowPartialRelease || false},
      'locked', NOW()
    )
  `

  return {
    success: true,
    escrowId,
    grainAmount,
    grainPriceAtLock: price,
    estimatedValueAtRelease: grainAmount * price, // Will appreciate
  }
}

/**
 * Release escrow to recipient
 */
export async function releaseEscrow(
  escrowId: string,
  releasedBy: string,
  partialAmount?: number
): Promise<{ success: boolean; releasedAmount: number; currentValue: number; error?: string }> {
  if (!sql) {
    return { success: false, releasedAmount: 0, currentValue: 0, error: 'Database not configured' }
  }

  // Get escrow details
  const [escrow] = await sql`
    SELECT * FROM grain_escrows WHERE id = ${escrowId}
  `

  if (!escrow) {
    return { success: false, releasedAmount: 0, currentValue: 0, error: 'Escrow not found' }
  }

  if (escrow.status !== 'locked') {
    return { success: false, releasedAmount: 0, currentValue: 0, error: `Escrow is ${escrow.status}` }
  }

  const { price } = await getGrainPrice()
  const releaseAmount = partialAmount || parseFloat(escrow.grain_amount)

  // Transfer to recipient
  await sql`
    INSERT INTO user_wallets (user_id, balance, created_at, updated_at)
    VALUES (${escrow.to_user_id}, 0, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING
  `

  await sql`
    UPDATE user_wallets
    SET balance = balance + ${releaseAmount}, updated_at = NOW()
    WHERE user_id = ${escrow.to_user_id}
  `

  // Update escrow status
  const newStatus = releaseAmount >= parseFloat(escrow.grain_amount) ? 'released' : 'partial'

  await sql`
    UPDATE grain_escrows
    SET
      status = ${newStatus},
      released_amount = COALESCE(released_amount, 0) + ${releaseAmount},
      released_at = NOW(),
      released_by = ${releasedBy},
      grain_price_at_release = ${price}
    WHERE id = ${escrowId}
  `

  // Record transaction
  await sql`
    INSERT INTO unified_transactions (
      id, user_id, counterparty_id, type, amount, currency,
      rail, method, reference, status, grain_price_at_execution, created_at
    ) VALUES (
      ${crypto.randomUUID()}, ${escrow.from_user_id}, ${escrow.to_user_id},
      'escrow_release', ${releaseAmount}, 'GRAIN', 'grain', 'escrow',
      ${escrow.reference}, 'completed', ${price}, NOW()
    )
  `

  const appreciation = price - parseFloat(escrow.grain_price_at_lock)
  const appreciationPercent = (appreciation / parseFloat(escrow.grain_price_at_lock)) * 100

  console.log(`[Escrow Release] ${escrowId}: ${releaseAmount} GRAIN, appreciated ${appreciationPercent.toFixed(2)}%`)

  return {
    success: true,
    releasedAmount: releaseAmount,
    currentValue: releaseAmount * price,
  }
}

// ============================================================================
// PAYROLL - GRAIN Salary Payments
// ============================================================================

export interface PayrollEntry {
  employeeUserId: string
  amount: number
  currency: 'USD' | 'GRAIN'
  payPeriodStart: Date
  payPeriodEnd: Date
  jobId?: string
  description?: string
}

export interface PayrollResult {
  success: boolean
  batchId: string
  totalGrain: number
  totalUsd: number
  successCount: number
  failedCount: number
  failures: Array<{ userId: string; error: string }>
}

/**
 * Execute batch payroll in GRAIN
 * Workers receive appreciating GRAIN instead of stable USD
 */
export async function executePayroll(
  companyUserId: string,
  entries: PayrollEntry[]
): Promise<PayrollResult> {
  const batchId = crypto.randomUUID()
  const { price } = await getGrainPrice()

  let totalGrain = 0
  let totalUsd = 0
  let successCount = 0
  const failures: Array<{ userId: string; error: string }> = []

  for (const entry of entries) {
    const grainAmount = entry.currency === 'GRAIN'
      ? entry.amount
      : entry.amount / price

    const result = await executePayment({
      fromUserId: companyUserId,
      toUserId: entry.employeeUserId,
      amount: grainAmount,
      currency: 'GRAIN',
      type: 'payroll',
      reference: entry.jobId || batchId,
      memo: entry.description || `Payroll ${entry.payPeriodStart.toISOString().split('T')[0]} - ${entry.payPeriodEnd.toISOString().split('T')[0]}`,
      allowCreditLine: true,
    })

    if (result.success) {
      totalGrain += grainAmount
      totalUsd += grainAmount * price
      successCount++
    } else {
      failures.push({ userId: entry.employeeUserId, error: result.error || 'Unknown error' })
    }
  }

  // Record batch
  if (sql) {
    await sql`
      INSERT INTO payroll_batches (
        id, company_user_id, total_grain, total_usd, grain_price,
        entry_count, success_count, failed_count, created_at
      ) VALUES (
        ${batchId}, ${companyUserId}, ${totalGrain}, ${totalUsd}, ${price},
        ${entries.length}, ${successCount}, ${failures.length}, NOW()
      )
    `
  }

  return {
    success: failures.length === 0,
    batchId,
    totalGrain,
    totalUsd,
    successCount,
    failedCount: failures.length,
    failures,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const grainRail = {
  // Oracle
  getPrice: getGrainPrice,
  convert: convertAmount,

  // Profile
  getProfile: getUserPaymentProfile,

  // Routing
  route: routePayment,

  // Execution
  pay: executePayment,

  // Escrow
  escrow: createEscrow,
  releaseEscrow,

  // Payroll
  payroll: executePayroll,
}
