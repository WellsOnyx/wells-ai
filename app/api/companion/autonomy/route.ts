// @ts-nocheck
/**
 * GET/PUT /api/companion/autonomy
 *
 * Manage user autonomy settings - what Wells can do automatically.
 * Higher trust = more autonomy granted to Wells.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getTrustScore,
  getAutonomyLevel,
  canPerformAutonomousAction,
  updateAutonomy,
  getTrustProgress,
  getTrustSummaryForChat,
  AutonomyConfig,
} from '@/lib/companion/trust-builder'
import { query } from '@/lib/db'

/**
 * GET - Get current autonomy configuration and what actions Wells can take
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all autonomy-related data in parallel
    const [
      trustScore,
      autonomyLevel,
      trustProgress,
      chatSummary,
    ] = await Promise.all([
      getTrustScore(userId),
      getAutonomyLevel(userId),
      getTrustProgress(userId),
      getTrustSummaryForChat(userId),
    ])

    // Get custom overrides if any
    let customOverrides = null
    try {
      const result = await query(
        'SELECT overrides FROM user_autonomy_overrides WHERE user_id = $1',
        [userId]
      )
      if (result.rows.length > 0) {
        customOverrides = result.rows[0].overrides
      }
    } catch (e) {
      // Table may not exist
    }

    // Merge autonomy with overrides
    const effectiveAutonomy = customOverrides
      ? { ...autonomyLevel, ...customOverrides }
      : autonomyLevel

    return NextResponse.json({
      success: true,
      trust: {
        tier: trustScore.tier,
        score: trustScore.score,
        factors: trustScore.factors,
        milestones: trustScore.milestones,
      },
      autonomy: {
        current: effectiveAutonomy,
        recommended: autonomyLevel,
        hasCustomOverrides: !!customOverrides,
      },
      progress: trustProgress,
      chatSummary,
      capabilities: {
        canAutoNegotiate: {
          enabled: effectiveAutonomy.autoNegotiate,
          maxValue: effectiveAutonomy.autoNegotiateMaxValue,
          description: effectiveAutonomy.autoNegotiate
            ? `I can automatically negotiate deals up to $${effectiveAutonomy.autoNegotiateMaxValue.toLocaleString()}`
            : 'I need your approval before negotiating',
        },
        canAutoApprove: {
          enabled: effectiveAutonomy.autoApproveBelow > 0,
          maxValue: effectiveAutonomy.autoApproveBelow,
          description: effectiveAutonomy.autoApproveBelow > 0
            ? `I can auto-approve purchases under $${effectiveAutonomy.autoApproveBelow.toLocaleString()}`
            : 'All purchases require your approval',
        },
        canSendQuotes: {
          enabled: effectiveAutonomy.autoSendQuotes,
          description: effectiveAutonomy.autoSendQuotes
            ? 'I can send quotes on your behalf'
            : 'I need approval to send quotes',
        },
        canRespondToRfqs: {
          enabled: effectiveAutonomy.autoRespondToRfqs,
          description: effectiveAutonomy.autoRespondToRfqs
            ? 'I can respond to RFQs automatically'
            : 'I need approval for RFQ responses',
        },
        canDoProactiveOutreach: {
          enabled: effectiveAutonomy.proactiveOutreach,
          description: effectiveAutonomy.proactiveOutreach
            ? 'I can proactively reach out to prospects'
            : 'Outreach requires your approval',
        },
        canFollowUp: {
          enabled: effectiveAutonomy.autoFollowUp,
          description: effectiveAutonomy.autoFollowUp
            ? 'I can send follow-up messages automatically'
            : 'Follow-ups require your approval',
        },
        canScheduleMeetings: {
          enabled: effectiveAutonomy.autoScheduleMeetings,
          description: effectiveAutonomy.autoScheduleMeetings
            ? 'I can schedule meetings on your behalf'
            : 'Meeting scheduling requires your approval',
        },
      },
    })
  } catch (error) {
    console.error('[API] Error getting autonomy:', error)
    return NextResponse.json(
      { error: 'Failed to get autonomy settings' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update autonomy settings (custom overrides)
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { overrides }: { overrides: Partial<AutonomyConfig> } = body

    if (!overrides || typeof overrides !== 'object') {
      return NextResponse.json(
        { error: 'Invalid overrides object' },
        { status: 400 }
      )
    }

    // Validate that user isn't trying to grant themselves more autonomy than earned
    const trustScore = await getTrustScore(userId)
    const baseAutonomy = await getAutonomyLevel(userId)

    // Check for unsafe overrides
    const warnings: string[] = []

    if (overrides.autoNegotiateMaxValue && overrides.autoNegotiateMaxValue > baseAutonomy.autoNegotiateMaxValue) {
      warnings.push(`Auto-negotiate limit capped at $${baseAutonomy.autoNegotiateMaxValue.toLocaleString()} based on trust level`)
      overrides.autoNegotiateMaxValue = baseAutonomy.autoNegotiateMaxValue
    }

    if (overrides.autoApproveBelow && overrides.autoApproveBelow > baseAutonomy.autoApproveBelow) {
      warnings.push(`Auto-approve limit capped at $${baseAutonomy.autoApproveBelow.toLocaleString()} based on trust level`)
      overrides.autoApproveBelow = baseAutonomy.autoApproveBelow
    }

    // Store overrides
    try {
      await query(
        `INSERT INTO user_autonomy_overrides (user_id, overrides, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           overrides = $2,
           updated_at = NOW()`,
        [userId, JSON.stringify(overrides)]
      )
    } catch (e) {
      // If table doesn't exist, try using the existing autonomy settings
      await updateAutonomy(userId, overrides)
    }

    // Get the new effective autonomy
    const newAutonomy = { ...baseAutonomy, ...overrides }

    return NextResponse.json({
      success: true,
      autonomy: newAutonomy,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: warnings.length > 0
        ? 'Settings updated with some adjustments'
        : 'Autonomy settings updated successfully',
    })
  } catch (error) {
    console.error('[API] Error updating autonomy:', error)
    return NextResponse.json(
      { error: 'Failed to update autonomy settings' },
      { status: 500 }
    )
  }
}

/**
 * POST - Check if a specific action is allowed
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, value, context } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action to check' },
        { status: 400 }
      )
    }

    const result = await canPerformAutonomousAction(userId, action, value)

    // If not allowed, suggest what's needed
    let suggestion = null
    if (!result.allowed) {
      const progress = await getTrustProgress(userId)
      suggestion = {
        currentTier: progress.currentTier,
        nextTier: progress.nextTier,
        pointsToNext: progress.pointsToNext,
        recommendations: progress.recommendations,
        message: `Complete more interactions to unlock this capability. ${progress.recommendations[0] || ''}`,
      }
    }

    return NextResponse.json({
      success: true,
      action,
      value,
      allowed: result.allowed,
      reason: result.reason,
      suggestion: result.allowed ? null : suggestion,
      context: context
        ? {
            provided: context,
            note: result.allowed
              ? 'Action approved and logged'
              : 'Action blocked - manual approval required',
          }
        : undefined,
    })
  } catch (error) {
    console.error('[API] Error checking action permission:', error)
    return NextResponse.json(
      { error: 'Failed to check action permission' },
      { status: 500 }
    )
  }
}
