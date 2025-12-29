// @ts-nocheck
/**
 * GET /api/companion/greeting
 *
 * Get a proactive greeting for the user with pending insights and context.
 * This is called when the user opens the chat to make Wells feel alive.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  generateContextualGreeting,
  buildSystemPromptContext,
  ChatContext,
} from '@/lib/companion/memory-enhancement'
import {
  buildProactiveChatGreeting,
  getChatQueue,
  markChatQueueRead,
  ChatQueueItem,
} from '@/lib/companion/notification-hub'
import {
  getPendingInsights,
  generateComprehensiveInsights,
} from '@/lib/companion/insight-engine'
import { getTrustScore, getValueDelivered } from '@/lib/companion/trust-builder'

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate greeting and get all context in parallel
    const [
      greetingData,
      chatGreeting,
      trustScore,
      valueDelivered,
    ] = await Promise.all([
      generateContextualGreeting(userId),
      buildProactiveChatGreeting(userId),
      getTrustScore(userId),
      getValueDelivered(userId),
    ])

    // Generate fresh insights if needed (background)
    const pendingInsights = await getPendingInsights(userId)

    // Build the complete proactive message
    let fullMessage = greetingData.greeting

    if (greetingData.proactiveMessages.length > 0) {
      fullMessage += '\n\n' + greetingData.proactiveMessages.join('\n\n')
    }

    // Add value summary if significant
    if (valueDelivered.totalValue > 1000) {
      fullMessage += `\n\n_Together we've captured $${valueDelivered.totalValue.toLocaleString()} in value so far._`
    }

    // Get system context for AI
    const systemContext = await buildSystemPromptContext(userId)

    return NextResponse.json({
      success: true,
      greeting: {
        message: fullMessage,
        rawGreeting: greetingData.greeting,
        proactiveMessages: greetingData.proactiveMessages,
      },
      context: greetingData.context,
      insights: {
        pending: pendingInsights.slice(0, 5),
        totalCount: pendingInsights.length,
        criticalCount: pendingInsights.filter((i) => i.urgency === 'critical').length,
        highCount: pendingInsights.filter((i) => i.urgency === 'high').length,
      },
      chatQueue: {
        items: chatGreeting.pendingItems,
        summary: chatGreeting.summary,
      },
      trust: {
        tier: trustScore.tier,
        score: trustScore.score,
      },
      value: valueDelivered,
      systemContext, // For AI system prompt injection
    })
  } catch (error) {
    console.error('[API] Error generating greeting:', error)
    return NextResponse.json(
      { error: 'Failed to generate greeting' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/companion/greeting
 *
 * Mark greeting items as read and optionally trigger insight generation
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { markRead, generateNewInsights, journey } = body

    // Mark chat queue items as read
    if (markRead && Array.isArray(markRead) && markRead.length > 0) {
      await markChatQueueRead(userId, markRead)
    }

    // Generate new insights if requested
    let newInsights = []
    if (generateNewInsights) {
      newInsights = await generateComprehensiveInsights({
        userId,
        journey: journey || 'buyer',
        lastActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      })
    }

    return NextResponse.json({
      success: true,
      markedRead: markRead?.length || 0,
      newInsights: newInsights.length,
    })
  } catch (error) {
    console.error('[API] Error in greeting POST:', error)
    return NextResponse.json(
      { error: 'Failed to process greeting actions' },
      { status: 500 }
    )
  }
}
