/**
 * Circle Wallet Management API
 *
 * Creates and manages Circle wallets for users
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createWallet, getWalletBalance } from '@/lib/circle-payments'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { currency = 'USD' } = body

    // Create Circle wallet for user
    const wallet = await createWallet({
      userId,
      currency
    })

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        balance: wallet.balance,
        currency: wallet.currency
      }
    })

  } catch (error: any) {
    console.error('[WALLET_CREATE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create wallet' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const walletId = searchParams.get('walletId')

    if (!walletId) {
      return NextResponse.json(
        { error: 'walletId query parameter required' },
        { status: 400 }
      )
    }

    // Get wallet balance
    const balance = await getWalletBalance(walletId)

    return NextResponse.json({
      success: true,
      walletId,
      balance
    })

  } catch (error: any) {
    console.error('[WALLET_BALANCE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get wallet balance' },
      { status: 500 }
    )
  }
}
