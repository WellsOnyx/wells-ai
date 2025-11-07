/**
 * GET /api/wallet/balance?address=0x...
 *
 * Gets wallet balance and credit line info.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalance, calculateCreditLine } from '@/lib/wallet/manager'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - sign in required' },
        { status: 401 }
      )
    }

    // Get wallet address from query params
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Get wallet balance
    const wallet = await getWalletBalance(address)

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      )
    }

    // Calculate credit line info
    const totalDeposited = wallet.usdcBalance + wallet.grainBalance
    const creditLine = await calculateCreditLine(userId, totalDeposited)

    return NextResponse.json({
      success: true,
      wallet,
      creditLine
    })
  } catch (error) {
    console.error('Error fetching wallet balance:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch wallet balance',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
