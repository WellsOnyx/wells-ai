/**
 * Founder Profile API
 *
 * GET /api/founder/profile
 * - Returns founder profile based on user data and conversation history
 * - Uses lib/journeys/founder-detection.ts for intelligent detection
 *
 * POST /api/founder/profile
 * - Updates founder profile based on new information
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { detectFounderIntent, type FounderProfile } from '@/lib/journeys/founder-detection'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // TODO: Fetch actual conversation history from database
    // For now, using mock messages to detect intent
    const mockMessages = [
      { role: 'user', content: 'I need to hire a CTO for my startup' },
      { role: 'assistant', content: 'I can help with that. What stage are you at?' },
      { role: 'user', content: 'We just raised our seed round, $2M, 8 people on the team' }
    ]

    // Detect founder profile
    const profile: FounderProfile = await detectFounderIntent({
      messages: mockMessages,
      userData: {
        userId,
        userType: 'founder'
      }
    })

    return NextResponse.json({
      success: true,
      profile: {
        stage: profile.stage,
        painPoints: profile.painPoints,
        urgency: profile.urgency,
        context: profile.context
      }
    })

  } catch (error) {
    console.error('[FOUNDER_PROFILE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch founder profile' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messages, profileUpdate } = body

    // If messages provided, detect from conversation
    if (messages && Array.isArray(messages)) {
      const profile: FounderProfile = await detectFounderIntent({
        messages,
        userData: {
          userId,
          userType: 'founder'
        }
      })

      // TODO: Store profile in database

      return NextResponse.json({
        success: true,
        profile: {
          stage: profile.stage,
          painPoints: profile.painPoints,
          urgency: profile.urgency,
          confidence: profile.confidence,
          context: profile.context
        }
      })
    }

    // If profile update provided, store directly
    if (profileUpdate) {
      // TODO: Store profile update in database

      return NextResponse.json({
        success: true,
        profile: profileUpdate
      })
    }

    return NextResponse.json(
      { error: 'No messages or profile update provided' },
      { status: 400 }
    )

  } catch (error) {
    console.error('[FOUNDER_PROFILE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update founder profile' },
      { status: 500 }
    )
  }
}
