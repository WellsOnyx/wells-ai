// @ts-nocheck
/**
 * Cold Start Chat API
 *
 * Conversational endpoint for cold start outreach.
 * Everything happens through chat - no forms, no pages.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { handleColdStartMessage } from '@/lib/chat/handlers/coldstart-handler'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const maxDuration = 60

// ============================================================================
// POST - Handle Cold Start Messages
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request
    const body = await request.json()
    const { message, sessionId, attachedFile } = body

    if (!message && !attachedFile) {
      return NextResponse.json(
        { error: 'Message or file required' },
        { status: 400 }
      )
    }

    // Use provided session ID or generate one
    const session = sessionId || uuidv4()

    // Handle the message
    const response = await handleColdStartMessage(
      userId,
      session,
      message || '',
      attachedFile
    )

    return NextResponse.json({
      success: true,
      sessionId: session,
      ...response,
    })
  } catch (error) {
    console.error('[ColdStart API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get Cold Start Status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    // Import here to avoid circular deps
    const { getColdStartContext } = await import('@/lib/chat/handlers/coldstart-handler')
    const { getUserOutreachStats } = await import('@/lib/coldstart/outreach-engine')
    const { getProspectingSummary } = await import('@/lib/seller/proactive-prospecting')

    // Get context and stats
    const [stats, prospecting] = await Promise.all([
      getUserOutreachStats(userId),
      getProspectingSummary(userId),
    ])

    let context = null
    if (sessionId) {
      context = await getColdStartContext(userId, sessionId)
    }

    return NextResponse.json({
      success: true,
      context,
      stats: {
        contacts: stats.totalContacts,
        sent: stats.totalSent,
        replies: stats.totalReplies,
        replyRate: stats.overallReplyRate,
        activeCampaigns: stats.activeCompaigns,
        recentWins: stats.recentWins,
      },
      prospecting: {
        newOpportunities: prospecting.newMatches,
        pendingReview: prospecting.pendingReview,
        sentThisWeek: prospecting.sentThisWeek,
        repliesReceived: prospecting.repliesReceived,
      },
    })
  } catch (error) {
    console.error('[ColdStart API] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
