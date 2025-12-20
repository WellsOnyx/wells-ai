// @ts-nocheck
/**
 * Veriff Webhook Handler - KYC Verification Processing
 *
 * CRITICAL PRODUCTION ENDPOINT
 *
 * Receives webhooks from Veriff for identity verification results
 * Updates user verification level and limits in grain_user_profiles
 *
 * Security:
 * - Verifies webhook signature using HMAC SHA256
 * - Validates session ownership before updating user data
 * - Records all verification events for audit trail
 *
 * Register webhook URL in Veriff Dashboard:
 * https://wells-ai.vercel.app/api/webhooks/veriff
 *
 * Environment Variables Required:
 * - VERIFF_API_KEY
 * - VERIFF_API_SECRET
 * - VERIFF_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import {
  getIdentityVerificationService,
  VerificationStatus,
  VerificationLevel,
  type WebhookPayload,
  type VerificationResult,
} from '@/lib/security/identity-verification'

// ============================================================================
// TYPES
// ============================================================================

interface VeriffWebhookEvent {
  id: string
  feature: string
  code: number
  action: string
  status: string
  verification: {
    id: string
    status: string
    code: number
    person?: {
      firstName?: string
      lastName?: string
      dateOfBirth?: string
      idNumber?: string
      gender?: string
      nationality?: string
    }
    document?: {
      type: string
      number: string
      country: string
      validFrom?: string
      validUntil?: string
    }
    reason?: string
    reasonCode?: number
    decisionTime?: string
    acceptanceTime?: string
    riskLabels?: string[]
    vendorData?: string
  }
  technicalData?: {
    ip?: string
    os?: string
    browser?: string
    userAgent?: string
  }
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify Veriff webhook signature using HMAC SHA256
 */
function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    console.error('[Veriff Webhook] No signature provided')
    return false
  }

  try {
    // Veriff uses HMAC SHA256
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')

    // Handle both hex and base64 encoded signatures
    const normalizedSignature = signature.toLowerCase()
    const normalizedExpected = expectedSignature.toLowerCase()

    // Constant-time comparison to prevent timing attacks
    if (normalizedSignature.length !== normalizedExpected.length) {
      // Try matching with different encodings
      const signatureHex = Buffer.from(signature, 'base64').toString('hex').toLowerCase()
      if (signatureHex.length === normalizedExpected.length) {
        return crypto.timingSafeEqual(
          Buffer.from(signatureHex),
          Buffer.from(normalizedExpected)
        )
      }
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(normalizedSignature),
      Buffer.from(normalizedExpected)
    )
  } catch (error) {
    console.error('[Veriff Webhook] Signature verification error:', error)
    return false
  }
}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

/**
 * Send notification for verification completion
 */
async function notifyVerificationComplete(
  result: VerificationResult
): Promise<void> {
  try {
    const status = result.status === VerificationStatus.APPROVED ? 'Approved' : 'Requires Attention'
    const emoji = result.status === VerificationStatus.APPROVED ? '✅' : '⚠️'

    console.log(`[Veriff Webhook] Verification ${status}:`, {
      userId: result.userId,
      sessionId: result.sessionId,
      level: result.level,
    })

    // Send Slack notification if configured
    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (webhookUrl) {
      const levelNames = {
        [VerificationLevel.EMAIL_ONLY]: 'Basic ($1K)',
        [VerificationLevel.PHONE_BASIC]: 'Standard ($10K)',
        [VerificationLevel.FULL_KYC]: 'Verified ($100K)',
        [VerificationLevel.ENHANCED_DD]: 'Enhanced (Unlimited)',
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${emoji} KYC Verification ${status}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${emoji} KYC Verification ${status}*\n` +
                  `User: ${result.userId}\n` +
                  `Session: ${result.sessionId}\n` +
                  `Level: ${levelNames[result.level] || 'Unknown'}\n` +
                  (result.rejectionReasons?.length
                    ? `Reason: ${result.rejectionReasons.join(', ')}`
                    : ''),
              },
            },
          ],
        }),
      })
    }
  } catch (error) {
    console.error('[Veriff Webhook] Notification error:', error)
    // Don't throw - notification failure shouldn't break webhook processing
  }
}

/**
 * Record verification event for audit trail
 */
async function recordVerificationEvent(
  result: VerificationResult,
  rawPayload: string
): Promise<void> {
  try {
    await sql`
      INSERT INTO grain_treasury_events (
        type,
        amount,
        user_id,
        notes,
        metadata,
        created_at
      ) VALUES (
        'kyc_verification',
        0,
        ${result.userId},
        ${`KYC ${result.status}: Session ${result.sessionId}, Level ${result.level}`},
        ${JSON.stringify({
          sessionId: result.sessionId,
          provider: result.provider,
          status: result.status,
          level: result.level,
          decision: result.decision,
          riskScore: result.riskScore,
          checks: result.checks,
          rejectionReasons: result.rejectionReasons,
        })},
        NOW()
      )
    `
  } catch (error) {
    console.error('[Veriff Webhook] Record event error:', error)
    // Don't throw - audit logging failure shouldn't break processing
  }
}

/**
 * Update user transaction limits based on verification level
 */
async function updateUserLimits(
  userId: string,
  level: VerificationLevel
): Promise<void> {
  const limits = {
    [VerificationLevel.EMAIL_ONLY]: {
      daily: 1000,
      monthly: 10000,
      lifetime: 50000,
    },
    [VerificationLevel.PHONE_BASIC]: {
      daily: 10000,
      monthly: 100000,
      lifetime: 500000,
    },
    [VerificationLevel.FULL_KYC]: {
      daily: 100000,
      monthly: 1000000,
      lifetime: 5000000,
    },
    [VerificationLevel.ENHANCED_DD]: {
      daily: 1000000,
      monthly: 10000000,
      lifetime: 100000000,
    },
  }

  const userLimits = limits[level]

  try {
    await sql`
      UPDATE grain_user_profiles
      SET
        daily_deposit_limit = ${userLimits.daily},
        daily_withdraw_limit = ${userLimits.daily},
        monthly_deposit_limit = ${userLimits.monthly},
        monthly_withdraw_limit = ${userLimits.monthly},
        lifetime_deposit_limit = ${userLimits.lifetime},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    console.log(`[Veriff Webhook] Updated limits for user ${userId}: $${userLimits.daily}/day`)
  } catch (error) {
    console.error('[Veriff Webhook] Update limits error:', error)
  }
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

/**
 * POST /api/webhooks/veriff
 * Receive and process Veriff verification webhook events
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Get raw body for signature verification
    const rawBody = await request.text()

    // Get signature from headers
    // Veriff may use different header names
    const signature =
      request.headers.get('x-hmac-signature') ||
      request.headers.get('x-signature') ||
      request.headers.get('x-veriff-signature')

    // Verify signature
    const webhookSecret = process.env.VERIFF_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[Veriff Webhook] VERIFF_WEBHOOK_SECRET not configured')
      // In production, return 500. In development, allow unsigned webhooks
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Webhook secret not configured' },
          { status: 500 }
        )
      }
      console.warn('[Veriff Webhook] Proceeding without signature verification (development mode)')
    } else if (!verifySignature(rawBody, signature, webhookSecret)) {
      console.error('[Veriff Webhook] Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse webhook payload
    let payload: VeriffWebhookEvent
    try {
      payload = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('[Veriff Webhook] Invalid JSON payload:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    console.log(`[Veriff Webhook] Received event:`, {
      id: payload.id,
      action: payload.action,
      status: payload.status,
      verificationId: payload.verification?.id,
      verificationStatus: payload.verification?.status,
    })

    // Convert to our WebhookPayload format
    const webhookPayload: WebhookPayload = {
      id: payload.id,
      status: payload.status,
      verification: payload.verification,
      technicalData: payload.technicalData,
    }

    // Process verification result using the identity verification service
    const verificationService = getIdentityVerificationService()
    const result = await verificationService.handleVerificationWebhook(
      webhookPayload,
      undefined // Signature already verified above
    )

    // Update user limits based on new verification level
    if (result.status === VerificationStatus.APPROVED && result.userId) {
      await updateUserLimits(result.userId, result.level)
    }

    // Record audit event
    await recordVerificationEvent(result, rawBody)

    // Send notifications
    await notifyVerificationComplete(result)

    // Return success
    const processingTime = Date.now() - startTime
    console.log(`[Veriff Webhook] Processed in ${processingTime}ms:`, {
      sessionId: result.sessionId,
      userId: result.userId,
      status: result.status,
      level: result.level,
    })

    return NextResponse.json(
      {
        received: true,
        sessionId: result.sessionId,
        status: result.status,
        processingTime: `${processingTime}ms`,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Veriff Webhook] Error:', error)

    // Record error event
    try {
      await sql`
        INSERT INTO grain_treasury_events (
          type,
          amount,
          notes,
          metadata,
          created_at
        ) VALUES (
          'kyc_verification_error',
          0,
          ${`Webhook processing error: ${error.message}`},
          ${JSON.stringify({ error: error.message, stack: error.stack })},
          NOW()
        )
      `
    } catch (dbError) {
      console.error('[Veriff Webhook] Failed to record error event:', dbError)
    }

    // Return 200 OK even on error to prevent Veriff from retrying
    // This is a common pattern for webhooks
    return NextResponse.json(
      {
        received: true,
        error: 'Processing error logged',
      },
      { status: 200 }
    )
  }
}

/**
 * GET /api/webhooks/veriff
 * Health check endpoint for monitoring
 */
export async function GET() {
  const hasApiKey = !!process.env.VERIFF_API_KEY
  const hasApiSecret = !!process.env.VERIFF_API_SECRET
  const hasWebhookSecret = !!process.env.VERIFF_WEBHOOK_SECRET

  return NextResponse.json({
    status: 'active',
    service: 'Veriff Webhook Handler',
    timestamp: new Date().toISOString(),
    configuration: {
      apiKeyConfigured: hasApiKey,
      apiSecretConfigured: hasApiSecret,
      webhookSecretConfigured: hasWebhookSecret,
      allConfigured: hasApiKey && hasApiSecret && hasWebhookSecret,
    },
  })
}

/**
 * OPTIONS /api/webhooks/veriff
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-hmac-signature, x-signature, x-veriff-signature',
    },
  })
}
