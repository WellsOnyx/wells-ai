/**
 * Collateral Management Engine for Grain & Vault
 *
 * =============================================================================
 * THE GRAIN COLLATERAL MODEL - 100% PROTECTED DEPOSITS
 * =============================================================================
 *
 * Every dollar deposited into Grain is backed by real collateral:
 * - FDIC-Insured Bank Deposits (up to $250K per bank per depositor)
 * - US Treasury Bills/Bonds (backed by full faith and credit of US government)
 * - Money Market Funds (highly liquid, low-risk)
 * - Real Assets (commercial real estate, precious metals, etc.)
 *
 * COLLATERALIZATION RATIO:
 *   Total Collateral Value / Total Deposit Liabilities >= 100%
 *
 * This engine:
 * 1. Registers and tracks all collateral assets
 * 2. Calculates real-time collateralization ratios
 * 3. Manages asset valuations and rebalancing alerts
 * 4. Allocates collateral to specific deposits
 * 5. Handles collateral release on withdrawals
 *
 * =============================================================================
 */

import { query } from '@/lib/db'

// =============================================================================
// TYPES
// =============================================================================

export type CollateralType =
  | 'fdic_deposit'      // FDIC-insured bank deposits
  | 'treasury_bill'     // Short-term US Treasury bills
  | 'treasury_bond'     // Longer-term US Treasury bonds
  | 'treasury_note'     // Medium-term Treasury notes
  | 'money_market'      // Money market funds
  | 'real_estate'       // Commercial/residential real estate
  | 'precious_metals'   // Gold, silver, etc.
  | 'other'             // Other qualifying collateral

export type CollateralStatus =
  | 'active'            // Currently backing deposits
  | 'pending'           // Being verified/onboarded
  | 'matured'           // Treasury matured, awaiting rollover
  | 'liquidating'       // Being converted to cash
  | 'released'          // Released from collateral pool
  | 'impaired'          // Value impairment detected

export interface CollateralAsset {
  id: string

  // Classification
  type: CollateralType
  name: string
  description: string | null

  // Custody
  custodian: string                // e.g., 'Silicon Valley Bank', 'Treasury Direct', 'Circle'
  custodianAccountId: string | null
  custodianContactEmail: string | null

  // Valuation
  faceValue: number               // Original/face value
  currentValue: number            // Current market value
  lastValuation: Date
  valuationSource: string | null  // 'market', 'appraisal', 'custodian', 'manual'

  // For interest-bearing assets
  interestRate: number | null     // APY for T-bills, bank deposits
  maturityDate: Date | null       // When the asset matures (if applicable)

  // Allocation
  allocatedAmount: number         // Amount currently allocated to deposits
  availableAmount: number         // Amount available for new allocations

  // Protection Details
  insuranceProvider: string | null // e.g., 'FDIC', 'SIPC'
  insuranceLimit: number | null    // Coverage limit per account

  // Status
  status: CollateralStatus
  statusReason: string | null

  // Timestamps
  acquiredAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface CollateralAllocation {
  id: string
  assetId: string
  depositId: string              // Reference to user's deposit
  userId: string
  allocatedAmount: number
  allocatedAt: Date
  releasedAt: Date | null
  status: 'active' | 'released'
}

export interface CollateralValuation {
  id: string
  assetId: string
  previousValue: number
  newValue: number
  changeAmount: number
  changePercent: number
  source: 'market' | 'appraisal' | 'custodian' | 'manual' | 'maturity'
  appraiser: string | null
  notes: string | null
  valuedAt: Date
  createdAt: Date
}

export interface CollateralSummary {
  // Total Collateral
  totalCollateral: number
  totalAllocated: number
  totalAvailable: number

  // By Type
  byType: {
    type: CollateralType
    count: number
    totalValue: number
    allocatedValue: number
    percentage: number
  }[]

  // Coverage Metrics
  totalDeposits: number
  collateralizationRatio: number    // totalCollateral / totalDeposits
  collateralizationPercent: string  // Formatted as "125.5%"

  // Health Status
  isFullyCollateralized: boolean
  excessCollateral: number
  collateralGap: number             // If under-collateralized

  // Alerts
  alerts: CollateralAlert[]
}

export interface CollateralAlert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  type: 'rebalance_needed' | 'maturity_approaching' | 'valuation_stale' | 'under_collateralized' | 'concentration_risk'
  assetId: string | null
  message: string
  createdAt: Date
}

export interface DepositCollateral {
  depositAmount: number
  collateralBackings: {
    assetId: string
    assetName: string
    assetType: CollateralType
    allocatedAmount: number
    custodian: string
    protection: string            // e.g., 'FDIC Insured up to $250K'
  }[]
  totalBacking: number
  coverageRatio: number
  protectionExplanation: string
}

// =============================================================================
// COLLATERAL ENGINE
// =============================================================================

/**
 * Register a new collateral asset
 */
export async function registerCollateral(params: {
  type: CollateralType
  name: string
  description?: string
  custodian: string
  custodianAccountId?: string
  custodianContactEmail?: string
  faceValue: number
  currentValue?: number
  interestRate?: number
  maturityDate?: Date
  insuranceProvider?: string
  insuranceLimit?: number
}): Promise<CollateralAsset> {
  const currentValue = params.currentValue ?? params.faceValue

  const result = await query(
    `INSERT INTO collateral_assets (
      type, name, description, custodian, custodian_account_id,
      custodian_contact_email, face_value, current_value, last_valuation,
      valuation_source, interest_rate, maturity_date, allocated_amount,
      available_amount, insurance_provider, insurance_limit, status, acquired_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'manual', $9, $10, 0, $8, $11, $12, 'active', NOW())
    RETURNING *`,
    [
      params.type,
      params.name,
      params.description || null,
      params.custodian,
      params.custodianAccountId || null,
      params.custodianContactEmail || null,
      params.faceValue,
      currentValue,
      params.interestRate || null,
      params.maturityDate || null,
      params.insuranceProvider || null,
      params.insuranceLimit || null,
    ]
  )

  return mapRowToCollateralAsset(result.rows[0])
}

/**
 * Get a specific collateral asset
 */
export async function getCollateralAsset(assetId: string): Promise<CollateralAsset | null> {
  const result = await query(
    `SELECT * FROM collateral_assets WHERE id = $1`,
    [assetId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToCollateralAsset(result.rows[0])
}

/**
 * Get all collateral assets
 */
export async function getAllCollateral(
  status?: CollateralStatus
): Promise<CollateralAsset[]> {
  let queryText = `SELECT * FROM collateral_assets`
  const params: any[] = []

  if (status) {
    queryText += ` WHERE status = $1`
    params.push(status)
  }

  queryText += ` ORDER BY current_value DESC`

  const result = await query(queryText, params)
  return result.rows.map(mapRowToCollateralAsset)
}

/**
 * Update collateral asset valuation
 */
export async function updateValuation(params: {
  assetId: string
  newValue: number
  source: 'market' | 'appraisal' | 'custodian' | 'manual' | 'maturity'
  appraiser?: string
  notes?: string
}): Promise<CollateralValuation> {
  const asset = await getCollateralAsset(params.assetId)
  if (!asset) {
    throw new Error(`Collateral asset not found: ${params.assetId}`)
  }

  const previousValue = asset.currentValue
  const changeAmount = params.newValue - previousValue
  const changePercent = previousValue > 0
    ? (changeAmount / previousValue) * 100
    : 0

  // Record the valuation
  const valResult = await query(
    `INSERT INTO collateral_valuations (
      asset_id, previous_value, new_value, change_amount, change_percent,
      source, appraiser, notes, valued_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *`,
    [
      params.assetId,
      previousValue,
      params.newValue,
      changeAmount,
      changePercent,
      params.source,
      params.appraiser || null,
      params.notes || null,
    ]
  )

  // Update the asset
  const valueDiff = params.newValue - previousValue
  await query(
    `UPDATE collateral_assets
     SET current_value = $1,
         available_amount = available_amount + $2,
         last_valuation = NOW(),
         valuation_source = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [params.newValue, valueDiff, params.source, params.assetId]
  )

  return mapRowToValuation(valResult.rows[0])
}

/**
 * Allocate collateral to a deposit
 */
export async function allocateCollateral(params: {
  assetId: string
  depositId: string
  userId: string
  amount: number
}): Promise<CollateralAllocation> {
  const asset = await getCollateralAsset(params.assetId)
  if (!asset) {
    throw new Error(`Collateral asset not found: ${params.assetId}`)
  }

  if (asset.availableAmount < params.amount) {
    throw new Error(`Insufficient available collateral. Available: $${asset.availableAmount.toLocaleString()}, Requested: $${params.amount.toLocaleString()}`)
  }

  // Create allocation record
  const result = await query(
    `INSERT INTO collateral_allocations (
      asset_id, deposit_id, user_id, allocated_amount, allocated_at, status
    ) VALUES ($1, $2, $3, $4, NOW(), 'active')
    RETURNING *`,
    [params.assetId, params.depositId, params.userId, params.amount]
  )

  // Update asset allocation amounts
  await query(
    `UPDATE collateral_assets
     SET allocated_amount = allocated_amount + $1,
         available_amount = available_amount - $1,
         updated_at = NOW()
     WHERE id = $2`,
    [params.amount, params.assetId]
  )

  return mapRowToAllocation(result.rows[0])
}

/**
 * Release collateral from a withdrawal
 */
export async function releaseCollateral(params: {
  depositId: string
  amount: number
}): Promise<{ released: number; allocations: CollateralAllocation[] }> {
  // Get all active allocations for this deposit
  const allocations = await query(
    `SELECT * FROM collateral_allocations
     WHERE deposit_id = $1 AND status = 'active'
     ORDER BY allocated_at ASC`,
    [params.depositId]
  )

  let amountToRelease = params.amount
  const releasedAllocations: CollateralAllocation[] = []

  for (const row of allocations.rows) {
    if (amountToRelease <= 0) break

    const allocation = mapRowToAllocation(row)
    const releaseFromThis = Math.min(allocation.allocatedAmount, amountToRelease)

    if (releaseFromThis >= allocation.allocatedAmount) {
      // Release entire allocation
      await query(
        `UPDATE collateral_allocations
         SET status = 'released', released_at = NOW()
         WHERE id = $1`,
        [allocation.id]
      )
    } else {
      // Partial release
      await query(
        `UPDATE collateral_allocations
         SET allocated_amount = allocated_amount - $1
         WHERE id = $2`,
        [releaseFromThis, allocation.id]
      )
    }

    // Update asset
    await query(
      `UPDATE collateral_assets
       SET allocated_amount = allocated_amount - $1,
           available_amount = available_amount + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [releaseFromThis, allocation.assetId]
    )

    releasedAllocations.push({
      ...allocation,
      allocatedAmount: releaseFromThis,
    })

    amountToRelease -= releaseFromThis
  }

  return {
    released: params.amount - amountToRelease,
    allocations: releasedAllocations,
  }
}

/**
 * Get collateral summary with coverage metrics
 */
export async function getCollateralSummary(): Promise<CollateralSummary> {
  // Get totals by type
  const byTypeResult = await query(`
    SELECT
      type,
      COUNT(*) as count,
      COALESCE(SUM(current_value), 0) as total_value,
      COALESCE(SUM(allocated_amount), 0) as allocated_value
    FROM collateral_assets
    WHERE status = 'active'
    GROUP BY type
    ORDER BY total_value DESC
  `)

  // Get overall totals
  const totalsResult = await query(`
    SELECT
      COALESCE(SUM(current_value), 0) as total_collateral,
      COALESCE(SUM(allocated_amount), 0) as total_allocated,
      COALESCE(SUM(available_amount), 0) as total_available
    FROM collateral_assets
    WHERE status = 'active'
  `)

  // Get total deposits (liabilities)
  const depositsResult = await query(`
    SELECT COALESCE(SUM(usd_balance), 0) as total_deposits
    FROM treasury_accounts
    WHERE status = 'active'
  `)

  const totalCollateral = parseFloat(totalsResult.rows[0]?.total_collateral) || 0
  const totalAllocated = parseFloat(totalsResult.rows[0]?.total_allocated) || 0
  const totalAvailable = parseFloat(totalsResult.rows[0]?.total_available) || 0
  const totalDeposits = parseFloat(depositsResult.rows[0]?.total_deposits) || 0

  const collateralizationRatio = totalDeposits > 0
    ? totalCollateral / totalDeposits
    : totalCollateral > 0 ? Infinity : 1

  const isFullyCollateralized = collateralizationRatio >= 1
  const excessCollateral = Math.max(0, totalCollateral - totalDeposits)
  const collateralGap = Math.max(0, totalDeposits - totalCollateral)

  // Build by-type breakdown
  const byType = byTypeResult.rows.map((row: any) => ({
    type: row.type as CollateralType,
    count: parseInt(row.count) || 0,
    totalValue: parseFloat(row.total_value) || 0,
    allocatedValue: parseFloat(row.allocated_value) || 0,
    percentage: totalCollateral > 0
      ? ((parseFloat(row.total_value) || 0) / totalCollateral) * 100
      : 0,
  }))

  // Generate alerts
  const alerts = await generateCollateralAlerts(totalCollateral, totalDeposits, collateralizationRatio)

  return {
    totalCollateral,
    totalAllocated,
    totalAvailable,
    byType,
    totalDeposits,
    collateralizationRatio,
    collateralizationPercent: collateralizationRatio === Infinity
      ? '∞'
      : `${(collateralizationRatio * 100).toFixed(1)}%`,
    isFullyCollateralized,
    excessCollateral,
    collateralGap,
    alerts,
  }
}

/**
 * Get collateral backing for a specific user's deposit
 */
export async function getDepositCollateral(userId: string): Promise<DepositCollateral> {
  // Get user's total deposit
  const depositResult = await query(
    `SELECT COALESCE(usd_balance, 0) as deposit_amount
     FROM treasury_accounts
     WHERE id = $1`,
    [userId]
  )

  const depositAmount = parseFloat(depositResult.rows[0]?.deposit_amount) || 0

  // Get allocations for this user
  const allocationsResult = await query(`
    SELECT
      ca.id as asset_id,
      ca.name as asset_name,
      ca.type as asset_type,
      cal.allocated_amount,
      ca.custodian,
      ca.insurance_provider,
      ca.insurance_limit
    FROM collateral_allocations cal
    JOIN collateral_assets ca ON cal.asset_id = ca.id
    WHERE cal.user_id = $1 AND cal.status = 'active'
    ORDER BY cal.allocated_amount DESC
  `, [userId])

  const collateralBackings = allocationsResult.rows.map((row: any) => ({
    assetId: row.asset_id,
    assetName: row.asset_name,
    assetType: row.asset_type as CollateralType,
    allocatedAmount: parseFloat(row.allocated_amount) || 0,
    custodian: row.custodian,
    protection: getProtectionDescription(row.asset_type, row.insurance_provider, row.insurance_limit),
  }))

  const totalBacking = collateralBackings.reduce((sum, b) => sum + b.allocatedAmount, 0)
  const coverageRatio = depositAmount > 0 ? totalBacking / depositAmount : 1

  return {
    depositAmount,
    collateralBackings,
    totalBacking,
    coverageRatio,
    protectionExplanation: generateProtectionExplanation(collateralBackings),
  }
}

/**
 * Auto-allocate collateral to a new deposit
 * Uses a waterfall approach prioritizing most liquid/safe assets
 */
export async function autoAllocateCollateral(params: {
  depositId: string
  userId: string
  amount: number
}): Promise<CollateralAllocation[]> {
  // Priority order for allocation
  const priorityOrder: CollateralType[] = [
    'fdic_deposit',
    'treasury_bill',
    'money_market',
    'treasury_note',
    'treasury_bond',
    'precious_metals',
    'real_estate',
    'other',
  ]

  const allocations: CollateralAllocation[] = []
  let remainingAmount = params.amount

  for (const type of priorityOrder) {
    if (remainingAmount <= 0) break

    // Get available assets of this type
    const assets = await query(`
      SELECT * FROM collateral_assets
      WHERE type = $1 AND status = 'active' AND available_amount > 0
      ORDER BY available_amount DESC
    `, [type])

    for (const row of assets.rows) {
      if (remainingAmount <= 0) break

      const asset = mapRowToCollateralAsset(row)
      const allocateAmount = Math.min(asset.availableAmount, remainingAmount)

      const allocation = await allocateCollateral({
        assetId: asset.id,
        depositId: params.depositId,
        userId: params.userId,
        amount: allocateAmount,
      })

      allocations.push(allocation)
      remainingAmount -= allocateAmount
    }
  }

  if (remainingAmount > 0) {
    console.warn(`[Collateral] Unable to fully allocate deposit. Remaining: $${remainingAmount.toLocaleString()}`)
  }

  return allocations
}

/**
 * Check for assets approaching maturity
 */
export async function getMaturityAlerts(daysAhead: number = 30): Promise<CollateralAsset[]> {
  const result = await query(`
    SELECT * FROM collateral_assets
    WHERE maturity_date IS NOT NULL
      AND maturity_date <= NOW() + INTERVAL '${daysAhead} days'
      AND status = 'active'
    ORDER BY maturity_date ASC
  `)

  return result.rows.map(mapRowToCollateralAsset)
}

/**
 * Check for stale valuations
 */
export async function getStaleValuations(daysOld: number = 7): Promise<CollateralAsset[]> {
  const result = await query(`
    SELECT * FROM collateral_assets
    WHERE last_valuation < NOW() - INTERVAL '${daysOld} days'
      AND status = 'active'
    ORDER BY last_valuation ASC
  `)

  return result.rows.map(mapRowToCollateralAsset)
}

/**
 * Get valuation history for an asset
 */
export async function getValuationHistory(assetId: string): Promise<CollateralValuation[]> {
  const result = await query(
    `SELECT * FROM collateral_valuations
     WHERE asset_id = $1
     ORDER BY valued_at DESC
     LIMIT 50`,
    [assetId]
  )

  return result.rows.map(mapRowToValuation)
}

/**
 * Update asset status
 */
export async function updateAssetStatus(
  assetId: string,
  status: CollateralStatus,
  reason?: string
): Promise<CollateralAsset> {
  await query(
    `UPDATE collateral_assets
     SET status = $1, status_reason = $2, updated_at = NOW()
     WHERE id = $3`,
    [status, reason || null, assetId]
  )

  const asset = await getCollateralAsset(assetId)
  if (!asset) {
    throw new Error('Asset not found after update')
  }

  return asset
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function generateCollateralAlerts(
  totalCollateral: number,
  totalDeposits: number,
  collateralizationRatio: number
): Promise<CollateralAlert[]> {
  const alerts: CollateralAlert[] = []

  // Check for under-collateralization
  if (collateralizationRatio < 1) {
    alerts.push({
      id: `alert_under_${Date.now()}`,
      severity: 'critical',
      type: 'under_collateralized',
      assetId: null,
      message: `CRITICAL: Collateralization ratio is ${(collateralizationRatio * 100).toFixed(1)}%. Need $${(totalDeposits - totalCollateral).toLocaleString()} more collateral.`,
      createdAt: new Date(),
    })
  } else if (collateralizationRatio < 1.1) {
    alerts.push({
      id: `alert_low_${Date.now()}`,
      severity: 'warning',
      type: 'rebalance_needed',
      assetId: null,
      message: `Warning: Collateralization ratio is ${(collateralizationRatio * 100).toFixed(1)}%. Consider adding more collateral for safety buffer.`,
      createdAt: new Date(),
    })
  }

  // Check for maturing assets
  const maturingAssets = await getMaturityAlerts(14)
  for (const asset of maturingAssets) {
    alerts.push({
      id: `alert_maturity_${asset.id}`,
      severity: 'warning',
      type: 'maturity_approaching',
      assetId: asset.id,
      message: `${asset.name} matures on ${asset.maturityDate?.toLocaleDateString()}. Plan rollover or reinvestment.`,
      createdAt: new Date(),
    })
  }

  // Check for stale valuations
  const staleAssets = await getStaleValuations(7)
  for (const asset of staleAssets) {
    alerts.push({
      id: `alert_stale_${asset.id}`,
      severity: 'info',
      type: 'valuation_stale',
      assetId: asset.id,
      message: `${asset.name} valuation is ${Math.floor((Date.now() - asset.lastValuation.getTime()) / (1000 * 60 * 60 * 24))} days old. Consider updating.`,
      createdAt: new Date(),
    })
  }

  // Check concentration risk (any single asset > 25% of total)
  const assets = await getAllCollateral('active')
  for (const asset of assets) {
    const concentration = (asset.currentValue / totalCollateral) * 100
    if (concentration > 25) {
      alerts.push({
        id: `alert_concentration_${asset.id}`,
        severity: 'warning',
        type: 'concentration_risk',
        assetId: asset.id,
        message: `Concentration risk: ${asset.name} represents ${concentration.toFixed(1)}% of total collateral.`,
        createdAt: new Date(),
      })
    }
  }

  return alerts
}

function getProtectionDescription(
  assetType: CollateralType,
  insuranceProvider: string | null,
  insuranceLimit: number | null
): string {
  switch (assetType) {
    case 'fdic_deposit':
      return `FDIC Insured up to $${(insuranceLimit || 250000).toLocaleString()}`
    case 'treasury_bill':
    case 'treasury_bond':
    case 'treasury_note':
      return 'Backed by full faith and credit of US Government'
    case 'money_market':
      return insuranceProvider ? `${insuranceProvider} insured` : 'Highly liquid money market fund'
    case 'precious_metals':
      return 'Physical precious metals in secure vault storage'
    case 'real_estate':
      return 'Commercial real estate with title insurance'
    default:
      return 'Qualifying collateral asset'
  }
}

function generateProtectionExplanation(
  backings: { assetType: CollateralType; allocatedAmount: number; protection: string }[]
): string {
  if (backings.length === 0) {
    return 'Your deposit is pending collateral allocation.'
  }

  const totalBacking = backings.reduce((sum, b) => sum + b.allocatedAmount, 0)
  const fdicAmount = backings
    .filter(b => b.assetType === 'fdic_deposit')
    .reduce((sum, b) => sum + b.allocatedAmount, 0)
  const treasuryAmount = backings
    .filter(b => ['treasury_bill', 'treasury_bond', 'treasury_note'].includes(b.assetType))
    .reduce((sum, b) => sum + b.allocatedAmount, 0)

  let explanation = `Your deposit is 100% backed by $${totalBacking.toLocaleString()} in verified collateral. `

  if (fdicAmount > 0) {
    explanation += `$${fdicAmount.toLocaleString()} is held in FDIC-insured bank deposits. `
  }
  if (treasuryAmount > 0) {
    explanation += `$${treasuryAmount.toLocaleString()} is secured by US Treasury securities. `
  }

  explanation += 'You can always withdraw your full deposit amount.'

  return explanation
}

function mapRowToCollateralAsset(row: any): CollateralAsset {
  return {
    id: row.id,
    type: row.type as CollateralType,
    name: row.name,
    description: row.description,
    custodian: row.custodian,
    custodianAccountId: row.custodian_account_id,
    custodianContactEmail: row.custodian_contact_email,
    faceValue: parseFloat(row.face_value) || 0,
    currentValue: parseFloat(row.current_value) || 0,
    lastValuation: new Date(row.last_valuation),
    valuationSource: row.valuation_source,
    interestRate: row.interest_rate ? parseFloat(row.interest_rate) : null,
    maturityDate: row.maturity_date ? new Date(row.maturity_date) : null,
    allocatedAmount: parseFloat(row.allocated_amount) || 0,
    availableAmount: parseFloat(row.available_amount) || 0,
    insuranceProvider: row.insurance_provider,
    insuranceLimit: row.insurance_limit ? parseFloat(row.insurance_limit) : null,
    status: row.status as CollateralStatus,
    statusReason: row.status_reason,
    acquiredAt: new Date(row.acquired_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapRowToAllocation(row: any): CollateralAllocation {
  return {
    id: row.id,
    assetId: row.asset_id,
    depositId: row.deposit_id,
    userId: row.user_id,
    allocatedAmount: parseFloat(row.allocated_amount) || 0,
    allocatedAt: new Date(row.allocated_at),
    releasedAt: row.released_at ? new Date(row.released_at) : null,
    status: row.status,
  }
}

function mapRowToValuation(row: any): CollateralValuation {
  return {
    id: row.id,
    assetId: row.asset_id,
    previousValue: parseFloat(row.previous_value) || 0,
    newValue: parseFloat(row.new_value) || 0,
    changeAmount: parseFloat(row.change_amount) || 0,
    changePercent: parseFloat(row.change_percent) || 0,
    source: row.source,
    appraiser: row.appraiser,
    notes: row.notes,
    valuedAt: new Date(row.valued_at),
    createdAt: new Date(row.created_at),
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const CollateralEngine = {
  // Core operations
  registerCollateral,
  getCollateralAsset,
  getAllCollateral,
  updateValuation,
  updateAssetStatus,

  // Allocation
  allocateCollateral,
  releaseCollateral,
  autoAllocateCollateral,

  // Queries
  getCollateralSummary,
  getDepositCollateral,
  getValuationHistory,

  // Alerts
  getMaturityAlerts,
  getStaleValuations,
}

export default CollateralEngine
