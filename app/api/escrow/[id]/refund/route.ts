// @ts-nocheck
/**
 * POST /api/escrow/[id]/refund
 *
 * Refund escrow to buyer
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { refundEscrow, getEscrow } from '@/lib/escrow/escrow-service'
import { RefundEscrowRequest, RefundEscrowResponse } from '@/lib/escrow/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: escrowId } = await params

    // Get escrow to validate seller or admin
    const escrow = await getEscrow(escrowId)

    const isSeller = escrow.sellerId === userId
    const isBuyer = escrow.buyerId === userId
    // In production, would also check for admin/arbitrator role

    // Seller can refund, or system/admin can refund
    if (!isSeller && !isBuyer) {
      return NextResponse.json(
        { error: 'Only parties to this escrow can initiate refund' },
        { status: 403 }
      )
    }

    if (escrow.status !== 'funded' && escrow.status !== 'disputed') {
      return NextResponse.json(
        { error: `Cannot refund escrow with status: ${escrow.status}` },
        { status: 400 }
      )
    }

    if (!escrow.buyerWalletAddress) {
      return NextResponse.json(
        { error: 'Buyer wallet address not set' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as RefundEscrowRequest

    if (!body.reason) {
      return NextResponse.json(
        { error: 'Missing required field: reason' },
        { status: 400 }
      )
    }

    // Validate partial refund amount
    if (body.amount !== undefined) {
      if (body.amount <= 0 || body.amount > escrow.amount) {
        return NextResponse.json(
          { error: `Invalid refund amount. Must be between 0 and ${escrow.amount}` },
          { status: 400 }
        )
      }
    }

    // Refund the escrow
    const result = await refundEscrow(escrowId, body, userId)

    const response: RefundEscrowResponse = {
      escrow: result.escrow,
      transaction: result.transaction,
      refundedAmount: result.refundedAmount,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error refunding escrow:', error)
    return NextResponse.json(
      {
        error: 'Failed to refund escrow',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
