// @ts-nocheck
/**
 * Wells AI Proactive Outreach System
 *
 * "The sluggard craves and gets nothing, but the desires of the diligent
 * are fully satisfied." - Proverbs 13:4
 *
 * Wells doesn't just wait to be asked - Wells reaches out with opportunities,
 * warnings, celebrations, and helpful reminders. Like Ghost from Destiny,
 * Wells speaks up when there's something important to share.
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { getCompanionRelationship, canActAutonomously } from './relationship'
import { getDeepMemory, getGoals, getImportantDates } from './memory'
import { generateProactiveMessage } from './voice'
import { addToChatQueue } from './notification-hub'
import { getPresence, setActivity } from './presence'

// ============================================================================
// TYPES
// ============================================================================

export interface ProactiveOutreach {
  id: string
  userId: string
  type: OutreachType
  trigger: OutreachTrigger
  priority: 'critical' | 'high' | 'medium' | 'low' | 'info'
  message: string
  detailedMessage?: string
  suggestedActions?: OutreachAction[]
  value?: number
  valueType?: 'savings' | 'revenue' | 'risk' | 'time'
  relatedEntityId?: string
  relatedEntityType?: string
  expiresAt?: Date
  createdAt: Date
  deliveredAt?: Date
  userResponse?: 'acted' | 'dismissed' | 'snoozed' | 'ignored'
  responseAt?: Date
}

export type OutreachType =
  | 'morning_briefing'
  | 'opportunity_alert'
  | 'warning_alert'
  | 'celebration'
  | 'reminder'
  | 'milestone'
  | 'check_in'
  | 'insight_ready'
  | 'deal_update'
  | 'contract_expiry'
  | 'goal_progress'
  | 'relationship_nudge'

export interface OutreachTrigger {
  type: 'scheduled' | 'event' | 'condition' | 'pattern'
  source: string
  details?: Record<string, any>
}

export interface OutreachAction {
  id: string
  label: string
  type: 'navigate' | 'action' | 'snooze' | 'dismiss'
  target?: string
  data?: Record<string, any>
  isPrimary?: boolean
}

export interface OutreachSchedule {
  userId: string
  morningBriefing: {
    enabled: boolean
    time: string // HH:MM
    days: number[] // 0-6 (Sunday-Saturday)
  }
  checkIns: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'as_needed'
    lastCheckIn?: Date
  }
  celebrations: {
    enabled: boolean
    minValueToShare: number
  }
  warnings: {
    enabled: boolean
    urgencyThreshold: 'critical' | 'high' | 'medium' | 'all'
  }
  opportunities: {
    enabled: boolean
    minValueToShare: number
  }
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// PROACTIVE TRIGGERS
// ============================================================================

/**
 * Generate morning briefing for a user
 */
export async function generateMorningBriefing(userId: string): Promise<ProactiveOutreach | null> {
  try {
    const relationship = await getCompanionRelationship(userId)
    const memory = await getDeepMemory(userId)
    const presence = await getPresence(userId)

    // Check if proactive outreach is allowed
    const canReach = await canActAutonomously(userId, { type: 'reach_out' })
    if (!canReach.allowed) return null

    // Set activity
    await setActivity(userId, {
      type: 'analyzing',
      description: 'Preparing your morning briefing',
    })

    // Gather briefing data
    const [
      pendingDeals,
      urgentInsights,
      todayDates,
      activeGoals,
      recentCompletions,
    ] = await Promise.all([
      getPendingDeals(userId),
      getUrgentInsights(userId),
      getTodaysImportantDates(userId),
      getActiveGoalsProgress(userId),
      getRecentCompletions(userId),
    ])

    // Use AI to generate personalized briefing
    const briefingPrompt = `Generate a warm, personalized morning briefing for a business user. Keep it concise but comprehensive.

User context:
- Trust level: ${relationship.trustTier}
- Days together: ${relationship.daysTogether}
- Communication style: ${memory?.communicationStyle?.tone || 'friendly'}

Today's data:
${pendingDeals.length > 0 ? `- ${pendingDeals.length} deals need attention` : ''}
${urgentInsights.length > 0 ? `- ${urgentInsights.length} urgent insights` : ''}
${todayDates.length > 0 ? `- Important dates: ${todayDates.map((d) => d.title).join(', ')}` : ''}
${activeGoals.length > 0 ? `- Active goals: ${activeGoals.map((g) => `${g.title} (${g.progress}%)`).join(', ')}` : ''}
${recentCompletions.length > 0 ? `- Recent wins: ${recentCompletions.slice(0, 2).map((c) => c.description).join(', ')}` : ''}

Format:
- Start with a warm, personalized greeting
- Highlight the most important 2-3 items for today
- End with an encouraging note
- Keep it under 150 words
- Sound like a helpful, trusted companion`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: briefingPrompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    const briefingMessage = textBlock.text

    // Create outreach
    const outreach = await createOutreach(userId, {
      type: 'morning_briefing',
      trigger: { type: 'scheduled', source: 'morning_briefing' },
      priority: 'medium',
      message: briefingMessage,
      suggestedActions: [
        { id: 'view_deals', label: 'View Deals', type: 'navigate', target: '/deals', isPrimary: true },
        { id: 'view_insights', label: 'See Insights', type: 'navigate', target: '/insights' },
      ],
    })

    return outreach
  } catch (error) {
    console.error('[Proactive] Error generating morning briefing:', error)
    return null
  }
}

/**
 * Generate opportunity alert
 */
export async function generateOpportunityAlert(
  userId: string,
  opportunity: {
    title: string
    description: string
    value: number
    valueType: 'savings' | 'revenue'
    entityType: string
    entityId: string
    expiresAt?: Date
  }
): Promise<ProactiveOutreach | null> {
  try {
    const canReach = await canActAutonomously(userId, { type: 'reach_out' })
    if (!canReach.allowed) return null

    await setActivity(userId, {
      type: 'scanning',
      description: `Found opportunity: ${opportunity.title}`,
    })

    const message = await generateProactiveMessage(
      userId,
      'opportunity',
      `**${opportunity.title}**\n\n${opportunity.description}`,
      opportunity.value
    )

    const outreach = await createOutreach(userId, {
      type: 'opportunity_alert',
      trigger: { type: 'event', source: 'opportunity_detected', details: opportunity },
      priority: opportunity.value > 10000 ? 'high' : 'medium',
      message,
      value: opportunity.value,
      valueType: opportunity.valueType,
      relatedEntityType: opportunity.entityType,
      relatedEntityId: opportunity.entityId,
      expiresAt: opportunity.expiresAt,
      suggestedActions: [
        { id: 'take_action', label: 'Take Action', type: 'action', data: opportunity, isPrimary: true },
        { id: 'snooze', label: 'Remind Me Later', type: 'snooze' },
        { id: 'dismiss', label: 'Not Interested', type: 'dismiss' },
      ],
    })

    return outreach
  } catch (error) {
    console.error('[Proactive] Error generating opportunity alert:', error)
    return null
  }
}

/**
 * Generate warning alert
 */
export async function generateWarningAlert(
  userId: string,
  warning: {
    title: string
    description: string
    riskValue: number
    severity: 'critical' | 'high' | 'medium'
    entityType: string
    entityId: string
    deadline?: Date
  }
): Promise<ProactiveOutreach | null> {
  try {
    // Warnings bypass proactive permission for critical issues
    if (warning.severity !== 'critical') {
      const canReach = await canActAutonomously(userId, { type: 'reach_out' })
      if (!canReach.allowed) return null
    }

    await setActivity(userId, {
      type: 'protecting',
      description: `Flagging issue: ${warning.title}`,
    })

    const message = await generateProactiveMessage(
      userId,
      'warning',
      `**${warning.title}**\n\n${warning.description}`,
      warning.riskValue
    )

    const outreach = await createOutreach(userId, {
      type: 'warning_alert',
      trigger: { type: 'event', source: 'warning_detected', details: warning },
      priority: warning.severity,
      message,
      value: warning.riskValue,
      valueType: 'risk',
      relatedEntityType: warning.entityType,
      relatedEntityId: warning.entityId,
      expiresAt: warning.deadline,
      suggestedActions: [
        { id: 'address_now', label: 'Address Now', type: 'action', data: warning, isPrimary: true },
        { id: 'view_details', label: 'View Details', type: 'navigate', target: `/${warning.entityType}/${warning.entityId}` },
      ],
    })

    return outreach
  } catch (error) {
    console.error('[Proactive] Error generating warning alert:', error)
    return null
  }
}

/**
 * Generate celebration message
 */
export async function generateCelebration(
  userId: string,
  win: {
    title: string
    description: string
    value: number
    valueType: 'savings' | 'revenue'
    wellsContribution?: string
  }
): Promise<ProactiveOutreach | null> {
  try {
    const relationship = await getCompanionRelationship(userId)

    await setActivity(userId, {
      type: 'celebrating',
      description: `Celebrating: ${win.title}`,
    })

    const message = await generateProactiveMessage(
      userId,
      'celebration',
      `**${win.title}**\n\n${win.description}${win.wellsContribution ? `\n\n_My contribution: ${win.wellsContribution}_` : ''}`,
      win.value
    )

    const outreach = await createOutreach(userId, {
      type: 'celebration',
      trigger: { type: 'event', source: 'win_detected', details: win },
      priority: 'info',
      message,
      value: win.value,
      valueType: win.valueType,
      suggestedActions: [
        { id: 'share', label: 'Share This Win', type: 'action', isPrimary: true },
        { id: 'find_more', label: 'Find More Opportunities', type: 'navigate', target: '/opportunities' },
      ],
    })

    // Record as value delivered
    if (relationship) {
      await recordValueDelivered(userId, win.value, win.valueType)
    }

    return outreach
  } catch (error) {
    console.error('[Proactive] Error generating celebration:', error)
    return null
  }
}

/**
 * Generate reminder for important date
 */
export async function generateReminder(
  userId: string,
  reminder: {
    title: string
    description: string
    date: Date
    type: string
    relatedEntityType?: string
    relatedEntityId?: string
    actionRequired?: string
  }
): Promise<ProactiveOutreach | null> {
  try {
    const canReach = await canActAutonomously(userId, { type: 'reach_out' })
    if (!canReach.allowed) return null

    const daysUntil = Math.ceil((reminder.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const urgency = daysUntil <= 1 ? 'critical' : daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low'

    const message = await generateProactiveMessage(
      userId,
      'reminder' as any,
      `**${reminder.title}**\n\n${reminder.description}\n\n_${daysUntil} days remaining_${reminder.actionRequired ? `\n\nAction needed: ${reminder.actionRequired}` : ''}`,
      undefined
    )

    const outreach = await createOutreach(userId, {
      type: 'reminder',
      trigger: { type: 'scheduled', source: 'date_reminder', details: reminder },
      priority: urgency,
      message,
      expiresAt: reminder.date,
      relatedEntityType: reminder.relatedEntityType,
      relatedEntityId: reminder.relatedEntityId,
      suggestedActions: [
        { id: 'take_action', label: reminder.actionRequired || 'Take Action', type: 'action', isPrimary: true },
        { id: 'snooze_day', label: 'Remind Tomorrow', type: 'snooze', data: { days: 1 } },
        { id: 'done', label: "I've Handled It", type: 'dismiss' },
      ],
    })

    return outreach
  } catch (error) {
    console.error('[Proactive] Error generating reminder:', error)
    return null
  }
}

/**
 * Generate check-in message
 */
export async function generateCheckIn(userId: string): Promise<ProactiveOutreach | null> {
  try {
    const relationship = await getCompanionRelationship(userId)
    const canReach = await canActAutonomously(userId, { type: 'reach_out' })
    if (!canReach.allowed) return null

    const presence = await getPresence(userId)
    const hoursSinceLastSeen = (Date.now() - presence.lastSeen.getTime()) / (1000 * 60 * 60)

    // Only check in if it's been a while
    if (hoursSinceLastSeen < 48) return null

    await setActivity(userId, {
      type: 'monitoring',
      description: 'Checking in on you',
    })

    // Generate personalized check-in based on relationship depth
    const checkInMessages: Record<string, string[]> = {
      new_acquaintance: [
        "Just checking in to see if there's anything I can help with.",
        'Is there something you need assistance with?',
      ],
      developing: [
        "Been a little while - hope everything is going well!",
        'Wanted to see how things are going on your end.',
      ],
      established: [
        "Hey! I've been monitoring things while you were away. Everything looks good.",
        "Haven't heard from you in a bit. Just wanted to make sure everything's alright.",
      ],
      trusted_partner: [
        "Miss working with you! Things are running smoothly on my end.",
        "It's been quiet - hope that's a good thing! I'm here when you need me.",
      ],
      guardian: [
        "I've been keeping watch. No major issues, but I have some opportunities ready when you are.",
        "Everything's under control. Got some good updates for you when you have a moment.",
      ],
    }

    const messages = checkInMessages[relationship.trustTier] || checkInMessages.developing
    const message = messages[Math.floor(Math.random() * messages.length)]

    const outreach = await createOutreach(userId, {
      type: 'check_in',
      trigger: { type: 'condition', source: 'inactivity', details: { hours: hoursSinceLastSeen } },
      priority: 'info',
      message,
      suggestedActions: [
        { id: 'chat', label: 'Let\'s Chat', type: 'navigate', target: '/chat', isPrimary: true },
        { id: 'view_updates', label: 'View Updates', type: 'navigate', target: '/updates' },
      ],
    })

    return outreach
  } catch (error) {
    console.error('[Proactive] Error generating check-in:', error)
    return null
  }
}

/**
 * Generate goal progress update
 */
export async function generateGoalProgressUpdate(
  userId: string,
  goalId: string
): Promise<ProactiveOutreach | null> {
  try {
    const canReach = await canActAutonomously(userId, { type: 'reach_out' })
    if (!canReach.allowed) return null

    const goals = await getGoals(userId)
    const goal = goals.find((g) => g.id === goalId)
    if (!goal) return null

    await setActivity(userId, {
      type: 'analyzing',
      description: `Analyzing progress on: ${goal.title}`,
    })

    const progressEmoji = goal.progress >= 100 ? 'Trophy' : goal.progress >= 75 ? 'Almost there' : goal.progress >= 50 ? 'Halfway!' : goal.progress >= 25 ? 'Making progress' : 'Just started'

    let message: string

    if (goal.progress >= 100) {
      message = await generateProactiveMessage(
        userId,
        'celebration',
        `**Goal Achieved: ${goal.title}**\n\nYou did it! This goal is complete.`,
        goal.targetValue
      )
    } else {
      const blockerNote = goal.blockers.length > 0 ? `\n\nCurrent blockers: ${goal.blockers.join(', ')}` : ''
      const nextStepsNote = goal.nextSteps.length > 0 ? `\n\nNext steps: ${goal.nextSteps.slice(0, 2).join(', ')}` : ''

      message = `**${progressEmoji}: ${goal.title}**\n\nProgress: ${goal.progress}%${goal.targetValue ? ` ($${goal.currentValue.toLocaleString()} of $${goal.targetValue.toLocaleString()})` : ''}${blockerNote}${nextStepsNote}`
    }

    const outreach = await createOutreach(userId, {
      type: 'goal_progress',
      trigger: { type: 'event', source: 'goal_update', details: { goalId } },
      priority: goal.progress >= 100 ? 'medium' : 'low',
      message,
      relatedEntityType: 'goal',
      relatedEntityId: goalId,
      suggestedActions: [
        { id: 'view_goal', label: 'View Goal', type: 'navigate', target: `/goals/${goalId}`, isPrimary: true },
        { id: 'update_progress', label: 'Update Progress', type: 'action', data: { goalId } },
      ],
    })

    return outreach
  } catch (error) {
    console.error('[Proactive] Error generating goal update:', error)
    return null
  }
}

/**
 * Generate relationship nudge (remind to reach out to a contact)
 */
export async function generateRelationshipNudge(
  userId: string,
  relationshipId: string,
  relationshipName: string,
  daysSinceContact: number
): Promise<ProactiveOutreach | null> {
  try {
    const canReach = await canActAutonomously(userId, { type: 'reach_out' })
    if (!canReach.allowed) return null

    const nudgeMessages = [
      `It's been ${daysSinceContact} days since you connected with ${relationshipName}. Worth a quick check-in?`,
      `${relationshipName} hasn't heard from you in a while. A quick message could strengthen this relationship.`,
      `Reminder: ${relationshipName} - it's been ${daysSinceContact} days. Relationships need nurturing!`,
    ]

    const message = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)]

    const outreach = await createOutreach(userId, {
      type: 'relationship_nudge',
      trigger: { type: 'condition', source: 'relationship_inactive', details: { relationshipId, days: daysSinceContact } },
      priority: daysSinceContact > 60 ? 'medium' : 'low',
      message,
      relatedEntityType: 'relationship',
      relatedEntityId: relationshipId,
      suggestedActions: [
        { id: 'send_message', label: 'Draft Message', type: 'action', data: { relationshipId }, isPrimary: true },
        { id: 'schedule_call', label: 'Schedule Call', type: 'action', data: { relationshipId } },
        { id: 'snooze', label: 'Remind Later', type: 'snooze' },
      ],
    })

    return outreach
  } catch (error) {
    console.error('[Proactive] Error generating relationship nudge:', error)
    return null
  }
}

// ============================================================================
// OUTREACH MANAGEMENT
// ============================================================================

/**
 * Create and store an outreach
 */
async function createOutreach(
  userId: string,
  data: Omit<ProactiveOutreach, 'id' | 'userId' | 'createdAt'>
): Promise<ProactiveOutreach> {
  const outreachId = `outreach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const outreach: ProactiveOutreach = {
    ...data,
    id: outreachId,
    userId,
    createdAt: new Date(),
  }

  try {
    await query(
      `INSERT INTO proactive_outreach (
        id, user_id, type, trigger, priority, message, detailed_message,
        suggested_actions, value, value_type, related_entity_id, related_entity_type,
        expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        outreachId,
        userId,
        data.type,
        JSON.stringify(data.trigger),
        data.priority,
        data.message,
        data.detailedMessage,
        JSON.stringify(data.suggestedActions || []),
        data.value,
        data.valueType,
        data.relatedEntityId,
        data.relatedEntityType,
        data.expiresAt,
      ]
    )

    // Add to chat queue for delivery
    await addToChatQueue(userId, {
      type: mapOutreachTypeToQueueType(data.type),
      priority: data.priority,
      message: data.message,
      detailedMessage: data.detailedMessage,
      actions: data.suggestedActions?.map((a) => ({
        id: a.id,
        label: a.label,
        actionType: a.type,
        data: a.data,
      })),
      expiresAt: data.expiresAt,
    })

    return outreach
  } catch (error) {
    console.error('[Proactive] Error creating outreach:', error)
    return outreach
  }
}

/**
 * Record user response to outreach
 */
export async function recordOutreachResponse(
  outreachId: string,
  response: 'acted' | 'dismissed' | 'snoozed' | 'ignored'
): Promise<void> {
  try {
    await query(
      `UPDATE proactive_outreach SET
        user_response = $2,
        response_at = NOW()
       WHERE id = $1`,
      [outreachId, response]
    )

    // Update relationship based on response
    const result = await query(
      `SELECT user_id, type, value, value_type FROM proactive_outreach WHERE id = $1`,
      [outreachId]
    )

    if (result.rows.length > 0) {
      const { user_id, type, value, value_type } = result.rows[0]

      if (response === 'acted' && value && value_type) {
        await recordValueDelivered(user_id, parseFloat(value), value_type)
      }
    }
  } catch (error) {
    console.error('[Proactive] Error recording outreach response:', error)
  }
}

/**
 * Get pending outreaches for a user
 */
export async function getPendingOutreaches(userId: string): Promise<ProactiveOutreach[]> {
  try {
    const result = await query(
      `SELECT * FROM proactive_outreach
       WHERE user_id = $1
         AND user_response IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY
         CASE priority
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         created_at DESC
       LIMIT 20`,
      [userId]
    )

    return result.rows.map(rowToOutreach)
  } catch (error) {
    console.error('[Proactive] Error getting pending outreaches:', error)
    return []
  }
}

// ============================================================================
// SCHEDULED OUTREACH RUNNER
// ============================================================================

/**
 * Run scheduled outreach checks for all users
 */
export async function runScheduledOutreach(): Promise<{
  usersProcessed: number
  outreachesSent: number
}> {
  let usersProcessed = 0
  let outreachesSent = 0

  try {
    // Get users who need processing
    const usersResult = await query(
      `SELECT DISTINCT user_id FROM companion_relationships
       WHERE last_updated > NOW() - INTERVAL '30 days'`
    )

    for (const row of usersResult.rows) {
      const userId = row.user_id

      try {
        usersProcessed++

        // Check for morning briefing (if it's morning in user's timezone)
        const shouldSendBriefing = await shouldSendMorningBriefing(userId)
        if (shouldSendBriefing) {
          const briefing = await generateMorningBriefing(userId)
          if (briefing) outreachesSent++
        }

        // Check for reminders
        const dueReminders = await getDueReminders(userId)
        for (const reminder of dueReminders) {
          const outreach = await generateReminder(userId, reminder)
          if (outreach) outreachesSent++
        }

        // Check for relationship nudges
        const staleRelationships = await getStaleRelationships(userId)
        for (const rel of staleRelationships.slice(0, 2)) {
          const outreach = await generateRelationshipNudge(userId, rel.id, rel.name, rel.daysSinceContact)
          if (outreach) outreachesSent++
        }

        // Check for check-ins
        const shouldCheckIn = await shouldSendCheckIn(userId)
        if (shouldCheckIn) {
          const checkIn = await generateCheckIn(userId)
          if (checkIn) outreachesSent++
        }
      } catch (userError) {
        console.error(`[Proactive] Error processing user ${userId}:`, userError)
      }
    }

    return { usersProcessed, outreachesSent }
  } catch (error) {
    console.error('[Proactive] Error running scheduled outreach:', error)
    return { usersProcessed, outreachesSent }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapOutreachTypeToQueueType(type: OutreachType): 'insight' | 'completion' | 'reminder' | 'celebration' | 'alert' | 'update' {
  const mapping: Record<OutreachType, 'insight' | 'completion' | 'reminder' | 'celebration' | 'alert' | 'update'> = {
    morning_briefing: 'update',
    opportunity_alert: 'insight',
    warning_alert: 'alert',
    celebration: 'celebration',
    reminder: 'reminder',
    milestone: 'celebration',
    check_in: 'update',
    insight_ready: 'insight',
    deal_update: 'update',
    contract_expiry: 'alert',
    goal_progress: 'update',
    relationship_nudge: 'reminder',
  }
  return mapping[type] || 'update'
}

function rowToOutreach(row: any): ProactiveOutreach {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    trigger: row.trigger,
    priority: row.priority,
    message: row.message,
    detailedMessage: row.detailed_message,
    suggestedActions: row.suggested_actions || [],
    value: row.value ? parseFloat(row.value) : undefined,
    valueType: row.value_type,
    relatedEntityId: row.related_entity_id,
    relatedEntityType: row.related_entity_type,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    createdAt: new Date(row.created_at),
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
    userResponse: row.user_response,
    responseAt: row.response_at ? new Date(row.response_at) : undefined,
  }
}

async function recordValueDelivered(
  userId: string,
  value: number,
  valueType: string
): Promise<void> {
  try {
    await query(
      `UPDATE companion_relationships SET
        total_value_delivered = total_value_delivered + $2,
        value_breakdown = jsonb_set(
          value_breakdown,
          '{${valueType}}',
          (COALESCE((value_breakdown->>'${valueType}')::numeric, 0) + $2)::text::jsonb
        ),
        last_updated = NOW()
       WHERE user_id = $1`,
      [userId, value]
    )
  } catch (error) {
    console.error('[Proactive] Error recording value delivered:', error)
  }
}

async function getPendingDeals(userId: string): Promise<any[]> {
  try {
    const result = await query(
      `SELECT id, title, value, stage FROM deals
       WHERE user_id = $1 AND status NOT IN ('closed', 'lost')
       ORDER BY updated_at DESC LIMIT 5`,
      [userId]
    )
    return result.rows
  } catch {
    return []
  }
}

async function getUrgentInsights(userId: string): Promise<any[]> {
  try {
    const result = await query(
      `SELECT id, title, urgency FROM proactive_insights
       WHERE user_id = $1 AND acted_upon = false AND dismissed = false
         AND urgency IN ('critical', 'high')
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    )
    return result.rows
  } catch {
    return []
  }
}

async function getTodaysImportantDates(userId: string): Promise<any[]> {
  try {
    const dates = await getImportantDates(userId)
    const today = new Date()
    return dates.filter((d) => {
      const dateOnly = new Date(d.date)
      return (
        dateOnly.getDate() === today.getDate() &&
        dateOnly.getMonth() === today.getMonth()
      )
    })
  } catch {
    return []
  }
}

async function getActiveGoalsProgress(userId: string): Promise<any[]> {
  try {
    const goals = await getGoals(userId)
    return goals.filter((g) => g.status === 'active').slice(0, 3)
  } catch {
    return []
  }
}

async function getRecentCompletions(userId: string): Promise<any[]> {
  try {
    const result = await query(
      `SELECT id, description, value, completed_at FROM wells_activity_log
       WHERE user_id = $1 AND status = 'completed'
         AND completed_at > NOW() - INTERVAL '24 hours'
       ORDER BY completed_at DESC LIMIT 5`,
      [userId]
    )
    return result.rows
  } catch {
    return []
  }
}

async function shouldSendMorningBriefing(userId: string): Promise<boolean> {
  try {
    // Check if already sent today
    const result = await query(
      `SELECT id FROM proactive_outreach
       WHERE user_id = $1 AND type = 'morning_briefing'
         AND created_at > CURRENT_DATE
       LIMIT 1`,
      [userId]
    )
    if (result.rows.length > 0) return false

    // Check if it's morning (simplified - would need user timezone)
    const hour = new Date().getHours()
    return hour >= 6 && hour <= 10
  } catch {
    return false
  }
}

async function getDueReminders(userId: string): Promise<any[]> {
  try {
    const dates = await getImportantDates(userId)
    const now = new Date()
    const dueReminders = dates.filter((d) => {
      const daysUntil = Math.ceil((d.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return d.reminderDays.includes(daysUntil) && daysUntil > 0
    })
    return dueReminders.slice(0, 3)
  } catch {
    return []
  }
}

async function getStaleRelationships(userId: string): Promise<any[]> {
  try {
    const result = await query(
      `SELECT id, name, last_contact,
        EXTRACT(DAY FROM NOW() - last_contact) as days_since_contact
       FROM relationship_memories
       WHERE user_id = $1
         AND last_contact < NOW() - INTERVAL '30 days'
       ORDER BY last_contact ASC
       LIMIT 5`,
      [userId]
    )
    return result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      daysSinceContact: parseInt(r.days_since_contact),
    }))
  } catch {
    return []
  }
}

async function shouldSendCheckIn(userId: string): Promise<boolean> {
  try {
    // Check if already checked in recently
    const result = await query(
      `SELECT id FROM proactive_outreach
       WHERE user_id = $1 AND type = 'check_in'
         AND created_at > NOW() - INTERVAL '7 days'
       LIMIT 1`,
      [userId]
    )
    return result.rows.length === 0
  } catch {
    return false
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ProactiveService = {
  generateMorningBriefing,
  generateOpportunityAlert,
  generateWarningAlert,
  generateCelebration,
  generateReminder,
  generateCheckIn,
  generateGoalProgressUpdate,
  generateRelationshipNudge,
  recordOutreachResponse,
  getPendingOutreaches,
  runScheduledOutreach,
}

export default ProactiveService
