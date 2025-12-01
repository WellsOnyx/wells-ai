/**
 * POST /api/escrow/:id/dispute
 *
 * Raise a dispute and freeze escrow funds
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Escrow } from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'

const DisputeSchema = z.object({
  raisedBy: z.string(),
  reason: z.string().min(10, 'Please provide detailed reason for dispute'),
  evidence: z.array(z.string()).optional(), // URLs to evidence documents
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const data = DisputeSchema.parse(body)

    // Get escrow details
    const escrowResult = await query(
      'SELECT * FROM escrows WHERE escrow_id = $1',
      [id]
    )

    if (escrowResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Escrow not found' },
        { status: 404 }
      )
    }

    const escrow = escrowResult.rows[0]

    // Check if already disputed
    if (escrow.status === 'disputed') {
      return NextResponse.json(
        { error: 'Escrow is already under dispute' },
        { status: 400 }
      )
    }

    // Check authorization (only buyer or seller)
    const isAuthorized =
      data.raisedBy.toLowerCase() === escrow.buyer.toLowerCase() ||
      data.raisedBy.toLowerCase() === escrow.seller.toLowerCase()

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Only buyer or seller can raise disputes.' },
        { status: 403 }
      )
    }

    // Raise dispute on blockchain
    let txHash: string
    try {
      txHash = await Escrow.raiseDispute(BigInt(id), data.reason)
    } catch (txError) {
      console.error('[Escrow] Dispute raise failed:', txError)
      return NextResponse.json(
        {
          error: 'Failed to raise dispute',
          message: txError instanceof Error ? txError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Update database
    await query(
      `UPDATE escrows SET status = $1, disputed_at = NOW() WHERE escrow_id = $2`,
      ['disputed', id]
    )

    // Store dispute details
    await query(
      `INSERT INTO escrow_disputes (
        escrow_id, raised_by, reason, evidence, tx_hash,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        id,
        data.raisedBy.toLowerCase(),
        data.reason,
        JSON.stringify(data.evidence || []),
        txHash,
        'pending',
      ]
    )

    // Notify dispute resolver
    await notifyDisputeResolver(escrow.dispute_resolver, {
      escrowId: id,
      raisedBy: data.raisedBy,
      reason: data.reason,
      amount: escrow.amount,
      currency: escrow.currency,
    })

    // Notify other party
    const otherParty =
      data.raisedBy.toLowerCase() === escrow.buyer.toLowerCase()
        ? escrow.seller
        : escrow.buyer

    await notifyDisputeRaised(otherParty, {
      escrowId: id,
      raisedBy: data.raisedBy,
      reason: data.reason,
    })

    return NextResponse.json({
      success: true,
      dispute: {
        escrowId: id,
        raisedBy: data.raisedBy,
        reason: data.reason,
        txHash,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      message: 'Dispute raised. Funds are now frozen. A resolver will review the case.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[API] Dispute error:', error)
    return NextResponse.json(
      {
        error: 'Failed to raise dispute',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Notify dispute resolver
 */
async function notifyDisputeResolver(
  resolver: string,
  details: {
    escrowId: string
    raisedBy: string
    reason: string
    amount: number
    currency: string
  }
) {
  console.log('[Escrow] Notifying resolver:', resolver, details)
  // TODO: Send email/notification to resolver
}

/**
 * Notify other party about dispute
 */
async function notifyDisputeRaised(
  address: string,
  details: {
    escrowId: string
    raisedBy: string
    reason: string
  }
) {
  console.log('[Escrow] Notifying party about dispute:', address, details)
  // TODO: Send email/notification to party
}
