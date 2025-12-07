// @ts-nocheck
/**
 * POST /api/escrow/[id]/fund
 *
 * Fund an escrow with USDC
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fundEscrow, getEscrow } from '@/lib/escrow/escrow-service'
import { FundEscrowRequest, FundEscrowResponse } from '@/lib/escrow/types'

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

    // Get escrow to validate buyer
    const escrow = await getEscrow(escrowId)

    if (escrow.buyerId !== userId) {
      return NextResponse.json(
        { error: 'Only the buyer can fund this escrow' },
        { status: 403 }
      )
    }

    if (escrow.status !== 'created') {
      return NextResponse.json(
        { error: `Escrow is already ${escrow.status}` },
        { status: 400 }
      )
    }

    const body = (await request.json()) as FundEscrowRequest

    if (!body.paymentDetails?.fromWalletId) {
      return NextResponse.json(
        { error: 'Missing payment details: fromWalletId required' },
        { status: 400 }
      )
    }

    // Fund the escrow
    const result = await fundEscrow(escrowId, body)

    const response: FundEscrowResponse = {
      escrow: result.escrow,
      transaction: result.transaction,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error funding escrow:', error)
    return NextResponse.json(
      {
        error: 'Failed to fund escrow',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
