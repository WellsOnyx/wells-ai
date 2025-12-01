/**
 * Milestone API
 *
 * Award milestones and get milestone status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateConversation, updateConversationMetrics } from '@/lib/memory'
import {
  createOnboardingState,
  awardMilestone,
  ONBOARDING_MILESTONES,
  getCelebrationMessage
} from '@/lib/onboarding'

/**
 * POST /api/onboarding/milestone
 *
 * Award a milestone to user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, sessionId, milestoneId } = body

    if (!userId || !sessionId || !milestoneId) {
      return NextResponse.json(
        { error: 'userId, sessionId, and milestoneId required' },
        { status: 400 }
      )
    }

    // Verify milestone exists
    const milestone = ONBOARDING_MILESTONES[milestoneId]
    if (!milestone) {
      return NextResponse.json(
        { error: 'Invalid milestone ID' },
        { status: 400 }
      )
    }

    // Get conversation
    const conversation = await getOrCreateConversation(
      { userId, sessionId },
      undefined
    )

    // Award milestone
    const currentState = conversation.onboardingState || createOnboardingState(sessionId)
    const newState = awardMilestone(currentState, milestoneId)

    // Check if already achieved
    const wasAlreadyAchieved = currentState.milestones.includes(milestoneId)

    // Save to conversation
    await updateConversationMetrics(conversation.id, {
      onboardingState: newState
    })

    // Get celebration message
    const celebration = getCelebrationMessage(milestoneId, newState)

    return NextResponse.json({
      success: true,
      milestone,
      newlyAchieved: !wasAlreadyAchieved,
      celebration,
      state: newState
    })
  } catch (error) {
    console.error('[MILESTONE] Error awarding milestone:', error)
    return NextResponse.json(
      { error: 'Failed to award milestone' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/onboarding/milestone
 *
 * Get all available milestones and user's achieved milestones
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const sessionId = searchParams.get('sessionId')

    if (!userId || !sessionId) {
      return NextResponse.json(
        { error: 'userId and sessionId required' },
        { status: 400 }
      )
    }

    // Get conversation
    const conversation = await getOrCreateConversation(
      { userId, sessionId },
      undefined
    )

    const state = conversation.onboardingState || createOnboardingState(sessionId)

    // Get all milestones with achievement status
    const milestonesWithStatus = Object.entries(ONBOARDING_MILESTONES).map(
      ([id, milestone]) => ({
        ...milestone,
        achieved: state.milestones.includes(id)
      })
    )

    return NextResponse.json({
      success: true,
      milestones: milestonesWithStatus,
      achievedCount: state.milestones.length,
      totalCount: Object.keys(ONBOARDING_MILESTONES).length
    })
  } catch (error) {
    console.error('[MILESTONE] Error getting milestones:', error)
    return NextResponse.json(
      { error: 'Failed to get milestones' },
      { status: 500 }
    )
  }
}
