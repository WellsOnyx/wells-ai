/**
 * WellsAI Conversational ERP - Financial Overview Service
 *
 * AI-powered financial summaries and analytics - no dashboards needed.
 * Users just talk to Wells:
 *
 * - "What's my spend this month?" -> Wells summarizes
 * - "Show me my top 5 suppliers by volume" -> Wells analyzes
 * - "What payments are due this week?" -> Wells lists
 * - "Forecast my cash flow for next month" -> Wells projects
 * - "What do I owe this month?" -> Wells summarizes accounts payable
 *
 * Integrates with Wells fee system - tracks 1% fees on all transactions.
 */

import { sql } from '@vercel/postgres'
import { WELLS_FEE_CONFIG } from '@/lib/fees/wells-fee-service'

// ============================================================================
// TYPES
// ============================================================================

export interface SpendSummary {
  period: string
  totalSpend: number
  poCount: number
  invoiceCount: number
  avgOrderValue: number
  topCategories: { category: string; amount: number; percentage: number }[]
  topVendors: { name: string; amount: number; orders: number }[]
  comparison?: {
    previousPeriod: number
    changePercent: number
    trend: 'up' | 'down' | 'flat'
  }
}

export interface PaymentDue {
  id: string
  type: 'invoice' | 'po'
  referenceNumber: string
  vendorName: string
  amount: number
  dueDate: Date
  daysUntilDue: number
  status: string
}

export interface AccountsPayable {
  totalDue: number
  dueThisWeek: number
  dueThisMonth: number
  overdue: number
  overdueCount: number
  byVendor: { vendorName: string; amount: number; invoiceCount: number }[]
  byAging: {
    current: number // 0-30 days
    days31to60: number
    days61to90: number
    over90days: number
  }
}

export interface AccountsReceivable {
  totalOutstanding: number
  dueThisWeek: number
  dueThisMonth: number
  overdue: number
  overdueCount: number
  byCustomer: { customerName: string; amount: number; invoiceCount: number }[]
  byAging: {
    current: number
    days31to60: number
    days61to90: number
    over90days: number
  }
}

export interface CashFlowForecast {
  period: string
  startingBalance: number
  projectedInflows: number
  projectedOutflows: number
  wellsFees: number
  netCashFlow: number
  endingBalance: number
  inflowDetails: { source: string; amount: number; confidence: number }[]
  outflowDetails: { destination: string; amount: number; dueDate: Date }[]
  warnings: string[]
}

export interface FinancialPeriodSummary {
  period: string
  startDate: Date
  endDate: Date
  revenue: number
  expenses: number
  netIncome: number
  wellsFeesCollected: number
  invoicesSent: number
  invoicesPaid: number
  posCreated: number
  posReceived: number
}

export interface TransactionLedger {
  id: string
  date: Date
  type: string
  referenceId: string
  referenceNumber?: string
  description: string
  amount: number
  runningBalance?: number
  vendorName?: string
  category?: string
}

// ============================================================================
// FINANCIAL OVERVIEW SERVICE
// ============================================================================

export class WellsFinancialService {
  /**
   * Get spend summary
   * "What's my spend this month?"
   */
  static async getSpendSummary(
    userId: string,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{ summary: SpendSummary; message: string }> {
    const { startDate, endDate, previousStart, previousEnd, periodLabel } = this.getPeriodDates(period)

    // Current period spend
    const currentSpend = await sql`
      SELECT
        COUNT(*) as po_count,
        COALESCE(SUM(total_amount), 0) as total_spend,
        COALESCE(AVG(total_amount), 0) as avg_order_value
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND order_date >= ${startDate.toISOString()}
        AND order_date <= ${endDate.toISOString()}
        AND status != 'cancelled'
    `

    // Invoice count
    const invoiceCount = await sql`
      SELECT COUNT(*) as count
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND invoice_date >= ${startDate.toISOString()}
        AND invoice_date <= ${endDate.toISOString()}
        AND status != 'cancelled'
    `

    // Previous period spend (for comparison)
    const previousSpend = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as total_spend
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND order_date >= ${previousStart.toISOString()}
        AND order_date <= ${previousEnd.toISOString()}
        AND status != 'cancelled'
    `

    // Top vendors
    const topVendors = await sql`
      SELECT
        supplier_name as name,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as amount
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND order_date >= ${startDate.toISOString()}
        AND order_date <= ${endDate.toISOString()}
        AND status != 'cancelled'
      GROUP BY supplier_name
      ORDER BY amount DESC
      LIMIT 5
    `

    const row = currentSpend.rows[0]
    const totalSpend = parseFloat(row.total_spend)
    const poCount = parseInt(row.po_count)
    const avgOrderValue = parseFloat(row.avg_order_value)
    const prevSpend = parseFloat(previousSpend.rows[0].total_spend)
    const changePercent = prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : 0

    const summary: SpendSummary = {
      period: periodLabel,
      totalSpend,
      poCount,
      invoiceCount: parseInt(invoiceCount.rows[0].count),
      avgOrderValue,
      topCategories: [], // Would need category tracking on POs
      topVendors: topVendors.rows.map((v) => ({
        name: v.name as string,
        amount: parseFloat(v.amount as string),
        orders: parseInt(v.orders as string),
      })),
      comparison: {
        previousPeriod: prevSpend,
        changePercent: Math.round(changePercent * 10) / 10,
        trend: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'flat',
      },
    }

    // Generate natural language message
    const trendEmoji = summary.comparison?.trend === 'up' ? 'increased' : summary.comparison?.trend === 'down' ? 'decreased' : 'remained stable'
    const trendAmount = Math.abs(summary.comparison?.changePercent || 0)

    let message = `Your spend ${periodLabel}:\n`
    message += `- Total: $${totalSpend.toLocaleString()} across ${poCount} purchase orders\n`
    message += `- Average order: $${avgOrderValue.toLocaleString()}\n`
    message += `- Compared to previous ${period}: ${trendEmoji} ${trendAmount}%\n`

    if (summary.topVendors.length > 0) {
      message += `\nTop vendors:\n`
      summary.topVendors.slice(0, 3).forEach((v, i) => {
        message += `${i + 1}. ${v.name}: $${v.amount.toLocaleString()} (${v.orders} orders)\n`
      })
    }

    return { summary, message }
  }

  /**
   * Get payments due
   * "What payments are due this week?"
   */
  static async getPaymentsDue(
    userId: string,
    period: 'today' | 'week' | 'month' = 'week'
  ): Promise<{ payments: PaymentDue[]; summary: string }> {
    const now = new Date()
    let endDate: Date

    switch (period) {
      case 'today':
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'week':
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        break
    }

    // Get invoices due
    const invoices = await sql`
      SELECT
        id, invoice_number as reference_number, vendor_name,
        amount_due as amount, due_date, status
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND status NOT IN ('paid', 'cancelled')
        AND due_date <= ${endDate.toISOString()}
      ORDER BY due_date ASC
    `

    // Get POs with payment due
    const pos = await sql`
      SELECT
        id, po_number as reference_number, supplier_name as vendor_name,
        total_amount - amount_paid as amount, payment_due_date as due_date, status
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND payment_status != 'paid'
        AND status IN ('received', 'completed')
        AND payment_due_date <= ${endDate.toISOString()}
      ORDER BY payment_due_date ASC
    `

    const payments: PaymentDue[] = []

    for (const inv of invoices.rows) {
      const dueDate = new Date(inv.due_date as string)
      payments.push({
        id: inv.id as string,
        type: 'invoice',
        referenceNumber: inv.reference_number as string,
        vendorName: inv.vendor_name as string,
        amount: parseFloat(inv.amount as string),
        dueDate,
        daysUntilDue: Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        status: inv.status as string,
      })
    }

    for (const po of pos.rows) {
      const dueDate = new Date(po.due_date as string)
      payments.push({
        id: po.id as string,
        type: 'po',
        referenceNumber: po.reference_number as string,
        vendorName: po.vendor_name as string,
        amount: parseFloat(po.amount as string),
        dueDate,
        daysUntilDue: Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        status: po.status as string,
      })
    }

    // Sort by due date
    payments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

    const totalDue = payments.reduce((sum, p) => sum + p.amount, 0)
    const overduePayments = payments.filter((p) => p.daysUntilDue < 0)
    const overdueAmount = overduePayments.reduce((sum, p) => sum + p.amount, 0)

    let summary = `Payments due this ${period}:\n`
    summary += `- ${payments.length} payment${payments.length !== 1 ? 's' : ''} totaling $${totalDue.toLocaleString()}\n`

    if (overduePayments.length > 0) {
      summary += `- ${overduePayments.length} overdue ($${overdueAmount.toLocaleString()})\n`
    }

    if (payments.length > 0) {
      summary += `\nUpcoming:\n`
      payments.slice(0, 5).forEach((p) => {
        const urgency = p.daysUntilDue < 0 ? 'OVERDUE' : p.daysUntilDue === 0 ? 'TODAY' : `in ${p.daysUntilDue} days`
        summary += `- ${p.referenceNumber} (${p.vendorName}): $${p.amount.toLocaleString()} - ${urgency}\n`
      })
    }

    return { payments, summary }
  }

  /**
   * Get accounts payable summary
   * "What do I owe this month?"
   */
  static async getAccountsPayable(userId: string): Promise<{ ap: AccountsPayable; message: string }> {
    const now = new Date()
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Get all unpaid invoices and POs
    const result = await sql`
      SELECT
        COALESCE(SUM(amount_due), 0) as total_due,
        COALESCE(SUM(CASE WHEN due_date <= ${weekEnd.toISOString()} THEN amount_due ELSE 0 END), 0) as due_this_week,
        COALESCE(SUM(CASE WHEN due_date <= ${monthEnd.toISOString()} THEN amount_due ELSE 0 END), 0) as due_this_month,
        COALESCE(SUM(CASE WHEN due_date < ${now.toISOString()} THEN amount_due ELSE 0 END), 0) as overdue,
        COUNT(CASE WHEN due_date < ${now.toISOString()} THEN 1 END) as overdue_count,
        COALESCE(SUM(CASE WHEN due_date >= ${now.toISOString()} AND due_date < ${now.toISOString()}::date + interval '30 days' THEN amount_due ELSE 0 END), 0) as current,
        COALESCE(SUM(CASE WHEN due_date < ${now.toISOString()} AND due_date >= ${now.toISOString()}::date - interval '30 days' THEN amount_due ELSE 0 END), 0) as days_1_30,
        COALESCE(SUM(CASE WHEN due_date < ${now.toISOString()}::date - interval '30 days' AND due_date >= ${now.toISOString()}::date - interval '60 days' THEN amount_due ELSE 0 END), 0) as days_31_60,
        COALESCE(SUM(CASE WHEN due_date < ${now.toISOString()}::date - interval '60 days' AND due_date >= ${now.toISOString()}::date - interval '90 days' THEN amount_due ELSE 0 END), 0) as days_61_90,
        COALESCE(SUM(CASE WHEN due_date < ${now.toISOString()}::date - interval '90 days' THEN amount_due ELSE 0 END), 0) as over_90
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND status NOT IN ('paid', 'cancelled')
    `

    // By vendor
    const vendorResult = await sql`
      SELECT
        vendor_name,
        SUM(amount_due) as amount,
        COUNT(*) as invoice_count
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND status NOT IN ('paid', 'cancelled')
      GROUP BY vendor_name
      ORDER BY amount DESC
      LIMIT 10
    `

    const row = result.rows[0]

    const ap: AccountsPayable = {
      totalDue: parseFloat(row.total_due),
      dueThisWeek: parseFloat(row.due_this_week),
      dueThisMonth: parseFloat(row.due_this_month),
      overdue: parseFloat(row.overdue),
      overdueCount: parseInt(row.overdue_count),
      byVendor: vendorResult.rows.map((v) => ({
        vendorName: v.vendor_name as string,
        amount: parseFloat(v.amount as string),
        invoiceCount: parseInt(v.invoice_count as string),
      })),
      byAging: {
        current: parseFloat(row.current),
        days31to60: parseFloat(row.days_31_60),
        days61to90: parseFloat(row.days_61_90),
        over90days: parseFloat(row.over_90),
      },
    }

    let message = `Accounts Payable Summary:\n`
    message += `- Total owed: $${ap.totalDue.toLocaleString()}\n`
    message += `- Due this week: $${ap.dueThisWeek.toLocaleString()}\n`
    message += `- Due this month: $${ap.dueThisMonth.toLocaleString()}\n`

    if (ap.overdue > 0) {
      message += `- OVERDUE: $${ap.overdue.toLocaleString()} (${ap.overdueCount} invoices)\n`
    }

    if (ap.byVendor.length > 0) {
      message += `\nTop creditors:\n`
      ap.byVendor.slice(0, 3).forEach((v) => {
        message += `- ${v.vendorName}: $${v.amount.toLocaleString()} (${v.invoiceCount} invoices)\n`
      })
    }

    return { ap, message }
  }

  /**
   * Forecast cash flow
   * "Forecast my cash flow for next month"
   */
  static async forecastCashFlow(
    userId: string,
    period: 'week' | 'month' | 'quarter' = 'month',
    currentBalance: number = 0
  ): Promise<{ forecast: CashFlowForecast; message: string }> {
    const now = new Date()
    let endDate: Date
    let periodLabel: string

    switch (period) {
      case 'week':
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        periodLabel = 'next week'
        break
      case 'month':
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
        periodLabel = 'next month'
        break
      case 'quarter':
        endDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())
        periodLabel = 'next quarter'
        break
    }

    // Projected inflows (invoices we've sent that are due)
    const inflowResult = await sql`
      SELECT
        COALESCE(SUM(amount_due), 0) as total_inflow,
        vendor_name as source,
        amount_due as amount
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND status NOT IN ('paid', 'cancelled')
        AND due_date >= ${now.toISOString()}
        AND due_date <= ${endDate.toISOString()}
      GROUP BY vendor_name, amount_due
      ORDER BY amount_due DESC
    `

    // Projected outflows (POs and invoices we owe)
    const outflowResult = await sql`
      SELECT
        id,
        COALESCE(total_amount - amount_paid, 0) as amount,
        supplier_name as destination,
        payment_due_date as due_date
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND payment_status != 'paid'
        AND status IN ('sent', 'acknowledged', 'in_production', 'shipped', 'received')
        AND payment_due_date >= ${now.toISOString()}
        AND payment_due_date <= ${endDate.toISOString()}
      ORDER BY payment_due_date ASC
    `

    // Calculate totals
    let projectedInflows = 0
    const inflowDetails: CashFlowForecast['inflowDetails'] = []

    for (const row of inflowResult.rows) {
      const amount = parseFloat(row.amount as string)
      projectedInflows += amount
      inflowDetails.push({
        source: row.source as string,
        amount,
        confidence: 0.7, // Historical collection rate could be used here
      })
    }

    let projectedOutflows = 0
    const outflowDetails: CashFlowForecast['outflowDetails'] = []

    for (const row of outflowResult.rows) {
      const amount = parseFloat(row.amount as string)
      projectedOutflows += amount
      outflowDetails.push({
        destination: row.destination as string,
        amount,
        dueDate: new Date(row.due_date as string),
      })
    }

    // Calculate Wells fees (1% of outflows)
    const wellsFees = projectedOutflows * (WELLS_FEE_CONFIG.ratePercent / 100)

    const netCashFlow = projectedInflows - projectedOutflows - wellsFees
    const endingBalance = currentBalance + netCashFlow

    // Generate warnings
    const warnings: string[] = []
    if (endingBalance < 0) {
      warnings.push(`Projected cash shortage of $${Math.abs(endingBalance).toLocaleString()}`)
    }
    if (projectedOutflows > projectedInflows * 1.5) {
      warnings.push('Outflows significantly exceed expected inflows')
    }

    const forecast: CashFlowForecast = {
      period: periodLabel,
      startingBalance: currentBalance,
      projectedInflows,
      projectedOutflows,
      wellsFees,
      netCashFlow,
      endingBalance,
      inflowDetails,
      outflowDetails,
      warnings,
    }

    let message = `Cash Flow Forecast (${periodLabel}):\n`
    message += `- Starting balance: $${currentBalance.toLocaleString()}\n`
    message += `- Expected inflows: +$${projectedInflows.toLocaleString()}\n`
    message += `- Expected outflows: -$${projectedOutflows.toLocaleString()}\n`
    message += `- Wells AI fees: -$${wellsFees.toLocaleString()}\n`
    message += `- Net cash flow: ${netCashFlow >= 0 ? '+' : ''}$${netCashFlow.toLocaleString()}\n`
    message += `- Projected ending balance: $${endingBalance.toLocaleString()}\n`

    if (warnings.length > 0) {
      message += `\nWarnings:\n`
      warnings.forEach((w) => {
        message += `- ${w}\n`
      })
    }

    return { forecast, message }
  }

  /**
   * Get top suppliers by volume
   * "Show me my top 5 suppliers by volume"
   */
  static async getTopSuppliersByVolume(
    userId: string,
    limit: number = 5,
    period?: 'month' | 'quarter' | 'year'
  ): Promise<{ suppliers: { name: string; volume: number; orderCount: number; avgOrder: number }[]; message: string }> {
    let dateFilter = ''
    let periodLabel = 'all time'

    if (period) {
      const { startDate, periodLabel: label } = this.getPeriodDates(period)
      dateFilter = `AND order_date >= '${startDate.toISOString()}'`
      periodLabel = label
    }

    const result = await sql`
      SELECT
        supplier_name as name,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as volume,
        COALESCE(AVG(total_amount), 0) as avg_order
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND status != 'cancelled'
        ${period ? sql`AND order_date >= ${this.getPeriodDates(period).startDate.toISOString()}` : sql``}
      GROUP BY supplier_name
      ORDER BY volume DESC
      LIMIT ${limit}
    `

    const suppliers = result.rows.map((r) => ({
      name: r.name as string,
      volume: parseFloat(r.volume as string),
      orderCount: parseInt(r.order_count as string),
      avgOrder: parseFloat(r.avg_order as string),
    }))

    const totalVolume = suppliers.reduce((sum, s) => sum + s.volume, 0)

    let message = `Top ${limit} suppliers by volume (${periodLabel}):\n`
    suppliers.forEach((s, i) => {
      const percentage = totalVolume > 0 ? ((s.volume / totalVolume) * 100).toFixed(1) : '0'
      message += `${i + 1}. ${s.name}: $${s.volume.toLocaleString()} (${s.orderCount} orders, ${percentage}% of total)\n`
    })
    message += `\nTotal volume: $${totalVolume.toLocaleString()}`

    return { suppliers, message }
  }

  /**
   * Get transaction ledger
   * "Show me recent transactions"
   */
  static async getTransactionLedger(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ transactions: TransactionLedger[]; message: string }> {
    const result = await sql`
      SELECT
        id, created_at as date, type, reference_id,
        amount, metadata
      FROM wells_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const transactions: TransactionLedger[] = result.rows.map((row) => {
      const metadata = row.metadata as Record<string, unknown>
      return {
        id: row.id as string,
        date: new Date(row.date as string),
        type: row.type as string,
        referenceId: row.reference_id as string,
        referenceNumber: metadata?.invoiceNumber || metadata?.poNumber,
        description: this.getTransactionDescription(row.type as string, metadata),
        amount: parseFloat(row.amount as string),
        vendorName: metadata?.vendorName || metadata?.supplierName,
        category: metadata?.category,
      } as TransactionLedger
    })

    let message = `Recent transactions (${transactions.length}):\n`
    transactions.slice(0, 10).forEach((t) => {
      const sign = t.type.includes('received') || t.type.includes('created') ? '+' : '-'
      message += `- ${t.date.toLocaleDateString()}: ${t.description} ${sign}$${Math.abs(t.amount).toLocaleString()}\n`
    })

    return { transactions, message }
  }

  /**
   * Get financial period summary
   * "Give me this month's financial summary"
   */
  static async getFinancialPeriodSummary(
    userId: string,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{ summary: FinancialPeriodSummary; message: string }> {
    const { startDate, endDate, periodLabel } = this.getPeriodDates(period)

    // Revenue (invoices paid)
    const revenueResult = await sql`
      SELECT
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as invoices_paid
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND status = 'paid'
        AND paid_date >= ${startDate.toISOString()}
        AND paid_date <= ${endDate.toISOString()}
    `

    // Invoices sent
    const invoicesSentResult = await sql`
      SELECT COUNT(*) as count
      FROM wells_invoices
      WHERE user_id = ${userId}
        AND invoice_date >= ${startDate.toISOString()}
        AND invoice_date <= ${endDate.toISOString()}
    `

    // Expenses (PO spend)
    const expenseResult = await sql`
      SELECT
        COALESCE(SUM(total_amount), 0) as expenses,
        COALESCE(SUM(wells_fee), 0) as wells_fees,
        COUNT(*) as pos_created
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND order_date >= ${startDate.toISOString()}
        AND order_date <= ${endDate.toISOString()}
        AND status != 'cancelled'
    `

    // POs received
    const posReceivedResult = await sql`
      SELECT COUNT(*) as count
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND actual_delivery_date >= ${startDate.toISOString()}
        AND actual_delivery_date <= ${endDate.toISOString()}
    `

    const revenue = parseFloat(revenueResult.rows[0].revenue)
    const expenses = parseFloat(expenseResult.rows[0].expenses)
    const wellsFees = parseFloat(expenseResult.rows[0].wells_fees)

    const summary: FinancialPeriodSummary = {
      period: periodLabel,
      startDate,
      endDate,
      revenue,
      expenses,
      netIncome: revenue - expenses,
      wellsFeesCollected: wellsFees,
      invoicesSent: parseInt(invoicesSentResult.rows[0].count),
      invoicesPaid: parseInt(revenueResult.rows[0].invoices_paid),
      posCreated: parseInt(expenseResult.rows[0].pos_created),
      posReceived: parseInt(posReceivedResult.rows[0].count),
    }

    let message = `Financial Summary (${periodLabel}):\n`
    message += `- Revenue (paid invoices): $${revenue.toLocaleString()}\n`
    message += `- Expenses (PO spend): $${expenses.toLocaleString()}\n`
    message += `- Net income: ${summary.netIncome >= 0 ? '+' : ''}$${summary.netIncome.toLocaleString()}\n`
    message += `- Wells AI fees: $${wellsFees.toLocaleString()}\n`
    message += `\nActivity:\n`
    message += `- Invoices: ${summary.invoicesSent} sent, ${summary.invoicesPaid} paid\n`
    message += `- POs: ${summary.posCreated} created, ${summary.posReceived} received\n`

    return { summary, message }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static getPeriodDates(period: 'week' | 'month' | 'quarter' | 'year'): {
    startDate: Date
    endDate: Date
    previousStart: Date
    previousEnd: Date
    periodLabel: string
  } {
    const now = new Date()
    let startDate: Date
    let endDate: Date
    let previousStart: Date
    let previousEnd: Date
    let periodLabel: string

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        endDate = now
        previousStart = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousEnd = new Date(startDate.getTime() - 1)
        periodLabel = 'this week'
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = now
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        previousEnd = new Date(startDate.getTime() - 1)
        periodLabel = 'this month'
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        endDate = now
        previousStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1)
        previousEnd = new Date(startDate.getTime() - 1)
        periodLabel = 'this quarter'
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        endDate = now
        previousStart = new Date(now.getFullYear() - 1, 0, 1)
        previousEnd = new Date(startDate.getTime() - 1)
        periodLabel = 'this year'
        break
    }

    return { startDate, endDate, previousStart, previousEnd, periodLabel }
  }

  private static getTransactionDescription(type: string, metadata: Record<string, unknown>): string {
    switch (type) {
      case 'invoice_created':
        return `Invoice created for ${metadata.vendorName || 'customer'}`
      case 'payment_received':
        return `Payment received from ${metadata.vendorName || 'customer'}`
      case 'po_created':
        return `PO created for ${metadata.supplierName || 'supplier'}`
      case 'po_received':
        return `Order received from ${metadata.supplierName || 'supplier'}`
      case 'po_cancelled':
        return `PO cancelled for ${metadata.supplierName || 'supplier'}`
      case 'wells_fee_captured':
        return `Wells AI fee captured`
      default:
        return type.replace(/_/g, ' ')
    }
  }
}

// ============================================================================
// CONVERSATIONAL PARSER
// ============================================================================

/**
 * Parse natural language financial queries
 */
export function parseFinancialCommand(message: string): {
  action: 'spend' | 'payments_due' | 'accounts_payable' | 'cash_flow' | 'top_suppliers' | 'ledger' | 'summary' | 'unknown'
  params: Record<string, unknown>
} {
  const lower = message.toLowerCase()

  // Spend summary
  if (lower.includes('spend') || lower.includes('spent') || lower.includes('expenses')) {
    const period = lower.includes('week')
      ? 'week'
      : lower.includes('quarter')
        ? 'quarter'
        : lower.includes('year')
          ? 'year'
          : 'month'
    return {
      action: 'spend',
      params: { period },
    }
  }

  // Payments due
  if ((lower.includes('payment') || lower.includes('due')) && (lower.includes('due') || lower.includes('owe') || lower.includes('upcoming'))) {
    const period = lower.includes('today') ? 'today' : lower.includes('month') ? 'month' : 'week'
    return {
      action: 'payments_due',
      params: { period },
    }
  }

  // Accounts payable
  if (lower.includes('owe') || lower.includes('payable') || lower.includes('outstanding')) {
    return {
      action: 'accounts_payable',
      params: {},
    }
  }

  // Cash flow forecast
  if (lower.includes('cash flow') || lower.includes('forecast') || lower.includes('project')) {
    const period = lower.includes('week') ? 'week' : lower.includes('quarter') ? 'quarter' : 'month'
    return {
      action: 'cash_flow',
      params: { period },
    }
  }

  // Top suppliers
  if (lower.includes('top') && (lower.includes('supplier') || lower.includes('vendor') || lower.includes('volume'))) {
    const limitMatch = message.match(/top\s+(\d+)/i)
    return {
      action: 'top_suppliers',
      params: { limit: limitMatch ? parseInt(limitMatch[1]) : 5 },
    }
  }

  // Transaction ledger
  if (lower.includes('transaction') || lower.includes('ledger') || lower.includes('activity')) {
    return {
      action: 'ledger',
      params: {},
    }
  }

  // Financial summary
  if (lower.includes('financial') || lower.includes('summary') || lower.includes('overview')) {
    const period = lower.includes('week')
      ? 'week'
      : lower.includes('quarter')
        ? 'quarter'
        : lower.includes('year')
          ? 'year'
          : 'month'
    return {
      action: 'summary',
      params: { period },
    }
  }

  return { action: 'unknown', params: {} }
}
