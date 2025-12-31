/**
 * Deal Release API
 *
 * POST - Confirm delivery and release funds (buyer)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { confirmDelivery, getDeal } from '@/lib/deals/service'

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

    // Only buyer can release
    if (deal.buyerId !== userId) {
      return NextResponse.json({ error: 'Only buyer can release funds' }, { status: 403 })
    }

    const updatedDeal = await confirmDelivery(id, userId)

    return NextResponse.json({
      success: true,
      deal: updatedDeal,
      message: `Deal complete! $${updatedDeal.amount.toLocaleString()} released to seller.`,
    })
  } catch (error: any) {
    console.error('Release error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to release funds' },
      { status: 400 }
    )
  }
}
