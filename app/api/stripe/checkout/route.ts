import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'
import { createCheckoutSession, calculateTotalWithFee } from '@/lib/stripe'

/**
 * POST /api/stripe/checkout
 *
 * Create a Stripe Checkout Session for buyer payments
 * Automatically calculates and includes Wells AI's 33 basis point fee
 *
 * Request body:
 * - amountInCents: number (item price in cents, e.g., 10000 for $100)
 * - description: string (product/service description)
 * - sellerId?: string (optional - seller's Clerk user ID)
 * - metadata?: object (optional - additional data)
 *
 * Response:
 * - sessionId: Stripe Checkout Session ID
 * - sessionUrl: URL to redirect buyer to
 * - subtotal: Original amount
 * - wellsAIFee: 33 basis points fee
 * - total: Amount buyer will pay
 */

const requestSchema = z.object({
  amountInCents: z.number().positive().int(),
  description: z.string().min(1),
  sellerId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication (buyer must be logged in)
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get buyer information from Clerk
    const client = await clerkClient()
    const buyer = await client.users.getUser(userId)

    if (!buyer.emailAddresses || buyer.emailAddresses.length === 0) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      )
    }

    const buyerEmail = buyer.emailAddresses[0].emailAddress

    // Parse and validate request body
    const body = await request.json()
    const {
      amountInCents,
      description,
      sellerId,
      metadata = {},
      successUrl,
      cancelUrl,
    } = requestSchema.parse(body)

    // If seller ID provided, get their Connect account
    let sellerStripeAccountId: string | undefined

    if (sellerId) {
      const seller = await client.users.getUser(sellerId)
      sellerStripeAccountId = seller.publicMetadata?.stripeConnectAccountId as string | undefined

      // Verify seller has completed onboarding
      const sellerOnboarded = seller.publicMetadata?.stripeConnectComplete as boolean

      if (!sellerStripeAccountId || !sellerOnboarded) {
        return NextResponse.json(
          { error: 'Seller has not completed Stripe Connect onboarding' },
          { status: 400 }
        )
      }
    }

    // Calculate fees (Wells AI takes 33 basis points)
    const { subtotal, wellsAIFee, total } = calculateTotalWithFee(amountInCents)

    console.log('Creating checkout session:')
    console.log('  Subtotal:', `$${(subtotal / 100).toFixed(2)}`)
    console.log('  Wells AI Fee (33 bps):', `$${(wellsAIFee / 100).toFixed(2)}`)
    console.log('  Total:', `$${(total / 100).toFixed(2)}`)
    console.log('  Seller Account:', sellerStripeAccountId || 'None (direct payment)')

    // Create Stripe Checkout Session
    const session = await createCheckoutSession({
      amountInCents,
      description,
      buyerEmail,
      buyerUserId: userId,
      sellerStripeAccountId,
      metadata: {
        ...metadata,
        buyerId: userId,
        sellerId: sellerId || '',
      },
      successUrl,
      cancelUrl,
    })

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
      subtotal,
      wellsAIFee,
      total,
      breakdown: {
        itemPrice: `$${(subtotal / 100).toFixed(2)}`,
        wellsAIFee: `$${(wellsAIFee / 100).toFixed(2)} (0.33%)`,
        total: `$${(total / 100).toFixed(2)}`,
      },
    })

  } catch (error: any) {
    console.error('Error creating checkout session:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to create checkout session',
        details: error.raw?.message || error.message,
      },
      { status: 500 }
    )
  }
}
