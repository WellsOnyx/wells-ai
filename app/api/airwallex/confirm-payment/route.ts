/**
 * Airwallex Payment Confirmation
 *
 * Confirms payment and moves funds to escrow with automatic split
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { confirmPayment } from '@/lib/airwallex'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { paymentIntentId } = body

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing required field: paymentIntentId' },
        { status: 400 }
      )
    }

    // Confirm payment with Airwallex
    const result = await confirmPayment(paymentIntentId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Payment confirmed and funds escrowed with automatic split'
    })
  } catch (error: any) {
    console.error('[AIRWALLEX] Payment confirmation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
