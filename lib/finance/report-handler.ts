/**
 * Financial Report Handler
 * Handles conversational financial reporting, analytics, and spend analysis
 */

import { query } from '../db'
import { ExecutionResult } from '../conversational-engine'

// ============================================
// Generate Profit & Loss Report
// ============================================

export async function generateProfitAndLoss(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const period = entities.period || 'monthly' // monthly, quarterly, yearly
    const startDate = entities.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const endDate = entities.endDate || new Date()

    // Revenue (invoices that are paid or sent)
    const revenueResult = await query<any>(
      `SELECT
        SUM(total_amount) as total_revenue,
        COUNT(*) as invoice_count
       FROM invoices
       WHERE invoice_type = 'receivable'
       AND invoice_date >= $1 AND invoice_date <= $2
       AND status IN ('paid', 'sent', 'partial')`,
      [startDate, endDate]
    )

    const revenue = parseFloat(revenueResult.rows[0].total_revenue) || 0
    const invoiceCount = parseInt(revenueResult.rows[0].invoice_count) || 0

    // Cost of Goods Sold (purchase orders)
    const cogsResult = await query<any>(
      `SELECT
        SUM(total_amount) as total_cogs,
        COUNT(*) as po_count
       FROM purchase_orders
       WHERE created_at >= $1 AND created_at <= $2
       AND status IN ('received', 'completed')`,
      [startDate, endDate]
    )

    const cogs = parseFloat(cogsResult.rows[0].total_cogs) || 0
    const poCount = parseInt(cogsResult.rows[0].po_count) || 0

    // Gross Profit
    const grossProfit = revenue - cogs
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

    // Operating Expenses (payments sent)
    const expensesResult = await query<any>(
      `SELECT
        SUM(amount) as total_expenses,
        COUNT(*) as payment_count
       FROM payments
       WHERE payment_type = 'sent'
       AND payment_date >= $1 AND payment_date <= $2`,
      [startDate, endDate]
    )

    const expenses = parseFloat(expensesResult.rows[0].total_expenses) || 0
    const expenseCount = parseInt(expensesResult.rows[0].payment_count) || 0

    // Net Income
    const netIncome = grossProfit - expenses
    const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0

    return {
      success: true,
      data: {
        period,
        startDate,
        endDate,
        revenue: {
          amount: revenue,
          invoiceCount,
        },
        cogs: {
          amount: cogs,
          poCount,
        },
        grossProfit: {
          amount: grossProfit,
          margin: grossMargin,
        },
        expenses: {
          amount: expenses,
          expenseCount,
        },
        netIncome: {
          amount: netIncome,
          margin: netMargin,
        },
        summary: {
          revenue,
          cogs,
          grossProfit,
          expenses,
          netIncome,
          grossMargin,
          netMargin,
        },
      },
    }
  } catch (error) {
    console.error('[Report Handler] Generate P&L error:', error)
    return {
      success: false,
      error: 'Failed to generate profit and loss report',
    }
  }
}

// ============================================
// Generate Cash Flow Report
// ============================================

export async function generateCashFlow(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const startDate = entities.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const endDate = entities.endDate || new Date()

    // Cash In (payments received)
    const cashInResult = await query<any>(
      `SELECT
        SUM(amount) as total_in,
        COUNT(*) as transaction_count,
        payment_method
       FROM payments
       WHERE payment_type = 'received'
       AND payment_date >= $1 AND payment_date <= $2
       AND status = 'cleared'
       GROUP BY payment_method`,
      [startDate, endDate]
    )

    const cashIn = {
      total: cashInResult.rows.reduce((sum, row) => sum + parseFloat(row.total_in), 0),
      transactions: cashInResult.rows.reduce((sum, row) => sum + parseInt(row.transaction_count), 0),
      byMethod: cashInResult.rows.map(row => ({
        method: row.payment_method,
        amount: parseFloat(row.total_in),
        count: parseInt(row.transaction_count),
      })),
    }

    // Cash Out (payments sent)
    const cashOutResult = await query<any>(
      `SELECT
        SUM(amount) as total_out,
        COUNT(*) as transaction_count,
        payment_method
       FROM payments
       WHERE payment_type = 'sent'
       AND payment_date >= $1 AND payment_date <= $2
       AND status = 'cleared'
       GROUP BY payment_method`,
      [startDate, endDate]
    )

    const cashOut = {
      total: cashOutResult.rows.reduce((sum, row) => sum + parseFloat(row.total_out), 0),
      transactions: cashOutResult.rows.reduce((sum, row) => sum + parseInt(row.transaction_count), 0),
      byMethod: cashOutResult.rows.map(row => ({
        method: row.payment_method,
        amount: parseFloat(row.total_out),
        count: parseInt(row.transaction_count),
      })),
    }

    // Net Cash Flow
    const netCashFlow = cashIn.total - cashOut.total

    return {
      success: true,
      data: {
        period: {
          startDate,
          endDate,
        },
        cashIn,
        cashOut,
        netCashFlow,
        summary: {
          cashIn: cashIn.total,
          cashOut: cashOut.total,
          netCashFlow,
          totalTransactions: cashIn.transactions + cashOut.transactions,
        },
      },
    }
  } catch (error) {
    console.error('[Report Handler] Generate cash flow error:', error)
    return {
      success: false,
      error: 'Failed to generate cash flow report',
    }
  }
}

// ============================================
// Analyze Spending
// ============================================

export async function analyzeSpending(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const period = entities.period || 'monthly'
    const startDate = entities.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const endDate = entities.endDate || new Date()
    const groupBy = entities.groupBy || 'supplier' // 'supplier', 'category', 'month'

    // Spending by supplier
    if (groupBy === 'supplier') {
      const result = await query<any>(
        `SELECT
          s.name as supplier_name,
          SUM(po.total_amount) as total_spent,
          COUNT(po.id) as po_count,
          AVG(po.total_amount) as avg_po_value
         FROM purchase_orders po
         JOIN suppliers s ON po.supplier_id = s.id
         WHERE po.created_at >= $1 AND po.created_at <= $2
         GROUP BY s.id, s.name
         ORDER BY total_spent DESC
         LIMIT 20`,
        [startDate, endDate]
      )

      const totalSpent = result.rows.reduce((sum, row) => sum + parseFloat(row.total_spent), 0)

      return {
        success: true,
        data: {
          period: { startDate, endDate },
          groupBy: 'supplier',
          totalSpent,
          breakdown: result.rows.map((row, index) => ({
            rank: index + 1,
            supplier: row.supplier_name,
            amount: parseFloat(row.total_spent),
            poCount: parseInt(row.po_count),
            avgPoValue: parseFloat(row.avg_po_value),
            percentage: (parseFloat(row.total_spent) / totalSpent) * 100,
          })),
        },
      }
    }

    // Spending by month
    if (groupBy === 'month') {
      const result = await query<any>(
        `SELECT
          DATE_TRUNC('month', created_at) as month,
          SUM(total_amount) as total_spent,
          COUNT(*) as po_count
         FROM purchase_orders
         WHERE created_at >= $1 AND created_at <= $2
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month ASC`,
        [startDate, endDate]
      )

      const totalSpent = result.rows.reduce((sum, row) => sum + parseFloat(row.total_spent), 0)

      return {
        success: true,
        data: {
          period: { startDate, endDate },
          groupBy: 'month',
          totalSpent,
          breakdown: result.rows.map(row => ({
            month: row.month,
            amount: parseFloat(row.total_spent),
            poCount: parseInt(row.po_count),
          })),
        },
      }
    }

    return {
      success: false,
      error: `Unsupported groupBy option: ${groupBy}. Use 'supplier' or 'month'.`,
    }
  } catch (error) {
    console.error('[Report Handler] Analyze spending error:', error)
    return {
      success: false,
      error: 'Failed to analyze spending',
    }
  }
}

// ============================================
// Get Accounts Receivable Aging
// ============================================

export async function getARAge(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const result = await query<any>(
      `SELECT
        invoice_number,
        customer_id,
        total_amount,
        invoice_date,
        due_date,
        status,
        EXTRACT(DAY FROM (NOW() - due_date)) as days_overdue
       FROM invoices
       WHERE invoice_type = 'receivable'
       AND status IN ('sent', 'partial', 'overdue')
       ORDER BY days_overdue DESC`
    )

    const invoices = result.rows.map(row => ({
      invoiceNumber: row.invoice_number,
      customer: row.customer_id,
      amount: parseFloat(row.total_amount),
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      daysOverdue: parseInt(row.days_overdue) || 0,
      status: row.status,
      agingBucket:
        parseInt(row.days_overdue) <= 0
          ? 'Current'
          : parseInt(row.days_overdue) <= 30
            ? '1-30 days'
            : parseInt(row.days_overdue) <= 60
              ? '31-60 days'
              : parseInt(row.days_overdue) <= 90
                ? '61-90 days'
                : '90+ days',
    }))

    // Group by aging bucket
    const agingBuckets = {
      current: { count: 0, amount: 0 },
      days_1_30: { count: 0, amount: 0 },
      days_31_60: { count: 0, amount: 0 },
      days_61_90: { count: 0, amount: 0 },
      days_90_plus: { count: 0, amount: 0 },
    }

    invoices.forEach(inv => {
      const amount = inv.amount
      if (inv.agingBucket === 'Current') {
        agingBuckets.current.count++
        agingBuckets.current.amount += amount
      } else if (inv.agingBucket === '1-30 days') {
        agingBuckets.days_1_30.count++
        agingBuckets.days_1_30.amount += amount
      } else if (inv.agingBucket === '31-60 days') {
        agingBuckets.days_31_60.count++
        agingBuckets.days_31_60.amount += amount
      } else if (inv.agingBucket === '61-90 days') {
        agingBuckets.days_61_90.count++
        agingBuckets.days_61_90.amount += amount
      } else {
        agingBuckets.days_90_plus.count++
        agingBuckets.days_90_plus.amount += amount
      }
    })

    const totalAR = invoices.reduce((sum, inv) => sum + inv.amount, 0)

    return {
      success: true,
      data: {
        totalAR,
        invoiceCount: invoices.length,
        agingBuckets,
        invoices: invoices.slice(0, 20), // Top 20 oldest
      },
    }
  } catch (error) {
    console.error('[Report Handler] Get AR aging error:', error)
    return {
      success: false,
      error: 'Failed to generate accounts receivable aging report',
    }
  }
}

// ============================================
// Budget vs Actual Analysis
// ============================================

export async function analyzeBudgetVsActual(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const fiscalYear = entities.year || new Date().getFullYear()
    const fiscalQuarter = entities.quarter

    let whereClause = 'WHERE fiscal_year = $1'
    const params: any[] = [fiscalYear]

    if (fiscalQuarter) {
      whereClause += ' AND fiscal_quarter = $2'
      params.push(fiscalQuarter)
    }

    const result = await query<any>(
      `SELECT
        name,
        department,
        category,
        fiscal_quarter,
        planned_amount,
        actual_amount,
        variance,
        variance_percent,
        status
       FROM budget_plans
       ${whereClause}
       ORDER BY ABS(variance) DESC`,
      params
    )

    const budgets = result.rows.map(row => ({
      name: row.name,
      department: row.department,
      category: row.category,
      quarter: row.fiscal_quarter,
      planned: parseFloat(row.planned_amount),
      actual: parseFloat(row.actual_amount),
      variance: parseFloat(row.variance),
      variancePercent: parseFloat(row.variance_percent),
      status: row.status,
      overBudget: parseFloat(row.variance) > 0,
    }))

    const totalPlanned = budgets.reduce((sum, b) => sum + b.planned, 0)
    const totalActual = budgets.reduce((sum, b) => sum + b.actual, 0)
    const totalVariance = totalActual - totalPlanned
    const totalVariancePercent = totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0

    return {
      success: true,
      data: {
        fiscalYear,
        fiscalQuarter,
        summary: {
          totalPlanned,
          totalActual,
          totalVariance,
          totalVariancePercent,
          overBudgetCount: budgets.filter(b => b.overBudget).length,
          underBudgetCount: budgets.filter(b => !b.overBudget).length,
        },
        budgets,
      },
    }
  } catch (error) {
    console.error('[Report Handler] Analyze budget vs actual error:', error)
    return {
      success: false,
      error: 'Failed to analyze budget vs actual',
    }
  }
}

// ============================================
// Forecast Cash Flow
// ============================================

export async function forecastCashFlow(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const months = entities.months || 3 // Forecast for next 3 months

    // Get historical average cash flow
    const historicalResult = await query<any>(
      `SELECT
        AVG(monthly_in) as avg_in,
        AVG(monthly_out) as avg_out
       FROM (
         SELECT
           DATE_TRUNC('month', payment_date) as month,
           SUM(CASE WHEN payment_type = 'received' THEN amount ELSE 0 END) as monthly_in,
           SUM(CASE WHEN payment_type = 'sent' THEN amount ELSE 0 END) as monthly_out
         FROM payments
         WHERE payment_date >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', payment_date)
       ) monthly_cash_flow`
    )

    const avgCashIn = parseFloat(historicalResult.rows[0].avg_in) || 0
    const avgCashOut = parseFloat(historicalResult.rows[0].avg_out) || 0
    const avgNetCashFlow = avgCashIn - avgCashOut

    // Get upcoming invoices (expected cash in)
    const upcomingInvoicesResult = await query<any>(
      `SELECT
        SUM(total_amount) as upcoming_revenue
       FROM invoices
       WHERE status IN ('sent', 'partial')
       AND due_date BETWEEN NOW() AND NOW() + INTERVAL '${months} months'`
    )

    const upcomingRevenue = parseFloat(upcomingInvoicesResult.rows[0].upcoming_revenue) || 0

    // Get pending POs (expected cash out)
    const pendingPOsResult = await query<any>(
      `SELECT
        SUM(total_amount) as upcoming_expenses
       FROM purchase_orders
       WHERE status IN ('approved', 'sent')
       AND due_date BETWEEN NOW() AND NOW() + INTERVAL '${months} months'`
    )

    const upcomingExpenses = parseFloat(pendingPOsResult.rows[0].upcoming_expenses) || 0

    // Generate forecast
    const forecast = []
    let cumulativeCashFlow = 0

    for (let i = 1; i <= months; i++) {
      const month = new Date()
      month.setMonth(month.getMonth() + i)

      const estimatedCashIn = avgCashIn + (i === 1 ? upcomingRevenue / months : 0)
      const estimatedCashOut = avgCashOut + (i === 1 ? upcomingExpenses / months : 0)
      const netCashFlow = estimatedCashIn - estimatedCashOut

      cumulativeCashFlow += netCashFlow

      forecast.push({
        month: month.toISOString().slice(0, 7),
        estimatedCashIn,
        estimatedCashOut,
        netCashFlow,
        cumulativeCashFlow,
      })
    }

    return {
      success: true,
      data: {
        months,
        historical: {
          avgCashIn,
          avgCashOut,
          avgNetCashFlow,
        },
        upcoming: {
          revenue: upcomingRevenue,
          expenses: upcomingExpenses,
        },
        forecast,
        projectedCashPosition: cumulativeCashFlow,
      },
    }
  } catch (error) {
    console.error('[Report Handler] Forecast cash flow error:', error)
    return {
      success: false,
      error: 'Failed to forecast cash flow',
    }
  }
}
