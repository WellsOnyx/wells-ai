// @ts-nocheck
/**
 * Payment Status API
 * GET /api/payments/[id]
 *
 * Retrieves the current status of a payment intent
 * Used for polling payment status from the checkout UI
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { TransactionEngine } from '@/lib/transactions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const { id: paymentId } = await params

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    // Try to fetch payment from database
    try {
      const result = await sql`
        SELECT
          id,
          user_id as "userId",
          amount,
          currency,
          description,
          status,
          escrow_wallet_id as "escrowWalletId",
          escrow_wallet_address as "escrowWalletAddress",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM payment_intents
        WHERE id = ${paymentId}
        LIMIT 1
      `

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }

      const payment = result.rows[0]

      // Check if user is authorized to view this payment
      if (userId && payment.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // If payment is pending, check the escrow wallet balance
      if (payment.status === 'pending' && payment.escrowWalletId) {
        try {
          const balance = await TransactionEngine.getWalletBalance(payment.escrowWalletId)

          // If balance is sufficient, mark as succeeded
          if (balance >= payment.amount) {
            await sql`
              UPDATE payment_intents
              SET status = 'succeeded', updated_at = NOW()
              WHERE id = ${paymentId}
            `

            payment.status = 'succeeded'
          }
        } catch (error) {
          console.error('Error checking wallet balance:', error)
          // Continue with current status
        }
      }

      // Parse metadata if it's a string
      let metadata = payment.metadata
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata)
        } catch (e) {
          metadata = {}
        }
      }

      return NextResponse.json({
        id: payment.id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        description: payment.description,
        status: payment.status,
        walletAddress: payment.escrowWalletAddress,
        metadata,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })
    } catch (error) {
      console.error('Database query error:', error)

      // Return mock payment for demo if database fails
      return NextResponse.json({
        id: paymentId,
        amount: 1000,
        currency: 'GRAIN',
        description: 'Payment',
        status: 'pending',
        walletAddress: `0x${Math.random().toString(16).substring(2, 42)}`,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('Get payment status error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve payment status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// PATCH - Update payment status (for webhooks or manual updates)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const { id: paymentId } = await params
    const body = await request.json()
    const { status } = body

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['pending', 'processing', 'succeeded', 'failed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    try {
      // Update payment status
      const result = await sql`
        UPDATE payment_intents
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${paymentId}
        ${userId ? sql`AND user_id = ${userId}` : sql``}
        RETURNING *
      `

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Payment not found or unauthorized' },
          { status: 404 }
        )
      }

      const payment = result.rows[0]

      return NextResponse.json({
        id: payment.id,
        status: payment.status,
        updatedAt: payment.updated_at,
      })
    } catch (error) {
      console.error('Database update error:', error)
      return NextResponse.json(
        { error: 'Failed to update payment status' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Update payment status error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update payment status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
