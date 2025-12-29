/**
 * WellsAI ERP - Vendor API
 *
 * Conversational vendor/supplier management endpoints.
 * All operations designed for AI-driven interactions.
 *
 * POST /api/wells-erp/vendor - Add vendor
 * GET /api/wells-erp/vendor - List/search vendors
 * PATCH /api/wells-erp/vendor - Update vendor (rate, modify, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  WellsVendorRegistry,
  parseVendorCommand,
  CreateVendorRequest,
  VendorSearchCriteria,
  VendorStatus,
  VendorType,
} from '@/lib/wells-erp/vendor-registry'

/**
 * POST - Add a new vendor
 * Body: CreateVendorRequest | { message: string } for conversational input
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
      const parsed = parseVendorCommand(body.message)

      if (parsed.action === 'add') {
        if (!parsed.params.name) {
          return NextResponse.json(
            {
              success: false,
              error: 'Could not determine vendor name from message',
              hint: 'Try: "Add Precision Bearings as a supplier"',
            },
            { status: 400 }
          )
        }

        const vendorRequest: CreateVendorRequest = {
          name: parsed.params.name as string,
          vendorType: parsed.params.vendorType as VendorType,
          email: parsed.params.email as string,
          aiConversationId: body.conversationId,
          aiCommand: body.message,
        }

        const result = await WellsVendorRegistry.addVendor(userId, vendorRequest)
        return NextResponse.json({
          success: true,
          ...result,
          parsedIntent: parsed,
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Message not recognized as vendor addition',
          parsedIntent: parsed,
          hint: 'Try: "Add Precision Bearings as a supplier"',
        },
        { status: 400 }
      )
    }

    // Direct API request
    const vendorRequest: CreateVendorRequest = {
      name: body.name,
      vendorType: body.vendorType,
      email: body.email,
      phone: body.phone,
      website: body.website,
      categories: body.categories,
      paymentTerms: body.paymentTerms,
      notes: body.notes,
      aiConversationId: body.conversationId,
      aiCommand: body.message,
    }

    if (!vendorRequest.name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const result = await WellsVendorRegistry.addVendor(userId, vendorRequest)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Error adding vendor:', error)
    return NextResponse.json(
      {
        error: 'Failed to add vendor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - List/search vendors
 * Query params: query, vendorType, status, category, limit, offset
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
      const parsed = parseVendorCommand(message)

      switch (parsed.action) {
        case 'history':
          if (!parsed.params.vendorName) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine vendor name',
                hint: 'Try: "What\'s my payment history with Acme?"',
              },
              { status: 400 }
            )
          }
          const historyResult = await WellsVendorRegistry.getPaymentHistory(
            userId,
            parsed.params.vendorName as string
          )
          return NextResponse.json({ success: true, ...historyResult, parsedIntent: parsed })

        case 'top':
          const topResult = await WellsVendorRegistry.getTopSuppliers(
            userId,
            (parsed.params.limit as number) || 10
          )
          return NextResponse.json({ success: true, ...topResult, parsedIntent: parsed })

        case 'search':
          const searchResult = await WellsVendorRegistry.searchVendors(userId, {
            query: parsed.params.query as string,
          })
          return NextResponse.json({ success: true, ...searchResult, parsedIntent: parsed })

        case 'summary':
          const summaryResult = await WellsVendorRegistry.getVendorSummary(userId)
          return NextResponse.json({ success: true, ...summaryResult, parsedIntent: parsed })

        default:
          // Default to search/list
          const defaultResult = await WellsVendorRegistry.searchVendors(userId, {})
          return NextResponse.json({ success: true, ...defaultResult, parsedIntent: parsed })
      }
    }

    // Direct API query
    const criteria: VendorSearchCriteria = {}

    const query = searchParams.get('query')
    if (query) {
      criteria.query = query
    }

    const vendorType = searchParams.get('vendorType')
    if (vendorType) {
      criteria.vendorType = vendorType as VendorType
    }

    const status = searchParams.get('status')
    if (status) {
      criteria.status = status as VendorStatus
    }

    const category = searchParams.get('category')
    if (category) {
      criteria.category = category
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

    if (action === 'top') {
      const topLimit = parseInt(searchParams.get('topLimit') || '10')
      const result = await WellsVendorRegistry.getTopSuppliers(userId, topLimit)
      return NextResponse.json({ success: true, ...result })
    }

    if (action === 'summary') {
      const result = await WellsVendorRegistry.getVendorSummary(userId)
      return NextResponse.json({ success: true, ...result })
    }

    if (action === 'history') {
      const vendorId = searchParams.get('vendorId')
      if (!vendorId) {
        return NextResponse.json(
          { error: 'vendorId is required for history action' },
          { status: 400 }
        )
      }
      const result = await WellsVendorRegistry.getPaymentHistory(userId, vendorId)
      return NextResponse.json({ success: true, ...result })
    }

    const result = await WellsVendorRegistry.searchVendors(userId, criteria)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch vendors',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update vendor (rate, modify info)
 * Body: { action: 'rate' | 'update', vendorIdentifier: string, ... }
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
      const parsed = parseVendorCommand(body.message)

      switch (parsed.action) {
        case 'rate':
          if (!parsed.params.vendorName || !parsed.params.rating) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine vendor or rating',
                hint: 'Try: "Rate Precision Bearings 5 stars for delivery"',
              },
              { status: 400 }
            )
          }
          const rateResult = await WellsVendorRegistry.rateVendor(
            userId,
            parsed.params.vendorName as string,
            parsed.params.rating as number,
            (parsed.params.category as 'delivery' | 'quality' | 'pricing' | 'communication' | 'overall') || 'overall'
          )
          return NextResponse.json({ success: true, ...rateResult, parsedIntent: parsed })

        case 'update':
          if (!parsed.params.vendorName) {
            return NextResponse.json(
              {
                success: false,
                error: 'Could not determine vendor to update',
                hint: 'Try: "Update Acme\'s email to new@acme.com"',
              },
              { status: 400 }
            )
          }
          const updateResult = await WellsVendorRegistry.updateVendor(
            userId,
            parsed.params.vendorName as string,
            {
              email: parsed.params.email as string,
              phone: parsed.params.phone as string,
            }
          )
          return NextResponse.json({ success: true, ...updateResult, parsedIntent: parsed })

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
    const { action, vendorIdentifier, rating, category, comment, relatedPoId, updates } = body

    if (!action || !vendorIdentifier) {
      return NextResponse.json(
        { error: 'action and vendorIdentifier are required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'rate':
        if (!rating || rating < 1 || rating > 5) {
          return NextResponse.json(
            { error: 'rating is required and must be between 1 and 5' },
            { status: 400 }
          )
        }
        const rateResult = await WellsVendorRegistry.rateVendor(
          userId,
          vendorIdentifier,
          rating,
          category || 'overall',
          comment,
          relatedPoId
        )
        return NextResponse.json({ success: true, ...rateResult })

      case 'update':
        if (!updates || Object.keys(updates).length === 0) {
          return NextResponse.json(
            { error: 'updates object is required with at least one field' },
            { status: 400 }
          )
        }
        const updateResult = await WellsVendorRegistry.updateVendor(userId, vendorIdentifier, updates)
        return NextResponse.json({ success: true, ...updateResult })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating vendor:', error)
    return NextResponse.json(
      {
        error: 'Failed to update vendor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
