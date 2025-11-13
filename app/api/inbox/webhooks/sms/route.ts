/**
 * Enhanced SMS Webhook Handler (Twilio)
 * POST /api/inbox/webhooks/sms
 *
 * Receives inbound SMS via Twilio, stores in unified inbox
 */

import { NextRequest, NextResponse } from 'next/server'
import { InboundMessages, MessageThreads, WebhookEvents, Contacts } from '@/lib/inbox/db'
import { understandMessage } from '@/lib/inbox/understanding'
import { monitorAPI } from '@/lib/monitoring'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/inbox/webhooks/sms', 'POST')

  try {
    const formData = await req.formData()

    // Extract Twilio SMS parameters
    const from = formData.get('From') as string // +15551234567
    const to = formData.get('To') as string // Our Twilio number
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string
    const numMedia = parseInt(formData.get('NumMedia') as string || '0')

    // Verify Twilio signature
    if (process.env.TWILIO_AUTH_TOKEN) {
      const signature = req.headers.get('x-twilio-signature')
      const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/inbox/webhooks/sms`
      const isValid = verifyTwilioSignature(url, formData, signature)

      if (!isValid) {
        console.error('[SMS WEBHOOK] Invalid Twilio signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Log webhook event
    const webhookEvent = await WebhookEvents.create({
      source: 'twilio',
      eventType: 'sms.received',
      eventId: messageSid,
      signature: req.headers.get('x-twilio-signature') || undefined,
      signatureValid: true,
      rawPayload: Object.fromEntries(formData),
      headers: Object.fromEntries(req.headers),
      processed: false,
    })

    // Determine user from recipient phone number
    const userId = await getUserIdFromPhone(to)

    if (!userId) {
      console.error('[SMS WEBHOOK] Could not determine user for phone:', to)
      await WebhookEvents.markProcessed(webhookEvent.id, false, undefined, 'User not found')

      // Still respond to Twilio
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Find or create contact
    const contact = await Contacts.findOrCreate({
      userId,
      phone: from,
      name: from, // Will be updated if we learn the name
      channel: 'sms',
    })

    // SMS thread ID is the conversation between two phone numbers
    const threadId = generateSmsThreadId(from, to)

    // Find or create thread
    let thread = await MessageThreads.findByPlatformThreadId(userId, 'sms', threadId)

    if (!thread) {
      thread = await MessageThreads.create({
        userId,
        channel: 'sms',
        platformThreadId: threadId,
        subject: `SMS with ${from}`,
        participants: [
          { phone: from, name: contact.name },
          { phone: to },
        ],
        messageCount: 0,
        status: 'active',
      })
    }

    // Parse attachments (MMS)
    const attachments = []
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string
      const mediaType = formData.get(`MediaContentType${i}`) as string

      if (mediaUrl) {
        attachments.push({
          filename: `media_${i}.${getFileExtension(mediaType)}`,
          contentType: mediaType,
          sizeBytes: 0, // Twilio doesn't provide size
          storageUrl: mediaUrl,
        })
      }
    }

    // Store inbound message
    const inboundMessage = await InboundMessages.create({
      userId,
      channel: 'sms',
      channelMessageId: messageSid,
      senderId: from,
      senderPhone: from,
      senderName: contact.name,
      body,
      attachments,
      threadId,
      internalThreadId: thread.id,
      isThreadStart: thread.messageCount === 0,
      urgency: 'normal', // Will be updated by AI
      requiresResponse: true, // SMS usually requires response
      rawPayload: Object.fromEntries(formData),
      headers: Object.fromEntries(req.headers),
    })

    // Analyze message with Claude (async)
    analyzeMessageAsync(inboundMessage.id, {
      body,
      senderName: contact.name,
      senderPhone: from,
      channel: 'sms',
      threadContext: await getThreadContext(thread.id),
    }).catch((error) => {
      console.error('[SMS WEBHOOK] Analysis error:', error)
    })

    // Mark webhook as processed
    await WebhookEvents.markProcessed(webhookEvent.id, true, inboundMessage.id)

    monitor.end(true)

    // Respond with TwiML (empty response, actual reply will be sent separately)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thanks for your message! I'll review this and get back to you shortly.</Message>
</Response>`

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    monitor.end(false)
    console.error('[SMS WEBHOOK] Error:', error)

    // Return TwiML error response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I'm having trouble processing your message. Please try again.</Message>
</Response>`

    return new NextResponse(twiml, {
      status: 500,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}

/**
 * Verify Twilio signature
 */
function verifyTwilioSignature(
  url: string,
  formData: FormData,
  signature: string | null
): boolean {
  if (!signature) return false

  const authToken = process.env.TWILIO_AUTH_TOKEN!

  // Build data string (Twilio's format)
  const params = Array.from(formData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${value}`)
    .join('')

  const data = url + params

  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(data)
    .digest('base64')

  return signature === expectedSignature
}

/**
 * Get user ID from phone number
 */
async function getUserIdFromPhone(phone: string): Promise<string | null> {
  // TODO: Query users table by phone number
  // For now, use a mapping or default user
  // const user = await db.users.findByPhone(phone)
  // return user?.id

  // For development, return default user ID
  return 'default-user'
}

/**
 * Generate SMS thread ID (conversation between two numbers)
 */
function generateSmsThreadId(phone1: string, phone2: string): string {
  // Sort numbers to ensure consistent thread ID regardless of direction
  const [a, b] = [phone1, phone2].sort()
  return `sms_${a}_${b}`
}

/**
 * Get file extension from content type
 */
function getFileExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'application/pdf': 'pdf',
  }
  return map[contentType] || 'dat'
}

/**
 * Get thread context for AI understanding
 */
async function getThreadContext(threadId: string): Promise<string[]> {
  const messages = await InboundMessages.findByThread(threadId)
  return messages.slice(-5).map((msg) => {
    const sender = msg.senderName || msg.senderPhone || 'Unknown'
    return `${sender}: ${msg.body}`
  })
}

/**
 * Analyze message with Claude (async)
 */
async function analyzeMessageAsync(
  messageId: string,
  params: {
    body: string
    senderName?: string
    senderPhone?: string
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

    console.log('[SMS ANALYSIS] Completed:', {
      messageId,
      intent: understanding.intent,
      urgency: understanding.urgency,
      requiresResponse: understanding.requiresResponse,
    })
  } catch (error) {
    console.error('[SMS ANALYSIS] Error:', error)
    throw error
  }
}
