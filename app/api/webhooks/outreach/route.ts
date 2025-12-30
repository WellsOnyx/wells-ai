// @ts-nocheck
/**
 * Outreach Webhooks API
 *
 * Handle incoming events from email/X/LinkedIn:
 * - Email opens (Resend webhook)
 * - Email clicks
 * - Email replies (via email forwarding or Resend inbound)
 * - Twitter DM replies
 * - LinkedIn message replies
 * - Bounces and complaints
 *
 * Route replies back into WellsAI conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { recordEvent, processReply } from '@/lib/coldstart/outreach-engine'
import { celebrateWin } from '@/lib/coldstart/wells-voice'
import crypto from 'crypto'

export const runtime = 'nodejs'

// ============================================================================
// Webhook Verification
// ============================================================================

function verifyResendWebhook(payload: string, signature: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return true // Allow in dev

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

function verifyTwitterWebhook(request: NextRequest): boolean {
  // Twitter uses CRC validation for webhooks
  // This is a simplified version
  const crcToken = request.headers.get('x-twitter-webhooks-crc')
  if (!crcToken) return true // Not a CRC challenge

  // In production, implement full CRC validation
  return true
}

// ============================================================================
// POST - Receive Webhook Events
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const provider = request.headers.get('x-provider') ||
                    (request.headers.get('svix-id') ? 'resend' : 'unknown')

    const body = await request.text()

    switch (provider) {
      case 'resend':
        return handleResendWebhook(body, request.headers.get('svix-signature') || '')

      case 'twitter':
        return handleTwitterWebhook(JSON.parse(body))

      case 'linkedin':
        return handleLinkedInWebhook(JSON.parse(body))

      default:
        // Try to auto-detect based on payload
        const payload = JSON.parse(body)
        if (payload.type && payload.data?.email_id) {
          return handleResendWebhook(body, '')
        }
        return NextResponse.json({ received: true })
    }
  } catch (error) {
    console.error('[Outreach Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Resend Email Webhooks
// ============================================================================

interface ResendEvent {
  type: 'email.sent' | 'email.delivered' | 'email.opened' | 'email.clicked' | 'email.bounced' | 'email.complained'
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    click?: { link: string }
    bounce?: { type: string; message: string }
  }
}

async function handleResendWebhook(body: string, signature: string) {
  // Verify signature in production
  if (process.env.NODE_ENV === 'production' && !verifyResendWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event: ResendEvent = JSON.parse(body)
  console.log(`[Resend Webhook] ${event.type}:`, event.data.email_id)

  // Find our message by provider message ID
  const messageResult = await query<{ id: string; contact_id: string; user_id: string }>(
    'SELECT id, contact_id, user_id FROM outreach_messages WHERE provider_message_id = $1',
    [event.data.email_id]
  )

  if (messageResult.rows.length === 0) {
    console.log('[Resend Webhook] Message not found:', event.data.email_id)
    return NextResponse.json({ received: true, found: false })
  }

  const message = messageResult.rows[0]

  // Map Resend event types to our event types
  const eventTypeMap: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
  }

  const eventType = eventTypeMap[event.type] || event.type

  // Record the event
  await recordEvent(message.id, message.contact_id, eventType, {
    webhookPayload: event.data,
  })

  // Handle bounces specially
  if (eventType === 'bounced') {
    await query(
      "UPDATE outreach_contacts SET status = 'bounced', updated_at = NOW() WHERE id = $1",
      [message.contact_id]
    )
  }

  // Notify user of opens/clicks (could trigger notification)
  if (eventType === 'opened' || eventType === 'clicked') {
    await notifyUser(message.user_id, eventType, message.id)
  }

  return NextResponse.json({ received: true, processed: true })
}

// ============================================================================
// Email Reply Handler (Inbound Email)
// ============================================================================

interface InboundEmail {
  from: string
  to: string
  subject: string
  text: string
  html?: string
  in_reply_to?: string
  references?: string[]
}

export async function handleEmailReply(email: InboundEmail) {
  console.log('[Inbound Email] From:', email.from, 'Subject:', email.subject)

  // Try to find the original message by:
  // 1. in-reply-to header
  // 2. email address matching a contact we've messaged

  let messageId: string | null = null
  let contactId: string | null = null

  // Method 1: Check in-reply-to header
  if (email.in_reply_to) {
    const result = await query<{ id: string; contact_id: string }>(
      'SELECT id, contact_id FROM outreach_messages WHERE provider_message_id = $1',
      [email.in_reply_to]
    )
    if (result.rows.length > 0) {
      messageId = result.rows[0].id
      contactId = result.rows[0].contact_id
    }
  }

  // Method 2: Match by sender email
  if (!messageId) {
    const senderEmail = email.from.match(/<(.+)>$/)?.[1] || email.from
    const result = await query<{ id: string; contact_id: string }>(
      `SELECT m.id, m.contact_id
       FROM outreach_messages m
       JOIN outreach_contacts c ON m.contact_id = c.id
       WHERE LOWER(c.email) = LOWER($1)
       AND m.status IN ('sent', 'delivered', 'opened', 'clicked')
       ORDER BY m.sent_at DESC
       LIMIT 1`,
      [senderEmail]
    )
    if (result.rows.length > 0) {
      messageId = result.rows[0].id
      contactId = result.rows[0].contact_id
    }
  }

  if (!messageId || !contactId) {
    console.log('[Inbound Email] Could not match to outreach message')
    return { matched: false }
  }

  // Process the reply
  const result = await processReply(messageId, email.text)

  console.log(`[Inbound Email] Reply processed: sentiment=${result.sentiment}, intent=${result.intent}`)

  return {
    matched: true,
    messageId,
    contactId,
    ...result,
  }
}

// ============================================================================
// Twitter Webhooks
// ============================================================================

interface TwitterDMEvent {
  direct_message_events?: Array<{
    type: string
    id: string
    created_timestamp: string
    message_create: {
      sender_id: string
      target: { recipient_id: string }
      message_data: { text: string }
    }
  }>
}

async function handleTwitterWebhook(payload: TwitterDMEvent) {
  if (!payload.direct_message_events) {
    return NextResponse.json({ received: true })
  }

  for (const event of payload.direct_message_events) {
    if (event.type !== 'message_create') continue

    const senderId = event.message_create.sender_id
    const text = event.message_create.message_data.text

    // Find our message by sender's Twitter ID
    const result = await query<{ id: string; contact_id: string }>(
      `SELECT m.id, m.contact_id
       FROM outreach_messages m
       JOIN outreach_contacts c ON m.contact_id = c.id
       WHERE c.twitter_handle = $1
       AND m.channel = 'twitter_dm'
       AND m.status IN ('sent', 'delivered')
       ORDER BY m.sent_at DESC
       LIMIT 1`,
      [senderId]
    )

    if (result.rows.length > 0) {
      const message = result.rows[0]
      await processReply(message.id, text)
    }
  }

  return NextResponse.json({ received: true })
}

// ============================================================================
// LinkedIn Webhooks
// ============================================================================

interface LinkedInEvent {
  eventType: string
  conversationId: string
  message: {
    senderId: string
    text: string
  }
}

async function handleLinkedInWebhook(payload: LinkedInEvent) {
  // LinkedIn webhook handling would go here
  // Note: LinkedIn webhooks require partner-level API access

  console.log('[LinkedIn Webhook] Received:', payload.eventType)

  return NextResponse.json({ received: true })
}

// ============================================================================
// User Notification
// ============================================================================

async function notifyUser(userId: string, eventType: string, messageId: string) {
  // This could:
  // 1. Send a push notification
  // 2. Update a real-time dashboard
  // 3. Send a Slack message
  // 4. Update the Wells chat with good news

  console.log(`[Notification] User ${userId}: ${eventType} on message ${messageId}`)

  // For now, just log. In production, integrate with notification system.
}

// ============================================================================
// GET - Webhook Verification (for Twitter CRC)
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const crcToken = searchParams.get('crc_token')

  if (crcToken) {
    // Twitter CRC challenge response
    const secret = process.env.TWITTER_CONSUMER_SECRET || ''
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(crcToken)
    const responseToken = 'sha256=' + hmac.digest('base64')

    return NextResponse.json({ response_token: responseToken })
  }

  return NextResponse.json({ status: 'Webhook endpoint active' })
}
