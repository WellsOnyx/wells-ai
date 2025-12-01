/**
 * Onboarding API
 *
 * Get onboarding status, update state, track progress
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateConversation, updateConversationMetrics } from '@/lib/memory'
import { createOnboardingState, isOnboardingComplete, getOnboardingProgress } from '@/lib/onboarding'

/**
 * GET /api/onboarding
 *
 * Get current onboarding state for user
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

    // Get conversation to retrieve onboarding state
    const conversation = await getOrCreateConversation(
      { userId, sessionId },
      undefined
    )

    let onboardingState = conversation.onboardingState

    // Create initial state if doesn't exist
    if (!onboardingState) {
      onboardingState = createOnboardingState(sessionId)
    }

    const progress = getOnboardingProgress(onboardingState)
    const complete = isOnboardingComplete(onboardingState)

    return NextResponse.json({
      success: true,
      state: onboardingState,
      progress,
      complete
    })
  } catch (error) {
    console.error('[ONBOARDING] Error getting state:', error)
    return NextResponse.json(
      { error: 'Failed to get onboarding state' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/onboarding
 *
 * Update onboarding state
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, sessionId, updates } = body

    if (!userId || !sessionId || !updates) {
      return NextResponse.json(
        { error: 'userId, sessionId, and updates required' },
        { status: 400 }
      )
    }

    // Get conversation
    const conversation = await getOrCreateConversation(
      { userId, sessionId },
      undefined
    )

    // Update onboarding state
    const currentState = conversation.onboardingState || createOnboardingState(sessionId)
    const newState = { ...currentState, ...updates }

    // Save to conversation
    await updateConversationMetrics(conversation.id, {
      onboardingState: newState,
      onboardingCompleted: isOnboardingComplete(newState)
    })

    return NextResponse.json({
      success: true,
      state: newState,
      progress: getOnboardingProgress(newState),
      complete: isOnboardingComplete(newState)
    })
  } catch (error) {
    console.error('[ONBOARDING] Error updating state:', error)
    return NextResponse.json(
      { error: 'Failed to update onboarding state' },
      { status: 500 }
    )
  }
}
