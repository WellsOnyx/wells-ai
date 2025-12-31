/**
 * GRAIN Revenue Allocation System
 *
 * LOCKED FORMULAS - These cannot be changed without governance
 *
 * Revenue Sources:
 * 1. WellsAI 1% Transaction Fee
 * 2. Float Yield 4.5% on Deposits
 * 3. DeFi Interest (future)
 * 4. Real Asset Income
 *
 * The key insight: GRAIN appreciation is backed by REAL LIQUID ASSETS
 * - 30% of WellsAI fees → liquidity
 * - 30% of float yield → treasury equity
 * - Both represent actual cash in the vault
 */

import { query } from '@/lib/db'

// ============================================================================
// LOCKED ALLOCATION FORMULAS
// These are immutable - changes require governance approval
// ============================================================================

/**
 * WellsAI 1% Fee Split
 * Applied to all AI-facilitated transactions
 */
export const WELLSAI_FEE_ALLOCATION = {
  tithe: 0.10, // 10% → Charitable giving
  wellsOnyx: 0.30, // 30% → Wells Onyx operating expenses
  liquidity: 0.30, // 30% → GRAIN liquidity backing (APPRECIATES GRAIN)
  partners: 0.30, // 30% → Partner commissions
} as const

/**
 * Float Yield Split (4.5% on deposits)
 * Applied to yield earned from deposit float
 */
export const FLOAT_YIELD_ALLOCATION = {
  tithe: 0.10, // 10% → Charitable giving
  founders: 0.30, // 30% → Founders annuity (split 50/50)
  wellsOnyx: 0.30, // 30% → Wells Onyx operating expenses
  treasury: 0.30, // 30% → Treasury equity (APPRECIATES GRAIN)
} as const

/**
 * Founder Split
 * How the founders annuity is divided
 */
export const FOUNDER_SPLIT = {
  jonah: 0.50, // 50% to Jonah
  jonathan: 0.50, // 50% to Jonathan
} as const

/**
 * Float Yield Rate
 * Annual yield on deposits (conservative)
 */
export const FLOAT_YIELD_RATE = 0.045 // 4.5% annual

/**
 * WellsAI Fee Rate
 * Fee on all AI-facilitated transactions
 */
export const WELLSAI_FEE_RATE = 0.01 // 1%

// ============================================================================
// TYPES
// ============================================================================

export interface RevenueAllocation {
  id: string
  sourceType: 'wellsai_fee' | 'float_yield' | 'defi_interest' | 'asset_income'
  sourceAmount: number
  sourceTransactionId: string | null

  // WellsAI fee splits
  titheAmount: number
  wellsOnyxAmount: number
  liquidityAmount: number
  partnersAmount: number

  // Float yield splits
  foundersAmount: number
  treasuryAmount: number

  grainPriceAtAllocation: number
  createdAt: Date
}

export interface LedgerSummary {
  ledgerType: string
  balance: number
  totalAllocated: number
  totalWithdrawn: number
  updatedAt: Date
}

export interface AllocationResult {
  success: boolean
  allocationId: string
  breakdown: {
    tithe: number
    wellsOnyx: number
    liquidity: number
    partners: number
    founders?: number
    treasury?: number
  }
}

// ============================================================================
// ALLOCATION FUNCTIONS
// ============================================================================

/**
 * Calculate WellsAI fee allocation breakdown
 * Does NOT write to database - just calculates
 */
export function calculateWellsAIFeeBreakdown(feeAmount: number): {
  tithe: number
  wellsOnyx: number
  liquidity: number
  partners: number
} {
  return {
    tithe: feeAmount * WELLSAI_FEE_ALLOCATION.tithe,
    wellsOnyx: feeAmount * WELLSAI_FEE_ALLOCATION.wellsOnyx,
    liquidity: feeAmount * WELLSAI_FEE_ALLOCATION.liquidity,
    partners: feeAmount * WELLSAI_FEE_ALLOCATION.partners,
  }
}

/**
 * Calculate float yield allocation breakdown
 * Does NOT write to database - just calculates
 */
export function calculateFloatYieldBreakdown(yieldAmount: number): {
  tithe: number
  founders: number
  jonahShare: number
  jonathanShare: number
  wellsOnyx: number
  treasury: number
} {
  const foundersTotal = yieldAmount * FLOAT_YIELD_ALLOCATION.founders
  return {
    tithe: yieldAmount * FLOAT_YIELD_ALLOCATION.tithe,
    founders: foundersTotal,
    jonahShare: foundersTotal * FOUNDER_SPLIT.jonah,
    jonathanShare: foundersTotal * FOUNDER_SPLIT.jonathan,
    wellsOnyx: yieldAmount * FLOAT_YIELD_ALLOCATION.wellsOnyx,
    treasury: yieldAmount * FLOAT_YIELD_ALLOCATION.treasury,
  }
}

/**
 * Allocate WellsAI 1% transaction fee
 * Writes to database and updates ledgers
 */
export async function allocateWellsAIFee(
  feeAmount: number,
  sourceTransactionId?: string,
  grainPrice: number = 1
): Promise<AllocationResult> {
  const breakdown = calculateWellsAIFeeBreakdown(feeAmount)

  // Call the locked database function
  const result = await query(
    `SELECT allocate_wellsai_fee($1, $2, $3) AS allocation_id`,
    [feeAmount, sourceTransactionId || null, grainPrice]
  )

  return {
    success: true,
    allocationId: result.rows[0].allocation_id,
    breakdown: {
      tithe: breakdown.tithe,
      wellsOnyx: breakdown.wellsOnyx,
      liquidity: breakdown.liquidity,
      partners: breakdown.partners,
    },
  }
}

/**
 * Allocate float yield revenue (4.5% on deposits)
 * Writes to database and updates ledgers
 */
export async function allocateFloatYield(
  yieldAmount: number,
  sourceTransactionId?: string,
  grainPrice: number = 1
): Promise<AllocationResult> {
  const breakdown = calculateFloatYieldBreakdown(yieldAmount)

  // Call the locked database function
  const result = await query(
    `SELECT allocate_float_yield($1, $2, $3) AS allocation_id`,
    [yieldAmount, sourceTransactionId || null, grainPrice]
  )

  return {
    success: true,
    allocationId: result.rows[0].allocation_id,
    breakdown: {
      tithe: breakdown.tithe,
      wellsOnyx: breakdown.wellsOnyx,
      liquidity: 0, // Float yield doesn't go to liquidity
      partners: 0, // Float yield doesn't go to partners
      founders: breakdown.founders,
      treasury: breakdown.treasury,
    },
  }
}

/**
 * Calculate daily float yield for a deposit amount
 */
export function calculateDailyFloatYield(depositAmount: number): number {
  return (depositAmount * FLOAT_YIELD_RATE) / 365
}

/**
 * Calculate annual float yield for a deposit amount
 */
export function calculateAnnualFloatYield(depositAmount: number): number {
  return depositAmount * FLOAT_YIELD_RATE
}

// ============================================================================
// LEDGER QUERIES
// ============================================================================

/**
 * Get all revenue ledger balances
 */
export async function getLedgerSummaries(): Promise<LedgerSummary[]> {
  const result = await query(`SELECT * FROM revenue_ledger_summary`)

  return result.rows.map((row) => ({
    ledgerType: row.ledger_type,
    balance: parseFloat(row.balance) || 0,
    totalAllocated: parseFloat(row.total_allocated) || 0,
    totalWithdrawn: parseFloat(row.total_withdrawn) || 0,
    updatedAt: new Date(row.updated_at),
  }))
}

/**
 * Get specific ledger balance
 */
export async function getLedgerBalance(
  ledgerType: string
): Promise<LedgerSummary | null> {
  const result = await query(
    `SELECT * FROM revenue_ledgers WHERE ledger_type = $1`,
    [ledgerType]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    ledgerType: row.ledger_type,
    balance: parseFloat(row.balance) || 0,
    totalAllocated: parseFloat(row.total_allocated) || 0,
    totalWithdrawn: parseFloat(row.total_withdrawn) || 0,
    updatedAt: new Date(row.updated_at),
  }
}

/**
 * Get recent allocations
 */
export async function getRecentAllocations(
  limit: number = 50
): Promise<RevenueAllocation[]> {
  const result = await query(
    `SELECT * FROM revenue_allocations ORDER BY created_at DESC LIMIT $1`,
    [limit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceAmount: parseFloat(row.source_amount) || 0,
    sourceTransactionId: row.source_transaction_id,
    titheAmount: parseFloat(row.tithe_amount) || 0,
    wellsOnyxAmount: parseFloat(row.wells_onyx_amount) || 0,
    liquidityAmount: parseFloat(row.liquidity_amount) || 0,
    partnersAmount: parseFloat(row.partners_amount) || 0,
    foundersAmount: parseFloat(row.founders_amount) || 0,
    treasuryAmount: parseFloat(row.treasury_amount) || 0,
    grainPriceAtAllocation: parseFloat(row.grain_price_at_allocation) || 1,
    createdAt: new Date(row.created_at),
  }))
}

/**
 * Get total allocations by source type
 */
export async function getAllocationTotals(): Promise<{
  wellsaiFees: { total: number; toTithe: number; toOps: number; toLiquidity: number; toPartners: number }
  floatYield: { total: number; toTithe: number; toOps: number; toFounders: number; toTreasury: number }
}> {
  const result = await query(`
    SELECT
      source_type,
      SUM(source_amount) as total,
      SUM(tithe_amount) as tithe,
      SUM(wells_onyx_amount) as wells_onyx,
      SUM(liquidity_amount) as liquidity,
      SUM(partners_amount) as partners,
      SUM(founders_amount) as founders,
      SUM(treasury_amount) as treasury
    FROM revenue_allocations
    GROUP BY source_type
  `)

  const wellsaiRow = result.rows.find((r) => r.source_type === 'wellsai_fee') || {}
  const yieldRow = result.rows.find((r) => r.source_type === 'float_yield') || {}

  return {
    wellsaiFees: {
      total: parseFloat(wellsaiRow.total) || 0,
      toTithe: parseFloat(wellsaiRow.tithe) || 0,
      toOps: parseFloat(wellsaiRow.wells_onyx) || 0,
      toLiquidity: parseFloat(wellsaiRow.liquidity) || 0,
      toPartners: parseFloat(wellsaiRow.partners) || 0,
    },
    floatYield: {
      total: parseFloat(yieldRow.total) || 0,
      toTithe: parseFloat(yieldRow.tithe) || 0,
      toOps: parseFloat(yieldRow.wells_onyx) || 0,
      toFounders: parseFloat(yieldRow.founders) || 0,
      toTreasury: parseFloat(yieldRow.treasury) || 0,
    },
  }
}

// ============================================================================
// WITHDRAWAL FUNCTIONS
// ============================================================================

/**
 * Withdraw from a ledger (e.g., Wells Onyx withdrawing operating funds)
 */
export async function withdrawFromLedger(
  ledgerType: string,
  amount: number,
  description: string
): Promise<{ success: boolean; newBalance: number }> {
  // Check balance
  const ledger = await getLedgerBalance(ledgerType)
  if (!ledger || ledger.balance < amount) {
    throw new Error(
      `Insufficient balance in ${ledgerType} ledger. Available: $${ledger?.balance.toLocaleString() || 0}`
    )
  }

  // Update ledger
  const result = await query(
    `UPDATE revenue_ledgers
     SET balance = balance - $1,
         total_withdrawn = total_withdrawn + $1,
         updated_at = NOW()
     WHERE ledger_type = $2
     RETURNING balance`,
    [amount, ledgerType]
  )

  // Log the withdrawal (could add a ledger_transactions table for full audit)
  console.log(
    `[Revenue] Withdrew $${amount.toLocaleString()} from ${ledgerType}: ${description}`
  )

  return {
    success: true,
    newBalance: parseFloat(result.rows[0].balance) || 0,
  }
}

// ============================================================================
// SCALE PROJECTIONS
// ============================================================================

/**
 * Project revenue at a given transaction volume
 * Useful for modeling and presentations
 */
export function projectRevenueAtScale(annualTransactionVolume: number): {
  transactionVolume: number
  averageDepositBalance: number
  wellsaiFees: {
    total: number
    tithe: number
    wellsOnyx: number
    liquidity: number
    partners: number
  }
  floatYield: {
    total: number
    tithe: number
    founders: number
    jonahShare: number
    jonathanShare: number
    wellsOnyx: number
    treasury: number
  }
  totalToLiquidity: number
  totalToTreasury: number
  totalGrainAppreciation: number
} {
  // Assume average deposit balance is 10% of annual volume
  const averageDepositBalance = annualTransactionVolume * 0.1

  // WellsAI fees (1% of volume)
  const totalWellsAIFees = annualTransactionVolume * WELLSAI_FEE_RATE
  const wellsaiBreakdown = calculateWellsAIFeeBreakdown(totalWellsAIFees)

  // Float yield (4.5% of deposits)
  const totalFloatYield = averageDepositBalance * FLOAT_YIELD_RATE
  const yieldBreakdown = calculateFloatYieldBreakdown(totalFloatYield)

  // Total flowing to GRAIN appreciation
  const totalToLiquidity = wellsaiBreakdown.liquidity
  const totalToTreasury = yieldBreakdown.treasury
  const totalGrainAppreciation = totalToLiquidity + totalToTreasury

  return {
    transactionVolume: annualTransactionVolume,
    averageDepositBalance,
    wellsaiFees: {
      total: totalWellsAIFees,
      ...wellsaiBreakdown,
    },
    floatYield: {
      total: totalFloatYield,
      ...yieldBreakdown,
    },
    totalToLiquidity,
    totalToTreasury,
    totalGrainAppreciation,
  }
}

/**
 * Project at SAP scale (3.3% of $33T)
 */
export function projectAtSAPScale(): ReturnType<typeof projectRevenueAtScale> {
  const sapEcosystemVolume = 33_000_000_000_000 // $33T
  const ourShare = 0.033 // 3.3%
  const annualVolume = sapEcosystemVolume * ourShare // $1.09T

  return projectRevenueAtScale(annualVolume)
}

// ============================================================================
// EXPORTS
// ============================================================================

export const RevenueAllocation = {
  // Constants (locked)
  WELLSAI_FEE_ALLOCATION,
  FLOAT_YIELD_ALLOCATION,
  FOUNDER_SPLIT,
  FLOAT_YIELD_RATE,
  WELLSAI_FEE_RATE,

  // Calculations
  calculateWellsAIFeeBreakdown,
  calculateFloatYieldBreakdown,
  calculateDailyFloatYield,
  calculateAnnualFloatYield,

  // Allocations
  allocateWellsAIFee,
  allocateFloatYield,

  // Queries
  getLedgerSummaries,
  getLedgerBalance,
  getRecentAllocations,
  getAllocationTotals,

  // Withdrawals
  withdrawFromLedger,

  // Projections
  projectRevenueAtScale,
  projectAtSAPScale,
}

export default RevenueAllocation
