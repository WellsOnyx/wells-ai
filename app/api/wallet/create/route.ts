/**
 * POST /api/wallet/create
 *
 * Creates a GRAIN wallet for a user.
 * Optionally funds with initial USDC deposit.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createWallet } from '@/lib/wallet/manager'
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
    const { email, businessName, initialDepositUSDC } = body

    // Validate required fields
    if (!email || !businessName) {
      return NextResponse.json(
        { error: 'Email and business name are required' },
        { status: 400 }
      )
    }

    // Create wallet
    const result = await createWallet({
      userId,
      email,
      businessName,
      initialDepositUSDC
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create wallet' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      wallet: result.wallet,
      message: result.message
    })
  } catch (error) {
    console.error('Error creating wallet:', error)
    return NextResponse.json(
      {
        error: 'Failed to create wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
