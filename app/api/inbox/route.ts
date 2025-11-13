/**
 * Unified Inbox API
 * GET /api/inbox - List all messages for user
 */

import { NextRequest, NextResponse } from 'next/server'
import { InboundMessages } from '@/lib/inbox/db'
import { InboxFilters, MessageChannel, MessageIntent, MessageUrgency } from '@/lib/inbox/types'
import { monitorAPI } from '@/lib/monitoring'

export async function GET(req: NextRequest) {
  const monitor = monitorAPI('/api/inbox', 'GET')

  try {
    // Get user ID from auth (you should implement proper auth)
    const userId = req.headers.get('x-user-id') || 'default-user'

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams

    const filters: InboxFilters = {
      channel: searchParams.get('channel') as MessageChannel | undefined,
      sender: searchParams.get('sender') || undefined,
      intent: searchParams.get('intent') as MessageIntent | undefined,
      urgency: searchParams.get('urgency') as MessageUrgency | undefined,
      requiresResponse: searchParams.get('requiresResponse') === 'true' || undefined,
      unprocessedOnly: searchParams.get('unprocessedOnly') === 'true' || undefined,
      searchQuery: searchParams.get('q') || undefined,
    }

    const limit = parseInt(searchParams.get('limit') || '50')

    // Get messages
    const messages = await InboundMessages.findByUser(userId, filters, limit)

    // Get counts
    const unprocessedCount = await InboundMessages.getUnprocessedCount(userId)
    const requiresResponseCount = await InboundMessages.getRequiringResponseCount(userId)

    monitor.end(true)
    return NextResponse.json({
      success: true,
      messages,
      stats: {
        unprocessedCount,
        requiresResponseCount,
        totalReturned: messages.length,
      },
      filters,
    })
  } catch (error) {
    monitor.end(false)
    console.error('[INBOX API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch inbox',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
