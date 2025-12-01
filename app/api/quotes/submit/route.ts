// app/api/quotes/submit/route.ts
// API endpoint for suppliers to submit quotes for RFQs

import { PrismaClient } from '@prisma/client'

// Lazy initialization
let prismaClient: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

interface QuoteSubmission {
  rfqId: string
  supplierId: string
  price: number
  deliveryTime: string
  terms?: string
  notes?: string
}

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const body: QuoteSubmission = await req.json()

    // Validate required fields
    if (!body.rfqId || !body.supplierId || !body.price || !body.deliveryTime) {
      return Response.json({
        error: 'Missing required fields: rfqId, supplierId, price, deliveryTime',
        status: 400
      }, { status: 400 })
    }

    if (body.price <= 0) {
      return Response.json({
        error: 'Price must be greater than zero',
        status: 400
      }, { status: 400 })
    }

    const prisma = getPrisma()

    // Verify RFQ exists and is still open
    const rfq = await prisma.rfqs.findUnique({
      where: { id: body.rfqId },
      select: { id: true, status: true, buyer_email: true }
    })

    if (!rfq) {
      return Response.json({
        error: 'RFQ not found',
        status: 404
      }, { status: 404 })
    }

    if (rfq.status !== 'open') {
      return Response.json({
        error: 'This RFQ is no longer accepting quotes',
        status: 400
      }, { status: 400 })
    }

    // Verify supplier exists
    const supplier = await prisma.suppliers.findUnique({
      where: { id: body.supplierId },
      select: { id: true, name: true, email: true }
    })

    if (!supplier) {
      return Response.json({
        error: 'Supplier not found',
        status: 404
      }, { status: 404 })
    }

    // Check if supplier already submitted a quote for this RFQ
    const existingQuote = await prisma.quotes.findFirst({
      where: {
        rfq_id: body.rfqId,
        supplier_id: body.supplierId
      }
    })

    if (existingQuote) {
      // Update existing quote instead of creating new one
      const updatedQuote = await prisma.quotes.update({
        where: { id: existingQuote.id },
        data: {
          price: body.price,
          delivery_time: body.deliveryTime,
          terms: body.terms || 'Net 30, FOB origin',
          notes: body.notes || null,
          status: 'pending',
          responded_at: new Date()
        }
      })

      return Response.json({
        success: true,
        quote: {
          id: updatedQuote.id,
          rfqId: body.rfqId,
          supplierId: body.supplierId,
          supplierName: supplier.name,
          price: updatedQuote.price,
          deliveryTime: updatedQuote.delivery_time,
          terms: updatedQuote.terms,
          notes: updatedQuote.notes,
          status: updatedQuote.status,
          submittedAt: updatedQuote.responded_at
        },
        message: 'Quote updated successfully',
        updated: true,
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - startTime
      })
    }

    // Create new quote
    const quote = await prisma.quotes.create({
      data: {
        rfq_id: body.rfqId,
        supplier_id: body.supplierId,
        price: body.price,
        delivery_time: body.deliveryTime,
        terms: body.terms || 'Net 30, FOB origin',
        notes: body.notes || null,
        status: 'pending',
        submitted_at: new Date(),
        responded_at: new Date()
      }
    })

    return Response.json({
      success: true,
      quote: {
        id: quote.id,
        rfqId: body.rfqId,
        supplierId: body.supplierId,
        supplierName: supplier.name,
        price: quote.price,
        deliveryTime: quote.delivery_time,
        terms: quote.terms,
        notes: quote.notes,
        status: quote.status,
        submittedAt: quote.submitted_at
      },
      message: 'Quote submitted successfully',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Quote submission error:', error)
    return Response.json({
      error: error.message || 'Failed to submit quote',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    }, { status: 500 })
  }
}

// GET endpoint to check if supplier already submitted a quote
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId = searchParams.get('rfqId')
    const supplierId = searchParams.get('supplierId')

    if (!rfqId || !supplierId) {
      return Response.json({
        error: 'rfqId and supplierId are required'
      }, { status: 400 })
    }

    const prisma = getPrisma()

    const quote = await prisma.quotes.findFirst({
      where: {
        rfq_id: rfqId,
        supplier_id: supplierId
      },
      include: {
        suppliers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!quote) {
      return Response.json({
        exists: false,
        quote: null
      })
    }

    return Response.json({
      exists: true,
      quote: {
        id: quote.id,
        price: quote.price,
        deliveryTime: quote.delivery_time,
        terms: quote.terms,
        notes: quote.notes,
        status: quote.status,
        submittedAt: quote.submitted_at,
        supplier: quote.suppliers
      }
    })

  } catch (error: any) {
    console.error('Get quote error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
