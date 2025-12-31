// @ts-nocheck
/**
 * Memory API - Extract from Conversation
 *
 * POST /api/memory/extract - Extract facts and context from a conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { extractFromConversation } from '@/lib/memory'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, messages, topic } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 })
    }

    // Validate message format
    const validMessages = messages.every(
      (m: any) => m.role && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string'
    )

    if (!validMessages) {
      return NextResponse.json(
        { error: 'Invalid message format. Each message must have role (user/assistant) and content.' },
        { status: 400 }
      )
    }

    // Extract facts from conversation
    const extracted = await extractFromConversation(userId, messages, topic)

    return NextResponse.json({
      success: true,
      extracted: {
        facts: extracted.facts,
        entities: extracted.entities,
        preferences: extracted.preferences,
        topics: extracted.topics,
        sentiment: extracted.sentiment,
        actionItems: extracted.actionItems,
        questions: extracted.questions,
      },
      message: `Extracted ${extracted.facts.length} facts, ${Object.values(extracted.entities).flat().length} entities, ${extracted.preferences.length} preferences`,
    })
  } catch (error) {
    console.error('[MemoryAPI] Extract error:', error)
    return NextResponse.json(
      { error: 'Failed to extract from conversation' },
      { status: 500 }
    )
  }
}
