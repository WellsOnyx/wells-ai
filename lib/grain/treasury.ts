/**
 * GRAIN Treasury Management
 *
 * CORE RULES (HARD CODED - NEVER CHANGE):
 * 1. GRAIN supply can NEVER exceed USDC backing (1:1 minimum)
 * 2. Interest/yield sweeps daily to Asset Vault wallet
 * 3. Asset Vault buys appreciating assets (real estate, DeFi yields)
 * 4. GRAIN value = (USDC + Asset Value) / Supply
 * 5. GRAIN can only go UP in value, never down
 *
 * RESERVE ALLOCATION MODEL:
 *   1%  → Foundation
 *   33% → Cash / Liquidity + TIPS
 *   33% → Precious Metals
 *   33% → US Treasuries
 *   Target: 7% ROI after fees on the float
 *
 * FLOAT MECHANICS:
 *   48-hour settlement window on all transactions
 *   Float = (Annual Volume / 365) × 2
 *   At 3-7% of $33T global payments = $5.4B - $12.7B float
 *
 * This creates a deflationary stablecoin backed by:
 * - 100% USDC (floor)
 * - Plus accumulated assets (upside)
 * - Reserve allocation generates yield on the float
 */

import { sql } from '@vercel/postgres'
import {
  calculateFloat,
  calculateTargetAllocation,
  getAllocationState,
  projectYield,
  analyzeLiquidity,
  allocateDeposit,
  calculateWithdrawalWaterfall,
  calculateRebalanceActions,
  RESERVE_ALLOCATION,
  TARGET_ROI,
  SETTLEMENT_HOURS,
  type FloatSnapshot,
  type AllocationState,
  type YieldProjection,
  type LiquidityAnalysis,
} from './float-allocation'

// ============================================================================
// CONSTANTS (IMMUTABLE)
// ============================================================================

// NEVER allow less than 100% USDC backing
const MIN_BACKING_RATIO = 1.0  // HARD CODED - DO NOT MODIFY

// Asset Vault wallet (receives daily interest sweep)
const ASSET_VAULT_WALLET_ID = process.env.CIRCLE_ASSET_VAULT_WALLET_ID
const ASSET_VAULT_ADDRESS = process.env.ASSET_VAULT_ADDRESS

// Circle master wallet (holds USDC backing)
const MASTER_WALLET_ID = process.env.CIRCLE_MASTER_WALLET_ID

// ============================================================================
// TYPES
// ============================================================================

export interface TreasuryState {
  // USDC in master wallet (floor)
  usdcBacking: number

  // Total GRAIN in circulation
  grainSupply: number

  // Current backing ratio (must be >= 1.0)
  backingRatio: number

  // Assets held in Asset Vault
  assetVaultValue: number

  // Effective GRAIN value (USDC + Assets) / Supply
  grainValue: number

  // Last audit timestamp
  lastAuditAt: Date

  // Health status
  status: 'healthy' | 'warning' | 'critical'
}

export interface AssetHolding {
  id: string
  type: 'real_estate' | 'defi_yield' | 'treasury_bond' | 'other'
  name: string
  purchasePrice: number
  currentValue: number
  purchaseDate: Date
  onChainAddress?: string
  blockchain?: string
  yieldRate?: number
}

export interface InterestSweep {
  id: string
  amount: number
  source: 'circle_yield' | 'defi_yield' | 'staking' | 'other'
  sweepDate: Date
  txHash?: string
}

// ============================================================================
// CORE TREASURY FUNCTIONS
// ============================================================================

/**
 * Get current treasury state
 * CRITICAL: This is the source of truth for GRAIN value
 */
export async function getTreasuryState(): Promise<TreasuryState> {
  // Get GRAIN supply
  const supplyResult = await sql`
    SELECT COALESCE(SUM(balance), 0) as total_supply
    FROM user_wallets
    WHERE user_id NOT IN ('WELLS_ESCROW_ACCOUNT', 'WELLS_TREASURY', 'ASSET_VAULT')
  `
  const grainSupply = parseFloat(supplyResult.rows[0]?.total_supply || 0)

  // Get USDC backing (from Circle wallet - would call Circle API)
  // For now, USDC backing = GRAIN supply (1:1)
  const usdcBacking = grainSupply // TODO: Fetch from Circle API

  // Get Asset Vault value
  const assetResult = await sql`
    SELECT COALESCE(SUM(current_value), 0) as total_value
    FROM grain_asset_holdings
    WHERE status = 'active'
  `
  const assetVaultValue = parseFloat(assetResult.rows[0]?.total_value || 0)

  // Calculate ratios
  const backingRatio = grainSupply > 0 ? usdcBacking / grainSupply : 1.0
  const grainValue = grainSupply > 0
    ? (usdcBacking + assetVaultValue) / grainSupply
    : 1.0

  // Determine health
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (backingRatio < MIN_BACKING_RATIO) {
    status = 'critical' // Should NEVER happen
  } else if (backingRatio < 1.05) {
    status = 'warning'
  }

  return {
    usdcBacking,
    grainSupply,
    backingRatio,
    assetVaultValue,
    grainValue,
    lastAuditAt: new Date(),
    status,
  }
}

/**
 * Validate GRAIN mint operation
 * CRITICAL: Enforces 1:1 backing rule
 */
export async function validateMint(amount: number): Promise<{
  allowed: boolean
  reason?: string
}> {
  const state = await getTreasuryState()

  // Calculate new state after mint
  const newSupply = state.grainSupply + amount
  const newBackingRatio = state.usdcBacking / newSupply

  // HARD RULE: Never allow backing to drop below 1:1
  if (newBackingRatio < MIN_BACKING_RATIO) {
    return {
      allowed: false,
      reason: `Mint would reduce backing ratio to ${newBackingRatio.toFixed(4)}. ` +
              `Minimum required: ${MIN_BACKING_RATIO}. ` +
              `Deposit more USDC first.`,
    }
  }

  return { allowed: true }
}

/**
 * Record USDC deposit (increases backing)
 */
export async function recordUsdcDeposit(
  amount: number,
  circleTransferId: string
): Promise<void> {
  await sql`
    INSERT INTO grain_treasury_events (
      type, amount, circle_transfer_id, notes, created_at
    ) VALUES (
      'usdc_deposit', ${amount}, ${circleTransferId}, 'USDC backing deposit', NOW()
    )
  `

  // Update daily snapshot
  await updateDailySnapshot()
}

/**
 * Record USDC withdrawal (decreases backing)
 * CRITICAL: Must validate 1:1 rule before allowing
 */
export async function recordUsdcWithdrawal(
  amount: number,
  circleTransferId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const state = await getTreasuryState()

  // Calculate new backing after withdrawal
  const newBacking = state.usdcBacking - amount
  const newBackingRatio = newBacking / state.grainSupply

  // HARD RULE: Never allow backing to drop below 1:1
  if (newBackingRatio < MIN_BACKING_RATIO) {
    return {
      allowed: false,
      reason: `Withdrawal would reduce backing ratio to ${newBackingRatio.toFixed(4)}. ` +
              `Minimum required: ${MIN_BACKING_RATIO}. ` +
              `Burn GRAIN first.`,
    }
  }

  await sql`
    INSERT INTO grain_treasury_events (
      type, amount, circle_transfer_id, notes, created_at
    ) VALUES (
      'usdc_withdrawal', ${-amount}, ${circleTransferId}, 'USDC withdrawal', NOW()
    )
  `

  return { allowed: true }
}

// ============================================================================
// INTEREST SWEEP (DAILY)
// ============================================================================

/**
 * Sweep interest from Circle yield to Asset Vault
 * Should be called daily by cron job
 */
export async function sweepInterestToAssetVault(): Promise<{
  swept: boolean
  amount: number
  txHash?: string
}> {
  // Get yield earned since last sweep
  const yieldResult = await sql`
    SELECT
      COALESCE(SUM(amount), 0) as pending_yield
    FROM grain_treasury_events
    WHERE type = 'yield_earned'
      AND swept_at IS NULL
  `

  const pendingYield = parseFloat(yieldResult.rows[0]?.pending_yield || 0)

  if (pendingYield <= 0) {
    return { swept: false, amount: 0 }
  }

  // Transfer yield to Asset Vault wallet
  // TODO: Call Circle API to transfer USDC to Asset Vault wallet

  // Record sweep
  const sweepResult = await sql`
    INSERT INTO grain_interest_sweeps (
      amount, source, sweep_date, status
    ) VALUES (
      ${pendingYield}, 'circle_yield', NOW(), 'completed'
    )
    RETURNING id
  `

  // Mark yield as swept
  await sql`
    UPDATE grain_treasury_events
    SET swept_at = NOW(), sweep_id = ${sweepResult.rows[0].id}
    WHERE type = 'yield_earned' AND swept_at IS NULL
  `

  // Credit Asset Vault balance
  await sql`
    UPDATE user_wallets
    SET balance = balance + ${pendingYield}, updated_at = NOW()
    WHERE user_id = 'ASSET_VAULT'
  `

  return {
    swept: true,
    amount: pendingYield,
    // txHash would come from Circle API
  }
}

/**
 * Record yield earned (from Circle or DeFi)
 */
export async function recordYieldEarned(
  amount: number,
  source: 'circle_yield' | 'defi_yield' | 'staking'
): Promise<void> {
  await sql`
    INSERT INTO grain_treasury_events (
      type, amount, source, notes, created_at
    ) VALUES (
      'yield_earned', ${amount}, ${source}, 'Interest/yield earned', NOW()
    )
  `
}

// ============================================================================
// ASSET VAULT MANAGEMENT
// ============================================================================

/**
 * Record asset purchase with Asset Vault funds
 */
export async function recordAssetPurchase(
  asset: Omit<AssetHolding, 'id' | 'currentValue'>
): Promise<string> {
  const result = await sql`
    INSERT INTO grain_asset_holdings (
      type, name, purchase_price, current_value, purchase_date,
      on_chain_address, blockchain, yield_rate, status
    ) VALUES (
      ${asset.type}, ${asset.name}, ${asset.purchasePrice}, ${asset.purchasePrice},
      ${asset.purchaseDate.toISOString()}, ${asset.onChainAddress || null},
      ${asset.blockchain || null}, ${asset.yieldRate || null}, 'active'
    )
    RETURNING id
  `

  // Debit Asset Vault
  await sql`
    UPDATE user_wallets
    SET balance = balance - ${asset.purchasePrice}, updated_at = NOW()
    WHERE user_id = 'ASSET_VAULT'
  `

  return result.rows[0].id
}

/**
 * Update asset valuation (called by oracle or manually)
 */
export async function updateAssetValuation(
  assetId: string,
  newValue: number,
  source: string
): Promise<void> {
  const oldValueResult = await sql`
    SELECT current_value FROM grain_asset_holdings WHERE id = ${assetId}
  `
  const oldValue = parseFloat(oldValueResult.rows[0]?.current_value || 0)

  await sql`
    UPDATE grain_asset_holdings
    SET
      current_value = ${newValue},
      last_valuation_at = NOW(),
      valuation_source = ${source}
    WHERE id = ${assetId}
  `

  // Record valuation change
  const change = newValue - oldValue
  if (Math.abs(change) > 0.01) {
    await sql`
      INSERT INTO grain_treasury_events (
        type, amount, notes, created_at
      ) VALUES (
        'asset_revaluation', ${change},
        'Asset ' || ${assetId} || ' revalued. Old: ' || ${oldValue} || ' New: ' || ${newValue},
        NOW()
      )
    `
  }
}

/**
 * Get all asset holdings
 */
export async function getAssetHoldings(): Promise<AssetHolding[]> {
  const result = await sql`
    SELECT
      id, type, name, purchase_price, current_value, purchase_date,
      on_chain_address, blockchain, yield_rate
    FROM grain_asset_holdings
    WHERE status = 'active'
    ORDER BY current_value DESC
  `

  return result.rows.map(row => ({
    id: row.id,
    type: row.type,
    name: row.name,
    purchasePrice: parseFloat(row.purchase_price),
    currentValue: parseFloat(row.current_value),
    purchaseDate: new Date(row.purchase_date),
    onChainAddress: row.on_chain_address,
    blockchain: row.blockchain,
    yieldRate: row.yield_rate ? parseFloat(row.yield_rate) : undefined,
  }))
}

// ============================================================================
// GRAIN VALUE CALCULATION
// ============================================================================

/**
 * Calculate current GRAIN value
 * GRAIN Value = (USDC Backing + Asset Vault Value) / GRAIN Supply
 */
export async function calculateGrainValue(): Promise<{
  value: number
  breakdown: {
    usdcBacking: number
    assetValue: number
    totalBacking: number
    grainSupply: number
  }
}> {
  const state = await getTreasuryState()

  const totalBacking = state.usdcBacking + state.assetVaultValue
  const value = state.grainSupply > 0 ? totalBacking / state.grainSupply : 1.0

  return {
    value,
    breakdown: {
      usdcBacking: state.usdcBacking,
      assetValue: state.assetVaultValue,
      totalBacking,
      grainSupply: state.grainSupply,
    },
  }
}

/**
 * Get historical GRAIN value
 */
export async function getGrainValueHistory(
  days: number = 30
): Promise<Array<{ date: Date; value: number }>> {
  const result = await sql`
    SELECT snapshot_date, grain_value
    FROM grain_treasury_snapshots
    WHERE snapshot_date >= NOW() - INTERVAL '${days} days'
    ORDER BY snapshot_date ASC
  `

  return result.rows.map(row => ({
    date: new Date(row.snapshot_date),
    value: parseFloat(row.grain_value),
  }))
}

// ============================================================================
// DAILY SNAPSHOT (For auditing)
// ============================================================================

/**
 * Take daily treasury snapshot
 * Should be called by cron job at midnight UTC
 */
export async function updateDailySnapshot(): Promise<void> {
  const state = await getTreasuryState()
  const grainValue = await calculateGrainValue()

  // Get transaction stats for last 24h
  const statsResult = await sql`
    SELECT
      COUNT(*) as tx_count,
      COALESCE(SUM(amount), 0) as tx_volume,
      COUNT(DISTINCT user_id) as unique_users
    FROM grain_transactions
    WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND status = 'completed'
  `
  const stats = statsResult.rows[0]

  // Get active escrow
  const escrowResult = await sql`
    SELECT COALESCE(SUM(amount), 0) as escrow_total
    FROM grain_escrow
    WHERE status = 'locked'
  `

  await sql`
    INSERT INTO grain_treasury_snapshots (
      snapshot_date,
      total_grain_supply,
      total_usdc_backing,
      backing_ratio,
      asset_vault_value,
      grain_value,
      total_credit_extended,
      effective_leverage,
      active_escrow_amount,
      transaction_count_24h,
      transaction_volume_24h,
      unique_users_24h
    ) VALUES (
      CURRENT_DATE,
      ${state.grainSupply},
      ${state.usdcBacking},
      ${state.backingRatio},
      ${state.assetVaultValue},
      ${grainValue.value},
      0,
      1.0,
      ${parseFloat(escrowResult.rows[0]?.escrow_total || 0)},
      ${parseInt(stats.tx_count)},
      ${parseFloat(stats.tx_volume)},
      ${parseInt(stats.unique_users)}
    )
    ON CONFLICT (snapshot_date) DO UPDATE SET
      total_grain_supply = EXCLUDED.total_grain_supply,
      total_usdc_backing = EXCLUDED.total_usdc_backing,
      backing_ratio = EXCLUDED.backing_ratio,
      asset_vault_value = EXCLUDED.asset_vault_value,
      grain_value = EXCLUDED.grain_value,
      active_escrow_amount = EXCLUDED.active_escrow_amount,
      transaction_count_24h = EXCLUDED.transaction_count_24h,
      transaction_volume_24h = EXCLUDED.transaction_volume_24h,
      unique_users_24h = EXCLUDED.unique_users_24h
  `
}

// ============================================================================
// FLOAT-AWARE TREASURY STATE
// ============================================================================

/**
 * Get the full treasury state including float allocation, yield projections,
 * and liquidity analysis.
 *
 * This is the comprehensive view used for dashboards and reporting.
 */
export async function getFloatTreasuryState(annualVolume: number): Promise<{
  treasury: TreasuryState
  float: FloatSnapshot
  allocation: AllocationState
  yield: YieldProjection
  liquidity: LiquidityAnalysis
}> {
  const treasury = await getTreasuryState()
  const float = calculateFloat(annualVolume)
  const targets = calculateTargetAllocation(float.totalFloat)

  // Get actual allocation from database (or default to target for now)
  // In production, this would read from grain_float_allocations table
  const actualAllocation = {
    foundation: targets.foundation,
    cashAndTips: targets.cashAndTips,
    preciousMetals: targets.preciousMetals,
    treasuries: targets.treasuries,
  }

  const allocation = getAllocationState(float.totalFloat, actualAllocation)
  const yieldProjection = projectYield(float.totalFloat)
  const liquidity = analyzeLiquidity(
    float.totalFloat,
    float.dailyVolume,
    actualAllocation.cashAndTips
  )

  return {
    treasury,
    float,
    allocation,
    yield: yieldProjection,
    liquidity,
  }
}

/**
 * Process an incoming deposit through the float allocation engine.
 * Splits the deposit according to 1/33/33/33 and routes to appropriate tranches.
 */
export async function processFloatDeposit(
  amount: number,
  circleTransferId: string
): Promise<{
  allocation: ReturnType<typeof allocateDeposit>
  treasuryEvent: string
}> {
  // Record the USDC deposit
  await recordUsdcDeposit(amount, circleTransferId)

  // Allocate according to reserve model
  const allocation = allocateDeposit(amount)

  // Record allocation event
  await sql`
    INSERT INTO grain_treasury_events (
      type, amount, circle_transfer_id, notes, created_at
    ) VALUES (
      'float_allocation', ${amount}, ${circleTransferId},
      ${'Allocated: Foundation=' + allocation.foundation.toFixed(2) +
        ' Cash/TIPS=' + allocation.cashAndTips.toFixed(2) +
        ' Metals=' + allocation.preciousMetals.toFixed(2) +
        ' Treasuries=' + allocation.treasuries.toFixed(2)},
      NOW()
    )
  `

  return {
    allocation,
    treasuryEvent: 'float_allocation',
  }
}

/**
 * Process a settlement withdrawal through the liquidity waterfall.
 * Draws from the lowest-yield tranches first to maximize overall yield.
 */
export async function processFloatWithdrawal(
  amount: number,
  circleTransferId: string,
  currentHoldings: {
    instantCash: number
    overnightRepo: number
    shortTips: number
    treasuries: number
    preciousMetals: number
  }
): Promise<{
  allowed: boolean
  reason?: string
  waterfall?: ReturnType<typeof calculateWithdrawalWaterfall>
}> {
  // First check 1:1 backing rule
  const backingCheck = await recordUsdcWithdrawal(amount, circleTransferId)
  if (!backingCheck.allowed) {
    return backingCheck
  }

  // Calculate optimal withdrawal waterfall
  const waterfall = calculateWithdrawalWaterfall(amount, currentHoldings)

  if (waterfall.remainingDeficit > 0) {
    return {
      allowed: false,
      reason: `Insufficient liquid assets. Deficit: $${waterfall.remainingDeficit.toFixed(2)}`,
    }
  }

  return {
    allowed: true,
    waterfall,
  }
}

// ============================================================================
// PUBLIC AUDIT ENDPOINT DATA
// ============================================================================

/**
 * Get public-facing treasury audit data
 * This can be exposed via API for transparency
 */
export async function getPublicAuditData(): Promise<{
  grainValue: number
  totalBacking: number
  backingRatio: number
  assetBreakdown: Array<{
    type: string
    value: number
    percentage: number
  }>
  lastUpdated: Date
  onChainVerification: string[]
}> {
  const state = await getTreasuryState()
  const grainValue = await calculateGrainValue()
  const assets = await getAssetHoldings()

  const totalBacking = state.usdcBacking + state.assetVaultValue

  // Group assets by type
  const assetsByType: Record<string, number> = {}
  assets.forEach(asset => {
    assetsByType[asset.type] = (assetsByType[asset.type] || 0) + asset.currentValue
  })

  const assetBreakdown = [
    { type: 'usdc', value: state.usdcBacking, percentage: (state.usdcBacking / totalBacking) * 100 },
    ...Object.entries(assetsByType).map(([type, value]) => ({
      type,
      value,
      percentage: (value / totalBacking) * 100,
    })),
  ]

  // Get on-chain addresses for verification
  const onChainVerification = assets
    .filter(a => a.onChainAddress)
    .map(a => `${a.blockchain}:${a.onChainAddress}`)

  return {
    grainValue: grainValue.value,
    totalBacking,
    backingRatio: state.backingRatio,
    assetBreakdown,
    lastUpdated: new Date(),
    onChainVerification,
  }
}
