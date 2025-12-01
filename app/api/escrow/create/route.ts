/**
 * POST /api/escrow/create
 *
 * Create milestone-based escrow for B2B transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  Escrow,
  toUSDC,
  toGRAIN,
  isValidAddress,
  CONTRACTS,
} from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'

const MilestoneSchema = z.object({
  name: z.string().min(1, 'Milestone name required'),
  percentage: z.number().min(0).max(100),
})

const EscrowSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['USDC', 'GRAIN']),
  seller: z.string().refine(isValidAddress, 'Invalid seller address'),
  buyer: z.string().refine(isValidAddress, 'Invalid buyer address'),
  milestones: z.array(MilestoneSchema).min(1).max(10),
  disputeResolver: z.string().refine(isValidAddress, 'Invalid resolver address').optional(),
  deadline: z.string().datetime(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = EscrowSchema.parse(body)

    // Validate milestones sum to 100%
    const totalPercentage = data.milestones.reduce((sum, m) => sum + m.percentage, 0)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return NextResponse.json(
        {
          error: 'Invalid milestones',
          message: 'Milestone percentages must sum to 100%',
          current: totalPercentage,
        },
        { status: 400 }
      )
    }

    // Determine currency contract address
    const currencyAddress = data.currency === 'USDC' ? CONTRACTS.USDC_TOKEN : CONTRACTS.GRAIN_TOKEN

    // Convert amount to wei
    const amountWei = data.currency === 'USDC' ? toUSDC(data.amount) : toGRAIN(data.amount)

    // Convert deadline to Unix timestamp
    const deadlineTimestamp = BigInt(Math.floor(new Date(data.deadline).getTime() / 1000))

    // Use default resolver if not provided (could be a DAO or admin address)
    const resolver = data.disputeResolver || CONTRACTS.GRAIN_VAULT

    // Create escrow on blockchain
    let escrowId: string
    try {
      const escrowIdRaw = await Escrow.createEscrow(
        amountWei,
        currencyAddress,
        data.seller,
        data.buyer,
        BigInt(data.milestones.length),
        resolver,
        deadlineTimestamp
      )

      escrowId = escrowIdRaw.toString()
    } catch (txError) {
      console.error('[Escrow] Creation failed:', txError)
      return NextResponse.json(
        {
          error: 'Escrow creation failed',
          message: txError instanceof Error ? txError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Store in database
    await query(
      `INSERT INTO escrows (
        escrow_id, seller, buyer, amount, currency,
        milestones, dispute_resolver, deadline, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        escrowId,
        data.seller.toLowerCase(),
        data.buyer.toLowerCase(),
        data.amount,
        data.currency,
        JSON.stringify(data.milestones),
        resolver.toLowerCase(),
        data.deadline,
        'active',
      ]
    )

    // Send notifications to both parties
    await sendEscrowNotification(data.seller, data.buyer, {
      escrowId,
      amount: data.amount,
      currency: data.currency,
      milestones: data.milestones,
      deadline: data.deadline,
    })

    return NextResponse.json({
      success: true,
      escrow: {
        id: escrowId,
        seller: data.seller,
        buyer: data.buyer,
        amount: data.amount,
        currency: data.currency,
        milestones: data.milestones,
        currentMilestone: 0,
        deadline: data.deadline,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      message: 'Escrow created successfully. Funds are locked until milestones are completed.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[API] Escrow creation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create escrow',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Send escrow notifications
 */
async function sendEscrowNotification(
  seller: string,
  buyer: string,
  details: {
    escrowId: string
    amount: number
    currency: string
    milestones: Array<{ name: string; percentage: number }>
    deadline: string
  }
) {
  // This would integrate with email/SMS service
  console.log('[Escrow] Notification sent:', { seller, buyer, escrowId: details.escrowId })

  // TODO: Implement actual notifications
  // - Email both parties
  // - SMS alerts
  // - In-app notifications
}
