// app/api/quotes/request/route.ts
// REAL quote request system - creates RFQ and sends emails to suppliers

import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'

// Lazy initialization
let prismaClient: PrismaClient | null = null
let resendClient: Resend | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

interface QuoteRequestBody {
  // Buyer info
  buyerId: string
  buyerEmail: string
  buyerName?: string
  buyerCompany?: string

  // Product requirements
  product: string
  quantity: number
  unit?: string
  budget?: number
  deadline?: string
  deliveryLocation?: string

  // Categories to match suppliers
  categories: string[]

  // Additional notes
  notes?: string
}

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const body: QuoteRequestBody = await req.json()

    // Validate required fields
    if (!body.buyerId || !body.buyerEmail || !body.product || !body.quantity) {
      return Response.json({
        error: 'Missing required fields: buyerId, buyerEmail, product, quantity',
        status: 400
      }, { status: 400 })
    }

    if (!body.categories || body.categories.length === 0) {
      return Response.json({
        error: 'At least one category is required to match suppliers',
        status: 400
      }, { status: 400 })
    }

    const prisma = getPrisma()

    // 1. Find matching suppliers by category
    const suppliers = await prisma.suppliers.findMany({
      where: {
        categories: {
          hasSome: body.categories
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        categories: true,
        rating: true
      },
      orderBy: {
        rating: 'desc'
      },
      take: 10 // Max 10 suppliers per RFQ
    })

    if (suppliers.length === 0) {
      return Response.json({
        error: 'No suppliers found matching categories: ' + body.categories.join(', '),
        categories: body.categories,
        status: 404
      }, { status: 404 })
    }

    // 2. Create RFQ in database
    const requirements = `
Product: ${body.product}
Quantity: ${body.quantity} ${body.unit || 'units'}
${body.deliveryLocation ? `Delivery Location: ${body.deliveryLocation}` : ''}
${body.notes ? `Additional Notes: ${body.notes}` : ''}
    `.trim()

    const rfq = await prisma.rfqs.create({
      data: {
        buyer_id: body.buyerId,
        buyer_email: body.buyerEmail,
        requirements,
        categories: body.categories,
        quantity: body.quantity,
        budget: body.budget ? body.budget : null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        status: 'open'
      }
    })

    // 3. Send REAL emails to each supplier
    const resend = getResend()
    const emailResults: { supplierId: string; supplierName: string; sent: boolean; error?: string }[] = []

    for (const supplier of suppliers) {
      try {
        await resend.emails.send({
          from: 'Wells AI <quotes@wellsai.com>',
          to: supplier.email,
          subject: `New Quote Request: ${body.product}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">New Quote Request</h1>
              </div>

              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px;">Hello <strong>${supplier.name}</strong>,</p>

                <p>You have received a new quote request through Wells AI:</p>

                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                  <h3 style="margin-top: 0; color: #1f2937;">Request Details</h3>
                  <p><strong>Product:</strong> ${body.product}</p>
                  <p><strong>Quantity:</strong> ${body.quantity} ${body.unit || 'units'}</p>
                  ${body.budget ? `<p><strong>Budget:</strong> $${body.budget.toLocaleString()}</p>` : ''}
                  ${body.deadline ? `<p><strong>Deadline:</strong> ${new Date(body.deadline).toLocaleDateString()}</p>` : ''}
                  ${body.deliveryLocation ? `<p><strong>Delivery Location:</strong> ${body.deliveryLocation}</p>` : ''}
                  ${body.notes ? `<p><strong>Notes:</strong> ${body.notes}</p>` : ''}
                </div>

                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #1f2937;">Buyer Information</h3>
                  <p><strong>Contact:</strong> ${body.buyerName || 'Not provided'}</p>
                  <p><strong>Company:</strong> ${body.buyerCompany || 'Not provided'}</p>
                  <p><strong>Email:</strong> ${body.buyerEmail}</p>
                </div>

                <p style="margin-top: 20px;">
                  <strong>RFQ ID:</strong> ${rfq.id}
                </p>

                <div style="text-align: center; margin-top: 30px;">
                  <a href="https://wellsai.vercel.app/quotes/${rfq.id}?supplier=${supplier.id}"
                     style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Submit Your Quote
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  Please respond within 48 hours to be considered for this opportunity.
                </p>
              </div>

              <div style="background: #1f2937; padding: 20px; text-align: center;">
                <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                  Powered by Wells AI | B2B Commerce Platform
                </p>
              </div>
            </div>
          `
        })

        emailResults.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          sent: true
        })
      } catch (emailError: any) {
        console.error(`Failed to send email to ${supplier.email}:`, emailError)
        emailResults.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          sent: false,
          error: emailError.message
        })
      }
    }

    // Count successful emails
    const successfulEmails = emailResults.filter(r => r.sent).length

    return Response.json({
      success: true,
      rfqId: rfq.id,
      suppliersMatched: suppliers.length,
      emailsSent: successfulEmails,
      emailResults,
      message: `Quote request created. ${successfulEmails} suppliers notified via email.`,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Quote request error:', error)
    return Response.json({
      error: error.message || 'Failed to process quote request',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    }, { status: 500 })
  }
}

// GET endpoint to check RFQ status
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId = searchParams.get('id')

    if (!rfqId) {
      return Response.json({ error: 'RFQ ID required' }, { status: 400 })
    }

    const prisma = getPrisma()

    const rfq = await prisma.rfqs.findUnique({
      where: { id: rfqId },
      include: {
        quotes: {
          include: {
            suppliers: {
              select: {
                id: true,
                name: true,
                email: true,
                rating: true
              }
            }
          }
        }
      }
    })

    if (!rfq) {
      return Response.json({ error: 'RFQ not found' }, { status: 404 })
    }

    return Response.json({
      rfq: {
        id: rfq.id,
        buyer_email: rfq.buyer_email,
        requirements: rfq.requirements,
        categories: rfq.categories,
        quantity: rfq.quantity,
        budget: rfq.budget,
        deadline: rfq.deadline,
        status: rfq.status,
        created_at: rfq.created_at
      },
      quotes: rfq.quotes.map(q => ({
        id: q.id,
        supplier: q.suppliers,
        price: q.price,
        delivery_time: q.delivery_time,
        terms: q.terms,
        notes: q.notes,
        status: q.status,
        submitted_at: q.submitted_at
      })),
      quotesReceived: rfq.quotes.length
    })

  } catch (error: any) {
    console.error('Get RFQ error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
