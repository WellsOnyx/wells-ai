// @ts-nocheck
/**
 * Memory API - User Memory CRUD
 *
 * GET /api/memory/[userId] - Get user memory
 * PATCH /api/memory/[userId] - Update user memory
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getMemory,
  getOrCreateMemory,
  updateMemory,
} from '@/lib/memory'

// GET - Retrieve user memory
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const memory = await getMemory(userId)

    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      memory: {
        userId: memory.userId,
        facts: memory.facts,
        patterns: memory.patterns,
        history: memory.history,
        recentContext: memory.recentContext,
        learnedPreferences: memory.learnedPreferences,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      },
    })
  } catch (error) {
    console.error('[MemoryAPI] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve memory' },
      { status: 500 }
    )
  }
}

// PATCH - Update user memory
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { facts, patterns, history, recentContext, learnedPreferences } = body

    // Ensure memory exists
    await getOrCreateMemory(userId)

    // Update with provided data
    await updateMemory(userId, {
      facts,
      patterns,
      history,
      recentContext,
      learnedPreferences,
    })

    // Get updated memory
    const updatedMemory = await getMemory(userId)

    return NextResponse.json({
      success: true,
      message: 'Memory updated successfully',
      memory: updatedMemory,
    })
  } catch (error) {
    console.error('[MemoryAPI] PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    )
  }
}
