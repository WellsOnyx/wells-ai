// @ts-nocheck
/**
 * Memory API - Update Memory
 *
 * POST /api/memory/update - Update user memory with new data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateMemory, updateMemory, processLearningEvent } from '@/lib/memory'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, updates, learningEvent } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Ensure memory exists
    await getOrCreateMemory(userId)

    // Apply updates if provided
    if (updates) {
      await updateMemory(userId, updates)
    }

    // Process learning event if provided
    let insights = []
    if (learningEvent) {
      const { eventType, data } = learningEvent
      insights = await processLearningEvent({
        userId,
        eventType,
        data,
        timestamp: new Date(),
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Memory updated successfully',
      insightsLearned: insights.length,
      insights: insights.map(i => ({
        type: i.type,
        key: i.key,
        confidence: i.confidence,
      })),
    })
  } catch (error) {
    console.error('[MemoryAPI] Update error:', error)
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    )
  }
}
