/**
 * Circle Payment Release API
 *
 * Releases payment from escrow to seller wallet when buyer confirms delivery
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { releasePayment } from '@/lib/circle-payments'
import { prisma } from '@/lib/prisma'
import { incrementCompletedDeals } from '@/lib/db/seller-helpers'

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
      paymentIntentId,
      sellerWalletId,
      sellerId,
      amount, // in cents
      currency = 'USD'
    } = body

    // Validate required fields
    if (!paymentIntentId || !sellerWalletId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentIntentId, sellerWalletId, amount' },
        { status: 400 }
      )
    }

    // Release payment from escrow to seller
    await releasePayment({
      paymentIntentId,
      sellerWalletId,
      amount,
      currency
    })

    // Increment seller's completed deals counter
    if (sellerId) {
      await incrementCompletedDeals(sellerId)
    }

    return NextResponse.json({
      success: true,
      message: 'Payment released to seller',
      paymentIntentId,
      amount,
      currency
    })

  } catch (error: any) {
    console.error('[PAYMENT_RELEASE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to release payment' },
      { status: 500 }
    )
  }
}
