// @ts-nocheck
/**
 * Inbound Email Webhook Handler
 *
 * Receives incoming emails via Resend's inbound webhook.
 * Verifies signature, processes, and routes appropriately.
 *
 * Endpoint: POST /api/webhooks/email/inbound
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { processInboundEmail, processWebhookEvent } from '@/lib/email/inbound-processor'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// CONFIGURATION
// ============================================================================

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || ''
const ALLOWED_TO_ADDRESSES = ['wells@wellsonyx.com']

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

function verifyResendSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  if (!RESEND_WEBHOOK_SECRET) {
    console.warn('[Email Webhook] No webhook secret configured, skipping verification')
    return true // Allow in development
  }

  if (!signature || !timestamp) {
    console.error('[Email Webhook] Missing signature or timestamp')
    return false
  }

  // Resend uses HMAC-SHA256 for webhook signatures
  const toSign = `${timestamp}.${payload}`
  const expectedSignature = crypto
    .createHmac('sha256', RESEND_WEBHOOK_SECRET)
    .update(toSign)
    .digest('hex')

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    ) || crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

// ============================================================================
// MAIN WEBHOOK HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const webhookId = uuidv4()
  console.log(`[Email Webhook] Received inbound webhook ${webhookId}`)

  try {
    // Get headers for signature verification
    const headersList = await headers()
    const signature = headersList.get('svix-signature') ||
                      headersList.get('x-resend-signature') ||
                      headersList.get('x-webhook-signature')
    const timestamp = headersList.get('svix-timestamp') ||
                      headersList.get('x-resend-timestamp') ||
                      headersList.get('x-webhook-timestamp')

    // Get raw body for signature verification
    const rawBody = await request.text()

    // Verify signature
    if (!verifyResendSignature(rawBody, signature, timestamp)) {
      console.error(`[Email Webhook] Invalid signature for ${webhookId}`)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse payload
    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch (e) {
      console.error(`[Email Webhook] Invalid JSON for ${webhookId}`)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Log the raw webhook for debugging
    await logWebhook(webhookId, 'inbound_email', payload)

    // Handle different event types from Resend
    const eventType = payload.type || 'email.received'

    if (eventType === 'email.received' || eventType === 'inbound') {
      // Inbound email - process it
      return handleInboundEmail(webhookId, payload)
    } else if (eventType.startsWith('email.')) {
      // Outbound email event (sent, delivered, opened, etc.)
      return handleOutboundEvent(webhookId, eventType, payload)
    } else {
      console.log(`[Email Webhook] Unknown event type: ${eventType}`)
      return NextResponse.json({ received: true, type: eventType })
    }
  } catch (error: any) {
    console.error(`[Email Webhook] Error processing ${webhookId}:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// INBOUND EMAIL HANDLING
// ============================================================================

async function handleInboundEmail(webhookId: string, payload: any) {
  // Fetch full email content from Resend API (webhook only has metadata)
  const parsedEmail = await processWebhookEvent(payload)

  if (!parsedEmail) {
    console.error(`[Email Webhook] Failed to parse email from webhook`)
    return NextResponse.json({
      received: true,
      processed: false,
      reason: 'parse_failed',
    })
  }

  // Validate recipient
  const toAddresses = parsedEmail.to || []

  const isForWells = toAddresses.some((addr: string) =>
    ALLOWED_TO_ADDRESSES.some(allowed =>
      addr.toLowerCase().includes(allowed.toLowerCase())
    )
  )

  if (!isForWells) {
    console.log(`[Email Webhook] Email not addressed to Wells, ignoring`)
    return NextResponse.json({
      received: true,
      processed: false,
      reason: 'not_for_wells',
    })
  }

  // Process the inbound email (now with full content)
  const result = await processInboundEmail(parsedEmail)

  console.log(`[Email Webhook] Processed inbound email:`, {
    webhookId,
    intent: result.classification.intent,
    confidence: result.classification.confidence,
    autoResponded: result.autoResponded,
    requiresReview: result.requiresHumanReview,
  })

  // Return appropriate response
  return NextResponse.json({
    received: true,
    processed: true,
    processedEmailId: result.id,
    intent: result.classification.intent,
    autoResponded: result.autoResponded,
    requiresReview: result.requiresHumanReview,
  })
}

// ============================================================================
// OUTBOUND EVENT HANDLING
// ============================================================================

async function handleOutboundEvent(webhookId: string, eventType: string, payload: any) {
  // Import the event processor
  const { processWebhookEvent } = await import('@/lib/email/wells-native-email')

  const event = {
    type: eventType,
    created_at: payload.created_at || new Date().toISOString(),
    data: payload.data || payload,
  }

  await processWebhookEvent(event)

  // Update analytics
  const emailEvent = eventType.replace('email.', '')
  await updateEmailAnalytics(emailEvent, payload.data?.email_id)

  console.log(`[Email Webhook] Processed ${eventType} event for ${payload.data?.email_id}`)

  return NextResponse.json({
    received: true,
    eventType,
    processed: true,
  })
}

// ============================================================================
// HELPERS
// ============================================================================

async function logWebhook(
  webhookId: string,
  type: string,
  payload: any
): Promise<void> {
  try {
    await query(
      `INSERT INTO webhook_logs (id, type, payload, received_at)
       VALUES ($1, $2, $3, NOW())`,
      [webhookId, type, JSON.stringify(payload)]
    )
  } catch (error) {
    console.error('[Email Webhook] Failed to log webhook:', error)
  }
}

async function updateEmailAnalytics(event: string, messageId?: string): Promise<void> {
  if (!messageId) return

  try {
    // Increment event counter in analytics
    const today = new Date().toISOString().split('T')[0]

    await query(
      `INSERT INTO email_analytics_daily (date, event_type, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (date, event_type) DO UPDATE SET
         count = email_analytics_daily.count + 1`,
      [today, event]
    )
  } catch (error) {
    console.error('[Email Webhook] Failed to update analytics:', error)
  }
}

// ============================================================================
// VERIFICATION ENDPOINT (for Resend webhook setup)
// ============================================================================

export async function GET(request: NextRequest) {
  // Return a simple acknowledgment for webhook verification
  return NextResponse.json({
    status: 'ok',
    endpoint: 'email_inbound_webhook',
    timestamp: new Date().toISOString(),
  })
}
