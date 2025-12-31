/**
 * Real Asset Registry
 *
 * Tracks analog/physical assets owned by Grain:
 * - Commercial Real Estate
 * - Precious Metals
 * - Bonds
 * - Other Investments
 *
 * These assets:
 * 1. Contribute to equity value (backing GRAIN price)
 * 2. Generate income (rent, dividends, interest)
 * 3. Income flows through standard revenue allocation
 *
 * All tracked on Vault's chain for full transparency.
 */

import { query } from '@/lib/db'
import { allocateFloatYield } from './revenue-allocation'

// ============================================================================
// TYPES
// ============================================================================

export type AssetType =
  | 'commercial_real_estate'
  | 'precious_metals'
  | 'bonds'
  | 'other'

export type AssetStatus = 'active' | 'pending' | 'sold' | 'impaired'

export interface RealAsset {
  id: string

  // Identification
  assetType: AssetType
  name: string
  description: string | null
  legalEntity: string | null
  externalId: string | null

  // Valuation
  acquisitionCost: number
  acquisitionDate: Date
  currentValuation: number
  lastAppraisalDate: Date | null
  appraisalSource: string | null

  // Income
  monthlyIncome: number
  incomeStartDate: Date | null

  // Vault Integration
  equityContribution: number
  linkedTransactionId: string | null

  // Status
  status: AssetStatus

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface AssetValuation {
  id: string
  assetId: string
  previousValue: number
  newValue: number
  changeAmount: number
  source: 'appraisal' | 'market' | 'manual' | 'impairment'
  appraiser: string | null
  notes: string | null
  supportingDocumentId: string | null
  createdAt: Date
}

export interface AssetDocument {
  id: string
  assetId: string
  documentType: 'deed' | 'appraisal' | 'contract' | 'insurance' | 'other'
  fileName: string
  fileUrl: string
  fileHash: string | null
  fileSizeBytes: number | null
  description: string | null
  uploadedAt: Date
}

export interface AssetIncome {
  id: string
  assetId: string
  incomeType: 'rent' | 'dividend' | 'interest' | 'other'
  amount: number
  periodStart: Date
  periodEnd: Date
  allocationId: string | null
  notes: string | null
  createdAt: Date
}

export interface AssetSummary {
  assetType: AssetType
  assetCount: number
  totalAcquisitionCost: number
  totalCurrentValue: number
  totalUnrealizedGain: number
  totalMonthlyIncome: number
  totalEquityContribution: number
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Register a new real asset
 */
export async function registerAsset(params: {
  assetType: AssetType
  name: string
  description?: string
  legalEntity?: string
  externalId?: string
  acquisitionCost: number
  acquisitionDate: Date
  currentValuation?: number
  monthlyIncome?: number
  incomeStartDate?: Date
  linkedTransactionId?: string
}): Promise<RealAsset> {
  const currentValuation = params.currentValuation || params.acquisitionCost
  const equityContribution = currentValuation

  const result = await query(
    `INSERT INTO real_assets (
      asset_type, name, description, legal_entity, external_id,
      acquisition_cost, acquisition_date, current_valuation,
      monthly_income, income_start_date,
      equity_contribution, linked_transaction_id, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
    RETURNING *`,
    [
      params.assetType,
      params.name,
      params.description || null,
      params.legalEntity || null,
      params.externalId || null,
      params.acquisitionCost,
      params.acquisitionDate,
      currentValuation,
      params.monthlyIncome || 0,
      params.incomeStartDate || null,
      equityContribution,
      params.linkedTransactionId || null,
    ]
  )

  const asset = mapRowToAsset(result.rows[0])

  // Update treasury equity value
  await updateTreasuryEquity(equityContribution, 'add')

  return asset
}

/**
 * Get asset by ID
 */
export async function getAsset(assetId: string): Promise<RealAsset | null> {
  const result = await query(`SELECT * FROM real_assets WHERE id = $1`, [
    assetId,
  ])

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToAsset(result.rows[0])
}

/**
 * Get all assets
 */
export async function getAllAssets(
  status?: AssetStatus
): Promise<RealAsset[]> {
  let queryText = `SELECT * FROM real_assets`
  const params: any[] = []

  if (status) {
    queryText += ` WHERE status = $1`
    params.push(status)
  }

  queryText += ` ORDER BY current_valuation DESC`

  const result = await query(queryText, params)
  return result.rows.map(mapRowToAsset)
}

/**
 * Get asset summary by type
 */
export async function getAssetSummary(): Promise<AssetSummary[]> {
  const result = await query(`SELECT * FROM real_asset_summary`)

  return result.rows.map((row) => ({
    assetType: row.asset_type as AssetType,
    assetCount: parseInt(row.asset_count) || 0,
    totalAcquisitionCost: parseFloat(row.total_acquisition_cost) || 0,
    totalCurrentValue: parseFloat(row.total_current_value) || 0,
    totalUnrealizedGain: parseFloat(row.total_unrealized_gain) || 0,
    totalMonthlyIncome: parseFloat(row.total_monthly_income) || 0,
    totalEquityContribution: parseFloat(row.total_equity_contribution) || 0,
  }))
}

/**
 * Update asset valuation
 */
export async function updateValuation(params: {
  assetId: string
  newValue: number
  source: 'appraisal' | 'market' | 'manual' | 'impairment'
  appraiser?: string
  notes?: string
  supportingDocumentId?: string
}): Promise<AssetValuation> {
  const asset = await getAsset(params.assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${params.assetId}`)
  }

  const previousValue = asset.currentValuation
  const changeAmount = params.newValue - previousValue

  // Record valuation change
  const valResult = await query(
    `INSERT INTO asset_valuations (
      asset_id, previous_value, new_value, change_amount,
      source, appraiser, notes, supporting_document_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      params.assetId,
      previousValue,
      params.newValue,
      changeAmount,
      params.source,
      params.appraiser || null,
      params.notes || null,
      params.supportingDocumentId || null,
    ]
  )

  // Update asset
  await query(
    `UPDATE real_assets
     SET current_valuation = $1,
         last_appraisal_date = NOW(),
         appraisal_source = $2,
         equity_contribution = $1,
         status = CASE WHEN $3 = 'impairment' THEN 'impaired' ELSE status END
     WHERE id = $4`,
    [params.newValue, params.appraiser || params.source, params.source, params.assetId]
  )

  // Update treasury equity value
  await updateTreasuryEquity(changeAmount, 'adjust')

  return mapRowToValuation(valResult.rows[0])
}

/**
 * Record asset income
 * Income flows through standard revenue allocation (treated like float yield)
 */
export async function recordIncome(params: {
  assetId: string
  incomeType: 'rent' | 'dividend' | 'interest' | 'other'
  amount: number
  periodStart: Date
  periodEnd: Date
  notes?: string
}): Promise<AssetIncome> {
  const asset = await getAsset(params.assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${params.assetId}`)
  }

  // Get current GRAIN price for allocation
  const priceResult = await query(
    `SELECT calc_grain_price FROM vault_treasury LIMIT 1`
  )
  const grainPrice = parseFloat(priceResult.rows[0]?.calc_grain_price) || 1

  // Allocate income through float yield allocation
  // This ensures 30% goes to liquidity/treasury (GRAIN appreciation)
  const allocationResult = await allocateFloatYield(
    params.amount,
    undefined,
    grainPrice
  )

  // Record income
  const result = await query(
    `INSERT INTO asset_income (
      asset_id, income_type, amount, period_start, period_end,
      allocation_id, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      params.assetId,
      params.incomeType,
      params.amount,
      params.periodStart,
      params.periodEnd,
      allocationResult.allocationId,
      params.notes || null,
    ]
  )

  return mapRowToIncome(result.rows[0])
}

/**
 * Upload document for asset
 */
export async function uploadDocument(params: {
  assetId: string
  documentType: 'deed' | 'appraisal' | 'contract' | 'insurance' | 'other'
  fileName: string
  fileUrl: string
  fileHash?: string
  fileSizeBytes?: number
  description?: string
}): Promise<AssetDocument> {
  const result = await query(
    `INSERT INTO asset_documents (
      asset_id, document_type, file_name, file_url,
      file_hash, file_size_bytes, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      params.assetId,
      params.documentType,
      params.fileName,
      params.fileUrl,
      params.fileHash || null,
      params.fileSizeBytes || null,
      params.description || null,
    ]
  )

  return mapRowToDocument(result.rows[0])
}

/**
 * Get documents for asset
 */
export async function getAssetDocuments(
  assetId: string
): Promise<AssetDocument[]> {
  const result = await query(
    `SELECT * FROM asset_documents WHERE asset_id = $1 ORDER BY uploaded_at DESC`,
    [assetId]
  )

  return result.rows.map(mapRowToDocument)
}

/**
 * Get valuation history for asset
 */
export async function getValuationHistory(
  assetId: string
): Promise<AssetValuation[]> {
  const result = await query(
    `SELECT * FROM asset_valuations WHERE asset_id = $1 ORDER BY created_at DESC`,
    [assetId]
  )

  return result.rows.map(mapRowToValuation)
}

/**
 * Get income history for asset
 */
export async function getIncomeHistory(
  assetId: string
): Promise<AssetIncome[]> {
  const result = await query(
    `SELECT * FROM asset_income WHERE asset_id = $1 ORDER BY period_end DESC`,
    [assetId]
  )

  return result.rows.map(mapRowToIncome)
}

/**
 * Mark asset as sold
 */
export async function markAsSold(
  assetId: string,
  salePrice: number,
  notes?: string
): Promise<RealAsset> {
  const asset = await getAsset(assetId)
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  // Record final valuation
  await updateValuation({
    assetId,
    newValue: salePrice,
    source: 'manual',
    notes: notes || 'Asset sold',
  })

  // Update status
  await query(
    `UPDATE real_assets SET status = 'sold', equity_contribution = 0 WHERE id = $1`,
    [assetId]
  )

  // Remove from treasury equity
  await updateTreasuryEquity(asset.equityContribution, 'remove')

  // The sale proceeds become liquidity
  await query(
    `UPDATE vault_treasury
     SET liquidity_usdc_cash = liquidity_usdc_cash + $1
     WHERE id IS NOT NULL`,
    [salePrice]
  )

  return (await getAsset(assetId))!
}

/**
 * Get total equity contribution from all active assets
 */
export async function getTotalEquityContribution(): Promise<number> {
  const result = await query(
    `SELECT SUM(equity_contribution) as total FROM real_assets WHERE status = 'active'`
  )

  return parseFloat(result.rows[0]?.total) || 0
}

/**
 * Get total monthly income from all active assets
 */
export async function getTotalMonthlyIncome(): Promise<number> {
  const result = await query(
    `SELECT SUM(monthly_income) as total FROM real_assets WHERE status = 'active'`
  )

  return parseFloat(result.rows[0]?.total) || 0
}

// ============================================================================
// TREASURY INTEGRATION
// ============================================================================

async function updateTreasuryEquity(
  amount: number,
  operation: 'add' | 'remove' | 'adjust'
): Promise<void> {
  let sql: string

  switch (operation) {
    case 'add':
      sql = `UPDATE vault_treasury
             SET equity_other_investments = equity_other_investments + $1,
                 calc_equity_value = calc_equity_value + $1
             WHERE id IS NOT NULL`
      break
    case 'remove':
      sql = `UPDATE vault_treasury
             SET equity_other_investments = equity_other_investments - $1,
                 calc_equity_value = calc_equity_value - $1
             WHERE id IS NOT NULL`
      break
    case 'adjust':
      // Amount can be positive or negative
      sql = `UPDATE vault_treasury
             SET equity_other_investments = equity_other_investments + $1,
                 calc_equity_value = calc_equity_value + $1
             WHERE id IS NOT NULL`
      break
  }

  await query(sql, [amount])

  // Recalculate GRAIN price
  await query(`
    UPDATE vault_treasury
    SET calc_grain_price = (calc_usdc_liquidity + calc_equity_value) / NULLIF(grain_supply, 0),
        calc_total_ecosystem_value = calc_usdc_liquidity + calc_equity_value
    WHERE id IS NOT NULL
  `)
}

// ============================================================================
// HELPERS
// ============================================================================

function mapRowToAsset(row: any): RealAsset {
  return {
    id: row.id,
    assetType: row.asset_type as AssetType,
    name: row.name,
    description: row.description,
    legalEntity: row.legal_entity,
    externalId: row.external_id,
    acquisitionCost: parseFloat(row.acquisition_cost) || 0,
    acquisitionDate: new Date(row.acquisition_date),
    currentValuation: parseFloat(row.current_valuation) || 0,
    lastAppraisalDate: row.last_appraisal_date
      ? new Date(row.last_appraisal_date)
      : null,
    appraisalSource: row.appraisal_source,
    monthlyIncome: parseFloat(row.monthly_income) || 0,
    incomeStartDate: row.income_start_date
      ? new Date(row.income_start_date)
      : null,
    equityContribution: parseFloat(row.equity_contribution) || 0,
    linkedTransactionId: row.linked_transaction_id,
    status: row.status as AssetStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapRowToValuation(row: any): AssetValuation {
  return {
    id: row.id,
    assetId: row.asset_id,
    previousValue: parseFloat(row.previous_value) || 0,
    newValue: parseFloat(row.new_value) || 0,
    changeAmount: parseFloat(row.change_amount) || 0,
    source: row.source,
    appraiser: row.appraiser,
    notes: row.notes,
    supportingDocumentId: row.supporting_document_id,
    createdAt: new Date(row.created_at),
  }
}

function mapRowToDocument(row: any): AssetDocument {
  return {
    id: row.id,
    assetId: row.asset_id,
    documentType: row.document_type,
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileHash: row.file_hash,
    fileSizeBytes: row.file_size_bytes,
    description: row.description,
    uploadedAt: new Date(row.uploaded_at),
  }
}

function mapRowToIncome(row: any): AssetIncome {
  return {
    id: row.id,
    assetId: row.asset_id,
    incomeType: row.income_type,
    amount: parseFloat(row.amount) || 0,
    periodStart: new Date(row.period_start),
    periodEnd: new Date(row.period_end),
    allocationId: row.allocation_id,
    notes: row.notes,
    createdAt: new Date(row.created_at),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const RealAssets = {
  // Core operations
  registerAsset,
  getAsset,
  getAllAssets,
  getAssetSummary,
  updateValuation,
  recordIncome,
  markAsSold,

  // Documents
  uploadDocument,
  getAssetDocuments,

  // History
  getValuationHistory,
  getIncomeHistory,

  // Aggregates
  getTotalEquityContribution,
  getTotalMonthlyIncome,
}

export default RealAssets
