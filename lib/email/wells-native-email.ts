// @ts-nocheck
/**
 * Wells Native Email System
 *
 * Wells sends as Wells - from wells@wellsonyx.com
 * Direct, honest, no corporate fluff.
 *
 * Features:
 * - Send via Resend API
 * - Track opens, clicks, bounces
 * - Rate limiting (3K/month free tier)
 * - Multiple template contexts
 * - Thread management
 */

import { Resend } from 'resend'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// CONFIGURATION
// ============================================================================

const WELLS_EMAIL = 'wells@wellsonyx.com'
const WELLS_NAME = 'Wells'
const FROM_ADDRESS = `"${WELLS_NAME}" <${WELLS_EMAIL}>`

// Rate limiting for free tier (3K emails/month)
const MONTHLY_LIMIT = 3000
const DAILY_LIMIT = 100 // Self-imposed daily cap

// Lazy-initialize Resend client
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[WellsEmail] RESEND_API_KEY not configured')
    return null
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

// ============================================================================
// TYPES
// ============================================================================

export interface WellsEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  threadId?: string
  inReplyTo?: string
  references?: string
  tags?: string[]
  metadata?: Record<string, string>
  trackOpens?: boolean
  trackClicks?: boolean
  scheduledAt?: Date
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  rateLimited?: boolean
}

export interface EmailTemplate {
  id: string
  name: string
  context: 'cold_outreach' | 'follow_up' | 'notification' | 'meeting_request' | 'deal_update' | 'custom'
  subject: string
  html: string
  text?: string
  variables: string[]
  createdAt: Date
  updatedAt: Date
}

export interface EmailEvent {
  id: string
  messageId: string
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed'
  timestamp: Date
  metadata?: Record<string, unknown>
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitStatus {
  allowed: boolean
  currentDaily: number
  currentMonthly: number
  dailyRemaining: number
  monthlyRemaining: number
}

async function checkRateLimit(userId: string): Promise<RateLimitStatus> {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  try {
    // Get daily count
    const dailyResult = await query(
      `SELECT COUNT(*) as count FROM email_messages
       WHERE sender_type = 'wells' AND DATE(sent_at) = $1`,
      [today]
    )
    const dailyCount = parseInt(dailyResult?.rows?.[0]?.count || '0')

    // Get monthly count
    const monthlyResult = await query(
      `SELECT COUNT(*) as count FROM email_messages
       WHERE sender_type = 'wells' AND sent_at >= $1`,
      [monthStart]
    )
    const monthlyCount = parseInt(monthlyResult?.rows?.[0]?.count || '0')

    const allowed = dailyCount < DAILY_LIMIT && monthlyCount < MONTHLY_LIMIT

    return {
      allowed,
      currentDaily: dailyCount,
      currentMonthly: monthlyCount,
      dailyRemaining: Math.max(0, DAILY_LIMIT - dailyCount),
      monthlyRemaining: Math.max(0, MONTHLY_LIMIT - monthlyCount),
    }
  } catch (error) {
    // If DB fails, be conservative but don't block
    console.error('[WellsEmail] Rate limit check failed:', error)
    return {
      allowed: true,
      currentDaily: 0,
      currentMonthly: 0,
      dailyRemaining: DAILY_LIMIT,
      monthlyRemaining: MONTHLY_LIMIT,
    }
  }
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

export async function sendWellsEmail(
  userId: string,
  options: WellsEmailOptions
): Promise<EmailResult> {
  const resend = getResendClient()
  if (!resend) {
    return { success: false, error: 'Email service not configured' }
  }

  // Check rate limits
  const rateLimit = await checkRateLimit(userId)
  if (!rateLimit.allowed) {
    console.warn(`[WellsEmail] Rate limit exceeded for user ${userId}`)
    return {
      success: false,
      error: `Daily limit reached (${DAILY_LIMIT}/day). Try again tomorrow, or connect your Gmail for unlimited sends.`,
      rateLimited: true,
    }
  }

  // Generate thread ID if not provided
  const threadId = options.threadId || uuidv4()
  const messageId = uuidv4()

  try {
    // Build email payload
    const emailPayload: any = {
      from: FROM_ADDRESS,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo || WELLS_EMAIL,
      tags: options.tags?.map(t => ({ name: t, value: 'true' })) || [],
    }

    // Add threading headers
    if (options.inReplyTo) {
      emailPayload.headers = {
        'In-Reply-To': options.inReplyTo,
        'References': options.references || options.inReplyTo,
      }
    }

    // Schedule if needed
    if (options.scheduledAt && options.scheduledAt > new Date()) {
      emailPayload.scheduled_at = options.scheduledAt.toISOString()
    }

    // Send via Resend
    const result = await resend.emails.send(emailPayload)

    // Store in database
    await storeEmailMessage({
      id: messageId,
      threadId,
      userId,
      senderType: 'wells',
      fromEmail: WELLS_EMAIL,
      toEmail: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      htmlBody: options.html,
      textBody: options.text,
      resendMessageId: result.data?.id,
      status: 'sent',
      metadata: options.metadata,
    })

    console.log(`[WellsEmail] Sent email ${messageId} to ${options.to}`)

    return {
      success: true,
      messageId: result.data?.id || messageId,
    }
  } catch (error: any) {
    console.error('[WellsEmail] Send failed:', error)

    // Store failed attempt
    await storeEmailMessage({
      id: messageId,
      threadId,
      userId,
      senderType: 'wells',
      fromEmail: WELLS_EMAIL,
      toEmail: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      htmlBody: options.html,
      textBody: options.text,
      status: 'failed',
      errorMessage: error.message,
      metadata: options.metadata,
    })

    return {
      success: false,
      error: error.message || 'Failed to send email',
    }
  }
}

// ============================================================================
// EMAIL STORAGE
// ============================================================================

interface StoreEmailParams {
  id: string
  threadId: string
  userId: string
  senderType: 'wells' | 'user' | 'external'
  fromEmail: string
  toEmail: string
  subject: string
  htmlBody?: string
  textBody?: string
  resendMessageId?: string
  status: 'draft' | 'queued' | 'sent' | 'delivered' | 'failed'
  errorMessage?: string
  metadata?: Record<string, string>
}

async function storeEmailMessage(params: StoreEmailParams): Promise<void> {
  try {
    await query(
      `INSERT INTO email_messages (
        id, thread_id, user_id, sender_type, from_email, to_email,
        subject, html_body, text_body, resend_message_id, status,
        error_message, metadata, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        resend_message_id = EXCLUDED.resend_message_id,
        error_message = EXCLUDED.error_message,
        updated_at = NOW()`,
      [
        params.id,
        params.threadId,
        params.userId,
        params.senderType,
        params.fromEmail,
        params.toEmail,
        params.subject,
        params.htmlBody,
        params.textBody,
        params.resendMessageId,
        params.status,
        params.errorMessage,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    )
  } catch (error) {
    console.error('[WellsEmail] Failed to store email:', error)
  }
}

// ============================================================================
// TEMPLATES
// ============================================================================

export interface TemplateVariables {
  recipientName?: string
  recipientCompany?: string
  senderName?: string
  customGreeting?: string
  mainContent: string
  callToAction?: string
  signOff?: string
  [key: string]: string | undefined
}

/**
 * Cold outreach template - first contact
 */
export function coldOutreachTemplate(vars: TemplateVariables): { subject: string; html: string; text: string } {
  const greeting = vars.customGreeting || `Hey${vars.recipientName ? ` ${vars.recipientName.split(' ')[0]}` : ''}`
  const signOff = vars.signOff || `— Wells\nWells AI`
  const cta = vars.callToAction || 'Want to chat? Just reply to this email.'

  const text = `${greeting},

${vars.mainContent}

${cta}

${signOff}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 20px;
      background: #ffffff;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    p {
      margin: 0 0 16px 0;
    }
    .cta {
      margin: 24px 0;
      padding: 16px;
      background: #f3f4f6;
      border-left: 4px solid #0f172a;
      border-radius: 4px;
    }
    .signature {
      margin-top: 32px;
      color: #6b7280;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer a {
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <p>${greeting},</p>

    <div style="margin: 16px 0;">
      ${vars.mainContent.split('\n').map(p => `<p>${p}</p>`).join('')}
    </div>

    <div class="cta">
      <p style="margin: 0;">${cta}</p>
    </div>

    <div class="signature">
      <p>— Wells<br>Wells AI</p>
    </div>

    <div class="footer">
      <p>
        <a href="{{unsubscribe_url}}">Unsubscribe</a> |
        Wells Onyx LLC
      </p>
    </div>
  </div>
</body>
</html>`

  return {
    subject: vars.recipientCompany
      ? `Quick question for ${vars.recipientCompany}`
      : 'Quick question',
    html,
    text,
  }
}

/**
 * Follow-up template - continuing the conversation
 */
export function followUpTemplate(vars: TemplateVariables): { subject: string; html: string; text: string } {
  const greeting = vars.customGreeting || `Hey${vars.recipientName ? ` ${vars.recipientName.split(' ')[0]}` : ''}`

  const text = `${greeting},

${vars.mainContent}

${vars.callToAction || 'Let me know either way - no pressure.'}

— Wells`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 20px;
      background: #ffffff;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    p {
      margin: 0 0 16px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <p>${greeting},</p>

    <div style="margin: 16px 0;">
      ${vars.mainContent.split('\n').map(p => `<p>${p}</p>`).join('')}
    </div>

    <p>${vars.callToAction || 'Let me know either way - no pressure.'}</p>

    <p style="margin-top: 24px; color: #6b7280;">— Wells</p>
  </div>
</body>
</html>`

  return {
    subject: 'Re: Following up',
    html,
    text,
  }
}

/**
 * Notification template - transactional updates
 */
export function notificationTemplate(vars: TemplateVariables): { subject: string; html: string; text: string } {
  const text = `${vars.mainContent}

${vars.callToAction || ''}

— Wells AI`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 0;
      background: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
    }
    .content {
      padding: 30px;
    }
    .content p {
      margin: 0 0 16px 0;
    }
    .cta-button {
      display: inline-block;
      background: #0f172a;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 0;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Wells AI Update</h1>
    </div>

    <div class="content">
      ${vars.mainContent.split('\n').map(p => `<p>${p}</p>`).join('')}

      ${vars.callToAction ? `<p><a href="#" class="cta-button">${vars.callToAction}</a></p>` : ''}
    </div>

    <div class="footer">
      <p>Wells AI - Direct answers, real solutions</p>
    </div>
  </div>
</body>
</html>`

  return {
    subject: 'Update from Wells AI',
    html,
    text,
  }
}

/**
 * Meeting request template
 */
export function meetingRequestTemplate(vars: TemplateVariables & {
  proposedTimes?: string[]
  meetingTopic?: string
  duration?: string
}): { subject: string; html: string; text: string } {
  const greeting = `Hey${vars.recipientName ? ` ${vars.recipientName.split(' ')[0]}` : ''}`
  const duration = vars.duration || '30 mins'

  let timesSection = ''
  if (vars.proposedTimes && vars.proposedTimes.length > 0) {
    timesSection = `

Here are a few times that work:
${vars.proposedTimes.map(t => `• ${t}`).join('\n')}

Pick whatever works for you, or suggest something else.`
  }

  const text = `${greeting},

${vars.mainContent}${timesSection}

${vars.callToAction || 'Just reply with a time that works.'}

— Wells`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 20px;
      background: #ffffff;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    p {
      margin: 0 0 16px 0;
    }
    .times {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .times h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .times ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .times li {
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .times li:last-child {
      border-bottom: none;
    }
    .duration {
      display: inline-block;
      background: #0f172a;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <p>${greeting},</p>

    <div style="margin: 16px 0;">
      ${vars.mainContent.split('\n').map(p => `<p>${p}</p>`).join('')}
    </div>

    ${vars.proposedTimes && vars.proposedTimes.length > 0 ? `
    <div class="times">
      <h3>Available Times <span class="duration">${duration}</span></h3>
      <ul>
        ${vars.proposedTimes.map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>
    <p>Pick whatever works, or suggest something else.</p>
    ` : ''}

    <p>${vars.callToAction || 'Just reply with a time that works.'}</p>

    <p style="margin-top: 24px; color: #6b7280;">— Wells</p>
  </div>
</body>
</html>`

  return {
    subject: vars.meetingTopic
      ? `Quick call about ${vars.meetingTopic}?`
      : 'Quick call?',
    html,
    text,
  }
}

// ============================================================================
// EMAIL THREAD MANAGEMENT
// ============================================================================

export interface EmailThread {
  id: string
  userId: string
  subject: string
  participants: string[]
  lastMessageAt: Date
  messageCount: number
  status: 'active' | 'archived' | 'snoozed'
  labels?: string[]
  metadata?: Record<string, unknown>
}

export async function getThread(threadId: string): Promise<EmailThread | null> {
  try {
    const result = await query(
      `SELECT
        t.id, t.user_id, t.subject, t.participants, t.last_message_at,
        t.message_count, t.status, t.labels, t.metadata
       FROM email_threads t
       WHERE t.id = $1`,
      [threadId]
    )
    return result?.rows?.[0] || null
  } catch (error) {
    console.error('[WellsEmail] Failed to get thread:', error)
    return null
  }
}

export async function getThreadMessages(threadId: string): Promise<any[]> {
  try {
    const result = await query(
      `SELECT * FROM email_messages
       WHERE thread_id = $1
       ORDER BY sent_at ASC`,
      [threadId]
    )
    return result?.rows || []
  } catch (error) {
    console.error('[WellsEmail] Failed to get thread messages:', error)
    return []
  }
}

export async function getUserThreads(
  userId: string,
  options: {
    status?: 'active' | 'archived' | 'snoozed'
    limit?: number
    offset?: number
  } = {}
): Promise<EmailThread[]> {
  try {
    const { status = 'active', limit = 50, offset = 0 } = options

    const result = await query(
      `SELECT
        t.id, t.user_id, t.subject, t.participants, t.last_message_at,
        t.message_count, t.status, t.labels, t.metadata
       FROM email_threads t
       WHERE t.user_id = $1 AND t.status = $2
       ORDER BY t.last_message_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, status, limit, offset]
    )
    return result?.rows || []
  } catch (error) {
    console.error('[WellsEmail] Failed to get user threads:', error)
    return []
  }
}

// ============================================================================
// EVENT HANDLING (Webhooks)
// ============================================================================

export interface WebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.opened' | 'email.clicked' | 'email.bounced' | 'email.complained'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    [key: string]: unknown
  }
}

export async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  const eventId = uuidv4()
  const eventType = event.type.replace('email.', '')

  try {
    // Store the event
    await query(
      `INSERT INTO email_events (id, resend_message_id, event_type, event_data, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventId, event.data.email_id, eventType, JSON.stringify(event), event.created_at]
    )

    // Update message status based on event type
    const statusMap: Record<string, string> = {
      sent: 'sent',
      delivered: 'delivered',
      opened: 'delivered', // Don't change status for opens
      clicked: 'delivered', // Don't change status for clicks
      bounced: 'bounced',
      complained: 'complained',
    }

    const newStatus = statusMap[eventType]
    if (newStatus && ['bounced', 'complained'].includes(eventType)) {
      await query(
        `UPDATE email_messages SET status = $1, updated_at = NOW()
         WHERE resend_message_id = $2`,
        [newStatus, event.data.email_id]
      )
    }

    // Handle bounces - mark recipient as invalid
    if (eventType === 'bounced') {
      await handleBounce(event.data.email_id, event.data.to)
    }

    // Handle complaints - mark as unsubscribed
    if (eventType === 'complained') {
      await handleComplaint(event.data.email_id, event.data.to)
    }

    console.log(`[WellsEmail] Processed ${eventType} event for ${event.data.email_id}`)
  } catch (error) {
    console.error('[WellsEmail] Failed to process webhook event:', error)
  }
}

async function handleBounce(messageId: string, recipients: string[]): Promise<void> {
  for (const email of recipients) {
    try {
      await query(
        `UPDATE email_accounts SET
          is_valid = false,
          bounce_count = COALESCE(bounce_count, 0) + 1,
          last_bounce_at = NOW(),
          updated_at = NOW()
         WHERE email = $1`,
        [email]
      )
    } catch (error) {
      console.error(`[WellsEmail] Failed to handle bounce for ${email}:`, error)
    }
  }
}

async function handleComplaint(messageId: string, recipients: string[]): Promise<void> {
  for (const email of recipients) {
    try {
      await query(
        `INSERT INTO email_unsubscribes (email, reason, created_at)
         VALUES ($1, 'complaint', NOW())
         ON CONFLICT (email) DO NOTHING`,
        [email]
      )
    } catch (error) {
      console.error(`[WellsEmail] Failed to handle complaint for ${email}:`, error)
    }
  }
}

// ============================================================================
// UNSUBSCRIBE MANAGEMENT
// ============================================================================

export async function isUnsubscribed(email: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT 1 FROM email_unsubscribes WHERE email = $1 LIMIT 1`,
      [email]
    )
    return (result?.rows?.length || 0) > 0
  } catch (error) {
    console.error('[WellsEmail] Failed to check unsubscribe status:', error)
    return false
  }
}

export async function unsubscribe(email: string, reason?: string): Promise<void> {
  try {
    await query(
      `INSERT INTO email_unsubscribes (email, reason, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason`,
      [email, reason || 'user_request']
    )
  } catch (error) {
    console.error('[WellsEmail] Failed to unsubscribe:', error)
  }
}

export async function resubscribe(email: string): Promise<void> {
  try {
    await query(`DELETE FROM email_unsubscribes WHERE email = $1`, [email])
  } catch (error) {
    console.error('[WellsEmail] Failed to resubscribe:', error)
  }
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface EmailAnalytics {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  openRate: number
  clickRate: number
  bounceRate: number
}

export async function getEmailAnalytics(
  userId: string,
  options: {
    startDate?: Date
    endDate?: Date
    campaignId?: string
  } = {}
): Promise<EmailAnalytics> {
  const { startDate, endDate = new Date() } = options
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default 30 days

  try {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE m.status IN ('sent', 'delivered')) as sent,
        COUNT(*) FILTER (WHERE m.status = 'delivered') as delivered,
        COUNT(DISTINCT e.resend_message_id) FILTER (WHERE e.event_type = 'opened') as opened,
        COUNT(DISTINCT e.resend_message_id) FILTER (WHERE e.event_type = 'clicked') as clicked,
        COUNT(*) FILTER (WHERE m.status = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE m.status = 'complained') as complained
       FROM email_messages m
       LEFT JOIN email_events e ON m.resend_message_id = e.resend_message_id
       WHERE m.user_id = $1
         AND m.sender_type = 'wells'
         AND m.sent_at BETWEEN $2 AND $3`,
      [userId, start, endDate]
    )

    const stats = result?.rows?.[0] || {}
    const sent = parseInt(stats.sent || '0')
    const delivered = parseInt(stats.delivered || '0')
    const opened = parseInt(stats.opened || '0')
    const clicked = parseInt(stats.clicked || '0')
    const bounced = parseInt(stats.bounced || '0')
    const complained = parseInt(stats.complained || '0')

    return {
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
    }
  } catch (error) {
    console.error('[WellsEmail] Failed to get analytics:', error)
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick send with automatic template
 */
export async function quickSend(
  userId: string,
  to: string,
  context: 'cold_outreach' | 'follow_up' | 'notification' | 'meeting_request',
  variables: TemplateVariables
): Promise<EmailResult> {
  // Check if unsubscribed
  if (await isUnsubscribed(to)) {
    return { success: false, error: 'Recipient has unsubscribed' }
  }

  let template: { subject: string; html: string; text: string }

  switch (context) {
    case 'cold_outreach':
      template = coldOutreachTemplate(variables)
      break
    case 'follow_up':
      template = followUpTemplate(variables)
      break
    case 'meeting_request':
      template = meetingRequestTemplate(variables as any)
      break
    case 'notification':
    default:
      template = notificationTemplate(variables)
      break
  }

  return sendWellsEmail(userId, {
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    trackOpens: true,
    trackClicks: true,
    tags: [context],
    metadata: {
      context,
      recipientName: variables.recipientName || '',
      recipientCompany: variables.recipientCompany || '',
    },
  })
}

/**
 * Send reply in existing thread
 */
export async function sendReply(
  userId: string,
  threadId: string,
  to: string,
  content: string,
  options: {
    recipientName?: string
    inReplyTo?: string
  } = {}
): Promise<EmailResult> {
  const thread = await getThread(threadId)
  if (!thread) {
    return { success: false, error: 'Thread not found' }
  }

  const template = followUpTemplate({
    recipientName: options.recipientName,
    mainContent: content,
  })

  return sendWellsEmail(userId, {
    to,
    subject: `Re: ${thread.subject}`,
    html: template.html,
    text: template.text,
    threadId,
    inReplyTo: options.inReplyTo,
    trackOpens: true,
    trackClicks: true,
  })
}

export default {
  sendWellsEmail,
  quickSend,
  sendReply,
  coldOutreachTemplate,
  followUpTemplate,
  notificationTemplate,
  meetingRequestTemplate,
  getThread,
  getThreadMessages,
  getUserThreads,
  getEmailAnalytics,
  isUnsubscribed,
  unsubscribe,
  resubscribe,
  processWebhookEvent,
  checkRateLimit,
}
