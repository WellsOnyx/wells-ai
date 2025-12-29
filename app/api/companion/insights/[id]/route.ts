// @ts-nocheck
/**
 * GET/PUT/DELETE /api/companion/insights/[id]
 *
 * Get, update, or dismiss a specific insight.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { query } from '@/lib/db'
import { recordTrustEvent } from '@/lib/companion/trust-builder'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * GET - Fetch a specific insight
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Try both tables for compatibility
    let insight = null

    // First try wells_insights (new table)
    const newTableResult = await query(
      `SELECT * FROM wells_insights WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )

    if (newTableResult.rows.length > 0) {
      const row = newTableResult.rows[0]
      insight = {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        priority: row.priority,
        title: row.title,
        summary: row.summary,
        details: row.details,
        actionable: row.actionable,
        suggestedAction: row.suggested_action,
        potentialValue: row.potential_value ? parseFloat(row.potential_value) : null,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        readAt: row.read_at,
        actedOn: row.acted_on,
        dismissed: row.dismissed,
        metadata: row.metadata,
      }
    } else {
      // Try proactive_insights (legacy table)
      const legacyResult = await query(
        `SELECT * FROM proactive_insights WHERE id = $1 AND user_id = $2`,
        [id, userId]
      )

      if (legacyResult.rows.length > 0) {
        const row = legacyResult.rows[0]
        insight = {
          id: row.id,
          userId: row.user_id,
          type: row.category,
          priority: row.urgency === 'critical' ? 'urgent' : row.urgency,
          title: row.title,
          summary: row.message,
          details: row.detailed_explanation || row.message,
          actionable: row.action_options?.length > 0,
          suggestedAction: row.action_options?.[0]?.label,
          potentialValue: row.potential_value ? parseFloat(row.potential_value) : null,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          actedOn: row.acted_upon,
          dismissed: row.dismissed,
        }
      }
    }

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    // Mark as read if not already
    if (!insight.readAt) {
      await query(
        `UPDATE wells_insights SET read_at = NOW() WHERE id = $1`,
        [id]
      )
      insight.readAt = new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      insight,
    })
  } catch (error) {
    console.error('[API] Error fetching insight:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insight' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update insight (mark as read, acted on, etc.)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { action, feedback } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action' },
        { status: 400 }
      )
    }

    let result: any = null

    switch (action) {
      case 'mark_read':
        // Mark insight as read
        await query(
          `UPDATE wells_insights SET read_at = NOW() WHERE id = $1 AND user_id = $2`,
          [id, userId]
        )
        // Also update legacy table
        await query(
          `UPDATE proactive_insights SET acted_upon = acted_upon WHERE id = $1 AND user_id = $2`,
          [id, userId]
        )
        result = { readAt: new Date().toISOString() }
        break

      case 'act':
        // Mark insight as acted upon
        await query(
          `UPDATE wells_insights
           SET acted_on = true, acted_on_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [id, userId]
        )
        // Also update legacy table
        await query(
          `UPDATE proactive_insights
           SET acted_upon = true, acted_upon_at = NOW(), action_taken = $3
           WHERE id = $1 AND user_id = $2`,
          [id, userId, body.actionTaken || 'acted']
        )

        // Record trust event
        await recordTrustEvent(userId, 'insight_acted_upon', {
          insightId: id,
        })

        result = { actedOn: true, actedOnAt: new Date().toISOString() }
        break

      case 'dismiss':
        // Dismiss the insight
        await query(
          `UPDATE wells_insights
           SET dismissed = true, dismissed_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [id, userId]
        )
        // Also update legacy table
        await query(
          `UPDATE proactive_insights
           SET dismissed = true, dismissed_at = NOW(), dismiss_reason = $3
           WHERE id = $1 AND user_id = $2`,
          [id, userId, body.reason || null]
        )

        result = { dismissed: true, dismissedAt: new Date().toISOString() }
        break

      case 'rate':
        // Rate the insight quality
        if (typeof feedback?.rating !== 'number' || feedback.rating < 1 || feedback.rating > 5) {
          return NextResponse.json(
            { error: 'Rating must be between 1 and 5' },
            { status: 400 }
          )
        }

        await query(
          `INSERT INTO insight_feedback (insight_id, user_id, rating, comment, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [id, userId, feedback.rating, feedback.comment || null]
        )

        result = { rated: true, rating: feedback.rating }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      insightId: id,
      action,
      result,
    })
  } catch (error) {
    console.error('[API] Error updating insight:', error)
    return NextResponse.json(
      { error: 'Failed to update insight' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Permanently delete an insight (admin only or dismiss)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Soft delete (mark as dismissed) rather than hard delete
    await query(
      `UPDATE wells_insights
       SET dismissed = true, dismissed_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )

    await query(
      `UPDATE proactive_insights
       SET dismissed = true, dismissed_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )

    return NextResponse.json({
      success: true,
      insightId: id,
      deleted: true,
    })
  } catch (error) {
    console.error('[API] Error deleting insight:', error)
    return NextResponse.json(
      { error: 'Failed to delete insight' },
      { status: 500 }
    )
  }
}
