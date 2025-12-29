// @ts-nocheck
/**
 * GET/PUT /api/companion/preferences
 *
 * Manage user notification preferences and companion settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  updateChannelPreferences,
  NotificationPreferences,
  NotificationChannel,
} from '@/lib/companion/notification-hub'
import {
  getPersonalityAdaptation,
  updatePersonalityAdaptation,
  PersonalityAdaptation,
} from '@/lib/companion/memory-enhancement'
import { getTrustScore, updateAutonomy, AutonomySettings } from '@/lib/companion/trust-builder'

/**
 * GET - Fetch all user preferences
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all preference types in parallel
    const [notificationPrefs, personalityPrefs, trustScore] = await Promise.all([
      getNotificationPreferences(userId),
      getPersonalityAdaptation(userId),
      getTrustScore(userId),
    ])

    return NextResponse.json({
      success: true,
      preferences: {
        notifications: notificationPrefs,
        personality: personalityPrefs,
        autonomy: trustScore.autonomyLevel,
        trustTier: trustScore.tier,
        trustScore: trustScore.score,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update user preferences
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, updates } = body

    if (!type || !updates) {
      return NextResponse.json(
        { error: 'Missing type or updates' },
        { status: 400 }
      )
    }

    let result: any = null

    switch (type) {
      case 'notifications':
        // Full notification preferences update
        const currentPrefs = await getNotificationPreferences(userId)
        const updatedNotificationPrefs: NotificationPreferences = {
          ...currentPrefs,
          ...updates,
          userId, // Ensure userId is set
        }
        await saveNotificationPreferences(updatedNotificationPrefs)
        result = updatedNotificationPrefs
        break

      case 'channel':
        // Update specific channel preferences
        if (!updates.channel) {
          return NextResponse.json(
            { error: 'Missing channel' },
            { status: 400 }
          )
        }
        await updateChannelPreferences(
          userId,
          updates.channel as NotificationChannel,
          updates.settings
        )
        const newPrefs = await getNotificationPreferences(userId)
        result = newPrefs.channels[updates.channel as NotificationChannel]
        break

      case 'personality':
        // Update personality adaptation
        await updatePersonalityAdaptation(userId, updates)
        result = await getPersonalityAdaptation(userId)
        break

      case 'autonomy':
        // Update autonomy settings
        result = await updateAutonomy(userId, updates)
        break

      case 'quiet_hours':
        // Update quiet hours specifically
        const qhPrefs = await getNotificationPreferences(userId)
        qhPrefs.globalQuietHoursStart = updates.start
        qhPrefs.globalQuietHoursEnd = updates.end
        await saveNotificationPreferences(qhPrefs)
        result = {
          start: updates.start,
          end: updates.end,
        }
        break

      case 'pause':
        // Pause/unpause all notifications
        const pausePrefs = await getNotificationPreferences(userId)
        pausePrefs.pauseAll = updates.pause
        pausePrefs.pauseUntil = updates.pauseUntil
          ? new Date(updates.pauseUntil)
          : undefined
        await saveNotificationPreferences(pausePrefs)
        result = {
          pauseAll: pausePrefs.pauseAll,
          pauseUntil: pausePrefs.pauseUntil,
        }
        break

      case 'digest':
        // Update digest settings
        const digestPrefs = await getNotificationPreferences(userId)
        digestPrefs.digestTime = updates.time
        digestPrefs.digestDayOfWeek = updates.dayOfWeek
        await saveNotificationPreferences(digestPrefs)
        result = {
          time: digestPrefs.digestTime,
          dayOfWeek: digestPrefs.digestDayOfWeek,
        }
        break

      case 'timezone':
        // Update timezone
        const tzPrefs = await getNotificationPreferences(userId)
        tzPrefs.timezone = updates.timezone
        await saveNotificationPreferences(tzPrefs)
        result = { timezone: updates.timezone }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid preference type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      type,
      updated: result,
    })
  } catch (error) {
    console.error('[API] Error updating preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}

/**
 * POST - Bulk update preferences (for initial setup or migration)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { notifications, personality, autonomy } = body

    const results: Record<string, any> = {}

    // Update each preference type if provided
    if (notifications) {
      await saveNotificationPreferences({
        ...notifications,
        userId,
      })
      results.notifications = await getNotificationPreferences(userId)
    }

    if (personality) {
      await updatePersonalityAdaptation(userId, personality)
      results.personality = await getPersonalityAdaptation(userId)
    }

    if (autonomy) {
      results.autonomy = await updateAutonomy(userId, autonomy)
    }

    return NextResponse.json({
      success: true,
      updated: results,
    })
  } catch (error) {
    console.error('[API] Error in bulk preferences update:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
