/**
 * Founder Metrics Service
 *
 * Provides runway analysis and financial overview for founder journey
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RunwayAnalysis {
  monthsRemaining: number
  currentBurnRate: number
  totalCash: number
  projectedRunwayDate: Date
  recommendations: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface FinancialOverview {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  cashOnHand: number
  accountsReceivable: number
  accountsPayable: number
  monthlyRecurringRevenue: number
  customerCount: number
  avgRevenuePerCustomer: number
  revenueGrowthRate: number
  expenseGrowthRate: number
  grossMargin: number
  netMargin: number
  period: {
    start: Date
    end: Date
  }
}

// ============================================================================
// RUNWAY ANALYSIS
// ============================================================================

export async function analyzeRunway(userId: string): Promise<RunwayAnalysis> {
  // TODO: Connect to actual financial data when available
  // For now, return placeholder data that the UI can display

  const now = new Date()
  const projectedDate = new Date(now)
  projectedDate.setMonth(projectedDate.getMonth() + 18)

  return {
    monthsRemaining: 18,
    currentBurnRate: 45000,
    totalCash: 810000,
    projectedRunwayDate: projectedDate,
    recommendations: [
      'Consider reducing marketing spend by 15% to extend runway',
      'Evaluate contractor vs full-time hiring for next 2 quarters',
      'Explore bridge financing options before runway drops below 12 months'
    ],
    riskLevel: 'low'
  }
}

// ============================================================================
// FINANCIAL OVERVIEW
// ============================================================================

export async function getFinancialOverview(userId: string): Promise<FinancialOverview> {
  // TODO: Connect to actual financial data when available
  // For now, return placeholder data that the UI can display

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return {
    totalRevenue: 125000,
    totalExpenses: 98000,
    netIncome: 27000,
    cashOnHand: 810000,
    accountsReceivable: 45000,
    accountsPayable: 32000,
    monthlyRecurringRevenue: 85000,
    customerCount: 42,
    avgRevenuePerCustomer: 2024,
    revenueGrowthRate: 0.12,
    expenseGrowthRate: 0.08,
    grossMargin: 0.65,
    netMargin: 0.216,
    period: {
      start: periodStart,
      end: periodEnd
    }
  }
}

// ============================================================================
// ADDITIONAL METRICS (for future use)
// ============================================================================

export async function getCashFlowProjection(userId: string, months: number = 12) {
  const projections = []
  const baseRevenue = 125000
  const baseExpenses = 98000

  for (let i = 0; i < months; i++) {
    const date = new Date()
    date.setMonth(date.getMonth() + i)

    const revenue = baseRevenue * Math.pow(1.12, i / 12)
    const expenses = baseExpenses * Math.pow(1.08, i / 12)

    projections.push({
      month: date,
      revenue: Math.round(revenue),
      expenses: Math.round(expenses),
      netCashFlow: Math.round(revenue - expenses)
    })
  }

  return projections
}

export async function getBurnRateHistory(userId: string, months: number = 6) {
  const history = []

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)

    history.push({
      month: date,
      burnRate: 45000 + Math.random() * 10000 - 5000
    })
  }

  return history
}
