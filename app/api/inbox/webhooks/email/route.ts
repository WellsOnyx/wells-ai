/**
 * Email Webhook Handler (Resend Inbound)
 * POST /api/inbox/webhooks/email
 *
 * Receives inbound emails via Resend webhook
 */

import { NextRequest, NextResponse } from 'next/server'
import { InboundMessages, MessageThreads, WebhookEvents } from '@/lib/inbox/db'
import { understandMessage } from '@/lib/inbox/understanding'
import { monitorAPI } from '@/lib/monitoring'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/inbox/webhooks/email', 'POST')

  try {
    // Get raw body for signature verification
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)

    // Verify Resend webhook signature
    const signature = req.headers.get('svix-signature')
    const timestamp = req.headers.get('svix-timestamp')
    const webhookId = req.headers.get('svix-id')

    if (process.env.RESEND_WEBHOOK_SECRET) {
      const isValid = verifyResendSignature(rawBody, signature, timestamp)
      if (!isValid) {
        console.error('[EMAIL WEBHOOK] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Log webhook event
    const webhookEvent = await WebhookEvents.create({
      source: 'resend',
      eventType: body.type || 'email.received',
      eventId: webhookId || undefined,
      signature: signature || undefined,
      signatureValid: true,
      rawPayload: body,
      headers: Object.fromEntries(req.headers),
      processed: false,
    })

    // Extract email data from Resend webhook
    // Format: https://resend.com/docs/api-reference/webhooks/payload
    const emailData = body.data || body

    // Determine recipient (Wells user)
    const recipientEmail = emailData.to?.[0]?.email || emailData.to
    const userId = await getUserIdFromEmail(recipientEmail)

    if (!userId) {
      console.error('[EMAIL WEBHOOK] Could not determine user for email:', recipientEmail)
      await WebhookEvents.markProcessed(webhookEvent.id, false, undefined, 'User not found')
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Extract sender info
    const fromEmail = emailData.from?.email || emailData.from
    const fromName = emailData.from?.name || extractNameFromEmail(fromEmail)

    // Extract email content
    const subject = emailData.subject || ''
    const bodyText = emailData.text || emailData.html || ''
    const bodyHtml = emailData.html

    // Extract thread ID (In-Reply-To or References header)
    const threadId = emailData.headers?.['in-reply-to'] || emailData.headers?.['message-id']
    const messageId = emailData.headers?.['message-id']

    // Find or create thread
    let thread = null
    let isThreadStart = true

    if (threadId) {
      thread = await MessageThreads.findByPlatformThreadId(userId, 'email', threadId)
      isThreadStart = false
    }

    if (!thread && threadId) {
      // Create new thread
      thread = await MessageThreads.create({
        userId,
        channel: 'email',
        platformThreadId: threadId,
        subject: subject,
        participants: [
          { email: fromEmail, name: fromName },
          { email: recipientEmail },
        ],
        messageCount: 0,
        status: 'active',
      })
    }

    // Parse attachments
    const attachments = (emailData.attachments || []).map((att: any) => ({
      filename: att.filename || att.name,
      contentType: att.contentType || att.content_type,
      sizeBytes: att.size,
      storageUrl: att.url || att.content,
    }))

    // Store inbound message
    const inboundMessage = await InboundMessages.create({
      userId,
      channel: 'email',
      channelMessageId: messageId,
      senderId: fromEmail,
      senderName: fromName,
      senderEmail: fromEmail,
      senderMetadata: {
        headers: emailData.headers,
      },
      subject,
      body: bodyText,
      htmlBody: bodyHtml,
      attachments,
      threadId,
      internalThreadId: thread?.id,
      isThreadStart,
      urgency: 'normal', // Will be updated by AI understanding
      requiresResponse: false, // Will be updated by AI understanding
      rawPayload: emailData,
      headers: Object.fromEntries(req.headers),
    })

    // Analyze message with Claude (async, don't block response)
    analyzeMessageAsync(inboundMessage.id, {
      body: bodyText,
      subject,
      senderName: fromName,
      senderEmail: fromEmail,
      channel: 'email',
      threadContext: thread?.id
        ? await getThreadContext(thread.id)
        : undefined,
    }).catch((error) => {
      console.error('[EMAIL WEBHOOK] Analysis error:', error)
    })

    // Mark webhook as processed
    await WebhookEvents.markProcessed(webhookEvent.id, true, inboundMessage.id)

    monitor.end(true)
    return NextResponse.json({
      success: true,
      messageId: inboundMessage.id,
      threadId: thread?.id,
    })
  } catch (error) {
    monitor.end(false)
    console.error('[EMAIL WEBHOOK] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process email webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Verify Resend webhook signature (Svix format)
 */
function verifyResendSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  if (!signature || !timestamp) {
    return false
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET!
  const signedPayload = `${timestamp}.${payload}`

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('base64')

  // Svix uses multiple signatures, check if any match
  const signatures = signature.split(' ')
  return signatures.some((sig) => {
    const sigParts = sig.split(',')
    return sigParts.some((part) => {
      const [, value] = part.split('=')
      return value === expectedSignature
    })
  })
}

/**
 * Get Wells user ID from recipient email
 * This should query your users table or use email routing rules
 */
async function getUserIdFromEmail(email: string): Promise<string | null> {
  // For now, extract from email format like: user123@inbox.wellsai.com
  // In production, query users table
  if (email.includes('@inbox.wellsai.com')) {
    const userId = email.split('@')[0]
    return userId
  }

  // Check if it's a known user email
  // TODO: Query users table
  // const user = await db.users.findByEmail(email)
  // return user?.id

  return null
}

/**
 * Extract name from email address
 */
function extractNameFromEmail(email: string): string {
  const local = email.split('@')[0]
  return local
    .split(/[._-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Get thread context for AI understanding
 */
async function getThreadContext(threadId: string): Promise<string[]> {
  const messages = await InboundMessages.findByThread(threadId)
  return messages.slice(-5).map((msg) => {
    const sender = msg.senderName || msg.senderEmail || 'Unknown'
    return `${sender}: ${msg.body.substring(0, 200)}`
  })
}

/**
 * Analyze message with Claude (async)
 */
async function analyzeMessageAsync(
  messageId: string,
  params: {
    body: string
    subject?: string
    senderName?: string
    senderEmail?: string
    channel: string
    threadContext?: string[]
  }
) {
  try {
    const understanding = await understandMessage(params)

    await InboundMessages.markProcessed(messageId, {
      intent: understanding.intent,
      urgency: understanding.urgency,
      sentiment: understanding.sentiment,
      entities: understanding.entities,
      actionItems: understanding.actionItems,
      requiresResponse: understanding.requiresResponse,
      suggestedResponse: understanding.suggestedResponse,
    })

    console.log('[EMAIL ANALYSIS] Completed:', {
      messageId,
      intent: understanding.intent,
      urgency: understanding.urgency,
      requiresResponse: understanding.requiresResponse,
    })
  } catch (error) {
    console.error('[EMAIL ANALYSIS] Error:', error)
    throw error
  }
}
