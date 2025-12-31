/**
 * Deal Funding API
 *
 * POST - Fund the escrow for a deal
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fundDealEscrow, getDeal } from '@/lib/deals/service'

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

    // Only buyer can fund
    if (deal.buyerId !== userId) {
      return NextResponse.json({ error: 'Only buyer can fund escrow' }, { status: 403 })
    }

    const updatedDeal = await fundDealEscrow(id)

    return NextResponse.json({
      success: true,
      deal: updatedDeal,
      message: `$${updatedDeal.amount.toLocaleString()} funded to escrow. Awaiting delivery.`,
    })
  } catch (error: any) {
    console.error('Fund error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fund escrow' },
      { status: 400 }
    )
  }
}
