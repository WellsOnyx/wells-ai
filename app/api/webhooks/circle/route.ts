/**
 * Circle Unified Webhook Handler
 *
 * Handles webhooks from all three Circle products:
 * 1. Payments API - Card deposit confirmations
 * 2. Programmable Wallets (W3S) - Transfer confirmations
 * 3. Payouts API - Bank withdrawal confirmations
 *
 * Webhook events:
 * - paymentIntent.created / paymentIntent.paid
 * - payment.confirmed / payment.failed
 * - transactions.complete / transactions.failed (W3S)
 * - payout.complete / payout.failed
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import {
  verifyWebhookSignature,
  parseWebhook,
  creditGrainFromDeposit,
  CIRCLE_CONFIG,
} from '@/lib/circle'

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()

  console.log(`[Circle Webhook] Request ${requestId} received`)

  try {
    // Get raw body for signature verification
    const rawBody = await req.text()
    const signature = req.headers.get('x-circle-signature')

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn(`[Circle Webhook] ${requestId} - Invalid signature`)

      // In sandbox mode, we may proceed without valid signature for testing
      if (CIRCLE_CONFIG.environment !== 'sandbox') {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
      console.warn(`[Circle Webhook] ${requestId} - Proceeding in sandbox mode despite invalid signature`)
    }

    // Parse payload
    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch (e) {
      console.error(`[Circle Webhook] ${requestId} - Invalid JSON`)
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Parse webhook into unified format
    const webhook = parseWebhook(payload)
    console.log(`[Circle Webhook] ${requestId} - Source: ${webhook.source}, Type: ${webhook.type}, Status: ${webhook.status}`)

    // Check for duplicate processing (idempotency)
    const notificationId = webhook.notificationId || webhook.paymentIntentId || webhook.payoutId || webhook.transferId
    if (notificationId) {
      const duplicate = await checkDuplicate(notificationId)
      if (duplicate) {
        console.log(`[Circle Webhook] ${requestId} - Duplicate notification ${notificationId}, skipping`)
        return NextResponse.json({
          received: true,
          status: 'duplicate',
          notificationId,
        })
      }
    }

    // Process based on source
    let result: { success: boolean; message: string; error?: string }

    switch (webhook.source) {
      case 'payments':
        result = await handlePaymentsWebhook(webhook, requestId)
        break

      case 'w3s':
        result = await handleW3SWebhook(webhook, requestId)
        break

      case 'payouts':
        result = await handlePayoutsWebhook(webhook, requestId)
        break

      default:
        console.warn(`[Circle Webhook] ${requestId} - Unknown webhook source`)
        result = { success: true, message: 'Unknown webhook type, acknowledged' }
    }

    // Record webhook for auditing
    if (notificationId) {
      await recordWebhook(notificationId, webhook.source, webhook.type, result.success)
    }

    const processingTime = Date.now() - startTime
    console.log(`[Circle Webhook] ${requestId} - Completed in ${processingTime}ms: ${result.message}`)

    return NextResponse.json({
      received: true,
      status: result.success ? 'processed' : 'error',
      message: result.message,
      requestId,
      processingTime: `${processingTime}ms`,
    })

  } catch (error: any) {
    console.error(`[Circle Webhook] ${requestId} - Error:`, error)

    // Log error for debugging
    try {
      await sql`
        INSERT INTO circle_webhook_errors (
          request_id,
          error_message,
          created_at
        ) VALUES (
          ${requestId},
          ${error.message || 'Unknown error'},
          NOW()
        )
      `
    } catch (logError) {
      // Ignore logging errors
    }

    // Return 500 to trigger Circle retry
    return NextResponse.json(
      {
        received: true,
        status: 'error',
        error: error.message || 'Internal error',
        requestId,
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// PAYMENTS WEBHOOK HANDLER
// =============================================================================

async function handlePaymentsWebhook(
  webhook: ReturnType<typeof parseWebhook>,
  requestId: string
): Promise<{ success: boolean; message: string }> {
  const { type, paymentIntentId, paymentId, status, amount, userId } = webhook

  // Handle payment intent events
  if (type.includes('paymentIntent')) {
    if (status === 'paid' || type === 'paymentIntent.paid') {
      // Payment intent completed - credit GRAIN
      if (!userId || !amount) {
        console.warn(`[Circle Webhook] ${requestId} - Missing userId or amount in payment intent`)
        return { success: true, message: 'Payment received but missing metadata' }
      }

      const result = await creditGrainFromDeposit(
        userId,
        amount,
        paymentIntentId || 'unknown',
        'card'
      )

      if (result.success) {
        return {
          success: true,
          message: `Credited ${result.grainAmount} GRAIN to user ${userId}`,
        }
      } else {
        return {
          success: false,
          message: result.error || 'Failed to credit GRAIN',
        }
      }
    }

    // Other payment intent events
    return { success: true, message: `Payment intent ${status}` }
  }

  // Handle payment events
  if (type.includes('payment')) {
    if (status === 'confirmed' || type === 'payment.confirmed') {
      // Payment confirmed - update transaction status
      if (paymentId) {
        await updateTransactionStatus(paymentId, 'confirmed')
      }
      return { success: true, message: 'Payment confirmed' }
    }

    if (status === 'failed' || type === 'payment.failed') {
      // Payment failed
      if (paymentId) {
        await updateTransactionStatus(paymentId, 'failed')
      }
      return { success: true, message: 'Payment failed, status updated' }
    }
  }

  return { success: true, message: `Payments webhook acknowledged: ${type}` }
}

// =============================================================================
// W3S (PROGRAMMABLE WALLETS) WEBHOOK HANDLER
// =============================================================================

async function handleW3SWebhook(
  webhook: ReturnType<typeof parseWebhook>,
  requestId: string
): Promise<{ success: boolean; message: string }> {
  const { type, transferId, walletId, status, amount, userId, txHash } = webhook

  // Handle transfer events
  if (type === 'transfer') {
    if (status === 'COMPLETE') {
      // Transfer completed
      console.log(`[Circle Webhook] ${requestId} - Transfer ${transferId} complete, txHash: ${txHash}`)

      if (transferId) {
        await updateTransactionStatus(transferId, 'completed', txHash)
      }

      return { success: true, message: `Transfer ${transferId} completed` }
    }

    if (status === 'FAILED') {
      // Transfer failed
      if (transferId) {
        await updateTransactionStatus(transferId, 'failed')
      }

      // If this was a withdrawal, refund the user
      if (userId && amount) {
        await refundFailedWithdrawal(userId, amount, transferId || 'unknown')
      }

      return { success: true, message: `Transfer ${transferId} failed, refunded` }
    }
  }

  // Handle wallet events
  if (type === 'wallet') {
    console.log(`[Circle Webhook] ${requestId} - Wallet ${walletId} event: ${status}`)
    return { success: true, message: `Wallet ${walletId} ${status}` }
  }

  return { success: true, message: `W3S webhook acknowledged: ${type}` }
}

// =============================================================================
// PAYOUTS WEBHOOK HANDLER
// =============================================================================

async function handlePayoutsWebhook(
  webhook: ReturnType<typeof parseWebhook>,
  requestId: string
): Promise<{ success: boolean; message: string }> {
  const { type, payoutId, status, amount, userId } = webhook

  if (type === 'payout') {
    if (status === 'complete') {
      // Payout completed - update transaction
      if (payoutId) {
        await updateTransactionStatus(payoutId, 'completed')
      }

      console.log(`[Circle Webhook] ${requestId} - Payout ${payoutId} completed for user ${userId}`)
      return { success: true, message: `Payout ${payoutId} completed` }
    }

    if (status === 'failed') {
      // Payout failed - refund user
      if (payoutId) {
        await updateTransactionStatus(payoutId, 'failed')
      }

      if (userId && amount) {
        await refundFailedWithdrawal(userId, amount, payoutId || 'unknown')
      }

      return { success: true, message: `Payout ${payoutId} failed, refunded` }
    }
  }

  return { success: true, message: `Payouts webhook acknowledged: ${type}` }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if we've already processed this notification
 */
async function checkDuplicate(notificationId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT id FROM circle_webhook_events
      WHERE notification_id = ${notificationId}
      LIMIT 1
    `
    return result.rows.length > 0
  } catch (e) {
    // Table might not exist
    return false
  }
}

/**
 * Record webhook for auditing and idempotency
 */
async function recordWebhook(
  notificationId: string,
  source: string,
  eventType: string,
  success: boolean
): Promise<void> {
  try {
    await sql`
      INSERT INTO circle_webhook_events (
        notification_id,
        source,
        event_type,
        success,
        created_at
      ) VALUES (
        ${notificationId},
        ${source},
        ${eventType},
        ${success},
        NOW()
      )
      ON CONFLICT (notification_id) DO NOTHING
    `
  } catch (e) {
    // Create table if it doesn't exist
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS circle_webhook_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          notification_id TEXT UNIQUE NOT NULL,
          source TEXT,
          event_type TEXT,
          success BOOLEAN,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      await sql`
        INSERT INTO circle_webhook_events (notification_id, source, event_type, success, created_at)
        VALUES (${notificationId}, ${source}, ${eventType}, ${success}, NOW())
        ON CONFLICT (notification_id) DO NOTHING
      `
    } catch (createError) {
      console.error('[Circle Webhook] Failed to record webhook:', createError)
    }
  }
}

/**
 * Update transaction status in database
 */
async function updateTransactionStatus(
  reference: string,
  status: 'pending' | 'confirmed' | 'completed' | 'failed',
  txHash?: string
): Promise<void> {
  try {
    if (txHash) {
      await sql`
        UPDATE grain_transactions
        SET
          status = ${status},
          payment_reference = COALESCE(payment_reference, ${txHash}),
          completed_at = CASE WHEN ${status} = 'completed' THEN NOW() ELSE completed_at END
        WHERE payment_reference = ${reference}
           OR id::text = ${reference}
      `
    } else {
      await sql`
        UPDATE grain_transactions
        SET
          status = ${status},
          completed_at = CASE WHEN ${status} = 'completed' THEN NOW() ELSE completed_at END
        WHERE payment_reference = ${reference}
           OR id::text = ${reference}
      `
    }
  } catch (e) {
    console.error('[Circle Webhook] Failed to update transaction status:', e)
  }
}

/**
 * Refund user for failed withdrawal
 */
async function refundFailedWithdrawal(
  userId: string,
  amount: number,
  reference: string
): Promise<void> {
  try {
    // Restore balance
    await sql`
      UPDATE user_wallets
      SET
        balance = balance + ${amount},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    // Record refund transaction
    await sql`
      INSERT INTO grain_transactions (
        user_id,
        type,
        grain_amount,
        grain_price,
        payment_reference,
        status,
        reason,
        created_at,
        completed_at
      ) VALUES (
        ${userId},
        'refund',
        ${amount},
        1.0,
        ${reference},
        'completed',
        'Withdrawal failed - refunded',
        NOW(),
        NOW()
      )
    `

    console.log(`[Circle Webhook] Refunded ${amount} GRAIN to user ${userId}`)
  } catch (e) {
    console.error('[Circle Webhook] Failed to refund user:', e)
  }
}

// =============================================================================
// OPTIONS for CORS
// =============================================================================

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-circle-signature',
    },
  })
}
