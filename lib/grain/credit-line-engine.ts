/**
 * GRAIN Credit Line Engine
 *
 * Core logic for the three-layer credit line model:
 * 1. Protected Deposit (Cash Layer) - Always withdrawable
 * 2. Credit Line (Spending Layer) - 0% interest, 0% fees
 * 3. Appreciation (Growth Layer) - Real liquidity backing
 *
 * GRAIN Value = Liquid Backing:
 * - 1:1 Cash deposits (protected)
 * - 30% of WellsAI 1% fees → liquidity
 * - 30% of float yield → treasury equity
 *
 * The increased value IS liquid and fully protected.
 */

import { query } from '@/lib/db'

// ============================================================================
// TYPES
// ============================================================================

export interface CreditLinePosition {
  id: string
  userId: string

  // Protected Deposit (Cash Layer)
  protectedDeposit: number
  depositGrainPrice: number

  // Credit Line (Spending Layer)
  creditLineLimit: number
  creditLineUsed: number
  creditLineAvailable: number

  // Appreciation (Growth Layer)
  appreciationGrain: number

  // Status
  status: 'active' | 'credit_used' | 'frozen'

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface CreditLineTransaction {
  id: string
  userId: string
  positionId: string
  type:
    | 'deposit'
    | 'credit_spend'
    | 'credit_repay'
    | 'withdraw'
    | 'appreciation_grant'
    | 'appreciation_spend'
  usdAmount: number | null
  grainAmount: number | null
  grainPrice: number
  protectedDepositAfter: number
  creditLineUsedAfter: number
  appreciationAfter: number
  counterpartyId: string | null
  description: string | null
  createdAt: Date
}

export interface DepositResult {
  success: boolean
  position: CreditLinePosition
  transaction: CreditLineTransaction
  message: string
}

export interface SpendResult {
  success: boolean
  position: CreditLinePosition
  transaction: CreditLineTransaction
  grainSpent: number
  fromCreditLine: number
  fromAppreciation: number
  message: string
}

export interface WithdrawResult {
  success: boolean
  position: CreditLinePosition
  transaction: CreditLineTransaction
  usdWithdrawn: number
  creditLineRepaid: number
  message: string
}

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Get or create a credit line position for a user
 */
export async function getOrCreatePosition(
  userId: string
): Promise<CreditLinePosition> {
  // Try to get existing position
  const existing = await query(
    `SELECT * FROM credit_line_positions WHERE user_id = $1`,
    [userId]
  )

  if (existing.rows.length > 0) {
    return mapRowToPosition(existing.rows[0])
  }

  // Create new position
  const result = await query(
    `INSERT INTO credit_line_positions (user_id, deposit_grain_price)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, 1.0] // Default price, will be updated on first deposit
  )

  return mapRowToPosition(result.rows[0])
}

/**
 * Get current GRAIN price from treasury
 * GRAIN Price = Total Liquid Value / GRAIN Supply
 */
export async function getCurrentGrainPrice(): Promise<number> {
  const result = await query(
    `SELECT calc_grain_price FROM vault_treasury LIMIT 1`
  )

  if (result.rows.length === 0) {
    return 1.0 // Default price before treasury is initialized
  }

  return parseFloat(result.rows[0].calc_grain_price) || 1.0
}

/**
 * Deposit USD and create credit line
 *
 * Flow:
 * 1. USD goes to protected deposit (1:1 protected)
 * 2. Credit line created at current GRAIN price
 * 3. Credit line limit = deposit / grain price
 */
export async function deposit(
  userId: string,
  usdAmount: number
): Promise<DepositResult> {
  if (usdAmount <= 0) {
    throw new Error('Deposit amount must be positive')
  }

  const grainPrice = await getCurrentGrainPrice()
  const grainCreditLimit = usdAmount / grainPrice

  // Get or create position
  let position = await getOrCreatePosition(userId)

  // Calculate new values
  const newProtectedDeposit = position.protectedDeposit + usdAmount
  const newCreditLineLimit = position.creditLineLimit + grainCreditLimit

  // Update position
  const updateResult = await query(
    `UPDATE credit_line_positions
     SET protected_deposit = $1,
         deposit_grain_price = $2,
         credit_line_limit = $3,
         status = 'active'
     WHERE user_id = $4
     RETURNING *`,
    [newProtectedDeposit, grainPrice, newCreditLineLimit, userId]
  )

  position = mapRowToPosition(updateResult.rows[0])

  // Record transaction
  const txResult = await query(
    `INSERT INTO credit_line_transactions
     (user_id, position_id, type, usd_amount, grain_amount, grain_price,
      protected_deposit_after, credit_line_used_after, appreciation_after,
      description)
     VALUES ($1, $2, 'deposit', $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      position.id,
      usdAmount,
      grainCreditLimit,
      grainPrice,
      position.protectedDeposit,
      position.creditLineUsed,
      position.appreciationGrain,
      `Deposit of $${usdAmount.toLocaleString()} at $${grainPrice.toFixed(4)}/GRAIN`,
    ]
  )

  // Update treasury liquidity
  await updateTreasuryLiquidity(usdAmount, 'add')

  return {
    success: true,
    position,
    transaction: mapRowToTransaction(txResult.rows[0]),
    message: `Deposited $${usdAmount.toLocaleString()}. Credit line: ${grainCreditLimit.toLocaleString()} GRAIN`,
  }
}

/**
 * Spend GRAIN from credit line
 *
 * Flow:
 * 1. First spend from appreciation (bonus GRAIN)
 * 2. Then spend from credit line
 * 3. Credit line used increases, protected deposit unchanged
 */
export async function spend(
  userId: string,
  grainAmount: number,
  counterpartyId?: string,
  description?: string
): Promise<SpendResult> {
  if (grainAmount <= 0) {
    throw new Error('Spend amount must be positive')
  }

  const position = await getOrCreatePosition(userId)
  const grainPrice = await getCurrentGrainPrice()

  // Calculate available GRAIN
  const availableFromAppreciation = position.appreciationGrain
  const availableFromCreditLine =
    position.creditLineLimit - position.creditLineUsed
  const totalAvailable = availableFromAppreciation + availableFromCreditLine

  if (grainAmount > totalAvailable) {
    throw new Error(
      `Insufficient GRAIN. Available: ${totalAvailable.toLocaleString()}, Requested: ${grainAmount.toLocaleString()}`
    )
  }

  // Spend from appreciation first, then credit line
  let fromAppreciation = 0
  let fromCreditLine = 0
  let remaining = grainAmount

  if (remaining > 0 && availableFromAppreciation > 0) {
    fromAppreciation = Math.min(remaining, availableFromAppreciation)
    remaining -= fromAppreciation
  }

  if (remaining > 0) {
    fromCreditLine = remaining
  }

  // Calculate new values
  const newAppreciation = position.appreciationGrain - fromAppreciation
  const newCreditLineUsed = position.creditLineUsed + fromCreditLine

  // Determine status
  const newStatus = newCreditLineUsed > 0 ? 'credit_used' : 'active'

  // Update position
  const updateResult = await query(
    `UPDATE credit_line_positions
     SET appreciation_grain = $1,
         credit_line_used = $2,
         status = $3
     WHERE user_id = $4
     RETURNING *`,
    [newAppreciation, newCreditLineUsed, newStatus, userId]
  )

  const updatedPosition = mapRowToPosition(updateResult.rows[0])

  // Record transaction
  const txResult = await query(
    `INSERT INTO credit_line_transactions
     (user_id, position_id, type, grain_amount, grain_price,
      protected_deposit_after, credit_line_used_after, appreciation_after,
      counterparty_id, description)
     VALUES ($1, $2, 'credit_spend', $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      position.id,
      grainAmount,
      grainPrice,
      updatedPosition.protectedDeposit,
      updatedPosition.creditLineUsed,
      updatedPosition.appreciationGrain,
      counterpartyId,
      description || `Spent ${grainAmount.toLocaleString()} GRAIN`,
    ]
  )

  // Calculate fee and allocate
  const usdValue = grainAmount * grainPrice
  const fee = usdValue * 0.01 // 1% WellsAI fee
  if (fee > 0) {
    await allocateWellsAIFee(fee, txResult.rows[0].id, grainPrice)
  }

  return {
    success: true,
    position: updatedPosition,
    transaction: mapRowToTransaction(txResult.rows[0]),
    grainSpent: grainAmount,
    fromCreditLine,
    fromAppreciation,
    message: `Spent ${grainAmount.toLocaleString()} GRAIN (${fromAppreciation.toLocaleString()} from appreciation, ${fromCreditLine.toLocaleString()} from credit line)`,
  }
}

/**
 * Repay credit line usage
 *
 * Can repay with:
 * - Appreciation GRAIN (if available)
 * - USD (converted at current price)
 */
export async function repayCredit(
  userId: string,
  grainAmount?: number,
  usdAmount?: number
): Promise<{ success: boolean; position: CreditLinePosition; message: string }> {
  const position = await getOrCreatePosition(userId)
  const grainPrice = await getCurrentGrainPrice()

  let grainToRepay = 0

  if (grainAmount) {
    // Repay with appreciation GRAIN
    if (grainAmount > position.appreciationGrain) {
      throw new Error(
        `Insufficient appreciation GRAIN. Available: ${position.appreciationGrain.toLocaleString()}`
      )
    }
    grainToRepay = Math.min(grainAmount, position.creditLineUsed)
  } else if (usdAmount) {
    // Repay with USD (converted at current price)
    grainToRepay = Math.min(usdAmount / grainPrice, position.creditLineUsed)
  } else {
    throw new Error('Must specify grainAmount or usdAmount to repay')
  }

  if (grainToRepay > position.creditLineUsed) {
    grainToRepay = position.creditLineUsed
  }

  // Calculate new values
  const newCreditLineUsed = position.creditLineUsed - grainToRepay
  const newAppreciation = grainAmount
    ? position.appreciationGrain - grainToRepay
    : position.appreciationGrain
  const newStatus = newCreditLineUsed > 0 ? 'credit_used' : 'active'

  // Update position
  const updateResult = await query(
    `UPDATE credit_line_positions
     SET credit_line_used = $1,
         appreciation_grain = $2,
         status = $3
     WHERE user_id = $4
     RETURNING *`,
    [newCreditLineUsed, newAppreciation, newStatus, userId]
  )

  // Record transaction
  await query(
    `INSERT INTO credit_line_transactions
     (user_id, position_id, type, grain_amount, usd_amount, grain_price,
      protected_deposit_after, credit_line_used_after, appreciation_after,
      description)
     VALUES ($1, $2, 'credit_repay', $3, $4, $5, $6, $7, $8, $9)`,
    [
      userId,
      position.id,
      grainToRepay,
      usdAmount || null,
      grainPrice,
      position.protectedDeposit,
      newCreditLineUsed,
      newAppreciation,
      `Repaid ${grainToRepay.toLocaleString()} GRAIN credit`,
    ]
  )

  return {
    success: true,
    position: mapRowToPosition(updateResult.rows[0]),
    message: `Repaid ${grainToRepay.toLocaleString()} GRAIN. Remaining credit used: ${newCreditLineUsed.toLocaleString()}`,
  }
}

/**
 * Withdraw USD from protected deposit
 *
 * Requirements:
 * - Must repay credit line first (or repay is deducted from withdrawal)
 * - Protected deposit always available
 */
export async function withdraw(
  userId: string,
  usdAmount: number
): Promise<WithdrawResult> {
  if (usdAmount <= 0) {
    throw new Error('Withdrawal amount must be positive')
  }

  const position = await getOrCreatePosition(userId)
  const grainPrice = await getCurrentGrainPrice()

  // Calculate how much credit must be repaid
  const creditLineValueUsed = position.creditLineUsed * grainPrice

  // Check if withdrawal is possible
  const netWithdrawable = position.protectedDeposit - creditLineValueUsed

  if (usdAmount > position.protectedDeposit) {
    throw new Error(
      `Cannot withdraw more than protected deposit ($${position.protectedDeposit.toLocaleString()})`
    )
  }

  // Calculate credit to repay proportionally
  const withdrawalRatio = usdAmount / position.protectedDeposit
  const creditToRepay = position.creditLineUsed * withdrawalRatio
  const creditLimitToReduce = position.creditLineLimit * withdrawalRatio

  // Calculate new values
  const newProtectedDeposit = position.protectedDeposit - usdAmount
  const newCreditLineLimit = position.creditLineLimit - creditLimitToReduce
  const newCreditLineUsed = position.creditLineUsed - creditToRepay

  // Update position
  const updateResult = await query(
    `UPDATE credit_line_positions
     SET protected_deposit = $1,
         credit_line_limit = $2,
         credit_line_used = $3,
         status = CASE WHEN $3 > 0 THEN 'credit_used' ELSE 'active' END
     WHERE user_id = $4
     RETURNING *`,
    [newProtectedDeposit, newCreditLineLimit, newCreditLineUsed, userId]
  )

  const updatedPosition = mapRowToPosition(updateResult.rows[0])

  // Record transaction
  const txResult = await query(
    `INSERT INTO credit_line_transactions
     (user_id, position_id, type, usd_amount, grain_amount, grain_price,
      protected_deposit_after, credit_line_used_after, appreciation_after,
      description)
     VALUES ($1, $2, 'withdraw', $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      position.id,
      usdAmount,
      creditToRepay,
      grainPrice,
      updatedPosition.protectedDeposit,
      updatedPosition.creditLineUsed,
      updatedPosition.appreciationGrain,
      `Withdrew $${usdAmount.toLocaleString()}`,
    ]
  )

  // Update treasury liquidity
  await updateTreasuryLiquidity(usdAmount, 'remove')

  return {
    success: true,
    position: updatedPosition,
    transaction: mapRowToTransaction(txResult.rows[0]),
    usdWithdrawn: usdAmount,
    creditLineRepaid: creditToRepay,
    message: `Withdrew $${usdAmount.toLocaleString()}. Credit line reduced by ${creditToRepay.toLocaleString()} GRAIN.`,
  }
}

/**
 * Grant appreciation GRAIN to a user
 * Called when distributing ecosystem growth
 */
export async function grantAppreciation(
  userId: string,
  grainAmount: number,
  source: string
): Promise<CreditLinePosition> {
  if (grainAmount <= 0) {
    throw new Error('Appreciation amount must be positive')
  }

  const position = await getOrCreatePosition(userId)
  const grainPrice = await getCurrentGrainPrice()

  // Update position
  const updateResult = await query(
    `UPDATE credit_line_positions
     SET appreciation_grain = appreciation_grain + $1
     WHERE user_id = $2
     RETURNING *`,
    [grainAmount, userId]
  )

  const updatedPosition = mapRowToPosition(updateResult.rows[0])

  // Record transaction
  await query(
    `INSERT INTO credit_line_transactions
     (user_id, position_id, type, grain_amount, grain_price,
      protected_deposit_after, credit_line_used_after, appreciation_after,
      description)
     VALUES ($1, $2, 'appreciation_grant', $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      position.id,
      grainAmount,
      grainPrice,
      updatedPosition.protectedDeposit,
      updatedPosition.creditLineUsed,
      updatedPosition.appreciationGrain,
      `Appreciation grant: ${grainAmount.toLocaleString()} GRAIN from ${source}`,
    ]
  )

  return updatedPosition
}

// ============================================================================
// REVENUE ALLOCATION
// ============================================================================

/**
 * Allocate WellsAI 1% transaction fee
 * LOCKED FORMULA: 10% tithe, 30% wells_onyx, 30% liquidity, 30% partners
 */
export async function allocateWellsAIFee(
  feeAmount: number,
  sourceTransactionId?: string,
  grainPrice?: number
): Promise<string> {
  const price = grainPrice || (await getCurrentGrainPrice())

  // Call the database function (locked formula)
  const result = await query(
    `SELECT allocate_wellsai_fee($1, $2, $3) AS allocation_id`,
    [feeAmount, sourceTransactionId, price]
  )

  return result.rows[0].allocation_id
}

/**
 * Allocate float yield revenue (4.5% on deposits)
 * LOCKED FORMULA: 10% tithe, 30% founders, 30% wells_onyx, 30% treasury
 */
export async function allocateFloatYield(
  yieldAmount: number,
  sourceTransactionId?: string,
  grainPrice?: number
): Promise<string> {
  const price = grainPrice || (await getCurrentGrainPrice())

  // Call the database function (locked formula)
  const result = await query(
    `SELECT allocate_float_yield($1, $2, $3) AS allocation_id`,
    [yieldAmount, sourceTransactionId, price]
  )

  return result.rows[0].allocation_id
}

// ============================================================================
// TREASURY INTEGRATION
// ============================================================================

/**
 * Update treasury liquidity when deposits/withdrawals occur
 */
async function updateTreasuryLiquidity(
  amount: number,
  operation: 'add' | 'remove'
): Promise<void> {
  const sign = operation === 'add' ? 1 : -1

  await query(
    `UPDATE vault_treasury
     SET liquidity_usdc_cash = liquidity_usdc_cash + $1,
         calc_usdc_liquidity = calc_usdc_liquidity + $1
     WHERE id IS NOT NULL`,
    [amount * sign]
  )

  // Recalculate GRAIN price
  await recalculateGrainPrice()
}

/**
 * Recalculate GRAIN price based on liquid backing
 * GRAIN Price = Total Liquid Value / GRAIN Supply
 */
async function recalculateGrainPrice(): Promise<number> {
  const result = await query(`
    UPDATE vault_treasury
    SET calc_grain_price = (calc_usdc_liquidity + calc_equity_value) / NULLIF(grain_supply, 0),
        calc_total_ecosystem_value = calc_usdc_liquidity + calc_equity_value
    WHERE id IS NOT NULL
    RETURNING calc_grain_price
  `)

  if (result.rows.length === 0) {
    return 1.0
  }

  return parseFloat(result.rows[0].calc_grain_price) || 1.0
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get position by user ID
 */
export async function getPosition(
  userId: string
): Promise<CreditLinePosition | null> {
  const result = await query(
    `SELECT * FROM credit_line_positions WHERE user_id = $1`,
    [userId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToPosition(result.rows[0])
}

/**
 * Get transaction history for a user
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<CreditLineTransaction[]> {
  const result = await query(
    `SELECT * FROM credit_line_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map(mapRowToTransaction)
}

/**
 * Get all positions (admin)
 */
export async function getAllPositions(): Promise<CreditLinePosition[]> {
  const result = await query(
    `SELECT * FROM credit_line_positions ORDER BY protected_deposit DESC`
  )

  return result.rows.map(mapRowToPosition)
}

/**
 * Get revenue ledger summary
 */
export async function getRevenueLedgers(): Promise<
  {
    ledgerType: string
    balance: number
    totalAllocated: number
    totalWithdrawn: number
  }[]
> {
  const result = await query(`SELECT * FROM revenue_ledger_summary`)

  return result.rows.map((row) => ({
    ledgerType: row.ledger_type,
    balance: parseFloat(row.balance) || 0,
    totalAllocated: parseFloat(row.total_allocated) || 0,
    totalWithdrawn: parseFloat(row.total_withdrawn) || 0,
  }))
}

// ============================================================================
// HELPERS
// ============================================================================

function mapRowToPosition(row: any): CreditLinePosition {
  const limit = parseFloat(row.credit_line_limit) || 0
  const used = parseFloat(row.credit_line_used) || 0

  return {
    id: row.id,
    userId: row.user_id,
    protectedDeposit: parseFloat(row.protected_deposit) || 0,
    depositGrainPrice: parseFloat(row.deposit_grain_price) || 1,
    creditLineLimit: limit,
    creditLineUsed: used,
    creditLineAvailable: limit - used,
    appreciationGrain: parseFloat(row.appreciation_grain) || 0,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapRowToTransaction(row: any): CreditLineTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    positionId: row.position_id,
    type: row.type,
    usdAmount: row.usd_amount ? parseFloat(row.usd_amount) : null,
    grainAmount: row.grain_amount ? parseFloat(row.grain_amount) : null,
    grainPrice: parseFloat(row.grain_price) || 1,
    protectedDepositAfter: parseFloat(row.protected_deposit_after) || 0,
    creditLineUsedAfter: parseFloat(row.credit_line_used_after) || 0,
    appreciationAfter: parseFloat(row.appreciation_after) || 0,
    counterpartyId: row.counterparty_id,
    description: row.description,
    createdAt: new Date(row.created_at),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const CreditLineEngine = {
  // Position management
  getOrCreatePosition,
  getPosition,
  getAllPositions,

  // Core operations
  deposit,
  spend,
  repayCredit,
  withdraw,
  grantAppreciation,

  // Pricing
  getCurrentGrainPrice,

  // Revenue allocation
  allocateWellsAIFee,
  allocateFloatYield,

  // Queries
  getTransactionHistory,
  getRevenueLedgers,
}

export default CreditLineEngine
