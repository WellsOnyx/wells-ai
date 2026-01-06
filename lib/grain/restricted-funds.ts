// @ts-nocheck
/**
 * Restricted Fund Management for Grain & Vault Endowments
 *
 * Supports nonprofit fund accounting with three restriction types:
 * 1. Unrestricted - Can use for anything
 * 2. Temporarily Restricted - Donor-specified purpose, releases over time
 * 3. Permanently Restricted - Principal can never be spent (true endowment)
 */

import { sqlQuery as sql, withTransaction } from '@/lib/db'

// ============================================================================
// TYPES
// ============================================================================

export type RestrictionType =
  | 'unrestricted'
  | 'temporarily_restricted'
  | 'permanently_restricted'

export type FundStatus = 'active' | 'frozen' | 'fully_released' | 'closed'

export type ReleaseSchedule =
  | 'immediate'
  | 'annual'
  | 'quarterly'
  | 'monthly'
  | 'milestone'
  | 'custom'

export type ReleaseType =
  | 'time_based'
  | 'purpose_fulfilled'
  | 'board_approved'
  | 'donor_approved'
  | 'legal_requirement'
  | 'fund_termination'

export type TransactionType =
  | 'initial_gift'
  | 'additional_gift'
  | 'investment_income'
  | 'realized_gain'
  | 'realized_loss'
  | 'appreciation'
  | 'depreciation'
  | 'grant_expense'
  | 'program_expense'
  | 'admin_fee'
  | 'transfer_in'
  | 'transfer_out'
  | 'restriction_release'
  | 'credit_draw'
  | 'credit_repayment'

export interface RestrictedFund {
  id: string
  orgId: string
  name: string
  description?: string
  purpose?: string
  restrictionType: RestrictionType
  donorId?: string
  donorName?: string
  donorAnonymous: boolean
  giftDate?: Date
  giftAgreementUrl?: string
  releaseSchedule?: ReleaseSchedule
  releaseStartDate?: Date
  releaseEndDate?: Date
  releaseAmountPerPeriod?: number
  purposeFulfilled: boolean
  purposeFulfillmentDate?: Date
  purposeFulfillmentNotes?: string
  spendingPolicy?: string
  spendingRatePercent?: number
  underwaterThreshold?: number
  linkedGrantIds?: string[]
  linkedProgramIds?: string[]
  status: FundStatus
  createdBy?: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface FundBalance {
  id: string
  fundId: string
  protectedPrincipal: number
  accumulatedEarnings: number
  appreciation: number
  creditUsed: number
  totalSpent: number
  totalReleased: number
  spendableBalance: number
  corpusValue: number
  isUnderwater: boolean
  underwaterAmount: number
  costBasis: number
  marketValue: number
  unrealizedGainLoss: number
  lastValuationDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface FundTransaction {
  id: string
  fundId: string
  type: TransactionType
  amount: number
  balanceAfter?: number
  description?: string
  referenceId?: string
  relatedGrantId?: string
  relatedProgramId?: string
  counterpartyFundId?: string
  approvedBy?: string
  approvedAt?: Date
  authorizationNotes?: string
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface RestrictionRelease {
  id: string
  fundId: string
  amount: number
  releaseType: ReleaseType
  reason: string
  supportingDocumentation?: string
  destinationFundId?: string
  destinationType?: string
  authorizedBy?: string
  authorizationDate?: Date
  boardResolutionDate?: Date
  boardResolutionReference?: string
  status: 'pending' | 'approved' | 'completed' | 'rejected' | 'cancelled'
  releasedAt?: Date
  releasedBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface FundAllocation {
  id: string
  depositId?: string
  depositAmount: number
  depositDate: Date
  donorId?: string
  fundId: string
  allocatedAmount: number
  allocationPercentage?: number
  designation?: string
  donorIntent?: string
  status: 'pending' | 'confirmed' | 'deposited' | 'rejected'
  allocatedBy?: string
  confirmedAt?: Date
  createdAt: Date
}

export interface SpendingValidation {
  isValid: boolean
  maxSpendable: number
  errors: string[]
  warnings: string[]
}

export interface FundSummary extends RestrictedFund {
  balance?: FundBalance
  calculatedSpendable: number
  transactionCount: number
  releaseCount: number
}

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

export interface CreateFundInput {
  orgId: string
  name: string
  description?: string
  purpose?: string
  restrictionType: RestrictionType
  donorId?: string
  donorName?: string
  donorAnonymous?: boolean
  giftDate?: Date
  giftAgreementUrl?: string
  releaseSchedule?: ReleaseSchedule
  releaseStartDate?: Date
  releaseEndDate?: Date
  releaseAmountPerPeriod?: number
  spendingPolicy?: string
  spendingRatePercent?: number
  underwaterThreshold?: number
  initialPrincipal?: number
  createdBy?: string
}

/**
 * Create a new restricted fund with initial balance
 */
export async function createFund(input: CreateFundInput): Promise<RestrictedFund> {
  return withTransaction(async (client) => {
    // Create the fund
    const fundResult = await client.query(
      `INSERT INTO restricted_funds (
        org_id, name, description, purpose, restriction_type,
        donor_id, donor_name, donor_anonymous, gift_date, gift_agreement_url,
        release_schedule, release_start_date, release_end_date, release_amount_per_period,
        spending_policy, spending_rate_percent, underwater_threshold,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *`,
      [
        input.orgId,
        input.name,
        input.description,
        input.purpose,
        input.restrictionType,
        input.donorId,
        input.donorName,
        input.donorAnonymous || false,
        input.giftDate,
        input.giftAgreementUrl,
        input.releaseSchedule,
        input.releaseStartDate,
        input.releaseEndDate,
        input.releaseAmountPerPeriod,
        input.spendingPolicy,
        input.spendingRatePercent,
        input.underwaterThreshold,
        input.createdBy,
      ]
    )

    const fund = fundResult.rows[0]

    // Create initial balance record
    const initialPrincipal = input.initialPrincipal || 0
    await client.query(
      `INSERT INTO fund_balances (
        fund_id, protected_principal, corpus_value, spendable_balance
      ) VALUES ($1, $2, $3, $4)`,
      [
        fund.id,
        initialPrincipal,
        initialPrincipal,
        input.restrictionType === 'unrestricted' ? initialPrincipal : 0,
      ]
    )

    // If there's an initial principal, create the initial gift transaction
    if (initialPrincipal > 0) {
      await client.query(
        `INSERT INTO fund_transactions (
          fund_id, type, amount, description, created_by
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          fund.id,
          'initial_gift',
          initialPrincipal,
          `Initial gift from ${input.donorName || 'Anonymous'}`,
          input.createdBy,
        ]
      )
    }

    return mapFundRow(fund)
  })
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get a fund by ID with its balance
 */
export async function getFund(fundId: string): Promise<FundSummary | null> {
  const result = await sql`
    SELECT * FROM v_fund_summary WHERE id = ${fundId}
  `

  if (result.rows.length === 0) {
    return null
  }

  return mapFundSummaryRow(result.rows[0])
}

/**
 * Get all funds for an organization
 */
export async function getFundsByOrg(
  orgId: string,
  options?: {
    restrictionType?: RestrictionType
    status?: FundStatus
    limit?: number
    offset?: number
  }
): Promise<FundSummary[]> {
  let query = `SELECT * FROM v_fund_summary WHERE org_id = $1`
  const params: any[] = [orgId]
  let paramIndex = 2

  if (options?.restrictionType) {
    query += ` AND restriction_type = $${paramIndex}`
    params.push(options.restrictionType)
    paramIndex++
  }

  if (options?.status) {
    query += ` AND status = $${paramIndex}`
    params.push(options.status)
    paramIndex++
  }

  query += ` ORDER BY created_at DESC`

  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`
    params.push(options.limit)
    paramIndex++
  }

  if (options?.offset) {
    query += ` OFFSET $${paramIndex}`
    params.push(options.offset)
  }

  const result = await sql.apply(null, [query, ...params] as any)
  return result.rows.map(mapFundSummaryRow)
}

/**
 * Get fund balance
 */
export async function getFundBalance(fundId: string): Promise<FundBalance | null> {
  const result = await sql`
    SELECT * FROM fund_balances WHERE fund_id = ${fundId}
  `

  if (result.rows.length === 0) {
    return null
  }

  return mapBalanceRow(result.rows[0])
}

/**
 * Get fund transactions
 */
export async function getFundTransactions(
  fundId: string,
  options?: {
    type?: TransactionType
    limit?: number
    offset?: number
  }
): Promise<FundTransaction[]> {
  let query = `SELECT * FROM fund_transactions WHERE fund_id = $1`
  const params: any[] = [fundId]
  let paramIndex = 2

  if (options?.type) {
    query += ` AND type = $${paramIndex}`
    params.push(options.type)
    paramIndex++
  }

  query += ` ORDER BY created_at DESC`

  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`
    params.push(options.limit)
    paramIndex++
  }

  if (options?.offset) {
    query += ` OFFSET $${paramIndex}`
    params.push(options.offset)
  }

  const result = await sql.apply(null, [query, ...params] as any)
  return result.rows.map(mapTransactionRow)
}

/**
 * Get restriction releases for a fund
 */
export async function getRestrictionReleases(
  fundId: string,
  options?: {
    status?: string
    limit?: number
  }
): Promise<RestrictionRelease[]> {
  let query = `SELECT * FROM restriction_releases WHERE fund_id = $1`
  const params: any[] = [fundId]
  let paramIndex = 2

  if (options?.status) {
    query += ` AND status = $${paramIndex}`
    params.push(options.status)
    paramIndex++
  }

  query += ` ORDER BY created_at DESC`

  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`
    params.push(options.limit)
  }

  const result = await sql.apply(null, [query, ...params] as any)
  return result.rows.map(mapReleaseRow)
}

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

export interface UpdateFundInput {
  name?: string
  description?: string
  purpose?: string
  releaseSchedule?: ReleaseSchedule
  releaseStartDate?: Date
  releaseEndDate?: Date
  releaseAmountPerPeriod?: number
  spendingPolicy?: string
  spendingRatePercent?: number
  underwaterThreshold?: number
  linkedGrantIds?: string[]
  linkedProgramIds?: string[]
  status?: FundStatus
  updatedBy?: string
}

/**
 * Update a fund
 */
export async function updateFund(
  fundId: string,
  input: UpdateFundInput
): Promise<RestrictedFund | null> {
  const updates: string[] = []
  const params: any[] = []
  let paramIndex = 1

  const fields = [
    ['name', input.name],
    ['description', input.description],
    ['purpose', input.purpose],
    ['release_schedule', input.releaseSchedule],
    ['release_start_date', input.releaseStartDate],
    ['release_end_date', input.releaseEndDate],
    ['release_amount_per_period', input.releaseAmountPerPeriod],
    ['spending_policy', input.spendingPolicy],
    ['spending_rate_percent', input.spendingRatePercent],
    ['underwater_threshold', input.underwaterThreshold],
    ['linked_grant_ids', input.linkedGrantIds],
    ['linked_program_ids', input.linkedProgramIds],
    ['status', input.status],
    ['updated_by', input.updatedBy],
  ]

  for (const [field, value] of fields) {
    if (value !== undefined) {
      updates.push(`${field} = $${paramIndex}`)
      params.push(value)
      paramIndex++
    }
  }

  if (updates.length === 0) {
    return getFund(fundId) as any
  }

  params.push(fundId)
  const query = `
    UPDATE restricted_funds
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `

  const result = await sql.apply(null, [query, ...params] as any)
  return result.rows.length > 0 ? mapFundRow(result.rows[0]) : null
}

// ============================================================================
// BALANCE OPERATIONS
// ============================================================================

/**
 * Allocate a deposit to a fund
 */
export async function allocateDeposit(input: {
  depositId?: string
  depositAmount: number
  depositDate: Date
  donorId?: string
  fundId: string
  allocatedAmount: number
  allocationPercentage?: number
  designation?: string
  donorIntent?: string
  allocatedBy?: string
}): Promise<FundAllocation> {
  return withTransaction(async (client) => {
    // Create allocation record
    const allocationResult = await client.query(
      `INSERT INTO fund_allocations (
        deposit_id, deposit_amount, deposit_date, donor_id,
        fund_id, allocated_amount, allocation_percentage,
        designation, donor_intent, allocated_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed')
      RETURNING *`,
      [
        input.depositId,
        input.depositAmount,
        input.depositDate,
        input.donorId,
        input.fundId,
        input.allocatedAmount,
        input.allocationPercentage,
        input.designation,
        input.donorIntent,
        input.allocatedBy,
      ]
    )

    // Get fund info
    const fundResult = await client.query(
      `SELECT restriction_type FROM restricted_funds WHERE id = $1`,
      [input.fundId]
    )
    const restrictionType = fundResult.rows[0]?.restriction_type

    // Update fund balance
    await client.query(
      `UPDATE fund_balances
       SET protected_principal = protected_principal + $1,
           corpus_value = corpus_value + $1,
           spendable_balance = CASE
             WHEN $2 = 'unrestricted' THEN spendable_balance + $1
             ELSE spendable_balance
           END,
           updated_at = NOW()
       WHERE fund_id = $3`,
      [input.allocatedAmount, restrictionType, input.fundId]
    )

    // Create transaction
    await client.query(
      `INSERT INTO fund_transactions (
        fund_id, type, amount, description, created_by
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        input.fundId,
        'additional_gift',
        input.allocatedAmount,
        input.designation || 'Deposit allocation',
        input.allocatedBy,
      ]
    )

    return mapAllocationRow(allocationResult.rows[0])
  })
}

/**
 * Record investment income/appreciation
 */
export async function recordInvestmentActivity(input: {
  fundId: string
  type: 'investment_income' | 'realized_gain' | 'realized_loss' | 'appreciation' | 'depreciation'
  amount: number
  description?: string
  createdBy?: string
}): Promise<FundTransaction> {
  return withTransaction(async (client) => {
    // Create transaction
    const txResult = await client.query(
      `INSERT INTO fund_transactions (
        fund_id, type, amount, description, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [input.fundId, input.type, input.amount, input.description, input.createdBy]
    )

    // Update balance based on type
    const isGain = ['investment_income', 'realized_gain', 'appreciation'].includes(input.type)
    const adjustedAmount = isGain ? input.amount : -Math.abs(input.amount)

    if (input.type === 'appreciation' || input.type === 'depreciation') {
      await client.query(
        `UPDATE fund_balances
         SET appreciation = appreciation + $1,
             corpus_value = corpus_value + $1,
             unrealized_gain_loss = unrealized_gain_loss + $1,
             market_value = market_value + $1,
             updated_at = NOW()
         WHERE fund_id = $2`,
        [adjustedAmount, input.fundId]
      )
    } else {
      await client.query(
        `UPDATE fund_balances
         SET accumulated_earnings = accumulated_earnings + $1,
             corpus_value = corpus_value + $1,
             updated_at = NOW()
         WHERE fund_id = $2`,
        [adjustedAmount, input.fundId]
      )
    }

    // Check if fund is underwater (for endowments)
    await client.query(
      `UPDATE fund_balances fb
       SET is_underwater = (fb.corpus_value < rf.underwater_threshold OR fb.corpus_value < fb.protected_principal),
           underwater_amount = GREATEST(0, COALESCE(rf.underwater_threshold, fb.protected_principal) - fb.corpus_value)
       FROM restricted_funds rf
       WHERE fb.fund_id = $1 AND rf.id = $1`,
      [input.fundId]
    )

    return mapTransactionRow(txResult.rows[0])
  })
}

// ============================================================================
// SPENDING OPERATIONS
// ============================================================================

/**
 * Validate if spending is allowed
 */
export async function validateSpending(
  fundId: string,
  amount: number,
  purpose: string
): Promise<SpendingValidation> {
  const result = await sql`
    SELECT * FROM validate_spending(${fundId}, ${amount}, ${purpose})
  `

  const row = result.rows[0]
  return {
    isValid: row.is_valid,
    maxSpendable: parseFloat(row.max_spendable || 0),
    errors: row.errors || [],
    warnings: row.warnings || [],
  }
}

/**
 * Calculate spendable balance for a fund
 */
export async function calculateSpendable(fundId: string): Promise<{
  spendable: number
  restrictionType: RestrictionType
  isUnderwater: boolean
  corpusValue: number
}> {
  const result = await sql`
    SELECT * FROM calculate_spendable_balance(${fundId})
  `

  const row = result.rows[0]
  return {
    spendable: parseFloat(row.spendable || 0),
    restrictionType: row.restriction_type as RestrictionType,
    isUnderwater: row.is_underwater,
    corpusValue: parseFloat(row.corpus_value || 0),
  }
}

/**
 * Record spending from a fund (after validation)
 */
export async function recordSpending(input: {
  fundId: string
  amount: number
  type: 'grant_expense' | 'program_expense' | 'admin_fee'
  description: string
  relatedGrantId?: string
  relatedProgramId?: string
  approvedBy?: string
  createdBy?: string
}): Promise<{ success: boolean; transaction?: FundTransaction; error?: string }> {
  // First validate
  const validation = await validateSpending(input.fundId, input.amount, input.description)

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join('; '),
    }
  }

  return withTransaction(async (client) => {
    // Get current balance
    const balanceResult = await client.query(
      `SELECT spendable_balance, total_spent FROM fund_balances WHERE fund_id = $1 FOR UPDATE`,
      [input.fundId]
    )

    const currentBalance = parseFloat(balanceResult.rows[0]?.spendable_balance || 0)

    if (input.amount > currentBalance) {
      return {
        success: false,
        error: 'Insufficient spendable balance',
      }
    }

    // Create transaction
    const txResult = await client.query(
      `INSERT INTO fund_transactions (
        fund_id, type, amount, description,
        related_grant_id, related_program_id,
        approved_by, approved_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      RETURNING *`,
      [
        input.fundId,
        input.type,
        -input.amount, // Negative for spending
        input.description,
        input.relatedGrantId,
        input.relatedProgramId,
        input.approvedBy,
        input.createdBy,
      ]
    )

    // Update balance
    await client.query(
      `UPDATE fund_balances
       SET spendable_balance = spendable_balance - $1,
           total_spent = total_spent + $1,
           corpus_value = corpus_value - $1,
           updated_at = NOW()
       WHERE fund_id = $2`,
      [input.amount, input.fundId]
    )

    return {
      success: true,
      transaction: mapTransactionRow(txResult.rows[0]),
    }
  })
}

// ============================================================================
// RESTRICTION RELEASE OPERATIONS
// ============================================================================

/**
 * Request a restriction release
 */
export async function requestRestrictionRelease(input: {
  fundId: string
  amount: number
  releaseType: ReleaseType
  reason: string
  supportingDocumentation?: string
  destinationFundId?: string
  destinationType?: string
  authorizedBy?: string
  authorizationDate?: Date
}): Promise<RestrictionRelease> {
  const result = await sql`
    INSERT INTO restriction_releases (
      fund_id, amount, release_type, reason,
      supporting_documentation, destination_fund_id, destination_type,
      authorized_by, authorization_date, status
    ) VALUES (
      ${input.fundId}, ${input.amount}, ${input.releaseType}, ${input.reason},
      ${input.supportingDocumentation}, ${input.destinationFundId}, ${input.destinationType},
      ${input.authorizedBy}, ${input.authorizationDate}, 'pending'
    )
    RETURNING *
  `

  return mapReleaseRow(result.rows[0])
}

/**
 * Complete a restriction release
 */
export async function completeRestrictionRelease(
  releaseId: string,
  releasedBy: string
): Promise<RestrictionRelease> {
  return withTransaction(async (client) => {
    // Get the release
    const releaseResult = await client.query(
      `SELECT * FROM restriction_releases WHERE id = $1 FOR UPDATE`,
      [releaseId]
    )

    const release = releaseResult.rows[0]
    if (!release) {
      throw new Error('Release not found')
    }

    if (release.status !== 'pending' && release.status !== 'approved') {
      throw new Error(`Cannot complete release with status: ${release.status}`)
    }

    // Update the release status
    const updatedResult = await client.query(
      `UPDATE restriction_releases
       SET status = 'completed', released_at = NOW(), released_by = $1
       WHERE id = $2
       RETURNING *`,
      [releasedBy, releaseId]
    )

    // Update fund balance
    await client.query(
      `UPDATE fund_balances
       SET total_released = total_released + $1,
           spendable_balance = spendable_balance + $1,
           updated_at = NOW()
       WHERE fund_id = $2`,
      [release.amount, release.fund_id]
    )

    // Create transaction
    await client.query(
      `INSERT INTO fund_transactions (
        fund_id, type, amount, description, created_by
      ) VALUES ($1, 'restriction_release', $2, $3, $4)`,
      [release.fund_id, release.amount, release.reason, releasedBy]
    )

    return mapReleaseRow(updatedResult.rows[0])
  })
}

/**
 * Mark fund purpose as fulfilled (for temporarily restricted funds)
 */
export async function markPurposeFulfilled(
  fundId: string,
  notes: string,
  updatedBy: string
): Promise<RestrictedFund> {
  return withTransaction(async (client) => {
    // Update fund
    const fundResult = await client.query(
      `UPDATE restricted_funds
       SET purpose_fulfilled = true,
           purpose_fulfillment_date = CURRENT_DATE,
           purpose_fulfillment_notes = $1,
           updated_by = $2
       WHERE id = $3
       RETURNING *`,
      [notes, updatedBy, fundId]
    )

    // Get remaining restricted balance
    const balanceResult = await client.query(
      `SELECT protected_principal, total_released FROM fund_balances WHERE fund_id = $1`,
      [fundId]
    )

    const balance = balanceResult.rows[0]
    const remainingRestricted =
      parseFloat(balance?.protected_principal || 0) - parseFloat(balance?.total_released || 0)

    // If there's remaining restricted balance, release it
    if (remainingRestricted > 0) {
      await client.query(
        `INSERT INTO restriction_releases (
          fund_id, amount, release_type, reason, status, released_at, released_by
        ) VALUES ($1, $2, 'purpose_fulfilled', $3, 'completed', NOW(), $4)`,
        [fundId, remainingRestricted, notes, updatedBy]
      )

      await client.query(
        `UPDATE fund_balances
         SET total_released = total_released + $1,
             spendable_balance = spendable_balance + $1,
             updated_at = NOW()
         WHERE fund_id = $2`,
        [remainingRestricted, fundId]
      )

      await client.query(
        `INSERT INTO fund_transactions (
          fund_id, type, amount, description, created_by
        ) VALUES ($1, 'restriction_release', $2, $3, $4)`,
        [fundId, remainingRestricted, `Purpose fulfilled: ${notes}`, updatedBy]
      )
    }

    return mapFundRow(fundResult.rows[0])
  })
}

// ============================================================================
// AGGREGATE OPERATIONS
// ============================================================================

/**
 * Get fund totals by restriction type for an organization
 */
export async function getFundTotalsByType(orgId: string): Promise<{
  unrestricted: { count: number; total: number; spendable: number }
  temporarilyRestricted: { count: number; total: number; spendable: number }
  permanentlyRestricted: { count: number; total: number; spendable: number }
  grandTotal: { count: number; total: number; spendable: number }
}> {
  const result = await sql`
    SELECT
      restriction_type,
      COUNT(*) as count,
      COALESCE(SUM(corpus_value), 0) as total,
      COALESCE(SUM(calculated_spendable), 0) as spendable
    FROM v_fund_summary
    WHERE org_id = ${orgId} AND status = 'active'
    GROUP BY restriction_type
  `

  const byType: Record<string, { count: number; total: number; spendable: number }> = {}

  for (const row of result.rows) {
    byType[row.restriction_type] = {
      count: parseInt(row.count),
      total: parseFloat(row.total),
      spendable: parseFloat(row.spendable),
    }
  }

  const unrestricted = byType['unrestricted'] || { count: 0, total: 0, spendable: 0 }
  const temporarilyRestricted = byType['temporarily_restricted'] || { count: 0, total: 0, spendable: 0 }
  const permanentlyRestricted = byType['permanently_restricted'] || { count: 0, total: 0, spendable: 0 }

  return {
    unrestricted,
    temporarilyRestricted,
    permanentlyRestricted,
    grandTotal: {
      count: unrestricted.count + temporarilyRestricted.count + permanentlyRestricted.count,
      total: unrestricted.total + temporarilyRestricted.total + permanentlyRestricted.total,
      spendable: unrestricted.spendable + temporarilyRestricted.spendable + permanentlyRestricted.spendable,
    },
  }
}

/**
 * Process all scheduled releases (should be run daily)
 */
export async function processScheduledReleases(): Promise<number> {
  const result = await sql`SELECT process_scheduled_releases() as count`
  return parseInt(result.rows[0]?.count || 0)
}

// ============================================================================
// ROW MAPPERS
// ============================================================================

function mapFundRow(row: any): RestrictedFund {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    purpose: row.purpose,
    restrictionType: row.restriction_type,
    donorId: row.donor_id,
    donorName: row.donor_name,
    donorAnonymous: row.donor_anonymous,
    giftDate: row.gift_date ? new Date(row.gift_date) : undefined,
    giftAgreementUrl: row.gift_agreement_url,
    releaseSchedule: row.release_schedule,
    releaseStartDate: row.release_start_date ? new Date(row.release_start_date) : undefined,
    releaseEndDate: row.release_end_date ? new Date(row.release_end_date) : undefined,
    releaseAmountPerPeriod: row.release_amount_per_period
      ? parseFloat(row.release_amount_per_period)
      : undefined,
    purposeFulfilled: row.purpose_fulfilled,
    purposeFulfillmentDate: row.purpose_fulfillment_date
      ? new Date(row.purpose_fulfillment_date)
      : undefined,
    purposeFulfillmentNotes: row.purpose_fulfillment_notes,
    spendingPolicy: row.spending_policy,
    spendingRatePercent: row.spending_rate_percent
      ? parseFloat(row.spending_rate_percent)
      : undefined,
    underwaterThreshold: row.underwater_threshold
      ? parseFloat(row.underwater_threshold)
      : undefined,
    linkedGrantIds: row.linked_grant_ids,
    linkedProgramIds: row.linked_program_ids,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapBalanceRow(row: any): FundBalance {
  return {
    id: row.id,
    fundId: row.fund_id,
    protectedPrincipal: parseFloat(row.protected_principal || 0),
    accumulatedEarnings: parseFloat(row.accumulated_earnings || 0),
    appreciation: parseFloat(row.appreciation || 0),
    creditUsed: parseFloat(row.credit_used || 0),
    totalSpent: parseFloat(row.total_spent || 0),
    totalReleased: parseFloat(row.total_released || 0),
    spendableBalance: parseFloat(row.spendable_balance || 0),
    corpusValue: parseFloat(row.corpus_value || 0),
    isUnderwater: row.is_underwater || false,
    underwaterAmount: parseFloat(row.underwater_amount || 0),
    costBasis: parseFloat(row.cost_basis || 0),
    marketValue: parseFloat(row.market_value || 0),
    unrealizedGainLoss: parseFloat(row.unrealized_gain_loss || 0),
    lastValuationDate: row.last_valuation_date
      ? new Date(row.last_valuation_date)
      : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapTransactionRow(row: any): FundTransaction {
  return {
    id: row.id,
    fundId: row.fund_id,
    type: row.type,
    amount: parseFloat(row.amount),
    balanceAfter: row.balance_after ? parseFloat(row.balance_after) : undefined,
    description: row.description,
    referenceId: row.reference_id,
    relatedGrantId: row.related_grant_id,
    relatedProgramId: row.related_program_id,
    counterpartyFundId: row.counterparty_fund_id,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    authorizationNotes: row.authorization_notes,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapReleaseRow(row: any): RestrictionRelease {
  return {
    id: row.id,
    fundId: row.fund_id,
    amount: parseFloat(row.amount),
    releaseType: row.release_type,
    reason: row.reason,
    supportingDocumentation: row.supporting_documentation,
    destinationFundId: row.destination_fund_id,
    destinationType: row.destination_type,
    authorizedBy: row.authorized_by,
    authorizationDate: row.authorization_date
      ? new Date(row.authorization_date)
      : undefined,
    boardResolutionDate: row.board_resolution_date
      ? new Date(row.board_resolution_date)
      : undefined,
    boardResolutionReference: row.board_resolution_reference,
    status: row.status,
    releasedAt: row.released_at ? new Date(row.released_at) : undefined,
    releasedBy: row.released_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapAllocationRow(row: any): FundAllocation {
  return {
    id: row.id,
    depositId: row.deposit_id,
    depositAmount: parseFloat(row.deposit_amount),
    depositDate: new Date(row.deposit_date),
    donorId: row.donor_id,
    fundId: row.fund_id,
    allocatedAmount: parseFloat(row.allocated_amount),
    allocationPercentage: row.allocation_percentage
      ? parseFloat(row.allocation_percentage)
      : undefined,
    designation: row.designation,
    donorIntent: row.donor_intent,
    status: row.status,
    allocatedBy: row.allocated_by,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    createdAt: new Date(row.created_at),
  }
}

function mapFundSummaryRow(row: any): FundSummary {
  return {
    ...mapFundRow(row),
    balance: row.protected_principal !== null
      ? {
          id: '',
          fundId: row.id,
          protectedPrincipal: parseFloat(row.protected_principal || 0),
          accumulatedEarnings: parseFloat(row.accumulated_earnings || 0),
          appreciation: parseFloat(row.appreciation || 0),
          creditUsed: 0,
          totalSpent: parseFloat(row.total_spent || 0),
          totalReleased: parseFloat(row.total_released || 0),
          spendableBalance: parseFloat(row.spendable_balance || 0),
          corpusValue: parseFloat(row.corpus_value || 0),
          isUnderwater: row.is_underwater || false,
          underwaterAmount: 0,
          costBasis: 0,
          marketValue: parseFloat(row.market_value || 0),
          unrealizedGainLoss: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      : undefined,
    calculatedSpendable: parseFloat(row.calculated_spendable || 0),
    transactionCount: parseInt(row.transaction_count || 0),
    releaseCount: parseInt(row.release_count || 0),
  }
}

export default {
  // Create
  createFund,
  allocateDeposit,

  // Read
  getFund,
  getFundsByOrg,
  getFundBalance,
  getFundTransactions,
  getRestrictionReleases,
  getFundTotalsByType,

  // Update
  updateFund,
  recordInvestmentActivity,

  // Spending
  validateSpending,
  calculateSpendable,
  recordSpending,

  // Releases
  requestRestrictionRelease,
  completeRestrictionRelease,
  markPurposeFulfilled,
  processScheduledReleases,
}
