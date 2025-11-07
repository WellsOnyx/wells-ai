/**
 * POST /api/pricing/estimate
 *
 * Estimates fees for a transaction before it happens.
 * Shows complete breakdown with savings opportunities.
 */

import { NextRequest, NextResponse } from 'next/server'
import { calculateFee, inferDealType, calculateSavings } from '@/lib/pricing/calculator'
import { validatePricing, validateDealType } from '@/lib/pricing/validation'
import { DealType, PaymentRail, DealContext } from '@/lib/pricing/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      amount,
      dealType,
      rail = PaymentRail.ACH,
      context,
      dealSourceTag
    } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Transaction amount is required and must be positive' },
        { status: 400 }
      )
    }

    // Determine deal type (auto-infer if not provided)
    let finalDealType: DealType

    if (dealType) {
      // Use provided deal type
      finalDealType = dealType as DealType

      // Validate the provided deal type if we have context
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
      // Auto-infer deal type from context
      finalDealType = inferDealType(context as DealContext)
    } else {
      // Default to originated (most conservative)
      finalDealType = DealType.ORIGINATED
    }

    // Calculate fee
    const breakdown = calculateFee(
      amount,
      finalDealType,
      rail as PaymentRail,
      dealSourceTag
    )

    // Validate pricing
    const validation = validatePricing(breakdown)

    // Calculate savings if not already in-network
    let savings = null
    if (finalDealType !== DealType.IN_NETWORK) {
      savings = calculateSavings(amount, finalDealType, rail as PaymentRail, context)
    }

    return NextResponse.json({
      success: true,
      breakdown,
      savings,
      validation,
      message: validation.valid
        ? 'Fee estimate calculated successfully'
        : 'Fee estimate has validation warnings'
    })
  } catch (error) {
    console.error('Error estimating fees:', error)
    return NextResponse.json(
      {
        error: 'Failed to estimate fees',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
