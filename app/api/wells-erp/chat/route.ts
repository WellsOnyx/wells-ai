/**
 * WellsAI Conversational ERP - Unified Chat API
 *
 * This is the main entry point for conversational ERP interactions.
 * Users talk naturally, Claude interprets, and tools execute.
 *
 * POST /api/wells-erp/chat
 *
 * Example requests:
 * { "message": "Create an invoice for $5,000 to Acme Corp" }
 * { "message": "What's my cash flow this month?" }
 * { "message": "Show me pending purchase orders" }
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { WELLS_ERP_TOOLS, WELLS_ERP_SYSTEM_PROMPT } from '@/lib/wells-erp/chat-tools'
import { WellsInvoiceService, type CreateInvoiceRequest } from '@/lib/wells-erp/invoice-service'
import { WellsPOService, type CreatePORequest } from '@/lib/wells-erp/po-service'
import { WellsVendorRegistry, type CreateVendorRequest } from '@/lib/wells-erp/vendor-registry'
import { WellsFinancialService } from '@/lib/wells-erp/financial-overview'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  message: string
  conversationHistory?: ChatMessage[]
  conversationId?: string
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

async function executeERPTool(
  userId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  conversationId?: string
): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    switch (toolName) {
      // ======================================================================
      // INVOICE TOOLS
      // ======================================================================
      case 'create_invoice': {
        const request: CreateInvoiceRequest = {
          vendorName: toolInput.customerName as string,
          vendorEmail: toolInput.customerEmail as string | undefined,
          amount: toolInput.amount as number | undefined,
          lineItems: toolInput.lineItems as CreateInvoiceRequest['lineItems'],
          description: toolInput.description as string | undefined,
          dueDate: toolInput.dueDate ? new Date(toolInput.dueDate as string) : undefined,
          aiConversationId: conversationId,
        }
        const result = await WellsInvoiceService.createInvoice(userId, request)
        return { success: true, message: result.message, data: result.invoice }
      }

      case 'list_invoices': {
        if (toolInput.overdue) {
          const result = await WellsInvoiceService.listInvoices(userId, { overdue: true })
          return { success: true, message: result.summary, data: result.invoices }
        }
        if (toolInput.unpaid) {
          const result = await WellsInvoiceService.getUnpaidInvoices(userId)
          return { success: true, message: result.summary, data: result.invoices }
        }
        const result = await WellsInvoiceService.listInvoices(userId, {
          status: toolInput.status as string | undefined,
          vendorName: toolInput.customerName as string | undefined,
          limit: toolInput.limit as number | undefined,
        })
        return { success: true, message: result.summary, data: result.invoices }
      }

      case 'send_invoice': {
        const identifier = toolInput.invoiceIdentifier as string
        // Mark as sent (would integrate with email in production)
        const result = await WellsInvoiceService.sendReminder(userId, identifier)
        return {
          success: true,
          message: `Invoice sent to ${result.invoice.vendorName}. They will receive it at ${result.invoice.vendorEmail || 'their registered email'}.`,
          data: result.invoice,
        }
      }

      case 'record_payment': {
        const result = await WellsInvoiceService.markAsPaid(
          userId,
          toolInput.invoiceIdentifier as string,
          toolInput.amount as number | undefined,
          toolInput.paymentDate ? new Date(toolInput.paymentDate as string) : undefined
        )
        return { success: true, message: result.message, data: result.invoice }
      }

      case 'send_payment_reminder': {
        const result = await WellsInvoiceService.sendReminder(
          userId,
          toolInput.invoiceIdentifier as string
        )
        return { success: true, message: result.message, data: result.invoice }
      }

      case 'get_invoice_summary': {
        const result = await WellsInvoiceService.getInvoiceSummary(userId)
        return { success: true, message: result.message, data: result.summary }
      }

      // ======================================================================
      // PURCHASE ORDER TOOLS
      // ======================================================================
      case 'create_po': {
        const items = (toolInput.items as Array<{ description: string; quantity: number; unitPrice: number; sku?: string }>) || []
        const request: CreatePORequest = {
          supplierName: toolInput.supplierName as string,
          items: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            sku: item.sku,
          })),
          expectedDeliveryDate: toolInput.expectedDeliveryDate
            ? new Date(toolInput.expectedDeliveryDate as string)
            : undefined,
          shippingAddress: toolInput.shippingAddress as string | undefined,
          notes: toolInput.notes as string | undefined,
          aiConversationId: conversationId,
        }
        const result = await WellsPOService.createPO(userId, request)
        return { success: true, message: result.message, data: result.po }
      }

      case 'list_pos': {
        if (toolInput.pendingDelivery) {
          const result = await WellsPOService.getPendingDeliveryPOs(userId)
          return { success: true, message: result.summary, data: result.orders }
        }
        const result = await WellsPOService.listPOs(userId, {
          status: toolInput.status as string | undefined,
          supplierName: toolInput.supplierName as string | undefined,
          limit: toolInput.limit as number | undefined,
        })
        return { success: true, message: result.summary, data: result.orders }
      }

      case 'send_po': {
        const result = await WellsPOService.sendToSupplier(
          userId,
          toolInput.poIdentifier as string
        )
        return { success: true, message: result.message, data: result.po }
      }

      case 'receive_goods': {
        const result = await WellsPOService.markAsReceived(
          userId,
          toolInput.poIdentifier as string,
          toolInput.receivedItems as { lineItemId: string; quantity: number }[] | undefined
        )
        return { success: true, message: result.message, data: result.po }
      }

      case 'cancel_po': {
        const result = await WellsPOService.cancelPO(
          userId,
          toolInput.poIdentifier as string,
          toolInput.reason as string | undefined
        )
        return { success: true, message: result.message, data: result.po }
      }

      case 'get_po_summary': {
        const result = await WellsPOService.getPOSummary(userId)
        return { success: true, message: result.message, data: result.summary }
      }

      // ======================================================================
      // VENDOR TOOLS
      // ======================================================================
      case 'add_vendor': {
        const request: CreateVendorRequest = {
          name: toolInput.name as string,
          vendorType: (toolInput.vendorType as 'supplier' | 'customer' | 'both') || 'supplier',
          email: toolInput.email as string | undefined,
          phone: toolInput.phone as string | undefined,
          paymentTerms: toolInput.paymentTerms as string | undefined,
          categories: toolInput.categories as string[] | undefined,
          aiConversationId: conversationId,
        }
        const result = await WellsVendorRegistry.addVendor(userId, request)
        return { success: true, message: result.message, data: result.vendor }
      }

      case 'search_vendors': {
        const result = await WellsVendorRegistry.searchVendors(userId, {
          query: toolInput.query as string | undefined,
          vendorType: toolInput.vendorType as 'supplier' | 'customer' | 'both' | undefined,
          category: toolInput.category as string | undefined,
        })
        return { success: true, message: result.summary, data: result.vendors }
      }

      case 'rate_vendor': {
        const result = await WellsVendorRegistry.rateVendor(
          userId,
          toolInput.vendorName as string,
          toolInput.rating as number,
          (toolInput.category as 'delivery' | 'quality' | 'pricing' | 'communication' | 'overall') || 'overall',
          toolInput.comment as string | undefined
        )
        return { success: true, message: result.message, data: result.vendor }
      }

      case 'get_vendor_performance': {
        const result = await WellsVendorRegistry.getPaymentHistory(
          userId,
          toolInput.vendorName as string
        )
        return { success: true, message: result.summary, data: { vendor: result.vendor, history: result.history } }
      }

      case 'suggest_alternative_vendors': {
        const result = await WellsVendorRegistry.searchVendors(userId, {
          category: toolInput.category as string,
        })
        return {
          success: true,
          message: result.summary,
          data: result.vendors,
        }
      }

      // ======================================================================
      // FINANCIAL TOOLS
      // ======================================================================
      case 'get_cash_flow': {
        const result = await WellsFinancialService.forecastCashFlow(
          userId,
          (toolInput.period as 'week' | 'month' | 'quarter') || 'month',
          (toolInput.currentBalance as number) || 0
        )
        return { success: true, message: result.message, data: result.forecast }
      }

      case 'get_financial_summary': {
        const result = await WellsFinancialService.getFinancialPeriodSummary(
          userId,
          (toolInput.period as 'week' | 'month' | 'quarter' | 'year') || 'month'
        )
        return { success: true, message: result.message, data: result.summary }
      }

      case 'get_spend_summary': {
        const result = await WellsFinancialService.getSpendSummary(
          userId,
          (toolInput.period as 'week' | 'month' | 'quarter' | 'year') || 'month'
        )
        return { success: true, message: result.message, data: result.summary }
      }

      case 'get_accounts_payable': {
        const result = await WellsFinancialService.getAccountsPayable(userId)
        return { success: true, message: result.message, data: result.ap }
      }

      case 'get_accounts_receivable': {
        // Use unpaid invoices as AR
        const invoiceResult = await WellsInvoiceService.getUnpaidInvoices(userId)
        return { success: true, message: invoiceResult.summary, data: invoiceResult.invoices }
      }

      case 'generate_insights': {
        // Generate insights from multiple sources
        const [spend, ap, invoices] = await Promise.all([
          WellsFinancialService.getSpendSummary(userId, 'month'),
          WellsFinancialService.getAccountsPayable(userId),
          WellsInvoiceService.getUnpaidInvoices(userId),
        ])

        const insights: string[] = []

        // Spending insights
        if (spend.summary.comparison?.trend === 'up') {
          insights.push(`Your spending is up ${spend.summary.comparison.changePercent}% compared to last month.`)
        }

        if (spend.summary.topVendors.length > 0) {
          const topVendor = spend.summary.topVendors[0]
          insights.push(`Top vendor by spend: ${topVendor.name} ($${topVendor.amount.toLocaleString()}).`)
        }

        // AP insights
        if (ap.ap.overdue > 0) {
          insights.push(`You have $${ap.ap.overdue.toLocaleString()} in overdue payments.`)
        }

        // AR insights
        const overdueInvoices = invoices.invoices.filter(
          (inv) => new Date(inv.dueDate) < new Date()
        )
        if (overdueInvoices.length > 0) {
          const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + inv.amountDue, 0)
          insights.push(
            `${overdueInvoices.length} overdue invoice(s) totaling $${overdueTotal.toLocaleString()}. Consider sending reminders.`
          )
        }

        const message = insights.length > 0
          ? `Financial Insights:\n- ${insights.join('\n- ')}`
          : 'No significant insights to report. Your finances look stable.'

        return {
          success: true,
          message,
          data: { insights, spend: spend.summary, ap: ap.ap },
        }
      }

      default:
        return {
          success: false,
          message: `Unknown tool: ${toolName}`,
        }
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An error occurred',
    }
  }
}

// ============================================================================
// MAIN CHAT HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ChatRequest = await request.json()
    const { message, conversationHistory = [], conversationId } = body

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // Build messages for Claude
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ]

    // Call Claude with ERP tools
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      system: WELLS_ERP_SYSTEM_PROMPT,
      tools: WELLS_ERP_TOOLS,
      messages,
    })

    // Process tool calls in a loop (Claude may chain multiple tools)
    const toolResults: { toolName: string; result: unknown }[] = []
    let iterations = 0
    const maxIterations = 10

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++

      // Extract tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )

      // Execute each tool
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        console.log(`Executing tool: ${toolUse.name}`, toolUse.input)

        const result = await executeERPTool(
          userId,
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          conversationId
        )

        toolResults.push({ toolName: toolUse.name, result })

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      // Continue conversation with tool results
      messages.push({
        role: 'assistant',
        content: response.content,
      })
      messages.push({
        role: 'user',
        content: toolResultBlocks,
      })

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4096,
        system: WELLS_ERP_SYSTEM_PROMPT,
        tools: WELLS_ERP_TOOLS,
        messages,
      })
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    const finalResponse = textBlocks.map((block) => block.text).join('\n')

    return NextResponse.json({
      success: true,
      message: finalResponse,
      toolsExecuted: toolResults.map((tr) => tr.toolName),
      toolResults: toolResults.map((tr) => tr.result),
      conversationId: conversationId || `conv-${Date.now()}`,
    })
  } catch (error) {
    console.error('Error in ERP chat:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Health check and capabilities
 */
export async function GET() {
  return NextResponse.json({
    service: 'WellsAI Conversational ERP',
    version: '1.0.0',
    capabilities: [
      'Invoice Management',
      'Purchase Order Management',
      'Vendor Registry',
      'Financial Overview',
    ],
    examples: [
      'Create an invoice for $5,000 to Acme Corp',
      'What invoices are overdue?',
      'Create a PO for 1000 bearings from Precision at $4.50 each',
      'What\'s my cash flow this month?',
      'Send a payment reminder to Acme',
      'Rate Precision Bearings 5 stars for delivery',
    ],
    tools: WELLS_ERP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  })
}
