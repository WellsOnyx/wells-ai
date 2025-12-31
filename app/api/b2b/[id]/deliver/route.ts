/**
 * B2B Deal Delivery API
 *
 * POST - Mark deal as delivered (seller)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { markDelivered, getDeal } from '@/lib/deals/service'

export async function POST(
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

    // Only seller can mark delivered
    if (deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Only seller can mark as delivered' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { trackingNumber, carrier, notes } = body

    const updatedDeal = await markDelivered(id, userId, {
      trackingNumber,
      carrier,
      notes,
    })

    return NextResponse.json({
      success: true,
      deal: updatedDeal,
      message: updatedDeal.autoRelease
        ? `Marked as delivered. Funds will auto-release in ${updatedDeal.autoReleaseDays} days if no dispute.`
        : 'Marked as delivered. Awaiting buyer confirmation to release funds.',
    })
  } catch (error: any) {
    console.error('B2B deliver error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to mark delivered' },
      { status: 400 }
    )
  }
}
