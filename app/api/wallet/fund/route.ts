/**
 * POST /api/wallet/fund
 *
 * Funds a wallet with USDC.
 * Optionally auto-swaps to GRAIN.
 */

import { NextRequest, NextResponse } from 'next/server'
import { fundWallet } from '@/lib/wallet/manager'
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
    const { walletAddress, amountUSDC, autoSwapToGrain = true } = body

    // Validate required fields
    if (!walletAddress || !amountUSDC) {
      return NextResponse.json(
        { error: 'Wallet address and amount are required' },
        { status: 400 }
      )
    }

    if (amountUSDC <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
        { status: 400 }
      )
    }

    // Fund wallet
    const result = await fundWallet({
      userId,
      walletAddress,
      amountUSDC,
      autoSwapToGrain
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fund wallet' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      grainReceived: result.grainReceived,
      usdcDeposited: result.usdcDeposited,
      message: autoSwapToGrain
        ? 'Wallet funded and swapped to GRAIN successfully'
        : 'Wallet funded with USDC successfully'
    })
  } catch (error) {
    console.error('Error funding wallet:', error)
    return NextResponse.json(
      {
        error: 'Failed to fund wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
