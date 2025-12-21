/**
 * Simple Grain Wallet API
 *
 * Returns user's GRAIN balance and recent transactions
 * Uses existing user_wallets and grain_transactions tables
 * Includes approval status for manual approval flow
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create user wallet
    let walletResult = await sql`
      SELECT user_id, balance, wallet_id, wallet_address, approved, approved_at, approved_by, created_at, updated_at
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    // Auto-create wallet if doesn't exist (with approved = false by default)
    if (walletResult.rows.length === 0) {
      await sql`
        INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, approved, created_at, updated_at)
        VALUES (${userId}, ${`ledger_${userId}`}, ${`ledger_${userId}`}, 0, FALSE, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
      `
      walletResult = await sql`
        SELECT user_id, balance, wallet_id, wallet_address, approved, approved_at, approved_by, created_at, updated_at
        FROM user_wallets
        WHERE user_id = ${userId}
      `
    }

    const wallet = walletResult.rows[0]
    const balance = parseFloat(wallet?.balance || '0')
    const approved = wallet?.approved === true

    // Check for profile
    let hasProfile = false
    try {
      const profileResult = await sql`
        SELECT user_id FROM grain_user_profiles WHERE user_id = ${userId}
      `
      hasProfile = profileResult.rows.length > 0
    } catch (e) {
      // Profile table might not exist
    }

    // Get recent transactions
    let transactions: any[] = []
    try {
      const txResult = await sql`
        SELECT id, type, amount, reason, status, created_at, completed_at
        FROM grain_transactions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 10
      `
      transactions = txResult.rows.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount || '0'),
        reason: tx.reason,
        status: tx.status,
        created_at: tx.created_at,
        completed_at: tx.completed_at
      }))
    } catch (e) {
      // Transactions table might have different schema - ignore
      console.warn('[Wallet API] Failed to fetch transactions:', e)
    }

    // Get GRAIN price (default to 1.0)
    const grainPrice = 1.0 // TODO: fetch from price oracle

    return NextResponse.json({
      success: true,
      has_wallet: true,
      has_profile: hasProfile,
      approved: approved,
      approved_at: wallet?.approved_at || null,
      balance: {
        grain: balance,
        usd_value: balance * grainPrice
      },
      grain_price: grainPrice,
      recent_transactions: transactions,
      created_at: wallet?.created_at,
      updated_at: wallet?.updated_at
    })
  } catch (error: any) {
    console.error('[Wallet API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load wallet' },
      { status: 500 }
    )
  }
}
