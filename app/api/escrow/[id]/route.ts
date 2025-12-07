// @ts-nocheck
/**
 * GET /api/escrow/[id]
 *
 * Get escrow details
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getEscrow } from '@/lib/escrow/escrow-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: escrowId } = await params

    // Get escrow
    const escrow = await getEscrow(escrowId)

    // Validate user is party to the deal
    if (escrow.buyerId !== userId && escrow.sellerId !== userId) {
      return NextResponse.json(
        { error: 'You are not a party to this escrow' },
        { status: 403 }
      )
    }

    return NextResponse.json({ escrow })
  } catch (error) {
    console.error('Error fetching escrow:', error)

    if (error instanceof Error && error.message === 'Escrow not found') {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch escrow',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
