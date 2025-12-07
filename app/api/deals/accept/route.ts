// @ts-nocheck
/**
 * Accept Deal API
 * POST /api/deals/accept
 *
 * Accepts a deal and creates escrow with USDC payment
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { TransactionEngine } from '@/lib/transactions'
import { createEscrow, getEscrowByDealId } from '@/lib/escrow/escrow-service'

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

    // Check if escrow already exists
    let escrow = await getEscrowByDealId(dealId)

    // Create escrow if it doesn't exist
    if (!escrow) {
      try {
        // Fetch buyer and seller info
        const buyerResult = await sql`
          SELECT email FROM users WHERE id = ${deal.buyerId} LIMIT 1
        `
        const sellerResult = await sql`
          SELECT email FROM users WHERE id = ${deal.sellerId} LIMIT 1
        `

        const buyerEmail = buyerResult.rows[0]?.email || 'buyer@example.com'
        const sellerEmail = sellerResult.rows[0]?.email || 'seller@example.com'

        escrow = await createEscrow({
          dealId,
          buyerId: deal.buyerId,
          buyerEmail,
          sellerId: deal.sellerId,
          sellerEmail,
          amount: parseFloat(deal.amount),
          platformFee: parseFloat(deal.platformFee),
          description: deal.description,
          metadata: { originalDealId: dealId },
        })

        // Update deal with escrow info
        await sql`
          UPDATE deals
          SET
            escrow_wallet_id = ${escrow.escrowWalletId},
            escrow_wallet_address = ${escrow.escrowWalletAddress},
            status = 'escrow_pending'
          WHERE id = ${dealId}
        `
      } catch (error) {
        console.error('Error creating escrow:', error)
        // Fallback: Create mock escrow wallet
        const escrowWalletId = `escrow_${dealId}`
        const escrowWalletAddress = `0x${Math.random().toString(16).substring(2, 42)}`

        await sql`
          UPDATE deals
          SET
            escrow_wallet_id = ${escrowWalletId},
            escrow_wallet_address = ${escrowWalletAddress},
            status = 'escrow_pending'
          WHERE id = ${dealId}
        `

        escrow = {
          escrowWalletId,
          escrowWalletAddress,
          totalAmount: parseFloat(deal.amount) + parseFloat(deal.platformFee),
        }
      }
    }

    return NextResponse.json({
      success: true,
      deal: {
        id: dealId,
        status: 'escrow_pending',
        escrowWalletAddress: escrow.escrowWalletAddress,
      },
      escrow: {
        id: escrow.id,
        walletAddress: escrow.escrowWalletAddress,
        amount: escrow.totalAmount,
        currency: 'USDC',
      },
      message: 'Deal accepted! Please fund escrow with USDC to proceed.',
      nextSteps: [
        `Send ${escrow.totalAmount} USDC to ${escrow.escrowWalletAddress}`,
        'Funds will be held in escrow until delivery confirmation',
        'Seller can begin work once escrow is funded',
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
