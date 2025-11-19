// app/api/suppliers/register/route.ts
// Register new suppliers to the marketplace

import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'

let prismaClient: PrismaClient | null = null
let resendClient: Resend | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

function getResend(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

interface SupplierRegistration {
  name: string
  email: string
  phone?: string
  categories: string[]
  capabilities?: string[]
  certifications?: string[]
}

export async function POST(req: Request) {
  try {
    const body: SupplierRegistration = await req.json()

    // Validate required fields
    if (!body.name || !body.email || !body.categories || body.categories.length === 0) {
      return Response.json({
        error: 'Missing required fields: name, email, and at least one category'
      }, { status: 400 })
    }

    const prisma = getPrisma()

    // Check if supplier already exists
    const existing = await prisma.suppliers.findUnique({
      where: { email: body.email }
    })

    if (existing) {
      return Response.json({
        error: 'A supplier with this email already exists'
      }, { status: 409 })
    }

    // Create supplier
    const supplier = await prisma.suppliers.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        categories: body.categories,
        capabilities: body.capabilities || [],
        certifications: body.certifications || [],
        rating: 5.0, // Start with perfect rating
        completed_deals: 0
      }
    })

    // Send welcome email
    const resend = getResend()
    if (resend) {
      try {
        await resend.emails.send({
          from: 'Wells AI <welcome@wellsai.com>',
          to: body.email,
          subject: `Welcome to Wells AI, ${body.name}!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">Welcome to Wells AI!</h1>
              </div>

              <div style="padding: 30px; background: #f9fafb;">
                <p style="font-size: 16px;">Hello <strong>${body.name}</strong>,</p>

                <p>You're now part of the Wells AI supplier network. Here's what happens next:</p>

                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                  <h3 style="margin-top: 0; color: #1f2937;">Your Profile</h3>
                  <p><strong>Categories:</strong> ${body.categories.join(', ')}</p>
                  ${body.capabilities?.length ? `<p><strong>Capabilities:</strong> ${body.capabilities.join(', ')}</p>` : ''}
                  ${body.certifications?.length ? `<p><strong>Certifications:</strong> ${body.certifications.join(', ')}</p>` : ''}
                </div>

                <h3 style="color: #1f2937;">What Happens Next?</h3>
                <ol style="color: #4b5563; line-height: 1.8;">
                  <li>Buyers will search for suppliers in your categories</li>
                  <li>You'll receive quote request emails at <strong>${body.email}</strong></li>
                  <li>Submit competitive quotes to win business</li>
                  <li>Build your reputation with successful deliveries</li>
                </ol>

                <p style="margin-top: 20px;">
                  <strong>Supplier ID:</strong> ${supplier.id}
                </p>

                <div style="text-align: center; margin-top: 30px;">
                  <a href="https://wellsai.vercel.app"
                     style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Visit Wells AI
                  </a>
                </div>
              </div>

              <div style="background: #1f2937; padding: 20px; text-align: center;">
                <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                  Powered by Wells AI | B2B Commerce Platform
                </p>
              </div>
            </div>
          `
        })
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError)
        // Don't fail registration if email fails
      }
    }

    return Response.json({
      success: true,
      supplierId: supplier.id,
      message: `Welcome to Wells AI, ${body.name}! You'll receive quote requests at ${body.email}.`
    })

  } catch (error: any) {
    console.error('Supplier registration error:', error)
    return Response.json({
      error: error.message || 'Failed to register supplier'
    }, { status: 500 })
  }
}
