/**
 * Wallet Onboarding API - Grain & Vault (Circle)
 *
 * Creates Circle wallets for users to receive GRAIN payments.
 * Powered by Grain & Vault infrastructure.
 *
 * POST /api/connect/onboard - Create wallet for user
 * GET /api/connect/onboard - Check wallet status
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { TransactionEngine } from '@/lib/transactions'

// Store wallet mappings (use database in production)
const userWallets = new Map<string, { walletId: string; walletAddress: string }>()

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if user already has a wallet
    const existingWallet = userWallets.get(userId)

    if (existingWallet) {
      // Get current balance
      const balance = await TransactionEngine.getWalletBalance(existingWallet.walletId)

      return NextResponse.json({
        success: true,
        walletId: existingWallet.walletId,
        walletAddress: existingWallet.walletAddress,
        balance,
        currency: 'GRAIN',
        chain: 'BASE',
        isReady: true,
        message: 'Wallet already exists and is ready to receive GRAIN.',
      })
    }

    // Create new Circle wallet
    const wallet = await TransactionEngine.createWallet({
      id: userId,
      type: 'seller',
      name: name || 'User',
      email,
    })

    userWallets.set(userId, wallet)

    return NextResponse.json({
      success: true,
      walletId: wallet.walletId,
      walletAddress: wallet.walletAddress,
      balance: 0,
      currency: 'GRAIN',
      chain: 'BASE',
      isReady: true,
      message: 'Wallet created on Base L2. Ready to receive GRAIN payments.',
    })
  } catch (error) {
    console.error('Error creating wallet:', error)
    return NextResponse.json(
      { error: 'Failed to create wallet' },
      { status: 500 }
    )
  }
}

// GET - Check wallet status
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wallet = userWallets.get(userId)

    if (!wallet) {
      return NextResponse.json({
        hasWallet: false,
        isReady: false,
        message: 'No wallet found. Create one to receive GRAIN payments.',
      })
    }

    // Get current balance
    const balance = await TransactionEngine.getWalletBalance(wallet.walletId)

    return NextResponse.json({
      hasWallet: true,
      walletId: wallet.walletId,
      walletAddress: wallet.walletAddress,
      balance,
      currency: 'GRAIN',
      chain: 'BASE',
      isReady: true,
      message: 'Wallet ready to receive GRAIN payments.',
    })
  } catch (error) {
    console.error('Error checking wallet status:', error)
    return NextResponse.json(
      { error: 'Failed to check wallet status' },
      { status: 500 }
    )
  }
}
