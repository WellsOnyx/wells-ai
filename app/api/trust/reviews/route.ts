/**
 * Trust Reviews API
 *
 * GET /api/trust/reviews - Get reviews for a user
 * POST /api/trust/reviews - Create a new review
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createReview, getUserReviews } from '@/lib/reputation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const asReviewee = searchParams.get('asReviewee') !== 'false'
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const reviews = await getUserReviews(userId, asReviewee, limit)

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Reviews error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get reviews' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      revieweeId,
      transactionType,
      transactionId,
      overallRating,
      reliabilityRating,
      communicationRating,
      qualityRating,
      title,
      content,
    } = body

    if (!revieweeId || !overallRating) {
      return NextResponse.json(
        { error: 'revieweeId and overallRating are required' },
        { status: 400 }
      )
    }

    if (revieweeId === userId) {
      return NextResponse.json(
        { error: 'Cannot review yourself' },
        { status: 400 }
      )
    }

    if (overallRating < 1 || overallRating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    const review = await createReview({
      reviewerId: userId,
      revieweeId,
      transactionType,
      transactionId,
      overallRating,
      reliabilityRating,
      communicationRating,
      qualityRating,
      title,
      content,
      isVisible: true,
      isVerified: !!transactionId,
      flagged: false,
    })

    return NextResponse.json({ review })
  } catch (error) {
    console.error('Review error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create review' },
      { status: 500 }
    )
  }
}
