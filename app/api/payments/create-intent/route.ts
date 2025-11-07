/**
 * Circle Payment Intent API
 *
 * Creates payment intents for B2B transactions with automatic fee deduction
 * based on deal origination type (0.33% / 3.3% / 7%)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createPaymentIntent, calculatePaymentWithFees } from '@/lib/circle-payments'
import { DealOriginationType, getFeeStructure } from '@/lib/fee-structure'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const {
      sellerId,
      dealId,
      amount, // in cents
      currency = 'USD',
      originationType = DealOriginationType.WELLS_ORIGINATED,
      description
    } = body

    // Validate required fields
    if (!sellerId || !dealId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: sellerId, dealId, amount' },
        { status: 400 }
      )
    }

    // Get fee structure for this deal origination type
    const feeStructure = getFeeStructure(originationType as DealOriginationType)

    // Calculate payment with fees
    const paymentCalc = calculatePaymentWithFees(amount, feeStructure.feePercentage)

    // Create payment intent with Circle
    const paymentIntent = await createPaymentIntent({
      buyerId: userId, // Circle wallet ID (would be fetched from user profile in production)
      sellerId,
      dealId,
      amount,
      currency,
      feePercentage: feeStructure.feePercentage,
      description
    })

    return NextResponse.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        fee: paymentIntent.fee,
        netAmount: paymentIntent.netAmount,
        originationType,
        feeStructure: {
          displayText: paymentCalc.displayText,
          feePercentage: feeStructure.feePercentage,
          sellerReceives: paymentCalc.sellerReceives
        }
      }
    })

  } catch (error: any) {
    console.error('[PAYMENT_INTENT] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
