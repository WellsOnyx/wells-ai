/**
 * WellsAI ERP - Financials API
 *
 * Conversational financial queries and analytics.
 * All operations designed for AI-driven interactions.
 *
 * GET /api/wells-erp/financials - Financial queries (spend, payments due, AP, cash flow, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  WellsFinancialService,
  parseFinancialCommand,
} from '@/lib/wells-erp/financial-overview'

/**
 * GET - Financial queries
 * Query params: action (spend | payments_due | accounts_payable | cash_flow | top_suppliers | ledger | summary)
 * Or: message (for conversational queries)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const message = searchParams.get('message')

    // Conversational query
    if (message) {
      const parsed = parseFinancialCommand(message)

      switch (parsed.action) {
        case 'spend':
          const spendResult = await WellsFinancialService.getSpendSummary(
            userId,
            (parsed.params.period as 'week' | 'month' | 'quarter' | 'year') || 'month'
          )
          return NextResponse.json({ success: true, ...spendResult, parsedIntent: parsed })

        case 'payments_due':
          const paymentsResult = await WellsFinancialService.getPaymentsDue(
            userId,
            (parsed.params.period as 'today' | 'week' | 'month') || 'week'
          )
          return NextResponse.json({ success: true, ...paymentsResult, parsedIntent: parsed })

        case 'accounts_payable':
          const apResult = await WellsFinancialService.getAccountsPayable(userId)
          return NextResponse.json({ success: true, ...apResult, parsedIntent: parsed })

        case 'cash_flow':
          const cfResult = await WellsFinancialService.forecastCashFlow(
            userId,
            (parsed.params.period as 'week' | 'month' | 'quarter') || 'month'
          )
          return NextResponse.json({ success: true, ...cfResult, parsedIntent: parsed })

        case 'top_suppliers':
          const topResult = await WellsFinancialService.getTopSuppliersByVolume(
            userId,
            (parsed.params.limit as number) || 5
          )
          return NextResponse.json({ success: true, ...topResult, parsedIntent: parsed })

        case 'ledger':
          const ledgerResult = await WellsFinancialService.getTransactionLedger(userId)
          return NextResponse.json({ success: true, ...ledgerResult, parsedIntent: parsed })

        case 'summary':
          const summaryResult = await WellsFinancialService.getFinancialPeriodSummary(
            userId,
            (parsed.params.period as 'week' | 'month' | 'quarter' | 'year') || 'month'
          )
          return NextResponse.json({ success: true, ...summaryResult, parsedIntent: parsed })

        default:
          // Default to financial summary
          const defaultResult = await WellsFinancialService.getFinancialPeriodSummary(userId, 'month')
          return NextResponse.json({
            success: true,
            ...defaultResult,
            parsedIntent: parsed,
            hint: 'Try: "What\'s my spend this month?" or "What payments are due this week?"',
          })
      }
    }

    // Direct API query
    const action = searchParams.get('action')
    const period = searchParams.get('period') as 'week' | 'month' | 'quarter' | 'year' | null
    const limit = searchParams.get('limit')

    switch (action) {
      case 'spend':
        const spendResult = await WellsFinancialService.getSpendSummary(userId, period || 'month')
        return NextResponse.json({ success: true, ...spendResult })

      case 'payments_due':
        const paymentsResult = await WellsFinancialService.getPaymentsDue(
          userId,
          (period as 'today' | 'week' | 'month') || 'week'
        )
        return NextResponse.json({ success: true, ...paymentsResult })

      case 'accounts_payable':
        const apResult = await WellsFinancialService.getAccountsPayable(userId)
        return NextResponse.json({ success: true, ...apResult })

      case 'cash_flow':
        const currentBalance = parseFloat(searchParams.get('currentBalance') || '0')
        const cfResult = await WellsFinancialService.forecastCashFlow(
          userId,
          (period as 'week' | 'month' | 'quarter') || 'month',
          currentBalance
        )
        return NextResponse.json({ success: true, ...cfResult })

      case 'top_suppliers':
        const topResult = await WellsFinancialService.getTopSuppliersByVolume(
          userId,
          limit ? parseInt(limit) : 5,
          period as 'month' | 'quarter' | 'year' | undefined
        )
        return NextResponse.json({ success: true, ...topResult })

      case 'ledger':
        const ledgerLimit = limit ? parseInt(limit) : 20
        const offset = parseInt(searchParams.get('offset') || '0')
        const ledgerResult = await WellsFinancialService.getTransactionLedger(userId, ledgerLimit, offset)
        return NextResponse.json({ success: true, ...ledgerResult })

      case 'summary':
      default:
        const summaryResult = await WellsFinancialService.getFinancialPeriodSummary(userId, period || 'month')
        return NextResponse.json({ success: true, ...summaryResult })
    }
  } catch (error) {
    console.error('Error fetching financials:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch financial data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Run financial analysis/calculations
 * Body: { action: string, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check for conversational input
    if (body.message && typeof body.message === 'string') {
      const parsed = parseFinancialCommand(body.message)

      // Route to appropriate GET handler logic
      switch (parsed.action) {
        case 'spend':
          const spendResult = await WellsFinancialService.getSpendSummary(
            userId,
            (parsed.params.period as 'week' | 'month' | 'quarter' | 'year') || 'month'
          )
          return NextResponse.json({ success: true, ...spendResult, parsedIntent: parsed })

        case 'cash_flow':
          const cfResult = await WellsFinancialService.forecastCashFlow(
            userId,
            (parsed.params.period as 'week' | 'month' | 'quarter') || 'month',
            body.currentBalance || 0
          )
          return NextResponse.json({ success: true, ...cfResult, parsedIntent: parsed })

        default:
          const summaryResult = await WellsFinancialService.getFinancialPeriodSummary(userId, 'month')
          return NextResponse.json({ success: true, ...summaryResult, parsedIntent: parsed })
      }
    }

    // Direct API request
    const { action, period, currentBalance } = body

    switch (action) {
      case 'forecast':
        const cfResult = await WellsFinancialService.forecastCashFlow(
          userId,
          period || 'month',
          currentBalance || 0
        )
        return NextResponse.json({ success: true, ...cfResult })

      case 'full_report':
        // Generate comprehensive financial report
        const [spend, ap, cf, suppliers, summary] = await Promise.all([
          WellsFinancialService.getSpendSummary(userId, period || 'month'),
          WellsFinancialService.getAccountsPayable(userId),
          WellsFinancialService.forecastCashFlow(userId, period || 'month', currentBalance || 0),
          WellsFinancialService.getTopSuppliersByVolume(userId, 5, period),
          WellsFinancialService.getFinancialPeriodSummary(userId, period || 'month'),
        ])

        return NextResponse.json({
          success: true,
          report: {
            spend: spend.summary,
            accountsPayable: ap.ap,
            cashFlow: cf.forecast,
            topSuppliers: suppliers.suppliers,
            periodSummary: summary.summary,
          },
          message: `Full financial report for ${summary.summary.period}`,
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing financial request:', error)
    return NextResponse.json(
      {
        error: 'Failed to process financial request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
