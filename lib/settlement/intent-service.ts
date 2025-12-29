/**
 * Wells AI Settlement Layer - Intent Service
 *
 * Manages SettlementIntents with idempotency and retry safety.
 * Every transaction is born split - fee captured at settlement.
 */

import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'
import {
  SettlementIntent,
  CreateIntentRequest,
  SettlementResult,
  RefundRequest,
  SettlementStatus,
  Currency,
  DEFAULT_FEE_BPS,
  LedgerEntry
} from './types'
import { calculateFee, calculateRefund, validateFeeConfig } from './fee-calculator'

// Wells treasury account ID (configured in env)
const WELLS_TREASURY_ACCOUNT = process.env.WELLS_TREASURY_ACCOUNT_ID || 'wells_treasury_main'

/**
 * Create a new SettlementIntent
 *
 * Idempotent: Same idempotency_key returns existing intent
 * Retry-safe: No double fee capture
 */
export async function createIntent(
  request: CreateIntentRequest
): Promise<SettlementIntent> {
  const db = await getDb()

  // Validate fee configuration
  const validation = validateFeeConfig({
    fee_bps: request.fee_bps,
    gross_amount: request.amount
  })

  if (!validation.valid) {
    throw new Error(`Invalid fee config: ${validation.errors.join(', ')}`)
  }

  // Check for existing intent with same idempotency key
  const existing = await db.query(
    'SELECT * FROM settlement_intents WHERE idempotency_key = $1',
    [request.idempotency_key]
  )

  if (existing.rows.length > 0) {
    // Return existing intent (idempotency)
    return rowToIntent(existing.rows[0])
  }

  // Calculate fee
  const currency: Currency = request.currency || 'USD'
  const feeBps = request.fee_bps ?? DEFAULT_FEE_BPS
  const feeCalc = calculateFee(request.amount, feeBps, currency)

  // Generate intent ID
  const intentId = `si_${randomUUID().replace(/-/g, '')}`

  // Create intent
  const result = await db.query(
    `INSERT INTO settlement_intents (
      intent_id, buyer_id, seller_id,
      gross_amount, fee_bps, raw_fee, rounded_fee, net_amount,
      fee_payer, currency, status,
      erp_reference, idempotency_key, metadata,
      created_at
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14,
      NOW()
    ) RETURNING *`,
    [
      intentId,
      request.buyer_id,
      request.seller_id,
      feeCalc.gross_amount,
      feeCalc.fee_bps,
      feeCalc.raw_fee,
      feeCalc.rounded_fee,
      feeCalc.net_amount,
      request.fee_payer || 'seller',
      currency,
      'created',
      request.erp_reference || null,
      request.idempotency_key,
      request.metadata ? JSON.stringify(request.metadata) : null
    ]
  )

  const intent = rowToIntent(result.rows[0])

  // Write ledger entry for intent creation
  await writeLedgerEntry({
    intent_id: intentId,
    entry_type: 'debit',
    account_type: 'buyer',
    account_id: request.buyer_id,
    amount: feeCalc.gross_amount,
    currency,
    description: `Intent created: ${intentId}`
  })

  // Emit webhook
  await emitWebhook('intent.created', intent)

  return intent
}

/**
 * Authorize an intent (mark payment as authorized)
 */
export async function authorizeIntent(
  intentId: string,
  externalPaymentId?: string
): Promise<SettlementIntent> {
  const db = await getDb()

  const result = await db.query(
    `UPDATE settlement_intents
     SET status = 'authorized',
         authorized_at = NOW(),
         external_payment_id = COALESCE($2, external_payment_id)
     WHERE intent_id = $1 AND status = 'created'
     RETURNING *`,
    [intentId, externalPaymentId]
  )

  if (result.rows.length === 0) {
    throw new Error(`Intent ${intentId} not found or not in created status`)
  }

  const intent = rowToIntent(result.rows[0])
  await emitWebhook('intent.authorized', intent)

  return intent
}

/**
 * Settle an intent - Route funds and capture fee
 *
 * Mode A: Split Settlement (preferred)
 * - net_amount → seller destination
 * - fee_amount → Wells treasury
 *
 * Mode B: Net-First Withholding (fallback)
 * - Buyer pays full gross
 * - Wells disburses net to seller
 * - Wells retains fee internally
 */
export async function settleIntent(
  intentId: string,
  mode: 'split' | 'net_first' = 'split'
): Promise<SettlementResult> {
  const db = await getDb()

  // Get intent and lock for update
  const intentResult = await db.query(
    `SELECT * FROM settlement_intents
     WHERE intent_id = $1
     FOR UPDATE`,
    [intentId]
  )

  if (intentResult.rows.length === 0) {
    throw new Error(`Intent ${intentId} not found`)
  }

  const intent = rowToIntent(intentResult.rows[0])

  // Validate status
  if (intent.status !== 'authorized' && intent.status !== 'created') {
    throw new Error(`Intent ${intentId} is ${intent.status}, cannot settle`)
  }

  // Generate transfer IDs
  const sellerTransferId = `tr_seller_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  const feeTransferId = `tr_fee_${randomUUID().replace(/-/g, '').slice(0, 16)}`

  try {
    if (mode === 'split') {
      // Mode A: Split Settlement
      // In production, this would call Circle/Stripe to execute transfers
      await executeSplitSettlement(intent, sellerTransferId, feeTransferId)
    } else {
      // Mode B: Net-First Withholding
      await executeNetFirstSettlement(intent, sellerTransferId, feeTransferId)
    }

    // Update intent status
    await db.query(
      `UPDATE settlement_intents
       SET status = 'settled',
           settled_at = NOW()
       WHERE intent_id = $1`,
      [intentId]
    )

    // Write ledger entries
    // Credit seller with net amount
    await writeLedgerEntry({
      intent_id: intentId,
      entry_type: 'credit',
      account_type: 'seller',
      account_id: intent.seller_id,
      amount: intent.net_amount,
      currency: intent.currency,
      description: `Settlement: net to seller`
    })

    // Credit Wells treasury with fee
    await writeLedgerEntry({
      intent_id: intentId,
      entry_type: 'credit',
      account_type: 'wells_treasury',
      account_id: WELLS_TREASURY_ACCOUNT,
      amount: intent.rounded_fee,
      currency: intent.currency,
      description: `Fee captured: ${intent.fee_bps}bps`
    })

    const result: SettlementResult = {
      intent_id: intentId,
      status: 'settled',
      seller_received: intent.net_amount,
      wells_fee_captured: intent.rounded_fee,
      seller_transfer_id: sellerTransferId,
      fee_transfer_id: feeTransferId,
      settled_at: new Date()
    }

    // Get updated intent for webhook
    const updated = await getIntent(intentId)
    if (updated) {
      await emitWebhook('intent.settled', updated)
    }

    return result
  } catch (error) {
    // Mark as failed
    await db.query(
      `UPDATE settlement_intents
       SET status = 'failed',
           failed_at = NOW()
       WHERE intent_id = $1`,
      [intentId]
    )

    const failed = await getIntent(intentId)
    if (failed) {
      await emitWebhook('intent.failed', failed)
    }

    throw error
  }
}

/**
 * Mode A: Split Settlement
 * Route net to seller, fee to Wells simultaneously
 */
async function executeSplitSettlement(
  intent: SettlementIntent,
  sellerTransferId: string,
  feeTransferId: string
): Promise<void> {
  // In production, this would:
  // 1. Call Circle/Stripe to create a split payment
  // 2. net_amount → seller's connected account
  // 3. fee_amount → Wells treasury account
  //
  // For now, we log the intent
  console.log(`[Settlement] Split settlement for ${intent.intent_id}:`)
  console.log(`  Gross: ${intent.gross_amount} ${intent.currency}`)
  console.log(`  Net to seller (${intent.seller_id}): ${intent.net_amount}`)
  console.log(`  Fee to Wells: ${intent.rounded_fee} (${intent.fee_bps}bps)`)
}

/**
 * Mode B: Net-First Withholding
 * Buyer pays gross, Wells disburses net, retains fee
 */
async function executeNetFirstSettlement(
  intent: SettlementIntent,
  sellerTransferId: string,
  feeTransferId: string
): Promise<void> {
  // In production, this would:
  // 1. Verify gross amount received from buyer
  // 2. Transfer net_amount to seller
  // 3. Internally credit Wells treasury with fee
  //
  console.log(`[Settlement] Net-first settlement for ${intent.intent_id}:`)
  console.log(`  Received from buyer: ${intent.gross_amount} ${intent.currency}`)
  console.log(`  Disbursing to seller: ${intent.net_amount}`)
  console.log(`  Retaining fee: ${intent.rounded_fee}`)
}

/**
 * Refund an intent (full or partial)
 */
export async function refundIntent(
  request: RefundRequest
): Promise<SettlementIntent> {
  const db = await getDb()

  const intentResult = await db.query(
    `SELECT * FROM settlement_intents
     WHERE intent_id = $1
     FOR UPDATE`,
    [request.intent_id]
  )

  if (intentResult.rows.length === 0) {
    throw new Error(`Intent ${request.intent_id} not found`)
  }

  const intent = rowToIntent(intentResult.rows[0])

  if (intent.status !== 'settled') {
    throw new Error(`Intent ${request.intent_id} is ${intent.status}, cannot refund`)
  }

  // Calculate refund amounts
  const refund = calculateRefund(
    intent.gross_amount,
    intent.rounded_fee,
    request.amount,
    request.reverse_fee ?? true
  )

  const newStatus: SettlementStatus = refund.is_full_refund ? 'refunded' : 'partial_refund'

  // Update intent
  await db.query(
    `UPDATE settlement_intents
     SET status = $2,
         refunded_at = NOW()
     WHERE intent_id = $1`,
    [request.intent_id, newStatus]
  )

  // Write ledger entries for refund
  await writeLedgerEntry({
    intent_id: request.intent_id,
    entry_type: 'debit',
    account_type: 'seller',
    account_id: intent.seller_id,
    amount: refund.refund_from_seller,
    currency: intent.currency,
    description: `Refund from seller`
  })

  if (refund.fee_to_reverse > 0) {
    await writeLedgerEntry({
      intent_id: request.intent_id,
      entry_type: 'debit',
      account_type: 'wells_treasury',
      account_id: WELLS_TREASURY_ACCOUNT,
      amount: refund.fee_to_reverse,
      currency: intent.currency,
      description: `Fee reversal`
    })
  }

  await writeLedgerEntry({
    intent_id: request.intent_id,
    entry_type: 'credit',
    account_type: 'buyer',
    account_id: intent.buyer_id,
    amount: refund.refund_to_buyer,
    currency: intent.currency,
    description: `Refund to buyer`
  })

  const updated = await getIntent(request.intent_id)
  if (updated) {
    await emitWebhook('intent.refunded', updated)
  }

  return updated!
}

/**
 * Get intent by ID
 */
export async function getIntent(intentId: string): Promise<SettlementIntent | null> {
  const db = await getDb()

  const result = await db.query(
    'SELECT * FROM settlement_intents WHERE intent_id = $1',
    [intentId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return rowToIntent(result.rows[0])
}

/**
 * Get intents for a seller
 */
export async function getSellerIntents(
  sellerId: string,
  status?: SettlementStatus
): Promise<SettlementIntent[]> {
  const db = await getDb()

  let query = 'SELECT * FROM settlement_intents WHERE seller_id = $1'
  const params: any[] = [sellerId]

  if (status) {
    query += ' AND status = $2'
    params.push(status)
  }

  query += ' ORDER BY created_at DESC'

  const result = await db.query(query, params)
  return result.rows.map(rowToIntent)
}

/**
 * Get intents for a buyer
 */
export async function getBuyerIntents(
  buyerId: string,
  status?: SettlementStatus
): Promise<SettlementIntent[]> {
  const db = await getDb()

  let query = 'SELECT * FROM settlement_intents WHERE buyer_id = $1'
  const params: any[] = [buyerId]

  if (status) {
    query += ' AND status = $2'
    params.push(status)
  }

  query += ' ORDER BY created_at DESC'

  const result = await db.query(query, params)
  return result.rows.map(rowToIntent)
}

/**
 * Write immutable ledger entry
 */
async function writeLedgerEntry(entry: Omit<LedgerEntry, 'entry_id' | 'created_at'>): Promise<void> {
  const db = await getDb()
  const entryId = `le_${randomUUID().replace(/-/g, '')}`

  await db.query(
    `INSERT INTO settlement_ledger (
      entry_id, intent_id, entry_type, account_type, account_id,
      amount, currency, description, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      entryId,
      entry.intent_id,
      entry.entry_type,
      entry.account_type,
      entry.account_id,
      entry.amount,
      entry.currency,
      entry.description
    ]
  )
}

/**
 * Emit webhook event
 */
async function emitWebhook(
  eventType: string,
  intent: SettlementIntent
): Promise<void> {
  const db = await getDb()
  const eventId = `evt_${randomUUID().replace(/-/g, '')}`

  await db.query(
    `INSERT INTO settlement_webhooks (
      event_id, event_type, intent_id, payload, created_at
    ) VALUES ($1, $2, $3, $4, NOW())`,
    [eventId, eventType, intent.intent_id, JSON.stringify(intent)]
  )

  // In production, this would also POST to registered webhook URLs
  console.log(`[Webhook] ${eventType} for ${intent.intent_id}`)
}

/**
 * Convert DB row to SettlementIntent
 */
function rowToIntent(row: any): SettlementIntent {
  return {
    intent_id: row.intent_id,
    buyer_id: row.buyer_id,
    seller_id: row.seller_id,
    gross_amount: row.gross_amount,
    fee_bps: row.fee_bps,
    raw_fee: row.raw_fee,
    rounded_fee: row.rounded_fee,
    net_amount: row.net_amount,
    fee_payer: row.fee_payer,
    currency: row.currency,
    status: row.status,
    erp_reference: row.erp_reference,
    external_payment_id: row.external_payment_id,
    idempotency_key: row.idempotency_key,
    created_at: row.created_at,
    authorized_at: row.authorized_at,
    settled_at: row.settled_at,
    failed_at: row.failed_at,
    refunded_at: row.refunded_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  }
}
