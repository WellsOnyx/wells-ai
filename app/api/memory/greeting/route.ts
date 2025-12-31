// @ts-nocheck
/**
 * Memory API - Personalized Greeting
 *
 * GET /api/memory/greeting?userId=xxx - Get personalized greeting for user
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateGreeting, initializeWellsSession } from '@/lib/memory'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const full = searchParams.get('full') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (full) {
      // Return full session initialization
      const session = await initializeWellsSession(userId)

      return NextResponse.json({
        success: true,
        greeting: {
          message: session.greeting.greeting,
          subtext: session.greeting.subtext,
          mood: session.greeting.mood,
          suggestedActions: session.greeting.suggestedActions,
        },
        isNewUser: session.isNewUser,
        trustLevel: session.trustLevel,
        context: {
          availableReferences: session.context.availableReferences.slice(0, 5),
          suggestions: session.context.suggestions.slice(0, 3),
          userState: session.context.userState,
        },
        systemPrompt: session.prompt.systemPrompt,
        welcomeMessage: session.prompt.welcomeMessage,
        suggestedResponses: session.prompt.suggestedResponses,
      })
    }

    // Simple greeting only
    const greeting = await generateGreeting(userId)

    return NextResponse.json({
      success: true,
      greeting: {
        message: greeting.greeting,
        subtext: greeting.subtext,
        mood: greeting.mood,
        suggestedActions: greeting.suggestedActions,
      },
    })
  } catch (error) {
    console.error('[MemoryAPI] Greeting error:', error)
    return NextResponse.json(
      { error: 'Failed to generate greeting' },
      { status: 500 }
    )
  }
}
