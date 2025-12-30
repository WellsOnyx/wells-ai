// @ts-nocheck
/**
 * Outreach Engine
 *
 * The engine that powers Wells' outreach:
 * - Generate PERSONALIZED messages (not templates)
 * - Multi-channel: Email (Resend), X/Twitter DMs, LinkedIn
 * - Track sends, opens, replies
 * - Route replies back into conversation
 * - One message, not sequences
 */

import { query, withTransaction } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import {
  generateOutreachMessage,
  PersonalityMode,
  OutreachContact,
  MessageContext,
  GeneratedMessage,
  setHonestExpectations,
  celebrateWin,
  getWellsPhrase,
} from './wells-voice'
import { Contact, getContacts, SegmentCriteria } from './contact-ingestion'

// ============================================================================
// TYPES
// ============================================================================

export interface OutreachMessage {
  id: string
  userId: string
  contactId: string
  channel: 'email' | 'twitter_dm' | 'linkedin_dm' | 'linkedin_connection' | 'sms'
  subject?: string
  body: string
  personalizationFactors: string[]
  personalityMode: PersonalityMode
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed'
  scheduledAt?: Date
  sentAt?: Date
  requiresApproval: boolean
  approved?: boolean
  createdAt: Date
}

export interface OutreachEvent {
  id: string
  messageId: string
  contactId: string
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'complained' | 'unsubscribed'
  replyContent?: string
  replySentiment?: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested'
  replyIntent?: string
  createdAt: Date
}

export interface Campaign {
  id: string
  userId: string
  name: string
  segmentCriteria: SegmentCriteria
  personalityMode: PersonalityMode
  channels: string[]
  dailyLimit: number
  status: 'draft' | 'active' | 'paused' | 'completed'
  totalContacts: number
  totalSent: number
  totalOpened: number
  totalReplied: number
  createdAt: Date
}

export interface CampaignPreview {
  campaign: Campaign
  sampleMessages: Array<{
    contact: Contact
    message: GeneratedMessage
  }>
  expectations: ReturnType<typeof setHonestExpectations>
}

// ============================================================================
// CAMPAIGN MANAGEMENT
// ============================================================================

/**
 * Create a new outreach campaign from conversation
 */
export async function createCampaign(
  userId: string,
  name: string,
  segmentCriteria: SegmentCriteria,
  options: {
    personality?: PersonalityMode
    channels?: string[]
    dailyLimit?: number
  } = {}
): Promise<Campaign> {
  const id = uuidv4()

  // Count matching contacts
  const countResult = await buildSegmentQuery(userId, segmentCriteria, true)

  await query(
    `INSERT INTO outreach_campaigns (
      id, user_id, name, segment_criteria, personality_mode,
      channels, daily_limit, status, total_contacts
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)`,
    [
      id,
      userId,
      name,
      JSON.stringify(segmentCriteria),
      options.personality || 'default',
      options.channels || ['email'],
      options.dailyLimit || 50,
      countResult,
    ]
  )

  return {
    id,
    userId,
    name,
    segmentCriteria,
    personalityMode: options.personality || 'default',
    channels: options.channels || ['email'],
    dailyLimit: options.dailyLimit || 50,
    status: 'draft',
    totalContacts: countResult,
    totalSent: 0,
    totalOpened: 0,
    totalReplied: 0,
    createdAt: new Date(),
  }
}

/**
 * Build SQL query for segment criteria
 */
async function buildSegmentQuery(
  userId: string,
  criteria: SegmentCriteria,
  countOnly: boolean
): Promise<number | Contact[]> {
  const conditions: string[] = ['user_id = $1', "status NOT IN ('unsubscribed', 'bounced')"]
  const values: unknown[] = [userId]
  let paramIndex = 2

  if (criteria.titles && criteria.titles.length > 0) {
    const titlePatterns = criteria.titles.map(t => `%${t}%`).join('|')
    conditions.push(`title ~* $${paramIndex++}`)
    values.push(titlePatterns)
  }

  if (criteria.seniorities && criteria.seniorities.length > 0) {
    conditions.push(`seniority = ANY($${paramIndex++})`)
    values.push(criteria.seniorities)
  }

  if (criteria.industries && criteria.industries.length > 0) {
    const industryPatterns = criteria.industries.map(i => `%${i}%`).join('|')
    conditions.push(`industry ~* $${paramIndex++}`)
    values.push(industryPatterns)
  }

  if (criteria.companySizes && criteria.companySizes.length > 0) {
    conditions.push(`company_size = ANY($${paramIndex++})`)
    values.push(criteria.companySizes)
  }

  if (criteria.icpScoreMin !== undefined) {
    conditions.push(`icp_score >= $${paramIndex++}`)
    values.push(criteria.icpScoreMin)
  }

  const whereClause = conditions.join(' AND ')

  if (countOnly) {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM outreach_contacts WHERE ${whereClause}`,
      values
    )
    return parseInt(result.rows[0].count, 10)
  }

  const result = await query(
    `SELECT * FROM outreach_contacts WHERE ${whereClause} ORDER BY icp_score DESC`,
    values
  )

  return result.rows as Contact[]
}

/**
 * Generate preview messages for a campaign
 */
export async function previewCampaign(
  userId: string,
  campaignId: string,
  senderContext: MessageContext,
  sampleSize: number = 3
): Promise<CampaignPreview> {
  // Get campaign
  const campaignResult = await query<Record<string, unknown>>(
    'SELECT * FROM outreach_campaigns WHERE id = $1 AND user_id = $2',
    [campaignId, userId]
  )

  if (campaignResult.rows.length === 0) {
    throw new Error('Campaign not found')
  }

  const campaign = mapRowToCampaign(campaignResult.rows[0])

  // Get sample contacts
  const contacts = await buildSegmentQuery(userId, campaign.segmentCriteria, false) as Contact[]
  const sampleContacts = contacts.slice(0, sampleSize)

  // Generate sample messages
  const sampleMessages: Array<{ contact: Contact; message: GeneratedMessage }> = []

  for (const contact of sampleContacts) {
    const outreachContact: OutreachContact = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      title: contact.title,
      company: contact.companyName,
      industry: contact.industry,
      companySize: contact.companySize,
      linkedinUrl: contact.linkedinUrl,
    }

    const message = await generateOutreachMessage(
      outreachContact,
      senderContext,
      campaign.channels[0] as 'email' | 'linkedin' | 'twitter',
      campaign.personalityMode
    )

    sampleMessages.push({ contact, message })
  }

  // Calculate expectations
  const quality = campaign.segmentCriteria.icpScoreMin && campaign.segmentCriteria.icpScoreMin >= 70 ? 'warm' : 'cold'
  const expectations = setHonestExpectations(campaign.totalContacts, quality)

  return {
    campaign,
    sampleMessages,
    expectations,
  }
}

function mapRowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    segmentCriteria: row.segment_criteria as SegmentCriteria,
    personalityMode: (row.personality_mode as PersonalityMode) || 'default',
    channels: (row.channels as string[]) || ['email'],
    dailyLimit: row.daily_limit as number,
    status: row.status as Campaign['status'],
    totalContacts: row.total_contacts as number,
    totalSent: row.total_sent as number,
    totalOpened: row.total_opened as number,
    totalReplied: row.total_replied as number,
    createdAt: new Date(row.created_at as string),
  }
}

// ============================================================================
// MESSAGE GENERATION & SENDING
// ============================================================================

/**
 * Generate messages for all contacts in a campaign
 * Stores as drafts for review or immediate sending
 */
export async function generateCampaignMessages(
  userId: string,
  campaignId: string,
  senderContext: MessageContext,
  options: {
    requireApproval?: boolean
    scheduleAt?: Date
  } = {}
): Promise<{ generated: number; skipped: number }> {
  // Get campaign
  const campaignResult = await query<Record<string, unknown>>(
    'SELECT * FROM outreach_campaigns WHERE id = $1 AND user_id = $2',
    [campaignId, userId]
  )

  if (campaignResult.rows.length === 0) {
    throw new Error('Campaign not found')
  }

  const campaign = mapRowToCampaign(campaignResult.rows[0])

  // Get contacts that haven't been messaged in this campaign
  const contacts = await query<Record<string, unknown>>(
    `SELECT c.* FROM outreach_contacts c
     WHERE c.user_id = $1
     AND c.status NOT IN ('unsubscribed', 'bounced')
     AND c.id NOT IN (
       SELECT contact_id FROM campaign_contacts WHERE campaign_id = $2
     )
     ORDER BY c.icp_score DESC
     LIMIT $3`,
    [userId, campaignId, campaign.dailyLimit]
  )

  let generated = 0
  let skipped = 0

  for (const row of contacts.rows) {
    const contact = row as Contact

    // Skip if no email for email channel
    if (campaign.channels[0] === 'email' && !contact.email) {
      skipped++
      continue
    }

    const outreachContact: OutreachContact = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      title: contact.title,
      company: contact.companyName,
      industry: contact.industry,
      companySize: contact.companySize,
      linkedinUrl: contact.linkedinUrl,
    }

    try {
      const message = await generateOutreachMessage(
        outreachContact,
        senderContext,
        campaign.channels[0] as 'email' | 'linkedin' | 'twitter',
        campaign.personalityMode
      )

      // Store message
      const messageId = uuidv4()
      await query(
        `INSERT INTO outreach_messages (
          id, user_id, contact_id, channel, subject, body,
          ai_generated, personalization_factors, personality_mode,
          status, scheduled_at, requires_approval
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          messageId,
          userId,
          contact.id,
          campaign.channels[0],
          message.subject,
          message.body,
          true,
          JSON.stringify(message.personalizationFactors),
          campaign.personalityMode,
          options.requireApproval ? 'draft' : 'scheduled',
          options.scheduleAt || new Date(),
          options.requireApproval || false,
        ]
      )

      // Link to campaign
      await query(
        `INSERT INTO campaign_contacts (campaign_id, contact_id, message_id, status)
         VALUES ($1, $2, $3, 'queued')`,
        [campaignId, contact.id, messageId]
      )

      generated++
    } catch (error) {
      console.error(`Failed to generate message for contact ${contact.id}:`, error)
      skipped++
    }
  }

  return { generated, skipped }
}

/**
 * Send a single message via the appropriate channel
 */
export async function sendMessage(messageId: string): Promise<{
  success: boolean
  providerMessageId?: string
  error?: string
}> {
  // Get message
  const result = await query<Record<string, unknown>>(
    `SELECT m.*, c.email, c.twitter_handle, c.linkedin_url, c.first_name
     FROM outreach_messages m
     JOIN outreach_contacts c ON m.contact_id = c.id
     WHERE m.id = $1`,
    [messageId]
  )

  if (result.rows.length === 0) {
    return { success: false, error: 'Message not found' }
  }

  const message = result.rows[0]

  // Update status to sending
  await query(
    "UPDATE outreach_messages SET status = 'sending', updated_at = NOW() WHERE id = $1",
    [messageId]
  )

  try {
    let providerMessageId: string | undefined

    switch (message.channel) {
      case 'email':
        providerMessageId = await sendEmail(
          message.email as string,
          message.subject as string,
          message.body as string,
          message.first_name as string
        )
        break

      case 'twitter_dm':
        providerMessageId = await sendTwitterDM(
          message.twitter_handle as string,
          message.body as string
        )
        break

      case 'linkedin_dm':
      case 'linkedin_connection':
        providerMessageId = await sendLinkedIn(
          message.linkedin_url as string,
          message.body as string,
          message.channel === 'linkedin_connection'
        )
        break

      default:
        throw new Error(`Unsupported channel: ${message.channel}`)
    }

    // Update message status
    await query(
      `UPDATE outreach_messages
       SET status = 'sent', sent_at = NOW(), provider_message_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [messageId, providerMessageId]
    )

    // Update contact status
    await query(
      `UPDATE outreach_contacts
       SET status = 'contacted', last_contacted_at = NOW(), total_messages_sent = total_messages_sent + 1
       WHERE id = $1`,
      [message.contact_id]
    )

    // Record event
    await recordEvent(messageId, message.contact_id as string, 'sent')

    return { success: true, providerMessageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await query(
      `UPDATE outreach_messages
       SET status = 'failed', error_message = $2, updated_at = NOW()
       WHERE id = $1`,
      [messageId, errorMessage]
    )

    return { success: false, error: errorMessage }
  }
}

// ============================================================================
// CHANNEL PROVIDERS
// ============================================================================

/**
 * Send email via Resend
 */
async function sendEmail(
  to: string,
  subject: string,
  body: string,
  recipientName?: string
): Promise<string> {
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not configured')
  }

  // Format body for HTML email
  const htmlBody = body
    .split('\n')
    .map(line => `<p>${line}</p>`)
    .join('')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.OUTREACH_FROM_EMAIL || 'wells@wellsai.com',
      to,
      subject,
      html: htmlBody,
      text: body,
      headers: {
        'X-Entity-Ref-ID': uuidv4(), // For tracking
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Resend error: ${error.message || response.statusText}`)
  }

  const data = await response.json()
  return data.id
}

/**
 * Send Twitter DM
 */
async function sendTwitterDM(handle: string, message: string): Promise<string> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN

  if (!bearerToken) {
    throw new Error('TWITTER_BEARER_TOKEN not configured')
  }

  // First, get user ID from handle
  const userLookup = await fetch(
    `https://api.twitter.com/2/users/by/username/${handle.replace('@', '')}`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
    }
  )

  if (!userLookup.ok) {
    throw new Error(`Could not find Twitter user: ${handle}`)
  }

  const userData = await userLookup.json()
  const recipientId = userData.data.id

  // Send DM
  const response = await fetch('https://api.twitter.com/2/dm_conversations/with/:participant_id/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: message,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Twitter DM error: ${error.detail || response.statusText}`)
  }

  const data = await response.json()
  return data.data.dm_event_id
}

/**
 * Send LinkedIn message or connection request
 * Note: Requires LinkedIn API access (not publicly available)
 */
async function sendLinkedIn(
  profileUrl: string,
  message: string,
  isConnectionRequest: boolean
): Promise<string> {
  // LinkedIn API requires partner access
  // This is a placeholder - in production, you'd use:
  // 1. LinkedIn Marketing API (requires approval)
  // 2. Third-party service like PhantomBuster
  // 3. Manual queue for human sending

  console.log(`[LinkedIn] Would send to ${profileUrl}: ${message}`)

  // For now, return a mock ID
  return `linkedin_${uuidv4()}`
}

// ============================================================================
// EVENT TRACKING
// ============================================================================

/**
 * Record an outreach event
 */
export async function recordEvent(
  messageId: string,
  contactId: string,
  eventType: string,
  data?: {
    replyContent?: string
    replySentiment?: string
    replyIntent?: string
    webhookPayload?: unknown
  }
): Promise<string> {
  const eventId = uuidv4()

  await query(
    `INSERT INTO outreach_events (
      id, message_id, contact_id, event_type,
      reply_content, reply_sentiment, reply_intent, webhook_payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      eventId,
      messageId,
      contactId,
      eventType,
      data?.replyContent,
      data?.replySentiment,
      data?.replyIntent,
      data?.webhookPayload ? JSON.stringify(data.webhookPayload) : null,
    ]
  )

  // Update message status based on event
  const statusMap: Record<string, string> = {
    delivered: 'delivered',
    opened: 'opened',
    clicked: 'clicked',
    replied: 'replied',
    bounced: 'bounced',
  }

  if (statusMap[eventType]) {
    await query(
      `UPDATE outreach_messages SET status = $1, updated_at = NOW() WHERE id = $2`,
      [statusMap[eventType], messageId]
    )
  }

  return eventId
}

/**
 * Process an incoming reply
 */
export async function processReply(
  messageId: string,
  replyContent: string
): Promise<{
  sentiment: string
  intent: string
  celebrationMessage: string
}> {
  // Get message and contact info
  const result = await query<Record<string, unknown>>(
    `SELECT m.*, c.first_name, c.last_name, c.company_name
     FROM outreach_messages m
     JOIN outreach_contacts c ON m.contact_id = c.id
     WHERE m.id = $1`,
    [messageId]
  )

  if (result.rows.length === 0) {
    throw new Error('Message not found')
  }

  const message = result.rows[0]

  // Analyze reply sentiment and intent
  const analysis = await analyzeReply(replyContent)

  // Record the reply event
  await recordEvent(messageId, message.contact_id as string, 'replied', {
    replyContent,
    replySentiment: analysis.sentiment,
    replyIntent: analysis.intent,
  })

  // Update contact status
  await query(
    `UPDATE outreach_contacts
     SET status = 'responded', last_response_at = NOW(), total_replies = total_replies + 1
     WHERE id = $1`,
    [message.contact_id]
  )

  // Record win if positive
  if (analysis.sentiment === 'positive' || analysis.sentiment === 'interested') {
    await recordWin(message.user_id as string, message.contact_id as string, messageId, 'reply')
  }

  // Generate celebration message
  const contactName = [message.first_name, message.last_name].filter(Boolean).join(' ') || 'Someone'
  const celebrationMessage = await celebrateWin({
    type: 'reply',
    contactName,
    companyName: message.company_name as string,
    messagesSent: 1,
  })

  return {
    sentiment: analysis.sentiment,
    intent: analysis.intent,
    celebrationMessage,
  }
}

/**
 * Analyze reply content for sentiment and intent
 */
async function analyzeReply(content: string): Promise<{
  sentiment: string
  intent: string
}> {
  // Quick pattern matching first
  const lowerContent = content.toLowerCase()

  // Positive signals
  if (/\b(yes|interested|tell me more|let's talk|schedule|call|meet)\b/.test(lowerContent)) {
    return { sentiment: 'interested', intent: 'meeting_request' }
  }

  // Negative signals
  if (/\b(no|not interested|unsubscribe|stop|remove)\b/.test(lowerContent)) {
    return { sentiment: 'not_interested', intent: 'decline' }
  }

  // Forward signals
  if (/\b(forward|pass|colleague|someone else|cc|copy)\b/.test(lowerContent)) {
    return { sentiment: 'neutral', intent: 'forward_to_colleague' }
  }

  // Question signals
  if (/\?/.test(content)) {
    return { sentiment: 'neutral', intent: 'question' }
  }

  return { sentiment: 'neutral', intent: 'unclear' }
}

/**
 * Record a win
 */
async function recordWin(
  userId: string,
  contactId: string,
  messageId: string,
  winType: string
): Promise<void> {
  await query(
    `INSERT INTO outreach_wins (user_id, contact_id, message_id, win_type, messages_sent)
     VALUES ($1, $2, $3, $4, 1)`,
    [userId, contactId, messageId, winType]
  )
}

// ============================================================================
// CAMPAIGN STATS & REPORTING
// ============================================================================

/**
 * Get campaign statistics
 */
export async function getCampaignStats(
  userId: string,
  campaignId: string
): Promise<{
  campaign: Campaign
  stats: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    replied: number
    bounced: number
    unsubscribed: number
  }
  replyRate: number
  openRate: number
  topPerformers: Array<{ contact: Contact; outcome: string }>
}> {
  const campaignResult = await query<Record<string, unknown>>(
    'SELECT * FROM outreach_campaigns WHERE id = $1 AND user_id = $2',
    [campaignId, userId]
  )

  if (campaignResult.rows.length === 0) {
    throw new Error('Campaign not found')
  }

  const campaign = mapRowToCampaign(campaignResult.rows[0])

  // Get stats
  const statsResult = await query<Record<string, string>>(
    `SELECT
       COUNT(CASE WHEN status IN ('sent', 'delivered', 'opened', 'clicked', 'replied') THEN 1 END) as sent,
       COUNT(CASE WHEN status IN ('delivered', 'opened', 'clicked', 'replied') THEN 1 END) as delivered,
       COUNT(CASE WHEN status IN ('opened', 'clicked', 'replied') THEN 1 END) as opened,
       COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked,
       COUNT(CASE WHEN status = 'replied' THEN 1 END) as replied,
       COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced
     FROM outreach_messages m
     JOIN campaign_contacts cc ON m.id = cc.message_id
     WHERE cc.campaign_id = $1`,
    [campaignId]
  )

  const stats = {
    sent: parseInt(statsResult.rows[0].sent || '0', 10),
    delivered: parseInt(statsResult.rows[0].delivered || '0', 10),
    opened: parseInt(statsResult.rows[0].opened || '0', 10),
    clicked: parseInt(statsResult.rows[0].clicked || '0', 10),
    replied: parseInt(statsResult.rows[0].replied || '0', 10),
    bounced: parseInt(statsResult.rows[0].bounced || '0', 10),
    unsubscribed: 0,
  }

  const replyRate = stats.delivered > 0 ? (stats.replied / stats.delivered) * 100 : 0
  const openRate = stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0

  // Get top performers (people who replied positively)
  const topResult = await query<Record<string, unknown>>(
    `SELECT c.*, e.reply_sentiment as outcome
     FROM outreach_contacts c
     JOIN outreach_messages m ON c.id = m.contact_id
     JOIN campaign_contacts cc ON m.id = cc.message_id
     JOIN outreach_events e ON m.id = e.message_id
     WHERE cc.campaign_id = $1 AND e.event_type = 'replied'
     ORDER BY e.created_at DESC
     LIMIT 5`,
    [campaignId]
  )

  const topPerformers = topResult.rows.map(row => ({
    contact: row as Contact,
    outcome: row.outcome as string,
  }))

  return {
    campaign,
    stats,
    replyRate: Math.round(replyRate * 10) / 10,
    openRate: Math.round(openRate * 10) / 10,
    topPerformers,
  }
}

/**
 * Get overall outreach stats for a user
 */
export async function getUserOutreachStats(userId: string): Promise<{
  totalContacts: number
  totalSent: number
  totalReplies: number
  totalMeetings: number
  overallReplyRate: number
  activeCompaigns: number
  recentWins: Array<{ type: string; contactName: string; date: Date }>
}> {
  const [contacts, messages, wins, campaigns] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) as count FROM outreach_contacts WHERE user_id = $1', [userId]),
    query<{ sent: string; replied: string }>(
      `SELECT
         COUNT(CASE WHEN status IN ('sent', 'delivered', 'opened', 'clicked', 'replied') THEN 1 END) as sent,
         COUNT(CASE WHEN status = 'replied' THEN 1 END) as replied
       FROM outreach_messages WHERE user_id = $1`,
      [userId]
    ),
    query<{ type: string; contact_name: string; created_at: string }>(
      `SELECT w.win_type as type, c.first_name || ' ' || c.last_name as contact_name, w.created_at
       FROM outreach_wins w
       JOIN outreach_contacts c ON w.contact_id = c.id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC
       LIMIT 5`,
      [userId]
    ),
    query<{ count: string }>(
      "SELECT COUNT(*) as count FROM outreach_campaigns WHERE user_id = $1 AND status = 'active'",
      [userId]
    ),
  ])

  const totalSent = parseInt(messages.rows[0]?.sent || '0', 10)
  const totalReplies = parseInt(messages.rows[0]?.replied || '0', 10)

  return {
    totalContacts: parseInt(contacts.rows[0].count, 10),
    totalSent,
    totalReplies,
    totalMeetings: 0, // Would come from meeting tracking
    overallReplyRate: totalSent > 0 ? Math.round((totalReplies / totalSent) * 1000) / 10 : 0,
    activeCompaigns: parseInt(campaigns.rows[0].count, 10),
    recentWins: wins.rows.map(w => ({
      type: w.type,
      contactName: w.contact_name,
      date: new Date(w.created_at),
    })),
  }
}

// ============================================================================
// MESSAGE APPROVAL WORKFLOW
// ============================================================================

/**
 * Get messages pending approval
 */
export async function getPendingApprovals(userId: string): Promise<Array<{
  message: OutreachMessage
  contact: Contact
}>> {
  const result = await query<Record<string, unknown>>(
    `SELECT m.*, c.*
     FROM outreach_messages m
     JOIN outreach_contacts c ON m.contact_id = c.id
     WHERE m.user_id = $1 AND m.requires_approval = true AND m.status = 'draft'
     ORDER BY m.created_at ASC
     LIMIT 20`,
    [userId]
  )

  return result.rows.map(row => ({
    message: {
      id: row.id as string,
      userId: row.user_id as string,
      contactId: row.contact_id as string,
      channel: row.channel as OutreachMessage['channel'],
      subject: row.subject as string | undefined,
      body: row.body as string,
      personalizationFactors: (row.personalization_factors as string[]) || [],
      personalityMode: (row.personality_mode as PersonalityMode) || 'default',
      status: row.status as OutreachMessage['status'],
      requiresApproval: row.requires_approval as boolean,
      createdAt: new Date(row.created_at as string),
    },
    contact: row as Contact,
  }))
}

/**
 * Approve a message for sending
 */
export async function approveMessage(messageId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE outreach_messages
     SET status = 'scheduled', approved_at = NOW(), approved_by = $2, scheduled_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'draft'
     RETURNING id`,
    [messageId, userId]
  )

  return result.rowCount > 0
}

/**
 * Reject a message with optional reason
 */
export async function rejectMessage(
  messageId: string,
  userId: string,
  reason?: string
): Promise<boolean> {
  const result = await query(
    `UPDATE outreach_messages
     SET status = 'failed', rejected_at = NOW(), rejection_reason = $3
     WHERE id = $1 AND user_id = $2 AND status = 'draft'
     RETURNING id`,
    [messageId, userId, reason]
  )

  return result.rowCount > 0
}

/**
 * Regenerate a message with new content
 */
export async function regenerateMessage(
  messageId: string,
  userId: string,
  senderContext: MessageContext
): Promise<GeneratedMessage> {
  // Get existing message and contact
  const result = await query<Record<string, unknown>>(
    `SELECT m.*, c.*
     FROM outreach_messages m
     JOIN outreach_contacts c ON m.contact_id = c.id
     WHERE m.id = $1 AND m.user_id = $2`,
    [messageId, userId]
  )

  if (result.rows.length === 0) {
    throw new Error('Message not found')
  }

  const row = result.rows[0]
  const contact: OutreachContact = {
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    title: row.title as string,
    company: row.company_name as string,
    industry: row.industry as string,
    companySize: row.company_size as string,
    linkedinUrl: row.linkedin_url as string,
  }

  // Generate new message
  const newMessage = await generateOutreachMessage(
    contact,
    senderContext,
    row.channel as 'email' | 'linkedin' | 'twitter',
    (row.personality_mode as PersonalityMode) || 'default'
  )

  // Update message in database
  await query(
    `UPDATE outreach_messages
     SET subject = $2, body = $3, personalization_factors = $4, updated_at = NOW()
     WHERE id = $1`,
    [messageId, newMessage.subject, newMessage.body, JSON.stringify(newMessage.personalizationFactors)]
  )

  return newMessage
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createCampaign,
  previewCampaign,
  generateCampaignMessages,
  sendMessage,
  recordEvent,
  processReply,
  getCampaignStats,
  getUserOutreachStats,
  getPendingApprovals,
  approveMessage,
  rejectMessage,
  regenerateMessage,
}
