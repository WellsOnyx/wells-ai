// @ts-nocheck
/**
 * Payment Intent API - Create Grain & Vault Payment Requests
 *
 * POST /api/payments/create-intent
 * Creates a new payment intent for GRAIN/USDC payments on Base L2
 *
 * Requires Clerk authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CreatePaymentIntentInput {
  amount: number
  currency?: 'GRAIN' | 'USDC'
  recipientWallet?: string
  description: string
  metadata?: Record<string, string>
  returnUrl?: string
  cancelUrl?: string
  embedMode?: boolean
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateInput(body: unknown): CreatePaymentIntentInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body')
  }

  const input = body as Record<string, unknown>

  // Validate amount
  if (typeof input.amount !== 'number' || input.amount <= 0 || input.amount > 10000000) {
    throw new Error('Amount must be a positive number up to $10M')
  }

  // Validate currency
  const currency = input.currency || 'GRAIN'
  if (currency !== 'GRAIN' && currency !== 'USDC') {
    throw new Error('Currency must be GRAIN or USDC')
  }

  // Validate description
  if (typeof input.description !== 'string' || input.description.length === 0 || input.description.length > 500) {
    throw new Error('Description must be 1-500 characters')
  }

  return {
    amount: input.amount,
    currency: currency as 'GRAIN' | 'USDC',
    recipientWallet: typeof input.recipientWallet === 'string' ? input.recipientWallet : undefined,
    description: input.description,
    metadata: typeof input.metadata === 'object' ? input.metadata as Record<string, string> : undefined,
    returnUrl: typeof input.returnUrl === 'string' ? input.returnUrl : undefined,
    cancelUrl: typeof input.cancelUrl === 'string' ? input.cancelUrl : undefined,
    embedMode: typeof input.embedMode === 'boolean' ? input.embedMode : false,
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Get or create user wallet (mock for now, Circle integration ready)
 */
async function getUserWallet(userId: string, userEmail: string): Promise<{
  walletId: string
  walletAddress: string
}> {
  try {
    // Check if user already has a wallet
    const existingWallet = await sql`
      SELECT wallet_id, wallet_address
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    if (existingWallet.rows.length > 0) {
      return {
        walletId: existingWallet.rows[0].wallet_id,
        walletAddress: existingWallet.rows[0].wallet_address,
      }
    }

    // Generate mock wallet for demo (Circle integration ready)
    const walletId = `wallet_${userId}_${Date.now()}`
    const walletAddress = `0x${Math.random().toString(16).substring(2, 42)}`

    // Store in database
    await sql`
      INSERT INTO user_wallets (user_id, wallet_id, wallet_address, created_at)
      VALUES (${userId}, ${walletId}, ${walletAddress}, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET wallet_id = ${walletId}, wallet_address = ${walletAddress}
    `

    console.log(`[Payment Intent] Created wallet for user ${userId}`)

    return { walletId, walletAddress }
  } catch (error) {
    console.error('[Payment Intent] Wallet creation error:', error)
    // Return mock wallet for demo
    return {
      walletId: `wallet_${userId}_demo`,
      walletAddress: `0x${Math.random().toString(16).substring(2, 42)}`,
    }
  }
}

/**
 * Store payment intent in database
 */
async function storePaymentIntent(data: {
  paymentId: string
  userId: string
  circleTransferId?: string
  amount: number
  currency: string
  recipientWallet?: string
  description: string
  metadata?: Record<string, string>
  status: string
  walletAddress: string
}): Promise<void> {
  try {
    await sql`
      INSERT INTO payment_intents (
        id,
        user_id,
        circle_transfer_id,
        amount,
        currency,
        status,
        escrow_wallet_id,
        escrow_wallet_address,
        description,
        metadata,
        created_at,
        updated_at
      ) VALUES (
        ${data.paymentId},
        ${data.userId},
        ${data.circleTransferId || null},
        ${data.amount},
        ${data.currency},
        ${data.status},
        ${data.recipientWallet || null},
        ${data.walletAddress},
        ${data.description},
        ${JSON.stringify(data.metadata || {})},
        NOW(),
        NOW()
      )
    `

    console.log(`[Payment Intent] Stored payment ${data.paymentId} in database`)
  } catch (error) {
    console.error('[Payment Intent] Database error:', error)
    // Don't throw - allow request to complete even if DB insert fails
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user details from Clerk
    const user = await currentUser()
    const userEmail = user?.emailAddresses[0]?.emailAddress || 'user@example.com'

    // Parse and validate request body
    const body = await request.json()
    const validatedInput = validateInput(body)

    // Generate payment ID
    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Get or create user wallet
    const { walletId, walletAddress } = await getUserWallet(userId, userEmail)

    // Store payment intent in database
    await storePaymentIntent({
      paymentId,
      userId,
      amount: validatedInput.amount,
      currency: validatedInput.currency || 'GRAIN',
      recipientWallet: validatedInput.recipientWallet,
      description: validatedInput.description,
      metadata: validatedInput.metadata,
      status: 'pending',
      walletAddress,
    })

    // Generate payment URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.wellsonyx.io'
    const paymentUrl = validatedInput.embedMode
      ? `${baseUrl}/api/payments/${paymentId}/embed`
      : `${baseUrl}/checkout?paymentId=${paymentId}`

    console.log(`[Payment Intent] Created for user ${userId}: ${paymentId}`)

    // Return payment details
    return NextResponse.json(
      {
        success: true,
        paymentId,
        paymentUrl,
        embedToken: validatedInput.embedMode ? paymentId : undefined,
        walletAddress,
        amount: validatedInput.amount,
        currency: validatedInput.currency || 'GRAIN',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('[Payment Intent] Error:', error)

    // Handle validation errors
    if (error instanceof Error && error.message.includes('must be')) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.message,
        },
        { status: 400 }
      )
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create payment intent',
      },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
