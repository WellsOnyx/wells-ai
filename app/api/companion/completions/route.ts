// @ts-nocheck
/**
 * GET/POST /api/companion/completions
 *
 * Track and report completed actions to make Wells feel proactive.
 * Wells reports back on negotiations completed, orders delivered, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { query } from '@/lib/db'
import { trackCompletions } from '@/lib/companion/insight-engine'
import { notify, addToChatQueue } from '@/lib/companion/notification-hub'
import { recordValueDelivered, recordTrustEvent } from '@/lib/companion/trust-builder'

export interface CompletionEvent {
  type: 'negotiation' | 'order' | 'payment' | 'contract' | 'deal' | 'task' | 'insight_action'
  entityId: string
  status: 'completed' | 'failed' | 'partial'
  summary: string
  details?: Record<string, any>
  valueGenerated?: {
    type: 'savings' | 'earnings' | 'risk_avoided'
    amount: number
  }
  celebrationLevel?: 'none' | 'subtle' | 'moderate' | 'big'
}

/**
 * GET - Get recent completions for the user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const type = searchParams.get('type')
    const since = searchParams.get('since') // ISO date string

    // Get completion insights from the insight engine
    const completionInsights = await trackCompletions(userId)

    // Also fetch from completions table if it exists
    let dbCompletions = []
    try {
      let whereConditions = ['user_id = $1']
      const params: any[] = [userId]
      let paramIndex = 2

      if (type) {
        whereConditions.push(`type = $${paramIndex++}`)
        params.push(type)
      }

      if (since) {
        whereConditions.push(`completed_at >= $${paramIndex++}`)
        params.push(new Date(since))
      }

      const result = await query(
        `SELECT * FROM action_completions
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY completed_at DESC
         LIMIT $${paramIndex}`,
        [...params, limit]
      )

      dbCompletions = result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        entityId: row.entity_id,
        status: row.status,
        summary: row.summary,
        details: row.details,
        valueGenerated: row.value_generated,
        completedAt: new Date(row.completed_at),
      }))
    } catch (e) {
      // Table may not exist
    }

    // Calculate totals
    const totalValue = dbCompletions.reduce(
      (sum, c) => sum + (c.valueGenerated?.amount || 0),
      0
    )

    return NextResponse.json({
      success: true,
      completions: {
        recent: dbCompletions,
        insights: completionInsights,
      },
      summary: {
        count: dbCompletions.length,
        totalValue,
        byType: dbCompletions.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },
    })
  } catch (error) {
    console.error('[API] Error getting completions:', error)
    return NextResponse.json(
      { error: 'Failed to get completions' },
      { status: 500 }
    )
  }
}

/**
 * POST - Record a new completion event
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const event: CompletionEvent = body

    if (!event.type || !event.entityId || !event.summary) {
      return NextResponse.json(
        { error: 'Missing required fields: type, entityId, summary' },
        { status: 400 }
      )
    }

    const completionId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store the completion
    try {
      await query(
        `INSERT INTO action_completions (
          id, user_id, type, entity_id, status, summary, details, value_generated, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          completionId,
          userId,
          event.type,
          event.entityId,
          event.status,
          event.summary,
          event.details ? JSON.stringify(event.details) : null,
          event.valueGenerated ? JSON.stringify(event.valueGenerated) : null,
        ]
      )
    } catch (e) {
      // Table may not exist, continue anyway
      console.log('[API] Could not store completion in DB, continuing...')
    }

    // Record value if generated
    if (event.valueGenerated && event.status === 'completed') {
      const valueTypeMap: Record<string, 'saved' | 'earned' | 'risk_avoided'> = {
        savings: 'saved',
        earnings: 'earned',
        risk_avoided: 'risk_avoided',
      }

      await recordValueDelivered(
        userId,
        valueTypeMap[event.valueGenerated.type] || 'saved',
        event.valueGenerated.amount,
        { eventType: event.type, entityId: event.entityId }
      )
    }

    // Record trust event for successful completion
    if (event.status === 'completed') {
      await recordTrustEvent(userId, 'deal_completed', {
        type: event.type,
        entityId: event.entityId,
        value: event.valueGenerated?.amount || 0,
      })
    }

    // Build notification message based on completion type and celebration level
    let notificationMessage = event.summary
    let priority: 'info' | 'low' | 'medium' | 'high' = 'info'

    if (event.status === 'completed') {
      if (event.valueGenerated) {
        const valueStr = `$${event.valueGenerated.amount.toLocaleString()}`
        switch (event.valueGenerated.type) {
          case 'savings':
            notificationMessage = `${event.summary} - saved ${valueStr}!`
            priority = event.valueGenerated.amount > 5000 ? 'medium' : 'low'
            break
          case 'earnings':
            notificationMessage = `${event.summary} - earned ${valueStr}!`
            priority = event.valueGenerated.amount > 5000 ? 'medium' : 'low'
            break
          case 'risk_avoided':
            notificationMessage = `${event.summary} - ${valueStr} risk avoided.`
            priority = 'medium'
            break
        }
      }

      // Add to chat queue for proactive notification
      await addToChatQueue(userId, {
        type: 'completion',
        priority,
        message: notificationMessage,
        detailedMessage: event.details ? JSON.stringify(event.details) : undefined,
        actions: [
          {
            id: `view_${event.type}_${event.entityId}`,
            label: 'View Details',
            actionType: 'navigation',
            data: { type: event.type, id: event.entityId },
          },
        ],
      })
    } else if (event.status === 'failed') {
      // Notify about failures
      await notify(userId, {
        type: 'alert',
        priority: 'high',
        message: `${event.type} action failed: ${event.summary}`,
        detailedMessage: event.details?.error || 'An unexpected error occurred',
        suggestedActions: [
          {
            id: `retry_${event.type}_${event.entityId}`,
            label: 'Retry',
            actionType: 'api_call',
            data: { type: event.type, id: event.entityId },
          },
        ],
      })
    }

    return NextResponse.json({
      success: true,
      completionId,
      recorded: {
        type: event.type,
        status: event.status,
        valueGenerated: event.valueGenerated,
        notified: true,
      },
    })
  } catch (error) {
    console.error('[API] Error recording completion:', error)
    return NextResponse.json(
      { error: 'Failed to record completion' },
      { status: 500 }
    )
  }
}

/**
 * Record a batch of completions (for background jobs)
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { events }: { events: CompletionEvent[] } = body

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: 'events must be an array' },
        { status: 400 }
      )
    }

    const results = {
      recorded: 0,
      failed: 0,
      totalValue: 0,
    }

    for (const event of events) {
      try {
        const completionId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await query(
          `INSERT INTO action_completions (
            id, user_id, type, entity_id, status, summary, details, value_generated, completed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT DO NOTHING`,
          [
            completionId,
            userId,
            event.type,
            event.entityId,
            event.status,
            event.summary,
            event.details ? JSON.stringify(event.details) : null,
            event.valueGenerated ? JSON.stringify(event.valueGenerated) : null,
          ]
        )

        results.recorded++

        if (event.valueGenerated) {
          results.totalValue += event.valueGenerated.amount
        }
      } catch (e) {
        results.failed++
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error('[API] Error in batch completion:', error)
    return NextResponse.json(
      { error: 'Failed to process batch completions' },
      { status: 500 }
    )
  }
}
