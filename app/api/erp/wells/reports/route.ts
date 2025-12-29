// @ts-nocheck
/**
 * WellsAI Conversational ERP - Reports API
 *
 * Generate financial reports with natural language support.
 *
 * GET /api/erp/wells/reports - Get report
 * POST /api/erp/wells/reports - Generate custom report
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { WellsFinancialService } from '@/lib/wells-erp/financial-overview'
import { WellsInvoiceService } from '@/lib/wells-erp/invoice-service'
import { WellsPOService } from '@/lib/wells-erp/po-service'
import { getWellsERP } from '@/lib/erp/wells-erp'

// ============================================================================
// GET - Get/Generate Report
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || 'default-user'
    const reportType = searchParams.get('type') as 'ap' | 'ar' | 'cashflow' | 'spend' | 'summary' | 'vendors' | 'custom'
    const period = searchParams.get('period') as 'week' | 'month' | 'quarter' | 'year' || 'month'
    const format = searchParams.get('format') || 'json'

    if (!reportType) {
      return NextResponse.json(
        { error: 'type is required (ap, ar, cashflow, spend, summary, vendors)' },
        { status: 400 }
      )
    }

    const erp = getWellsERP(userId)
    let report: unknown

    switch (reportType) {
      case 'ap':
        report = await erp.generateReport('ap', { period })
        break

      case 'ar':
        report = await erp.generateReport('ar', { period })
        break

      case 'cashflow':
        report = await erp.generateReport('cashflow', { period })
        break

      case 'spend':
        const spendResult = await WellsFinancialService.getSpendSummary(userId, period)
        report = {
          type: 'spend',
          title: `Spending Report - ${capitalizeFirst(period)}`,
          period: getPeriodDates(period),
          generatedAt: new Date(),
          summary: spendResult.message,
          data: spendResult.summary,
          insights: generateSpendInsights(spendResult.summary),
        }
        break

      case 'summary':
        const summaryResult = await WellsFinancialService.getFinancialPeriodSummary(userId, period)
        report = {
          type: 'summary',
          title: `Financial Summary - ${capitalizeFirst(period)}`,
          period: getPeriodDates(period),
          generatedAt: new Date(),
          summary: summaryResult.message,
          data: summaryResult.summary,
          insights: generateSummaryInsights(summaryResult.summary),
        }
        break

      case 'vendors':
        const vendorResult = await WellsFinancialService.getTopSuppliersByVolume(userId, 20)
        report = {
          type: 'vendors',
          title: 'Vendor Performance Report',
          period: getPeriodDates(period),
          generatedAt: new Date(),
          summary: vendorResult.message,
          data: { topSuppliers: vendorResult.suppliers },
          insights: generateVendorInsights(vendorResult.suppliers),
        }
        break

      default:
        report = await erp.generateReport('custom', { period })
    }

    // Format response based on requested format
    if (format === 'csv') {
      const csv = convertToCSV(report)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${reportType}-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      report,
    })
  } catch (error) {
    console.error('Reports GET error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Generate Custom Report
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = 'default-user', naturalLanguage, type, period, filters, customQuery } = body

    // Support natural language queries
    if (naturalLanguage) {
      const erp = getWellsERP(userId)
      const chatResult = await erp.chat(naturalLanguage)

      // Extract report data from response
      return NextResponse.json({
        success: true,
        report: {
          type: 'custom',
          title: 'Custom Report',
          generatedAt: new Date(),
          query: naturalLanguage,
          response: chatResult.response,
          data: chatResult.actions.length > 0 ? chatResult.actions[0].result : null,
        },
      })
    }

    // Structured report request
    const reportConfig = {
      type: type || 'custom',
      period: period || 'month',
      filters: filters || {},
      customQuery: customQuery || null,
    }

    const periodDates = getPeriodDates(reportConfig.period)

    // Build custom report based on configuration
    const reportData: Record<string, unknown> = {}
    const insights: string[] = []

    // Get invoice data if requested
    if (!filters || filters.includeInvoices !== false) {
      const invoiceResult = await WellsInvoiceService.getInvoiceSummary(
        userId,
        periodDates.start,
        periodDates.end
      )
      reportData.invoices = invoiceResult.summary
      insights.push(`Total billed: $${invoiceResult.summary.totalAmount.toLocaleString()}`)
      insights.push(`Collection rate: ${invoiceResult.summary.totalAmount > 0 ? ((invoiceResult.summary.paidAmount / invoiceResult.summary.totalAmount) * 100).toFixed(1) : 0}%`)
    }

    // Get PO data if requested
    if (!filters || filters.includePOs !== false) {
      const poResult = await WellsPOService.getPOSummary(userId, periodDates.start, periodDates.end)
      reportData.purchaseOrders = poResult.summary
      insights.push(`Total ordered: $${poResult.summary.totalAmount.toLocaleString()}`)
    }

    // Get cash flow if requested
    if (!filters || filters.includeCashflow !== false) {
      const cfResult = await WellsFinancialService.forecastCashFlow(userId, reportConfig.period)
      reportData.cashflow = cfResult.forecast
      insights.push(`Net cash flow: $${cfResult.forecast.netCashFlow.toLocaleString()}`)
    }

    // Get AP/AR if requested
    if (!filters || filters.includeAPAR !== false) {
      const apResult = await WellsFinancialService.getAccountsPayable(userId)
      reportData.accountsPayable = apResult.ap
      insights.push(`Total payables: $${apResult.ap.totalDue.toLocaleString()}`)
    }

    // Get top vendors if requested
    if (filters?.includeVendors) {
      const vendorResult = await WellsFinancialService.getTopSuppliersByVolume(userId, 10)
      reportData.topVendors = vendorResult.suppliers
    }

    // Generate Wells fee summary
    const feeResult = await sql`
      SELECT
        SUM(CASE WHEN type = 'wells_fee_captured' THEN amount ELSE 0 END) as total_fees,
        COUNT(CASE WHEN type = 'wells_fee_captured' THEN 1 END) as fee_count
      FROM wells_transactions
      WHERE user_id = ${userId}
        AND created_at >= ${periodDates.start.toISOString()}
        AND created_at <= ${periodDates.end.toISOString()}
    `
    reportData.wellsFees = {
      totalCollected: parseFloat(feeResult.rows[0].total_fees) || 0,
      transactionCount: parseInt(feeResult.rows[0].fee_count) || 0,
    }

    const report = {
      type: 'custom',
      title: customQuery || `Custom Financial Report - ${capitalizeFirst(reportConfig.period)}`,
      period: periodDates,
      generatedAt: new Date(),
      filters: reportConfig.filters,
      data: reportData,
      insights,
    }

    return NextResponse.json({
      success: true,
      report,
    })
  } catch (error) {
    console.error('Reports POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date()
  let start: Date

  switch (period) {
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      break
    case 'year':
      start = new Date(now.getFullYear(), 0, 1)
      break
    default: // month
      start = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  return { start, end: now }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function generateSpendInsights(summary: Record<string, unknown>): string[] {
  const insights: string[] = []

  if (summary.totalSpend) {
    insights.push(`Total spend: $${(summary.totalSpend as number).toLocaleString()}`)
  }
  if (summary.topCategory) {
    insights.push(`Top spending category: ${summary.topCategory}`)
  }
  if (summary.averageOrderValue) {
    insights.push(`Average order value: $${(summary.averageOrderValue as number).toLocaleString()}`)
  }

  return insights
}

function generateSummaryInsights(summary: Record<string, unknown>): string[] {
  const insights: string[] = []

  if (summary.totalRevenue !== undefined && summary.totalExpenses !== undefined) {
    const revenue = summary.totalRevenue as number
    const expenses = summary.totalExpenses as number
    const netIncome = revenue - expenses
    insights.push(`Net income: $${netIncome.toLocaleString()}`)
    insights.push(`Profit margin: ${revenue > 0 ? ((netIncome / revenue) * 100).toFixed(1) : 0}%`)
  }

  if (summary.wellsFeesCollected) {
    insights.push(`Wells AI fees collected: $${(summary.wellsFeesCollected as number).toLocaleString()}`)
  }

  return insights
}

function generateVendorInsights(suppliers: unknown[]): string[] {
  const insights: string[] = []

  if (suppliers.length > 0) {
    const topSupplier = suppliers[0] as Record<string, unknown>
    insights.push(`Top supplier: ${topSupplier.name} ($${(topSupplier.totalSpend as number).toLocaleString()})`)
    insights.push(`Active vendors: ${suppliers.length}`)

    // Calculate concentration risk
    const totalSpend = suppliers.reduce((sum, s) => sum + ((s as Record<string, unknown>).totalSpend as number || 0), 0)
    const topThreeSpend = suppliers.slice(0, 3).reduce((sum, s) => sum + ((s as Record<string, unknown>).totalSpend as number || 0), 0)
    const concentration = totalSpend > 0 ? (topThreeSpend / totalSpend) * 100 : 0

    if (concentration > 70) {
      insights.push(`High vendor concentration: Top 3 account for ${concentration.toFixed(1)}% of spend`)
    }
  }

  return insights
}

function convertToCSV(report: unknown): string {
  const r = report as Record<string, unknown>
  const lines: string[] = []

  // Header
  lines.push(`Report: ${r.title}`)
  lines.push(`Generated: ${new Date(r.generatedAt as string).toISOString()}`)
  lines.push(`Period: ${(r.period as { start: Date }).start} to ${(r.period as { end: Date }).end}`)
  lines.push('')

  // Summary
  lines.push('Summary')
  lines.push(r.summary as string)
  lines.push('')

  // Insights
  lines.push('Insights')
  const insights = r.insights as string[]
  for (const insight of insights) {
    lines.push(insight)
  }
  lines.push('')

  // Data (simplified - just flatten first level)
  lines.push('Data')
  const data = r.data as Record<string, unknown>
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null) {
      lines.push(`${key}:`)
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`  ${k},${v}`)
      }
    } else {
      lines.push(`${key},${value}`)
    }
  }

  return lines.join('\n')
}
