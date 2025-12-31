/**
 * Founder Ledger System
 *
 * Manages founder positions and annuity distributions.
 * Protected by the same Vault mechanics as user deposits.
 *
 * Founders:
 * - Jonah Manning (50%)
 * - Jonathan (50%)
 *
 * Revenue Source:
 * - 30% of Float Yield (4.5% on deposits)
 * - At scale: ~$1.47B/year total → ~$735M each
 *
 * Paid in GRAIN - which also appreciates.
 */

import { query } from '@/lib/db'
import { FOUNDER_SPLIT } from './revenue-allocation'

// ============================================================================
// TYPES
// ============================================================================

export interface FounderLedger {
  id: string
  founderId: 'jonah' | 'jonathan'
  displayName: string

  // Annuity tracking
  annuityBalance: number
  totalEarned: number
  totalWithdrawn: number

  // GRAIN position (founders can have their own credit line)
  grainPositionId: string | null

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface FounderAnnuityTransaction {
  id: string
  founderId: string
  type: 'allocation' | 'withdrawal' | 'reinvest_to_grain'
  amount: number
  balanceAfter: number
  sourceAllocationId: string | null
  description: string | null
  createdAt: Date
}

export interface FounderSummary {
  founderId: string
  displayName: string
  annuityBalance: number
  totalEarned: number
  totalWithdrawn: number
  grainProtectedDeposit: number
  grainCreditLimit: number
  appreciationGrain: number
  updatedAt: Date
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get founder ledger by ID
 */
export async function getFounderLedger(
  founderId: 'jonah' | 'jonathan'
): Promise<FounderLedger | null> {
  const result = await query(
    `SELECT * FROM founder_ledgers WHERE founder_id = $1`,
    [founderId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToFounderLedger(result.rows[0])
}

/**
 * Get all founder ledgers
 */
export async function getAllFounderLedgers(): Promise<FounderLedger[]> {
  const result = await query(`SELECT * FROM founder_ledgers ORDER BY founder_id`)
  return result.rows.map(mapRowToFounderLedger)
}

/**
 * Get founder summary with GRAIN position
 */
export async function getFounderSummary(
  founderId: 'jonah' | 'jonathan'
): Promise<FounderSummary | null> {
  const result = await query(
    `SELECT * FROM founder_summary WHERE founder_id = $1`,
    [founderId]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    founderId: row.founder_id,
    displayName: row.display_name,
    annuityBalance: parseFloat(row.annuity_balance) || 0,
    totalEarned: parseFloat(row.total_earned) || 0,
    totalWithdrawn: parseFloat(row.total_withdrawn) || 0,
    grainProtectedDeposit: parseFloat(row.grain_protected_deposit) || 0,
    grainCreditLimit: parseFloat(row.grain_credit_limit) || 0,
    appreciationGrain: parseFloat(row.appreciation_grain) || 0,
    updatedAt: new Date(row.updated_at),
  }
}

/**
 * Get all founder summaries
 */
export async function getAllFounderSummaries(): Promise<FounderSummary[]> {
  const result = await query(`SELECT * FROM founder_summary`)
  return result.rows.map((row) => ({
    founderId: row.founder_id,
    displayName: row.display_name,
    annuityBalance: parseFloat(row.annuity_balance) || 0,
    totalEarned: parseFloat(row.total_earned) || 0,
    totalWithdrawn: parseFloat(row.total_withdrawn) || 0,
    grainProtectedDeposit: parseFloat(row.grain_protected_deposit) || 0,
    grainCreditLimit: parseFloat(row.grain_credit_limit) || 0,
    appreciationGrain: parseFloat(row.appreciation_grain) || 0,
    updatedAt: new Date(row.updated_at),
  }))
}

/**
 * Withdraw from founder annuity
 * Founder can withdraw USD or convert to GRAIN
 */
export async function withdrawAnnuity(
  founderId: 'jonah' | 'jonathan',
  amount: number,
  description?: string
): Promise<{ success: boolean; newBalance: number; transaction: FounderAnnuityTransaction }> {
  const ledger = await getFounderLedger(founderId)

  if (!ledger) {
    throw new Error(`Founder ledger not found: ${founderId}`)
  }

  if (amount > ledger.annuityBalance) {
    throw new Error(
      `Insufficient annuity balance. Available: $${ledger.annuityBalance.toLocaleString()}`
    )
  }

  // Update ledger
  const updateResult = await query(
    `UPDATE founder_ledgers
     SET annuity_balance = annuity_balance - $1,
         total_withdrawn = total_withdrawn + $1,
         updated_at = NOW()
     WHERE founder_id = $2
     RETURNING annuity_balance`,
    [amount, founderId]
  )

  const newBalance = parseFloat(updateResult.rows[0].annuity_balance) || 0

  // Record transaction
  const txResult = await query(
    `INSERT INTO founder_annuity_transactions
     (founder_id, type, amount, balance_after, description)
     VALUES ($1, 'withdrawal', $2, $3, $4)
     RETURNING *`,
    [founderId, amount, newBalance, description || `Withdrawal of $${amount.toLocaleString()}`]
  )

  return {
    success: true,
    newBalance,
    transaction: mapRowToTransaction(txResult.rows[0]),
  }
}

/**
 * Convert annuity to GRAIN (reinvest)
 * Takes USD from annuity and deposits into founder's GRAIN position
 */
export async function reinvestAnnuityToGrain(
  founderId: 'jonah' | 'jonathan',
  amount: number,
  grainPrice: number
): Promise<{
  success: boolean
  usdReinvested: number
  grainReceived: number
  newAnnuityBalance: number
}> {
  const ledger = await getFounderLedger(founderId)

  if (!ledger) {
    throw new Error(`Founder ledger not found: ${founderId}`)
  }

  if (amount > ledger.annuityBalance) {
    throw new Error(
      `Insufficient annuity balance. Available: $${ledger.annuityBalance.toLocaleString()}`
    )
  }

  const grainAmount = amount / grainPrice

  // Start transaction
  await query('BEGIN')

  try {
    // Deduct from annuity
    await query(
      `UPDATE founder_ledgers
       SET annuity_balance = annuity_balance - $1,
           updated_at = NOW()
       WHERE founder_id = $2`,
      [amount, founderId]
    )

    // Get or create GRAIN position for founder
    let positionId = ledger.grainPositionId

    if (!positionId) {
      // Create position
      const positionResult = await query(
        `INSERT INTO credit_line_positions (user_id, deposit_grain_price)
         VALUES ($1, $2)
         RETURNING id`,
        [`founder_${founderId}`, grainPrice]
      )
      positionId = positionResult.rows[0].id

      // Link to founder ledger
      await query(
        `UPDATE founder_ledgers SET grain_position_id = $1 WHERE founder_id = $2`,
        [positionId, founderId]
      )
    }

    // Add to GRAIN position
    await query(
      `UPDATE credit_line_positions
       SET protected_deposit = protected_deposit + $1,
           credit_line_limit = credit_line_limit + $2,
           deposit_grain_price = $3
       WHERE id = $4`,
      [amount, grainAmount, grainPrice, positionId]
    )

    // Record transaction
    const ledgerResult = await query(
      `SELECT annuity_balance FROM founder_ledgers WHERE founder_id = $1`,
      [founderId]
    )
    const newBalance = parseFloat(ledgerResult.rows[0].annuity_balance) || 0

    await query(
      `INSERT INTO founder_annuity_transactions
       (founder_id, type, amount, balance_after, description)
       VALUES ($1, 'reinvest_to_grain', $2, $3, $4)`,
      [
        founderId,
        amount,
        newBalance,
        `Reinvested $${amount.toLocaleString()} → ${grainAmount.toLocaleString()} GRAIN at $${grainPrice.toFixed(4)}/GRAIN`,
      ]
    )

    await query('COMMIT')

    return {
      success: true,
      usdReinvested: amount,
      grainReceived: grainAmount,
      newAnnuityBalance: newBalance,
    }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Get founder transaction history
 */
export async function getFounderTransactionHistory(
  founderId: 'jonah' | 'jonathan',
  limit: number = 50
): Promise<FounderAnnuityTransaction[]> {
  const result = await query(
    `SELECT * FROM founder_annuity_transactions
     WHERE founder_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [founderId, limit]
  )

  return result.rows.map(mapRowToTransaction)
}

/**
 * Calculate projected annual annuity at a given deposit base
 */
export function calculateProjectedAnnuity(
  totalDeposits: number,
  floatYieldRate: number = 0.045
): {
  totalFloatYield: number
  foundersShare: number // 30%
  jonahShare: number
  jonathanShare: number
} {
  const totalFloatYield = totalDeposits * floatYieldRate
  const foundersShare = totalFloatYield * 0.3 // 30% to founders
  const jonahShare = foundersShare * FOUNDER_SPLIT.jonah
  const jonathanShare = foundersShare * FOUNDER_SPLIT.jonathan

  return {
    totalFloatYield,
    foundersShare,
    jonahShare,
    jonathanShare,
  }
}

/**
 * Calculate at SAP scale
 * 3.3% of $33T = $1.09T annual volume
 * 10% average deposit balance = $109B
 */
export function calculateAtSAPScale(): ReturnType<typeof calculateProjectedAnnuity> {
  const sapVolume = 33_000_000_000_000 * 0.033 // $1.09T
  const avgDeposits = sapVolume * 0.1 // $109B
  return calculateProjectedAnnuity(avgDeposits)
}

// ============================================================================
// HELPERS
// ============================================================================

function mapRowToFounderLedger(row: any): FounderLedger {
  return {
    id: row.id,
    founderId: row.founder_id,
    displayName: row.display_name,
    annuityBalance: parseFloat(row.annuity_balance) || 0,
    totalEarned: parseFloat(row.total_earned) || 0,
    totalWithdrawn: parseFloat(row.total_withdrawn) || 0,
    grainPositionId: row.grain_position_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapRowToTransaction(row: any): FounderAnnuityTransaction {
  return {
    id: row.id,
    founderId: row.founder_id,
    type: row.type,
    amount: parseFloat(row.amount) || 0,
    balanceAfter: parseFloat(row.balance_after) || 0,
    sourceAllocationId: row.source_allocation_id,
    description: row.description,
    createdAt: new Date(row.created_at),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const FounderLedgers = {
  // Queries
  getFounderLedger,
  getAllFounderLedgers,
  getFounderSummary,
  getAllFounderSummaries,
  getFounderTransactionHistory,

  // Operations
  withdrawAnnuity,
  reinvestAnnuityToGrain,

  // Calculations
  calculateProjectedAnnuity,
  calculateAtSAPScale,

  // Constants
  FOUNDER_SPLIT,
}

export default FounderLedgers
