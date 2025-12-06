/**
 * Treasury Transactions API
 *
 * Returns transaction history for a user's Grain & Vault account.
 * Used by WellsAI chat and the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAccountByClerkId, getTransactions } from '@/lib/treasury-db'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const type = searchParams.get('type') || undefined
    const status = searchParams.get('status') || undefined

    // Get user's account
    const account = await getAccountByClerkId(userId)
    if (!account) {
      return NextResponse.json(
        { error: 'Account not found', needsOnboarding: true },
        { status: 404 }
      )
    }

    // Fetch transactions
    const { transactions, total } = await getTransactions(account.id, {
      limit,
      offset,
      type,
      status,
    })

    // Format transactions for response
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      counterparty: tx.counterpartyName || tx.counterpartyWallet || null,
      description: tx.description || tx.memo || null,
      reference: tx.erpReference || null,
      fromWallet: tx.fromWallet,
      toWallet: tx.toWallet,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
    }))

    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + transactions.length < total,
      },
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
