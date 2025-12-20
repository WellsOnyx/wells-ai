/**
 * Circle Integration - Unified Entry Point
 *
 * Three Circle Products:
 * 1. Payments API - Card deposits to USDC
 * 2. Programmable Wallets (W3S) - Developer-controlled wallets
 * 3. Payouts API - Bank withdrawals
 */

// Configuration
export { CIRCLE_CONFIG, validateCircleConfig, circleRequest, generateIdempotencyKey } from './config'

// Payments API (Card Deposits)
export {
  createPaymentIntent,
  getPaymentIntentStatus,
  parsePaymentWebhook,
} from './payments'
export type {
  PaymentIntent,
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentStatus,
} from './payments'

// Programmable Wallets (W3S)
export {
  createWallet,
  getWallet,
  getWalletBalances,
  getUSDCBalance,
  transferUSDC,
  getTransferStatus,
  getMasterWalletBalance,
  withdrawFromMaster,
  parseW3SWebhook,
} from './wallets'
export type {
  W3SWallet,
  W3SBalance,
  W3STransfer,
} from './wallets'

// Payouts API (Bank Withdrawals)
export {
  createACHBankAccount,
  createWireBankAccount,
  getBankAccount,
  createPayout,
  getPayoutStatus,
  listPayouts,
  processWithdrawal,
  parsePayoutWebhook,
} from './payouts'
export type {
  BankAccount,
  Payout,
  WithdrawalRequest,
  WithdrawalResult,
} from './payouts'

// =============================================================================
// UNIFIED WEBHOOK HANDLER
// =============================================================================

import crypto from 'crypto'
import { CIRCLE_CONFIG } from './config'
import { parsePaymentWebhook } from './payments'
import { parseW3SWebhook } from './wallets'
import { parsePayoutWebhook } from './payouts'

/**
 * Verify Circle webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret?: string
): boolean {
  if (!signature) {
    console.warn('[Circle Webhook] No signature provided')
    return false
  }

  const webhookSecret = secret || CIRCLE_CONFIG.webhooks.paymentsSecret

  if (!webhookSecret) {
    console.warn('[Circle Webhook] No webhook secret configured')
    return false
  }

  try {
    const hmac = crypto.createHmac('sha256', webhookSecret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')

    // Constant-time comparison
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

export type WebhookSource = 'payments' | 'w3s' | 'payouts' | 'unknown'

export interface ParsedWebhook {
  source: WebhookSource
  type: string
  notificationId?: string
  paymentIntentId?: string
  paymentId?: string
  transferId?: string
  payoutId?: string
  walletId?: string
  status?: string
  amount?: number
  userId?: string
  txHash?: string
  metadata?: Record<string, string>
}

/**
 * Parse any Circle webhook into a unified format
 */
export function parseWebhook(payload: any): ParsedWebhook {
  // Detect webhook source based on payload structure
  const eventType = payload.type || payload.notificationType || ''

  // Payments API webhooks
  if (eventType.startsWith('payment') || eventType.includes('paymentIntent')) {
    const parsed = parsePaymentWebhook(payload)
    return {
      source: 'payments',
      type: parsed.event,
      paymentIntentId: parsed.paymentIntentId,
      paymentId: parsed.paymentId,
      status: parsed.status,
      amount: parsed.amount,
      userId: parsed.userId,
      metadata: parsed.metadata,
    }
  }

  // Payouts API webhooks
  if (eventType.startsWith('payout') || eventType.includes('bank')) {
    const parsed = parsePayoutWebhook(payload)
    return {
      source: 'payouts',
      type: parsed.event,
      payoutId: parsed.payoutId,
      status: parsed.status,
      amount: parsed.amount,
      userId: parsed.userId,
    }
  }

  // W3S (Programmable Wallets) webhooks
  if (payload.notificationType || payload.subscriptionId) {
    const parsed = parseW3SWebhook(payload)
    return {
      source: 'w3s',
      type: parsed.type,
      notificationId: parsed.notificationId,
      transferId: parsed.transferId,
      walletId: parsed.walletId,
      status: parsed.state,
      amount: parsed.amount,
      userId: parsed.userId,
      txHash: parsed.txHash,
    }
  }

  return {
    source: 'unknown',
    type: eventType,
  }
}

// =============================================================================
// GRAIN INTEGRATION HELPERS
// =============================================================================

import { sql } from '@vercel/postgres'

/**
 * Credit GRAIN to user after successful deposit
 */
export async function creditGrainFromDeposit(
  userId: string,
  usdAmount: number,
  circleReference: string,
  source: 'card' | 'usdc' | 'ach'
): Promise<{ success: boolean; grainAmount?: number; error?: string }> {
  try {
    // Get current GRAIN price (for now 1:1 with USD)
    const grainPrice = 1.0 // TODO: Get from price oracle

    const grainAmount = usdAmount / grainPrice

    // Update user wallet balance
    await sql`
      UPDATE user_wallets
      SET
        balance = balance + ${grainAmount},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    // Record transaction
    await sql`
      INSERT INTO grain_transactions (
        user_id,
        type,
        usd_amount,
        grain_amount,
        grain_price,
        payment_method,
        payment_reference,
        status,
        created_at,
        completed_at
      ) VALUES (
        ${userId},
        'deposit',
        ${usdAmount},
        ${grainAmount},
        ${grainPrice},
        ${source},
        ${circleReference},
        'completed',
        NOW(),
        NOW()
      )
    `

    // Update treasury backing
    await sql`
      INSERT INTO treasury_backing (
        asset_type,
        asset_name,
        amount,
        value_usd,
        source,
        circle_reference,
        status,
        acquired_at
      ) VALUES (
        'usdc',
        'USDC from ${source} deposit',
        ${usdAmount},
        ${usdAmount},
        ${source},
        ${circleReference},
        'active',
        NOW()
      )
    `

    console.log(`[GRAIN] Credited ${grainAmount} GRAIN to user ${userId} from ${source} deposit`)

    return {
      success: true,
      grainAmount,
    }
  } catch (error: any) {
    console.error('[GRAIN] Credit error:', error)
    return {
      success: false,
      error: error.message || 'Failed to credit GRAIN',
    }
  }
}

/**
 * Debit GRAIN from user for withdrawal
 */
export async function debitGrainForWithdrawal(
  userId: string,
  grainAmount: number,
  circleReference: string
): Promise<{ success: boolean; usdAmount?: number; error?: string }> {
  try {
    // Get current GRAIN price
    const grainPrice = 1.0 // TODO: Get from price oracle
    const usdAmount = grainAmount * grainPrice

    // Check balance
    const balanceResult = await sql`
      SELECT balance FROM user_wallets WHERE user_id = ${userId}
    `

    if (balanceResult.rows.length === 0) {
      return { success: false, error: 'User wallet not found' }
    }

    const currentBalance = parseFloat(balanceResult.rows[0].balance)
    if (currentBalance < grainAmount) {
      return { success: false, error: 'Insufficient GRAIN balance' }
    }

    // Debit balance
    await sql`
      UPDATE user_wallets
      SET
        balance = balance - ${grainAmount},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    // Record transaction
    await sql`
      INSERT INTO grain_transactions (
        user_id,
        type,
        usd_amount,
        grain_amount,
        grain_price,
        payment_method,
        payment_reference,
        status,
        created_at
      ) VALUES (
        ${userId},
        'withdraw',
        ${usdAmount},
        ${grainAmount},
        ${grainPrice},
        'bank_withdrawal',
        ${circleReference},
        'pending',
        NOW()
      )
    `

    console.log(`[GRAIN] Debited ${grainAmount} GRAIN from user ${userId} for withdrawal`)

    return {
      success: true,
      usdAmount,
    }
  } catch (error: any) {
    console.error('[GRAIN] Debit error:', error)
    return {
      success: false,
      error: error.message || 'Failed to debit GRAIN',
    }
  }
}
