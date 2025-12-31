/**
 * Single B2B Deal API
 *
 * GET - Get deal details
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDeal } from '@/lib/deals/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const deal = await getDeal(id)

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Only parties can view deal
    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Determine user's role
    const role = deal.buyerId === userId ? 'buyer' : 'seller'

    return NextResponse.json({
      deal,
      role,
      canConfirm: role === 'buyer' ? !deal.buyerConfirmed : !deal.sellerConfirmed,
      canFund: role === 'buyer' && deal.status === 'accepted' && !deal.escrowFunded,
      canDeliver: role === 'seller' && deal.status === 'funded',
      canRelease: role === 'buyer' && deal.status === 'delivered',
    })
  } catch (error) {
    console.error('B2B deal GET error:', error)
    return NextResponse.json({ error: 'Failed to get deal' }, { status: 500 })
  }
}
