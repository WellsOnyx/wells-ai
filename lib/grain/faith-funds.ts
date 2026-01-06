/**
 * GRAIN Faith-Based Organization Funds System
 *
 * Specialized treasury management for churches, ministries, and religious organizations.
 * Handles tithe allocation, building funds, mission funds, and benevolence requests.
 *
 * "Now faith is the substance of things hoped for, the evidence of things not seen."
 * - Hebrews 11:1
 *
 * FUND TYPES:
 * - General Fund: Tithes and regular offerings for operational expenses
 * - Building Fund: Capital campaigns and facility maintenance
 * - Missions Fund: Support for missionaries and outreach programs
 * - Benevolence Fund: Emergency assistance for congregation members
 *
 * ECONOMICS:
 * - All funds protected in GRAIN treasury
 * - 0% interest credit line for operations
 * - Funds appreciate over time (4.5%+ APY)
 * - Full transparency and audit trail
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type FundType = 'general' | 'building' | 'missions' | 'benevolence'

export interface FaithOrganization {
  id: string
  name: string
  type: 'church' | 'ministry' | 'nonprofit' | 'denomination'
  ein?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  denomination?: string
  seniorPastorName?: string
  treasurerName?: string
  weeklyAttendance?: number
  createdAt: Date
  updatedAt: Date
}

export interface FaithFund {
  id: string
  organizationId: string
  fundType: FundType
  name: string
  description?: string
  balance: number
  targetAmount?: number
  allocationPercentage?: number // For auto-allocation from tithes
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TitheOffering {
  id: string
  organizationId: string
  donorName?: string // Optional for anonymous giving
  donorEmail?: string
  amount: number
  grainAmount: number
  grainPriceAtTime: number
  isAnonymous: boolean
  isRecurring: boolean
  recurringSchedule?: 'weekly' | 'biweekly' | 'monthly'
  designation?: FundType | 'split' // Where the tithe goes
  splitAllocations?: Record<FundType, number> // Percentages if split
  notes?: string
  receiptSent: boolean
  createdAt: Date
}

export interface Missionary {
  id: string
  organizationId: string
  name: string
  field: string // Mission field/location
  organization?: string // Mission organization they serve with
  email?: string
  monthlySupport: number
  startDate: Date
  status: 'active' | 'furlough' | 'inactive'
  notes?: string
}

export interface BenevolenceRequest {
  id: string
  organizationId: string
  requestorName: string
  requestorContact?: string
  category: 'rent' | 'utilities' | 'medical' | 'food' | 'transportation' | 'funeral' | 'other'
  amountRequested: number
  amountApproved?: number
  description: string
  urgency: 'immediate' | 'within_week' | 'within_month'
  status: 'pending' | 'under_review' | 'approved' | 'denied' | 'disbursed' | 'closed'
  reviewedBy?: string
  reviewNotes?: string
  disbursementMethod?: 'check' | 'direct' | 'vendor_payment'
  vendorName?: string // For direct vendor payments (utilities, landlords)
  isConfidential: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Disbursement {
  id: string
  organizationId: string
  fundType: FundType
  amount: number
  grainAmount: number
  recipient: string
  category: 'staff_salary' | 'missions_support' | 'benevolence' | 'operations' | 'capital' | 'other'
  description: string
  approvedBy: string
  status: 'pending' | 'approved' | 'completed' | 'cancelled'
  paymentMethod: 'ach' | 'check' | 'wire' | 'grain_transfer'
  referenceId?: string // Benevolence request ID or missionary ID
  createdAt: Date
  completedAt?: Date
}

export interface AllocationRule {
  id: string
  organizationId: string
  name: string
  isDefault: boolean
  allocations: {
    general: number
    building: number
    missions: number
    benevolence: number
  }
  createdAt: Date
}

// Default tithe allocation (biblical 10% tithe model)
export const DEFAULT_ALLOCATION: AllocationRule['allocations'] = {
  general: 70,      // 70% to general operations
  building: 10,     // 10% to building fund
  missions: 15,     // 15% to missions
  benevolence: 5,   // 5% to benevolence
}

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

/**
 * Create a new faith-based organization
 */
export async function createFaithOrganization(
  org: Omit<FaithOrganization, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FaithOrganization> {
  const id = `faith_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const result = await sql`
    INSERT INTO faith_organizations (
      id, name, type, ein, address, city, state, zip_code,
      denomination, senior_pastor_name, treasurer_name, weekly_attendance,
      created_at, updated_at
    ) VALUES (
      ${id}, ${org.name}, ${org.type}, ${org.ein || null},
      ${org.address || null}, ${org.city || null}, ${org.state || null}, ${org.zipCode || null},
      ${org.denomination || null}, ${org.seniorPastorName || null},
      ${org.treasurerName || null}, ${org.weeklyAttendance || null},
      NOW(), NOW()
    )
    RETURNING *
  `

  // Create default funds for the organization
  await initializeDefaultFunds(id)

  return mapOrganizationRow(result.rows[0])
}

/**
 * Initialize default funds for a new organization
 */
async function initializeDefaultFunds(organizationId: string): Promise<void> {
  const defaultFunds: Array<{ type: FundType; name: string; description: string }> = [
    {
      type: 'general',
      name: 'General Fund',
      description: 'Tithes and offerings for operational expenses, staff salaries, and ministry programs'
    },
    {
      type: 'building',
      name: 'Building Fund',
      description: 'Capital campaigns, facility maintenance, and future expansion'
    },
    {
      type: 'missions',
      name: 'Missions Fund',
      description: 'Support for missionaries, outreach programs, and global ministry partners'
    },
    {
      type: 'benevolence',
      name: 'Benevolence Fund',
      description: 'Emergency assistance and support for congregation members in need'
    },
  ]

  for (const fund of defaultFunds) {
    await sql`
      INSERT INTO faith_funds (
        id, organization_id, fund_type, name, description, balance,
        allocation_percentage, is_active, created_at, updated_at
      ) VALUES (
        ${`fund_${organizationId}_${fund.type}`},
        ${organizationId},
        ${fund.type},
        ${fund.name},
        ${fund.description},
        0,
        ${DEFAULT_ALLOCATION[fund.type]},
        true,
        NOW(), NOW()
      )
    `
  }

  // Create default allocation rule
  await sql`
    INSERT INTO faith_allocation_rules (
      id, organization_id, name, is_default,
      general_pct, building_pct, missions_pct, benevolence_pct,
      created_at
    ) VALUES (
      ${`rule_${organizationId}_default`},
      ${organizationId},
      'Default Tithe Allocation',
      true,
      ${DEFAULT_ALLOCATION.general},
      ${DEFAULT_ALLOCATION.building},
      ${DEFAULT_ALLOCATION.missions},
      ${DEFAULT_ALLOCATION.benevolence},
      NOW()
    )
  `
}

/**
 * Get organization by ID
 */
export async function getOrganization(id: string): Promise<FaithOrganization | null> {
  const result = await sql`
    SELECT * FROM faith_organizations WHERE id = ${id}
  `

  if (result.rows.length === 0) return null
  return mapOrganizationRow(result.rows[0])
}

// ============================================================================
// FUND MANAGEMENT
// ============================================================================

/**
 * Get all funds for an organization
 */
export async function getFunds(organizationId: string): Promise<FaithFund[]> {
  const result = await sql`
    SELECT * FROM faith_funds
    WHERE organization_id = ${organizationId}
    ORDER BY
      CASE fund_type
        WHEN 'general' THEN 1
        WHEN 'building' THEN 2
        WHEN 'missions' THEN 3
        WHEN 'benevolence' THEN 4
      END
  `

  return result.rows.map(mapFundRow)
}

/**
 * Get total treasury for organization
 */
export async function getTreasuryTotal(organizationId: string): Promise<{
  totalBalance: number
  fundBreakdown: Record<FundType, number>
  protectedAmount: number
  creditLineAvailable: number
}> {
  const funds = await getFunds(organizationId)

  const fundBreakdown = funds.reduce((acc, fund) => {
    acc[fund.fundType] = fund.balance
    return acc
  }, {} as Record<FundType, number>)

  const totalBalance = Object.values(fundBreakdown).reduce((a, b) => a + b, 0)

  // In GRAIN, deposits are 100% protected
  const protectedAmount = totalBalance

  // Credit line is 1:1 with deposits
  const creditLineAvailable = totalBalance

  return {
    totalBalance,
    fundBreakdown,
    protectedAmount,
    creditLineAvailable,
  }
}

/**
 * Update fund balance (internal use)
 */
async function updateFundBalance(
  fundId: string,
  amount: number,
  operation: 'add' | 'subtract'
): Promise<void> {
  if (operation === 'add') {
    await sql`
      UPDATE faith_funds
      SET balance = balance + ${amount}, updated_at = NOW()
      WHERE id = ${fundId}
    `
  } else {
    await sql`
      UPDATE faith_funds
      SET balance = balance - ${amount}, updated_at = NOW()
      WHERE id = ${fundId}
    `
  }
}

// ============================================================================
// TITHE & OFFERING PROCESSING
// ============================================================================

/**
 * Process a tithe or offering with automatic fund allocation
 *
 * "Bring the whole tithe into the storehouse, that there may be food in my house."
 * - Malachi 3:10
 */
export async function processTitheOffering(
  offering: Omit<TitheOffering, 'id' | 'grainAmount' | 'grainPriceAtTime' | 'receiptSent' | 'createdAt'>
): Promise<{ offering: TitheOffering; allocations: Record<FundType, number> }> {
  // Get current GRAIN price (mock - would call treasury API)
  const grainPrice = await getCurrentGrainPrice()
  const grainAmount = offering.amount / grainPrice

  const id = `tithe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Insert offering record
  const result = await sql`
    INSERT INTO faith_tithes (
      id, organization_id, donor_name, donor_email, amount, grain_amount,
      grain_price_at_time, is_anonymous, is_recurring, recurring_schedule,
      designation, split_allocations, notes, receipt_sent, created_at
    ) VALUES (
      ${id}, ${offering.organizationId},
      ${offering.isAnonymous ? null : offering.donorName},
      ${offering.isAnonymous ? null : offering.donorEmail},
      ${offering.amount}, ${grainAmount}, ${grainPrice},
      ${offering.isAnonymous}, ${offering.isRecurring},
      ${offering.recurringSchedule || null},
      ${offering.designation || 'split'},
      ${offering.splitAllocations ? JSON.stringify(offering.splitAllocations) : null},
      ${offering.notes || null},
      false, NOW()
    )
    RETURNING *
  `

  // Determine allocation
  let allocations: Record<FundType, number>

  if (offering.designation && offering.designation !== 'split') {
    // Single fund designation
    allocations = {
      general: 0,
      building: 0,
      missions: 0,
      benevolence: 0,
      [offering.designation]: offering.amount,
    }
  } else if (offering.splitAllocations) {
    // Custom split
    allocations = {
      general: (offering.splitAllocations.general || 0) / 100 * offering.amount,
      building: (offering.splitAllocations.building || 0) / 100 * offering.amount,
      missions: (offering.splitAllocations.missions || 0) / 100 * offering.amount,
      benevolence: (offering.splitAllocations.benevolence || 0) / 100 * offering.amount,
    }
  } else {
    // Use organization's default allocation
    const allocationRule = await getDefaultAllocationRule(offering.organizationId)
    allocations = {
      general: (allocationRule.general / 100) * offering.amount,
      building: (allocationRule.building / 100) * offering.amount,
      missions: (allocationRule.missions / 100) * offering.amount,
      benevolence: (allocationRule.benevolence / 100) * offering.amount,
    }
  }

  // Update fund balances
  for (const [fundType, amount] of Object.entries(allocations)) {
    if (amount > 0) {
      await sql`
        UPDATE faith_funds
        SET balance = balance + ${amount}, updated_at = NOW()
        WHERE organization_id = ${offering.organizationId} AND fund_type = ${fundType}
      `
    }
  }

  return {
    offering: mapTitheRow(result.rows[0]),
    allocations,
  }
}

/**
 * Get offering history for an organization
 */
export async function getOfferingHistory(
  organizationId: string,
  options?: {
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
  }
): Promise<{ offerings: TitheOffering[]; total: number; totalAmount: number }> {
  const limit = options?.limit || 50
  const offset = options?.offset || 0

  let query = sql`
    SELECT *, COUNT(*) OVER() as total_count, SUM(amount) OVER() as total_amount
    FROM faith_tithes
    WHERE organization_id = ${organizationId}
  `

  if (options?.startDate) {
    query = sql`${query} AND created_at >= ${options.startDate}`
  }

  if (options?.endDate) {
    query = sql`${query} AND created_at <= ${options.endDate}`
  }

  const result = await sql`
    SELECT *, COUNT(*) OVER() as total_count
    FROM faith_tithes
    WHERE organization_id = ${organizationId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  // Get totals
  const totalsResult = await sql`
    SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount
    FROM faith_tithes
    WHERE organization_id = ${organizationId}
  `

  return {
    offerings: result.rows.map(mapTitheRow),
    total: parseInt(totalsResult.rows[0]?.total || '0'),
    totalAmount: parseFloat(totalsResult.rows[0]?.total_amount || '0'),
  }
}

/**
 * Get allocation rule for organization
 */
async function getDefaultAllocationRule(
  organizationId: string
): Promise<AllocationRule['allocations']> {
  const result = await sql`
    SELECT * FROM faith_allocation_rules
    WHERE organization_id = ${organizationId} AND is_default = true
    LIMIT 1
  `

  if (result.rows.length === 0) {
    return DEFAULT_ALLOCATION
  }

  return {
    general: parseFloat(result.rows[0].general_pct),
    building: parseFloat(result.rows[0].building_pct),
    missions: parseFloat(result.rows[0].missions_pct),
    benevolence: parseFloat(result.rows[0].benevolence_pct),
  }
}

// ============================================================================
// MISSIONARY MANAGEMENT
// ============================================================================

/**
 * Add a missionary to the missions fund
 */
export async function addMissionary(
  missionary: Omit<Missionary, 'id'>
): Promise<Missionary> {
  const id = `missionary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const result = await sql`
    INSERT INTO faith_missionaries (
      id, organization_id, name, field, organization, email,
      monthly_support, start_date, status, notes
    ) VALUES (
      ${id}, ${missionary.organizationId}, ${missionary.name},
      ${missionary.field}, ${missionary.organization || null},
      ${missionary.email || null}, ${missionary.monthlySupport},
      ${missionary.startDate}, ${missionary.status}, ${missionary.notes || null}
    )
    RETURNING *
  `

  return mapMissionaryRow(result.rows[0])
}

/**
 * Get all missionaries for an organization
 */
export async function getMissionaries(
  organizationId: string,
  status?: Missionary['status']
): Promise<Missionary[]> {
  let result

  if (status) {
    result = await sql`
      SELECT * FROM faith_missionaries
      WHERE organization_id = ${organizationId} AND status = ${status}
      ORDER BY name
    `
  } else {
    result = await sql`
      SELECT * FROM faith_missionaries
      WHERE organization_id = ${organizationId}
      ORDER BY name
    `
  }

  return result.rows.map(mapMissionaryRow)
}

/**
 * Calculate total monthly missions commitment
 */
export async function getMissionsCommitment(organizationId: string): Promise<{
  monthlyTotal: number
  missionaryCount: number
  missionaries: Array<{ name: string; field: string; amount: number }>
}> {
  const missionaries = await getMissionaries(organizationId, 'active')

  return {
    monthlyTotal: missionaries.reduce((sum, m) => sum + m.monthlySupport, 0),
    missionaryCount: missionaries.length,
    missionaries: missionaries.map(m => ({
      name: m.name,
      field: m.field,
      amount: m.monthlySupport,
    })),
  }
}

// ============================================================================
// BENEVOLENCE MANAGEMENT
// ============================================================================

/**
 * Submit a benevolence request
 *
 * "Give to the one who asks you, and do not turn away from the one who wants to borrow from you."
 * - Matthew 5:42
 */
export async function submitBenevolenceRequest(
  request: Omit<BenevolenceRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<BenevolenceRequest> {
  const id = `benev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const result = await sql`
    INSERT INTO faith_benevolence_requests (
      id, organization_id, requestor_name, requestor_contact, category,
      amount_requested, description, urgency, status, is_confidential,
      created_at, updated_at
    ) VALUES (
      ${id}, ${request.organizationId}, ${request.requestorName},
      ${request.requestorContact || null}, ${request.category},
      ${request.amountRequested}, ${request.description}, ${request.urgency},
      'pending', ${request.isConfidential}, NOW(), NOW()
    )
    RETURNING *
  `

  return mapBenevolenceRow(result.rows[0])
}

/**
 * Get benevolence requests for an organization
 */
export async function getBenevolenceRequests(
  organizationId: string,
  options?: {
    status?: BenevolenceRequest['status']
    limit?: number
    includeConfidential?: boolean
  }
): Promise<BenevolenceRequest[]> {
  const limit = options?.limit || 50

  let result

  if (options?.status) {
    result = await sql`
      SELECT * FROM faith_benevolence_requests
      WHERE organization_id = ${organizationId}
        AND status = ${options.status}
        ${options?.includeConfidential ? sql`` : sql`AND is_confidential = false`}
      ORDER BY
        CASE urgency WHEN 'immediate' THEN 1 WHEN 'within_week' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT ${limit}
    `
  } else {
    result = await sql`
      SELECT * FROM faith_benevolence_requests
      WHERE organization_id = ${organizationId}
        ${options?.includeConfidential ? sql`` : sql`AND is_confidential = false`}
      ORDER BY
        CASE status WHEN 'pending' THEN 1 WHEN 'under_review' THEN 2 WHEN 'approved' THEN 3 ELSE 4 END,
        CASE urgency WHEN 'immediate' THEN 1 WHEN 'within_week' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT ${limit}
    `
  }

  return result.rows.map(mapBenevolenceRow)
}

/**
 * Review a benevolence request
 */
export async function reviewBenevolenceRequest(
  requestId: string,
  review: {
    status: 'approved' | 'denied'
    amountApproved?: number
    reviewedBy: string
    reviewNotes?: string
    disbursementMethod?: BenevolenceRequest['disbursementMethod']
    vendorName?: string
  }
): Promise<BenevolenceRequest> {
  const result = await sql`
    UPDATE faith_benevolence_requests
    SET
      status = ${review.status},
      amount_approved = ${review.amountApproved || null},
      reviewed_by = ${review.reviewedBy},
      review_notes = ${review.reviewNotes || null},
      disbursement_method = ${review.disbursementMethod || null},
      vendor_name = ${review.vendorName || null},
      updated_at = NOW()
    WHERE id = ${requestId}
    RETURNING *
  `

  return mapBenevolenceRow(result.rows[0])
}

/**
 * Process benevolence disbursement
 * Draws from credit line to immediately help those in need
 */
export async function processBenevolenceDisbursement(
  requestId: string,
  approvedBy: string
): Promise<{ success: boolean; disbursement?: Disbursement; error?: string }> {
  // Get the request
  const requestResult = await sql`
    SELECT * FROM faith_benevolence_requests WHERE id = ${requestId}
  `

  if (requestResult.rows.length === 0) {
    return { success: false, error: 'Request not found' }
  }

  const request = mapBenevolenceRow(requestResult.rows[0])

  if (request.status !== 'approved') {
    return { success: false, error: 'Request must be approved before disbursement' }
  }

  const amount = request.amountApproved || request.amountRequested

  // Check benevolence fund balance
  const fundsResult = await sql`
    SELECT balance FROM faith_funds
    WHERE organization_id = ${request.organizationId} AND fund_type = 'benevolence'
  `

  const benevolenceBalance = parseFloat(fundsResult.rows[0]?.balance || '0')

  // Can use credit line if fund balance is low
  // This allows immediate help even when fund is depleted
  const usesCreditLine = amount > benevolenceBalance

  // Create disbursement record
  const disbursementId = `disb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const grainPrice = await getCurrentGrainPrice()

  await sql`
    INSERT INTO faith_disbursements (
      id, organization_id, fund_type, amount, grain_amount, recipient,
      category, description, approved_by, status, payment_method,
      reference_id, created_at
    ) VALUES (
      ${disbursementId}, ${request.organizationId}, 'benevolence',
      ${amount}, ${amount / grainPrice}, ${request.requestorName},
      'benevolence', ${`Benevolence assistance: ${request.category}`},
      ${approvedBy}, 'completed', ${request.disbursementMethod || 'check'},
      ${requestId}, NOW()
    )
  `

  // Update benevolence fund balance
  await sql`
    UPDATE faith_funds
    SET balance = balance - ${Math.min(amount, benevolenceBalance)}, updated_at = NOW()
    WHERE organization_id = ${request.organizationId} AND fund_type = 'benevolence'
  `

  // Mark request as disbursed
  await sql`
    UPDATE faith_benevolence_requests
    SET status = 'disbursed', updated_at = NOW()
    WHERE id = ${requestId}
  `

  return {
    success: true,
    disbursement: {
      id: disbursementId,
      organizationId: request.organizationId,
      fundType: 'benevolence',
      amount,
      grainAmount: amount / grainPrice,
      recipient: request.requestorName,
      category: 'benevolence',
      description: `Benevolence assistance: ${request.category}`,
      approvedBy,
      status: 'completed',
      paymentMethod: (request.disbursementMethod as any) || 'check',
      referenceId: requestId,
      createdAt: new Date(),
    },
  }
}

// ============================================================================
// DISBURSEMENTS
// ============================================================================

/**
 * Create a disbursement from any fund
 */
export async function createDisbursement(
  disbursement: Omit<Disbursement, 'id' | 'grainAmount' | 'status' | 'createdAt'>
): Promise<{ success: boolean; disbursement?: Disbursement; error?: string }> {
  // Check fund balance
  const fundsResult = await sql`
    SELECT balance FROM faith_funds
    WHERE organization_id = ${disbursement.organizationId} AND fund_type = ${disbursement.fundType}
  `

  const fundBalance = parseFloat(fundsResult.rows[0]?.balance || '0')

  if (disbursement.amount > fundBalance) {
    // Can still proceed with credit line, but log it
    console.log(`[Faith] Disbursement exceeds fund balance, using credit line`)
  }

  const id = `disb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const grainPrice = await getCurrentGrainPrice()

  const result = await sql`
    INSERT INTO faith_disbursements (
      id, organization_id, fund_type, amount, grain_amount, recipient,
      category, description, approved_by, status, payment_method,
      reference_id, created_at
    ) VALUES (
      ${id}, ${disbursement.organizationId}, ${disbursement.fundType},
      ${disbursement.amount}, ${disbursement.amount / grainPrice},
      ${disbursement.recipient}, ${disbursement.category},
      ${disbursement.description}, ${disbursement.approvedBy},
      'pending', ${disbursement.paymentMethod},
      ${disbursement.referenceId || null}, NOW()
    )
    RETURNING *
  `

  // Deduct from fund balance (up to available balance)
  const deductAmount = Math.min(disbursement.amount, fundBalance)
  if (deductAmount > 0) {
    await sql`
      UPDATE faith_funds
      SET balance = balance - ${deductAmount}, updated_at = NOW()
      WHERE organization_id = ${disbursement.organizationId} AND fund_type = ${disbursement.fundType}
    `
  }

  return {
    success: true,
    disbursement: mapDisbursementRow(result.rows[0]),
  }
}

/**
 * Get disbursement history
 */
export async function getDisbursements(
  organizationId: string,
  options?: {
    fundType?: FundType
    category?: Disbursement['category']
    limit?: number
  }
): Promise<Disbursement[]> {
  const limit = options?.limit || 50

  let result

  if (options?.fundType && options?.category) {
    result = await sql`
      SELECT * FROM faith_disbursements
      WHERE organization_id = ${organizationId}
        AND fund_type = ${options.fundType}
        AND category = ${options.category}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  } else if (options?.fundType) {
    result = await sql`
      SELECT * FROM faith_disbursements
      WHERE organization_id = ${organizationId} AND fund_type = ${options.fundType}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  } else if (options?.category) {
    result = await sql`
      SELECT * FROM faith_disbursements
      WHERE organization_id = ${organizationId} AND category = ${options.category}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  } else {
    result = await sql`
      SELECT * FROM faith_disbursements
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  }

  return result.rows.map(mapDisbursementRow)
}

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

/**
 * Get giving analytics for dashboard
 */
export async function getGivingAnalytics(
  organizationId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<{
  totalGiving: number
  givingCount: number
  averageGift: number
  recurringGiving: number
  recurringPercentage: number
  byFund: Record<FundType, number>
  trend: Array<{ date: string; amount: number }>
}> {
  const intervals: Record<string, string> = {
    week: '7 days',
    month: '30 days',
    quarter: '90 days',
    year: '365 days',
  }

  const interval = intervals[period]

  // Get totals
  const totalsResult = await sql`
    SELECT
      COALESCE(SUM(amount), 0) as total,
      COUNT(*) as count,
      COALESCE(SUM(CASE WHEN is_recurring THEN amount ELSE 0 END), 0) as recurring_total
    FROM faith_tithes
    WHERE organization_id = ${organizationId}
      AND created_at >= NOW() - INTERVAL '${sql.raw(interval)}'
  `

  const total = parseFloat(totalsResult.rows[0]?.total || '0')
  const count = parseInt(totalsResult.rows[0]?.count || '0')
  const recurringTotal = parseFloat(totalsResult.rows[0]?.recurring_total || '0')

  // Get by fund
  const funds = await getFunds(organizationId)
  const byFund = funds.reduce((acc, fund) => {
    acc[fund.fundType] = fund.balance
    return acc
  }, {} as Record<FundType, number>)

  // Get trend data (daily totals)
  const trendResult = await sql`
    SELECT
      DATE(created_at) as date,
      COALESCE(SUM(amount), 0) as amount
    FROM faith_tithes
    WHERE organization_id = ${organizationId}
      AND created_at >= NOW() - INTERVAL '${sql.raw(interval)}'
    GROUP BY DATE(created_at)
    ORDER BY date
  `

  return {
    totalGiving: total,
    givingCount: count,
    averageGift: count > 0 ? total / count : 0,
    recurringGiving: recurringTotal,
    recurringPercentage: total > 0 ? (recurringTotal / total) * 100 : 0,
    byFund,
    trend: trendResult.rows.map(row => ({
      date: row.date,
      amount: parseFloat(row.amount),
    })),
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getCurrentGrainPrice(): Promise<number> {
  // In production, this would call the treasury API
  // For now, return a mock price
  return 1.045 // GRAIN appreciates ~4.5% annually
}

// Row mappers
function mapOrganizationRow(row: any): FaithOrganization {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    ein: row.ein,
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    denomination: row.denomination,
    seniorPastorName: row.senior_pastor_name,
    treasurerName: row.treasurer_name,
    weeklyAttendance: row.weekly_attendance ? parseInt(row.weekly_attendance) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapFundRow(row: any): FaithFund {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fundType: row.fund_type,
    name: row.name,
    description: row.description,
    balance: parseFloat(row.balance),
    targetAmount: row.target_amount ? parseFloat(row.target_amount) : undefined,
    allocationPercentage: row.allocation_percentage ? parseFloat(row.allocation_percentage) : undefined,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapTitheRow(row: any): TitheOffering {
  return {
    id: row.id,
    organizationId: row.organization_id,
    donorName: row.donor_name,
    donorEmail: row.donor_email,
    amount: parseFloat(row.amount),
    grainAmount: parseFloat(row.grain_amount),
    grainPriceAtTime: parseFloat(row.grain_price_at_time),
    isAnonymous: row.is_anonymous,
    isRecurring: row.is_recurring,
    recurringSchedule: row.recurring_schedule,
    designation: row.designation,
    splitAllocations: row.split_allocations ? JSON.parse(row.split_allocations) : undefined,
    notes: row.notes,
    receiptSent: row.receipt_sent,
    createdAt: new Date(row.created_at),
  }
}

function mapMissionaryRow(row: any): Missionary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    field: row.field,
    organization: row.organization,
    email: row.email,
    monthlySupport: parseFloat(row.monthly_support),
    startDate: new Date(row.start_date),
    status: row.status,
    notes: row.notes,
  }
}

function mapBenevolenceRow(row: any): BenevolenceRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requestorName: row.requestor_name,
    requestorContact: row.requestor_contact,
    category: row.category,
    amountRequested: parseFloat(row.amount_requested),
    amountApproved: row.amount_approved ? parseFloat(row.amount_approved) : undefined,
    description: row.description,
    urgency: row.urgency,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewNotes: row.review_notes,
    disbursementMethod: row.disbursement_method,
    vendorName: row.vendor_name,
    isConfidential: row.is_confidential,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapDisbursementRow(row: any): Disbursement {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fundType: row.fund_type,
    amount: parseFloat(row.amount),
    grainAmount: parseFloat(row.grain_amount),
    recipient: row.recipient,
    category: row.category,
    description: row.description,
    approvedBy: row.approved_by,
    status: row.status,
    paymentMethod: row.payment_method,
    referenceId: row.reference_id,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  }
}
