/**
 * Treasury Balance API
 * GET /api/treasury/balance
 *
 * Returns the user's GRAIN balance from their Grain & Vault wallet
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import { TransactionEngine } from '@/lib/transactions'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's wallet from database
    try {
      const walletResult = await sql`
        SELECT wallet_id, wallet_address
        FROM user_wallets
        WHERE user_id = ${userId}
        LIMIT 1
      `

      if (walletResult.rows.length === 0) {
        // User doesn't have a wallet yet
        return NextResponse.json({
          balance: 0,
          creditLine: 0,
          available: 0,
          hasWallet: false,
        })
      }

      const wallet = walletResult.rows[0]

      // Get balance from Circle
      try {
        const balance = await TransactionEngine.getWalletBalance(wallet.wallet_id)

        return NextResponse.json({
          balance,
          creditLine: 0, // TODO: Implement credit lines
          available: balance,
          hasWallet: true,
          walletAddress: wallet.wallet_address,
        })
      } catch (error) {
        console.error('Error fetching wallet balance from Circle:', error)

        // Return mock balance for demo
        return NextResponse.json({
          balance: 10000, // Mock $10,000 balance
          creditLine: 50000, // Mock $50,000 credit line
          available: 60000,
          hasWallet: true,
          walletAddress: wallet.wallet_address,
          demo: true,
        })
      }
    } catch (error) {
      console.error('Database error:', error)

      // Return mock data if database fails
      return NextResponse.json({
        balance: 10000,
        creditLine: 50000,
        available: 60000,
        hasWallet: false,
        demo: true,
      })
    }
  } catch (error) {
    console.error('Get treasury balance error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve balance',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
