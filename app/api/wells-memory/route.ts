/**
 * Wells Memory API
 *
 * Debug and management endpoint for the unified Wells memory system.
 * Allows viewing and updating user context across WellsAI and Grain & Vault.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getWellsMemory,
  getOrCreateWellsMemory,
  updateWellsMemory,
  learnFact,
  type WellsMemory,
} from '@/lib/wells-memory'

// ============================================================================
// GET - Retrieve user's memory
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

    const memory = await getWellsMemory(userId)

    if (!memory) {
      return NextResponse.json({
        exists: false,
        message: 'No memory context found for this user',
        userId,
      })
    }

    // Return memory with some sensitive fields redacted
    return NextResponse.json({
      exists: true,
      memory: {
        clerkUserId: memory.clerkUserId,
        firstName: memory.firstName,
        lastName: memory.lastName,
        communicationStyle: memory.communicationStyle,
        preferredName: memory.preferredName,
        industry: memory.industry,
        companyName: memory.companyName,
        role: memory.role,
        lastProduct: memory.lastProduct,
        wellsaiProfile: memory.wellsaiProfile,
        grainvaultProfile: {
          // Redact balance info from API
          paymentHistory: memory.grainvaultProfile.paymentHistory,
        },
        recentTopics: memory.recentTopics,
        keyEntities: memory.keyEntities,
        learnedFacts: memory.learnedFacts.slice(0, 10), // Limit facts returned
        conversationSummaries: memory.conversationSummaries.slice(0, 5),
        wellsaiMessageCount: memory.wellsaiMessageCount,
        grainvaultMessageCount: memory.grainvaultMessageCount,
        totalMessageCount: memory.totalMessageCount,
        lastActivity: memory.lastActivity,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      },
    })
  } catch (error) {
    console.error('[WellsMemory API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve memory' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Update user's memory or learn facts
// ============================================================================

interface UpdateMemoryRequest {
  action: 'update' | 'learn_fact' | 'set_preference'
  // For 'update' action
  wellsaiProfile?: Partial<WellsMemory['wellsaiProfile']>
  grainvaultProfile?: Partial<WellsMemory['grainvaultProfile']>
  preferences?: Record<string, any>
  // For 'learn_fact' action
  fact?: string
  factCategory?: 'preference' | 'business' | 'personal' | 'context'
  // For 'set_preference' action
  preferenceKey?: string
  preferenceValue?: any
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json() as UpdateMemoryRequest

    // Ensure memory exists
    await getOrCreateWellsMemory(userId)

    switch (body.action) {
      case 'update':
        await updateWellsMemory(userId, {
          wellsaiProfile: body.wellsaiProfile,
          grainvaultProfile: body.grainvaultProfile,
          preferences: body.preferences,
        })
        return NextResponse.json({
          success: true,
          message: 'Memory updated',
        })

      case 'learn_fact':
        if (!body.fact) {
          return NextResponse.json(
            { error: 'Fact is required' },
            { status: 400 }
          )
        }
        await learnFact(
          userId,
          body.fact,
          body.factCategory || 'context',
          'explicit',
          1.0 // High confidence for explicitly stated facts
        )
        return NextResponse.json({
          success: true,
          message: 'Fact learned',
          fact: body.fact,
        })

      case 'set_preference':
        if (!body.preferenceKey) {
          return NextResponse.json(
            { error: 'Preference key is required' },
            { status: 400 }
          )
        }
        await updateWellsMemory(userId, {
          preferences: {
            [body.preferenceKey]: body.preferenceValue,
          },
        })
        return NextResponse.json({
          success: true,
          message: 'Preference set',
          key: body.preferenceKey,
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[WellsMemory API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Clear user's memory (with confirmation)
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
    const confirm = searchParams.get('confirm')

    if (confirm !== 'yes') {
      return NextResponse.json({
        warning: 'This will clear your memory. Add ?confirm=yes to proceed.',
        note: 'This action cannot be undone.',
      })
    }

    // Clear by resetting to empty state
    await updateWellsMemory(userId, {
      wellsaiProfile: {},
      grainvaultProfile: {},
      recentTopics: [],
      keyEntities: {},
      learnedFacts: [],
      preferences: {},
    })

    return NextResponse.json({
      success: true,
      message: 'Memory cleared',
      note: 'Your preferences and learned context have been reset.',
    })
  } catch (error) {
    console.error('[WellsMemory API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to clear memory' },
      { status: 500 }
    )
  }
}
