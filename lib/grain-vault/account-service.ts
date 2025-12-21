/**
 * Grain & Vault - Account Service
 *
 * Unified service for account opening, deposits, and withdrawals.
 * Uses custodial model: all funds held in Wells master wallet,
 * users have ledger balances in database.
 *
 * Flow:
 * 1. User signs up via Clerk
 * 2. User completes onboarding (basic info + terms)
 * 3. Ledger entry created (no Circle wallet per user)
 * 4. User deposits via Circle on-ramp → funds go to master wallet
 * 5. User's ledger balance credited
 * 6. User can buy/sell GRAIN, withdraw to bank
 */

import { sql } from '@vercel/postgres'
import { createPaymentIntent } from '@/lib/circle'

// =============================================================================
// CONFIGURATION
// =============================================================================

const WELLS_MASTER_WALLET_ADDRESS = process.env.WELLS_MASTER_WALLET_ADDRESS || ''
const GRAIN_PRICE = 1.0 // 1:1 with USD for now

// Fee structure
const DEPOSIT_FEE_PERCENT = 0 // No deposit fees
const WITHDRAWAL_FEE_PERCENT = 0.25 // 0.25% withdrawal fee
const GRAIN_SELL_FEE_PERCENT = 0.1 // 0.1% when selling GRAIN

// =============================================================================
// TYPES
// =============================================================================

export interface Account {
  userId: string
  email: string
  fullName: string
  walletId: string
  grainBalance: number
  usdBalance: number
  verificationLevel: 1 | 2 | 3 | 4
  tier: 'basic' | 'standard' | 'premium' | 'unlimited'
  dailyDepositLimit: number
  dailyWithdrawLimit: number
  status: 'active' | 'pending' | 'suspended'
  createdAt: string
}

export interface Transaction {
  id: string
  type: 'deposit' | 'withdraw' | 'buy_grain' | 'sell_grain' | 'transfer' | 'fee'
  amount: number
  grainAmount?: number
  grainPrice?: number
  fee?: number
  status: 'pending' | 'completed' | 'failed'
  description: string
  circleReference?: string
  createdAt: string
  completedAt?: string
}

export interface DepositSession {
  sessionId: string
  checkoutUrl: string
  amount: number
  expiresAt: string
}

// =============================================================================
// ACCOUNT OPERATIONS
// =============================================================================

/**
 * Get or create account for a user
 */
export async function getOrCreateAccount(
  userId: string,
  email: string,
  fullName?: string
): Promise<Account> {
  // Check if account exists
  const existingResult = await sql`
    SELECT
      gup.user_id,
      gup.email,
      gup.full_name,
      gup.verification_level,
      gup.desired_tier,
      gup.daily_deposit_limit,
      gup.daily_withdraw_limit,
      gup.status,
      gup.created_at,
      uw.wallet_id,
      uw.balance as grain_balance
    FROM grain_user_profiles gup
    LEFT JOIN user_wallets uw ON uw.user_id = gup.user_id
    WHERE gup.user_id = ${userId}
  `

  if (existingResult.rows.length > 0) {
    const row = existingResult.rows[0]
    return {
      userId: row.user_id,
      email: row.email || email,
      fullName: row.full_name || '',
      walletId: row.wallet_id || '',
      grainBalance: parseFloat(row.grain_balance || '0'),
      usdBalance: parseFloat(row.grain_balance || '0') * GRAIN_PRICE,
      verificationLevel: row.verification_level || 1,
      tier: row.desired_tier || 'basic',
      dailyDepositLimit: parseFloat(row.daily_deposit_limit || '1000'),
      dailyWithdrawLimit: parseFloat(row.daily_withdraw_limit || '1000'),
      status: row.status || 'active',
      createdAt: row.created_at,
    }
  }

  // Create new account
  const walletId = `grain-${userId.substring(0, 8)}-${Date.now().toString(36)}`

  // Create profile
  await sql`
    INSERT INTO grain_user_profiles (
      user_id,
      clerk_user_id,
      email,
      full_name,
      verification_level,
      verification_status,
      desired_tier,
      daily_deposit_limit,
      daily_withdraw_limit,
      status,
      created_at
    ) VALUES (
      ${userId},
      ${userId},
      ${email},
      ${fullName || 'User'},
      1,
      'approved',
      'basic',
      1000,
      1000,
      'active',
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING
  `

  // Create wallet ledger entry
  await sql`
    INSERT INTO user_wallets (
      user_id,
      wallet_id,
      wallet_address,
      balance,
      created_at,
      updated_at
    ) VALUES (
      ${userId},
      ${walletId},
      ${WELLS_MASTER_WALLET_ADDRESS || 'pending'},
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING
  `

  return {
    userId,
    email,
    fullName: fullName || 'User',
    walletId,
    grainBalance: 0,
    usdBalance: 0,
    verificationLevel: 1,
    tier: 'basic',
    dailyDepositLimit: 1000,
    dailyWithdrawLimit: 1000,
    status: 'active',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Get account by user ID
 */
export async function getAccount(userId: string): Promise<Account | null> {
  const result = await sql`
    SELECT
      gup.user_id,
      gup.email,
      gup.full_name,
      gup.verification_level,
      gup.desired_tier,
      gup.daily_deposit_limit,
      gup.daily_withdraw_limit,
      gup.status,
      gup.created_at,
      uw.wallet_id,
      uw.balance as grain_balance
    FROM grain_user_profiles gup
    LEFT JOIN user_wallets uw ON uw.user_id = gup.user_id
    WHERE gup.user_id = ${userId}
  `

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    userId: row.user_id,
    email: row.email || '',
    fullName: row.full_name || '',
    walletId: row.wallet_id || '',
    grainBalance: parseFloat(row.grain_balance || '0'),
    usdBalance: parseFloat(row.grain_balance || '0') * GRAIN_PRICE,
    verificationLevel: row.verification_level || 1,
    tier: row.desired_tier || 'basic',
    dailyDepositLimit: parseFloat(row.daily_deposit_limit || '1000'),
    dailyWithdrawLimit: parseFloat(row.daily_withdraw_limit || '1000'),
    status: row.status || 'active',
    createdAt: row.created_at,
  }
}

/**
 * Get account balance
 */
export async function getBalance(userId: string): Promise<{
  grain: number
  usd: number
  grainPrice: number
}> {
  const result = await sql`
    SELECT balance FROM user_wallets WHERE user_id = ${userId}
  `

  if (result.rows.length === 0) {
    return { grain: 0, usd: 0, grainPrice: GRAIN_PRICE }
  }

  const grain = parseFloat(result.rows[0].balance || '0')
  return {
    grain,
    usd: grain * GRAIN_PRICE,
    grainPrice: GRAIN_PRICE,
  }
}

// =============================================================================
// DEPOSIT OPERATIONS
// =============================================================================

/**
 * Create a deposit session using Circle on-ramp
 */
export async function createDeposit(
  userId: string,
  amount: number
): Promise<DepositSession> {
  // Validate amount
  if (amount < 10) {
    throw new Error('Minimum deposit is $10')
  }
  if (amount > 10000) {
    throw new Error('Maximum single deposit is $10,000')
  }

  // Check daily limit
  const account = await getAccount(userId)
  if (!account) {
    throw new Error('Account not found')
  }

  const todayDeposits = await getTodayDeposits(userId)
  if (todayDeposits + amount > account.dailyDepositLimit) {
    throw new Error(`This deposit would exceed your daily limit of $${account.dailyDepositLimit}`)
  }

  // Create session ID
  const sessionId = `dep_${userId.substring(0, 8)}_${Date.now().toString(36)}`

  // Record pending deposit
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
      'Card deposit via Circle',
      ${sessionId},
      'pending',
      NOW()
    )
  `

  // Create Circle payment intent for checkout
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://grainandvault.com'

  try {
    const paymentIntent = await createPaymentIntent({
      amount,
      currency: 'USD',
      userId,
      metadata: {
        sessionId,
        userId,
        type: 'deposit',
      },
      successUrl: `${baseUrl}/grain-vault/deposit/success?session=${sessionId}`,
      cancelUrl: `${baseUrl}/grain-vault/deposit/cancel?session=${sessionId}`,
    })

    return {
      sessionId,
      checkoutUrl: paymentIntent.checkoutUrl,
      amount,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    }
  } catch (error: any) {
    // If Circle fails, create a demo URL for testing
    console.error('Circle payment intent failed:', error.message)

    return {
      sessionId,
      checkoutUrl: `${baseUrl}/grain-vault/deposit/demo?session=${sessionId}&amount=${amount}`,
      amount,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }
  }
}

/**
 * Complete a deposit (called by webhook or demo flow)
 */
export async function completeDeposit(
  sessionId: string,
  circleReference?: string
): Promise<{ grainAmount: number }> {
  // Get the pending transaction
  const txResult = await sql`
    SELECT * FROM grain_transactions
    WHERE circle_transfer_id = ${sessionId} AND status = 'pending'
  `

  if (txResult.rows.length === 0) {
    throw new Error('Deposit session not found or already completed')
  }

  const tx = txResult.rows[0]
  const amount = parseFloat(tx.amount)
  const grainAmount = amount / GRAIN_PRICE

  // Update transaction
  await sql`
    UPDATE grain_transactions
    SET
      status = 'completed',
      circle_transfer_id = ${circleReference || sessionId},
      completed_at = NOW()
    WHERE circle_transfer_id = ${sessionId}
  `

  // Credit user balance
  await sql`
    UPDATE user_wallets
    SET
      balance = balance + ${grainAmount},
      updated_at = NOW()
    WHERE user_id = ${tx.user_id}
  `

  // Record treasury backing
  try {
    await sql`
      INSERT INTO treasury_backing (
        asset_type,
        asset_name,
        amount,
        source,
        circle_reference_id,
        status
      ) VALUES (
        'stablecoin',
        'USDC from card deposit',
        ${amount},
        'card',
        ${circleReference || sessionId},
        'active'
      )
    `
  } catch (e) {
    // Non-critical
  }

  return { grainAmount }
}

/**
 * Get today's total deposits for a user
 */
async function getTodayDeposits(userId: string): Promise<number> {
  const result = await sql`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM grain_transactions
    WHERE user_id = ${userId}
      AND type = 'deposit'
      AND status = 'completed'
      AND created_at >= CURRENT_DATE
  `
  return parseFloat(result.rows[0]?.total || '0')
}

// =============================================================================
// WITHDRAWAL OPERATIONS
// =============================================================================

/**
 * Request a withdrawal to bank account
 */
export async function createWithdrawal(
  userId: string,
  amount: number,
  bankAccountId: string
): Promise<{ transactionId: string; fee: number; netAmount: number }> {
  // Validate amount
  if (amount < 25) {
    throw new Error('Minimum withdrawal is $25')
  }

  // Check balance
  const balance = await getBalance(userId)
  if (balance.usd < amount) {
    throw new Error(`Insufficient balance. Available: $${balance.usd.toFixed(2)}`)
  }

  // Calculate fee
  const fee = Math.round(amount * WITHDRAWAL_FEE_PERCENT) / 100
  const netAmount = amount - fee
  const grainAmount = amount / GRAIN_PRICE

  const transactionId = `wth_${userId.substring(0, 8)}_${Date.now().toString(36)}`

  // Debit balance immediately
  await sql`
    UPDATE user_wallets
    SET
      balance = balance - ${grainAmount},
      updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Record transaction
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
      'withdraw',
      ${amount},
      ${`Withdrawal to bank (fee: $${fee.toFixed(2)})`},
      ${transactionId},
      'pending',
      NOW()
    )
  `

  // TODO: Initiate Circle payout to bank
  // For now, mark as processing - webhook will complete it

  return {
    transactionId,
    fee,
    netAmount,
  }
}

// =============================================================================
// GRAIN OPERATIONS
// =============================================================================

/**
 * Buy GRAIN with USD balance (instant, no fee)
 */
export async function buyGrain(
  userId: string,
  usdAmount: number
): Promise<{ grainAmount: number; price: number }> {
  const balance = await getBalance(userId)

  if (balance.usd < usdAmount) {
    throw new Error(`Insufficient USD balance. Available: $${balance.usd.toFixed(2)}`)
  }

  // With 1:1 peg, buying GRAIN is essentially a no-op
  // But we record it for transparency
  const grainAmount = usdAmount / GRAIN_PRICE

  await sql`
    INSERT INTO grain_transactions (
      user_id,
      type,
      amount,
      reason,
      status,
      created_at,
      completed_at
    ) VALUES (
      ${userId},
      'buy_grain',
      ${grainAmount},
      ${`Bought ${grainAmount.toFixed(2)} GRAIN @ $${GRAIN_PRICE.toFixed(4)}`},
      'completed',
      NOW(),
      NOW()
    )
  `

  return {
    grainAmount,
    price: GRAIN_PRICE,
  }
}

/**
 * Sell GRAIN for USD (small fee applies)
 */
export async function sellGrain(
  userId: string,
  grainAmount: number
): Promise<{ usdAmount: number; fee: number; netAmount: number }> {
  const balance = await getBalance(userId)

  if (balance.grain < grainAmount) {
    throw new Error(`Insufficient GRAIN balance. Available: ${balance.grain.toFixed(2)}`)
  }

  const usdAmount = grainAmount * GRAIN_PRICE
  const fee = Math.round(usdAmount * GRAIN_SELL_FEE_PERCENT) / 100
  const netAmount = usdAmount - fee

  await sql`
    INSERT INTO grain_transactions (
      user_id,
      type,
      amount,
      reason,
      status,
      created_at,
      completed_at
    ) VALUES (
      ${userId},
      'sell_grain',
      ${grainAmount},
      ${`Sold ${grainAmount.toFixed(2)} GRAIN @ $${GRAIN_PRICE.toFixed(4)} (fee: $${fee.toFixed(2)})`},
      'completed',
      NOW(),
      NOW()
    )
  `

  return {
    usdAmount,
    fee,
    netAmount,
  }
}

// =============================================================================
// TRANSACTION HISTORY
// =============================================================================

/**
 * Get transaction history for a user
 */
export async function getTransactions(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Transaction[]> {
  const result = await sql`
    SELECT
      id,
      type,
      amount,
      reason,
      circle_transfer_id,
      status,
      created_at,
      completed_at
    FROM grain_transactions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return result.rows.map(row => ({
    id: row.id,
    type: row.type,
    amount: parseFloat(row.amount),
    status: row.status,
    description: row.reason || '',
    circleReference: row.circle_transfer_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }))
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  getOrCreateAccount,
  getAccount,
  getBalance,
  createDeposit,
  completeDeposit,
  createWithdrawal,
  buyGrain,
  sellGrain,
  getTransactions,
}
