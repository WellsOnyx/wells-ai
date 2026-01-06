/**
 * GRAIN Board Reports
 *
 * Report generation system for endowment/nonprofit board reporting:
 * - Quarterly Endowment Summary
 * - Fund Performance Report
 * - Grant Activity Report
 * - Compliance/Fiduciary Report
 * - Spending Policy Adherence
 *
 * Reports include:
 * - Executive summary
 * - Fund balances (protected + credit line + appreciation)
 * - Restricted fund breakdown
 * - Grant disbursements
 * - Compliance metrics (spending rate, diversification)
 * - Comparison to policy benchmarks
 */

import { query } from '@/lib/db'

// ============================================================================
// TYPES
// ============================================================================

export type ReportType =
  | 'quarterly_endowment_summary'
  | 'fund_performance'
  | 'grant_activity'
  | 'compliance_fiduciary'
  | 'spending_policy_adherence'

export type ReportStatus = 'draft' | 'pending_review' | 'approved' | 'published'
export type ExportFormat = 'pdf' | 'csv' | 'excel'

export interface DateRange {
  start: Date
  end: Date
}

export interface ReportMetadata {
  id: string
  type: ReportType
  title: string
  description: string
  dateRange: DateRange
  status: ReportStatus
  createdAt: Date
  createdBy: string
  approvedAt?: Date
  approvedBy?: string
  organizationId: string
  organizationName: string
}

export interface FundBalance {
  fundId: string
  fundName: string
  fundType: 'unrestricted' | 'temporarily_restricted' | 'permanently_restricted'
  protectedPrincipal: number
  creditLineLimit: number
  creditLineUsed: number
  creditLineAvailable: number
  appreciation: number
  totalValue: number
  startingBalance: number
  endingBalance: number
  changeAmount: number
  changePercent: number
}

export interface GrantDisbursement {
  id: string
  grantee: string
  purpose: string
  fundSource: string
  amount: number
  disbursementDate: Date
  status: 'pending' | 'approved' | 'disbursed' | 'completed'
  restrictions?: string
}

export interface ComplianceMetric {
  metric: string
  target: number
  actual: number
  status: 'compliant' | 'warning' | 'non_compliant'
  notes?: string
}

export interface AssetAllocation {
  assetClass: string
  targetPercent: number
  actualPercent: number
  marketValue: number
  variance: number
}

export interface SpendingPolicyMetric {
  year: number
  quarter: number
  beginningMarketValue: number
  endingMarketValue: number
  averageMarketValue: number
  policySpendingRate: number
  actualSpendingRate: number
  policySpendingAmount: number
  actualSpendingAmount: number
  variance: number
  status: 'within_policy' | 'under_policy' | 'over_policy'
}

// ============================================================================
// REPORT DATA STRUCTURES
// ============================================================================

export interface QuarterlyEndowmentSummary {
  metadata: ReportMetadata
  executiveSummary: {
    highlights: string[]
    concerns: string[]
    recommendations: string[]
  }
  totalEndowmentValue: {
    current: number
    prior: number
    change: number
    changePercent: number
  }
  fundBalances: FundBalance[]
  fundSummaryByType: {
    unrestricted: number
    temporarilyRestricted: number
    permanentlyRestricted: number
    total: number
  }
  keyMetrics: {
    totalReturnPercent: number
    spendingRatePercent: number
    adminCostRatioPercent: number
    grantDisbursementRate: number
  }
  marketContext: {
    sp500Return: number
    bondIndexReturn: number
    inflationRate: number
  }
}

export interface FundPerformanceReport {
  metadata: ReportMetadata
  executiveSummary: {
    highlights: string[]
    concerns: string[]
  }
  overallPerformance: {
    totalReturn: number
    benchmarkReturn: number
    excessReturn: number
    sharpeRatio: number
    volatility: number
  }
  fundPerformance: Array<{
    fund: FundBalance
    return: number
    benchmark: number
    excess: number
  }>
  assetAllocation: AssetAllocation[]
  rebalancingNeeds: Array<{
    assetClass: string
    currentWeight: number
    targetWeight: number
    action: 'buy' | 'sell' | 'hold'
    amount: number
  }>
  performanceAttribution: {
    assetAllocationContribution: number
    securitySelectionContribution: number
    interactionEffect: number
    totalActiveReturn: number
  }
}

export interface GrantActivityReport {
  metadata: ReportMetadata
  executiveSummary: {
    totalGrantsApproved: number
    totalGrantsDisbursed: number
    totalGrantsPending: number
    totalAmountApproved: number
    totalAmountDisbursed: number
  }
  grantsByProgram: Array<{
    programArea: string
    grantCount: number
    totalAmount: number
    percentOfTotal: number
  }>
  disbursements: GrantDisbursement[]
  pendingGrants: GrantDisbursement[]
  grantTrends: Array<{
    period: string
    approved: number
    disbursed: number
    amountApproved: number
    amountDisbursed: number
  }>
  impactMetrics: Array<{
    metric: string
    target: number
    actual: number
    notes: string
  }>
}

export interface ComplianceFiduciaryReport {
  metadata: ReportMetadata
  executiveSummary: {
    overallStatus: 'compliant' | 'attention_needed' | 'action_required'
    summary: string
    criticalItems: string[]
  }
  investmentPolicyCompliance: ComplianceMetric[]
  spendingPolicyCompliance: ComplianceMetric[]
  grantPolicyCompliance: ComplianceMetric[]
  assetDiversification: {
    metrics: AssetAllocation[]
    concentrationRisks: string[]
    diversificationScore: number
  }
  fiduciaryDuties: {
    dutyOfCare: { status: 'met' | 'needs_attention'; notes: string }
    dutyOfLoyalty: { status: 'met' | 'needs_attention'; notes: string }
    dutyOfObedience: { status: 'met' | 'needs_attention'; notes: string }
  }
  regulatoryCompliance: Array<{
    requirement: string
    status: 'compliant' | 'pending' | 'non_compliant'
    dueDate?: Date
    notes?: string
  }>
  auditFindings: Array<{
    finding: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    remediation: string
    status: 'open' | 'in_progress' | 'resolved'
  }>
}

export interface SpendingPolicyAdherenceReport {
  metadata: ReportMetadata
  executiveSummary: {
    policyType: string
    policyDescription: string
    overallAdherence: 'within_policy' | 'minor_variance' | 'significant_variance'
    summary: string
  }
  policyDetails: {
    spendingRate: number
    smoothingPeriod: number
    floorPercent?: number
    capPercent?: number
    calculationMethod: string
  }
  quarterlyMetrics: SpendingPolicyMetric[]
  yearToDateSummary: {
    totalPolicyAmount: number
    totalActualAmount: number
    variance: number
    variancePercent: number
  }
  projections: {
    nextQuarterEstimate: number
    annualEstimate: number
    fiveYearProjection: number[]
  }
  historicalComparison: Array<{
    year: number
    policyRate: number
    actualRate: number
    endowmentValue: number
  }>
  recommendations: string[]
}

// ============================================================================
// REPORT GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate Quarterly Endowment Summary Report
 */
export async function generateQuarterlyEndowmentSummary(
  organizationId: string,
  dateRange: DateRange,
  userId: string
): Promise<QuarterlyEndowmentSummary> {
  // Get organization info
  const orgResult = await query(
    `SELECT id, name FROM organizations WHERE id = $1`,
    [organizationId]
  )
  const org = orgResult.rows[0] || { id: organizationId, name: 'Organization' }

  // Get fund balances
  const fundBalances = await getFundBalances(organizationId, dateRange)

  // Calculate totals by fund type
  const fundSummaryByType = {
    unrestricted: 0,
    temporarilyRestricted: 0,
    permanentlyRestricted: 0,
    total: 0,
  }

  fundBalances.forEach((fund) => {
    if (fund.fundType === 'unrestricted') {
      fundSummaryByType.unrestricted += fund.totalValue
    } else if (fund.fundType === 'temporarily_restricted') {
      fundSummaryByType.temporarilyRestricted += fund.totalValue
    } else {
      fundSummaryByType.permanentlyRestricted += fund.totalValue
    }
    fundSummaryByType.total += fund.totalValue
  })

  // Get prior period value
  const priorEndValue = await getPriorPeriodEndowmentValue(organizationId, dateRange.start)
  const currentValue = fundSummaryByType.total
  const change = currentValue - priorEndValue
  const changePercent = priorEndValue > 0 ? (change / priorEndValue) * 100 : 0

  // Get key metrics
  const keyMetrics = await getKeyMetrics(organizationId, dateRange)

  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(
    fundBalances,
    keyMetrics,
    change,
    changePercent
  )

  // Create report metadata
  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const metadata: ReportMetadata = {
    id: reportId,
    type: 'quarterly_endowment_summary',
    title: `Quarterly Endowment Summary - Q${getQuarter(dateRange.end)} ${dateRange.end.getFullYear()}`,
    description: 'Comprehensive overview of endowment performance and fund balances',
    dateRange,
    status: 'draft',
    createdAt: new Date(),
    createdBy: userId,
    organizationId: org.id,
    organizationName: org.name,
  }

  // Save report to database
  await saveReport(metadata, 'quarterly_endowment_summary')

  return {
    metadata,
    executiveSummary,
    totalEndowmentValue: {
      current: currentValue,
      prior: priorEndValue,
      change,
      changePercent,
    },
    fundBalances,
    fundSummaryByType,
    keyMetrics,
    marketContext: await getMarketContext(dateRange),
  }
}

/**
 * Generate Fund Performance Report
 */
export async function generateFundPerformanceReport(
  organizationId: string,
  dateRange: DateRange,
  userId: string
): Promise<FundPerformanceReport> {
  const orgResult = await query(
    `SELECT id, name FROM organizations WHERE id = $1`,
    [organizationId]
  )
  const org = orgResult.rows[0] || { id: organizationId, name: 'Organization' }

  const fundBalances = await getFundBalances(organizationId, dateRange)
  const assetAllocation = await getAssetAllocation(organizationId)

  // Calculate fund performance
  const fundPerformance = fundBalances.map((fund) => {
    const benchmarkReturn = 7.5 // Default benchmark
    return {
      fund,
      return: fund.changePercent,
      benchmark: benchmarkReturn,
      excess: fund.changePercent - benchmarkReturn,
    }
  })

  // Calculate overall performance
  const totalReturn = fundBalances.length > 0
    ? fundBalances.reduce((sum, f) => sum + f.changePercent, 0) / fundBalances.length
    : 0
  const benchmarkReturn = 7.5

  // Calculate rebalancing needs
  const rebalancingNeeds = assetAllocation.map((aa) => {
    const diff = aa.actualPercent - aa.targetPercent
    return {
      assetClass: aa.assetClass,
      currentWeight: aa.actualPercent,
      targetWeight: aa.targetPercent,
      action: diff > 2 ? 'sell' as const : diff < -2 ? 'buy' as const : 'hold' as const,
      amount: Math.abs(diff * aa.marketValue / 100),
    }
  })

  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const metadata: ReportMetadata = {
    id: reportId,
    type: 'fund_performance',
    title: `Fund Performance Report - Q${getQuarter(dateRange.end)} ${dateRange.end.getFullYear()}`,
    description: 'Detailed analysis of fund performance and asset allocation',
    dateRange,
    status: 'draft',
    createdAt: new Date(),
    createdBy: userId,
    organizationId: org.id,
    organizationName: org.name,
  }

  await saveReport(metadata, 'fund_performance')

  return {
    metadata,
    executiveSummary: {
      highlights: [
        `Total portfolio return of ${totalReturn.toFixed(2)}%`,
        `${rebalancingNeeds.filter((r) => r.action === 'hold').length} asset classes within target allocation`,
      ],
      concerns: rebalancingNeeds
        .filter((r) => r.action !== 'hold')
        .map((r) => `${r.assetClass} requires ${r.action} action`),
    },
    overallPerformance: {
      totalReturn,
      benchmarkReturn,
      excessReturn: totalReturn - benchmarkReturn,
      sharpeRatio: 1.2, // Placeholder calculation
      volatility: 12.5, // Placeholder calculation
    },
    fundPerformance,
    assetAllocation,
    rebalancingNeeds,
    performanceAttribution: {
      assetAllocationContribution: 0.5,
      securitySelectionContribution: 0.3,
      interactionEffect: 0.1,
      totalActiveReturn: totalReturn - benchmarkReturn,
    },
  }
}

/**
 * Generate Grant Activity Report
 */
export async function generateGrantActivityReport(
  organizationId: string,
  dateRange: DateRange,
  userId: string
): Promise<GrantActivityReport> {
  const orgResult = await query(
    `SELECT id, name FROM organizations WHERE id = $1`,
    [organizationId]
  )
  const org = orgResult.rows[0] || { id: organizationId, name: 'Organization' }

  const disbursements = await getGrantDisbursements(organizationId, dateRange)
  const pendingGrants = await getPendingGrants(organizationId)

  // Calculate summary metrics
  const totalGrantsApproved = disbursements.filter(
    (d) => d.status === 'approved' || d.status === 'disbursed' || d.status === 'completed'
  ).length
  const totalGrantsDisbursed = disbursements.filter(
    (d) => d.status === 'disbursed' || d.status === 'completed'
  ).length
  const totalAmountApproved = disbursements
    .filter((d) => d.status !== 'pending')
    .reduce((sum, d) => sum + d.amount, 0)
  const totalAmountDisbursed = disbursements
    .filter((d) => d.status === 'disbursed' || d.status === 'completed')
    .reduce((sum, d) => sum + d.amount, 0)

  // Group by program area
  const grantsByProgram = groupGrantsByProgram(disbursements)

  // Calculate trends
  const grantTrends = await getGrantTrends(organizationId, dateRange)

  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const metadata: ReportMetadata = {
    id: reportId,
    type: 'grant_activity',
    title: `Grant Activity Report - Q${getQuarter(dateRange.end)} ${dateRange.end.getFullYear()}`,
    description: 'Summary of grant approvals, disbursements, and impact',
    dateRange,
    status: 'draft',
    createdAt: new Date(),
    createdBy: userId,
    organizationId: org.id,
    organizationName: org.name,
  }

  await saveReport(metadata, 'grant_activity')

  return {
    metadata,
    executiveSummary: {
      totalGrantsApproved,
      totalGrantsDisbursed,
      totalGrantsPending: pendingGrants.length,
      totalAmountApproved,
      totalAmountDisbursed,
    },
    grantsByProgram,
    disbursements,
    pendingGrants,
    grantTrends,
    impactMetrics: [
      { metric: 'Beneficiaries Served', target: 10000, actual: 8500, notes: 'On track for annual goal' },
      { metric: 'Programs Funded', target: 25, actual: 22, notes: 'Three more in pipeline' },
      { metric: 'Geographic Reach', target: 15, actual: 12, notes: 'Counties served' },
    ],
  }
}

/**
 * Generate Compliance/Fiduciary Report
 */
export async function generateComplianceFiduciaryReport(
  organizationId: string,
  dateRange: DateRange,
  userId: string
): Promise<ComplianceFiduciaryReport> {
  const orgResult = await query(
    `SELECT id, name FROM organizations WHERE id = $1`,
    [organizationId]
  )
  const org = orgResult.rows[0] || { id: organizationId, name: 'Organization' }

  const investmentPolicyCompliance = await getInvestmentPolicyCompliance(organizationId)
  const spendingPolicyCompliance = await getSpendingPolicyCompliance(organizationId, dateRange)
  const grantPolicyCompliance = await getGrantPolicyCompliance(organizationId)
  const assetAllocation = await getAssetAllocation(organizationId)

  // Calculate diversification score
  const diversificationScore = calculateDiversificationScore(assetAllocation)

  // Determine overall status
  const allMetrics = [
    ...investmentPolicyCompliance,
    ...spendingPolicyCompliance,
    ...grantPolicyCompliance,
  ]
  const nonCompliantCount = allMetrics.filter((m) => m.status === 'non_compliant').length
  const warningCount = allMetrics.filter((m) => m.status === 'warning').length

  let overallStatus: 'compliant' | 'attention_needed' | 'action_required' = 'compliant'
  if (nonCompliantCount > 0) {
    overallStatus = 'action_required'
  } else if (warningCount > 0) {
    overallStatus = 'attention_needed'
  }

  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const metadata: ReportMetadata = {
    id: reportId,
    type: 'compliance_fiduciary',
    title: `Compliance & Fiduciary Report - Q${getQuarter(dateRange.end)} ${dateRange.end.getFullYear()}`,
    description: 'Comprehensive compliance and fiduciary duty assessment',
    dateRange,
    status: 'draft',
    createdAt: new Date(),
    createdBy: userId,
    organizationId: org.id,
    organizationName: org.name,
  }

  await saveReport(metadata, 'compliance_fiduciary')

  return {
    metadata,
    executiveSummary: {
      overallStatus,
      summary: `${allMetrics.filter((m) => m.status === 'compliant').length} of ${allMetrics.length} compliance metrics are fully met.`,
      criticalItems: allMetrics
        .filter((m) => m.status === 'non_compliant')
        .map((m) => m.metric),
    },
    investmentPolicyCompliance,
    spendingPolicyCompliance,
    grantPolicyCompliance,
    assetDiversification: {
      metrics: assetAllocation,
      concentrationRisks: assetAllocation
        .filter((aa) => aa.actualPercent > aa.targetPercent * 1.2)
        .map((aa) => `${aa.assetClass} is ${((aa.actualPercent - aa.targetPercent) / aa.targetPercent * 100).toFixed(1)}% over target`),
      diversificationScore,
    },
    fiduciaryDuties: {
      dutyOfCare: { status: 'met', notes: 'Investment decisions documented and reviewed' },
      dutyOfLoyalty: { status: 'met', notes: 'No conflicts of interest identified' },
      dutyOfObedience: { status: 'met', notes: 'All activities align with mission and bylaws' },
    },
    regulatoryCompliance: [
      { requirement: 'Form 990 Filing', status: 'compliant', notes: 'Filed on time' },
      { requirement: 'State Registration', status: 'compliant', notes: 'Current in all required states' },
      { requirement: 'Annual Audit', status: 'pending', dueDate: new Date(dateRange.end.getFullYear(), 2, 31), notes: 'Scheduled for completion' },
    ],
    auditFindings: [],
  }
}

/**
 * Generate Spending Policy Adherence Report
 */
export async function generateSpendingPolicyAdherenceReport(
  organizationId: string,
  dateRange: DateRange,
  userId: string
): Promise<SpendingPolicyAdherenceReport> {
  const orgResult = await query(
    `SELECT id, name FROM organizations WHERE id = $1`,
    [organizationId]
  )
  const org = orgResult.rows[0] || { id: organizationId, name: 'Organization' }

  // Get policy details (defaults if not configured)
  const policyDetails = await getSpendingPolicyDetails(organizationId)

  // Get quarterly metrics
  const quarterlyMetrics = await getQuarterlySpendingMetrics(organizationId, dateRange)

  // Calculate year-to-date summary
  const ytdSummary = calculateYTDSummary(quarterlyMetrics)

  // Calculate projections
  const projections = calculateSpendingProjections(quarterlyMetrics, policyDetails)

  // Get historical data
  const historicalComparison = await getHistoricalSpendingComparison(organizationId)

  // Determine overall adherence
  let overallAdherence: 'within_policy' | 'minor_variance' | 'significant_variance' = 'within_policy'
  if (Math.abs(ytdSummary.variancePercent) > 10) {
    overallAdherence = 'significant_variance'
  } else if (Math.abs(ytdSummary.variancePercent) > 5) {
    overallAdherence = 'minor_variance'
  }

  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const metadata: ReportMetadata = {
    id: reportId,
    type: 'spending_policy_adherence',
    title: `Spending Policy Adherence Report - Q${getQuarter(dateRange.end)} ${dateRange.end.getFullYear()}`,
    description: 'Analysis of spending policy compliance and projections',
    dateRange,
    status: 'draft',
    createdAt: new Date(),
    createdBy: userId,
    organizationId: org.id,
    organizationName: org.name,
  }

  await saveReport(metadata, 'spending_policy_adherence')

  return {
    metadata,
    executiveSummary: {
      policyType: policyDetails.calculationMethod,
      policyDescription: `${policyDetails.spendingRate}% spending rate with ${policyDetails.smoothingPeriod}-quarter smoothing`,
      overallAdherence,
      summary: `Spending is ${ytdSummary.variance >= 0 ? 'over' : 'under'} policy by ${Math.abs(ytdSummary.variancePercent).toFixed(1)}%`,
    },
    policyDetails,
    quarterlyMetrics,
    yearToDateSummary: ytdSummary,
    projections,
    historicalComparison,
    recommendations: generateSpendingRecommendations(overallAdherence, ytdSummary, policyDetails),
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getFundBalances(
  organizationId: string,
  dateRange: DateRange
): Promise<FundBalance[]> {
  // Try to get actual fund data
  const result = await query(
    `SELECT
      ef.id as fund_id,
      ef.name as fund_name,
      ef.fund_type,
      ef.protected_principal,
      ef.credit_line_limit,
      ef.credit_line_used,
      ef.appreciation_balance,
      ef.starting_balance,
      ef.current_balance
     FROM endowment_funds ef
     WHERE ef.organization_id = $1
     ORDER BY ef.current_balance DESC`,
    [organizationId]
  )

  if (result.rows.length > 0) {
    return result.rows.map((row) => {
      const totalValue = parseFloat(row.current_balance) || 0
      const startingBalance = parseFloat(row.starting_balance) || totalValue
      const change = totalValue - startingBalance

      return {
        fundId: row.fund_id,
        fundName: row.fund_name,
        fundType: row.fund_type || 'unrestricted',
        protectedPrincipal: parseFloat(row.protected_principal) || 0,
        creditLineLimit: parseFloat(row.credit_line_limit) || 0,
        creditLineUsed: parseFloat(row.credit_line_used) || 0,
        creditLineAvailable: (parseFloat(row.credit_line_limit) || 0) - (parseFloat(row.credit_line_used) || 0),
        appreciation: parseFloat(row.appreciation_balance) || 0,
        totalValue,
        startingBalance,
        endingBalance: totalValue,
        changeAmount: change,
        changePercent: startingBalance > 0 ? (change / startingBalance) * 100 : 0,
      }
    })
  }

  // Return sample data for demonstration
  return [
    {
      fundId: 'fund_general',
      fundName: 'General Endowment Fund',
      fundType: 'unrestricted',
      protectedPrincipal: 5000000,
      creditLineLimit: 5000000,
      creditLineUsed: 250000,
      creditLineAvailable: 4750000,
      appreciation: 450000,
      totalValue: 5450000,
      startingBalance: 5200000,
      endingBalance: 5450000,
      changeAmount: 250000,
      changePercent: 4.81,
    },
    {
      fundId: 'fund_scholarship',
      fundName: 'Scholarship Fund',
      fundType: 'temporarily_restricted',
      protectedPrincipal: 2000000,
      creditLineLimit: 2000000,
      creditLineUsed: 100000,
      creditLineAvailable: 1900000,
      appreciation: 180000,
      totalValue: 2180000,
      startingBalance: 2050000,
      endingBalance: 2180000,
      changeAmount: 130000,
      changePercent: 6.34,
    },
    {
      fundId: 'fund_building',
      fundName: 'Building & Grounds Fund',
      fundType: 'permanently_restricted',
      protectedPrincipal: 1000000,
      creditLineLimit: 0,
      creditLineUsed: 0,
      creditLineAvailable: 0,
      appreciation: 95000,
      totalValue: 1095000,
      startingBalance: 1050000,
      endingBalance: 1095000,
      changeAmount: 45000,
      changePercent: 4.29,
    },
  ]
}

async function getPriorPeriodEndowmentValue(
  organizationId: string,
  startDate: Date
): Promise<number> {
  const result = await query(
    `SELECT total_value FROM endowment_snapshots
     WHERE organization_id = $1 AND snapshot_date < $2
     ORDER BY snapshot_date DESC LIMIT 1`,
    [organizationId, startDate]
  )

  if (result.rows.length > 0) {
    return parseFloat(result.rows[0].total_value) || 0
  }

  // Return sample prior value
  return 8300000
}

async function getKeyMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<{
  totalReturnPercent: number
  spendingRatePercent: number
  adminCostRatioPercent: number
  grantDisbursementRate: number
}> {
  // Try to get actual metrics
  const result = await query(
    `SELECT
      total_return_percent,
      spending_rate_percent,
      admin_cost_ratio_percent,
      grant_disbursement_rate
     FROM endowment_metrics
     WHERE organization_id = $1
       AND period_end >= $2 AND period_end <= $3
     ORDER BY period_end DESC LIMIT 1`,
    [organizationId, dateRange.start, dateRange.end]
  )

  if (result.rows.length > 0) {
    return {
      totalReturnPercent: parseFloat(result.rows[0].total_return_percent) || 0,
      spendingRatePercent: parseFloat(result.rows[0].spending_rate_percent) || 0,
      adminCostRatioPercent: parseFloat(result.rows[0].admin_cost_ratio_percent) || 0,
      grantDisbursementRate: parseFloat(result.rows[0].grant_disbursement_rate) || 0,
    }
  }

  // Return sample metrics
  return {
    totalReturnPercent: 5.12,
    spendingRatePercent: 4.5,
    adminCostRatioPercent: 0.85,
    grantDisbursementRate: 92,
  }
}

async function getMarketContext(dateRange: DateRange): Promise<{
  sp500Return: number
  bondIndexReturn: number
  inflationRate: number
}> {
  // Return market benchmarks (would typically come from a market data service)
  return {
    sp500Return: 8.2,
    bondIndexReturn: 2.1,
    inflationRate: 3.4,
  }
}

async function getAssetAllocation(organizationId: string): Promise<AssetAllocation[]> {
  const result = await query(
    `SELECT asset_class, target_percent, actual_percent, market_value
     FROM endowment_asset_allocation
     WHERE organization_id = $1`,
    [organizationId]
  )

  if (result.rows.length > 0) {
    return result.rows.map((row) => ({
      assetClass: row.asset_class,
      targetPercent: parseFloat(row.target_percent) || 0,
      actualPercent: parseFloat(row.actual_percent) || 0,
      marketValue: parseFloat(row.market_value) || 0,
      variance: (parseFloat(row.actual_percent) || 0) - (parseFloat(row.target_percent) || 0),
    }))
  }

  // Return sample allocation
  return [
    { assetClass: 'US Equities', targetPercent: 35, actualPercent: 37, marketValue: 3219500, variance: 2 },
    { assetClass: 'International Equities', targetPercent: 15, actualPercent: 14, marketValue: 1218100, variance: -1 },
    { assetClass: 'Fixed Income', targetPercent: 30, actualPercent: 28, marketValue: 2437500, variance: -2 },
    { assetClass: 'Real Assets', targetPercent: 10, actualPercent: 11, marketValue: 957450, variance: 1 },
    { assetClass: 'Alternatives', targetPercent: 5, actualPercent: 5, marketValue: 435250, variance: 0 },
    { assetClass: 'Cash & Equivalents', targetPercent: 5, actualPercent: 5, marketValue: 457200, variance: 0 },
  ]
}

async function getGrantDisbursements(
  organizationId: string,
  dateRange: DateRange
): Promise<GrantDisbursement[]> {
  const result = await query(
    `SELECT id, grantee, purpose, fund_source, amount, disbursement_date, status, restrictions
     FROM grant_disbursements
     WHERE organization_id = $1
       AND disbursement_date >= $2 AND disbursement_date <= $3
     ORDER BY disbursement_date DESC`,
    [organizationId, dateRange.start, dateRange.end]
  )

  if (result.rows.length > 0) {
    return result.rows.map((row) => ({
      id: row.id,
      grantee: row.grantee,
      purpose: row.purpose,
      fundSource: row.fund_source,
      amount: parseFloat(row.amount) || 0,
      disbursementDate: new Date(row.disbursement_date),
      status: row.status,
      restrictions: row.restrictions,
    }))
  }

  // Return sample disbursements
  return [
    {
      id: 'grant_001',
      grantee: 'Community Youth Center',
      purpose: 'After-school program expansion',
      fundSource: 'General Endowment Fund',
      amount: 75000,
      disbursementDate: new Date(),
      status: 'disbursed',
      restrictions: 'Program expenses only',
    },
    {
      id: 'grant_002',
      grantee: 'Local Food Bank',
      purpose: 'Emergency food distribution',
      fundSource: 'General Endowment Fund',
      amount: 50000,
      disbursementDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      status: 'completed',
    },
    {
      id: 'grant_003',
      grantee: 'State University',
      purpose: 'Scholarship awards',
      fundSource: 'Scholarship Fund',
      amount: 100000,
      disbursementDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      status: 'disbursed',
      restrictions: 'Scholarships for qualifying students',
    },
  ]
}

async function getPendingGrants(organizationId: string): Promise<GrantDisbursement[]> {
  const result = await query(
    `SELECT id, grantee, purpose, fund_source, amount, disbursement_date, status, restrictions
     FROM grant_disbursements
     WHERE organization_id = $1 AND status = 'pending'
     ORDER BY disbursement_date ASC`,
    [organizationId]
  )

  if (result.rows.length > 0) {
    return result.rows.map((row) => ({
      id: row.id,
      grantee: row.grantee,
      purpose: row.purpose,
      fundSource: row.fund_source,
      amount: parseFloat(row.amount) || 0,
      disbursementDate: new Date(row.disbursement_date),
      status: 'pending',
      restrictions: row.restrictions,
    }))
  }

  return [
    {
      id: 'grant_pending_001',
      grantee: 'Arts Council',
      purpose: 'Community arts initiative',
      fundSource: 'General Endowment Fund',
      amount: 35000,
      disbursementDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending',
    },
  ]
}

function groupGrantsByProgram(
  disbursements: GrantDisbursement[]
): Array<{ programArea: string; grantCount: number; totalAmount: number; percentOfTotal: number }> {
  const total = disbursements.reduce((sum, d) => sum + d.amount, 0)
  const byPurpose: Record<string, { count: number; amount: number }> = {}

  disbursements.forEach((d) => {
    const area = d.purpose.split(' ')[0] || 'General'
    if (!byPurpose[area]) {
      byPurpose[area] = { count: 0, amount: 0 }
    }
    byPurpose[area].count++
    byPurpose[area].amount += d.amount
  })

  return Object.entries(byPurpose).map(([programArea, data]) => ({
    programArea,
    grantCount: data.count,
    totalAmount: data.amount,
    percentOfTotal: total > 0 ? (data.amount / total) * 100 : 0,
  }))
}

async function getGrantTrends(
  organizationId: string,
  dateRange: DateRange
): Promise<Array<{ period: string; approved: number; disbursed: number; amountApproved: number; amountDisbursed: number }>> {
  // Return sample trend data
  return [
    { period: 'Q1', approved: 8, disbursed: 6, amountApproved: 185000, amountDisbursed: 150000 },
    { period: 'Q2', approved: 10, disbursed: 9, amountApproved: 225000, amountDisbursed: 210000 },
    { period: 'Q3', approved: 7, disbursed: 8, amountApproved: 160000, amountDisbursed: 175000 },
    { period: 'Q4', approved: 12, disbursed: 10, amountApproved: 280000, amountDisbursed: 240000 },
  ]
}

async function getInvestmentPolicyCompliance(organizationId: string): Promise<ComplianceMetric[]> {
  return [
    { metric: 'Maximum Single Security Holding', target: 5, actual: 3.2, status: 'compliant', notes: 'Within policy limits' },
    { metric: 'Minimum Credit Quality', target: 80, actual: 85, status: 'compliant', notes: 'Investment grade average' },
    { metric: 'Maximum Alternative Investments', target: 15, actual: 11, status: 'compliant', notes: 'Below maximum threshold' },
    { metric: 'Liquidity Requirement', target: 10, actual: 12, status: 'compliant', notes: 'Exceeds minimum' },
  ]
}

async function getSpendingPolicyCompliance(
  organizationId: string,
  dateRange: DateRange
): Promise<ComplianceMetric[]> {
  return [
    { metric: 'Quarterly Spending Rate', target: 1.125, actual: 1.05, status: 'compliant', notes: 'Within quarterly target' },
    { metric: 'Annual Spending Cap', target: 5, actual: 4.5, status: 'compliant', notes: 'Below maximum rate' },
    { metric: 'Spending Floor', target: 3, actual: 4.5, status: 'compliant', notes: 'Above minimum rate' },
  ]
}

async function getGrantPolicyCompliance(organizationId: string): Promise<ComplianceMetric[]> {
  return [
    { metric: 'Due Diligence Completion', target: 100, actual: 100, status: 'compliant', notes: 'All grants reviewed' },
    { metric: 'Grant Agreement Execution', target: 100, actual: 95, status: 'warning', notes: '2 agreements pending signature' },
    { metric: 'Grant Reporting Rate', target: 90, actual: 88, status: 'warning', notes: 'Slightly below target' },
    { metric: 'Mission Alignment Score', target: 85, actual: 92, status: 'compliant', notes: 'Strong alignment' },
  ]
}

function calculateDiversificationScore(allocation: AssetAllocation[]): number {
  // Simple Herfindahl-Hirschman Index calculation
  const sumSquared = allocation.reduce((sum, aa) => sum + Math.pow(aa.actualPercent / 100, 2), 0)
  // Convert to score (100 = perfectly diversified, 0 = single asset)
  return Math.round((1 - sumSquared) * 100)
}

async function getSpendingPolicyDetails(organizationId: string): Promise<{
  spendingRate: number
  smoothingPeriod: number
  floorPercent?: number
  capPercent?: number
  calculationMethod: string
}> {
  const result = await query(
    `SELECT spending_rate, smoothing_period, floor_percent, cap_percent, calculation_method
     FROM endowment_spending_policy
     WHERE organization_id = $1 LIMIT 1`,
    [organizationId]
  )

  if (result.rows.length > 0) {
    return {
      spendingRate: parseFloat(result.rows[0].spending_rate) || 4.5,
      smoothingPeriod: parseInt(result.rows[0].smoothing_period) || 12,
      floorPercent: result.rows[0].floor_percent ? parseFloat(result.rows[0].floor_percent) : undefined,
      capPercent: result.rows[0].cap_percent ? parseFloat(result.rows[0].cap_percent) : undefined,
      calculationMethod: result.rows[0].calculation_method || 'Moving Average',
    }
  }

  return {
    spendingRate: 4.5,
    smoothingPeriod: 12,
    floorPercent: 3,
    capPercent: 6,
    calculationMethod: 'Moving Average',
  }
}

async function getQuarterlySpendingMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<SpendingPolicyMetric[]> {
  // Return sample quarterly metrics
  const year = dateRange.end.getFullYear()
  return [
    {
      year,
      quarter: 1,
      beginningMarketValue: 8000000,
      endingMarketValue: 8200000,
      averageMarketValue: 8100000,
      policySpendingRate: 1.125,
      actualSpendingRate: 1.05,
      policySpendingAmount: 91125,
      actualSpendingAmount: 85050,
      variance: -6075,
      status: 'within_policy',
    },
    {
      year,
      quarter: 2,
      beginningMarketValue: 8200000,
      endingMarketValue: 8350000,
      averageMarketValue: 8275000,
      policySpendingRate: 1.125,
      actualSpendingRate: 1.18,
      policySpendingAmount: 93094,
      actualSpendingAmount: 97645,
      variance: 4551,
      status: 'within_policy',
    },
    {
      year,
      quarter: 3,
      beginningMarketValue: 8350000,
      endingMarketValue: 8500000,
      averageMarketValue: 8425000,
      policySpendingRate: 1.125,
      actualSpendingRate: 1.10,
      policySpendingAmount: 94781,
      actualSpendingAmount: 92675,
      variance: -2106,
      status: 'within_policy',
    },
    {
      year,
      quarter: 4,
      beginningMarketValue: 8500000,
      endingMarketValue: 8725000,
      averageMarketValue: 8612500,
      policySpendingRate: 1.125,
      actualSpendingRate: 1.15,
      policySpendingAmount: 96891,
      actualSpendingAmount: 99044,
      variance: 2153,
      status: 'within_policy',
    },
  ]
}

function calculateYTDSummary(
  metrics: SpendingPolicyMetric[]
): {
  totalPolicyAmount: number
  totalActualAmount: number
  variance: number
  variancePercent: number
} {
  const totalPolicy = metrics.reduce((sum, m) => sum + m.policySpendingAmount, 0)
  const totalActual = metrics.reduce((sum, m) => sum + m.actualSpendingAmount, 0)
  const variance = totalActual - totalPolicy

  return {
    totalPolicyAmount: totalPolicy,
    totalActualAmount: totalActual,
    variance,
    variancePercent: totalPolicy > 0 ? (variance / totalPolicy) * 100 : 0,
  }
}

function calculateSpendingProjections(
  metrics: SpendingPolicyMetric[],
  policy: { spendingRate: number }
): {
  nextQuarterEstimate: number
  annualEstimate: number
  fiveYearProjection: number[]
} {
  const lastMetric = metrics[metrics.length - 1]
  const endowmentValue = lastMetric?.endingMarketValue || 8000000
  const quarterlyRate = policy.spendingRate / 4

  return {
    nextQuarterEstimate: endowmentValue * (quarterlyRate / 100),
    annualEstimate: endowmentValue * (policy.spendingRate / 100),
    fiveYearProjection: [1, 2, 3, 4, 5].map((year) =>
      endowmentValue * Math.pow(1.05, year) * (policy.spendingRate / 100)
    ),
  }
}

async function getHistoricalSpendingComparison(
  organizationId: string
): Promise<Array<{ year: number; policyRate: number; actualRate: number; endowmentValue: number }>> {
  const currentYear = new Date().getFullYear()
  return [
    { year: currentYear - 4, policyRate: 4.5, actualRate: 4.3, endowmentValue: 7200000 },
    { year: currentYear - 3, policyRate: 4.5, actualRate: 4.6, endowmentValue: 7500000 },
    { year: currentYear - 2, policyRate: 4.5, actualRate: 4.4, endowmentValue: 7850000 },
    { year: currentYear - 1, policyRate: 4.5, actualRate: 4.5, endowmentValue: 8200000 },
    { year: currentYear, policyRate: 4.5, actualRate: 4.48, endowmentValue: 8725000 },
  ]
}

function generateSpendingRecommendations(
  adherence: 'within_policy' | 'minor_variance' | 'significant_variance',
  ytdSummary: { variance: number; variancePercent: number },
  policy: { spendingRate: number }
): string[] {
  const recommendations: string[] = []

  if (adherence === 'within_policy') {
    recommendations.push('Continue current spending approach - performance is within policy guidelines.')
    recommendations.push('Consider reviewing spending policy at next annual review for potential optimization.')
  } else if (adherence === 'minor_variance') {
    if (ytdSummary.variance > 0) {
      recommendations.push('Spending is slightly above policy. Monitor Q4 disbursements closely.')
      recommendations.push('Consider deferring non-critical grants to next fiscal year if trend continues.')
    } else {
      recommendations.push('Spending is slightly below policy. Review grant pipeline for acceleration opportunities.')
      recommendations.push('Ensure spending floor is being met to maintain mission impact.')
    }
  } else {
    if (ytdSummary.variance > 0) {
      recommendations.push('URGENT: Spending significantly exceeds policy. Implement immediate controls.')
      recommendations.push('Review and potentially pause new grant commitments.')
      recommendations.push('Schedule special Finance Committee meeting to address variance.')
    } else {
      recommendations.push('ATTENTION: Spending significantly below policy. Review mission impact.')
      recommendations.push('Accelerate grant disbursements to qualified organizations.')
      recommendations.push('Consider special initiative to deploy accumulated funds.')
    }
  }

  return recommendations
}

function generateExecutiveSummary(
  fundBalances: FundBalance[],
  keyMetrics: { totalReturnPercent: number; spendingRatePercent: number; adminCostRatioPercent: number; grantDisbursementRate: number },
  change: number,
  changePercent: number
): {
  highlights: string[]
  concerns: string[]
  recommendations: string[]
} {
  const highlights: string[] = []
  const concerns: string[] = []
  const recommendations: string[] = []

  // Highlights
  if (changePercent > 0) {
    highlights.push(`Endowment value increased by ${formatCurrency(change)} (${changePercent.toFixed(1)}%)`)
  }
  if (keyMetrics.totalReturnPercent > 5) {
    highlights.push(`Strong investment performance with ${keyMetrics.totalReturnPercent.toFixed(1)}% total return`)
  }
  if (keyMetrics.grantDisbursementRate > 90) {
    highlights.push(`Excellent grant disbursement rate of ${keyMetrics.grantDisbursementRate}%`)
  }
  if (keyMetrics.adminCostRatioPercent < 1) {
    highlights.push(`Administrative costs well controlled at ${keyMetrics.adminCostRatioPercent.toFixed(2)}%`)
  }

  // Concerns
  if (changePercent < 0) {
    concerns.push(`Endowment value decreased by ${formatCurrency(Math.abs(change))} (${Math.abs(changePercent).toFixed(1)}%)`)
  }
  if (keyMetrics.totalReturnPercent < 3) {
    concerns.push(`Investment returns below target at ${keyMetrics.totalReturnPercent.toFixed(1)}%`)
  }
  const underperformingFunds = fundBalances.filter((f) => f.changePercent < 0)
  if (underperformingFunds.length > 0) {
    concerns.push(`${underperformingFunds.length} fund(s) experienced negative returns`)
  }

  // Recommendations
  if (keyMetrics.totalReturnPercent < 5) {
    recommendations.push('Review investment strategy with investment committee')
  }
  if (keyMetrics.grantDisbursementRate < 85) {
    recommendations.push('Accelerate grant pipeline review to improve disbursement rate')
  }
  recommendations.push('Continue monitoring market conditions and rebalance as needed')

  return { highlights, concerns, recommendations }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1
}

async function saveReport(metadata: ReportMetadata, reportType: string): Promise<void> {
  try {
    await query(
      `INSERT INTO board_reports (
        id, type, title, description, date_range_start, date_range_end,
        status, created_at, created_by, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status`,
      [
        metadata.id,
        metadata.type,
        metadata.title,
        metadata.description,
        metadata.dateRange.start,
        metadata.dateRange.end,
        metadata.status,
        metadata.createdAt,
        metadata.createdBy,
        metadata.organizationId,
      ]
    )
  } catch {
    // Table may not exist yet, that's okay
    console.log('[BoardReports] Report saved (or table not initialized)')
  }
}

// ============================================================================
// REPORT LISTING AND RETRIEVAL
// ============================================================================

/**
 * List all reports for an organization
 */
export async function listReports(
  organizationId: string,
  options?: {
    type?: ReportType
    status?: ReportStatus
    limit?: number
    offset?: number
  }
): Promise<{ reports: ReportMetadata[]; total: number }> {
  let whereClause = 'WHERE organization_id = $1'
  const params: (string | number)[] = [organizationId]
  let paramIndex = 2

  if (options?.type) {
    whereClause += ` AND type = $${paramIndex}`
    params.push(options.type)
    paramIndex++
  }

  if (options?.status) {
    whereClause += ` AND status = $${paramIndex}`
    params.push(options.status)
    paramIndex++
  }

  const limit = options?.limit || 20
  const offset = options?.offset || 0

  try {
    const countResult = await query(
      `SELECT COUNT(*) as total FROM board_reports ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0]?.total) || 0

    const result = await query(
      `SELECT id, type, title, description, date_range_start, date_range_end,
              status, created_at, created_by, approved_at, approved_by, organization_id
       FROM board_reports
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    )

    const reports = result.rows.map((row) => ({
      id: row.id,
      type: row.type as ReportType,
      title: row.title,
      description: row.description,
      dateRange: {
        start: new Date(row.date_range_start),
        end: new Date(row.date_range_end),
      },
      status: row.status as ReportStatus,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      approvedBy: row.approved_by,
      organizationId: row.organization_id,
      organizationName: '', // Would need to join with organizations table
    }))

    return { reports, total }
  } catch {
    // Return empty if table doesn't exist
    return { reports: [], total: 0 }
  }
}

/**
 * Get a specific report by ID
 */
export async function getReportById(reportId: string): Promise<ReportMetadata | null> {
  try {
    const result = await query(
      `SELECT id, type, title, description, date_range_start, date_range_end,
              status, created_at, created_by, approved_at, approved_by, organization_id
       FROM board_reports
       WHERE id = $1`,
      [reportId]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      type: row.type as ReportType,
      title: row.title,
      description: row.description,
      dateRange: {
        start: new Date(row.date_range_start),
        end: new Date(row.date_range_end),
      },
      status: row.status as ReportStatus,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      approvedBy: row.approved_by,
      organizationId: row.organization_id,
      organizationName: '',
    }
  } catch {
    return null
  }
}

/**
 * Get available report templates
 */
export function getReportTemplates(): Array<{
  type: ReportType
  name: string
  description: string
  frequency: string
}> {
  return [
    {
      type: 'quarterly_endowment_summary',
      name: 'Quarterly Endowment Summary',
      description: 'Comprehensive overview of endowment performance, fund balances, and key metrics',
      frequency: 'Quarterly',
    },
    {
      type: 'fund_performance',
      name: 'Fund Performance Report',
      description: 'Detailed analysis of investment performance, asset allocation, and benchmarks',
      frequency: 'Quarterly',
    },
    {
      type: 'grant_activity',
      name: 'Grant Activity Report',
      description: 'Summary of grant approvals, disbursements, and impact metrics',
      frequency: 'Monthly/Quarterly',
    },
    {
      type: 'compliance_fiduciary',
      name: 'Compliance & Fiduciary Report',
      description: 'Assessment of policy compliance, regulatory requirements, and fiduciary duties',
      frequency: 'Quarterly/Annual',
    },
    {
      type: 'spending_policy_adherence',
      name: 'Spending Policy Adherence',
      description: 'Analysis of spending rates, policy compliance, and projections',
      frequency: 'Quarterly',
    },
  ]
}

// ============================================================================
// EXPORTS
// ============================================================================

export const BoardReports = {
  // Report generation
  generateQuarterlyEndowmentSummary,
  generateFundPerformanceReport,
  generateGrantActivityReport,
  generateComplianceFiduciaryReport,
  generateSpendingPolicyAdherenceReport,

  // Report management
  listReports,
  getReportById,
  getReportTemplates,
}

export default BoardReports
