/**
 * Treasury Wallet Operations API
 *
 * POST /api/treasury/wallet - Create a new Circle wallet
 * GET /api/treasury/wallet?accountId=xxx - Get wallet details and balance
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCircleClient } from '@/lib/circle/client'
import {
  createWallet,
  getWallets,
  getWalletByWalletId,
  updateWalletBalance,
  getAccountByApiKey,
  getAccount,
} from '@/lib/treasury-db'

// ============================================================================
// POST - Create new Circle wallet for treasury account
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const apiKey = authHeader.substring(7)
    const account = await getAccountByApiKey(apiKey)

    if (!account) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { description, blockchain } = body

    // Initialize Circle client
    const circleClient = getCircleClient()

    // Create Circle wallet
    const circleWallet = await circleClient.createWallet({
      userId: account.id,
      description: description || `Treasury Wallet - ${account.companyName}`,
      blockchain,
    })

    // Save to database
    const wallet = await createWallet({
      accountId: account.id,
      walletId: circleWallet.walletId,
      address: circleWallet.address,
      blockchain: circleWallet.blockchain,
      currency: 'USDC',
    })

    // Get initial balance
    const balance = await circleClient.getWalletBalance(circleWallet.walletId)
    await updateWalletBalance(circleWallet.walletId, balance)

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        walletId: wallet.walletId,
        address: wallet.address,
        blockchain: wallet.blockchain,
        currency: wallet.currency,
        balance: balance,
        status: wallet.status,
        createdAt: wallet.createdAt,
      },
    })
  } catch (error) {
    console.error('Error creating wallet:', error)
    return NextResponse.json(
      {
        error: 'Failed to create wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get wallet details and balance
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const accountId = searchParams.get('accountId')
    const walletId = searchParams.get('walletId')

    if (!accountId && !walletId) {
      return NextResponse.json(
        { error: 'accountId or walletId is required' },
        { status: 400 }
      )
    }

    // Get API key from Authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const apiKey = authHeader.substring(7)
    const account = await getAccountByApiKey(apiKey)

    if (!account) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    // Verify account access
    if (accountId && account.id !== accountId) {
      return NextResponse.json(
        { error: 'Unauthorized access to account' },
        { status: 403 }
      )
    }

    const circleClient = getCircleClient()

    if (walletId) {
      // Get specific wallet
      const wallet = await getWalletByWalletId(walletId)

      if (!wallet) {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 }
        )
      }

      // Verify wallet belongs to account
      if (wallet.accountId !== account.id) {
        return NextResponse.json(
          { error: 'Unauthorized access to wallet' },
          { status: 403 }
        )
      }

      // Get current balance from Circle
      const balance = await circleClient.getWalletBalance(wallet.walletId)
      await updateWalletBalance(wallet.walletId, balance)

      return NextResponse.json({
        success: true,
        wallet: {
          id: wallet.id,
          walletId: wallet.walletId,
          address: wallet.address,
          blockchain: wallet.blockchain,
          currency: wallet.currency,
          balance: balance,
          status: wallet.status,
          kycStatus: wallet.kycStatus,
          createdAt: wallet.createdAt,
          lastSyncAt: new Date().toISOString(),
        },
      })
    } else {
      // Get all wallets for account
      const wallets = await getWallets(account.id)

      // Get balances for all wallets
      const walletsWithBalances = await Promise.all(
        wallets.map(async (wallet) => {
          try {
            const balance = await circleClient.getWalletBalance(wallet.walletId)
            await updateWalletBalance(wallet.walletId, balance)

            return {
              id: wallet.id,
              walletId: wallet.walletId,
              address: wallet.address,
              blockchain: wallet.blockchain,
              currency: wallet.currency,
              balance: balance,
              status: wallet.status,
              kycStatus: wallet.kycStatus,
              createdAt: wallet.createdAt,
              lastSyncAt: new Date().toISOString(),
            }
          } catch (error) {
            console.error(`Error getting balance for wallet ${wallet.walletId}:`, error)
            return {
              id: wallet.id,
              walletId: wallet.walletId,
              address: wallet.address,
              blockchain: wallet.blockchain,
              currency: wallet.currency,
              balance: wallet.balance,
              status: wallet.status,
              kycStatus: wallet.kycStatus,
              createdAt: wallet.createdAt,
              lastSyncAt: wallet.lastSyncAt,
            }
          }
        })
      )

      return NextResponse.json({
        success: true,
        wallets: walletsWithBalances,
        totalBalance: walletsWithBalances.reduce((sum, w) => sum + w.balance, 0),
      })
    }
  } catch (error) {
    console.error('Error getting wallet:', error)
    return NextResponse.json(
      {
        error: 'Failed to get wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
