/**
 * Instant Offers API
 *
 * GET  - List offers
 * POST - Create new offer
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createOffer, getOffers } from '@/lib/deals/service'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const direction = request.nextUrl.searchParams.get('direction') as 'sent' | 'received' | 'open'
    const offers = await getOffers(userId, direction || 'received')

    return NextResponse.json({ offers })
  } catch (error) {
    console.error('Offers GET error:', error)
    return NextResponse.json({ error: 'Failed to get offers' }, { status: 500 })
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
      toUserId,
      toCompany,
      title,
      description,
      amount,
      currency,
      paymentTerms,
      deliveryTerms,
      validForHours,
    } = body

    if (!title || !amount) {
      return NextResponse.json({ error: 'title and amount required' }, { status: 400 })
    }

    const offer = await createOffer(userId, {
      toUserId,
      toCompany,
      title,
      description,
      amount,
      currency,
      paymentTerms,
      deliveryTerms,
      validForHours,
    })

    return NextResponse.json(offer, { status: 201 })
  } catch (error) {
    console.error('Offer POST error:', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }
}
