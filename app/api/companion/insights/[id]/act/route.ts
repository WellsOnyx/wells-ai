// @ts-nocheck
/**
 * POST /api/companion/insights/[id]/act
 *
 * Take action on an insight - mark as acted upon or dismissed
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { query } from '@/lib/db'
import { markInsightActedUpon, dismissInsight } from '@/lib/companion/insight-engine'
import { recordTrustEvent } from '@/lib/companion/trust-builder'
import { deliverInsight } from '@/lib/companion/notification-hub'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const insightId = params.id
    const body = await req.json()
    const { action, actionId, dismissReason, feedback } = body

    // Verify insight belongs to user
    const insightResult = await query(
      'SELECT * FROM proactive_insights WHERE id = $1 AND user_id = $2',
      [insightId, userId]
    )

    if (insightResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      )
    }

    const insight = insightResult.rows[0]

    // Handle different actions
    switch (action) {
      case 'dismiss':
        await dismissInsight(insightId, dismissReason)
        await recordTrustEvent(userId, 'insight_dismissed', {
          insightId,
          category: insight.category,
          reason: dismissReason,
        })

        return NextResponse.json({
          success: true,
          action: 'dismissed',
          message: 'Insight dismissed',
        })

      case 'act':
        // Find the specific action
        const actions = insight.action_options || []
        const selectedAction = actions.find((a: any) => a.id === actionId)

        if (!selectedAction) {
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          )
        }

        let result: any = {}

        // Handle different action types
        switch (selectedAction.actionType) {
          case 'ai_task':
            result = await executeAITask(
              selectedAction.aiTaskDescription,
              insight,
              userId
            )
            break

          case 'navigation':
            result = {
              type: 'navigation',
              url: selectedAction.navigationUrl,
            }
            break

          case 'confirm':
            result = await executeConfirmAction(
              insightId,
              selectedAction,
              insight
            )
            break

          case 'schedule':
            result = await scheduleFollowUp(insightId, body.scheduleTime)
            break

          case 'api_call':
            result = await executeAPICall(
              selectedAction.endpoint,
              selectedAction.payload
            )
            break
        }

        // Mark as acted upon
        await markInsightActedUpon(insightId, actionId)

        // Record trust event
        await recordTrustEvent(userId, 'insight_acted_upon', {
          insightId,
          actionId,
          category: insight.category,
          potentialValue: insight.potential_value,
        })

        return NextResponse.json({
          success: true,
          action: 'acted',
          actionType: selectedAction.actionType,
          result,
        })

      case 'snooze':
        const snoozeUntil = new Date(
          Date.now() + (body.snoozeHours || 24) * 60 * 60 * 1000
        )

        await query(
          `UPDATE proactive_insights
           SET expires_at = $2
           WHERE id = $1`,
          [insightId, snoozeUntil]
        )

        return NextResponse.json({
          success: true,
          action: 'snoozed',
          snoozeUntil,
        })

      case 'feedback':
        // Record feedback on insight quality
        await query(
          `INSERT INTO insight_feedback (insight_id, user_id, rating, comment, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [insightId, userId, feedback.rating, feedback.comment]
        )

        // Record trust event based on feedback
        if (feedback.rating >= 4) {
          await recordTrustEvent(userId, 'positive_feedback', {
            insightId,
            rating: feedback.rating,
          })
        } else if (feedback.rating <= 2) {
          await recordTrustEvent(userId, 'negative_feedback', {
            insightId,
            rating: feedback.rating,
          })
        }

        return NextResponse.json({
          success: true,
          action: 'feedback_recorded',
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[API] Error acting on insight:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}

/**
 * Execute an AI task based on the action description
 */
async function executeAITask(
  taskDescription: string,
  insight: any,
  userId: string
): Promise<any> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `You are Wells AI, a proactive business companion. A user has asked you to:
"${taskDescription}"

Context from the insight:
- Title: ${insight.title}
- Message: ${insight.message}
- Category: ${insight.category}
- Potential Value: $${insight.potential_value?.toLocaleString() || 'Unknown'}
- Data Points: ${JSON.stringify(insight.data_points || {})}

Provide a helpful, actionable response. Be specific and include next steps.`,
        },
      ],
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    const aiResponse = textBlock?.type === 'text' ? textBlock.text : 'Task completed.'

    // Store the AI response
    await query(
      `INSERT INTO insight_ai_responses (insight_id, user_id, task, response, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [insight.id, userId, taskDescription, aiResponse]
    )

    return {
      type: 'ai_response',
      response: aiResponse,
      taskDescription,
    }
  } catch (error) {
    console.error('[API] AI task execution failed:', error)
    return {
      type: 'ai_response',
      error: 'Failed to execute AI task',
    }
  }
}

/**
 * Execute a confirmation action
 */
async function executeConfirmAction(
  insightId: string,
  action: any,
  insight: any
): Promise<any> {
  // Record the confirmation
  await query(
    `INSERT INTO insight_confirmations (insight_id, action_id, confirmed_at)
     VALUES ($1, $2, NOW())`,
    [insightId, action.id]
  )

  return {
    type: 'confirmed',
    message: action.confirmMessage || 'Action confirmed',
  }
}

/**
 * Schedule a follow-up for the insight
 */
async function scheduleFollowUp(
  insightId: string,
  scheduleTime?: string
): Promise<any> {
  const followUpTime = scheduleTime
    ? new Date(scheduleTime)
    : new Date(Date.now() + 24 * 60 * 60 * 1000) // Default: 24 hours

  await query(
    `INSERT INTO scheduled_deliveries (insight_id, scheduled_for, status)
     VALUES ($1, $2, 'scheduled')`,
    [insightId, followUpTime]
  )

  return {
    type: 'scheduled',
    followUpTime,
  }
}

/**
 * Execute an API call action
 */
async function executeAPICall(
  endpoint: string,
  payload: any
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    return {
      type: 'api_response',
      success: response.ok,
      data,
    }
  } catch (error) {
    console.error('[API] API call failed:', error)
    return {
      type: 'api_response',
      success: false,
      error: 'API call failed',
    }
  }
}
