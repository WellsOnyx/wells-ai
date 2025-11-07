/**
 * POST /api/transactions/create
 *
 * Creates a new transaction with fee distribution.
 * Handles tithe transfer to Adullam Fund and Wells Treasury.
 */

import { NextRequest, NextResponse } from 'next/server'
import { calculateFee, inferDealType } from '@/lib/pricing/calculator'
import { validatePricing, validateDealType } from '@/lib/pricing/validation'
import { distributeFees, createTitheRecord, executeTitheTransfer } from '@/lib/pricing/tithe'
import { DealType, PaymentRail, DealContext } from '@/lib/pricing/types'
import { auth } from '@clerk/nextjs/server'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - sign in required' },
        { status: 401 }
      )
    }

    const body = await request.json()

    const {
      amount,
      dealType,
      rail = PaymentRail.ACH,
      context,
      dealSourceTag,
      buyerId,
      sellerId
    } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Transaction amount is required and must be positive' },
        { status: 400 }
      )
    }

    if (!buyerId || !sellerId) {
      return NextResponse.json(
        { error: 'Buyer and seller IDs are required' },
        { status: 400 }
      )
    }

    // Determine deal type
    let finalDealType: DealType

    if (dealType) {
      finalDealType = dealType as DealType

      // Validate if context provided
      if (context) {
        const validation = validateDealType(finalDealType, context as DealContext)
        if (!validation.valid) {
          return NextResponse.json(
            {
              error: 'Invalid deal type for given context',
              details: validation.errors
            },
            { status: 400 }
          )
        }
      }
    } else if (context) {
      finalDealType = inferDealType(context as DealContext)
    } else {
      finalDealType = DealType.ORIGINATED
    }

    // Calculate fees
    const breakdown = calculateFee(
      amount,
      finalDealType,
      rail as PaymentRail,
      dealSourceTag
    )

    // Validate pricing
    const validation = validatePricing(breakdown)

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Pricing validation failed',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    // Generate transaction ID
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Distribute fees
    const distribution = distributeFees(breakdown, transactionId)

    // Create tithe record
    const titheRecord = createTitheRecord(transactionId, breakdown)

    // Execute tithe transfer (async)
    const titheResult = await executeTitheTransfer(titheRecord)

    // TODO: Store transaction in database
    // TODO: Transfer funds via Circle API or smart contract
    // TODO: Update credit lines

    return NextResponse.json({
      success: true,
      transactionId,
      breakdown,
      distribution,
      titheRecord: titheResult,
      message: 'Transaction created successfully',
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined
    })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      {
        error: 'Failed to create transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
