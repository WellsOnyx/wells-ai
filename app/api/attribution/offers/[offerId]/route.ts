// Attribution Offer Detail API
// GET: Get offer details, PATCH: Update offer

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getOfferById,
  updateOffer,
  activateOffer,
  cancelOffer,
  getOfferStats,
} from '@/lib/attribution/offer-service'
import { getOfferIntroductions } from '@/lib/attribution/introduction-service'
import { getOfferClosures } from '@/lib/attribution/commission-engine'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { offerId } = await params
    const offer = await getOfferById(offerId)

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    // Get additional details
    const [introductions, closures, stats] = await Promise.all([
      getOfferIntroductions(offerId),
      getOfferClosures(offerId),
      getOfferStats(offerId),
    ])

    return NextResponse.json({
      offer,
      introductions,
      closures,
      stats,
    })
  } catch (error) {
    console.error('Error getting offer:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get offer' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { offerId } = await params
    const body = await request.json()

    // Handle status-specific actions
    if (body.action) {
      let offer
      let message

      switch (body.action) {
        case 'activate':
          offer = await activateOffer(offerId, userId)
          message = 'Offer activated'
          break
        case 'cancel':
          offer = await cancelOffer(offerId, userId)
          message = 'Offer cancelled'
          break
        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          )
      }

      return NextResponse.json({
        success: true,
        offer,
        message,
      })
    }

    // Regular update
    const offer = await updateOffer(offerId, userId, {
      title: body.title,
      description: body.description,
      value: body.value,
      commissions: body.commissions,
      category: body.category,
      tags: body.tags,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    })

    return NextResponse.json({
      success: true,
      offer,
      message: 'Offer updated',
    })
  } catch (error) {
    console.error('Error updating offer:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update offer' },
      { status: 400 }
    )
  }
}
