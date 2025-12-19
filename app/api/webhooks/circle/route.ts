// @ts-nocheck
/**
 * Circle Webhook Handler - Grain & Vault Payment Confirmations
 *
 * Receives webhooks from Circle for payment events on Base L2
 * Handles: payment.completed, payment.failed, transfer.completed, transfer.failed
 *
 * Security: Verifies webhook signature using Circle's public key
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

type CircleEventType =
  | 'payment.completed'
  | 'payment.failed'
  | 'transfer.completed'
  | 'transfer.failed'
  | 'payout.completed'
  | 'payout.failed'

interface CircleWebhookEvent {
  Type: CircleEventType
  Id: string
  Timestamp: string
  Data: {
    id: string
    status: string
    amount?: {
      amount: string
      currency: string
    }
    source?: {
      id: string
      type: string
    }
    destination?: {
      id?: string
      address?: string
      type: string
    }
    metadata?: Record<string, string>
    errorCode?: string
    errorMessage?: string
    transactionHash?: string
  }
}

interface CircleWebhookPayload {
  notificationId: string
  notificationType: CircleEventType
  notification: CircleWebhookEvent
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify Circle webhook signature
 * Uses HMAC SHA256 with webhook secret
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    console.error('[Circle Webhook] No signature provided')
    return false
  }

  try {
    // Circle uses HMAC SHA256
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('[Circle Webhook] Signature verification error:', error)
    return false
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Update transaction status in database
 */
async function updateTransactionStatus(
  circleTransferId: string,
  status: 'completed' | 'failed',
  errorMessage?: string,
  transactionHash?: string
): Promise<void> {
  try {
    // Try grain_transactions first (new table)
    const grainResult = await sql`
      UPDATE grain_transactions
      SET
        status = ${status},
        payment_reference = COALESCE(payment_reference, ${transactionHash || null}),
        description = CASE WHEN ${status} = 'failed' THEN COALESCE(description, '') || ' Error: ' || ${errorMessage || 'Unknown'} ELSE description END,
        completed_at = CASE WHEN ${status} = 'completed' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE circle_transfer_id = ${circleTransferId} OR id::text = ${circleTransferId}
      RETURNING id, account_id, usd_amount, type
    `

    if (grainResult.rows.length > 0) {
      const tx = grainResult.rows[0]
      console.log(`[Circle Webhook] Updated grain transaction ${tx.id} to ${status}`)

      // If deposit completed, credit the balance
      if (status === 'completed' && tx.type === 'deposit') {
        await sql`
          UPDATE treasury_accounts
          SET usd_balance = usd_balance + ${tx.usd_amount}, updated_at = NOW()
          WHERE id = ${tx.account_id}
        `
        console.log(`[Circle Webhook] Credited $${tx.usd_amount} to account ${tx.account_id}`)
      }
      return
    }

    // Fallback to treasury_transactions (legacy)
    await sql`
      UPDATE treasury_transactions
      SET
        status = ${status},
        circle_transaction_hash = ${transactionHash || null},
        error_message = ${errorMessage || null},
        completed_at = ${status === 'completed' ? new Date() : null},
        updated_at = NOW()
      WHERE circle_transfer_id = ${circleTransferId}
    `

    console.log(`[Circle Webhook] Updated treasury transaction ${circleTransferId} to ${status}`)
  } catch (error) {
    console.error('[Circle Webhook] Database update error:', error)
    throw error
  }
}

/**
 * Get transaction details for notification
 */
async function getTransactionDetails(circleTransferId: string): Promise<{
  id: string
  userId: string
  amount: number
  currency: string
  type: string
  metadata?: Record<string, any>
} | null> {
  try {
    const result = await sql`
      SELECT id, user_id, amount, currency, transaction_type, metadata
      FROM treasury_transactions
      WHERE circle_transfer_id = ${circleTransferId}
    `

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      type: row.transaction_type,
      metadata: row.metadata,
    }
  } catch (error) {
    console.error('[Circle Webhook] Error fetching transaction:', error)
    return null
  }
}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

/**
 * Send notification for payment completion
 */
async function notifyPaymentCompleted(transaction: {
  id: string
  userId: string
  amount: number
  currency: string
  type: string
}): Promise<void> {
  try {
    // TODO: Implement notification via Slack/Email
    // For now, just log
    console.log(`[Circle Webhook] Payment completed notification:`, {
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      currency: transaction.currency,
    })

    // Integration point for Slack webhook
    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `💰 Payment Completed`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Payment Completed*\nAmount: ${transaction.amount} ${transaction.currency}\nTransaction: ${transaction.id}`,
              },
            },
          ],
        }),
      })
    }
  } catch (error) {
    console.error('[Circle Webhook] Notification error:', error)
    // Don't throw - notification failure shouldn't break webhook processing
  }
}

/**
 * Send notification for payment failure
 */
async function notifyPaymentFailed(transaction: {
  id: string
  userId: string
  amount: number
  currency: string
  type: string
}, errorMessage?: string): Promise<void> {
  try {
    console.log(`[Circle Webhook] Payment failed notification:`, {
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      currency: transaction.currency,
      error: errorMessage,
    })

    // Integration point for Slack webhook
    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `❌ Payment Failed`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Payment Failed*\nAmount: ${transaction.amount} ${transaction.currency}\nTransaction: ${transaction.id}\nError: ${errorMessage || 'Unknown error'}`,
              },
            },
          ],
        }),
      })
    }
  } catch (error) {
    console.error('[Circle Webhook] Notification error:', error)
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle payment.completed event
 */
async function handlePaymentCompleted(event: CircleWebhookEvent): Promise<void> {
  const { id, amount, transactionHash, metadata } = event.Data

  console.log(`[Circle Webhook] Payment completed: ${id}`)

  await updateTransactionStatus(id, 'completed', undefined, transactionHash)

  const transaction = await getTransactionDetails(id)
  if (transaction) {
    await notifyPaymentCompleted(transaction)
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(event: CircleWebhookEvent): Promise<void> {
  const { id, errorCode, errorMessage } = event.Data

  console.log(`[Circle Webhook] Payment failed: ${id} - ${errorMessage}`)

  const fullErrorMessage = errorCode
    ? `${errorCode}: ${errorMessage}`
    : errorMessage || 'Unknown error'

  await updateTransactionStatus(id, 'failed', fullErrorMessage)

  const transaction = await getTransactionDetails(id)
  if (transaction) {
    await notifyPaymentFailed(transaction, fullErrorMessage)
  }
}

/**
 * Handle transfer.completed event
 */
async function handleTransferCompleted(event: CircleWebhookEvent): Promise<void> {
  const { id, amount, transactionHash, metadata } = event.Data

  console.log(`[Circle Webhook] Transfer completed: ${id}`)

  await updateTransactionStatus(id, 'completed', undefined, transactionHash)

  const transaction = await getTransactionDetails(id)
  if (transaction) {
    await notifyPaymentCompleted(transaction)
  }
}

/**
 * Handle transfer.failed event
 */
async function handleTransferFailed(event: CircleWebhookEvent): Promise<void> {
  const { id, errorCode, errorMessage } = event.Data

  console.log(`[Circle Webhook] Transfer failed: ${id} - ${errorMessage}`)

  const fullErrorMessage = errorCode
    ? `${errorCode}: ${errorMessage}`
    : errorMessage || 'Unknown error'

  await updateTransactionStatus(id, 'failed', fullErrorMessage)

  const transaction = await getTransactionDetails(id)
  if (transaction) {
    await notifyPaymentFailed(transaction, fullErrorMessage)
  }
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

/**
 * POST /api/webhooks/circle
 * Receive and process Circle webhook events
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-circle-signature')

    // Verify signature
    const webhookSecret = process.env.CIRCLE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[Circle Webhook] CIRCLE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('[Circle Webhook] Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse webhook payload
    const payload: CircleWebhookPayload = JSON.parse(rawBody)
    const { notificationType, notification } = payload

    console.log(`[Circle Webhook] Received event: ${notificationType}`)

    // Process event asynchronously (don't wait for completion)
    // This ensures we return 200 OK quickly to Circle
    setImmediate(async () => {
      try {
        switch (notificationType) {
          case 'payment.completed':
            await handlePaymentCompleted(notification)
            break

          case 'payment.failed':
            await handlePaymentFailed(notification)
            break

          case 'transfer.completed':
            await handleTransferCompleted(notification)
            break

          case 'transfer.failed':
            await handleTransferFailed(notification)
            break

          case 'payout.completed':
            console.log(`[Circle Webhook] Payout completed: ${notification.Data.id}`)
            await handleTransferCompleted(notification)
            break

          case 'payout.failed':
            console.log(`[Circle Webhook] Payout failed: ${notification.Data.id}`)
            await handleTransferFailed(notification)
            break

          default:
            console.log(`[Circle Webhook] Unhandled event type: ${notificationType}`)
        }
      } catch (error) {
        console.error('[Circle Webhook] Async processing error:', error)
      }
    })

    // Return 200 OK immediately
    const processingTime = Date.now() - startTime
    return NextResponse.json(
      {
        received: true,
        eventType: notificationType,
        processingTime: `${processingTime}ms`,
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('[Circle Webhook] Error:', error)

    // Return 200 OK even on error to prevent Circle from retrying
    // Log the error for manual investigation
    return NextResponse.json(
      { received: true, error: 'Processing error logged' },
      { status: 200 }
    )
  }
}

/**
 * GET /api/webhooks/circle
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'Circle Webhook Handler',
    timestamp: new Date().toISOString(),
  })
}

// ============================================================================
// CORS HEADERS
// ============================================================================

/**
 * OPTIONS /api/webhooks/circle
 * CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-circle-signature',
    },
  })
}
