/**
 * POST /api/transactions/complete
 *
 * Complete transaction and collect ratings
 * Updates trust scores for both parties
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { completeTransaction } from '@/lib/transactions'
import { prisma } from '@/lib/prisma'

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
    const {
      transactionId,
      rating, // Your rating of the other party (1-5)
      review   // Optional review text
    } = body

    if (!transactionId || !rating) {
      return NextResponse.json(
        { error: 'Transaction ID and rating required' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Determine if user is buyer or seller
    const isBuyer = transaction.buyerId === userId
    const isSeller = transaction.sellerId === userId

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: 'Unauthorized - not part of this transaction' },
        { status: 403 }
      )
    }

    // Check if already rated
    if (isBuyer && transaction.buyerRating) {
      return NextResponse.json(
        { error: 'You have already rated this transaction' },
        { status: 400 }
      )
    }

    if (isSeller && transaction.sellerRating) {
      return NextResponse.json(
        { error: 'You have already rated this transaction' },
        { status: 400 }
      )
    }

    // Complete transaction
    const result = await completeTransaction({
      transactionId,
      buyerRating: isBuyer ? rating : (transaction.buyerRating || 0),
      sellerRating: isSeller ? rating : (transaction.sellerRating || 0),
      buyerReview: isBuyer ? review : transaction.buyerReview,
      sellerReview: isSeller ? review : transaction.sellerReview
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: result.id,
        status: result.status,
        buyerRating: result.buyerRating,
        sellerRating: result.sellerRating,
        completedAt: result.completedAt
      },
      message: 'Thank you for your rating! Trust scores have been updated.'
    })
  } catch (error: any) {
    console.error('[TRANSACTION] Complete error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to complete transaction' },
      { status: 500 }
    )
  }
}
