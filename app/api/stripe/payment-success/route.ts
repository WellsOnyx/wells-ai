/**
 * Wells AI - Stripe Payment Success Handler
 * GET /api/stripe/payment-success?session_id=xxx
 *
 * Handles post-payment redirect from Stripe Checkout
 * - Verifies payment with Stripe
 * - Logs to audit ledger
 * - Saves transaction to Notion
 * - Sends confirmation email
 * - Redirects to success page
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCheckoutSession } from '@/lib/stripe'
import { writeAuditAction } from '@/lib/audit-ledger'
import { createDeal } from '@/lib/notion'
import { queueEmail, createEmailHTML } from '@/lib/email'

// ===== API HANDLER =====

export async function GET(request: NextRequest) {
  try {
    // Get session_id from query params
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.redirect(
        new URL('/quotes?error=missing_session', request.url)
      )
    }

    // Get authenticated user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.redirect(
        new URL('/sign-in?redirect_url=/api/stripe/payment-success?session_id=' + sessionId, request.url)
      )
    }

    // Retrieve Stripe session to verify payment
    const session = await getCheckoutSession(sessionId)

    // Check payment status
    if (session.payment_status !== 'paid') {
      console.warn(`Payment not completed for session ${sessionId}: ${session.payment_status}`)
      return NextResponse.redirect(
        new URL('/quotes?error=payment_incomplete', request.url)
      )
    }

    // Extract metadata
    const metadata = session.metadata || {}
    const buyerUserId = metadata.buyerUserId || userId
    const buyerEmail = metadata.buyerEmail || (typeof session.customer_details?.email === 'string' ? session.customer_details.email : '')
    const subtotal = parseInt(metadata.subtotal || '0')
    const wellsAIFee = parseInt(metadata.wellsAIFee || '0')
    const total = parseInt(metadata.total || '0')
    const actionId = metadata.actionId || `payment_${sessionId}`

    // Get payment intent
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || ''

    // Log to audit ledger
    await writeAuditAction({
      actionId,
      actionType: 'payment',
      title: 'Payment Completed',
      description: `Buyer paid $${(total / 100).toFixed(2)} via Stripe Checkout`,
      recipient: buyerEmail,
      decision: 'approve',
      decidedBy: 'stripe',
      reason: 'Payment successfully processed',
      metadata: {
        sessionId,
        paymentIntentId,
        subtotal,
        wellsAIFee,
        total,
        buyerUserId,
        buyerEmail
      }
    })

    // Save transaction to Notion (if configured)
    try {
      const deal = await createDeal({
        rfqId: metadata.rfqId || '',
        quoteId: metadata.quoteId || '',
        buyerCompany: metadata.buyerCompany || buyerEmail,
        sellerCompany: metadata.sellerCompany || 'Direct',
        productName: metadata.productName || 'Purchase',
        category: metadata.category || 'General',
        dealValue: subtotal,
        status: 'Completed',
        closeDate: new Date().toISOString(),
        paymentIntentId
      })

      if (deal) {
        console.log(`✅ Deal saved to Notion: ${deal.id}`)
      }
    } catch (error) {
      console.error('Failed to save deal to Notion:', error)
      // Don't fail the request if Notion save fails
    }

    // Send confirmation email (queued for consent)
    try {
      const emailHTML = createEmailHTML({
        title: 'Payment Confirmed',
        content: `
          <p>Thank you for your payment!</p>
          <p><strong>Transaction Details:</strong></p>
          <ul>
            <li>Amount: $${(subtotal / 100).toFixed(2)}</li>
            <li>Wells AI Fee: $${(wellsAIFee / 100).toFixed(2)}</li>
            <li>Total: $${(total / 100).toFixed(2)}</li>
            <li>Payment ID: ${paymentIntentId}</li>
          </ul>
          <p>Your payment has been processed successfully. You'll receive your order confirmation shortly.</p>
        `,
        footer: 'Wells AI - Simplifying B2B transactions'
      })

      await queueEmail({
        to: buyerEmail,
        subject: 'Payment Confirmed - Wells AI',
        html: emailHTML,
        text: `Thank you for your payment! Your payment of $${(total / 100).toFixed(2)} has been processed successfully.`,
        metadata: {
          type: 'payment_confirmation',
          sessionId,
          paymentIntentId
        }
      })

      console.log(`✅ Confirmation email queued for ${buyerEmail}`)
    } catch (error) {
      console.error('Failed to queue confirmation email:', error)
      // Don't fail the request if email fails
    }

    // Redirect to success page with details
    const successUrl = new URL('/payment/success', request.url)
    successUrl.searchParams.set('amount', (total / 100).toFixed(2))
    successUrl.searchParams.set('payment_id', paymentIntentId)

    return NextResponse.redirect(successUrl)

  } catch (error: any) {
    console.error('Error processing payment success:', error)

    // Redirect to error page
    return NextResponse.redirect(
      new URL('/quotes?error=payment_processing_error', request.url)
    )
  }
}
