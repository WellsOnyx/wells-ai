// @ts-nocheck
/**
 * Memory API - Personalized System Prompt
 *
 * GET /api/memory/prompt?userId=xxx - Get personalized system prompt for user
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPersonalizedSystemPrompt,
  getRFQPrompt,
  getNegotiationPrompt,
  getOnboardingPrompt,
} from '@/lib/memory'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const journey = searchParams.get('journey') as 'buyer' | 'seller' | 'founder' | 'jobs' | 'general' | null
    const feature = searchParams.get('feature')
    const isNewConversation = searchParams.get('newConversation') !== 'false'

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    let prompt

    // Use specialized prompts for certain features
    switch (feature) {
      case 'rfq':
        prompt = await getRFQPrompt(userId)
        break
      case 'negotiation':
        prompt = await getNegotiationPrompt(userId)
        break
      case 'onboarding':
        prompt = await getOnboardingPrompt(userId)
        break
      default:
        prompt = await getPersonalizedSystemPrompt(userId, {
          journey: journey || 'general',
          feature: feature || undefined,
          isNewConversation,
        })
    }

    return NextResponse.json({
      success: true,
      prompt: {
        systemPrompt: prompt.systemPrompt,
        welcomeMessage: prompt.welcomeMessage,
        suggestedResponses: prompt.suggestedResponses,
        contextSummary: prompt.contextSummary,
      },
    })
  } catch (error) {
    console.error('[MemoryAPI] Prompt error:', error)
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    )
  }
}

// POST - Generate prompt with conversation context
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, journey, feature, currentTopic, isNewConversation } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const prompt = await getPersonalizedSystemPrompt(userId, {
      journey,
      feature,
      currentTopic,
      isNewConversation: isNewConversation ?? true,
    })

    return NextResponse.json({
      success: true,
      prompt: {
        systemPrompt: prompt.systemPrompt,
        welcomeMessage: prompt.welcomeMessage,
        suggestedResponses: prompt.suggestedResponses,
        contextSummary: prompt.contextSummary,
      },
    })
  } catch (error) {
    console.error('[MemoryAPI] Prompt POST error:', error)
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    )
  }
}
