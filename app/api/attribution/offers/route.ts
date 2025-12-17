// Attribution Offers API
// GET: List user's offers, POST: Create new offer

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import {
  getUserOffers,
  createOffer,
  getOffersIntroducedToUser,
} from '@/lib/attribution/offer-service'
import { OfferStatus, CreateOfferInput } from '@/lib/attribution/types'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as OfferStatus | null
    const type = searchParams.get('type') // 'owned' or 'received'

    let offers
    if (type === 'received') {
      offers = await getOffersIntroducedToUser(userId)
    } else {
      offers = await getUserOffers(userId, status || undefined)
    }

    return NextResponse.json({ offers })
  } catch (error) {
    console.error('Error getting offers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get offers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const body = await request.json()

    const input: CreateOfferInput = {
      title: body.title,
      description: body.description,
      value: body.value,
      currency: body.currency,
      commissions: body.commissions,
      category: body.category,
      tags: body.tags,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    }

    // Validation
    if (!input.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!input.value || input.value <= 0) {
      return NextResponse.json({ error: 'value must be positive' }, { status: 400 })
    }
    if (!input.commissions) {
      return NextResponse.json({ error: 'commissions structure is required' }, { status: 400 })
    }

    const ownerName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.emailAddresses?.[0]?.emailAddress

    const offer = await createOffer(userId, input, ownerName)

    return NextResponse.json({
      success: true,
      offer,
      message: 'Offer created',
    })
  } catch (error) {
    console.error('Error creating offer:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create offer' },
      { status: 400 }
    )
  }
}
