/**
 * Circle Payments API - Card Deposits
 *
 * This handles card-to-USDC conversions using Circle's Payments API.
 *
 * Flow:
 * 1. Create payment intent with amount and metadata
 * 2. Redirect user to Circle's hosted checkout OR use Circle.js
 * 3. User enters card details on Circle's secure page
 * 4. Circle processes payment and sends webhook
 * 5. Webhook credits user's GRAIN balance
 *
 * Endpoints used:
 * - POST /v1/payments/paymentIntents - Create payment intent
 * - GET /v1/payments/paymentIntents/{id} - Get payment status
 *
 * Docs: https://developers.circle.com/circle-mint/reference/createpaymentintent
 */

import { CIRCLE_CONFIG, circleRequest, generateIdempotencyKey } from './config'

// =============================================================================
// TYPES
// =============================================================================

export interface PaymentIntent {
  id: string
  amount: {
    amount: string
    currency: string
  }
  amountPaid: {
    amount: string
    currency: string
  }
  settlementCurrency: string
  paymentMethods: Array<{
    type: string
    chain?: string
  }>
  fees: {
    amount: string
    currency: string
  }
  paymentIds: string[]
  timeline: Array<{
    status: string
    time: string
  }>
  expiresOn: string
  createDate: string
  updateDate: string
  merchantWalletId?: string
  metadata?: Record<string, string>
}

export interface CreatePaymentIntentParams {
  amount: number // USD amount
  userId: string
  sessionId?: string
  description?: string
  metadata?: Record<string, string>
}

export interface PaymentIntentResult {
  success: boolean
  paymentIntentId?: string
  checkoutUrl?: string
  clientSecret?: string
  expiresAt?: string
  error?: string
}

// =============================================================================
// PAYMENT INTENT CREATION
// =============================================================================

/**
 * Create a payment intent for card deposit
 *
 * This creates a payment intent that can be completed via:
 * 1. Circle's hosted checkout (redirect URL)
 * 2. Circle.js SDK on your frontend (using clientSecret)
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResult> {
  const { amount, userId, sessionId, description, metadata = {} } = params

  // Validate amount
  if (amount < 1) {
    return { success: false, error: 'Minimum deposit is $1' }
  }
  if (amount > 10000) {
    return { success: false, error: 'Maximum deposit is $10,000 per transaction' }
  }

  const idempotencyKey = generateIdempotencyKey('pi', userId, sessionId || '')

  // Create payment intent
  const response = await circleRequest<PaymentIntent>('/payments/paymentIntents', {
    method: 'POST',
    body: {
      idempotencyKey,
      amount: {
        amount: amount.toFixed(2),
        currency: 'USD',
      },
      settlementCurrency: 'USD',
      paymentMethods: [
        {
          type: 'card',
          chain: CIRCLE_CONFIG.defaultChain, // USDC will be on this chain
        },
      ],
      metadata: {
        userId,
        sessionId: sessionId || idempotencyKey,
        description: description || `GRAIN deposit`,
        ...metadata,
      },
    },
  })

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to create payment intent',
    }
  }

  const paymentIntent = response.data

  // Generate checkout URL for Circle's hosted checkout
  // This is the simplest integration - redirect user to Circle's page
  const checkoutUrl = generateCheckoutUrl(paymentIntent.id, amount, userId)

  return {
    success: true,
    paymentIntentId: paymentIntent.id,
    checkoutUrl,
    expiresAt: paymentIntent.expiresOn,
  }
}

/**
 * Generate Circle hosted checkout URL
 *
 * Circle's hosted checkout handles:
 * - Card input with 3DS verification
 * - PCI compliance
 * - Fraud detection
 */
function generateCheckoutUrl(
  paymentIntentId: string,
  amount: number,
  userId: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://grainandvault.com'

  // Circle's hosted checkout URL
  // Note: This format may need adjustment based on Circle's current API
  const params = new URLSearchParams({
    paymentIntentId,
    amount: amount.toFixed(2),
    currency: 'USD',
    successUrl: `${baseUrl}/grain-vault/deposit/success?pi=${paymentIntentId}`,
    cancelUrl: `${baseUrl}/grain-vault/deposit/cancel?pi=${paymentIntentId}`,
  })

  // For sandbox, we'll use a demo page
  // For production, this would be Circle's actual checkout URL
  if (CIRCLE_CONFIG.environment === 'sandbox') {
    return `${baseUrl}/grain-vault/deposit/checkout?${params.toString()}`
  }

  // Production Circle checkout
  return `https://my.circle.com/checkout?${params.toString()}`
}

// =============================================================================
// PAYMENT STATUS
// =============================================================================

export interface PaymentStatus {
  id: string
  status: 'created' | 'pending' | 'confirmed' | 'paid' | 'failed' | 'expired'
  amount: number
  amountPaid: number
  fees: number
  createdAt: string
  updatedAt: string
  metadata?: Record<string, string>
}

/**
 * Get payment intent status
 */
export async function getPaymentIntentStatus(
  paymentIntentId: string
): Promise<{ success: boolean; status?: PaymentStatus; error?: string }> {
  const response = await circleRequest<PaymentIntent>(
    `/payments/paymentIntents/${paymentIntentId}`
  )

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to get payment status',
    }
  }

  const pi = response.data
  const timeline = pi.timeline || []
  const latestStatus = timeline[timeline.length - 1]?.status || 'created'

  // Map Circle status to our status
  let status: PaymentStatus['status'] = 'created'
  if (latestStatus === 'pending') status = 'pending'
  else if (latestStatus === 'confirmed') status = 'confirmed'
  else if (latestStatus === 'paid' || pi.paymentIds.length > 0) status = 'paid'
  else if (latestStatus === 'failed') status = 'failed'
  else if (new Date(pi.expiresOn) < new Date()) status = 'expired'

  return {
    success: true,
    status: {
      id: pi.id,
      status,
      amount: parseFloat(pi.amount.amount),
      amountPaid: parseFloat(pi.amountPaid.amount),
      fees: parseFloat(pi.fees.amount),
      createdAt: pi.createDate,
      updatedAt: pi.updateDate,
      metadata: pi.metadata,
    },
  }
}

// =============================================================================
// WEBHOOK PROCESSING
// =============================================================================

export interface PaymentWebhookEvent {
  id: string
  type: string
  data: {
    paymentIntent?: PaymentIntent
    payment?: {
      id: string
      type: string
      status: string
      amount: { amount: string; currency: string }
      source: { id: string; type: string }
      merchantId: string
      merchantWalletId: string
      createDate: string
      updateDate: string
      metadata?: Record<string, string>
    }
  }
}

/**
 * Process payment webhook event
 *
 * Called when Circle sends webhook for:
 * - paymentIntent.created
 * - paymentIntent.paid
 * - payment.confirmed
 * - payment.failed
 */
export function parsePaymentWebhook(payload: any): {
  type: 'payment_intent' | 'payment' | 'unknown'
  event: string
  paymentIntentId?: string
  paymentId?: string
  status?: string
  amount?: number
  userId?: string
  metadata?: Record<string, string>
} {
  const eventType = payload.type || ''

  if (eventType.startsWith('paymentIntent')) {
    const pi = payload.data?.paymentIntent
    return {
      type: 'payment_intent',
      event: eventType,
      paymentIntentId: pi?.id,
      status: pi?.timeline?.[pi.timeline.length - 1]?.status,
      amount: pi?.amount ? parseFloat(pi.amount.amount) : undefined,
      userId: pi?.metadata?.userId,
      metadata: pi?.metadata,
    }
  }

  if (eventType.startsWith('payment')) {
    const payment = payload.data?.payment
    return {
      type: 'payment',
      event: eventType,
      paymentId: payment?.id,
      status: payment?.status,
      amount: payment?.amount ? parseFloat(payment.amount.amount) : undefined,
      userId: payment?.metadata?.userId,
      metadata: payment?.metadata,
    }
  }

  return { type: 'unknown', event: eventType }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  createPaymentIntent,
  getPaymentIntentStatus,
  parsePaymentWebhook,
}
