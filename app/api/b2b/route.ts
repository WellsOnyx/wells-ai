/**
 * Frictionless B2B Deals API
 *
 * "Yes, proceed" = deal done, money escrowed, everyone wins
 *
 * GET  - List user's B2B deals
 * POST - Create new B2B deal
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDeal, getUserDeals, getDealsRequiringAction } from '@/lib/deals/service'
import { DealStatus } from '@/lib/deals/types'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const role = searchParams.get('role') as 'buyer' | 'seller' | null
    const status = searchParams.get('status') as DealStatus | null
    const action = searchParams.get('action') === 'true'

    if (action) {
      const deals = await getDealsRequiringAction(userId)
      return NextResponse.json({ deals, requiresAction: true })
    }

    const deals = await getUserDeals(userId, role || undefined, status || undefined)
    return NextResponse.json({ deals })
  } catch (error) {
    console.error('B2B deals GET error:', error)
    return NextResponse.json({ error: 'Failed to get deals' }, { status: 500 })
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
      sellerId,
      buyerId,
      buyerCompany,
      sellerCompany,
      title,
      description,
      amount,
      currency,
      paymentTerms,
      paymentMethod,
      deliveryType,
      expectedDelivery,
      autoRelease,
      autoReleaseDays,
      rfqId,
      quoteId,
      conversationId,
    } = body

    // User can be buyer or seller
    const isBuyer = !buyerId || buyerId === userId
    const actualBuyerId = isBuyer ? userId : buyerId
    const actualSellerId = isBuyer ? sellerId : userId

    if (!actualSellerId || !title || !amount) {
      return NextResponse.json(
        { error: 'sellerId, title, and amount required' },
        { status: 400 }
      )
    }

    const deal = await createDeal({
      buyerId: actualBuyerId,
      sellerId: actualSellerId,
      buyerCompany,
      sellerCompany,
      title,
      description,
      amount,
      currency,
      paymentTerms,
      paymentMethod,
      deliveryType,
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : undefined,
      autoRelease,
      autoReleaseDays,
      rfqId,
      quoteId,
      conversationId,
    })

    return NextResponse.json({
      success: true,
      deal,
      message: `Deal proposed for $${amount.toLocaleString()}. Awaiting confirmation.`,
      nextStep: isBuyer ? 'Awaiting seller confirmation' : 'Awaiting buyer confirmation',
    }, { status: 201 })
  } catch (error) {
    console.error('B2B deal POST error:', error)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
}
