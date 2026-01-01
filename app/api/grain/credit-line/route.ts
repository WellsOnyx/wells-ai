/**
 * GRAIN Credit Line API
 *
 * Endpoints:
 * - GET: Get user's credit line position
 * - POST: Deposit, spend, repay, or withdraw
 *
 * The three-layer model:
 * 1. Protected Deposit (always withdrawable)
 * 2. Credit Line (0% interest, 0% fees)
 * 3. Appreciation (bonus GRAIN from ecosystem growth)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { CreditLineEngine } from '@/lib/grain/credit-line-engine'

// GET /api/grain/credit-line
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // User can only access their own credit line position

    const position = await CreditLineEngine.getPosition(userId)

    if (!position) {
      // Return empty position for new users
      return NextResponse.json({
        success: true,
        position: null,
        message: 'No position found. Make a deposit to get started.',
      })
    }

    // Get current GRAIN price
    const grainPrice = await CreditLineEngine.getCurrentGrainPrice()

    // Calculate current values
    const currentValue =
      (position.creditLineAvailable + position.appreciationGrain) * grainPrice

    return NextResponse.json({
      success: true,
      position: {
        ...position,
        grainPrice,
        currentValue,
        totalGrain:
          position.creditLineAvailable + position.appreciationGrain,
        summary: {
          protectedDepositFormatted: `$${position.protectedDeposit.toLocaleString()}`,
          creditLineAvailableFormatted: `${position.creditLineAvailable.toLocaleString()} GRAIN`,
          creditLineUsedFormatted: `${position.creditLineUsed.toLocaleString()} GRAIN`,
          appreciationFormatted: `${position.appreciationGrain.toLocaleString()} GRAIN`,
          currentValueFormatted: `$${currentValue.toLocaleString()}`,
          grainPriceFormatted: `$${grainPrice.toFixed(4)}`,
        },
      },
    })
  } catch (error: any) {
    console.error('[Credit Line API] GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/grain/credit-line
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, amount, grainAmount, counterpartyId, description } = body

    // User can only perform actions on their own account

    let result: any

    switch (action) {
      case 'deposit':
        if (!amount || amount <= 0) {
          return NextResponse.json(
            { success: false, error: 'amount must be positive' },
            { status: 400 }
          )
        }
        result = await CreditLineEngine.deposit(userId, amount)
        break

      case 'spend':
        if (!grainAmount || grainAmount <= 0) {
          return NextResponse.json(
            { success: false, error: 'grainAmount must be positive' },
            { status: 400 }
          )
        }
        result = await CreditLineEngine.spend(
          userId,
          grainAmount,
          counterpartyId,
          description
        )
        break

      case 'repay':
        if (!grainAmount && !amount) {
          return NextResponse.json(
            { success: false, error: 'grainAmount or amount required' },
            { status: 400 }
          )
        }
        result = await CreditLineEngine.repayCredit(
          userId,
          grainAmount,
          amount
        )
        break

      case 'withdraw':
        if (!amount || amount <= 0) {
          return NextResponse.json(
            { success: false, error: 'amount must be positive' },
            { status: 400 }
          )
        }
        result = await CreditLineEngine.withdraw(userId, amount)
        break

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}. Valid actions: deposit, spend, repay, withdraw`,
          },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      action,
      ...result,
    })
  } catch (error: any) {
    console.error('[Credit Line API] POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
