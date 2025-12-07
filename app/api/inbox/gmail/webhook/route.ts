/**
 * Gmail Webhook Handler
 * POST /api/inbox/gmail/webhook
 *
 * Handles push notifications from Gmail via Google Cloud Pub/Sub
 * When new mail arrives, Gmail sends a notification to trigger sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncMessages } from '@/lib/inbox/providers/gmail'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

interface PubSubMessage {
  message: {
    data: string // Base64 encoded
    messageId: string
    publishTime: string
    attributes?: Record<string, string>
  }
  subscription: string
}

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from Google Pub/Sub
    // In production, you should verify the JWT token
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.GOOGLE_PUBSUB_WEBHOOK_TOKEN

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.error('[Gmail Webhook] Invalid authorization token')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: PubSubMessage = await request.json()

    // Decode the Pub/Sub message
    const messageData = JSON.parse(
      Buffer.from(body.message.data, 'base64').toString('utf-8')
    )

    console.log('[Gmail Webhook] Received notification:', messageData)

    // Extract email address from the notification
    const emailAddress = messageData.emailAddress
    const historyId = messageData.historyId

    if (!emailAddress) {
      console.error('[Gmail Webhook] Missing emailAddress in notification')
      return NextResponse.json(
        { success: false, error: 'Missing emailAddress' },
        { status: 400 }
      )
    }

    // Find the Gmail account by email
    const accountResult = await sql`
      SELECT id, user_id, history_id
      FROM gmail_accounts
      WHERE email = ${emailAddress}
      AND sync_status = 'active'
    `

    if (accountResult.rows.length === 0) {
      console.log('[Gmail Webhook] No active account found for:', emailAddress)
      // Return 200 to acknowledge receipt even if we don't process it
      return NextResponse.json({ success: true, message: 'No active account found' })
    }

    const account = accountResult.rows[0]
    const accountId = account.id
    const storedHistoryId = account.history_id

    console.log('[Gmail Webhook] Triggering sync for account:', emailAddress)
    console.log('[Gmail Webhook] Current historyId:', storedHistoryId, 'New historyId:', historyId)

    // Trigger sync in the background (don't wait for it)
    syncMessages(accountId, { maxResults: 100 })
      .then((result) => {
        console.log(`[Gmail Webhook] Sync completed: ${result.messages.length} messages synced`)
      })
      .catch((error) => {
        console.error('[Gmail Webhook] Sync failed:', error)
      })

    // Return 200 immediately to acknowledge the webhook
    return NextResponse.json({
      success: true,
      message: 'Sync triggered',
      accountId,
      emailAddress,
    })
  } catch (error: any) {
    console.error('[Gmail Webhook] Error:', error)

    // Still return 200 to avoid Pub/Sub retries on permanent errors
    return NextResponse.json({
      success: false,
      error: error.message,
    })
  }
}

// GET endpoint for webhook verification/testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Gmail webhook endpoint is active',
    endpoint: '/api/inbox/gmail/webhook',
    method: 'POST',
  })
}
