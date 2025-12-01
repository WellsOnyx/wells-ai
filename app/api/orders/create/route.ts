// app/api/orders/create/route.ts
// API endpoint to create an order from an accepted quote

import { PrismaClient } from '@prisma/client'

// Lazy initialization
let prismaClient: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

interface CreateOrderRequest {
  rfqId: string
  quoteId: string
  buyerId: string
  buyerEmail: string
}

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const body: CreateOrderRequest = await req.json()

    // Validate required fields
    if (!body.rfqId || !body.quoteId || !body.buyerId || !body.buyerEmail) {
      return Response.json({
        error: 'Missing required fields: rfqId, quoteId, buyerId, buyerEmail',
        status: 400
      }, { status: 400 })
    }

    const prisma = getPrisma()

    // Verify quote exists and get details
    const quote = await prisma.quotes.findUnique({
      where: { id: body.quoteId },
      include: {
        suppliers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        rfqs: {
          select: {
            id: true,
            buyer_id: true,
            buyer_email: true,
            requirements: true,
            categories: true,
            quantity: true
          }
        }
      }
    })

    if (!quote) {
      return Response.json({
        error: 'Quote not found',
        status: 404
      }, { status: 404 })
    }

    if (!quote.rfqs) {
      return Response.json({
        error: 'RFQ not found for this quote',
        status: 404
      }, { status: 404 })
    }

    // Create deal/order record
    const deal = await prisma.deals.create({
      data: {
        quote_id: quote.id,
        buyer_id: body.buyerId,
        buyer_email: body.buyerEmail,
        supplier_id: quote.supplier_id!,
        supplier_email: quote.suppliers?.email || '',
        amount: quote.price,
        status: 'pending',
        created_at: new Date()
      }
    })

    // Update quote status to 'accepted'
    await prisma.quotes.update({
      where: { id: quote.id },
      data: { status: 'accepted' }
    })

    // Update RFQ status to 'closed'
    await prisma.rfqs.update({
      where: { id: body.rfqId },
      data: { status: 'closed' }
    })

    return Response.json({
      success: true,
      order: {
        id: deal.id,
        quoteId: quote.id,
        supplierId: quote.supplier_id,
        supplierName: quote.suppliers?.name || 'Unknown',
        amount: parseFloat(deal.amount.toString()),
        status: deal.status,
        createdAt: deal.created_at
      },
      message: 'Order created successfully',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Create order error:', error)
    return Response.json({
      error: error.message || 'Failed to create order',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    }, { status: 500 })
  }
}

// GET endpoint to retrieve order by ID
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('id')

    if (!orderId) {
      return Response.json({
        error: 'Order ID is required'
      }, { status: 400 })
    }

    const prisma = getPrisma()

    const deal = await prisma.deals.findUnique({
      where: { id: orderId },
      include: {
        quotes: {
          include: {
            suppliers: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            rfqs: {
              select: {
                id: true,
                requirements: true,
                categories: true,
                quantity: true
              }
            }
          }
        }
      }
    })

    if (!deal) {
      return Response.json({
        error: 'Order not found'
      }, { status: 404 })
    }

    return Response.json({
      order: {
        id: deal.id,
        quoteId: deal.quote_id,
        buyerId: deal.buyer_id,
        buyerEmail: deal.buyer_email,
        supplierId: deal.supplier_id,
        supplierEmail: deal.supplier_email,
        supplierName: deal.quotes?.suppliers?.name || 'Unknown',
        amount: parseFloat(deal.amount.toString()),
        status: deal.status,
        createdAt: deal.created_at,
        quote: deal.quotes ? {
          price: parseFloat(deal.quotes.price.toString()),
          deliveryTime: deal.quotes.delivery_time,
          terms: deal.quotes.terms,
          notes: deal.quotes.notes
        } : null,
        rfq: deal.quotes?.rfqs ? {
          id: deal.quotes.rfqs.id,
          requirements: deal.quotes.rfqs.requirements,
          categories: deal.quotes.rfqs.categories,
          quantity: deal.quotes.rfqs.quantity
        } : null
      }
    })

  } catch (error: any) {
    console.error('Get order error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
