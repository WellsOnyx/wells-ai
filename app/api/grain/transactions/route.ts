// @ts-nocheck
/**
 * GRAIN Transactions API
 *
 * GET /api/grain/transactions - Get user's transaction history
 *
 * Returns unified transaction history across all rails.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { grainRail } from '@/lib/payments/grain-rail'
import { unifiedUser } from '@/lib/identity/unified-user'
import { neon } from '@neondatabase/serverless'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export const runtime = 'nodejs'

/**
 * GET - Get transaction history
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Get unified user identity
    const user = await unifiedUser.get(clerkUserId)
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // Filter by transaction type
    const rail = searchParams.get('rail') // Filter by rail (grain, usdc, usd)

    // Build query with filters
    let transactions

    if (type && rail) {
      transactions = await sql`
        SELECT
          ut.*,
          cp.email as counterparty_email
        FROM unified_transactions ut
        LEFT JOIN treasury_accounts cp ON cp.id::text = ut.counterparty_id OR cp.clerk_user_id = ut.counterparty_id
        WHERE (ut.user_id = ${user.unifiedId} OR ut.counterparty_id = ${user.unifiedId})
          AND ut.type = ${type}
          AND ut.rail = ${rail}
        ORDER BY ut.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (type) {
      transactions = await sql`
        SELECT
          ut.*,
          cp.email as counterparty_email
        FROM unified_transactions ut
        LEFT JOIN treasury_accounts cp ON cp.id::text = ut.counterparty_id OR cp.clerk_user_id = ut.counterparty_id
        WHERE (ut.user_id = ${user.unifiedId} OR ut.counterparty_id = ${user.unifiedId})
          AND ut.type = ${type}
        ORDER BY ut.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (rail) {
      transactions = await sql`
        SELECT
          ut.*,
          cp.email as counterparty_email
        FROM unified_transactions ut
        LEFT JOIN treasury_accounts cp ON cp.id::text = ut.counterparty_id OR cp.clerk_user_id = ut.counterparty_id
        WHERE (ut.user_id = ${user.unifiedId} OR ut.counterparty_id = ${user.unifiedId})
          AND ut.rail = ${rail}
        ORDER BY ut.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      transactions = await sql`
        SELECT
          ut.*,
          cp.email as counterparty_email
        FROM unified_transactions ut
        LEFT JOIN treasury_accounts cp ON cp.id::text = ut.counterparty_id OR cp.clerk_user_id = ut.counterparty_id
        WHERE ut.user_id = ${user.unifiedId} OR ut.counterparty_id = ${user.unifiedId}
        ORDER BY ut.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    }

    // Get current GRAIN price
    const { price } = await grainRail.getPrice()

    // Transform transactions
    const transformedTransactions = transactions.map((t: any) => {
      const isOutgoing = t.user_id === user.unifiedId
      const amount = parseFloat(t.amount)
      const priceAtExecution = parseFloat(t.grain_price_at_execution || price)

      // Calculate current value if GRAIN transaction
      const currentValue = t.rail === 'grain' ? amount * price : amount
      const valueAtExecution = t.rail === 'grain' ? amount * priceAtExecution : amount
      const valueChange = currentValue - valueAtExecution

      return {
        id: t.id,
        type: t.type,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        amount,
        currency: t.currency,
        rail: t.rail,
        method: t.method,
        fee: parseFloat(t.fee_amount || '0'),
        feeCurrency: t.fee_currency,
        counterparty: {
          userId: isOutgoing ? t.counterparty_id : t.user_id,
          email: t.counterparty_email,
          address: t.counterparty_address,
        },
        reference: t.reference,
        memo: t.memo,
        status: t.status,
        errorMessage: t.error_message,
        // GRAIN-specific
        grainPriceAtExecution: priceAtExecution,
        currentGrainPrice: price,
        valueAtExecution,
        currentValue,
        valueChange,
        valueChangePercent: valueAtExecution > 0
          ? ((valueChange / valueAtExecution) * 100).toFixed(2)
          : '0',
        // Credit line
        creditLineUsed: parseFloat(t.credit_line_draw || '0'),
        conversionRate: t.conversion_rate ? parseFloat(t.conversion_rate) : undefined,
        // Escrow
        escrowId: t.escrow_id,
        // External IDs
        circleTransferId: t.circle_transfer_id,
        stripePaymentIntentId: t.stripe_payment_intent_id,
        // Timestamps
        createdAt: t.created_at,
        completedAt: t.completed_at,
      }
    })

    // Get summary stats
    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COALESCE(SUM(amount) FILTER (WHERE user_id = ${user.unifiedId} AND status = 'completed'), 0) as total_sent,
        COALESCE(SUM(amount) FILTER (WHERE counterparty_id = ${user.unifiedId} AND status = 'completed'), 0) as total_received,
        COALESCE(SUM(fee_amount) FILTER (WHERE status = 'completed'), 0) as total_fees
      FROM unified_transactions
      WHERE user_id = ${user.unifiedId} OR counterparty_id = ${user.unifiedId}
    `

    return NextResponse.json({
      transactions: transformedTransactions,
      pagination: {
        limit,
        offset,
        hasMore: transactions.length === limit,
      },
      summary: {
        completed: parseInt(stats?.completed_count || '0'),
        pending: parseInt(stats?.pending_count || '0'),
        failed: parseInt(stats?.failed_count || '0'),
        totalSent: parseFloat(stats?.total_sent || '0'),
        totalReceived: parseFloat(stats?.total_received || '0'),
        totalFees: parseFloat(stats?.total_fees || '0'),
        netFlow: parseFloat(stats?.total_received || '0') - parseFloat(stats?.total_sent || '0'),
      },
      currentGrainPrice: price,
    })

  } catch (error: any) {
    console.error('[GRAIN Transactions] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get transactions', details: error.message },
      { status: 500 }
    )
  }
}
