/**
 * Fee Calculation API
 * POST /api/fees/calculate
 *
 * Calculate the success fee for a deal before escrow release.
 * Returns breakdown of fee amount, seller receives, and Wells receives.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { calculateFee, recommendFeeTier, type FeeTier } from '@/lib/fees/fee-calculator'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dealAmount, tier, complexity } = body

    if (!dealAmount || dealAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid deal amount is required' },
        { status: 400 }
      )
    }

    // Determine fee tier
    let feeTier: FeeTier = tier || 'standard'

    // If complexity provided, recommend tier
    if (complexity && !tier) {
      feeTier = recommendFeeTier(dealAmount, complexity)
    }

    // Calculate fee
    const calculation = calculateFee(dealAmount, feeTier)

    return NextResponse.json({
      success: true,
      calculation: {
        dealAmount: calculation.dealAmount,
        tier: calculation.tier,
        feePercent: calculation.feePercent,
        feeAmount: calculation.feeAmount,
        appliedFee: calculation.appliedFee,
        minimumFee: calculation.minimumFee,
        sellerReceives: calculation.sellerReceives,
        wellsReceives: calculation.wellsReceives,
      },
      breakdown: {
        totalInEscrow: calculation.dealAmount,
        feeToWells: calculation.appliedFee,
        amountToSeller: calculation.sellerReceives,
      },
      message: `Fee calculated: ${calculation.feePercent}% of $${calculation.dealAmount.toLocaleString()} = $${calculation.appliedFee.toLocaleString()}`,
    })
  } catch (error) {
    console.error('Error calculating fee:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate fee',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dealAmount = parseFloat(searchParams.get('dealAmount') || '0')
    const tier = (searchParams.get('tier') || 'standard') as FeeTier

    if (!dealAmount || dealAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid deal amount is required' },
        { status: 400 }
      )
    }

    const calculation = calculateFee(dealAmount, tier)

    return NextResponse.json({
      success: true,
      calculation,
    })
  } catch (error) {
    console.error('Error calculating fee:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate fee',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
