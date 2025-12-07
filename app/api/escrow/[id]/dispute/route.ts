/**
 * POST /api/escrow/[id]/dispute
 *
 * File a dispute on an escrow
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { disputeEscrow, getEscrow } from '@/lib/escrow/escrow-service'
import { DisputeEscrowRequest, DisputeEscrowResponse } from '@/lib/escrow/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const escrowId = params.id

    // Get escrow to validate party
    const escrow = await getEscrow(escrowId)

    const isBuyer = escrow.buyerId === userId
    const isSeller = escrow.sellerId === userId

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: 'Only parties to this escrow can file a dispute' },
        { status: 403 }
      )
    }

    if (escrow.status !== 'funded') {
      return NextResponse.json(
        { error: `Cannot dispute escrow with status: ${escrow.status}` },
        { status: 400 }
      )
    }

    const body = (await request.json()) as DisputeEscrowRequest

    if (!body.reason || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: reason, description' },
        { status: 400 }
      )
    }

    // File the dispute
    const filedBy = isBuyer ? 'buyer' : 'seller'
    const result = await disputeEscrow(escrowId, filedBy, userId, body)

    const response: DisputeEscrowResponse = {
      dispute: result.dispute,
      escrow: result.escrow,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error filing dispute:', error)
    return NextResponse.json(
      {
        error: 'Failed to file dispute',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
