/**
 * Deal Confirmation API
 *
 * POST - Confirm a deal ("yes, proceed")
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { confirmDeal, getDeal } from '@/lib/deals/service'

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

    // Determine role
    let role: 'buyer' | 'seller'
    if (deal.buyerId === userId) {
      role = 'buyer'
    } else if (deal.sellerId === userId) {
      role = 'seller'
    } else {
      return NextResponse.json({ error: 'Not a party to this deal' }, { status: 403 })
    }

    const body = await request.json()
    const { message, method, channel, conversationId, messageId } = body

    // Get IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    const userAgent = request.headers.get('user-agent') || undefined

    const result = await confirmDeal({
      dealId: id,
      userId,
      role,
      method: method || 'button',
      channel,
      message: message || 'Confirmed',
      conversationId,
      messageId,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      deal: result.deal,
      fullyConfirmed: result.fullyConfirmed,
      escrowFunded: result.escrowFunded,
      message: result.fullyConfirmed
        ? result.escrowFunded
          ? 'Deal confirmed and funded! Money is in escrow.'
          : 'Deal confirmed by both parties! Ready for funding.'
        : 'Your confirmation recorded. Waiting for other party.',
    })
  } catch (error: any) {
    console.error('Confirm error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to confirm deal' },
      { status: 400 }
    )
  }
}
