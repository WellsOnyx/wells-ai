/**
 * Airwallex Payment Status
 *
 * Get status of a payment intent
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPaymentIntent } from '@/lib/airwallex'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const paymentIntentId = searchParams.get('paymentIntentId')

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: paymentIntentId' },
        { status: 400 }
      )
    }

    // Get payment status from Airwallex
    const result = await getPaymentIntent(paymentIntentId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      amount: result.amount
    })
  } catch (error: any) {
    console.error('[AIRWALLEX] Payment status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get payment status' },
      { status: 500 }
    )
  }
}
