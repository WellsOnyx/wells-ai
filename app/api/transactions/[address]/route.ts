/**
 * GET /api/transactions/:address
 *
 * Get transaction history for an address
 * Includes: mints, burns, transfers, vault deposits/withdrawals, escrow
 */

import { NextRequest, NextResponse } from 'next/server'
import { isValidAddress } from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params
    const { searchParams } = new URL(request.url)

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      )
    }

    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // Optional filter: mint, burn, transfer, deposit, withdrawal

    // Build query based on filters
    let whereClause = 'WHERE user_address = $1'
    const queryParams: any[] = [address.toLowerCase()]

    if (type) {
      whereClause += ' AND type = $2'
      queryParams.push(type)
    }

    // Get vault transactions
    const vaultTxs = await query(
      `SELECT
        tx_hash, user_address, type, usdc_amount, grain_amount,
        nav_price, fee, status, created_at
       FROM vault_transactions
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    )

    // Get founding investor transactions
    const investorTxs = await query(
      `SELECT
        mint_tx_hash as tx_hash, address as user_address,
        'founding_mint' as type, investment_amount as usdc_amount,
        grain_amount, 1.0 as nav_price, 0 as fee,
        status, created_at
       FROM founding_investors
       WHERE address = $1`,
      [address.toLowerCase()]
    )

    // Get escrow transactions
    const escrowTxs = await query(
      `SELECT
        et.tx_hash, e.seller, e.buyer, et.type,
        et.amount, e.currency, et.milestone_index,
        et.created_at
       FROM escrow_transactions et
       JOIN escrows e ON et.escrow_id = e.escrow_id
       WHERE e.seller = $1 OR e.buyer = $1
       ORDER BY et.created_at DESC
       LIMIT ${limit}`,
      [address.toLowerCase()]
    )

    // Combine and format transactions
    const allTransactions = [
      ...vaultTxs.rows.map((tx) => ({
        type: tx.type,
        txHash: tx.tx_hash,
        timestamp: tx.created_at,
        amount: tx.grain_amount,
        usdcValue: tx.usdc_amount,
        nav: tx.nav_price,
        fee: tx.fee,
        status: tx.status,
      })),
      ...investorTxs.rows.map((tx) => ({
        type: 'founding_investment',
        txHash: tx.tx_hash,
        timestamp: tx.created_at,
        amount: tx.grain_amount,
        usdcValue: tx.usdc_amount,
        nav: 1.0,
        fee: 0,
        status: tx.status,
      })),
      ...escrowTxs.rows.map((tx) => ({
        type: tx.type,
        txHash: tx.tx_hash,
        timestamp: tx.created_at,
        amount: tx.amount,
        currency: tx.currency,
        milestone: tx.milestone_index,
        status: 'completed',
      })),
    ]

    // Sort by timestamp
    allTransactions.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Calculate totals
    const totals = {
      totalVolume: 0,
      totalFees: 0,
      deposits: 0,
      withdrawals: 0,
      mints: 0,
      burns: 0,
    }

    allTransactions.forEach((tx) => {
      if (tx.usdcValue) {
        totals.totalVolume += tx.usdcValue
        totals.totalFees += tx.fee || 0
      }

      if (tx.type === 'deposit') totals.deposits += tx.usdcValue || 0
      if (tx.type === 'withdrawal') totals.withdrawals += tx.usdcValue || 0
      if (tx.type === 'mint' || tx.type === 'founding_investment') totals.mints += tx.amount
      if (tx.type === 'burn') totals.burns += tx.amount
    })

    return NextResponse.json({
      address,
      transactions: allTransactions.slice(0, limit),
      totals: {
        totalVolume: Math.floor(totals.totalVolume),
        totalFees: parseFloat(totals.totalFees.toFixed(2)),
        deposits: Math.floor(totals.deposits),
        withdrawals: Math.floor(totals.withdrawals),
        mints: Math.floor(totals.mints),
        burns: Math.floor(totals.burns),
        netPosition: Math.floor(totals.mints - totals.burns),
      },
      pagination: {
        limit,
        offset,
        total: allTransactions.length,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching transactions:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch transaction history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
