/**
 * CRM Multi-Channel Outreach Engine
 *
 * Handles sending messages across email, SMS, Twitter DM, and LinkedIn
 * Uses existing notification integrations and adds social media support
 */

import { query } from '../db'
import { sendEmail, sendBulkEmails } from '../notifications/resend'
import { sendSMS, sendBulkSMS } from '../notifications/twilio'
import { getContact, getContacts } from './contacts'
import { renderTemplate } from './templates'
import type {
  Contact,
  Campaign,
  OutreachMessage,
  OutreachRequest,
  BulkOutreachResult
} from './types'

// ============================================================================
// Types
// ============================================================================

export interface OutreachResult {
  success: boolean
  messageId?: string
  externalId?: string
  error?: string
}

export interface ChannelConfig {
  email: {
    fromEmail?: string
    replyTo?: string
    trackOpens?: boolean
    trackClicks?: boolean
  }
  sms: {
    fromNumber?: string
  }
  twitter: {
    accessToken?: string
    accessTokenSecret?: string
  }
  linkedin: {
    accessToken?: string
  }
}

// Rate limits per channel (messages per minute)
const RATE_LIMITS = {
  email: 100,
  sms: 30,
  twitter: 15,
  linkedin: 10
}

// ============================================================================
// Twitter DM Integration (Twitter API v2)
// ============================================================================

interface TwitterClient {
  accessToken: string
  accessTokenSecret?: string
}

async function getTwitterClient(): Promise<TwitterClient | null> {
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET

  if (!accessToken) {
    return null
  }

  return { accessToken, accessTokenSecret }
}

/**
 * Send a Twitter Direct Message using Twitter API v2
 */
export async function sendTwitterDM(
  recipientId: string,
  message: string
): Promise<OutreachResult> {
  try {
    const client = await getTwitterClient()

    if (!client) {
      throw new Error('Twitter API credentials not configured. Set TWITTER_ACCESS_TOKEN and TWITTER_ACCESS_TOKEN_SECRET')
    }

    // Twitter API v2 DM endpoint
    const response = await fetch('https://api.twitter.com/2/dm_conversations/with/' + recipientId + '/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${client.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: message
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Twitter API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      externalId: data.data?.dm_event_id
    }
  } catch (error) {
    console.error('Error sending Twitter DM:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send Twitter DM'
    }
  }
}

/**
 * Get Twitter user ID from handle
 */
export async function getTwitterUserId(handle: string): Promise<string | null> {
  try {
    const client = await getTwitterClient()

    if (!client) {
      throw new Error('Twitter API credentials not configured')
    }

    // Clean handle
    const cleanHandle = handle.replace('@', '')

    const response = await fetch(`https://api.twitter.com/2/users/by/username/${cleanHandle}`, {
      headers: {
        'Authorization': `Bearer ${client.accessToken}`
      }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.data?.id || null
  } catch (error) {
    console.error('Error getting Twitter user ID:', error)
    return null
  }
}

// ============================================================================
// LinkedIn Message Integration
// ============================================================================

/**
 * Send a LinkedIn message
 * Note: Requires LinkedIn Sales Navigator or Recruiter API access
 */
export async function sendLinkedInMessage(
  recipientUrn: string,
  message: string
): Promise<OutreachResult> {
  try {
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN

    if (!accessToken) {
      throw new Error('LinkedIn API credentials not configured. Set LINKEDIN_ACCESS_TOKEN')
    }

    // LinkedIn Messaging API
    const response = await fetch('https://api.linkedin.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        recipients: [recipientUrn],
        body: message
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `LinkedIn API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      externalId: data.id
    }
  } catch (error) {
    console.error('Error sending LinkedIn message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send LinkedIn message'
    }
  }
}

/**
 * Convert LinkedIn URL to URN for messaging
 */
export function linkedinUrlToUrn(url: string): string | null {
  try {
    // Extract profile ID from various LinkedIn URL formats
    const patterns = [
      /linkedin\.com\/in\/([a-zA-Z0-9-]+)/,
      /linkedin\.com\/pub\/([a-zA-Z0-9-]+)/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        // Return a placeholder - in production you'd need to lookup the actual URN
        return `urn:li:person:${match[1]}`
      }
    }

    return null
  } catch {
    return null
  }
}

// ============================================================================
// Template Variable Substitution
// ============================================================================

/**
 * Substitute template variables with contact data
 */
export function substituteVariables(
  template: string,
  contact: Contact,
  additionalVars: Record<string, string> = {}
): string {
  const variables: Record<string, string> = {
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    full_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company || '',
    title: contact.title || '',
    twitter_handle: contact.twitter_handle || '',
    ...additionalVars
  }

  // Add custom fields
  if (contact.custom_fields) {
    for (const [key, value] of Object.entries(contact.custom_fields)) {
      variables[key] = String(value)
    }
  }

  // Replace {{variable}} patterns
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] ?? match
  })
}

// ============================================================================
// Core Outreach Functions
// ============================================================================

/**
 * Send a single outreach message to a contact
 */
export async function sendOutreach(
  userId: string,
  contactId: string,
  channel: 'email' | 'sms' | 'twitter' | 'linkedin',
  options: {
    subject?: string
    body: string
    campaignId?: string
    templateId?: string
  }
): Promise<OutreachResult & { messageId?: string }> {
  // Get contact
  const contact = await getContact(userId, contactId)

  if (!contact) {
    return { success: false, error: 'Contact not found' }
  }

  // Check contact status
  if (contact.status !== 'active') {
    return { success: false, error: `Contact is ${contact.status}` }
  }

  // Substitute variables in content
  const body = substituteVariables(options.body, contact)
  const subject = options.subject ? substituteVariables(options.subject, contact) : undefined

  let result: OutreachResult

  // Send via appropriate channel
  switch (channel) {
    case 'email':
      if (!contact.email) {
        return { success: false, error: 'Contact has no email address' }
      }
      const emailResult = await sendEmail(
        contact.email,
        subject || 'Message from Wells AI',
        body
      )
      result = {
        success: emailResult.success,
        externalId: emailResult.emailId,
        error: emailResult.error
      }
      break

    case 'sms':
      if (!contact.phone) {
        return { success: false, error: 'Contact has no phone number' }
      }
      const smsResult = await sendSMS(contact.phone, body)
      result = {
        success: smsResult.success,
        externalId: smsResult.messageId,
        error: smsResult.error
      }
      break

    case 'twitter':
      if (!contact.twitter_handle) {
        return { success: false, error: 'Contact has no Twitter handle' }
      }
      const twitterId = await getTwitterUserId(contact.twitter_handle)
      if (!twitterId) {
        return { success: false, error: 'Could not resolve Twitter user ID' }
      }
      result = await sendTwitterDM(twitterId, body)
      break

    case 'linkedin':
      if (!contact.linkedin_url) {
        return { success: false, error: 'Contact has no LinkedIn URL' }
      }
      const linkedinUrn = linkedinUrlToUrn(contact.linkedin_url)
      if (!linkedinUrn) {
        return { success: false, error: 'Could not parse LinkedIn URL' }
      }
      result = await sendLinkedInMessage(linkedinUrn, body)
      break

    default:
      return { success: false, error: `Unsupported channel: ${channel}` }
  }

  // Create message record
  const messageResult = await query<OutreachMessage>(
    `INSERT INTO crm_messages (
      campaign_id, contact_id, user_id, channel, subject, body,
      status, external_id, sent_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      options.campaignId || null,
      contactId,
      userId,
      channel,
      subject || null,
      body,
      result.success ? 'sent' : 'failed',
      result.externalId || null,
      result.success ? new Date().toISOString() : null
    ]
  )

  // Update contact last_contacted_at
  if (result.success) {
    await query(
      `UPDATE crm_contacts SET last_contacted_at = NOW() WHERE id = $1`,
      [contactId]
    )
  }

  return {
    ...result,
    messageId: messageResult.rows[0]?.id
  }
}

/**
 * Send bulk outreach to multiple contacts with rate limiting
 */
export async function sendBulkOutreach(
  userId: string,
  request: OutreachRequest
): Promise<BulkOutreachResult> {
  const { contactIds, channel, subject, body, scheduledAt, campaignName } = request

  const result: BulkOutreachResult = {
    total: contactIds.length,
    queued: 0,
    sent: 0,
    failed: 0,
    errors: []
  }

  // Get rate limit for channel
  const rateLimit = RATE_LIMITS[channel]
  const delayBetweenMessages = Math.ceil(60000 / rateLimit) // ms between messages

  // If scheduled, create a pending campaign
  if (scheduledAt) {
    // Create campaign for tracking
    const campaignResult = await query<Campaign>(
      `INSERT INTO crm_campaigns (
        user_id, name, channel, subject, body, status, scheduled_at, total_recipients
      ) VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7)
      RETURNING *`,
      [
        userId,
        campaignName || `Bulk ${channel} outreach`,
        channel,
        subject || null,
        body,
        scheduledAt,
        contactIds.length
      ]
    )

    const campaignId = campaignResult.rows[0]?.id

    // Queue messages for later
    for (const contactId of contactIds) {
      await query(
        `INSERT INTO crm_messages (
          campaign_id, contact_id, user_id, channel, subject, body, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [campaignId, contactId, userId, channel, subject || null, body]
      )
      result.queued++
    }

    return result
  }

  // Send immediately with rate limiting
  for (let i = 0; i < contactIds.length; i++) {
    const contactId = contactIds[i]

    try {
      const sendResult = await sendOutreach(userId, contactId, channel, {
        subject,
        body
      })

      if (sendResult.success) {
        result.sent++
      } else {
        result.failed++
        result.errors.push({
          contactId,
          message: sendResult.error || 'Unknown error'
        })
      }
    } catch (error) {
      result.failed++
      result.errors.push({
        contactId,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Apply rate limiting (except for last message)
    if (i < contactIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenMessages))
    }
  }

  return result
}

/**
 * Send a campaign to all recipients
 */
export async function sendCampaign(
  userId: string,
  campaignId: string
): Promise<BulkOutreachResult> {
  // Get campaign
  const campaignResult = await query<Campaign>(
    `SELECT * FROM crm_campaigns WHERE id = $1 AND user_id = $2`,
    [campaignId, userId]
  )

  const campaign = campaignResult.rows[0]

  if (!campaign) {
    return {
      total: 0,
      queued: 0,
      sent: 0,
      failed: 0,
      errors: [{ contactId: '', message: 'Campaign not found' }]
    }
  }

  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return {
      total: 0,
      queued: 0,
      sent: 0,
      failed: 0,
      errors: [{ contactId: '', message: `Campaign is already ${campaign.status}` }]
    }
  }

  // Update campaign status
  await query(
    `UPDATE crm_campaigns SET status = 'sending', started_at = NOW() WHERE id = $1`,
    [campaignId]
  )

  // Get target contacts
  const contactFilter: any = {}

  if (campaign.list_ids && campaign.list_ids.length > 0) {
    contactFilter.listId = campaign.list_ids[0] // TODO: support multiple lists
  }

  if (campaign.tag_filters && campaign.tag_filters.length > 0) {
    contactFilter.tags = campaign.tag_filters
  }

  contactFilter.status = 'active'

  const { contacts } = await getContacts(userId, {
    ...contactFilter,
    limit: 10000 // High limit for campaigns
  })

  // Update total recipients
  await query(
    `UPDATE crm_campaigns SET total_recipients = $1 WHERE id = $2`,
    [contacts.length, campaignId]
  )

  const result: BulkOutreachResult = {
    total: contacts.length,
    queued: 0,
    sent: 0,
    failed: 0,
    errors: []
  }

  const rateLimit = campaign.send_rate_limit || RATE_LIMITS[campaign.channel as keyof typeof RATE_LIMITS] || 60
  const delayBetweenMessages = Math.ceil(60000 / rateLimit)

  // Send to each contact
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]

    // Skip multi-channel for now - just use the campaign channel
    const channel = campaign.channel === 'multi' ? 'email' : campaign.channel

    try {
      const sendResult = await sendOutreach(userId, contact.id, channel as any, {
        subject: campaign.subject,
        body: campaign.body,
        campaignId
      })

      if (sendResult.success) {
        result.sent++
        // Update campaign sent count
        await query(
          `UPDATE crm_campaigns SET sent_count = sent_count + 1 WHERE id = $1`,
          [campaignId]
        )
      } else {
        result.failed++
        result.errors.push({
          contactId: contact.id,
          message: sendResult.error || 'Unknown error'
        })
        // Update campaign bounced count if it's a permanent failure
        if (sendResult.error?.includes('bounced') || sendResult.error?.includes('invalid')) {
          await query(
            `UPDATE crm_campaigns SET bounced_count = bounced_count + 1 WHERE id = $1`,
            [campaignId]
          )
        }
      }
    } catch (error) {
      result.failed++
      result.errors.push({
        contactId: contact.id,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Rate limiting
    if (i < contacts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenMessages))
    }
  }

  // Mark campaign as complete
  await query(
    `UPDATE crm_campaigns
    SET status = 'sent', completed_at = NOW(), delivered_count = sent_count - bounced_count
    WHERE id = $1`,
    [campaignId]
  )

  return result
}

/**
 * Get outreach message history for a contact
 */
export async function getContactMessages(
  userId: string,
  contactId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<OutreachMessage[]> {
  const { limit = 50, offset = 0 } = options

  const result = await query<OutreachMessage>(
    `SELECT * FROM crm_messages
    WHERE user_id = $1 AND contact_id = $2
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4`,
    [userId, contactId, limit, offset]
  )

  return result.rows
}

/**
 * Update message status (for webhook callbacks)
 */
export async function updateMessageStatus(
  messageId: string,
  status: OutreachMessage['status'],
  additionalData?: {
    delivered_at?: string
    opened_at?: string
    clicked_at?: string
    replied_at?: string
    error_message?: string
  }
): Promise<void> {
  const updates: string[] = ['status = $2']
  const params: any[] = [messageId, status]
  let paramIndex = 3

  if (additionalData) {
    for (const [key, value] of Object.entries(additionalData)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`)
        params.push(value)
        paramIndex++
      }
    }
  }

  await query(
    `UPDATE crm_messages SET ${updates.join(', ')} WHERE id = $1`,
    params
  )

  // Update campaign stats if part of a campaign
  const message = await query<OutreachMessage>(
    `SELECT campaign_id FROM crm_messages WHERE id = $1`,
    [messageId]
  )

  if (message.rows[0]?.campaign_id) {
    const campaignId = message.rows[0].campaign_id

    switch (status) {
      case 'delivered':
        await query(
          `UPDATE crm_campaigns SET delivered_count = delivered_count + 1 WHERE id = $1`,
          [campaignId]
        )
        break
      case 'opened':
        await query(
          `UPDATE crm_campaigns SET opened_count = opened_count + 1 WHERE id = $1`,
          [campaignId]
        )
        break
      case 'clicked':
        await query(
          `UPDATE crm_campaigns SET clicked_count = clicked_count + 1 WHERE id = $1`,
          [campaignId]
        )
        break
      case 'replied':
        await query(
          `UPDATE crm_campaigns SET replied_count = replied_count + 1 WHERE id = $1`,
          [campaignId]
        )
        break
      case 'bounced':
        await query(
          `UPDATE crm_campaigns SET bounced_count = bounced_count + 1 WHERE id = $1`,
          [campaignId]
        )
        break
    }
  }

  // Update contact engagement if positive action
  if (['opened', 'clicked', 'replied'].includes(status)) {
    const contactResult = await query<{ contact_id: string }>(
      `SELECT contact_id FROM crm_messages WHERE id = $1`,
      [messageId]
    )

    if (contactResult.rows[0]) {
      await query(
        `UPDATE crm_contacts SET
          engagement_score = engagement_score + $1,
          last_response_at = CASE WHEN $2 = 'replied' THEN NOW() ELSE last_response_at END
        WHERE id = $3`,
        [
          status === 'replied' ? 10 : status === 'clicked' ? 5 : 2,
          status,
          contactResult.rows[0].contact_id
        ]
      )
    }
  }
}
