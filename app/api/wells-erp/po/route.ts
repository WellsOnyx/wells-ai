/**
 * WellsAI ERP - Purchase Order API
 *
 * Conversational PO management endpoints.
 * All operations designed for AI-driven interactions.
 *
 * POST /api/wells-erp/po - Create PO
 * GET /api/wells-erp/po - List/search POs
 * PATCH /api/wells-erp/po - Update PO (receive, send, cancel, track)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  WellsPOService,
  parsePOCommand,
  CreatePORequest,
  POSearchCriteria,
  POStatus,
} from '@/lib/wells-erp/po-service'

/**
 * POST - Create a new purchase order
 * Body: CreatePORequest | { message: string } for conversational input
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
      const parsed = parsePOCommand(body.message)

      if (parsed.action === 'create') {
        if (!parsed.params.supplierName) {
          return NextResponse.json(
            {
              success: false,
              error: 'Could not determine supplier name from message',
              hint: 'Try: "Create a PO for 1000 bearings from Precision Bearings at $4.50 each"',
            },
            { status: 400 }
          )
        }

        if (!parsed.params.quantity || !parsed.params.description) {
          return NextResponse.json(
            {
              success: false,
              error: 'Could not determine items to order',
              hint: 'Try: "Create a PO for 1000 bearings from Precision Bearings at $4.50 each"',
            },
            { status: 400 }
          )
        }

        const poRequest: CreatePORequest = {
          supplierName: parsed.params.supplierName as string,
          items: [
            {
              description: parsed.params.description as string,
              quantity: parsed.params.quantity as number,
              unitPrice: (parsed.params.unitPrice as number) || 0,
            },
          ],
          aiConversationId: body.conversationId,
          aiCommand: body.message,
        }

        const result = await WellsPOService.createPO(userId, poRequest)
        return NextResponse.json({
          success: true,
          ...result,
          parsedIntent: parsed,
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Message not recognized as PO creation',
          parsedIntent: parsed,
          hint: 'Try: "Create a PO for 1000 bearings from Precision Bearings at $4.50 each"',
        },
        { status: 400 }
      )
    }

    // Direct API request
    const poRequest: CreatePORequest = {
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      supplierEmail: body.supplierEmail,
      items: body.items,
      expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined,
      shippingAddress: body.shippingAddress,
      shippingMethod: body.shippingMethod,
      paymentTerms: body.paymentTerms,
      notes: body.notes,
      aiConversationId: body.conversationId,
      aiCommand: body.message,
    }

    if (!poRequest.supplierName) {
      return NextResponse.json(
        { error: 'supplierName is required' },
        { status: 400 }
      )
    }

    if (!poRequest.items || poRequest.items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required with at least one item' },
        { status: 400 }
      )
    }

    const result = await WellsPOService.createPO(userId, poRequest)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Error creating PO:', error)
    return NextResponse.json(
      {
        error: 'Failed to create purchase order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - List/search purchase orders
 * Query params: status, supplierId, supplierName, pendingDelivery, limit, offset
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
      const parsed = parsePOCommand(message)

      switch (parsed.action) {
        case 'list':
          if (parsed.params.pendingDelivery) {
            const result = await WellsPOService.getPendingDeliveryPOs(userId)
            return NextResponse.json({ success: true, ...result, parsedIntent: parsed })
          }
          const listResult = await WellsPOService.listPOs(userId)
          return NextResponse.json({ success: true, ...listResult, parsedIntent: parsed })

        case 'summary':
          const summaryResult = await WellsPOService.getPOSummary(userId)
          return NextResponse.json({ success: true, ...summaryResult, parsedIntent: parsed })

        default:
          return NextResponse.json(
            {
              success: false,
              error: 'Could not understand the query',
              parsedIntent: parsed,
              hint: 'Try: "What POs are pending delivery?" or "Show me recent purchase orders"',
            },
            { status: 400 }
          )
      }
    }

    // Direct API query
    const criteria: POSearchCriteria = {}

    const status = searchParams.get('status')
    if (status) {
      criteria.status = status as POStatus
    }

    const supplierId = searchParams.get('supplierId')
    if (supplierId) {
      criteria.supplierId = supplierId
    }

    const supplierName = searchParams.get('supplierName')
    if (supplierName) {
      criteria.supplierName = supplierName
    }

    const pendingDelivery = searchParams.get('pendingDelivery')
    if (pendingDelivery === 'true') {
      criteria.pendingDelivery = true
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
    if (action === 'pending') {
      const result = await WellsPOService.getPendingDeliveryPOs(userId)
      return NextResponse.json({ success: true, ...result })
    }

    if (action === 'summary') {
      const result = await WellsPOService.getPOSummary(userId)
      return NextResponse.json({ success: true, ...result })
    }

    const result = await WellsPOService.listPOs(userId, criteria)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error fetching POs:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch purchase orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update PO (receive, send, cancel, track)
 * Body: { action: 'receive' | 'send' | 'cancel' | 'track', poIdentifier: string, ... }
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
      const parsed = parsePOCommand(body.message)

      switch (parsed.action) {
        case 'receive':
          if (!parsed.params.poIdentifier) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine PO to mark as received',
                hint: 'Try: "Mark PO #456 as received"',
              },
              { status: 400 }
            )
          }
          const receiveResult = await WellsPOService.markAsReceived(
            userId,
            parsed.params.poIdentifier as string
          )
          return NextResponse.json({ success: true, ...receiveResult, parsedIntent: parsed })

        case 'send':
          if (!parsed.params.poIdentifier) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine PO to send',
                hint: 'Try: "Send PO #456 to supplier"',
              },
              { status: 400 }
            )
          }
          const sendResult = await WellsPOService.sendToSupplier(
            userId,
            parsed.params.poIdentifier as string
          )
          return NextResponse.json({ success: true, ...sendResult, parsedIntent: parsed })

        case 'cancel':
          if (!parsed.params.poIdentifier) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine PO to cancel',
                hint: 'Try: "Cancel the order from Acme"',
              },
              { status: 400 }
            )
          }
          const cancelResult = await WellsPOService.cancelPO(
            userId,
            parsed.params.poIdentifier as string
          )
          return NextResponse.json({ success: true, ...cancelResult, parsedIntent: parsed })

        case 'track':
          if (!parsed.params.poIdentifier || !parsed.params.trackingNumber) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine PO or tracking number',
                hint: 'Try: "PO #456 shipped, tracking number XYZ123"',
              },
              { status: 400 }
            )
          }
          const trackResult = await WellsPOService.updateTracking(
            userId,
            parsed.params.poIdentifier as string,
            parsed.params.trackingNumber as string
          )
          return NextResponse.json({ success: true, ...trackResult, parsedIntent: parsed })

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
    const { action, poIdentifier, receivedItems, receivedDate, trackingNumber, shippingMethod, reason } = body

    if (!action || !poIdentifier) {
      return NextResponse.json(
        { error: 'action and poIdentifier are required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'receive':
        const receiveResult = await WellsPOService.markAsReceived(
          userId,
          poIdentifier,
          receivedItems,
          receivedDate ? new Date(receivedDate) : undefined
        )
        return NextResponse.json({ success: true, ...receiveResult })

      case 'send':
        const sendResult = await WellsPOService.sendToSupplier(userId, poIdentifier)
        return NextResponse.json({ success: true, ...sendResult })

      case 'cancel':
        const cancelResult = await WellsPOService.cancelPO(userId, poIdentifier, reason)
        return NextResponse.json({ success: true, ...cancelResult })

      case 'track':
        if (!trackingNumber) {
          return NextResponse.json(
            { error: 'trackingNumber is required for track action' },
            { status: 400 }
          )
        }
        const trackResult = await WellsPOService.updateTracking(
          userId,
          poIdentifier,
          trackingNumber,
          shippingMethod
        )
        return NextResponse.json({ success: true, ...trackResult })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating PO:', error)
    return NextResponse.json(
      {
        error: 'Failed to update purchase order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
