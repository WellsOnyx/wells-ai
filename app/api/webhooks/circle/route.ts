/**
 * Circle Webhook Handler - Grain & Vault Production
 *
 * CRITICAL PRODUCTION ENDPOINT
 *
 * Comprehensive webhook handler for Circle payment events:
 * - Card payments (payment intents)
 * - Crypto/USDC transfers
 * - Payouts/withdrawals
 * - Chargebacks
 *
 * Security:
 * - HMAC SHA256 signature verification
 * - Idempotency checks (prevent duplicate processing)
 * - Emergency controls integration
 * - Full audit trail logging
 *
 * Register webhook URL in Circle Console:
 * https://wellsai.vercel.app/api/webhooks/circle
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import * as crypto from 'crypto'
import { logFinancialEvent, logSecurityEvent, logSystemEvent } from '@/lib/security/audit-logger'
import { isOperationAllowed, freezeAccount } from '@/lib/security/emergency-controls'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Circle webhook event types we handle
 */
type CircleEventType =
  // Payment Intent events (card payments)
  | 'payments.payment_intent.completed'
  | 'payments.payment_intent.failed'
  | 'payments.payment_intent.pending'
  | 'payments.payment_intent.action_required'
  // Transfer events (crypto/USDC)
  | 'transfers.transfer.complete'
  | 'transfers.transfer.failed'
  | 'transfers.transfer.pending'
  // Payout events (withdrawals to bank)
  | 'payouts.payout.complete'
  | 'payouts.payout.failed'
  | 'payouts.payout.pending'
  // Chargeback events
  | 'chargebacks.chargeback.created'
  | 'chargebacks.chargeback.resolved'
  | 'chargebacks.chargeback.escalated'
  // Legacy event types (for backwards compatibility)
  | 'transactions.transfer.complete'
  | 'transactions.transfer.failed'
  | 'payment.completed'
  | 'payment.failed'
  | 'transfer.completed'
  | 'transfer.failed'
  | 'payout.completed'
  | 'payout.failed'

/**
 * Circle webhook payload structure
 */
interface CircleWebhookPayload {
  notificationId: string
  notificationType: CircleEventType
  notification: {
    Type: CircleEventType
    Id: string
    Timestamp: string
    Data: CircleEventData
  }
}

/**
 * Circle event data structure
 */
interface CircleEventData {
  id: string
  status: string
  amount?: {
    amount: string
    currency: string
  }
  amounts?: string[]
  source?: {
    id: string
    type: string
    address?: string
    chain?: string
  }
  destination?: {
    id?: string
    address?: string
    type: string
    chain?: string
  }
  destinationAddress?: string
  walletId?: string
  metadata?: Record<string, string>
  errorCode?: string
  errorMessage?: string
  transactionHash?: string
  txHash?: string
  // Payment intent specific
  paymentIntentId?: string
  settlementAmount?: {
    amount: string
    currency: string
  }
  // Chargeback specific
  chargebackId?: string
  chargebackAmount?: {
    amount: string
    currency: string
  }
  reason?: string
  disputeType?: string
  paymentId?: string
}

/**
 * Processing result
 */
interface ProcessingResult {
  success: boolean
  action: string
  userId?: string
  amount?: number
  error?: string
  requiresRetry?: boolean
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || process.env.CIRCLE_WEBHOOK_SECRET || ''
const COMPLIANCE_ALERT_EMAIL = process.env.COMPLIANCE_ALERT_EMAIL || 'compliance@grainvault.com'
const COMPLIANCE_SLACK_WEBHOOK = process.env.COMPLIANCE_SLACK_WEBHOOK

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify Circle webhook signature using HMAC SHA256
 * @param payload - Raw request body
 * @param signature - Signature from x-circle-signature header
 * @param secret - CIRCLE_ENTITY_SECRET
 * @returns boolean indicating if signature is valid
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

  if (!secret) {
    console.error('[Circle Webhook] No webhook secret configured')
    return false
  }

  try {
    // Circle uses HMAC SHA256
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature.toLowerCase())
    const expectedBuffer = Buffer.from(expectedSignature.toLowerCase())

    if (sigBuffer.length !== expectedBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  } catch (error) {
    console.error('[Circle Webhook] Signature verification error:', error)
    return false
  }
}

// ============================================================================
// IDEMPOTENCY CHECK
// ============================================================================

/**
 * Check if we've already processed this webhook
 * @param notificationId - Circle notification ID (unique per webhook)
 * @returns true if already processed
 */
async function isAlreadyProcessed(notificationId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT id FROM circle_webhook_events
      WHERE notification_id = ${notificationId}
      AND processed = true
      LIMIT 1
    `
    return result.rows.length > 0
  } catch (error) {
    // Table might not exist, allow processing
    return false
  }
}

/**
 * Record webhook as processed for idempotency
 */
async function recordWebhookProcessed(
  notificationId: string,
  eventType: string,
  circleEventId: string,
  result: ProcessingResult
): Promise<void> {
  try {
    await sql`
      INSERT INTO circle_webhook_events (
        id,
        notification_id,
        event_type,
        circle_event_id,
        processed,
        success,
        action_taken,
        user_id,
        amount,
        error_message,
        processed_at,
        created_at
      ) VALUES (
        gen_random_uuid(),
        ${notificationId},
        ${eventType},
        ${circleEventId},
        true,
        ${result.success},
        ${result.action},
        ${result.userId || null},
        ${result.amount || null},
        ${result.error || null},
        NOW(),
        NOW()
      )
      ON CONFLICT (notification_id) DO UPDATE SET
        processed = true,
        success = ${result.success},
        action_taken = ${result.action},
        processed_at = NOW()
    `
  } catch (error) {
    console.error('[Circle Webhook] Failed to record webhook:', error)
    // Don't throw - this is a non-critical operation
  }
}

// ============================================================================
// GRAIN PRICE CALCULATION
// ============================================================================

/**
 * Get current GRAIN price
 */
async function getCurrentGrainPrice(): Promise<number> {
  try {
    const result = await sql`
      SELECT price_usd FROM grain_price_history
      ORDER BY recorded_at DESC
      LIMIT 1
    `
    return result.rows.length > 0 ? parseFloat(result.rows[0].price_usd) : 1.0
  } catch {
    // Default to 1:1 if price history not available
    return 1.0
  }
}

/**
 * Calculate GRAIN amount from USD amount
 */
async function calculateGrainAmount(usdAmount: number): Promise<{
  grainAmount: number
  grainPrice: number
}> {
  const grainPrice = await getCurrentGrainPrice()
  const grainAmount = usdAmount / grainPrice
  return { grainAmount, grainPrice }
}

// ============================================================================
// DEPOSIT HANDLERS
// ============================================================================

/**
 * Handle successful card payment (payment intent completed)
 */
async function handlePaymentIntentCompleted(
  data: CircleEventData,
  notificationId: string
): Promise<ProcessingResult> {
  const { id, amount, metadata, settlementAmount } = data

  console.log(`[Circle Webhook] Payment intent completed: ${id}`)

  // Get amount in USD
  const depositAmount = settlementAmount?.amount
    ? parseFloat(settlementAmount.amount)
    : amount?.amount
    ? parseFloat(amount.amount)
    : 0

  if (depositAmount <= 0) {
    return {
      success: false,
      action: 'invalid_amount',
      error: 'Invalid or missing deposit amount',
    }
  }

  // Get user from metadata
  const userId = metadata?.userId || metadata?.accountId || metadata?.user_id
  if (!userId) {
    // Try to find by payment reference
    const txResult = await sql`
      SELECT user_id FROM grain_transactions
      WHERE circle_transfer_id = ${id} OR payment_reference = ${id}
      LIMIT 1
    `
    if (txResult.rows.length === 0) {
      return {
        success: false,
        action: 'user_not_found',
        error: 'No user found for payment intent',
      }
    }
  }

  // Check if deposits are allowed
  const operationCheck = await isOperationAllowed('deposit', userId || 'SYSTEM')
  if (!operationCheck.allowed) {
    await logSecurityEvent('security.block.applied', 'SYSTEM', {
      description: 'Deposit blocked by emergency controls',
      reason: operationCheck.reason,
      circleEventId: id,
      amount: depositAmount,
    }, { targetUserId: userId })

    return {
      success: false,
      action: 'blocked_by_controls',
      error: operationCheck.reason,
    }
  }

  try {
    // Calculate GRAIN amount
    const { grainAmount, grainPrice } = await calculateGrainAmount(depositAmount)

    // Update user wallet balance
    const walletUpdate = await sql`
      UPDATE user_wallets
      SET
        balance = balance + ${grainAmount},
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING balance
    `

    if (walletUpdate.rows.length === 0) {
      // User wallet doesn't exist, create it
      await sql`
        INSERT INTO user_wallets (user_id, balance, updated_at, created_at)
        VALUES (${userId}, ${grainAmount}, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_wallets.balance + ${grainAmount},
          updated_at = NOW()
      `
    }

    // Create transaction record
    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        amount,
        usd_amount,
        grain_price,
        reason,
        circle_transfer_id,
        payment_method,
        status,
        created_at,
        completed_at
      ) VALUES (
        gen_random_uuid(),
        ${userId},
        'deposit',
        ${grainAmount},
        ${depositAmount},
        ${grainPrice},
        'Card deposit via Circle',
        ${id},
        'card',
        'completed',
        NOW(),
        NOW()
      )
    `

    // Update treasury backing
    await sql`
      INSERT INTO treasury_backing (
        id,
        asset_type,
        asset_name,
        amount,
        status,
        source,
        circle_reference_id,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        'usdc',
        'USDC from card deposit',
        ${depositAmount},
        'active',
        'circle_card_deposit',
        ${id},
        NOW(),
        NOW()
      )
    `

    // Log to audit trail
    await logFinancialEvent(
      'financial.deposit.completed',
      userId,
      depositAmount,
      {
        description: 'Card deposit completed via Circle',
        grainAmount,
        grainPrice,
        circleEventId: id,
        paymentMethod: 'card',
      },
      {
        currency: 'USD',
        transactionId: id,
        result: 'success',
      }
    )

    console.log(`[Circle Webhook] Deposited ${depositAmount} USD (${grainAmount} GRAIN) for user ${userId}`)

    return {
      success: true,
      action: 'deposit_credited',
      userId,
      amount: depositAmount,
    }
  } catch (error: any) {
    console.error('[Circle Webhook] Deposit processing error:', error)

    await logFinancialEvent(
      'financial.deposit.failed',
      userId || 'UNKNOWN',
      depositAmount,
      {
        description: 'Deposit failed during processing',
        errorMessage: error.message,
        circleEventId: id,
      },
      { result: 'failure' }
    )

    return {
      success: false,
      action: 'deposit_failed',
      error: error.message,
      requiresRetry: true,
    }
  }
}

/**
 * Handle failed card payment
 */
async function handlePaymentIntentFailed(
  data: CircleEventData,
  notificationId: string
): Promise<ProcessingResult> {
  const { id, errorCode, errorMessage, metadata } = data

  console.log(`[Circle Webhook] Payment intent failed: ${id} - ${errorCode}: ${errorMessage}`)

  const userId = metadata?.userId || metadata?.accountId

  // Update any pending transaction
  await sql`
    UPDATE grain_transactions
    SET
      status = 'failed',
      error = ${errorMessage || errorCode || 'Payment failed'}
    WHERE circle_transfer_id = ${id} AND status = 'pending'
  `

  // Log to audit trail
  if (userId) {
    await logFinancialEvent(
      'financial.deposit.failed',
      userId,
      0,
      {
        description: 'Card payment failed',
        errorCode,
        errorMessage,
        circleEventId: id,
      },
      { result: 'failure' }
    )
  }

  return {
    success: true,
    action: 'payment_failure_recorded',
    userId,
  }
}

/**
 * Handle successful USDC/crypto transfer
 */
async function handleTransferComplete(
  data: CircleEventData,
  notificationId: string
): Promise<ProcessingResult> {
  const { id, amounts, amount, destinationAddress, destination, source, txHash, transactionHash, metadata } = data

  console.log(`[Circle Webhook] Transfer complete: ${id}`)

  // Parse amount
  const transferAmount = amounts?.length
    ? parseFloat(amounts[0])
    : amount?.amount
    ? parseFloat(amount.amount)
    : 0

  if (transferAmount <= 0) {
    return {
      success: false,
      action: 'invalid_amount',
      error: 'Invalid or missing transfer amount',
    }
  }

  const walletAddress = destinationAddress || destination?.address
  const txHashValue = txHash || transactionHash || 'unknown'

  // Determine if this is an incoming deposit or outgoing transfer
  const isIncoming = destination?.type === 'wallet' || (walletAddress && !source?.address)

  if (isIncoming) {
    // This is an incoming deposit - credit user
    return await processIncomingTransfer(id, walletAddress || '', transferAmount, txHashValue, metadata)
  } else {
    // This is an outgoing transfer - update status
    return await processOutgoingTransfer(id, transferAmount, txHashValue)
  }
}

/**
 * Process incoming USDC transfer (deposit)
 */
async function processIncomingTransfer(
  circleEventId: string,
  walletAddress: string,
  amount: number,
  txHash: string,
  metadata?: Record<string, string>
): Promise<ProcessingResult> {
  // Find user by wallet address or metadata
  let userId = metadata?.userId || metadata?.accountId

  if (!userId && walletAddress) {
    const userResult = await sql`
      SELECT user_id FROM user_wallets
      WHERE wallet_address = ${walletAddress}
      LIMIT 1
    `
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].user_id
    }
  }

  if (!userId) {
    // Record as pending for manual review
    await sql`
      INSERT INTO grain_treasury_events (
        type, amount, circle_transfer_id, notes, created_at
      ) VALUES (
        'pending_deposit', ${amount}, ${circleEventId},
        'No user found for wallet: ' || ${walletAddress} || '. TxHash: ' || ${txHash},
        NOW()
      )
    `

    console.log(`[Circle Webhook] No user found for wallet ${walletAddress}, recorded as pending`)

    return {
      success: true,
      action: 'pending_manual_review',
      amount,
    }
  }

  // Check if deposits are allowed
  const operationCheck = await isOperationAllowed('deposit', userId)
  if (!operationCheck.allowed) {
    return {
      success: false,
      action: 'blocked_by_controls',
      error: operationCheck.reason,
      userId,
    }
  }

  try {
    // Calculate GRAIN amount (USDC deposits are 1:1 to GRAIN base, adjusted by price)
    const { grainAmount, grainPrice } = await calculateGrainAmount(amount)

    // Credit user wallet
    await sql`
      UPDATE user_wallets
      SET balance = balance + ${grainAmount}, updated_at = NOW()
      WHERE user_id = ${userId}
    `

    // Record transaction
    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        amount,
        usd_amount,
        grain_price,
        reason,
        circle_transfer_id,
        payment_method,
        status,
        created_at,
        completed_at
      ) VALUES (
        gen_random_uuid(),
        ${userId},
        'deposit',
        ${grainAmount},
        ${amount},
        ${grainPrice},
        'USDC deposit via Circle',
        ${circleEventId},
        'usdc_transfer',
        'completed',
        NOW(),
        NOW()
      )
    `

    // Update treasury backing
    await sql`
      INSERT INTO treasury_backing (
        id,
        asset_type,
        asset_name,
        amount,
        status,
        source,
        circle_reference_id,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        'usdc',
        'USDC Transfer',
        ${amount},
        'active',
        'circle_transfer',
        ${circleEventId},
        NOW(),
        NOW()
      )
    `

    // Record treasury event
    await sql`
      INSERT INTO grain_treasury_events (
        type, amount, circle_transfer_id, notes, created_at
      ) VALUES (
        'usdc_deposit', ${amount}, ${circleEventId},
        'USDC transfer credited as GRAIN. User: ' || ${userId} || ' TxHash: ' || ${txHash},
        NOW()
      )
    `

    // Log to audit trail
    await logFinancialEvent(
      'financial.deposit.completed',
      userId,
      amount,
      {
        description: 'USDC transfer deposit completed',
        grainAmount,
        grainPrice,
        txHash,
        circleEventId,
      },
      {
        currency: 'USDC',
        transactionId: circleEventId,
        result: 'success',
      }
    )

    console.log(`[Circle Webhook] Credited ${amount} USDC (${grainAmount} GRAIN) to user ${userId}`)

    return {
      success: true,
      action: 'deposit_credited',
      userId,
      amount,
    }
  } catch (error: any) {
    console.error('[Circle Webhook] Transfer deposit error:', error)

    await logFinancialEvent(
      'financial.deposit.failed',
      userId,
      amount,
      {
        errorMessage: error.message,
        circleEventId,
      },
      { result: 'failure' }
    )

    return {
      success: false,
      action: 'deposit_failed',
      error: error.message,
      userId,
      requiresRetry: true,
    }
  }
}

/**
 * Process outgoing transfer completion
 */
async function processOutgoingTransfer(
  circleEventId: string,
  amount: number,
  txHash: string
): Promise<ProcessingResult> {
  // Update existing transaction status
  const updateResult = await sql`
    UPDATE grain_transactions
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE circle_transfer_id = ${circleEventId}
    RETURNING user_id, amount
  `

  if (updateResult.rows.length > 0) {
    const userId = updateResult.rows[0].user_id

    await logFinancialEvent(
      'financial.transfer.completed',
      userId,
      amount,
      {
        description: 'Outgoing transfer completed',
        txHash,
        circleEventId,
      },
      { result: 'success' }
    )

    return {
      success: true,
      action: 'transfer_completed',
      userId,
      amount,
    }
  }

  return {
    success: true,
    action: 'no_matching_transaction',
  }
}

/**
 * Handle failed transfer
 */
async function handleTransferFailed(
  data: CircleEventData,
  notificationId: string
): Promise<ProcessingResult> {
  const { id, errorCode, errorMessage } = data

  console.log(`[Circle Webhook] Transfer failed: ${id} - ${errorMessage}`)

  const fullErrorMessage = errorCode ? `${errorCode}: ${errorMessage}` : errorMessage || 'Unknown error'

  // Update transaction status
  const updateResult = await sql`
    UPDATE grain_transactions
    SET
      status = 'failed',
      error = ${fullErrorMessage}
    WHERE circle_transfer_id = ${id}
    RETURNING user_id, amount, type
  `

  if (updateResult.rows.length > 0) {
    const tx = updateResult.rows[0]

    // If this was a withdrawal, refund the user's balance
    if (tx.type === 'withdrawal' || tx.type === 'transfer_out') {
      await sql`
        UPDATE user_wallets
        SET balance = balance + ${parseFloat(tx.amount)}, updated_at = NOW()
        WHERE user_id = ${tx.user_id}
      `
    }

    await logFinancialEvent(
      'financial.transfer.failed',
      tx.user_id,
      parseFloat(tx.amount),
      {
        description: 'Transfer failed',
        errorCode,
        errorMessage,
        circleEventId: id,
        refunded: tx.type === 'withdrawal' || tx.type === 'transfer_out',
      },
      { result: 'failure' }
    )

    return {
      success: true,
      action: 'transfer_failure_recorded',
      userId: tx.user_id,
    }
  }

  return {
    success: true,
    action: 'no_matching_transaction',
  }
}

// ============================================================================
// PAYOUT (WITHDRAWAL) HANDLERS
// ============================================================================

/**
 * Handle successful payout (withdrawal to bank)
 */
async function handlePayoutComplete(
  data: CircleEventData,
  notificationId: string
): Promise<ProcessingResult> {
  const { id, amount, metadata, transactionHash } = data

  console.log(`[Circle Webhook] Payout complete: ${id}`)

  // Update withdrawal record
  const updateResult = await sql`
    UPDATE grain_transactions
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE (circle_transfer_id = ${id} OR payment_reference = ${id})
      AND type IN ('withdrawal', 'withdraw', 'payout')
    RETURNING user_id, amount, usd_amount
  `

  if (updateResult.rows.length === 0) {
    console.log(`[Circle Webhook] No matching withdrawal found for payout ${id}`)
    return {
      success: true,
      action: 'no_matching_withdrawal',
    }
  }

  const withdrawal = updateResult.rows[0]
  const userId = withdrawal.user_id
  const withdrawalAmount = parseFloat(withdrawal.usd_amount || withdrawal.amount)

  // Log to audit trail
  await logFinancialEvent(
    'financial.withdrawal.completed',
    userId,
    withdrawalAmount,
    {
      description: 'Bank withdrawal completed',
      circleEventId: id,
      payoutReference: transactionHash,
    },
    {
      currency: 'USD',
      transactionId: id,
      result: 'success',
    }
  )

  console.log(`[Circle Webhook] Withdrawal ${id} completed for user ${userId}`)

  return {
    success: true,
    action: 'withdrawal_completed',
    userId,
    amount: withdrawalAmount,
  }
}

/**
 * Handle failed payout
 */
async function handlePayoutFailed(
  data: CircleEventData,
  notificationId: string
): Promise<ProcessingResult> {
  const { id, errorCode, errorMessage, metadata } = data

  console.log(`[Circle Webhook] Payout failed: ${id} - ${errorMessage}`)

  const fullErrorMessage = errorCode ? `${errorCode}: ${errorMessage}` : errorMessage || 'Unknown error'

  // Find and update the withdrawal record
  const updateResult = await sql`
    UPDATE grain_transactions
    SET
      status = 'failed',
      error = ${fullErrorMessage}
    WHERE (circle_transfer_id = ${id} OR payment_reference = ${id})
      AND type IN ('withdrawal', 'withdraw', 'payout')
    RETURNING user_id, amount, usd_amount
  `

  if (updateResult.rows.length > 0) {
    const withdrawal = updateResult.rows[0]
    const userId = withdrawal.user_id
    const refundAmount = parseFloat(withdrawal.amount)

    // Refund the user's balance since withdrawal failed
    await sql`
      UPDATE user_wallets
      SET balance = balance + ${refundAmount}, updated_at = NOW()
      WHERE user_id = ${userId}
    `

    await logFinancialEvent(
      'financial.withdrawal.failed',
      userId,
      parseFloat(withdrawal.usd_amount || refundAmount),
      {
        description: 'Withdrawal failed, balance refunded',
        errorCode,
        errorMessage,
        circleEventId: id,
        refundedAmount: refundAmount,
      },
      { result: 'failure' }
    )

    return {
      success: true,
      action: 'withdrawal_failed_and_refunded',
      userId,
      amount: refundAmount,
    }
  }

  return {
    success: true,
    action: 'no_matching_withdrawal',
  }
}

// ============================================================================
// CHARGEBACK HANDLERS
// ============================================================================

/**
 * Handle chargeback initiated
 * CRITICAL: Freeze account and alert compliance
 */
async function handleChargebackCreated(
  data: CircleEventData,
  notificationId: string
): Promise<ProcessingResult> {
  const { id, chargebackId, chargebackAmount, paymentId, reason, disputeType, metadata } = data

  console.warn(`[Circle Webhook] CHARGEBACK CREATED: ${chargebackId || id}`)

  const chargebackAmountValue = chargebackAmount?.amount
    ? parseFloat(chargebackAmount.amount)
    : 0

  // Find the original payment and user
  let userId: string | null = null

  // Try to find by payment ID
  if (paymentId) {
    const paymentResult = await sql`
      SELECT user_id FROM grain_transactions
      WHERE circle_transfer_id = ${paymentId}
      LIMIT 1
    `
    if (paymentResult.rows.length > 0) {
      userId = paymentResult.rows[0].user_id
    }
  }

  // Try metadata
  if (!userId && metadata) {
    userId = metadata.userId || metadata.accountId || null
  }

  if (!userId) {
    // Log for manual investigation
    await logSecurityEvent('security.alert.triggered', 'SYSTEM', {
      alertType: 'chargeback_no_user',
      description: 'Chargeback received but no user found',
      chargebackId: chargebackId || id,
      amount: chargebackAmountValue,
      paymentId,
      reason,
    })

    return {
      success: true,
      action: 'chargeback_logged_no_user',
    }
  }

  try {
    // 1. FREEZE USER ACCOUNT
    const freezeResult = await freezeAccount(
      userId,
      `Chargeback initiated: ${reason || 'No reason provided'}. Amount: $${chargebackAmountValue}`,
      'SYSTEM',
      { ipAddress: 'circle-webhook' }
    )

    // 2. CREATE NEGATIVE TRANSACTION
    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        amount,
        usd_amount,
        reason,
        circle_transfer_id,
        status,
        created_at,
        completed_at
      ) VALUES (
        gen_random_uuid(),
        ${userId},
        'chargeback',
        ${-chargebackAmountValue},
        ${-chargebackAmountValue},
        ${'Chargeback: ' + (reason || 'Disputed transaction')},
        ${chargebackId || id},
        'completed',
        NOW(),
        NOW()
      )
    `

    // 3. DEBIT USER BALANCE (if they have funds)
    await sql`
      UPDATE user_wallets
      SET
        balance = GREATEST(balance - ${chargebackAmountValue}, 0),
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    // 4. LOG TO AUDIT TRAIL
    await logSecurityEvent('security.alert.triggered', 'SYSTEM', {
      alertType: 'chargeback',
      description: 'Chargeback initiated - account frozen',
      chargebackId: chargebackId || id,
      amount: chargebackAmountValue,
      reason,
      disputeType,
      paymentId,
      accountFrozen: freezeResult.success,
    }, {
      targetUserId: userId,
      result: 'success',
    })

    await logFinancialEvent(
      'balance.debit.applied',
      userId,
      chargebackAmountValue,
      {
        description: 'Chargeback debit applied',
        chargebackId: chargebackId || id,
        reason,
      },
      { result: 'success' }
    )

    // 5. ALERT COMPLIANCE TEAM
    await alertComplianceTeam({
      type: 'CHARGEBACK',
      userId,
      amount: chargebackAmountValue,
      chargebackId: chargebackId || id,
      reason: reason || 'Unknown',
      disputeType,
      paymentId,
    })

    console.warn(`[Circle Webhook] User ${userId} frozen due to chargeback. Amount: $${chargebackAmountValue}`)

    return {
      success: true,
      action: 'chargeback_processed_account_frozen',
      userId,
      amount: chargebackAmountValue,
    }
  } catch (error: any) {
    console.error('[Circle Webhook] Chargeback processing error:', error)

    // Still try to alert compliance
    await alertComplianceTeam({
      type: 'CHARGEBACK_PROCESSING_ERROR',
      userId: userId || 'UNKNOWN',
      amount: chargebackAmountValue,
      error: error.message,
    })

    return {
      success: false,
      action: 'chargeback_processing_failed',
      error: error.message,
      requiresRetry: true,
    }
  }
}

/**
 * Alert compliance team about critical events
 */
async function alertComplianceTeam(alert: {
  type: string
  userId?: string
  amount?: number
  chargebackId?: string
  reason?: string
  disputeType?: string
  paymentId?: string
  error?: string
}): Promise<void> {
  const timestamp = new Date().toISOString()

  const message = `
[COMPLIANCE ALERT - ${alert.type}]
Time: ${timestamp}
User ID: ${alert.userId || 'N/A'}
Amount: $${alert.amount?.toFixed(2) || 'N/A'}
Chargeback ID: ${alert.chargebackId || 'N/A'}
Reason: ${alert.reason || 'N/A'}
Dispute Type: ${alert.disputeType || 'N/A'}
Payment ID: ${alert.paymentId || 'N/A'}
${alert.error ? `Error: ${alert.error}` : ''}

ACTION REQUIRED: Review and respond within 24 hours.
  `.trim()

  console.warn(`[COMPLIANCE ALERT]\n${message}`)

  // Send Slack notification
  if (COMPLIANCE_SLACK_WEBHOOK) {
    try {
      await fetch(COMPLIANCE_SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*[COMPLIANCE ALERT - ${alert.type}]*`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'User ID', value: alert.userId || 'N/A', short: true },
              { title: 'Amount', value: `$${alert.amount?.toFixed(2) || 'N/A'}`, short: true },
              { title: 'Reason', value: alert.reason || 'N/A', short: true },
              { title: 'Chargeback ID', value: alert.chargebackId || 'N/A', short: true },
              { title: 'Time', value: timestamp, short: true },
            ],
            footer: 'Grain & Vault Compliance',
          }],
        }),
      })
    } catch (error) {
      console.error('[Circle Webhook] Failed to send Slack alert:', error)
    }
  }

  // Log the alert
  await logSystemEvent('security.alert.triggered', {
    alertType: alert.type,
    ...alert,
    notificationsSent: ['console', COMPLIANCE_SLACK_WEBHOOK ? 'slack' : null].filter(Boolean),
  })
}

// ============================================================================
// MAIN WEBHOOK HANDLER
// ============================================================================

/**
 * POST /api/webhooks/circle
 * Receive and process Circle webhook events
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()

  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-circle-signature')

    // Log incoming webhook (without sensitive data)
    console.log(`[Circle Webhook] Received webhook. Request ID: ${requestId}`)

    // Verify signature
    if (!CIRCLE_ENTITY_SECRET) {
      console.error('[Circle Webhook] CIRCLE_ENTITY_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured', requestId },
        { status: 500 }
      )
    }

    if (!verifyWebhookSignature(rawBody, signature, CIRCLE_ENTITY_SECRET)) {
      console.error('[Circle Webhook] Invalid signature')

      await logSecurityEvent('security.suspicious.activity', 'SYSTEM', {
        description: 'Invalid Circle webhook signature',
        requestId,
        signatureProvided: !!signature,
      })

      return NextResponse.json(
        { error: 'Invalid signature', requestId },
        { status: 400 }
      )
    }

    // Parse webhook payload
    const payload: CircleWebhookPayload = JSON.parse(rawBody)
    const { notificationId, notificationType, notification } = payload

    console.log(`[Circle Webhook] Event: ${notificationType}, Notification ID: ${notificationId}`)

    // Idempotency check
    if (await isAlreadyProcessed(notificationId)) {
      console.log(`[Circle Webhook] Already processed: ${notificationId}`)
      return NextResponse.json({
        received: true,
        status: 'already_processed',
        notificationId,
        requestId,
      })
    }

    // Process event based on type
    let result: ProcessingResult

    switch (notificationType) {
      // Card payment events
      case 'payments.payment_intent.completed':
        result = await handlePaymentIntentCompleted(notification.Data, notificationId)
        break

      case 'payments.payment_intent.failed':
        result = await handlePaymentIntentFailed(notification.Data, notificationId)
        break

      // Crypto/USDC transfer events
      case 'transfers.transfer.complete':
      case 'transactions.transfer.complete':
      case 'transfer.completed':
        result = await handleTransferComplete(notification.Data, notificationId)
        break

      case 'transfers.transfer.failed':
      case 'transactions.transfer.failed':
      case 'transfer.failed':
        result = await handleTransferFailed(notification.Data, notificationId)
        break

      // Payout (withdrawal) events
      case 'payouts.payout.complete':
      case 'payout.completed':
        result = await handlePayoutComplete(notification.Data, notificationId)
        break

      case 'payouts.payout.failed':
      case 'payout.failed':
        result = await handlePayoutFailed(notification.Data, notificationId)
        break

      // Chargeback events
      case 'chargebacks.chargeback.created':
        result = await handleChargebackCreated(notification.Data, notificationId)
        break

      // Legacy event types
      case 'payment.completed':
        result = await handlePaymentIntentCompleted(notification.Data, notificationId)
        break

      case 'payment.failed':
        result = await handlePaymentIntentFailed(notification.Data, notificationId)
        break

      // Pending/action required events - just acknowledge
      case 'payments.payment_intent.pending':
      case 'payments.payment_intent.action_required':
      case 'transfers.transfer.pending':
      case 'payouts.payout.pending':
        result = {
          success: true,
          action: 'status_acknowledged',
        }
        console.log(`[Circle Webhook] Status acknowledged: ${notificationType}`)
        break

      // Chargeback resolution
      case 'chargebacks.chargeback.resolved':
      case 'chargebacks.chargeback.escalated':
        result = {
          success: true,
          action: 'chargeback_status_update',
        }
        await logSystemEvent('security.alert.triggered', {
          alertType: 'chargeback_update',
          status: notificationType,
          eventId: notification.Data.id,
        })
        break

      default:
        console.log(`[Circle Webhook] Unhandled event type: ${notificationType}`)
        result = {
          success: true,
          action: 'unhandled_event_type',
        }
    }

    // Record webhook as processed
    await recordWebhookProcessed(
      notificationId,
      notificationType,
      notification.Id,
      result
    )

    // Calculate processing time
    const processingTime = Date.now() - startTime

    // Determine response status
    if (result.requiresRetry) {
      // Return 500 to trigger Circle retry
      return NextResponse.json({
        received: true,
        status: 'processing_error',
        action: result.action,
        error: result.error,
        requestId,
        processingTime: `${processingTime}ms`,
      }, { status: 500 })
    }

    // Return 200 OK for successful processing
    return NextResponse.json({
      received: true,
      status: result.success ? 'processed' : 'acknowledged',
      action: result.action,
      notificationId,
      requestId,
      processingTime: `${processingTime}ms`,
    })

  } catch (error: any) {
    console.error('[Circle Webhook] Error:', error)

    const processingTime = Date.now() - startTime

    // Log the error
    await logSystemEvent('security.alert.triggered', {
      alertType: 'webhook_processing_error',
      errorMessage: error.message,
      requestId,
    }).catch(() => {})

    // For database errors, return 500 to trigger retry
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('database')) {
      return NextResponse.json({
        received: true,
        status: 'database_error',
        error: 'Temporary processing error',
        requestId,
        processingTime: `${processingTime}ms`,
      }, { status: 500 })
    }

    // For other errors, return 200 to prevent infinite retries
    return NextResponse.json({
      received: true,
      status: 'error_logged',
      requestId,
      processingTime: `${processingTime}ms`,
    })
  }
}

/**
 * GET /api/webhooks/circle
 * Health check endpoint
 */
export async function GET() {
  const status = {
    service: 'Circle Webhook Handler',
    status: 'active',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    configuration: {
      secretConfigured: !!CIRCLE_ENTITY_SECRET,
      complianceSlackConfigured: !!COMPLIANCE_SLACK_WEBHOOK,
    },
  }

  // Basic health check - verify database connectivity
  try {
    await sql`SELECT 1`
    return NextResponse.json({
      ...status,
      database: 'connected',
    })
  } catch {
    return NextResponse.json({
      ...status,
      database: 'disconnected',
    }, { status: 503 })
  }
}

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
