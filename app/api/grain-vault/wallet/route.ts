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
    // Try with approved column first, fall back to without it if column doesn't exist
    let walletResult
    let hasApprovedColumn = true

    try {
      walletResult = await sql`
        SELECT user_id, balance, wallet_id, wallet_address, approved, approved_at, created_at, updated_at
        FROM user_wallets
        WHERE user_id = ${userId}
      `
    } catch (e: any) {
      // approved column might not exist yet
      if (e.message?.includes('approved')) {
        hasApprovedColumn = false
        walletResult = await sql`
          SELECT user_id, balance, wallet_id, wallet_address, created_at, updated_at
          FROM user_wallets
          WHERE user_id = ${userId}
        `
      } else {
        throw e
      }
    }

    // Auto-create wallet if doesn't exist
    if (walletResult.rows.length === 0) {
      try {
        if (hasApprovedColumn) {
          await sql`
            INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, approved, created_at, updated_at)
            VALUES (${userId}, ${`ledger_${userId}`}, ${`ledger_${userId}`}, 0, FALSE, NOW(), NOW())
            ON CONFLICT (user_id) DO NOTHING
          `
        } else {
          await sql`
            INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
            VALUES (${userId}, ${`ledger_${userId}`}, ${`ledger_${userId}`}, 0, NOW(), NOW())
            ON CONFLICT (user_id) DO NOTHING
          `
        }
      } catch (insertErr) {
        console.warn('[Wallet API] Insert warning:', insertErr)
      }

      try {
        walletResult = await sql`
          SELECT user_id, balance, wallet_id, wallet_address, created_at, updated_at
          FROM user_wallets
          WHERE user_id = ${userId}
        `
      } catch (e) {
        // Return empty wallet state
        return NextResponse.json({
          success: true,
          has_wallet: false,
          has_profile: false,
          approved: true, // Default to approved if we can't check
          balance: { grain: 0, usd_value: 0 },
          grain_price: 1.0,
          recent_transactions: []
        })
      }
    }

    const wallet = walletResult.rows[0]
    const balance = parseFloat(wallet?.balance || '0')
    // Default to approved=true if column doesn't exist (backwards compatibility)
    const approved = hasApprovedColumn ? (wallet?.approved === true) : true

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
