/**
 * Deal Message API
 *
 * Send messages within a deal conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: dealId } = await params
    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 })
    }

    // Verify user is part of this deal
    const deals = await sql`
      SELECT id, buyer_id, seller_id
      FROM b2b_deals
      WHERE id = ${dealId}
        AND (buyer_id = ${userId} OR seller_id = ${userId})
    `

    if (deals.length === 0) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Insert message
    const messages = await sql`
      INSERT INTO deal_messages (deal_id, sender_id, content)
      VALUES (${dealId}, ${userId}, ${content.trim()})
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      message: messages[0]
    })

  } catch (error) {
    console.error('Deal message error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: dealId } = await params

    // Verify user is part of this deal
    const deals = await sql`
      SELECT id FROM b2b_deals
      WHERE id = ${dealId}
        AND (buyer_id = ${userId} OR seller_id = ${userId})
    `

    if (deals.length === 0) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Get messages
    const messages = await sql`
      SELECT id, sender_id as "senderId", content, created_at as "createdAt"
      FROM deal_messages
      WHERE deal_id = ${dealId}
      ORDER BY created_at ASC
    `

    return NextResponse.json({ messages })

  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    )
  }
}
