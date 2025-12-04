// @ts-nocheck
/**
 * Layer 3: Conversational ERP - Summary Endpoint
 * GET /api/conversational/erp/summary
 *
 * Get ERP summary via conversational interface
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  ConversationalResponse,
} from '../types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const sessionId = searchParams.get('sessionId') || crypto.randomUUID()

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      )
    }

    // Build comprehensive summary
    const summary = buildSummary(accountId)

    const response: ConversationalResponse = {
      message: summary.message,
      sessionId,
      state: 'completed',
      intent: 'get_summary',
      actionResult: {
        success: true,
        action: 'get_summary',
        message: 'Summary generated',
        data: summary.data,
      },
      quickReplies: [
        'Pay overdue invoices',
        'View open POs',
        'Check float balance',
        'Make a payment',
      ],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('ERP summary error:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

function buildSummary(accountId: string): {
  message: string
  data: Record<string, unknown>
} {
  // In production, this would fetch real data from the ERP
  const data = {
    balances: {
      grain: 85000,
      floatPool: 84250,
      creditLineAvailable: 100000,
      creditLineUsed: 15000,
    },
    openItems: {
      openPOs: { count: 3, amount: 60250 },
      unpaidInvoices: { count: 2, amount: 23250 },
      overdueInvoices: { count: 1, amount: 7500 },
      pendingPayments: { count: 1, amount: 15750 },
    },
    thisMonth: {
      paymentsMade: 12340,
      paymentsReceived: 8500,
      yieldEarned: 410.96,
      newVendors: 2,
    },
    alerts: [
      { type: 'warning', message: '1 invoice is overdue by 21 days' },
      { type: 'info', message: 'Your float pool is earning 5% APY' },
    ],
  }

  const message = `📊 **ERP Summary for Today**

💰 **Balances**
• GRAIN Balance: **$${data.balances.grain.toLocaleString()}**
• Float Pool: $${data.balances.floatPool.toLocaleString()} (5% APY)
• Credit Available: $${data.balances.creditLineAvailable.toLocaleString()}

📋 **Open Items**
• Open POs: ${data.openItems.openPOs.count} ($${data.openItems.openPOs.amount.toLocaleString()})
• Unpaid Invoices: ${data.openItems.unpaidInvoices.count} ($${data.openItems.unpaidInvoices.amount.toLocaleString()})
• ⚠️ **Overdue: ${data.openItems.overdueInvoices.count} ($${data.openItems.overdueInvoices.amount.toLocaleString()})**
• Pending Payments: ${data.openItems.pendingPayments.count}

📈 **This Month**
• Payments Made: $${data.thisMonth.paymentsMade.toLocaleString()}
• Yield Earned: $${data.thisMonth.yieldEarned.toFixed(2)}

⚡ **Alerts**
${data.alerts.map(a => `• ${a.type === 'warning' ? '⚠️' : 'ℹ️'} ${a.message}`).join('\n')}`

  return { message, data }
}

export { GET as getSummary }
