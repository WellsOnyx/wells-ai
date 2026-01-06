/**
 * GRAIN Grant Disbursement System
 *
 * Grant management for nonprofits and endowments using the GRAIN ecosystem.
 *
 * KEY INSIGHT: Grants come from the CREDIT LINE, not the protected deposit.
 * This keeps the principal/corpus intact while allowing grant operations.
 *
 * Flow:
 * 1. Endowment deposits funds -> Creates protected deposit + credit line
 * 2. Grant created -> Allocated from credit line (not principal)
 * 3. Grant disbursed -> Credit line used increases
 * 4. Principal remains protected -> Endowment corpus is never touched
 *
 * This mirrors traditional endowment operations where:
 * - Corpus (principal) is never spent
 * - Only investment returns/credit are used for grants
 * - Principal protection is paramount
 */

import { query, withTransaction } from '@/lib/db'
import { getCurrentGrainPrice, getPosition } from '@/lib/grain/credit-line-engine'

// ============================================================================
// TYPES
// ============================================================================

export type GrantStatus = 'pending' | 'approved' | 'disbursed' | 'completed' | 'cancelled' | 'rejected'

export interface Grant {
  id: string
  endowmentId: string        // The credit line position ID (grantor)
  granteeId: string          // Who receives the grant
  granteeName: string        // Display name
  granteeType: 'nonprofit' | 'individual' | 'institution' | 'other'

  // Grant details
  amount: number             // GRAIN amount
  usdValue: number           // USD value at creation
  purpose: string
  description: string | null

  // Restricted fund linkage (optional)
  restrictedFundId: string | null
  restrictedFundName: string | null

  // Status tracking
  status: GrantStatus
  approvedBy: string | null
  approvedAt: Date | null

  // Agreement
  agreementId: string | null
  agreementUrl: string | null

  // Disbursement tracking
  totalDisbursed: number
  remainingAmount: number

  // Timeline
  grantPeriodStart: Date | null
  grantPeriodEnd: Date | null

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface GrantDisbursement {
  id: string
  grantId: string
  amount: number             // GRAIN disbursed
  usdValue: number           // USD value at disbursement
  grainPrice: number         // Price at time of disbursement

  // Transaction reference
  creditLineTransactionId: string | null

  // Method
  method: 'ach' | 'wire' | 'check' | 'grain_transfer' | 'other'
  methodDetails: Record<string, any> | null

  // Receipt
  receiptId: string
  receiptUrl: string | null

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed'

  // Timestamps
  disbursedAt: Date
  completedAt: Date | null
}

export interface RestrictedFund {
  id: string
  endowmentId: string
  name: string
  purpose: string
  restrictions: string       // What the fund can be used for

  // Allocation
  allocatedGrain: number     // GRAIN allocated to this fund
  usedGrain: number          // GRAIN used from this fund
  availableGrain: number     // allocatedGrain - usedGrain

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface CreateGrantInput {
  endowmentId: string
  granteeName: string
  granteeType: 'nonprofit' | 'individual' | 'institution' | 'other'
  granteeId?: string
  amount: number             // GRAIN amount
  purpose: string
  description?: string
  restrictedFundId?: string
  grantPeriodStart?: Date
  grantPeriodEnd?: Date
}

export interface DisburseGrantInput {
  grantId: string
  amount: number             // GRAIN to disburse
  method: 'ach' | 'wire' | 'check' | 'grain_transfer' | 'other'
  methodDetails?: Record<string, any>
}

export interface GrantAgreement {
  id: string
  grantId: string
  agreementNumber: string
  documentUrl: string | null
  signedAt: Date | null
  signedBy: string | null
  terms: string
  createdAt: Date
}

// ============================================================================
// GRANT CREATION
// ============================================================================

/**
 * Create a new grant from credit line
 *
 * CRITICAL: This allocates from CREDIT LINE, not protected deposit.
 * The endowment's principal remains protected.
 */
export async function createGrant(input: CreateGrantInput): Promise<{
  success: boolean
  grant: Grant | null
  message: string
  creditLineUsed: number
  creditLineRemaining: number
}> {
  const {
    endowmentId,
    granteeName,
    granteeType,
    granteeId,
    amount,
    purpose,
    description,
    restrictedFundId,
    grantPeriodStart,
    grantPeriodEnd,
  } = input

  if (amount <= 0) {
    throw new Error('Grant amount must be positive')
  }

  // Get current GRAIN price
  const grainPrice = await getCurrentGrainPrice()
  const usdValue = amount * grainPrice

  // Get endowment's credit line position
  const position = await getPosition(endowmentId)
  if (!position) {
    throw new Error('Endowment credit line position not found')
  }

  // Check available credit line
  const availableCredit = position.creditLineLimit - position.creditLineUsed
  if (amount > availableCredit) {
    return {
      success: false,
      grant: null,
      message: `Insufficient credit line. Available: ${availableCredit.toLocaleString()} GRAIN, Requested: ${amount.toLocaleString()} GRAIN`,
      creditLineUsed: position.creditLineUsed,
      creditLineRemaining: availableCredit,
    }
  }

  // If restricted fund specified, check availability
  if (restrictedFundId) {
    const fund = await getRestrictedFund(restrictedFundId)
    if (!fund) {
      throw new Error('Restricted fund not found')
    }
    if (fund.endowmentId !== endowmentId) {
      throw new Error('Restricted fund does not belong to this endowment')
    }
    if (amount > fund.availableGrain) {
      return {
        success: false,
        grant: null,
        message: `Insufficient restricted fund balance. Available: ${fund.availableGrain.toLocaleString()} GRAIN`,
        creditLineUsed: position.creditLineUsed,
        creditLineRemaining: availableCredit,
      }
    }
  }

  // Create grant record
  const result = await query(
    `INSERT INTO grants (
      endowment_id, grantee_id, grantee_name, grantee_type,
      amount, usd_value_at_creation, purpose, description,
      restricted_fund_id, status, total_disbursed, remaining_amount,
      grant_period_start, grant_period_end
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 0, $5, $10, $11)
    RETURNING *`,
    [
      endowmentId,
      granteeId || null,
      granteeName,
      granteeType,
      amount,
      usdValue,
      purpose,
      description || null,
      restrictedFundId || null,
      grantPeriodStart || null,
      grantPeriodEnd || null,
    ]
  )

  const grant = mapRowToGrant(result.rows[0])

  return {
    success: true,
    grant,
    message: `Grant created for ${amount.toLocaleString()} GRAIN ($${usdValue.toLocaleString()}) to ${granteeName}`,
    creditLineUsed: position.creditLineUsed,
    creditLineRemaining: availableCredit,
  }
}

// ============================================================================
// GRANT APPROVAL
// ============================================================================

/**
 * Approve a pending grant
 */
export async function approveGrant(
  grantId: string,
  approvedBy: string
): Promise<{ success: boolean; grant: Grant; message: string }> {
  // Get grant
  const grantResult = await query(
    `SELECT * FROM grants WHERE id = $1`,
    [grantId]
  )

  if (grantResult.rows.length === 0) {
    throw new Error('Grant not found')
  }

  const currentGrant = mapRowToGrant(grantResult.rows[0])

  if (currentGrant.status !== 'pending') {
    throw new Error(`Cannot approve grant with status: ${currentGrant.status}`)
  }

  // Update grant status
  const updateResult = await query(
    `UPDATE grants
     SET status = 'approved',
         approved_by = $1,
         approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [approvedBy, grantId]
  )

  const grant = mapRowToGrant(updateResult.rows[0])

  return {
    success: true,
    grant,
    message: `Grant approved by ${approvedBy}`,
  }
}

/**
 * Reject a pending grant
 */
export async function rejectGrant(
  grantId: string,
  rejectedBy: string,
  reason: string
): Promise<{ success: boolean; grant: Grant; message: string }> {
  const updateResult = await query(
    `UPDATE grants
     SET status = 'rejected',
         approved_by = $1,
         approved_at = NOW(),
         description = COALESCE(description, '') || E'\n\nRejection reason: ' || $2,
         updated_at = NOW()
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [rejectedBy, reason, grantId]
  )

  if (updateResult.rows.length === 0) {
    throw new Error('Grant not found or not in pending status')
  }

  return {
    success: true,
    grant: mapRowToGrant(updateResult.rows[0]),
    message: `Grant rejected: ${reason}`,
  }
}

// ============================================================================
// GRANT DISBURSEMENT
// ============================================================================

/**
 * Disburse funds from an approved grant
 *
 * CRITICAL: Disbursement comes from CREDIT LINE, not protected deposit.
 * This keeps the endowment's principal/corpus intact.
 */
export async function disburseGrant(
  input: DisburseGrantInput
): Promise<{
  success: boolean
  disbursement: GrantDisbursement | null
  grant: Grant | null
  receipt: GrantReceipt
  message: string
}> {
  const { grantId, amount, method, methodDetails } = input

  if (amount <= 0) {
    throw new Error('Disbursement amount must be positive')
  }

  return withTransaction(async (client) => {
    // Get grant with lock
    const grantResult = await client.query(
      `SELECT * FROM grants WHERE id = $1 FOR UPDATE`,
      [grantId]
    )

    if (grantResult.rows.length === 0) {
      throw new Error('Grant not found')
    }

    const grant = mapRowToGrant(grantResult.rows[0])

    // Validate status
    if (grant.status !== 'approved' && grant.status !== 'disbursed') {
      throw new Error(`Cannot disburse grant with status: ${grant.status}. Must be approved or partially disbursed.`)
    }

    // Check remaining amount
    if (amount > grant.remainingAmount) {
      throw new Error(`Disbursement exceeds remaining grant amount. Remaining: ${grant.remainingAmount.toLocaleString()} GRAIN`)
    }

    // Get current GRAIN price
    const grainPrice = await getCurrentGrainPrice()
    const usdValue = amount * grainPrice

    // Get endowment position and verify credit line
    const positionResult = await client.query(
      `SELECT * FROM credit_line_positions WHERE user_id = $1 FOR UPDATE`,
      [grant.endowmentId]
    )

    if (positionResult.rows.length === 0) {
      throw new Error('Endowment credit line position not found')
    }

    const position = positionResult.rows[0]
    const creditLineUsed = parseFloat(position.credit_line_used) || 0
    const creditLineLimit = parseFloat(position.credit_line_limit) || 0
    const availableCredit = creditLineLimit - creditLineUsed

    if (amount > availableCredit) {
      throw new Error(`Insufficient credit line for disbursement. Available: ${availableCredit.toLocaleString()} GRAIN`)
    }

    // Generate receipt ID
    const receiptId = `GR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Create disbursement record
    const disbursementResult = await client.query(
      `INSERT INTO grant_disbursements (
        grant_id, amount, usd_value, grain_price,
        method, method_details, receipt_id, status, disbursed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
      RETURNING *`,
      [
        grantId,
        amount,
        usdValue,
        grainPrice,
        method,
        methodDetails ? JSON.stringify(methodDetails) : null,
        receiptId,
      ]
    )

    const disbursement = mapRowToDisbursement(disbursementResult.rows[0])

    // Update credit line - USE credit line (not protected deposit!)
    await client.query(
      `UPDATE credit_line_positions
       SET credit_line_used = credit_line_used + $1,
           status = 'credit_used'
       WHERE user_id = $2`,
      [amount, grant.endowmentId]
    )

    // Record credit line transaction
    const txResult = await client.query(
      `INSERT INTO credit_line_transactions (
        user_id, position_id, type, grain_amount, grain_price,
        protected_deposit_after, credit_line_used_after, appreciation_after,
        counterparty_id, description
      ) VALUES ($1, $2, 'credit_spend', $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        grant.endowmentId,
        position.id,
        amount,
        grainPrice,
        position.protected_deposit,
        creditLineUsed + amount,
        position.appreciation_grain,
        grant.granteeId,
        `Grant disbursement: ${grant.granteeName} - ${grant.purpose}`,
      ]
    )

    // Update disbursement with transaction reference
    await client.query(
      `UPDATE grant_disbursements
       SET credit_line_transaction_id = $1, completed_at = NOW()
       WHERE id = $2`,
      [txResult.rows[0].id, disbursement.id]
    )

    // Update grant totals
    const newTotalDisbursed = grant.totalDisbursed + amount
    const newRemainingAmount = grant.amount - newTotalDisbursed
    const newStatus = newRemainingAmount <= 0 ? 'completed' : 'disbursed'

    const updatedGrantResult = await client.query(
      `UPDATE grants
       SET total_disbursed = $1,
           remaining_amount = $2,
           status = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newTotalDisbursed, newRemainingAmount, newStatus, grantId]
    )

    const updatedGrant = mapRowToGrant(updatedGrantResult.rows[0])

    // If restricted fund, update usage
    if (grant.restrictedFundId) {
      await client.query(
        `UPDATE restricted_funds
         SET used_grain = used_grain + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [amount, grant.restrictedFundId]
      )
    }

    // Generate receipt
    const receipt: GrantReceipt = {
      receiptId,
      grantId,
      disbursementId: disbursement.id,
      granteeName: grant.granteeName,
      endowmentId: grant.endowmentId,
      amount,
      usdValue,
      grainPrice,
      method,
      purpose: grant.purpose,
      disbursedAt: new Date(),
      message: `Disbursed ${amount.toLocaleString()} GRAIN ($${usdValue.toLocaleString()}) to ${grant.granteeName}`,
    }

    return {
      success: true,
      disbursement: {
        ...disbursement,
        creditLineTransactionId: txResult.rows[0].id,
        completedAt: new Date(),
      },
      grant: updatedGrant,
      receipt,
      message: `Successfully disbursed ${amount.toLocaleString()} GRAIN ($${usdValue.toLocaleString()})`,
    }
  })
}

export interface GrantReceipt {
  receiptId: string
  grantId: string
  disbursementId: string
  granteeName: string
  endowmentId: string
  amount: number
  usdValue: number
  grainPrice: number
  method: string
  purpose: string
  disbursedAt: Date
  message: string
}

// ============================================================================
// GRANT AGREEMENTS
// ============================================================================

/**
 * Generate a grant agreement document
 */
export async function generateGrantAgreement(
  grantId: string
): Promise<{ success: boolean; agreement: GrantAgreement; message: string }> {
  // Get grant
  const grantResult = await query(
    `SELECT g.*, rf.name as fund_name, rf.restrictions as fund_restrictions
     FROM grants g
     LEFT JOIN restricted_funds rf ON g.restricted_fund_id = rf.id
     WHERE g.id = $1`,
    [grantId]
  )

  if (grantResult.rows.length === 0) {
    throw new Error('Grant not found')
  }

  const grant = mapRowToGrant(grantResult.rows[0])
  const grainPrice = await getCurrentGrainPrice()

  // Generate agreement number
  const agreementNumber = `GA-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`

  // Generate terms based on grant details
  const terms = generateAgreementTerms(grant, grainPrice, grantResult.rows[0])

  // Create agreement record
  const result = await query(
    `INSERT INTO grant_agreements (
      grant_id, agreement_number, terms
    ) VALUES ($1, $2, $3)
    RETURNING *`,
    [grantId, agreementNumber, terms]
  )

  // Update grant with agreement reference
  await query(
    `UPDATE grants SET agreement_id = $1, updated_at = NOW() WHERE id = $2`,
    [result.rows[0].id, grantId]
  )

  const agreement: GrantAgreement = {
    id: result.rows[0].id,
    grantId: result.rows[0].grant_id,
    agreementNumber: result.rows[0].agreement_number,
    documentUrl: result.rows[0].document_url,
    signedAt: result.rows[0].signed_at,
    signedBy: result.rows[0].signed_by,
    terms: result.rows[0].terms,
    createdAt: new Date(result.rows[0].created_at),
  }

  return {
    success: true,
    agreement,
    message: `Grant agreement ${agreementNumber} generated`,
  }
}

function generateAgreementTerms(
  grant: Grant,
  grainPrice: number,
  row: any
): string {
  const usdValue = grant.amount * grainPrice
  const fundName = row.fund_name
  const fundRestrictions = row.fund_restrictions

  let terms = `GRANT AGREEMENT

Agreement Number: [To be assigned]
Date: ${new Date().toISOString().split('T')[0]}

GRANTOR: Endowment ID ${grant.endowmentId}
GRANTEE: ${grant.granteeName} (${grant.granteeType})

GRANT DETAILS:
- Amount: ${grant.amount.toLocaleString()} GRAIN
- USD Value at Creation: $${grant.usdValue.toLocaleString()}
- Current USD Value: $${usdValue.toLocaleString()}
- Purpose: ${grant.purpose}
${grant.description ? `- Description: ${grant.description}` : ''}

${fundName ? `RESTRICTED FUND:
- Fund Name: ${fundName}
- Restrictions: ${fundRestrictions}
` : ''}

GRANT PERIOD:
- Start: ${grant.grantPeriodStart ? grant.grantPeriodStart.toISOString().split('T')[0] : 'Upon disbursement'}
- End: ${grant.grantPeriodEnd ? grant.grantPeriodEnd.toISOString().split('T')[0] : 'Not specified'}

TERMS AND CONDITIONS:

1. USE OF FUNDS: Grantee agrees to use the granted funds solely for the stated purpose.

2. REPORTING: Grantee shall provide progress reports as required by the Grantor.

3. DISBURSEMENT: Funds are disbursed from the Grantor's credit line, preserving the endowment principal.

4. COMPLIANCE: Grantee shall comply with all applicable laws and regulations.

5. RETURN OF FUNDS: Unused funds must be returned to the Grantor upon request or grant completion.

6. GRAIN VALUATION: Grant is denominated in GRAIN. USD values are for reference only and may fluctuate.

7. MODIFICATIONS: Any modifications to this agreement must be in writing and signed by both parties.

SIGNATURES:

Grantor: _________________________ Date: _________

Grantee: _________________________ Date: _________`

  return terms
}

// ============================================================================
// RESTRICTED FUNDS
// ============================================================================

/**
 * Create a restricted fund within an endowment
 */
export async function createRestrictedFund(
  endowmentId: string,
  name: string,
  purpose: string,
  restrictions: string,
  allocatedGrain: number
): Promise<RestrictedFund> {
  // Verify endowment has sufficient credit line
  const position = await getPosition(endowmentId)
  if (!position) {
    throw new Error('Endowment credit line position not found')
  }

  const availableCredit = position.creditLineLimit - position.creditLineUsed
  if (allocatedGrain > availableCredit) {
    throw new Error(`Insufficient credit line for restricted fund. Available: ${availableCredit.toLocaleString()} GRAIN`)
  }

  const result = await query(
    `INSERT INTO restricted_funds (
      endowment_id, name, purpose, restrictions, allocated_grain, used_grain
    ) VALUES ($1, $2, $3, $4, $5, 0)
    RETURNING *`,
    [endowmentId, name, purpose, restrictions, allocatedGrain]
  )

  return mapRowToRestrictedFund(result.rows[0])
}

/**
 * Get a restricted fund by ID
 */
export async function getRestrictedFund(fundId: string): Promise<RestrictedFund | null> {
  const result = await query(
    `SELECT * FROM restricted_funds WHERE id = $1`,
    [fundId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToRestrictedFund(result.rows[0])
}

/**
 * List restricted funds for an endowment
 */
export async function listRestrictedFunds(endowmentId: string): Promise<RestrictedFund[]> {
  const result = await query(
    `SELECT * FROM restricted_funds WHERE endowment_id = $1 ORDER BY created_at DESC`,
    [endowmentId]
  )

  return result.rows.map(mapRowToRestrictedFund)
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get a grant by ID
 */
export async function getGrant(grantId: string): Promise<Grant | null> {
  const result = await query(
    `SELECT g.*, rf.name as restricted_fund_name
     FROM grants g
     LEFT JOIN restricted_funds rf ON g.restricted_fund_id = rf.id
     WHERE g.id = $1`,
    [grantId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToGrant(result.rows[0])
}

/**
 * List grants with filters
 */
export async function listGrants(filters: {
  endowmentId?: string
  granteeId?: string
  status?: GrantStatus | GrantStatus[]
  restrictedFundId?: string
  limit?: number
  offset?: number
}): Promise<{ grants: Grant[]; total: number }> {
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (filters.endowmentId) {
    conditions.push(`g.endowment_id = $${paramIndex++}`)
    params.push(filters.endowmentId)
  }

  if (filters.granteeId) {
    conditions.push(`g.grantee_id = $${paramIndex++}`)
    params.push(filters.granteeId)
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`g.status = ANY($${paramIndex++})`)
      params.push(filters.status)
    } else {
      conditions.push(`g.status = $${paramIndex++}`)
      params.push(filters.status)
    }
  }

  if (filters.restrictedFundId) {
    conditions.push(`g.restricted_fund_id = $${paramIndex++}`)
    params.push(filters.restrictedFundId)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM grants g ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0].total, 10)

  // Get grants
  const limit = filters.limit || 50
  const offset = filters.offset || 0
  params.push(limit, offset)

  const result = await query(
    `SELECT g.*, rf.name as restricted_fund_name
     FROM grants g
     LEFT JOIN restricted_funds rf ON g.restricted_fund_id = rf.id
     ${whereClause}
     ORDER BY g.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  )

  return {
    grants: result.rows.map(mapRowToGrant),
    total,
  }
}

/**
 * Get disbursements for a grant
 */
export async function getGrantDisbursements(grantId: string): Promise<GrantDisbursement[]> {
  const result = await query(
    `SELECT * FROM grant_disbursements WHERE grant_id = $1 ORDER BY disbursed_at DESC`,
    [grantId]
  )

  return result.rows.map(mapRowToDisbursement)
}

/**
 * Get grant statistics for an endowment
 */
export async function getGrantStats(endowmentId: string): Promise<{
  totalGrants: number
  pendingGrants: number
  approvedGrants: number
  disbursedGrants: number
  completedGrants: number
  totalAmountGranted: number
  totalAmountDisbursed: number
  totalAmountPending: number
}> {
  const result = await query(
    `SELECT
      COUNT(*) as total_grants,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_grants,
      COUNT(*) FILTER (WHERE status = 'approved') as approved_grants,
      COUNT(*) FILTER (WHERE status = 'disbursed') as disbursed_grants,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_grants,
      COALESCE(SUM(amount), 0) as total_amount_granted,
      COALESCE(SUM(total_disbursed), 0) as total_amount_disbursed,
      COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('approved', 'disbursed')), 0) as total_amount_pending
     FROM grants
     WHERE endowment_id = $1`,
    [endowmentId]
  )

  const row = result.rows[0]
  return {
    totalGrants: parseInt(row.total_grants, 10),
    pendingGrants: parseInt(row.pending_grants, 10),
    approvedGrants: parseInt(row.approved_grants, 10),
    disbursedGrants: parseInt(row.disbursed_grants, 10),
    completedGrants: parseInt(row.completed_grants, 10),
    totalAmountGranted: parseFloat(row.total_amount_granted) || 0,
    totalAmountDisbursed: parseFloat(row.total_amount_disbursed) || 0,
    totalAmountPending: parseFloat(row.total_amount_pending) || 0,
  }
}

// ============================================================================
// MAPPERS
// ============================================================================

function mapRowToGrant(row: any): Grant {
  return {
    id: row.id,
    endowmentId: row.endowment_id,
    granteeId: row.grantee_id,
    granteeName: row.grantee_name,
    granteeType: row.grantee_type,
    amount: parseFloat(row.amount) || 0,
    usdValue: parseFloat(row.usd_value_at_creation) || 0,
    purpose: row.purpose,
    description: row.description,
    restrictedFundId: row.restricted_fund_id,
    restrictedFundName: row.restricted_fund_name || null,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? new Date(row.approved_at) : null,
    agreementId: row.agreement_id,
    agreementUrl: row.agreement_url,
    totalDisbursed: parseFloat(row.total_disbursed) || 0,
    remainingAmount: parseFloat(row.remaining_amount) || 0,
    grantPeriodStart: row.grant_period_start ? new Date(row.grant_period_start) : null,
    grantPeriodEnd: row.grant_period_end ? new Date(row.grant_period_end) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapRowToDisbursement(row: any): GrantDisbursement {
  return {
    id: row.id,
    grantId: row.grant_id,
    amount: parseFloat(row.amount) || 0,
    usdValue: parseFloat(row.usd_value) || 0,
    grainPrice: parseFloat(row.grain_price) || 1,
    creditLineTransactionId: row.credit_line_transaction_id,
    method: row.method,
    methodDetails: row.method_details,
    receiptId: row.receipt_id,
    receiptUrl: row.receipt_url,
    status: row.status,
    disbursedAt: new Date(row.disbursed_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  }
}

function mapRowToRestrictedFund(row: any): RestrictedFund {
  const allocated = parseFloat(row.allocated_grain) || 0
  const used = parseFloat(row.used_grain) || 0

  return {
    id: row.id,
    endowmentId: row.endowment_id,
    name: row.name,
    purpose: row.purpose,
    restrictions: row.restrictions,
    allocatedGrain: allocated,
    usedGrain: used,
    availableGrain: allocated - used,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GrantEngine = {
  // Grant lifecycle
  createGrant,
  approveGrant,
  rejectGrant,
  disburseGrant,

  // Agreements
  generateGrantAgreement,

  // Restricted funds
  createRestrictedFund,
  getRestrictedFund,
  listRestrictedFunds,

  // Queries
  getGrant,
  listGrants,
  getGrantDisbursements,
  getGrantStats,
}

export default GrantEngine
