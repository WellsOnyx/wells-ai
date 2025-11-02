/**
 * Airwallex Refund
 *
 * Create refund for a payment (full or partial)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createRefund } from '@/lib/airwallex'

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
    const { paymentIntentId, amount, reason } = body

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing required field: paymentIntentId' },
        { status: 400 }
      )
    }

    // Create refund with Airwallex
    const result = await createRefund({
      paymentIntentId,
      amount, // Optional - full refund if not provided
      reason
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      refundId: result.refundId,
      message: amount ? 'Partial refund created' : 'Full refund created'
    })
  } catch (error: any) {
    console.error('[AIRWALLEX] Refund creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create refund' },
      { status: 500 }
    )
  }
}
