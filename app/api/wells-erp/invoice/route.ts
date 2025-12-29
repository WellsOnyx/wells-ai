/**
 * WellsAI ERP - Invoice API
 *
 * Conversational invoice management endpoints.
 * All operations designed for AI-driven interactions.
 *
 * POST /api/wells-erp/invoice - Create invoice
 * GET /api/wells-erp/invoice - List/search invoices
 * PATCH /api/wells-erp/invoice - Update invoice (mark paid, send reminder, cancel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  WellsInvoiceService,
  parseInvoiceCommand,
  CreateInvoiceRequest,
  InvoiceSearchCriteria,
  InvoiceStatus,
} from '@/lib/wells-erp/invoice-service'

/**
 * POST - Create a new invoice
 * Body: CreateInvoiceRequest | { message: string } for conversational input
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check if this is a conversational request
    if (body.message && typeof body.message === 'string') {
      const parsed = parseInvoiceCommand(body.message)

      if (parsed.action === 'create') {
        if (!parsed.params.vendorName) {
          return NextResponse.json(
            {
              success: false,
              error: 'Could not determine vendor name from message',
              hint: 'Try: "Create an invoice for Acme Corp for $5000"',
            },
            { status: 400 }
          )
        }

        const request: CreateInvoiceRequest = {
          vendorName: parsed.params.vendorName as string,
          amount: parsed.params.amount as number,
          aiConversationId: body.conversationId,
          aiCommand: body.message,
        }

        const result = await WellsInvoiceService.createInvoice(userId, request)
        return NextResponse.json({
          success: true,
          ...result,
          parsedIntent: parsed,
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Message not recognized as invoice creation',
          parsedIntent: parsed,
          hint: 'Try: "Create an invoice for Acme Corp for $5000"',
        },
        { status: 400 }
      )
    }

    // Direct API request
    const invoiceRequest: CreateInvoiceRequest = {
      vendorId: body.vendorId,
      vendorName: body.vendorName,
      vendorEmail: body.vendorEmail,
      amount: body.amount,
      lineItems: body.lineItems,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      paymentTerms: body.paymentTerms,
      poNumber: body.poNumber,
      aiConversationId: body.conversationId,
      aiCommand: body.message,
    }

    if (!invoiceRequest.vendorName) {
      return NextResponse.json(
        { error: 'vendorName is required' },
        { status: 400 }
      )
    }

    if (!invoiceRequest.amount && (!invoiceRequest.lineItems || invoiceRequest.lineItems.length === 0)) {
      return NextResponse.json(
        { error: 'Either amount or lineItems is required' },
        { status: 400 }
      )
    }

    const result = await WellsInvoiceService.createInvoice(userId, invoiceRequest)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      {
        error: 'Failed to create invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - List/search invoices
 * Query params: status, vendorId, vendorName, overdue, limit, offset
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
      const parsed = parseInvoiceCommand(message)

      switch (parsed.action) {
        case 'list':
          if (parsed.params.overdue) {
            const result = await WellsInvoiceService.listInvoices(userId, { overdue: true })
            return NextResponse.json({ success: true, ...result, parsedIntent: parsed })
          }
          if (parsed.params.unpaid) {
            const result = await WellsInvoiceService.getUnpaidInvoices(userId)
            return NextResponse.json({ success: true, ...result, parsedIntent: parsed })
          }
          const listResult = await WellsInvoiceService.listInvoices(userId)
          return NextResponse.json({ success: true, ...listResult, parsedIntent: parsed })

        case 'summary':
          const summaryResult = await WellsInvoiceService.getInvoiceSummary(userId)
          return NextResponse.json({ success: true, ...summaryResult, parsedIntent: parsed })

        default:
          return NextResponse.json(
            {
              success: false,
              error: 'Could not understand the query',
              parsedIntent: parsed,
              hint: 'Try: "Show me unpaid invoices" or "What invoices are overdue?"',
            },
            { status: 400 }
          )
      }
    }

    // Direct API query
    const criteria: InvoiceSearchCriteria = {}

    const status = searchParams.get('status')
    if (status) {
      criteria.status = status as InvoiceStatus
    }

    const vendorId = searchParams.get('vendorId')
    if (vendorId) {
      criteria.vendorId = vendorId
    }

    const vendorName = searchParams.get('vendorName')
    if (vendorName) {
      criteria.vendorName = vendorName
    }

    const overdue = searchParams.get('overdue')
    if (overdue === 'true') {
      criteria.overdue = true
    }

    const limit = searchParams.get('limit')
    if (limit) {
      criteria.limit = parseInt(limit)
    }

    const offset = searchParams.get('offset')
    if (offset) {
      criteria.offset = parseInt(offset)
    }

    // Special endpoints
    const action = searchParams.get('action')
    if (action === 'unpaid') {
      const result = await WellsInvoiceService.getUnpaidInvoices(userId)
      return NextResponse.json({ success: true, ...result })
    }

    if (action === 'summary') {
      const result = await WellsInvoiceService.getInvoiceSummary(userId)
      return NextResponse.json({ success: true, ...result })
    }

    const result = await WellsInvoiceService.listInvoices(userId, criteria)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch invoices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update invoice (mark paid, send reminder, cancel)
 * Body: { action: 'mark_paid' | 'send_reminder' | 'cancel', invoiceIdentifier: string, ... }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check for conversational input
    if (body.message && typeof body.message === 'string') {
      const parsed = parseInvoiceCommand(body.message)

      switch (parsed.action) {
        case 'mark_paid':
          if (!parsed.params.invoiceIdentifier) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine invoice to mark as paid',
                hint: 'Try: "Mark invoice #WELLS-2024-000001 as paid"',
              },
              { status: 400 }
            )
          }
          const paidResult = await WellsInvoiceService.markAsPaid(
            userId,
            parsed.params.invoiceIdentifier as string
          )
          return NextResponse.json({ success: true, ...paidResult, parsedIntent: parsed })

        case 'send_reminder':
          const identifier = parsed.params.invoiceIdentifier || parsed.params.vendorName
          if (!identifier) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine which invoice to remind',
                hint: 'Try: "Send a reminder to Acme about their invoice"',
              },
              { status: 400 }
            )
          }
          const reminderResult = await WellsInvoiceService.sendReminder(
            userId,
            identifier as string
          )
          return NextResponse.json({ success: true, ...reminderResult, parsedIntent: parsed })

        case 'cancel':
          if (!parsed.params.invoiceIdentifier) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine invoice to cancel',
                hint: 'Try: "Cancel invoice #WELLS-2024-000001"',
              },
              { status: 400 }
            )
          }
          const cancelResult = await WellsInvoiceService.cancelInvoice(
            userId,
            parsed.params.invoiceIdentifier as string
          )
          return NextResponse.json({ success: true, ...cancelResult, parsedIntent: parsed })

        default:
          return NextResponse.json(
            {
              success: false,
              error: 'Could not understand the action',
              parsedIntent: parsed,
            },
            { status: 400 }
          )
      }
    }

    // Direct API request
    const { action, invoiceIdentifier, paymentAmount, paymentDate, reason } = body

    if (!action || !invoiceIdentifier) {
      return NextResponse.json(
        { error: 'action and invoiceIdentifier are required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'mark_paid':
        const paidResult = await WellsInvoiceService.markAsPaid(
          userId,
          invoiceIdentifier,
          paymentAmount,
          paymentDate ? new Date(paymentDate) : undefined
        )
        return NextResponse.json({ success: true, ...paidResult })

      case 'send_reminder':
        const reminderResult = await WellsInvoiceService.sendReminder(userId, invoiceIdentifier)
        return NextResponse.json({ success: true, ...reminderResult })

      case 'cancel':
        const cancelResult = await WellsInvoiceService.cancelInvoice(userId, invoiceIdentifier, reason)
        return NextResponse.json({ success: true, ...cancelResult })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      {
        error: 'Failed to update invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
