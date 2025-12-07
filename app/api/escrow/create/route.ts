/**
 * POST /api/escrow/create
 *
 * Create a new escrow for a deal
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createEscrow } from '@/lib/escrow/escrow-service'
import { CreateEscrowRequest, CreateEscrowResponse } from '@/lib/escrow/types'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateEscrowRequest

    // Validate required fields
    if (
      !body.dealId ||
      !body.buyerId ||
      !body.buyerEmail ||
      !body.sellerId ||
      !body.sellerEmail ||
      !body.amount ||
      typeof body.platformFee !== 'number' ||
      !body.description
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: dealId, buyerId, buyerEmail, sellerId, sellerEmail, amount, platformFee, description',
        },
        { status: 400 }
      )
    }

    // Validate user is party to the deal
    if (userId !== body.buyerId && userId !== body.sellerId) {
      return NextResponse.json(
        { error: 'You must be a party to this deal' },
        { status: 403 }
      )
    }

    // Validate amounts
    if (body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (body.platformFee < 0) {
      return NextResponse.json(
        { error: 'Platform fee cannot be negative' },
        { status: 400 }
      )
    }

    // Validate milestones if provided
    if (body.milestones && body.milestones.length > 0) {
      const totalMilestoneAmount = body.milestones.reduce((sum, m) => sum + m.amount, 0)
      if (Math.abs(totalMilestoneAmount - body.amount) > 0.01) {
        return NextResponse.json(
          {
            error: `Milestone amounts (${totalMilestoneAmount}) must equal deal amount (${body.amount})`,
          },
          { status: 400 }
        )
      }

      for (const milestone of body.milestones) {
        if (!milestone.title || !milestone.description || milestone.amount <= 0) {
          return NextResponse.json(
            { error: 'Invalid milestone: title, description, and positive amount required' },
            { status: 400 }
          )
        }
      }
    }

    // Create escrow
    const escrow = await createEscrow(body)

    const response: CreateEscrowResponse = {
      escrow,
      depositInstructions: {
        walletAddress: escrow.escrowWalletAddress,
        amount: escrow.totalAmount,
        currency: 'USDC',
        network: 'BASE',
      },
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating escrow:', error)
    return NextResponse.json(
      {
        error: 'Failed to create escrow',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
