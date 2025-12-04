// @ts-nocheck
/**
 * Reply Detection Service
 *
 * Monitors LinkedIn inbox for replies to outbound messages.
 * Notifies owner via SMS, Slack, or email when prospects respond.
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
