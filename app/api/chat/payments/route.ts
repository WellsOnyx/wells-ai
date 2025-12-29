// @ts-nocheck
/**
 * Wells AI Payments Chat API
 *
 * API route for conversational payment operations.
 * Handles all payment-related chat messages including:
 * - Balance checks
 * - Money transfers
 * - Invoice payments
 * - Escrow creation
 * - Transaction history
 * - Payment requests
 * - Financial insights
 * - Credit line management
 *
 * SECURITY:
 * - Requires authentication via Clerk
 * - Rate limiting applied
 * - High-value transactions require confirmation
 * - All operations logged for audit
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import {
  PaymentsHandler,
  getPaymentsHandler,
  detectPaymentIntent,
  PaymentHandlerContext,
} from '@/lib/chat/handlers/payments-handler'

// ============================================================================
// TYPES
// ============================================================================

interface ChatPaymentsRequest {
  message: string
  conversationId?: string
  sessionId?: string
  previousMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  confirmationToken?: string
}

interface ChatPaymentsResponse {
  success: boolean
  message: string
  data?: unknown
  requiresConfirmation?: boolean
  confirmationToken?: string
  confirmationDetails?: {
    type: string
    amount: number
    currency: string
    recipient: string
    memo?: string
    fee?: number
  }
  suggestedActions?: string[]
  warnings?: string[]
  error?: string
  metadata?: {
    intentDetected?: string
    processingTimeMs?: number
    rateLimitRemaining?: number
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, RateLimitEntry>()

const RATE_LIMIT = {
  maxRequests: 60, // requests per window
  windowMs: 60 * 1000, // 1 minute
  highValueMaxRequests: 10, // high-value operations per window
}

function checkRateLimit(userId: string, isHighValue: boolean = false): {
  allowed: boolean
  remaining: number
  resetIn: number
} {
  const now = Date.now()
  const key = isHighValue ? `${userId}_high` : userId
  const limit = isHighValue ? RATE_LIMIT.highValueMaxRequests : RATE_LIMIT.maxRequests

  let entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + RATE_LIMIT.windowMs,
    }
    rateLimitMap.set(key, entry)
  }

  entry.count++

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetIn: entry.resetAt - now,
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

interface AuditLogEntry {
  timestamp: Date
  userId: string
  action: string
  intent?: string
  amount?: number
  recipient?: string
  status: 'success' | 'failed' | 'pending_confirmation'
  ipAddress?: string
  userAgent?: string
  details?: Record<string, unknown>
}

async function logAudit(entry: AuditLogEntry): Promise<void> {
  // In production, write to audit log table or external service
  console.log('[Payments Audit]', JSON.stringify(entry))

  // TODO: Write to audit_logs table
  // await supabase.from('audit_logs').insert({
  //   ...entry,
  //   timestamp: entry.timestamp.toISOString(),
  // })
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

function validateRequest(body: unknown): ChatPaymentsRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body')
  }

  const request = body as Record<string, unknown>

  if (!request.message || typeof request.message !== 'string') {
    throw new Error('Message is required')
  }

  if (request.message.length > 2000) {
    throw new Error('Message too long (max 2000 characters)')
  }

  return {
    message: request.message.trim(),
    conversationId: typeof request.conversationId === 'string' ? request.conversationId : undefined,
    sessionId: typeof request.sessionId === 'string' ? request.sessionId : undefined,
    previousMessages: Array.isArray(request.previousMessages) ? request.previousMessages : undefined,
    confirmationToken: typeof request.confirmationToken === 'string' ? request.confirmationToken : undefined,
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ChatPaymentsResponse>> {
  const startTime = Date.now()

  try {
    // Authenticate
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // Parse and validate request
    let body: ChatPaymentsRequest
    try {
      const rawBody = await request.json()
      body = validateRequest(rawBody)
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: error instanceof Error ? error.message : 'Invalid request',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // Detect intent for rate limiting classification
    const detectedIntent = detectPaymentIntent(body.message)
    const isHighValueIntent = ['send_money', 'pay_invoice', 'create_escrow'].includes(
      detectedIntent || ''
    )

    // Check rate limit
    const rateLimit = checkRateLimit(clerkUserId, isHighValueIntent)
    if (!rateLimit.allowed) {
      await logAudit({
        timestamp: new Date(),
        userId: clerkUserId,
        action: 'rate_limit_exceeded',
        intent: detectedIntent || undefined,
        status: 'failed',
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      })

      return NextResponse.json(
        {
          success: false,
          message: 'Too many requests. Please try again later.',
          error: 'RATE_LIMIT_EXCEEDED',
          metadata: {
            rateLimitRemaining: 0,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateLimit.resetIn / 1000).toString(),
          },
        }
      )
    }

    // Get or resolve internal user ID
    const internalUserId = await resolveInternalUserId(clerkUserId)

    if (!internalUserId) {
      return NextResponse.json(
        {
          success: false,
          message: 'User account not found. Please complete onboarding.',
          error: 'USER_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // Build handler context
    const context: PaymentHandlerContext = {
      userId: internalUserId,
      clerkUserId,
      sessionId: body.sessionId,
      conversationId: body.conversationId,
      timezone: request.headers.get('x-timezone') || undefined,
      previousMessages: body.previousMessages,
    }

    // Process message
    const handler = getPaymentsHandler()
    const result = await handler.handleMessage(body.message, context)

    // Log audit
    await logAudit({
      timestamp: new Date(),
      userId: internalUserId,
      action: detectedIntent || 'unknown_intent',
      intent: detectedIntent || undefined,
      amount: result.data && typeof result.data === 'object' && 'amount' in result.data
        ? (result.data as Record<string, unknown>).amount as number
        : undefined,
      recipient: result.confirmationDetails?.recipient,
      status: result.success
        ? result.requiresConfirmation
          ? 'pending_confirmation'
          : 'success'
        : 'failed',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: {
        message: body.message.slice(0, 200),
        error: result.error,
      },
    })

    // Build response
    const response: ChatPaymentsResponse = {
      success: result.success,
      message: result.message,
      data: result.data,
      requiresConfirmation: result.requiresConfirmation,
      confirmationToken: result.confirmationToken,
      confirmationDetails: result.confirmationDetails
        ? {
            type: result.confirmationDetails.type,
            amount: result.confirmationDetails.amount,
            currency: result.confirmationDetails.currency,
            recipient: result.confirmationDetails.recipient,
            memo: result.confirmationDetails.memo,
            fee: result.confirmationDetails.estimatedFee,
          }
        : undefined,
      suggestedActions: result.suggestedActions,
      warnings: result.warnings,
      error: result.error,
      metadata: {
        intentDetected: detectedIntent || undefined,
        processingTimeMs: Date.now() - startTime,
        rateLimitRemaining: rateLimit.remaining,
      },
    }

    return NextResponse.json(response, {
      status: result.success ? 200 : 400,
      headers: {
        'X-Rate-Limit-Remaining': rateLimit.remaining.toString(),
        'X-Processing-Time': (Date.now() - startTime).toString(),
      },
    })
  } catch (error) {
    console.error('[Payments Chat API] Error:', error)

    await logAudit({
      timestamp: new Date(),
      userId: 'unknown',
      action: 'server_error',
      status: 'failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        error: 'INTERNAL_ERROR',
        metadata: {
          processingTimeMs: Date.now() - startTime,
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Health check and capabilities
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    status: 'healthy',
    version: '1.0.0',
    capabilities: [
      {
        intent: 'check_balance',
        description: 'Check your GRAIN/USDC balance',
        examples: [
          "What's my GRAIN balance?",
          'How much do I have?',
          'Check my balance',
        ],
      },
      {
        intent: 'send_money',
        description: 'Send money to another user',
        examples: [
          'Send $500 to john@company.com',
          'Transfer $1000 to @johndoe',
          'Pay Sarah $250 for consulting',
        ],
        requiresConfirmation: true,
        confirmationThreshold: 500,
      },
      {
        intent: 'pay_invoice',
        description: 'Pay an invoice',
        examples: [
          'Pay invoice #INV-1234',
          'Pay my unpaid invoices',
          'Settle invoice from Acme Corp',
        ],
        requiresConfirmation: true,
      },
      {
        intent: 'create_escrow',
        description: 'Hold payment in escrow until conditions are met',
        examples: [
          'Hold $5000 until delivery confirmed',
          'Escrow payment for contractor work',
          'Set up milestone payments',
        ],
        requiresConfirmation: true,
      },
      {
        intent: 'view_transactions',
        description: 'View transaction history',
        examples: [
          'Show my recent transactions',
          "What did I spend this month?",
          'Transaction history',
        ],
      },
      {
        intent: 'request_payment',
        description: 'Request payment from another user',
        examples: [
          'Request $1000 from supplier@co.com',
          'Send invoice to client',
          'Bill John for $500',
        ],
      },
      {
        intent: 'financial_insights',
        description: 'Get spending analysis and insights',
        examples: [
          "What's my spending this month?",
          'Show me where my money went',
          'Top expenses this quarter',
        ],
      },
      {
        intent: 'credit_line',
        description: 'Manage credit line',
        examples: [
          "What's my available credit?",
          'Check credit line status',
          'Draw from credit line',
        ],
      },
    ],
    security: {
      confirmationRequired: 'For transactions over threshold',
      rateLimits: {
        standard: '60 requests/minute',
        highValue: '10 high-value operations/minute',
      },
      auditLogging: true,
    },
  })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve Clerk user ID to internal user ID
 */
async function resolveInternalUserId(clerkUserId: string): Promise<string | null> {
  // In a real implementation, this would query your database
  // to get the internal user ID from the Clerk user ID

  // For now, we'll use a simple mapping approach
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  )

  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .single()

  if (data) {
    return data.id
  }

  // If not found, check if there's a user with matching email
  try {
    const clerkClientInstance = await clerkClient()
    const clerkUser = await clerkClientInstance.users.getUser(clerkUserId)
    const email = clerkUser.emailAddresses[0]?.emailAddress

    if (email) {
      const { data: userByEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userByEmail) {
        // Link Clerk ID to existing user
        await supabase
          .from('users')
          .update({ clerk_id: clerkUserId })
          .eq('id', userByEmail.id)

        return userByEmail.id
      }

      // Create new user
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          clerk_id: clerkUserId,
          email,
          full_name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      return newUser?.id || null
    }
  } catch (error) {
    console.error('[resolveInternalUserId] Error:', error)
  }

  return null
}

// ============================================================================
// OPTIONS - CORS preflight
// ============================================================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timezone',
      'Access-Control-Max-Age': '86400',
    },
  })
}
