/**
 * WhatsApp Business Cloud API Webhook
 *
 * Receives incoming messages and status updates from WhatsApp
 * Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 *
 * Webhook URL: https://wellsai.vercel.app/api/webhooks/whatsapp
 * Verification token: Set in Meta Business Manager (WHATSAPP_WEBHOOK_VERIFY_TOKEN)
 */

import { NextRequest, NextResponse } from 'next/server'
import type { WhatsAppWebhookEvent } from '@/lib/whatsapp-business'

/**
 * GET /api/webhooks/whatsapp
 *
 * Webhook verification (required by Meta)
 * Meta sends a GET request to verify webhook URL during setup
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

    // Check if verification token matches
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WHATSAPP_WEBHOOK] Webhook verified successfully')

      // Respond with challenge to verify webhook
      return new NextResponse(challenge, { status: 200 })
    } else {
      console.error('[WHATSAPP_WEBHOOK] Verification failed', {
        mode,
        tokenMatch: token === verifyToken
      })
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      )
    }
  } catch (error: any) {
    console.error('[WHATSAPP_WEBHOOK_GET]', error)
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webhooks/whatsapp
 *
 * Receives incoming WhatsApp messages and status updates
 */
export async function POST(req: NextRequest) {
  try {
    const body: WhatsAppWebhookEvent = await req.json()

    console.log('[WHATSAPP_WEBHOOK] Received event:', JSON.stringify(body, null, 2))

    // Process each entry in the webhook event
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value

        // Process incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            await handleIncomingMessage(message, value.metadata.phone_number_id)
          }
        }

        // Process message status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status)
          }
        }
      }
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[WHATSAPP_WEBHOOK_POST]', error)

    // Still return 200 to prevent Meta from retrying
    return NextResponse.json({ success: true }, { status: 200 })
  }
}

/**
 * Handle incoming WhatsApp message
 */
async function handleIncomingMessage(
  message: {
    from: string
    id: string
    timestamp: string
    type: string
    text?: { body: string }
    button?: { payload: string; text: string }
  },
  phoneNumberId: string
) {
  try {
    console.log('[WHATSAPP_MESSAGE] Incoming message:', {
      from: message.from,
      type: message.type,
      text: message.text?.body
    })

    // Extract message content
    const messageText = message.type === 'text'
      ? message.text?.body
      : message.type === 'button'
        ? message.button?.text
        : null

    if (!messageText) {
      console.log('[WHATSAPP_MESSAGE] Skipping non-text message type:', message.type)
      return
    }

    // TODO: Find prospect by phone number
    // TODO: Mark prospect as responded
    // TODO: Classify response (qualified/unqualified)
    // TODO: Route message into Wells chat
    // TODO: Notify user in Wells

    const from = message.from

    // Mark message as read
    const { getWhatsAppClient } = await import('@/lib/whatsapp-business')
    const client = getWhatsAppClient()
    await client.markAsRead(message.id)

    console.log('[WHATSAPP_MESSAGE] Processed message from', from)

    // TODO: Implement actual message processing logic
    // For now, just log the message
    console.log('[WHATSAPP_MESSAGE] Message content:', messageText)

  } catch (error: any) {
    console.error('[WHATSAPP_MESSAGE] Failed to process message:', error)
  }
}

/**
 * Handle message status update
 */
async function handleStatusUpdate(
  status: {
    id: string
    status: 'sent' | 'delivered' | 'read' | 'failed'
    timestamp: string
    recipient_id: string
    errors?: Array<{ code: number; title: string }>
  }
) {
  try {
    console.log('[WHATSAPP_STATUS] Status update:', {
      messageId: status.id,
      status: status.status,
      recipient: status.recipient_id
    })

    // TODO: Find outreach touch by message ID
    // TODO: Update touch delivery status
    // TODO: Update campaign stats

    if (status.status === 'failed') {
      console.error('[WHATSAPP_STATUS] Message failed:', status.errors)

      // TODO: Mark touch as failed
      // TODO: Try fallback channel (Twitter, SMS, Email)
    }

    if (status.status === 'read') {
      console.log('[WHATSAPP_STATUS] Message read by recipient')

      // TODO: Update touch as read
      // TODO: Update campaign stats (whatsappRead++)
    }

  } catch (error: any) {
    console.error('[WHATSAPP_STATUS] Failed to process status:', error)
  }
}
