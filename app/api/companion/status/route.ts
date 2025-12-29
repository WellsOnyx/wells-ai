// @ts-nocheck
/**
 * GET /api/companion/status
 *
 * Get Wells status - shows the "Wells is working" information
 * including current tasks, recent completions, and statistics.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getWellsStatus,
  getAnimatedTaskDescriptions,
  getWellsPulse,
} from '@/lib/companion/wells-status'

/**
 * GET - Get Wells status for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const includeAnimations = searchParams.get('animations') === 'true'

    // Get full status
    const status = await getWellsStatus(userId)

    // Get pulse animation settings
    const pulse = getWellsPulse(status)

    // Build response
    const response: any = {
      success: true,
      isWorking: status.isWorking,
      statusMessage: status.statusMessage,
      currentTasks: status.currentTasks.map((task) => ({
        id: task.id,
        type: task.type,
        description: task.description,
        startedAt: task.startedAt.toISOString(),
        relatedEntity: task.relatedEntity,
      })),
      recentCompletions: status.recentCompletions.map((completion) => ({
        id: completion.id,
        description: completion.description,
        result: completion.result,
        completedAt: completion.completedAt.toISOString(),
        value: completion.value,
        valueType: completion.valueType,
      })),
      stats: status.stats,
      pulse: {
        speed: pulse.pulseSpeed,
        color: pulse.glowColor,
        intensity: pulse.intensity,
      },
      lastHeartbeat: status.lastHeartbeat.toISOString(),
    }

    // Include animated descriptions for loading states
    if (includeAnimations) {
      response.animatedDescriptions = getAnimatedTaskDescriptions()
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Error getting Wells status:', error)
    return NextResponse.json(
      { error: 'Failed to get Wells status' },
      { status: 500 }
    )
  }
}

/**
 * POST - Trigger a status refresh (forces re-calculation)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get fresh status
    const status = await getWellsStatus(userId)
    const pulse = getWellsPulse(status)

    return NextResponse.json({
      success: true,
      isWorking: status.isWorking,
      statusMessage: status.statusMessage,
      stats: status.stats,
      pulse: {
        speed: pulse.pulseSpeed,
        color: pulse.glowColor,
        intensity: pulse.intensity,
      },
      refreshedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[API] Error refreshing Wells status:', error)
    return NextResponse.json(
      { error: 'Failed to refresh Wells status' },
      { status: 500 }
    )
  }
}
