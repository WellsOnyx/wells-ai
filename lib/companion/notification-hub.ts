// @ts-nocheck
/**
 * Wells AI Notification Hub
 *
 * "A word fitly spoken is like apples of gold in a setting of silver." - Proverbs 25:11
 *
 * Multi-channel delivery system for proactive insights. Wells reaches out
 * through the right channel at the right time with the right message.
 */

import { query } from '@/lib/db'
import { sendSMS } from '@/lib/notifications/twilio'
import { sendEmail } from '@/lib/notifications/resend'
import { ProactiveInsight, InsightUrgency } from './insight-engine'
import { getEnhancedMemory, CommunicationPreference } from './memory-enhancement'

// ============================================================================
// TYPES
// ============================================================================

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'slack' | 'teams'

export type NotificationFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly'

export type NotificationPreferences = {
  userId: string
  channels: {
    [key in NotificationChannel]: {
      enabled: boolean
      frequency: NotificationFrequency
      quietHoursStart?: string // HH:MM
      quietHoursEnd?: string // HH:MM
      urgencyThreshold: InsightUrgency // Minimum urgency to send on this channel
    }
  }
  digestTime?: string // HH:MM for daily/weekly digests
  digestDayOfWeek?: number // 0-6 for weekly digests
  timezone: string
  globalQuietHoursStart?: string
  globalQuietHoursEnd?: string
  pauseAll: boolean
  pauseUntil?: Date
}

export type NotificationDelivery = {
  id: string
  insightId: string
  userId: string
  channel: NotificationChannel
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
  scheduledFor: Date
  sentAt?: Date
  deliveredAt?: Date
  failureReason?: string
  metadata?: Record<string, any>
}

export type DigestContent = {
  userId: string
  period: 'daily' | 'weekly'
  insights: ProactiveInsight[]
  summary: {
    totalInsights: number
    criticalCount: number
    highCount: number
    totalPotentialValue: number
    topCategories: string[]
  }
  generatedAt: Date
}

// ============================================================================
// DEFAULT PREFERENCES
// ============================================================================

function getDefaultPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    channels: {
      in_app: {
        enabled: true,
        frequency: 'realtime',
        urgencyThreshold: 'info',
      },
      email: {
        enabled: true,
        frequency: 'daily',
        urgencyThreshold: 'medium',
      },
      sms: {
        enabled: false,
        frequency: 'realtime',
        urgencyThreshold: 'critical',
      },
      slack: {
        enabled: false,
        frequency: 'realtime',
        urgencyThreshold: 'high',
      },
      teams: {
        enabled: false,
        frequency: 'realtime',
        urgencyThreshold: 'high',
      },
    },
    digestTime: '08:00',
    timezone: 'America/New_York',
    pauseAll: false,
  }
}

// ============================================================================
// PREFERENCES MANAGEMENT
// ============================================================================

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  try {
    const result = await query(
      'SELECT * FROM user_notification_preferences WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      const defaults = getDefaultPreferences(userId)
      await saveNotificationPreferences(defaults)
      return defaults
    }

    const row = result.rows[0]
    return {
      userId: row.user_id,
      channels: row.channels,
      digestTime: row.digest_time,
      digestDayOfWeek: row.digest_day_of_week,
      timezone: row.timezone,
      globalQuietHoursStart: row.global_quiet_hours_start,
      globalQuietHoursEnd: row.global_quiet_hours_end,
      pauseAll: row.pause_all,
      pauseUntil: row.pause_until ? new Date(row.pause_until) : undefined,
    }
  } catch (error) {
    console.error('[NotificationHub] Error getting preferences:', error)
    return getDefaultPreferences(userId)
  }
}

/**
 * Save user notification preferences
 */
export async function saveNotificationPreferences(
  prefs: NotificationPreferences
): Promise<void> {
  try {
    await query(
      `INSERT INTO user_notification_preferences (
        user_id, channels, digest_time, digest_day_of_week, timezone,
        global_quiet_hours_start, global_quiet_hours_end, pause_all, pause_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        channels = $2,
        digest_time = $3,
        digest_day_of_week = $4,
        timezone = $5,
        global_quiet_hours_start = $6,
        global_quiet_hours_end = $7,
        pause_all = $8,
        pause_until = $9,
        updated_at = NOW()`,
      [
        prefs.userId,
        JSON.stringify(prefs.channels),
        prefs.digestTime,
        prefs.digestDayOfWeek,
        prefs.timezone,
        prefs.globalQuietHoursStart,
        prefs.globalQuietHoursEnd,
        prefs.pauseAll,
        prefs.pauseUntil,
      ]
    )
  } catch (error) {
    console.error('[NotificationHub] Error saving preferences:', error)
  }
}

/**
 * Update specific channel preferences
 */
export async function updateChannelPreferences(
  userId: string,
  channel: NotificationChannel,
  updates: Partial<NotificationPreferences['channels'][NotificationChannel]>
): Promise<void> {
  try {
    const current = await getNotificationPreferences(userId)
    current.channels[channel] = { ...current.channels[channel], ...updates }
    await saveNotificationPreferences(current)
  } catch (error) {
    console.error('[NotificationHub] Error updating channel preferences:', error)
  }
}

// ============================================================================
// DELIVERY LOGIC
// ============================================================================

/**
 * Deliver an insight through appropriate channels
 */
export async function deliverInsight(insight: ProactiveInsight): Promise<void> {
  try {
    const prefs = await getNotificationPreferences(insight.userId)

    // Check if notifications are paused
    if (prefs.pauseAll) {
      if (!prefs.pauseUntil || prefs.pauseUntil > new Date()) {
        console.log(`[NotificationHub] Notifications paused for user ${insight.userId}`)
        return
      }
    }

    // Check quiet hours
    if (isInQuietHours(prefs)) {
      // Queue for later unless critical
      if (insight.urgency !== 'critical') {
        await queueForDelivery(insight, prefs)
        return
      }
    }

    // Determine which channels to use based on urgency
    const channels = getChannelsForUrgency(prefs, insight.urgency)

    // Deliver to each channel
    for (const channel of channels) {
      await deliverToChannel(insight, channel, prefs)
    }
  } catch (error) {
    console.error('[NotificationHub] Error delivering insight:', error)
  }
}

/**
 * Check if current time is in quiet hours
 */
function isInQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.globalQuietHoursStart || !prefs.globalQuietHoursEnd) {
    return false
  }

  const now = new Date()
  const [startHour, startMin] = prefs.globalQuietHoursStart.split(':').map(Number)
  const [endHour, endMin] = prefs.globalQuietHoursEnd.split(':').map(Number)

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  if (startMinutes <= endMinutes) {
    // Same day quiet hours (e.g., 22:00 to 07:00 next day won't match)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } else {
    // Overnight quiet hours
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
}

/**
 * Get channels that should receive this urgency level
 */
function getChannelsForUrgency(
  prefs: NotificationPreferences,
  urgency: InsightUrgency
): NotificationChannel[] {
  const urgencyLevels: InsightUrgency[] = ['info', 'low', 'medium', 'high', 'critical']
  const urgencyIndex = urgencyLevels.indexOf(urgency)

  const channels: NotificationChannel[] = []

  for (const [channel, config] of Object.entries(prefs.channels)) {
    if (!config.enabled) continue

    const thresholdIndex = urgencyLevels.indexOf(config.urgencyThreshold)
    if (urgencyIndex >= thresholdIndex) {
      // Only add realtime channels for immediate delivery
      if (config.frequency === 'realtime') {
        channels.push(channel as NotificationChannel)
      }
    }
  }

  // Always include in_app for immediate display
  if (!channels.includes('in_app') && prefs.channels.in_app.enabled) {
    channels.push('in_app')
  }

  return channels
}

/**
 * Deliver to a specific channel
 */
async function deliverToChannel(
  insight: ProactiveInsight,
  channel: NotificationChannel,
  prefs: NotificationPreferences
): Promise<void> {
  const deliveryId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // Record delivery attempt
    await recordDelivery({
      id: deliveryId,
      insightId: insight.id,
      userId: insight.userId,
      channel,
      status: 'pending',
      scheduledFor: new Date(),
    })

    let success = false

    switch (channel) {
      case 'in_app':
        // In-app notifications are stored in the insights table
        success = true
        break

      case 'email':
        success = await sendInsightEmail(insight)
        break

      case 'sms':
        success = await sendInsightSMS(insight)
        break

      case 'slack':
        success = await sendInsightSlack(insight)
        break

      case 'teams':
        success = await sendInsightTeams(insight)
        break
    }

    // Update delivery status
    await updateDeliveryStatus(deliveryId, success ? 'sent' : 'failed')
  } catch (error) {
    console.error(`[NotificationHub] Failed to deliver to ${channel}:`, error)
    await updateDeliveryStatus(deliveryId, 'failed', String(error))
  }
}

/**
 * Queue insight for later delivery
 */
async function queueForDelivery(
  insight: ProactiveInsight,
  prefs: NotificationPreferences
): Promise<void> {
  // Calculate next delivery time (end of quiet hours)
  const [endHour, endMin] = (prefs.globalQuietHoursEnd || '08:00').split(':').map(Number)
  const scheduledFor = new Date()
  scheduledFor.setHours(endHour, endMin, 0, 0)

  if (scheduledFor <= new Date()) {
    scheduledFor.setDate(scheduledFor.getDate() + 1)
  }

  const deliveryId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  await recordDelivery({
    id: deliveryId,
    insightId: insight.id,
    userId: insight.userId,
    channel: 'in_app', // Queue for in-app initially
    status: 'pending',
    scheduledFor,
  })
}

// ============================================================================
// CHANNEL-SPECIFIC DELIVERY
// ============================================================================

/**
 * Send insight via email
 */
async function sendInsightEmail(insight: ProactiveInsight): Promise<boolean> {
  try {
    const memory = await getEnhancedMemory(insight.userId)
    const email = memory?.email

    if (!email) {
      console.log('[NotificationHub] No email for user:', insight.userId)
      return false
    }

    const urgencyColors: Record<InsightUrgency, string> = {
      critical: '#dc2626',
      high: '#f59e0b',
      medium: '#3b82f6',
      low: '#6b7280',
      info: '#8b5cf6',
    }

    const valueText = insight.potentialValue
      ? `<div style="font-size: 24px; font-weight: bold; color: #10b981;">$${insight.potentialValue.toLocaleString()}</div>
         <div style="color: #6b7280;">potential ${insight.potentialValueType}</div>`
      : ''

    const actionsHtml = insight.actionOptions
      .filter((a) => a.isPrimary)
      .map(
        (action) =>
          `<a href="${process.env.NEXT_PUBLIC_BASE_URL}/insights/${insight.id}?action=${action.id}"
            style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                   color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;
                   font-weight: 600; margin-right: 10px;">
            ${action.label}
          </a>`
      )
      .join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="background: ${urgencyColors[insight.urgency]}; color: white; padding: 20px 30px; border-radius: 12px 12px 0 0;">
      <div style="font-size: 12px; text-transform: uppercase; opacity: 0.9; margin-bottom: 8px;">
        ${insight.urgency.toUpperCase()} INSIGHT
      </div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">${insight.title}</h1>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        ${insight.message}
      </p>

      ${valueText ? `
      <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
        ${valueText}
      </div>
      ` : ''}

      <div style="margin: 30px 0;">
        ${actionsHtml}
      </div>

      <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/insights/${insight.id}" style="color: #667eea;">
          View full details
        </a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: white; padding: 20px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        This insight was generated by Wells AI based on your activity.
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/settings/notifications" style="color: #667eea;">
          Manage notification preferences
        </a>
      </p>
    </div>

  </div>
</body>
</html>
    `

    const result = await sendEmail(
      email,
      `[${insight.urgency.toUpperCase()}] ${insight.title}`,
      html,
      {
        tags: {
          type: 'proactive_insight',
          category: insight.category,
          urgency: insight.urgency,
        },
      }
    )

    return result.success
  } catch (error) {
    console.error('[NotificationHub] Email delivery failed:', error)
    return false
  }
}

/**
 * Send insight via SMS
 */
async function sendInsightSMS(insight: ProactiveInsight): Promise<boolean> {
  try {
    // Get user phone from profile
    const result = await query(
      'SELECT phone FROM user_profiles WHERE user_id = $1',
      [insight.userId]
    )

    if (result.rows.length === 0 || !result.rows[0].phone) {
      console.log('[NotificationHub] No phone for user:', insight.userId)
      return false
    }

    const phone = result.rows[0].phone

    // SMS must be concise
    const valueText = insight.potentialValue
      ? ` ($${(insight.potentialValue / 1000).toFixed(0)}K ${insight.potentialValueType})`
      : ''

    const message = `[${insight.urgency.toUpperCase()}] ${insight.title}${valueText}

${insight.message}

Take action: ${process.env.NEXT_PUBLIC_BASE_URL}/i/${insight.id.slice(-8)}

- Wells AI`

    const smsResult = await sendSMS(phone, message)
    return smsResult.success
  } catch (error) {
    console.error('[NotificationHub] SMS delivery failed:', error)
    return false
  }
}

/**
 * Send insight via Slack
 */
async function sendInsightSlack(insight: ProactiveInsight): Promise<boolean> {
  try {
    // Get Slack webhook from user settings
    const result = await query(
      'SELECT slack_webhook_url FROM user_integrations WHERE user_id = $1',
      [insight.userId]
    )

    if (result.rows.length === 0 || !result.rows[0].slack_webhook_url) {
      console.log('[NotificationHub] No Slack webhook for user:', insight.userId)
      return false
    }

    const webhookUrl = result.rows[0].slack_webhook_url

    const urgencyEmojis: Record<InsightUrgency, string> = {
      critical: ':rotating_light:',
      high: ':warning:',
      medium: ':bulb:',
      low: ':information_source:',
      info: ':star:',
    }

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${urgencyEmojis[insight.urgency]} ${insight.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: insight.message,
        },
      },
    ]

    if (insight.potentialValue) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Potential Value:*\n$${insight.potentialValue.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${insight.potentialValueType}`,
          },
        ],
      })
    }

    blocks.push({
      type: 'actions',
      elements: insight.actionOptions
        .filter((a) => a.isPrimary)
        .map((action) => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: action.label,
            emoji: true,
          },
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/insights/${insight.id}?action=${action.id}`,
          style: 'primary',
        })),
    })

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })

    return response.ok
  } catch (error) {
    console.error('[NotificationHub] Slack delivery failed:', error)
    return false
  }
}

/**
 * Send insight via Microsoft Teams
 */
async function sendInsightTeams(insight: ProactiveInsight): Promise<boolean> {
  try {
    // Get Teams webhook from user settings
    const result = await query(
      'SELECT teams_webhook_url FROM user_integrations WHERE user_id = $1',
      [insight.userId]
    )

    if (result.rows.length === 0 || !result.rows[0].teams_webhook_url) {
      console.log('[NotificationHub] No Teams webhook for user:', insight.userId)
      return false
    }

    const webhookUrl = result.rows[0].teams_webhook_url

    const urgencyColors: Record<InsightUrgency, string> = {
      critical: 'attention',
      high: 'warning',
      medium: 'accent',
      low: 'default',
      info: 'good',
    }

    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: urgencyColors[insight.urgency],
      summary: insight.title,
      sections: [
        {
          activityTitle: insight.title,
          activitySubtitle: `${insight.urgency.toUpperCase()} | ${insight.category}`,
          text: insight.message,
          facts: insight.potentialValue
            ? [
                {
                  name: 'Potential Value',
                  value: `$${insight.potentialValue.toLocaleString()} (${insight.potentialValueType})`,
                },
              ]
            : [],
        },
      ],
      potentialAction: insight.actionOptions
        .filter((a) => a.isPrimary)
        .map((action) => ({
          '@type': 'OpenUri',
          name: action.label,
          targets: [
            {
              os: 'default',
              uri: `${process.env.NEXT_PUBLIC_BASE_URL}/insights/${insight.id}?action=${action.id}`,
            },
          ],
        })),
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    return response.ok
  } catch (error) {
    console.error('[NotificationHub] Teams delivery failed:', error)
    return false
  }
}

// ============================================================================
// DIGEST GENERATION
// ============================================================================

/**
 * Generate and send a digest of insights
 */
export async function generateAndSendDigest(
  userId: string,
  period: 'daily' | 'weekly'
): Promise<boolean> {
  try {
    const prefs = await getNotificationPreferences(userId)

    // Check if email digest is enabled
    if (
      !prefs.channels.email.enabled ||
      (period === 'daily' && prefs.channels.email.frequency !== 'daily') ||
      (period === 'weekly' && prefs.channels.email.frequency !== 'weekly')
    ) {
      return false
    }

    // Get insights from the period
    const daysBack = period === 'daily' ? 1 : 7
    const insights = await getInsightsForDigest(userId, daysBack)

    if (insights.length === 0) {
      return false
    }

    // Generate digest content
    const digest = createDigestContent(userId, period, insights)

    // Send digest email
    return await sendDigestEmail(userId, digest)
  } catch (error) {
    console.error('[NotificationHub] Error generating digest:', error)
    return false
  }
}

/**
 * Get insights for digest
 */
async function getInsightsForDigest(
  userId: string,
  daysBack: number
): Promise<ProactiveInsight[]> {
  try {
    const result = await query(
      `SELECT * FROM proactive_insights
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '${daysBack} days'
       ORDER BY
         CASE urgency
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           WHEN 'info' THEN 5
         END,
         created_at DESC`,
      [userId]
    )

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      journey: row.journey,
      category: row.category,
      urgency: row.urgency,
      title: row.title,
      message: row.message,
      potentialValue: row.potential_value,
      potentialValueType: row.potential_value_type,
      actionOptions: row.action_options || [],
      createdAt: new Date(row.created_at),
      actedUpon: row.acted_upon,
      dismissed: row.dismissed,
    }))
  } catch (error) {
    console.error('[NotificationHub] Error getting insights for digest:', error)
    return []
  }
}

/**
 * Create digest content
 */
function createDigestContent(
  userId: string,
  period: 'daily' | 'weekly',
  insights: ProactiveInsight[]
): DigestContent {
  const categoryCount: Record<string, number> = {}

  insights.forEach((i) => {
    categoryCount[i.category] = (categoryCount[i.category] || 0) + 1
  })

  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat)

  return {
    userId,
    period,
    insights,
    summary: {
      totalInsights: insights.length,
      criticalCount: insights.filter((i) => i.urgency === 'critical').length,
      highCount: insights.filter((i) => i.urgency === 'high').length,
      totalPotentialValue: insights.reduce((sum, i) => sum + (i.potentialValue || 0), 0),
      topCategories,
    },
    generatedAt: new Date(),
  }
}

/**
 * Send digest email
 */
async function sendDigestEmail(
  userId: string,
  digest: DigestContent
): Promise<boolean> {
  try {
    const memory = await getEnhancedMemory(userId)
    const email = memory?.email
    const userName = memory?.preferredName || memory?.firstName || 'there'

    if (!email) return false

    const periodLabel = digest.period === 'daily' ? 'Daily' : 'Weekly'
    const dateRange =
      digest.period === 'daily'
        ? new Date().toLocaleDateString()
        : `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} - ${new Date().toLocaleDateString()}`

    const insightRows = digest.insights
      .slice(0, 10)
      .map(
        (insight) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px;
                         background: ${
                           insight.urgency === 'critical'
                             ? '#fee2e2'
                             : insight.urgency === 'high'
                             ? '#fef3c7'
                             : '#e0f2fe'
                         };
                         color: ${
                           insight.urgency === 'critical'
                             ? '#991b1b'
                             : insight.urgency === 'high'
                             ? '#92400e'
                             : '#075985'
                         };">
              ${insight.urgency.toUpperCase()}
            </span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/insights/${insight.id}" style="color: #374151; text-decoration: none; font-weight: 500;">
              ${insight.title}
            </a>
            <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">
              ${insight.message.substring(0, 100)}...
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            ${
              insight.potentialValue
                ? `<span style="color: #10b981; font-weight: 600;">$${insight.potentialValue.toLocaleString()}</span>`
                : '-'
            }
          </td>
        </tr>
      `
      )
      .join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">Your ${periodLabel} Wells AI Digest</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${dateRange}</p>
    </div>

    <!-- Summary -->
    <div style="background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
        Hi ${userName}, here's what I found for you this ${digest.period === 'daily' ? 'day' : 'week'}:
      </p>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: 700; color: #111827;">${digest.summary.totalInsights}</div>
          <div style="color: #6b7280; font-size: 14px;">Insights</div>
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: 700; color: #dc2626;">${digest.summary.criticalCount + digest.summary.highCount}</div>
          <div style="color: #6b7280; font-size: 14px;">Need Attention</div>
        </div>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: 700; color: #10b981;">$${(digest.summary.totalPotentialValue / 1000).toFixed(0)}K</div>
          <div style="color: #6b7280; font-size: 14px;">Potential Value</div>
        </div>
      </div>

      <!-- Insights Table -->
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Priority</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Insight</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Value</th>
          </tr>
        </thead>
        <tbody>
          ${insightRows}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/insights" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View All Insights
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: white; padding: 20px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/settings/notifications" style="color: #667eea;">
          Manage digest preferences
        </a>
      </p>
    </div>

  </div>
</body>
</html>
    `

    const result = await sendEmail(
      email,
      `Your ${periodLabel} Wells AI Digest: ${digest.summary.totalInsights} insights, $${(digest.summary.totalPotentialValue / 1000).toFixed(0)}K potential`,
      html,
      {
        tags: {
          type: 'digest',
          period: digest.period,
        },
      }
    )

    return result.success
  } catch (error) {
    console.error('[NotificationHub] Error sending digest email:', error)
    return false
  }
}

// ============================================================================
// DELIVERY TRACKING
// ============================================================================

/**
 * Record a delivery attempt
 */
async function recordDelivery(delivery: NotificationDelivery): Promise<void> {
  try {
    await query(
      `INSERT INTO notification_deliveries (
        id, insight_id, user_id, channel, status, scheduled_for, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        delivery.id,
        delivery.insightId,
        delivery.userId,
        delivery.channel,
        delivery.status,
        delivery.scheduledFor,
        delivery.metadata ? JSON.stringify(delivery.metadata) : null,
      ]
    )
  } catch (error) {
    console.error('[NotificationHub] Error recording delivery:', error)
  }
}

/**
 * Update delivery status
 */
async function updateDeliveryStatus(
  deliveryId: string,
  status: NotificationDelivery['status'],
  failureReason?: string
): Promise<void> {
  try {
    const updates =
      status === 'sent'
        ? { sentAt: new Date() }
        : status === 'delivered'
        ? { deliveredAt: new Date() }
        : {}

    await query(
      `UPDATE notification_deliveries
       SET status = $2,
           sent_at = COALESCE($3, sent_at),
           delivered_at = COALESCE($4, delivered_at),
           failure_reason = COALESCE($5, failure_reason)
       WHERE id = $1`,
      [
        deliveryId,
        status,
        (updates as any).sentAt,
        (updates as any).deliveredAt,
        failureReason,
      ]
    )
  } catch (error) {
    console.error('[NotificationHub] Error updating delivery status:', error)
  }
}

/**
 * Process pending deliveries
 */
export async function processPendingDeliveries(): Promise<void> {
  try {
    const result = await query(
      `SELECT d.*, i.*
       FROM notification_deliveries d
       JOIN proactive_insights i ON d.insight_id = i.id
       WHERE d.status = 'pending'
         AND d.scheduled_for <= NOW()
       ORDER BY d.scheduled_for ASC
       LIMIT 100`
    )

    for (const row of result.rows) {
      const insight: ProactiveInsight = {
        id: row.insight_id,
        userId: row.user_id,
        journey: row.journey,
        category: row.category,
        urgency: row.urgency,
        title: row.title,
        message: row.message,
        potentialValue: row.potential_value,
        potentialValueType: row.potential_value_type,
        actionOptions: row.action_options || [],
        createdAt: new Date(row.created_at),
        actedUpon: row.acted_upon,
        dismissed: row.dismissed,
      }

      const prefs = await getNotificationPreferences(insight.userId)
      await deliverToChannel(insight, row.channel, prefs)

      // Mark the original delivery as processed
      await updateDeliveryStatus(row.id, 'sent')
    }
  } catch (error) {
    console.error('[NotificationHub] Error processing pending deliveries:', error)
  }
}

// ============================================================================
// CHAT QUEUE SYSTEM - ALL NOTIFICATIONS SURFACE THROUGH CHAT
// ============================================================================

export interface ChatQueueItem {
  id: string
  userId: string
  type: 'insight' | 'completion' | 'reminder' | 'celebration' | 'alert' | 'update'
  priority: 'critical' | 'high' | 'medium' | 'low' | 'info'
  message: string
  detailedMessage?: string
  actions?: Array<{
    id: string
    label: string
    actionType: string
    data?: Record<string, any>
  }>
  relatedInsightId?: string
  expiresAt?: Date
  createdAt: Date
  deliveredAt?: Date
  readAt?: Date
}

/**
 * Add a notification to the chat queue
 * All notifications appear in Wells chat - this is the primary delivery mechanism
 */
export async function addToChatQueue(
  userId: string,
  notification: Omit<ChatQueueItem, 'id' | 'userId' | 'createdAt'>
): Promise<ChatQueueItem> {
  const id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const item: ChatQueueItem = {
    ...notification,
    id,
    userId,
    createdAt: new Date(),
  }

  try {
    await query(
      `INSERT INTO chat_queue (id, user_id, type, priority, message, detailed_message,
        actions, related_insight_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        item.id,
        item.userId,
        item.type,
        item.priority,
        item.message,
        item.detailedMessage,
        JSON.stringify(item.actions || []),
        item.relatedInsightId,
        item.expiresAt,
      ]
    )

    // For critical/high priority, also send push notification
    if (notification.priority === 'critical' || notification.priority === 'high') {
      await sendPushNotification(userId, item)
    }

    return item
  } catch (error) {
    console.error('[NotificationHub] Error adding to chat queue:', error)
    throw error
  }
}

/**
 * Get pending chat queue items for a user
 */
export async function getChatQueue(
  userId: string,
  options: {
    limit?: number
    includeRead?: boolean
    type?: ChatQueueItem['type']
    priority?: ChatQueueItem['priority']
  } = {}
): Promise<ChatQueueItem[]> {
  const { limit = 20, includeRead = false, type, priority } = options

  try {
    let whereConditions = ['user_id = $1']
    const params: any[] = [userId]
    let paramIndex = 2

    if (!includeRead) {
      whereConditions.push('read_at IS NULL')
    }

    if (type) {
      whereConditions.push(`type = $${paramIndex++}`)
      params.push(type)
    }

    if (priority) {
      whereConditions.push(`priority = $${paramIndex++}`)
      params.push(priority)
    }

    whereConditions.push('(expires_at IS NULL OR expires_at > NOW())')

    const result = await query(
      `SELECT * FROM chat_queue
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY
         CASE priority
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         created_at DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    )

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      priority: row.priority,
      message: row.message,
      detailedMessage: row.detailed_message,
      actions: row.actions || [],
      relatedInsightId: row.related_insight_id,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      createdAt: new Date(row.created_at),
      deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
      readAt: row.read_at ? new Date(row.read_at) : undefined,
    }))
  } catch (error) {
    console.error('[NotificationHub] Error getting chat queue:', error)
    return []
  }
}

/**
 * Mark chat queue items as read
 */
export async function markChatQueueRead(
  userId: string,
  itemIds: string[]
): Promise<void> {
  try {
    await query(
      `UPDATE chat_queue
       SET read_at = NOW()
       WHERE user_id = $1 AND id = ANY($2) AND read_at IS NULL`,
      [userId, itemIds]
    )
  } catch (error) {
    console.error('[NotificationHub] Error marking queue read:', error)
  }
}

/**
 * Build proactive chat greeting with pending notifications
 */
export async function buildProactiveChatGreeting(userId: string): Promise<{
  greeting: string
  pendingItems: ChatQueueItem[]
  summary: {
    criticalCount: number
    highCount: number
    totalCount: number
    potentialValue: number
  }
}> {
  const pendingItems = await getChatQueue(userId, { limit: 10 })

  // Get insights for value calculation
  const insightIds = pendingItems
    .filter((i) => i.relatedInsightId)
    .map((i) => i.relatedInsightId)

  let potentialValue = 0
  if (insightIds.length > 0) {
    try {
      const valueResult = await query(
        `SELECT COALESCE(SUM(potential_value), 0) as total
         FROM proactive_insights
         WHERE id = ANY($1)`,
        [insightIds]
      )
      potentialValue = parseFloat(valueResult.rows[0]?.total || '0')
    } catch (e) {
      // Ignore errors
    }
  }

  const criticalCount = pendingItems.filter((i) => i.priority === 'critical').length
  const highCount = pendingItems.filter((i) => i.priority === 'high').length

  // Build greeting based on time of day and pending items
  const hour = new Date().getHours()
  let timeGreeting = 'Hello!'
  if (hour < 12) timeGreeting = 'Good morning!'
  else if (hour < 17) timeGreeting = 'Good afternoon!'
  else timeGreeting = 'Good evening!'

  let greeting = timeGreeting

  if (pendingItems.length > 0) {
    greeting += ' While you were away, I was busy:\n\n'

    // Group by type and show most important
    const criticalItems = pendingItems.filter((i) => i.priority === 'critical')
    const highItems = pendingItems.filter((i) => i.priority === 'high')
    const completions = pendingItems.filter((i) => i.type === 'completion')
    const insights = pendingItems.filter(
      (i) => i.type === 'insight' && i.priority !== 'critical' && i.priority !== 'high'
    )

    for (const item of criticalItems.slice(0, 2)) {
      greeting += `\n**[Warning] Critical:** ${item.message}`
    }

    for (const item of highItems.slice(0, 2)) {
      greeting += `\n**[Search] Found something:** ${item.message}`
    }

    for (const item of completions.slice(0, 2)) {
      greeting += `\n**[Check] Completed:** ${item.message}`
    }

    for (const item of insights.slice(0, 2)) {
      greeting += `\n**[Lightbulb] Insight:** ${item.message}`
    }

    if (potentialValue > 0) {
      greeting += `\n\n_Total potential value: $${potentialValue.toLocaleString()}_`
    }
  } else {
    greeting += " I've been monitoring things and all looks good. How can I help you today?"
  }

  return {
    greeting,
    pendingItems,
    summary: {
      criticalCount,
      highCount,
      totalCount: pendingItems.length,
      potentialValue,
    },
  }
}

/**
 * Send push notification for high-priority items
 */
async function sendPushNotification(
  userId: string,
  item: ChatQueueItem
): Promise<void> {
  try {
    const prefs = await getNotificationPreferences(userId)

    // Check if notifications are paused
    if (prefs.pauseAll) return

    // Check quiet hours
    if (prefs.globalQuietHoursStart && prefs.globalQuietHoursEnd) {
      const now = new Date()
      const currentTime = now.getHours() * 60 + now.getMinutes()
      const [startH, startM] = prefs.globalQuietHoursStart.split(':').map(Number)
      const [endH, endM] = prefs.globalQuietHoursEnd.split(':').map(Number)
      const start = startH * 60 + startM
      const end = endH * 60 + endM

      if (start <= end) {
        if (currentTime >= start && currentTime <= end) return
      } else {
        if (currentTime >= start || currentTime <= end) return
      }
    }

    // Send via configured push service (e.g., OneSignal, Firebase)
    console.log(`[NotificationHub] Would send push notification to ${userId}:`, item.message)
  } catch (error) {
    console.error('[NotificationHub] Error sending push notification:', error)
  }
}

/**
 * Notify user through chat (primary) and other channels (secondary)
 */
export async function notify(
  userId: string,
  notification: {
    type: ChatQueueItem['type']
    priority: ChatQueueItem['priority']
    message: string
    detailedMessage?: string
    suggestedActions?: Array<{
      id: string
      label: string
      actionType: string
      data?: Record<string, any>
    }>
    relatedInsightId?: string
    expiresAt?: Date
  }
): Promise<void> {
  // Add to chat queue (primary notification method)
  await addToChatQueue(userId, {
    type: notification.type,
    priority: notification.priority,
    message: notification.message,
    detailedMessage: notification.detailedMessage,
    actions: notification.suggestedActions,
    relatedInsightId: notification.relatedInsightId,
    expiresAt: notification.expiresAt,
  })

  // For high priority, also send push/email based on preferences
  if (notification.priority === 'critical' || notification.priority === 'high') {
    const prefs = await getNotificationPreferences(userId)

    if (prefs.channels.email?.enabled) {
      // Queue email for critical items
      console.log(`[NotificationHub] Would email ${userId}:`, notification.message)
    }

    if (prefs.channels.sms?.enabled && notification.priority === 'critical') {
      // Send SMS for critical only
      console.log(`[NotificationHub] Would SMS ${userId}:`, notification.message)
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const NotificationHub = {
  getPreferences: getNotificationPreferences,
  savePreferences: saveNotificationPreferences,
  updateChannel: updateChannelPreferences,
  deliver: deliverInsight,
  sendDigest: generateAndSendDigest,
  processQueue: processPendingDeliveries,
  // Chat queue functions
  addToChatQueue,
  getChatQueue,
  markChatQueueRead,
  buildProactiveChatGreeting,
  notify,
}

export default NotificationHub
