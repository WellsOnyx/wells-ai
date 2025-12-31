/**
 * Accept Offer API
 *
 * POST - Accept an instant offer (creates deal automatically)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { acceptOffer } from '@/lib/deals/service'

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
    const body = await request.json().catch(() => ({}))

    const result = await acceptOffer({
      offerId: id,
      userId,
      company: body.company,
    })

    return NextResponse.json({
      success: true,
      offer: result.offer,
      deal: result.deal,
      message: `Offer accepted! Deal created for $${result.deal.amount.toLocaleString()}. Ready for funding.`,
    })
  } catch (error: any) {
    console.error('Accept offer error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to accept offer' },
      { status: 400 }
    )
  }
}
