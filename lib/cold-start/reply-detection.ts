// @ts-nocheck
/**
 * Reply Detection Service
 *
 * Monitors LinkedIn, Gmail, and Outlook inboxes for replies to outbound messages.
 * Matches incoming emails to outreach campaigns and updates coldstart_outreach status.
 * Notifies owner via SMS, Slack, or email when prospects respond.
 *
 * Email Reply Detection:
 * - Checks connected Gmail accounts via Gmail API
 * - Checks connected Outlook accounts via Microsoft Graph API
 * - Matches replies by: recipient email, subject line threading, or tracking ID
 * - Updates coldstart_outreach status to 'replied' and stores reply content
 */

import { getCredential } from './credential-helper'

// Types
export interface OutboundMessage {
  id: string
  platform: 'linkedin' | 'email'
  recipientId: string
  recipientName: string
  recipientTitle?: string
  recipientCompany?: string
  sentAt: Date
  messagePreview: string
  campaign?: string
}

export interface DetectedReply {
  id: string
  platform: 'linkedin' | 'email'
  fromId: string
  fromName: string
  fromTitle?: string
  fromCompany?: string
  receivedAt: Date
  messagePreview: string
  originalMessageId?: string
  conversationUrl?: string
}

export interface NotificationPreferences {
  sms: boolean
  slack: boolean
  email: boolean
  phoneNumber?: string
  slackWebhook?: string
  emailAddress?: string
}

// In-memory tracking of sent messages and detected replies
const sentMessages: Map<string, OutboundMessage> = new Map()
const detectedReplies: Map<string, DetectedReply> = new Map()
const notifiedReplies: Set<string> = new Set()

// Track an outbound message
export function trackOutboundMessage(message: OutboundMessage): void {
  sentMessages.set(message.id, message)
  console.log(`[ReplyDetection] Tracking outbound to ${message.recipientName}`)
}

// Check LinkedIn inbox for new messages
export async function checkLinkedInInbox(): Promise<DetectedReply[]> {
  const cookie = await getCredential('LINKEDIN_SESSION_COOKIE')
  if (!cookie) {
    console.log('[ReplyDetection] No LinkedIn cookie - skipping inbox check')
    return []
  }

  try {
    // Fetch conversations from LinkedIn
    const res = await fetch('https://www.linkedin.com/voyager/api/messaging/conversations?keyVersion=LEGACY_INBOX', {
      headers: {
        'Cookie': `li_at=${cookie}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'X-Li-Lang': 'en_US',
      },
    })

    if (!res.ok) {
      console.error('[ReplyDetection] LinkedIn inbox fetch failed:', res.status)
      return []
    }

    const data = await res.json()
    const newReplies: DetectedReply[] = []

    // Parse conversations for new messages
    const conversations = data.elements || []

    for (const conv of conversations) {
      const lastMessage = conv.events?.[0]
      if (!lastMessage) continue

      // Check if this is from someone we messaged
      const senderId = lastMessage.from?.['com.linkedin.voyager.messaging.MessagingMember']?.miniProfile?.entityUrn
      const senderName = lastMessage.from?.['com.linkedin.voyager.messaging.MessagingMember']?.miniProfile?.firstName + ' ' +
                         lastMessage.from?.['com.linkedin.voyager.messaging.MessagingMember']?.miniProfile?.lastName

      // Skip if we sent this message (it's not a reply to us)
      if (lastMessage.subtype === 'OUTBOUND') continue

      // Check if we previously contacted this person
      const wasContacted = Array.from(sentMessages.values()).some(
        msg => msg.recipientName.toLowerCase().includes(senderName?.toLowerCase() || '')
      )

      if (wasContacted && !detectedReplies.has(lastMessage.entityUrn)) {
        const reply: DetectedReply = {
          id: lastMessage.entityUrn || `reply-${Date.now()}`,
          platform: 'linkedin',
          fromId: senderId || '',
          fromName: senderName || 'Unknown',
          fromTitle: lastMessage.from?.['com.linkedin.voyager.messaging.MessagingMember']?.miniProfile?.occupation,
          receivedAt: new Date(lastMessage.createdAt),
          messagePreview: lastMessage.eventContent?.['com.linkedin.voyager.messaging.event.MessageEvent']?.body || '',
          conversationUrl: `https://www.linkedin.com/messaging/thread/${conv.entityUrn?.split(':').pop()}/`,
        }

        detectedReplies.set(reply.id, reply)
        newReplies.push(reply)
      }
    }

    return newReplies
  } catch (error) {
    console.error('[ReplyDetection] Error checking LinkedIn inbox:', error)
    return []
  }
}

// Send notification via SMS (Twilio)
export async function sendSmsNotification(reply: DetectedReply, phoneNumber: string): Promise<boolean> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER

  if (!twilioSid || !twilioToken || !twilioFrom) {
    console.log('[ReplyDetection] Twilio not configured - skipping SMS')
    return false
  }

  try {
    const message = `🔔 Wells AI: ${reply.fromName}${reply.fromTitle ? ` (${reply.fromTitle})` : ''} replied!\n\n"${reply.messagePreview.slice(0, 100)}${reply.messagePreview.length > 100 ? '...' : ''}"\n\nView: ${reply.conversationUrl || 'LinkedIn Inbox'}`

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: twilioFrom,
        To: phoneNumber,
        Body: message,
      }),
    })

    if (res.ok) {
      console.log(`[ReplyDetection] SMS sent to ${phoneNumber}`)
      return true
    } else {
      console.error('[ReplyDetection] SMS failed:', await res.text())
      return false
    }
  } catch (error) {
    console.error('[ReplyDetection] SMS error:', error)
    return false
  }
}

// Send notification via Slack
export async function sendSlackNotification(reply: DetectedReply, webhookUrl: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔔 New Reply Detected!',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*From:*\n${reply.fromName}`,
              },
              {
                type: 'mrkdwn',
                text: `*Title:*\n${reply.fromTitle || 'N/A'}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Message:*\n>${reply.messagePreview.slice(0, 200)}${reply.messagePreview.length > 200 ? '...' : ''}`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Conversation',
                  emoji: true,
                },
                url: reply.conversationUrl || 'https://linkedin.com/messaging',
                style: 'primary',
              },
            ],
          },
        ],
      }),
    })

    if (res.ok) {
      console.log('[ReplyDetection] Slack notification sent')
      return true
    } else {
      console.error('[ReplyDetection] Slack failed:', await res.text())
      return false
    }
  } catch (error) {
    console.error('[ReplyDetection] Slack error:', error)
    return false
  }
}

// Send notification via email
export async function sendEmailNotification(reply: DetectedReply, toEmail: string): Promise<boolean> {
  // Using a simple approach - could integrate with SendGrid, Resend, etc.
  const resendKey = process.env.RESEND_API_KEY

  if (!resendKey) {
    console.log('[ReplyDetection] Email service not configured - skipping email')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Wells AI <notifications@wellsonyx.io>',
        to: toEmail,
        subject: `🔔 ${reply.fromName} replied to your message`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">New Reply Detected!</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>From:</strong> ${reply.fromName}</p>
              ${reply.fromTitle ? `<p><strong>Title:</strong> ${reply.fromTitle}</p>` : ''}
              <p><strong>Message:</strong></p>
              <blockquote style="border-left: 3px solid #007bff; padding-left: 15px; color: #555;">
                ${reply.messagePreview}
              </blockquote>
            </div>
            <a href="${reply.conversationUrl || 'https://linkedin.com/messaging'}"
               style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              View Conversation
            </a>
          </div>
        `,
      }),
    })

    if (res.ok) {
      console.log(`[ReplyDetection] Email sent to ${toEmail}`)
      return true
    } else {
      console.error('[ReplyDetection] Email failed:', await res.text())
      return false
    }
  } catch (error) {
    console.error('[ReplyDetection] Email error:', error)
    return false
  }
}

// Main function: Check for replies and send notifications
export async function checkAndNotify(preferences: NotificationPreferences): Promise<{
  newReplies: DetectedReply[]
  notificationsSent: number
}> {
  const newReplies = await checkLinkedInInbox()
  let notificationsSent = 0

  for (const reply of newReplies) {
    // Skip if already notified
    if (notifiedReplies.has(reply.id)) continue

    let notified = false

    // Send SMS if enabled
    if (preferences.sms && preferences.phoneNumber) {
      const sent = await sendSmsNotification(reply, preferences.phoneNumber)
      if (sent) notified = true
    }

    // Send Slack if enabled
    if (preferences.slack && preferences.slackWebhook) {
      const sent = await sendSlackNotification(reply, preferences.slackWebhook)
      if (sent) notified = true
    }

    // Send email if enabled
    if (preferences.email && preferences.emailAddress) {
      const sent = await sendEmailNotification(reply, preferences.emailAddress)
      if (sent) notified = true
    }

    if (notified) {
      notifiedReplies.add(reply.id)
      notificationsSent++
    }
  }

  return { newReplies, notificationsSent }
}

// Get all tracked outbound messages
export function getTrackedMessages(): OutboundMessage[] {
  return Array.from(sentMessages.values())
}

// Get all detected replies
export function getDetectedReplies(): DetectedReply[] {
  return Array.from(detectedReplies.values())
}

// Get reply stats
export function getReplyStats(): {
  totalSent: number
  totalReplies: number
  replyRate: number
  pendingResponses: number
} {
  const totalSent = sentMessages.size
  const totalReplies = detectedReplies.size
  const replyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0
  const pendingResponses = totalSent - totalReplies

  return {
    totalSent,
    totalReplies,
    replyRate: Math.round(replyRate * 10) / 10,
    pendingResponses,
  }
}

// ============================================================================
// EMAIL REPLY DETECTION (Gmail / Outlook)
// ============================================================================

import { neon, NeonQueryFunction } from '@neondatabase/serverless'

// Lazy database initialization for serverless
let _sql: NeonQueryFunction<false, false> | null = null

function getDb(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('Database URL not configured')
    }
    _sql = neon(dbUrl)
  }
  return _sql
}

export interface EmailReply {
  id: string
  platform: 'gmail' | 'outlook'
  fromEmail: string
  fromName?: string
  subject: string
  body: string
  bodyPreview: string
  receivedAt: Date
  threadId?: string
  messageId?: string
  outreachId?: string
  matchMethod: 'email' | 'subject' | 'tracking' | 'thread'
}

/**
 * Check Gmail inbox for replies to cold outreach
 */
async function checkGmailReplies(accountId: string): Promise<EmailReply[]> {
  const sql = getDb()
  const replies: EmailReply[] = []

  try {
    // Get Gmail account credentials
    const accounts = await sql`
      SELECT id, access_token, refresh_token, expires_at, email, user_id
      FROM gmail_accounts
      WHERE id = ${accountId} AND sync_status = 'active'
    `

    if (accounts.length === 0) {
      console.log('[ReplyDetection] Gmail account not found or inactive:', accountId)
      return []
    }

    const account = accounts[0]

    // Check if token needs refresh
    let accessToken = account.access_token
    if (new Date(account.expires_at) <= new Date()) {
      console.log('[ReplyDetection] Gmail token expired, refreshing...')
      const refreshed = await refreshGmailToken(account.refresh_token)
      if (refreshed) {
        accessToken = refreshed.accessToken
        await sql`
          UPDATE gmail_accounts
          SET access_token = ${refreshed.accessToken},
              expires_at = ${refreshed.expiresAt.toISOString()},
              updated_at = NOW()
          WHERE id = ${accountId}
        `
      } else {
        console.log('[ReplyDetection] Failed to refresh Gmail token')
        return []
      }
    }

    // Fetch recent inbox messages (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const query = encodeURIComponent(`in:inbox after:${Math.floor(oneDayAgo.getTime() / 1000)}`)

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error('[ReplyDetection] Gmail API error:', response.status)
      return []
    }

    const data = await response.json()
    const messages = data.messages || []

    // Get pending outreach records to match against
    const pendingOutreach = await sql`
      SELECT o.id, o.tracking_id, o.subject, o.body, o.channel,
             c.email as contact_email, c.first_name, c.full_name
      FROM coldstart_outreach o
      JOIN coldstart_contacts c ON o.contact_id = c.id
      WHERE o.channel = 'email'
        AND o.status IN ('sent', 'delivered', 'opened', 'clicked')
        AND o.sent_at > NOW() - INTERVAL '30 days'
    `

    // Build lookup maps for matching
    const emailToOutreach = new Map<string, any>()
    const trackingToOutreach = new Map<string, any>()
    const subjectToOutreach = new Map<string, any>()

    for (const outreach of pendingOutreach) {
      if (outreach.contact_email) {
        emailToOutreach.set(outreach.contact_email.toLowerCase(), outreach)
      }
      if (outreach.tracking_id) {
        trackingToOutreach.set(outreach.tracking_id, outreach)
      }
      if (outreach.subject) {
        // Normalize subject for matching (strip Re:, Fwd:, etc.)
        const normalizedSubject = normalizeSubject(outreach.subject)
        subjectToOutreach.set(normalizedSubject.toLowerCase(), outreach)
      }
    }

    // Process each message
    for (const msg of messages) {
      try {
        // Fetch full message details
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        if (!msgResponse.ok) continue

        const msgData = await msgResponse.json()
        const headers = msgData.payload?.headers || []

        // Extract header values
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value

        const fromHeader = getHeader('From') || ''
        const subject = getHeader('Subject') || ''
        const messageId = getHeader('Message-ID') || ''
        const inReplyTo = getHeader('In-Reply-To') || ''
        const references = getHeader('References') || ''
        const dateHeader = getHeader('Date')

        // Extract sender email
        const emailMatch = fromHeader.match(/<(.+?)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/)
        const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : ''
        const senderName = fromHeader.replace(/<[^>]+>/, '').trim()

        // Skip if from ourselves
        if (senderEmail === account.email?.toLowerCase()) continue

        // Try to match this reply to an outreach record
        let matchedOutreach: any = null
        let matchMethod: EmailReply['matchMethod'] = 'email'

        // Method 1: Match by sender email
        if (emailToOutreach.has(senderEmail)) {
          matchedOutreach = emailToOutreach.get(senderEmail)
          matchMethod = 'email'
        }

        // Method 2: Match by tracking ID in headers or body
        if (!matchedOutreach) {
          const bodyText = extractBodyText(msgData.payload)
          for (const [trackingId, outreach] of trackingToOutreach) {
            if (
              references.includes(trackingId) ||
              inReplyTo.includes(trackingId) ||
              bodyText.includes(trackingId)
            ) {
              matchedOutreach = outreach
              matchMethod = 'tracking'
              break
            }
          }
        }

        // Method 3: Match by subject line
        if (!matchedOutreach) {
          const normalizedSubject = normalizeSubject(subject).toLowerCase()
          if (subjectToOutreach.has(normalizedSubject)) {
            matchedOutreach = subjectToOutreach.get(normalizedSubject)
            matchMethod = 'subject'
          }
        }

        // If we found a match, record the reply
        if (matchedOutreach) {
          // Check if we already detected this reply
          const existingReply = await sql`
            SELECT id FROM coldstart_outreach
            WHERE id = ${matchedOutreach.id} AND status = 'replied'
          `

          if (existingReply.length === 0) {
            const bodyText = extractBodyText(msgData.payload)
            const bodyPreview = bodyText.slice(0, 200)

            const reply: EmailReply = {
              id: msg.id,
              platform: 'gmail',
              fromEmail: senderEmail,
              fromName: senderName,
              subject,
              body: bodyText,
              bodyPreview,
              receivedAt: dateHeader ? new Date(dateHeader) : new Date(),
              threadId: msgData.threadId,
              messageId,
              outreachId: matchedOutreach.id,
              matchMethod,
            }

            replies.push(reply)

            // Update outreach record to 'replied' status and store reply content
            await sql`
              UPDATE coldstart_outreach
              SET status = 'replied',
                  replied_at = NOW(),
                  reply_content = ${bodyText},
                  reply_message_id = ${messageId}
              WHERE id = ${matchedOutreach.id}
            `

            // Update campaign stats
            await sql`
              UPDATE coldstart_campaigns
              SET total_replied = total_replied + 1
              WHERE id = ${matchedOutreach.campaign_id}
            `

            console.log(
              `[ReplyDetection] Gmail reply detected from ${senderEmail} (matched by ${matchMethod})`
            )
          }
        }
      } catch (error) {
        console.error('[ReplyDetection] Error processing Gmail message:', error)
      }
    }

    return replies
  } catch (error) {
    console.error('[ReplyDetection] Gmail check failed:', error)
    return []
  }
}

/**
 * Check Outlook inbox for replies to cold outreach
 */
async function checkOutlookReplies(accountId: string): Promise<EmailReply[]> {
  const sql = getDb()
  const replies: EmailReply[] = []

  try {
    // Get Outlook account from inbox_connected_accounts
    const accounts = await sql`
      SELECT id, access_token, refresh_token, token_expires_at, email, user_id
      FROM inbox_connected_accounts
      WHERE id = ${accountId}
        AND channel = 'outlook'
        AND is_active = true
    `

    if (accounts.length === 0) {
      console.log('[ReplyDetection] Outlook account not found or inactive:', accountId)
      return []
    }

    const account = accounts[0]

    // Check if token needs refresh
    let accessToken = account.access_token
    if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
      console.log('[ReplyDetection] Outlook token expired, refreshing...')
      const refreshed = await refreshOutlookToken(account.refresh_token)
      if (refreshed) {
        accessToken = refreshed.accessToken
        await sql`
          UPDATE inbox_connected_accounts
          SET access_token = ${refreshed.accessToken},
              token_expires_at = ${refreshed.expiresAt.toISOString()},
              updated_at = NOW()
          WHERE id = ${accountId}
        `
      } else {
        console.log('[ReplyDetection] Failed to refresh Outlook token')
        return []
      }
    }

    // Fetch recent inbox messages using Microsoft Graph API
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const filter = encodeURIComponent(`receivedDateTime ge ${oneDayAgo}`)

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${filter}&$top=50&$select=id,conversationId,subject,bodyPreview,body,from,receivedDateTime,internetMessageId`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('[ReplyDetection] Outlook API error:', response.status)
      return []
    }

    const data = await response.json()
    const messages = data.value || []

    // Get pending outreach records to match against
    const pendingOutreach = await sql`
      SELECT o.id, o.tracking_id, o.subject, o.body, o.channel, o.campaign_id,
             c.email as contact_email, c.first_name, c.full_name
      FROM coldstart_outreach o
      JOIN coldstart_contacts c ON o.contact_id = c.id
      WHERE o.channel = 'email'
        AND o.status IN ('sent', 'delivered', 'opened', 'clicked')
        AND o.sent_at > NOW() - INTERVAL '30 days'
    `

    // Build lookup maps
    const emailToOutreach = new Map<string, any>()
    const trackingToOutreach = new Map<string, any>()
    const subjectToOutreach = new Map<string, any>()

    for (const outreach of pendingOutreach) {
      if (outreach.contact_email) {
        emailToOutreach.set(outreach.contact_email.toLowerCase(), outreach)
      }
      if (outreach.tracking_id) {
        trackingToOutreach.set(outreach.tracking_id, outreach)
      }
      if (outreach.subject) {
        const normalizedSubject = normalizeSubject(outreach.subject)
        subjectToOutreach.set(normalizedSubject.toLowerCase(), outreach)
      }
    }

    // Process each message
    for (const msg of messages) {
      try {
        const senderEmail = msg.from?.emailAddress?.address?.toLowerCase() || ''
        const senderName = msg.from?.emailAddress?.name || ''
        const subject = msg.subject || ''
        const bodyContent = msg.body?.content || msg.bodyPreview || ''
        const messageId = msg.internetMessageId || msg.id

        // Skip if from ourselves
        if (senderEmail === account.email?.toLowerCase()) continue

        // Try to match this reply to an outreach record
        let matchedOutreach: any = null
        let matchMethod: EmailReply['matchMethod'] = 'email'

        // Method 1: Match by sender email
        if (emailToOutreach.has(senderEmail)) {
          matchedOutreach = emailToOutreach.get(senderEmail)
          matchMethod = 'email'
        }

        // Method 2: Match by tracking ID in body
        if (!matchedOutreach) {
          for (const [trackingId, outreach] of trackingToOutreach) {
            if (bodyContent.includes(trackingId)) {
              matchedOutreach = outreach
              matchMethod = 'tracking'
              break
            }
          }
        }

        // Method 3: Match by subject line
        if (!matchedOutreach) {
          const normalizedSubject = normalizeSubject(subject).toLowerCase()
          if (subjectToOutreach.has(normalizedSubject)) {
            matchedOutreach = subjectToOutreach.get(normalizedSubject)
            matchMethod = 'subject'
          }
        }

        // If we found a match, record the reply
        if (matchedOutreach) {
          // Check if we already detected this reply
          const existingReply = await sql`
            SELECT id FROM coldstart_outreach
            WHERE id = ${matchedOutreach.id} AND status = 'replied'
          `

          if (existingReply.length === 0) {
            const bodyText = stripHtml(bodyContent)
            const bodyPreview = (msg.bodyPreview || bodyText.slice(0, 200)).slice(0, 200)

            const reply: EmailReply = {
              id: msg.id,
              platform: 'outlook',
              fromEmail: senderEmail,
              fromName: senderName,
              subject,
              body: bodyText,
              bodyPreview,
              receivedAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
              threadId: msg.conversationId,
              messageId,
              outreachId: matchedOutreach.id,
              matchMethod,
            }

            replies.push(reply)

            // Update outreach record
            await sql`
              UPDATE coldstart_outreach
              SET status = 'replied',
                  replied_at = NOW(),
                  reply_content = ${bodyText},
                  reply_message_id = ${messageId}
              WHERE id = ${matchedOutreach.id}
            `

            // Update campaign stats
            await sql`
              UPDATE coldstart_campaigns
              SET total_replied = total_replied + 1
              WHERE id = ${matchedOutreach.campaign_id}
            `

            console.log(
              `[ReplyDetection] Outlook reply detected from ${senderEmail} (matched by ${matchMethod})`
            )
          }
        }
      } catch (error) {
        console.error('[ReplyDetection] Error processing Outlook message:', error)
      }
    }

    return replies
  } catch (error) {
    console.error('[ReplyDetection] Outlook check failed:', error)
    return []
  }
}

/**
 * Check all connected email accounts for replies
 */
export async function checkEmailReplies(): Promise<EmailReply[]> {
  const sql = getDb()
  const allReplies: EmailReply[] = []

  try {
    // Get all active Gmail accounts
    const gmailAccounts = await sql`
      SELECT id FROM gmail_accounts WHERE sync_status = 'active'
    `

    for (const account of gmailAccounts) {
      const replies = await checkGmailReplies(account.id)
      allReplies.push(...replies)
    }

    // Get all active Outlook accounts
    const outlookAccounts = await sql`
      SELECT id FROM inbox_connected_accounts
      WHERE channel = 'outlook' AND is_active = true
    `

    for (const account of outlookAccounts) {
      const replies = await checkOutlookReplies(account.id)
      allReplies.push(...replies)
    }

    console.log(`[ReplyDetection] Email check complete: ${allReplies.length} new replies detected`)
    return allReplies
  } catch (error) {
    console.error('[ReplyDetection] Email check failed:', error)
    return []
  }
}

/**
 * Convert email replies to DetectedReply format for unified notification
 */
export function emailReplyToDetectedReply(emailReply: EmailReply): DetectedReply {
  return {
    id: emailReply.id,
    platform: 'email',
    fromId: emailReply.fromEmail,
    fromName: emailReply.fromName || emailReply.fromEmail,
    fromTitle: undefined,
    fromCompany: undefined,
    receivedAt: emailReply.receivedAt,
    messagePreview: emailReply.bodyPreview,
    originalMessageId: emailReply.outreachId,
    conversationUrl: emailReply.platform === 'gmail'
      ? `https://mail.google.com/mail/u/0/#inbox/${emailReply.threadId || emailReply.id}`
      : `https://outlook.office.com/mail/inbox/id/${emailReply.id}`,
  }
}

// ============================================================================
// EMAIL HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize subject line for matching (strip Re:, Fwd:, etc.)
 */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .replace(/^(re|fwd|fw):\s*/gi, '') // Handle multiple prefixes
    .trim()
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract plain text body from Gmail message payload
 */
function extractBodyText(payload: any): string {
  if (!payload) return ''

  // Check for multipart
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
      // Recurse for nested parts
      if (part.parts) {
        const nested = extractBodyText(part)
        if (nested) return nested
      }
    }
    // Fall back to HTML if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8')
        return stripHtml(html)
      }
    }
  }

  // Single part message
  if (payload.body?.data) {
    const content = Buffer.from(payload.body.data, 'base64').toString('utf-8')
    if (payload.mimeType === 'text/html') {
      return stripHtml(content)
    }
    return content
  }

  return ''
}

/**
 * Refresh Gmail OAuth token
 */
async function refreshGmailToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('[ReplyDetection] Gmail token refresh failed:', response.status)
      return null
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  } catch (error) {
    console.error('[ReplyDetection] Gmail token refresh error:', error)
    return null
  }
}

/**
 * Refresh Outlook OAuth token
 */
async function refreshOutlookToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.ReadWrite offline_access',
      }),
    })

    if (!response.ok) {
      console.error('[ReplyDetection] Outlook token refresh failed:', response.status)
      return null
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  } catch (error) {
    console.error('[ReplyDetection] Outlook token refresh error:', error)
    return null
  }
}
