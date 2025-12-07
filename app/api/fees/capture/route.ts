/**
 * Fee Capture API
 * POST /api/fees/capture
 *
 * Capture success fee when deal is completed.
 * This is called internally during the escrow release process.
 * Should not be called directly by clients.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { captureFee } from '@/lib/fees/fee-service'
import { type FeeTier } from '@/lib/fees/fee-calculator'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dealId, amount, escrowWalletId, sellerWalletAddress, tier } = body

    // Validate inputs
    if (!dealId || !amount || !escrowWalletId || !sellerWalletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: dealId, amount, escrowWalletId, sellerWalletAddress' },
        { status: 400 }
      )
    }

    // Verify deal exists and user is authorized
    const dealResult = await sql`
      SELECT
        id,
        buyer_id as "buyerId",
        seller_id as "sellerId",
        amount as "dealAmount",
        status
      FROM deals
      WHERE id = ${dealId}
      LIMIT 1
    `

    if (dealResult.rows.length === 0) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const deal = dealResult.rows[0]

    // Only buyer can trigger fee capture (when releasing escrow)
    if (deal.buyerId !== userId) {
      return NextResponse.json(
        { error: 'Only the buyer can trigger fee capture' },
        { status: 403 }
      )
    }

    // Check if deal is in a releasable state
    if (deal.status !== 'escrowed' && deal.status !== 'delivered') {
      return NextResponse.json(
        { error: `Cannot capture fee in ${deal.status} status` },
        { status: 400 }
      )
    }

    // Check if fee already captured
    const existingFee = await sql`
      SELECT id, status FROM fees WHERE deal_id = ${dealId} LIMIT 1
    `

    if (existingFee.rows.length > 0 && existingFee.rows[0].status === 'captured') {
      return NextResponse.json(
        { error: 'Fee already captured for this deal' },
        { status: 400 }
      )
    }

    // Capture the fee
    const feeTier: FeeTier = tier || 'standard'
    const result = await captureFee(
      dealId,
      amount,
      escrowWalletId,
      sellerWalletAddress,
      feeTier
    )

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Fee capture failed',
          details: result.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      fee: {
        id: result.feeId,
        amount: result.feeAmount,
        sellerAmount: result.sellerAmount,
        feeTransferId: result.feeTransferId,
        sellerTransferId: result.sellerTransferId,
      },
      message: `Success fee of $${result.feeAmount.toLocaleString()} captured. Seller receives $${result.sellerAmount.toLocaleString()}.`,
    })
  } catch (error) {
    console.error('Error capturing fee:', error)
    return NextResponse.json(
      {
        error: 'Failed to capture fee',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Retrieve fee capture status for a deal
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dealId = searchParams.get('dealId')

    if (!dealId) {
      return NextResponse.json(
        { error: 'dealId parameter is required' },
        { status: 400 }
      )
    }

    // Get fee record
    const feeResult = await sql`
      SELECT
        f.id,
        f.deal_id as "dealId",
        f.deal_amount as "dealAmount",
        f.tier,
        f.fee_percent as "feePercent",
        f.fee_amount as "feeAmount",
        f.status,
        f.circle_transfer_id as "circleTransferId",
        f.invoice_id as "invoiceId",
        f.created_at as "createdAt",
        f.captured_at as "capturedAt",
        d.buyer_id as "buyerId",
        d.seller_id as "sellerId"
      FROM fees f
      INNER JOIN deals d ON f.deal_id = d.id
      WHERE f.deal_id = ${dealId}
      LIMIT 1
    `

    if (feeResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No fee record found for this deal' },
        { status: 404 }
      )
    }

    const fee = feeResult.rows[0]

    // Verify user is involved in the deal
    if (fee.buyerId !== userId && fee.sellerId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to view this fee' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      fee: {
        id: fee.id,
        dealId: fee.dealId,
        dealAmount: parseFloat(fee.dealAmount),
        tier: fee.tier,
        feePercent: parseFloat(fee.feePercent),
        feeAmount: parseFloat(fee.feeAmount),
        status: fee.status,
        circleTransferId: fee.circleTransferId,
        invoiceId: fee.invoiceId,
        createdAt: fee.createdAt,
        capturedAt: fee.capturedAt,
      },
    })
  } catch (error) {
    console.error('Error fetching fee status:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch fee status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
