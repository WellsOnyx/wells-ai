// @ts-nocheck
/**
 * Accept Deal API
 * POST /api/deals/accept
 *
 * Accepts a deal and creates GRAIN escrow
 * GRAIN escrows appreciate with price during lock period
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { grainRail } from '@/lib/payments/grain-rail'
import { unifiedUser } from '@/lib/identity/unified-user'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dealId } = body

    if (!dealId) {
      return NextResponse.json(
        { error: 'Deal ID is required' },
        { status: 400 }
      )
    }

    // Fetch deal from database
    const dealResult = await sql`
      SELECT
        id,
        buyer_id as "buyerId",
        seller_id as "sellerId",
        amount,
        currency,
        description,
        status,
        platform_fee as "platformFee",
        escrow_wallet_id as "escrowWalletId",
        escrow_wallet_address as "escrowWalletAddress"
      FROM deals
      WHERE id = ${dealId}
      LIMIT 1
    `

    if (dealResult.rows.length === 0) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const deal = dealResult.rows[0]

    // Check authorization - user must be buyer or seller
    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if deal is in acceptable status
    if (deal.status !== 'proposed' && deal.status !== 'negotiating') {
      return NextResponse.json(
        { error: `Deal cannot be accepted in ${deal.status} status` },
        { status: 400 }
      )
    }

    // Update deal status to agreed
    await sql`
      UPDATE deals
      SET status = 'agreed', updated_at = NOW()
      WHERE id = ${dealId}
    `

    // Get buyer's unified identity
    const buyer = await unifiedUser.get(userId)
    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer account not found. Please complete onboarding.' },
        { status: 400 }
      )
    }

    // Get current GRAIN price
    const { price } = await grainRail.getPrice()
    const dealAmount = parseFloat(deal.amount)
    const grainAmount = dealAmount / price

    // Create GRAIN escrow
    const escrowResult = await grainRail.escrow({
      fromUserId: buyer.unifiedId,
      toUserId: deal.sellerId,
      amount: dealAmount,
      currency: 'USD',
      releaseConditions: `Delivery confirmation for deal: ${deal.description}`,
      reference: dealId,
      allowPartialRelease: false,
    })

    if (!escrowResult.success) {
      // Check if it's a funding issue
      if (escrowResult.error?.includes('Insufficient')) {
        return NextResponse.json({
          success: false,
          needsFunding: true,
          required: {
            grainAmount,
            usdAmount: dealAmount,
            grainPrice: price,
          },
          available: {
            grainBalance: buyer.grainBalance,
            creditAvailable: buyer.creditAvailable,
          },
          message: escrowResult.error,
        }, { status: 402 })
      }
      return NextResponse.json({ error: escrowResult.error }, { status: 400 })
    }

    // Update deal with escrow info
    await sql`
      UPDATE deals
      SET
        escrow_wallet_id = ${escrowResult.escrowId},
        status = 'escrowed',
        updated_at = NOW()
      WHERE id = ${dealId}
    `

    return NextResponse.json({
      success: true,
      deal: {
        id: dealId,
        status: 'escrowed',
      },
      escrow: {
        id: escrowResult.escrowId,
        grainAmount: escrowResult.grainAmount,
        grainPriceAtLock: escrowResult.grainPriceAtLock,
        usdEquivalent: escrowResult.grainAmount * price,
        currency: 'GRAIN',
      },
      message: `Deal accepted! ${escrowResult.grainAmount.toLocaleString()} GRAIN ($${dealAmount.toFixed(2)}) held in escrow.`,
      note: 'GRAIN escrow appreciates with price. Value may exceed initial amount when released.',
      nextSteps: [
        'GRAIN is now locked in escrow',
        'Seller can begin work immediately',
        'Release payment after delivery confirmation',
        'GRAIN appreciation benefits seller during escrow period',
      ],
    })
  } catch (error) {
    console.error('Error accepting deal:', error)
    return NextResponse.json(
      {
        error: 'Failed to accept deal',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
