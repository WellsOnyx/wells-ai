/**
 * GRAIN Vault Deposit API
 *
 * POST: Get deposit address for USDC
 *
 * Flow:
 * 1. User calls this endpoint
 * 2. We return Circle wallet address for deposit
 * 3. User sends USDC to that address
 * 4. Circle webhook notifies us of deposit
 * 5. We credit GRAIN 1:1
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Circle API config
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY
const CIRCLE_API_URL = 'https://api.circle.com/v1'

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has a wallet
    const walletResult = await sql`
      SELECT user_id, wallet_id, wallet_address, balance
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    let walletAddress: string
    let walletId: string

    if (walletResult.rows.length === 0) {
      // Create new Circle wallet for user
      const walletData = await createCircleWallet(userId)
      walletAddress = walletData.address
      walletId = walletData.walletId

      // Store in database
      await sql`
        INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance)
        VALUES (${userId}, ${walletId}, ${walletAddress}, 0)
      `
    } else {
      walletAddress = walletResult.rows[0].wallet_address
      walletId = walletResult.rows[0].wallet_id
    }

    // Get current GRAIN balance
    const balance = parseFloat(walletResult.rows[0]?.balance || '0')

    return NextResponse.json({
      success: true,
      deposit: {
        address: walletAddress,
        network: 'Base (L2)',
        currency: 'USDC',
        instructions: [
          'Send USDC on Base network to the address above',
          'Minimum deposit: $10 USDC',
          'GRAIN will be credited 1:1 after 1 confirmation (~2 seconds)',
          'Do NOT send from an exchange - use a self-custody wallet'
        ]
      },
      balance: {
        grain: balance,
        usd_value: balance // 1:1 with USDC
      }
    })
  } catch (error: any) {
    console.error('Deposit error:', error)
    return NextResponse.json(
      { error: 'Failed to get deposit address', details: error.message },
      { status: 500 }
    )
  }
}

// GET: Check deposit status / balance
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const walletResult = await sql`
      SELECT user_id, wallet_id, wallet_address, balance, updated_at
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    if (walletResult.rows.length === 0) {
      return NextResponse.json({
        has_wallet: false,
        balance: 0,
        message: 'No wallet found. Call POST to create one.'
      })
    }

    const wallet = walletResult.rows[0]

    // Get recent transactions
    const txResult = await sql`
      SELECT id, type, amount, status, created_at
      FROM grain_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `

    return NextResponse.json({
      has_wallet: true,
      wallet: {
        address: wallet.wallet_address,
        network: 'Base'
      },
      balance: {
        grain: parseFloat(wallet.balance),
        usd_value: parseFloat(wallet.balance)
      },
      recent_transactions: txResult.rows,
      last_updated: wallet.updated_at
    })
  } catch (error: any) {
    console.error('Balance check error:', error)
    return NextResponse.json(
      { error: 'Failed to check balance', details: error.message },
      { status: 500 }
    )
  }
}

// Helper: Create Circle wallet
async function createCircleWallet(userId: string): Promise<{ walletId: string; address: string }> {
  if (!CIRCLE_API_KEY) {
    // Development fallback - generate placeholder address
    const placeholderAddress = `0x${Buffer.from(userId).toString('hex').substring(0, 40)}`
    return {
      walletId: `dev-wallet-${userId}`,
      address: placeholderAddress
    }
  }

  // Call Circle API to create wallet
  const response = await fetch(`${CIRCLE_API_URL}/w3s/developer/wallets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CIRCLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotencyKey: `wallet-${userId}-${Date.now()}`,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      count: 1,
      blockchains: ['BASE'],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Circle wallet creation failed:', error)
    throw new Error(`Circle API error: ${error}`)
  }

  const data = await response.json()
  const wallet = data.data.wallets[0]

  return {
    walletId: wallet.id,
    address: wallet.address,
  }
}
