// @ts-nocheck
/**
 * Release Deal Payment API
 * POST /api/deals/release
 *
 * Releases GRAIN from escrow to seller upon buyer confirmation.
 * Fee is already collected in GRAIN during the original escrow creation.
 *
 * Flow:
 * 1. Verify buyer authorization and deal status
 * 2. Release GRAIN from escrow to seller
 * 3. Seller receives GRAIN at current (potentially appreciated) value
 * 4. Update deal status to 'released'
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
    const { dealId, tier } = body

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
        escrow_wallet_id as "escrowWalletId",
        escrow_wallet_address as "escrowWalletAddress",
        payment_method as "paymentMethod",
        platform_fee as "platformFee"
      FROM deals
      WHERE id = ${dealId}
      LIMIT 1
    `

    if (dealResult.rows.length === 0) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const deal = dealResult.rows[0]

    // Only buyer can release payment
    if (deal.buyerId !== userId) {
      return NextResponse.json(
        { error: 'Only the buyer can release payment' },
        { status: 403 }
      )
    }

    // Check if deal is in releasable status
    if (deal.status !== 'escrowed' && deal.status !== 'delivered') {
      return NextResponse.json(
        { error: `Cannot release payment in ${deal.status} status` },
        { status: 400 }
      )
    }

    // Get escrow ID from deal
    const escrowId = deal.escrowWalletId

    if (!escrowId) {
      return NextResponse.json(
        { error: 'No escrow found for this deal' },
        { status: 400 }
      )
    }

    // Release the GRAIN escrow
    const releaseResult = await grainRail.releaseEscrow(escrowId, userId)

    if (!releaseResult.success) {
      return NextResponse.json(
        { error: releaseResult.error || 'Failed to release escrow' },
        { status: 400 }
      )
    }

    // Update deal status
    await sql`
      UPDATE deals
      SET status = 'released', updated_at = NOW()
      WHERE id = ${dealId}
    `

    // Get current GRAIN price for context
    const { price } = await grainRail.getPrice()

    return NextResponse.json({
      success: true,
      deal: {
        id: dealId,
        status: 'released',
      },
      escrow: {
        id: escrowId,
        status: 'released',
      },
      release: {
        grainAmount: releaseResult.releasedAmount,
        currentUsdValue: releaseResult.currentValue,
        grainPrice: price,
      },
      message: `Payment released! Seller received ${releaseResult.releasedAmount.toLocaleString()} GRAIN (worth $${releaseResult.currentValue.toFixed(2)})`,
      note: releaseResult.currentValue > parseFloat(deal.amount)
        ? `GRAIN appreciated! Seller received more than the original $${parseFloat(deal.amount).toFixed(2)} deal amount.`
        : undefined,
    })
  } catch (error) {
    console.error('Error releasing deal payment:', error)
    return NextResponse.json(
      {
        error: 'Failed to release payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
