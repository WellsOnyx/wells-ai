/**
 * GRAIN Vault Deposit Status API - Check Payment by ID
 *
 * GET /api/grain-vault/deposit/[paymentId] - Check payment status
 *
 * Looks up the transaction in database and checks Circle for current status.
 *
 * Security:
 * - Clerk authentication required
 * - Users can only view their own transactions
 * - Rate limiting applied
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Security services
import { rateLimitOrRespond } from '@/lib/security/rate-limiter'
import { logFinancialEvent } from '@/lib/security/audit-logger'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || ''
const CIRCLE_ENV = (process.env.CIRCLE_ENV || 'sandbox') as 'sandbox' | 'production'
const CIRCLE_API_BASE = CIRCLE_ENV === 'production'
  ? 'https://api.circle.com/v1'
  : 'https://api-sandbox.circle.com/v1'

// ============================================================================
// TYPES
// ============================================================================

interface PaymentStatusResponse {
  paymentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'refunded'
  type: string
  usdAmount: number
  grainAmount: number
  grainPriceAtTime: number
  paymentMethod: string
  createdAt: string
  completedAt?: string
  circleStatus?: string
  circleDetails?: {
    paymentIntentId?: string
    transferId?: string
    settlementStatus?: string
    failureReason?: string
  }
  estimatedCompletion?: string
  canRetry: boolean
}

// ============================================================================
// CIRCLE API HELPER
// ============================================================================

/**
 * Make authenticated request to Circle API
 */
async function circleRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<any> {
  if (!CIRCLE_API_KEY) {
    return null // No Circle configured, skip
  }

  try {
    const response = await fetch(`${CIRCLE_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${CIRCLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      console.error('[Circle API] Error:', response.status)
      return null
    }

    return response.json()
  } catch (error) {
    console.error('[Circle API] Request failed:', error)
    return null
  }
}

/**
 * Get payment intent status from Circle
 */
async function getCirclePaymentIntentStatus(paymentIntentId: string): Promise<{
  status: string
  settlementStatus?: string
  failureReason?: string
} | null> {
  // Skip demo/test payment IDs
  if (paymentIntentId.startsWith('dep_') || paymentIntentId.startsWith('demo_')) {
    return null
  }

  const result = await circleRequest(`/payments/paymentIntents/${paymentIntentId}`)
  if (!result?.data) return null

  return {
    status: result.data.status,
    settlementStatus: result.data.settlementStatus,
    failureReason: result.data.failureReason,
  }
}

/**
 * Get transfer status from Circle
 */
async function getCircleTransferStatus(transferId: string): Promise<{
  status: string
  failureReason?: string
} | null> {
  // Skip demo/test transfer IDs
  if (transferId.startsWith('dep_') || transferId.startsWith('demo_')) {
    return null
  }

  const result = await circleRequest(`/transfers/${transferId}`)
  if (!result?.data) return null

  return {
    status: result.data.status,
    failureReason: result.data.errorCode,
  }
}

/**
 * Map Circle status to our internal status
 */
function mapCircleStatusToInternal(circleStatus: string): PaymentStatusResponse['status'] {
  const statusMap: Record<string, PaymentStatusResponse['status']> = {
    'pending': 'pending',
    'created': 'pending',
    'action_required': 'pending',
    'confirmed': 'processing',
    'processing': 'processing',
    'complete': 'completed',
    'completed': 'completed',
    'paid': 'completed',
    'failed': 'failed',
    'canceled': 'failed',
    'expired': 'expired',
    'refunded': 'refunded',
  }

  return statusMap[circleStatus.toLowerCase()] || 'pending'
}

/**
 * Calculate estimated completion time based on payment method
 */
function getEstimatedCompletion(paymentMethod: string, status: string): string | undefined {
  if (status === 'completed' || status === 'failed' || status === 'expired') {
    return undefined
  }

  const now = new Date()

  switch (paymentMethod) {
    case 'card':
      // Card payments typically complete within minutes
      now.setMinutes(now.getMinutes() + 5)
      return now.toISOString()
    case 'ach':
      // ACH takes 3-5 business days
      now.setDate(now.getDate() + 5)
      return now.toISOString()
    case 'usdc':
      // USDC transfers are near-instant once initiated
      now.setMinutes(now.getMinutes() + 2)
      return now.toISOString()
    default:
      return undefined
  }
}

// ============================================================================
// GET: CHECK PAYMENT STATUS BY ID
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    // SECURITY: Rate limiting
    const blocked = await rateLimitOrRespond(req, 'deposit-status')
    if (blocked) return blocked

    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { paymentId } = await params

    // Validate paymentId format
    if (!paymentId || paymentId.length < 10) {
      return NextResponse.json(
        { error: 'Invalid payment ID' },
        { status: 400 }
      )
    }

    // Look up transaction in database
    const txResult = await sql`
      SELECT
        id,
        user_id,
        type,
        usd_amount,
        grain_amount,
        grain_price,
        payment_method,
        circle_transfer_id,
        status,
        description,
        failure_reason,
        created_at,
        completed_at
      FROM grain_transactions
      WHERE id = ${paymentId}
    `

    if (txResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    const tx = txResult.rows[0]

    // SECURITY: Users can only view their own transactions
    if (tx.user_id !== userId) {
      // Log attempted unauthorized access
      await logFinancialEvent(
        'security.unauthorized_access',
        userId,
        0,
        {
          attemptedPaymentId: paymentId,
          actualOwner: tx.user_id,
          action: 'view_payment_status',
        },
        { result: 'blocked' }
      )

      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 } // Return 404 to not leak existence
      )
    }

    // Get current status from database
    let currentStatus = tx.status as PaymentStatusResponse['status']
    let circleDetails: PaymentStatusResponse['circleDetails'] | undefined
    let circleStatus: string | undefined

    // If transaction is still pending/processing, check Circle for updates
    if (
      (currentStatus === 'pending' || currentStatus === 'processing') &&
      tx.circle_transfer_id &&
      !tx.circle_transfer_id.startsWith('dep_') // Skip demo IDs
    ) {
      // Determine if this is a payment intent or transfer
      const isPaymentIntent = tx.payment_method === 'card'

      if (isPaymentIntent) {
        const circleResult = await getCirclePaymentIntentStatus(tx.circle_transfer_id)
        if (circleResult) {
          circleStatus = circleResult.status
          circleDetails = {
            paymentIntentId: tx.circle_transfer_id,
            settlementStatus: circleResult.settlementStatus,
            failureReason: circleResult.failureReason,
          }

          // Map Circle status to internal status
          const mappedStatus = mapCircleStatusToInternal(circleResult.status)

          // Update database if status changed
          if (mappedStatus !== currentStatus) {
            const updateData: any = { status: mappedStatus }

            if (mappedStatus === 'completed') {
              updateData.completed_at = new Date()
            } else if (mappedStatus === 'failed' && circleResult.failureReason) {
              updateData.failure_reason = circleResult.failureReason
            }

            await sql`
              UPDATE grain_transactions
              SET
                status = ${mappedStatus},
                completed_at = ${mappedStatus === 'completed' ? new Date().toISOString() : tx.completed_at},
                failure_reason = ${circleResult.failureReason || tx.failure_reason}
              WHERE id = ${paymentId}
            `

            currentStatus = mappedStatus

            // Log status change
            await logFinancialEvent(
              'financial.deposit.status_changed',
              userId,
              parseFloat(tx.usd_amount),
              {
                paymentId,
                previousStatus: tx.status,
                newStatus: mappedStatus,
                circleStatus: circleResult.status,
              }
            )
          }
        }
      } else {
        // ACH or USDC transfer
        const circleResult = await getCircleTransferStatus(tx.circle_transfer_id)
        if (circleResult) {
          circleStatus = circleResult.status
          circleDetails = {
            transferId: tx.circle_transfer_id,
            failureReason: circleResult.failureReason,
          }

          const mappedStatus = mapCircleStatusToInternal(circleResult.status)

          if (mappedStatus !== currentStatus) {
            await sql`
              UPDATE grain_transactions
              SET
                status = ${mappedStatus},
                completed_at = ${mappedStatus === 'completed' ? new Date().toISOString() : tx.completed_at},
                failure_reason = ${circleResult.failureReason || tx.failure_reason}
              WHERE id = ${paymentId}
            `

            currentStatus = mappedStatus
          }
        }
      }
    }

    // Check if transaction is expired (pending for > 30 minutes for card, > 7 days for ACH)
    if (currentStatus === 'pending') {
      const createdAt = new Date(tx.created_at)
      const now = new Date()
      const ageMs = now.getTime() - createdAt.getTime()

      const expiryMs = tx.payment_method === 'card'
        ? 30 * 60 * 1000 // 30 minutes for card
        : 7 * 24 * 60 * 60 * 1000 // 7 days for ACH

      if (ageMs > expiryMs) {
        await sql`
          UPDATE grain_transactions
          SET status = 'expired', failure_reason = 'Payment session expired'
          WHERE id = ${paymentId}
        `
        currentStatus = 'expired'
      }
    }

    // Build response
    const response: PaymentStatusResponse = {
      paymentId,
      status: currentStatus,
      type: tx.type,
      usdAmount: parseFloat(tx.usd_amount || '0'),
      grainAmount: parseFloat(tx.grain_amount || '0'),
      grainPriceAtTime: parseFloat(tx.grain_price || '1'),
      paymentMethod: tx.payment_method,
      createdAt: tx.created_at,
      completedAt: tx.completed_at || undefined,
      circleStatus,
      circleDetails,
      estimatedCompletion: getEstimatedCompletion(tx.payment_method, currentStatus),
      canRetry: currentStatus === 'failed' || currentStatus === 'expired',
    }

    // Add helpful messages based on status
    let message: string
    let nextSteps: string[] = []

    switch (currentStatus) {
      case 'pending':
        message = 'Your deposit is awaiting payment confirmation.'
        if (tx.payment_method === 'card') {
          nextSteps = ['Complete the payment form if not already done', 'Check your email for confirmation']
        } else if (tx.payment_method === 'ach') {
          nextSteps = ['Complete bank verification if prompted', 'ACH transfers take 3-5 business days']
        } else {
          nextSteps = ['Send USDC to the provided address', 'Confirm transaction on the blockchain']
        }
        break
      case 'processing':
        message = 'Your payment is being processed.'
        nextSteps = ['Funds will be credited shortly', 'No action required']
        break
      case 'completed':
        message = `Successfully deposited $${response.usdAmount.toFixed(2)} and received ${response.grainAmount.toFixed(4)} GRAIN.`
        break
      case 'failed':
        message = 'Your deposit could not be completed.'
        nextSteps = [
          tx.failure_reason || 'Please try again or contact support',
          'Check your payment method details',
        ]
        break
      case 'expired':
        message = 'This deposit session has expired.'
        nextSteps = ['Please initiate a new deposit', 'No charges were made']
        break
      case 'refunded':
        message = 'Your deposit has been refunded.'
        nextSteps = ['Funds will be returned to your original payment method', 'Contact support if you have questions']
        break
    }

    return NextResponse.json({
      ...response,
      message,
      nextSteps,
      _links: {
        self: `/api/grain-vault/deposit/${paymentId}`,
        deposits: '/api/grain-vault/deposit',
        balance: '/api/grain-vault/balance',
        support: '/support',
      },
    })
  } catch (error: any) {
    console.error('[Deposit Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check payment status', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * SECURITY NOTES:
 *
 * 1. Users can only view their own transactions (verified by userId match)
 * 2. Unauthorized access attempts are logged for security monitoring
 * 3. 404 is returned for both not-found and unauthorized to prevent enumeration
 * 4. Circle API calls are made to get real-time status updates
 * 5. Database is updated when Circle reports status changes
 * 6. Rate limiting prevents abuse
 * 7. Demo/test payment IDs skip Circle API calls
 */
