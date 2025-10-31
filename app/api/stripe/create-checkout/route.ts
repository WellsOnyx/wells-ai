/**
 * Wells AI - Stripe Checkout API
 * POST /api/stripe/create-checkout
 *
 * Creates a Stripe Checkout Session for buyer payments
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { withValidation } from '@/lib/validation'
import { createCheckoutSession, calculateTotalWithFee } from '@/lib/stripe'
import { writeAuditPayload } from '@/lib/audit-ledger'

// ===== VALIDATION SCHEMA =====

const createCheckoutSchema = z.object({
  /**
   * Amount in cents (e.g., 10000 = $100.00)
   */
  amount: z.number().int().positive().min(50, 'Amount must be at least $0.50'),

  /**
   * Description of what the buyer is purchasing
   */
  description: z.string().min(1).max(500),

  /**
   * Buyer's email address
   */
  buyerEmail: z.string().email(),

  /**
   * Optional: Seller's Stripe Connect account ID
   * If provided, payment will go to seller and Wells AI collects application fee
   */
  sellerStripeAccountId: z.string().optional(),

  /**
   * Optional: Additional metadata
   */
  metadata: z.record(z.string()).optional(),

  /**
   * Optional: Custom success URL
   */
  successUrl: z.string().optional(),

  /**
   * Optional: Custom cancel URL
   */
  cancelUrl: z.string().optional()
})

type CreateCheckoutRequest = z.infer<typeof createCheckoutSchema>

// ===== API HANDLER =====

export const POST = withValidation(
  createCheckoutSchema,
  async (request) => {
    try {
      // Get authenticated user
      const { userId } = await auth()

      if (!userId) {
        return NextResponse.json(
          {
            errorCode: 'UNAUTHORIZED',
            message: 'You must be signed in to create a checkout session'
          },
          { status: 401 }
        )
      }

      const body = request.validatedBody as CreateCheckoutRequest

      // Calculate fees
      const { subtotal, wellsAIFee, total } = calculateTotalWithFee(body.amount)

      // Log to audit ledger
      const actionId = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await writeAuditPayload({
        actionId,
        actionType: 'payment',
        payload: {
          amount: body.amount,
          description: body.description,
          buyerEmail: body.buyerEmail,
          buyerUserId: userId,
          sellerStripeAccountId: body.sellerStripeAccountId,
          subtotal,
          wellsAIFee,
          total,
          metadata: body.metadata
        }
      })

      // Create Stripe Checkout Session
      const session = await createCheckoutSession({
        amountInCents: body.amount,
        description: body.description,
        buyerEmail: body.buyerEmail,
        buyerUserId: userId,
        sellerStripeAccountId: body.sellerStripeAccountId,
        metadata: {
          actionId,
          ...body.metadata
        },
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl
      })

      // Return checkout URL
      return NextResponse.json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        pricing: {
          subtotal,
          wellsAIFee,
          total,
          subtotalFormatted: `$${(subtotal / 100).toFixed(2)}`,
          wellsAIFeeFormatted: `$${(wellsAIFee / 100).toFixed(2)}`,
          totalFormatted: `$${(total / 100).toFixed(2)}`
        }
      })

    } catch (error: any) {
      console.error('Error creating checkout session:', error)

      return NextResponse.json(
        {
          errorCode: 'CHECKOUT_ERROR',
          message: error.message || 'Failed to create checkout session'
        },
        { status: 500 }
      )
    }
  }
)
