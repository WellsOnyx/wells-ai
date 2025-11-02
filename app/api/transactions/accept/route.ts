/**
 * One-Click Deal Acceptance
 *
 * User says "yes, proceed" → Deal created, escrow initiated
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createTransaction, calculatePlatformFee } from '@/lib/transactions'

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
    const { rfqId, sellerId, amount, category } = body

    // Validate inputs
    if (!rfqId || !sellerId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: rfqId, sellerId, amount' },
        { status: 400 }
      )
    }

    // Calculate platform fee
    const fee = calculatePlatformFee({
      amount,
      category: category || 'General',
      // TODO: Load trust scores from database
      buyerTrustScore: 50,
      sellerTrustScore: 50
    })

    // Create transaction
    const transaction = await createTransaction({
      rfqId,
      buyerId: userId,
      sellerId,
      amount,
      wellsFeePercent: fee.feePercent
    })

    // TODO: Send notifications
    // - Email buyer confirming deal
    // - Email seller that deal was accepted
    // - SMS both parties with next steps

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        wellsFee: transaction.wellsFee,
        feePercent: transaction.wellsFeePercent
      },
      message: `Deal accepted! Platform fee: ${fee.feePercent}% ($${(fee.feeAmount / 100).toFixed(2)})`
    })
  } catch (error: any) {
    console.error('[TRANSACTION] Accept error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to accept deal' },
      { status: 500 }
    )
  }
}
