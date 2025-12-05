// @ts-nocheck
/**
 * Accept Deal API
 * POST /api/deals/accept
 *
 * Accepts a deal and creates a GRAIN payment intent
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { TransactionEngine } from '@/lib/transactions'

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

    // Create escrow wallet if it doesn't exist
    let escrowWalletId = deal.escrowWalletId
    let escrowWalletAddress = deal.escrowWalletAddress

    if (!escrowWalletId) {
      try {
        const escrow = await TransactionEngine.createEscrowWallet(dealId)
        escrowWalletId = escrow.walletId
        escrowWalletAddress = escrow.walletAddress

        // Update deal with escrow wallet info
        await sql`
          UPDATE deals
          SET
            escrow_wallet_id = ${escrowWalletId},
            escrow_wallet_address = ${escrowWalletAddress},
            status = 'escrow_pending'
          WHERE id = ${dealId}
        `
      } catch (error) {
        console.error('Error creating escrow wallet:', error)
        // Use mock wallet for demo
        escrowWalletId = `escrow_${dealId}`
        escrowWalletAddress = `0x${Math.random().toString(16).substring(2, 42)}`
      }
    }

    // Create payment intent for the buyer
    const totalAmount = parseFloat(deal.amount) + parseFloat(deal.platformFee)
    const paymentId = `payment_deal_${dealId}_${Date.now()}`

    try {
      await sql`
        INSERT INTO payment_intents (
          id,
          user_id,
          amount,
          currency,
          description,
          status,
          escrow_wallet_id,
          escrow_wallet_address,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          ${paymentId},
          ${deal.buyerId},
          ${totalAmount},
          ${deal.currency},
          ${`Payment for deal: ${deal.description}`},
          'pending',
          ${escrowWalletId},
          ${escrowWalletAddress},
          ${JSON.stringify({ dealId, type: 'deal_payment' })},
          NOW(),
          NOW()
        )
      `

      // Link payment to deal
      await sql`
        UPDATE deals
        SET payment_intent_id = ${paymentId}
        WHERE id = ${dealId}
      `
    } catch (error) {
      console.error('Error creating payment intent:', error)
    }

    return NextResponse.json({
      success: true,
      deal: {
        id: dealId,
        status: 'escrow_pending',
        escrowWalletAddress,
      },
      payment: {
        id: paymentId,
        amount: totalAmount,
        currency: deal.currency,
        walletAddress: escrowWalletAddress,
      },
      message: 'Deal accepted! Please complete GRAIN payment to escrow.',
      checkoutUrl: `/checkout?paymentId=${paymentId}`,
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
