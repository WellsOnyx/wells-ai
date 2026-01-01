/**
 * Single B2B Deal API
 *
 * GET - Get deal details with messages and timeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDeal } from '@/lib/deals/service'
import { sql } from '@/lib/db'

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

    // Get messages
    const messages = await sql`
      SELECT
        id,
        sender_id as "senderId",
        content,
        created_at as "createdAt"
      FROM deal_messages
      WHERE deal_id = ${id}
      ORDER BY created_at ASC
    `

    // Get confirmations as events
    const confirmations = await sql`
      SELECT
        id,
        'confirmation' as type,
        CASE
          WHEN confirmation_method = 'button' THEN 'Confirmed via button click'
          WHEN confirmation_method = 'chat' THEN 'Confirmed via chat: "' || confirmation_phrase || '"'
          ELSE 'Confirmed the deal'
        END as description,
        confirmed_at as "createdAt"
      FROM deal_confirmations
      WHERE deal_id = ${id}
      ORDER BY confirmed_at ASC
    `

    // Build timeline events from deal state changes
    const events = [
      {
        id: 'created',
        type: 'created',
        description: 'Deal created',
        createdAt: deal.createdAt,
      },
      ...confirmations,
    ]

    // Add status-based events
    if (deal.escrowFunded) {
      events.push({
        id: 'funded',
        type: 'funded',
        description: `Escrow funded with $${deal.amount.toLocaleString()}`,
        createdAt: deal.updatedAt, // Would be better with actual funded_at timestamp
      })
    }

    if (deal.status === 'delivered' || deal.status === 'completed') {
      events.push({
        id: 'delivered',
        type: 'delivered',
        description: 'Marked as delivered',
        createdAt: deal.updatedAt,
      })
    }

    if (deal.status === 'completed') {
      events.push({
        id: 'completed',
        type: 'completed',
        description: 'Funds released to seller - deal complete',
        createdAt: deal.updatedAt,
      })
    }

    // Sort events by date
    events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return NextResponse.json({
      deal,
      role,
      messages,
      events,
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
