/**
 * POST /api/transactions/escrow
 *
 * Create escrow and hold funds using Airwallex split payments
 * Triggered after buyer accepts deal
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createEscrow } from '@/lib/transactions'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { transactionId } = body

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID required' },
        { status: 400 }
      )
    }

    // Get transaction details
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Verify user is the buyer
    if (transaction.buyerId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - not the buyer' },
        { status: 403 }
      )
    }

    // Check transaction status
    if (transaction.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: `Transaction must be in ACCEPTED status (current: ${transaction.status})` },
        { status: 400 }
      )
    }

    // Create escrow
    const result = await createEscrow({
      transactionId: transaction.id,
      amount: transaction.amount,
      wellsFee: transaction.wellsFee,
      sellerId: transaction.sellerId,
      metadata: {
        rfqId: transaction.rfqId,
        buyerId: transaction.buyerId
      }
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create escrow' },
        { status: 500 }
      )
    }

    // TODO: Send notifications
    // - Email buyer with payment instructions
    // - Email seller that funds are in escrow
    // - SMS both parties

    return NextResponse.json({
      success: true,
      escrow: {
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        amount: transaction.amount,
        wellsFee: transaction.wellsFee,
        sellerReceives: transaction.amount - transaction.wellsFee
      },
      message: 'Escrow created successfully. Complete payment to proceed.'
    })
  } catch (error: any) {
    console.error('[ESCROW] Creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create escrow' },
      { status: 500 }
    )
  }
}
