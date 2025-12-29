// @ts-nocheck
/**
 * Conversational Onboarding API Route
 *
 * Handles onboarding chat messages with a natural, conversational flow.
 * Users interact with Wells through dialogue to complete their setup.
 *
 * Endpoints:
 * - GET: Initialize onboarding or get current state
 * - POST: Send a message or action to the onboarding conversation
 * - PUT: Update onboarding preferences directly
 * - DELETE: Reset onboarding (start over)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  OnboardingHandler,
  initializeOnboarding,
  handleOnboardingMessage,
  handleIntentAwareMessage,
} from '@/lib/chat/handlers/onboarding-handler'
import {
  ConversationalOnboarding,
  CollectedOnboardingData,
  UserPreferences,
} from '@/lib/onboarding/conversational-onboarding'

// ============================================================================
// TYPES
// ============================================================================

interface OnboardingChatRequest {
  message?: string
  action?: string
  actionData?: Record<string, unknown>
  useIntentRouting?: boolean // Enable intent-aware routing
}

interface OnboardingUpdateRequest {
  preferences?: Partial<UserPreferences>
  data?: Partial<CollectedOnboardingData>
}

// ============================================================================
// GET - Initialize or get current onboarding state
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check for specific query params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Handle special actions
    if (action === 'status') {
      // Return just the status without generating a message
      const conversation = await ConversationalOnboarding.getOrCreateConversation(userId)
      return NextResponse.json({
        phase: conversation.phase,
        progress: calculateProgress(conversation.phase),
        collectedData: sanitizeCollectedData(conversation.collectedData),
        isComplete: conversation.phase === 'completion',
        startedAt: conversation.createdAt,
        lastActivity: conversation.updatedAt,
      })
    }

    if (action === 'history') {
      // Return conversation history
      const conversation = await ConversationalOnboarding.getOrCreateConversation(userId)
      return NextResponse.json({
        messages: conversation.messages.slice(-50).map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          phase: m.phase,
          suggestedActions: m.suggestedActions,
        })),
        phase: conversation.phase,
        progress: calculateProgress(conversation.phase),
      })
    }

    // Default: Initialize or continue onboarding
    const response = await initializeOnboarding(userId)

    return NextResponse.json({
      message: response.message,
      phase: response.phase,
      progress: response.progress,
      suggestedActions: response.suggestedActions,
      collectedData: sanitizeCollectedData(response.collectedData),
      isComplete: response.isComplete,
      redirectTo: response.redirectTo,
    })
  } catch (error) {
    console.error('[OnboardingAPI] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize onboarding' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Send message or action
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json() as OnboardingChatRequest
    const { message, action, actionData, useIntentRouting } = body

    // Validate input
    if (!message && !action) {
      return NextResponse.json(
        { error: 'Either message or action is required' },
        { status: 400 }
      )
    }

    // Handle the message/action
    let response
    if (useIntentRouting && message) {
      // Use intent-aware handling
      response = await handleIntentAwareMessage({
        userId,
        message,
        action,
        actionData,
      })
    } else {
      // Standard onboarding handling
      response = await handleOnboardingMessage({
        userId,
        message: message || '',
        action,
        actionData,
      })
    }

    return NextResponse.json({
      message: response.message,
      phase: response.phase,
      progress: response.progress,
      suggestedActions: response.suggestedActions,
      collectedData: sanitizeCollectedData(response.collectedData),
      isComplete: response.isComplete,
      redirectTo: response.redirectTo,
      toolUse: response.toolUse,
    })
  } catch (error) {
    console.error('[OnboardingAPI] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Update preferences or data directly
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json() as OnboardingUpdateRequest
    const { preferences, data } = body

    const conversation = await ConversationalOnboarding.getOrCreateConversation(userId)

    // Update preferences
    if (preferences) {
      conversation.preferences = {
        ...conversation.preferences,
        ...preferences,
      }
    }

    // Update collected data
    if (data) {
      conversation.collectedData = {
        ...conversation.collectedData,
        ...data,
      }
    }

    await ConversationalOnboarding.saveConversation(conversation)

    return NextResponse.json({
      success: true,
      phase: conversation.phase,
      progress: calculateProgress(conversation.phase),
      preferences: conversation.preferences,
      collectedData: sanitizeCollectedData(conversation.collectedData),
    })
  } catch (error) {
    console.error('[OnboardingAPI] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update onboarding' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Reset onboarding
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const confirmReset = searchParams.get('confirm')

    if (confirmReset !== 'true') {
      return NextResponse.json(
        { error: 'Reset must be confirmed with ?confirm=true' },
        { status: 400 }
      )
    }

    // Create a fresh conversation (effectively resetting)
    // Note: In production, you might want to archive the old one instead
    const freshResponse = await initializeOnboarding(userId)

    return NextResponse.json({
      success: true,
      message: 'Onboarding reset successfully',
      ...freshResponse,
    })
  } catch (error) {
    console.error('[OnboardingAPI] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to reset onboarding' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate progress percentage based on current phase
 */
function calculateProgress(phase: string): number {
  const phases = [
    'greeting',
    'discovery',
    'journey_selection',
    'profile_building',
    'integrations',
    'preferences',
    'treasury',
    'data_import',
    'completion',
  ]

  const currentIndex = phases.indexOf(phase)
  if (currentIndex === -1) return 0

  return Math.round((currentIndex / (phases.length - 1)) * 100)
}

/**
 * Sanitize collected data for API response (remove sensitive info)
 */
function sanitizeCollectedData(data: Partial<CollectedOnboardingData>): Partial<CollectedOnboardingData> {
  const sanitized = { ...data }

  // Remove or mask sensitive fields
  if (sanitized.phone) {
    sanitized.phone = sanitized.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }

  // Don't expose internal IDs or tokens
  delete (sanitized as any).internalTokens
  delete (sanitized as any).sessionId

  return sanitized
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
