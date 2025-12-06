/**
 * Treasury Payment Execution API
 *
 * Executes authorized payments - the final step after NLP intent verification.
 * Users must authorize via the TreasuryChat UI before this endpoint is called.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getAccountByClerkId,
  getWallets,
  createTransaction,
  updateTransactionStatus,
  updateWalletBalance,
} from '@/lib/treasury-db'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    // Validate action type
    if (!action || !action.type || action.status !== 'pending') {
      return NextResponse.json(
        { error: 'Invalid action. Must be a pending treasury action.' },
        { status: 400 }
      )
    }

    // Get user's account
    const account = await getAccountByClerkId(userId)
    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    // Verify account matches action
    if (action.details?.accountId && action.details.accountId !== account.id) {
      return NextResponse.json(
        { error: 'Account mismatch' },
        { status: 403 }
      )
    }

    // Handle different action types
    switch (action.type) {
      case 'payment':
        return handlePayment(account.id, action.details)

      case 'credit_draw':
        return handleCreditDraw(account.id, action.details)

      default:
        return NextResponse.json(
          { error: `Unknown action type: ${action.type}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error executing treasury action:', error)
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    )
  }
}

async function handlePayment(
  accountId: string,
  details: { recipient: string; amount: number; memo?: string; fromWallet?: string }
) {
  const { recipient, amount, memo, fromWallet } = details

  // Validate inputs
  if (!recipient || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'Invalid payment details' },
      { status: 400 }
    )
  }

  // Get wallet and verify balance
  const wallets = await getWallets(accountId)
  const primaryWallet = wallets[0]

  if (!primaryWallet) {
    return NextResponse.json(
      { error: 'No wallet found' },
      { status: 400 }
    )
  }

  if (primaryWallet.balance < amount) {
    return NextResponse.json(
      { error: 'Insufficient balance' },
      { status: 400 }
    )
  }

  // Create transaction record
  const transaction = await createTransaction({
    accountId,
    type: 'payment',
    amount,
    currency: 'GRAIN',
    fromWallet: primaryWallet.walletId,
    counterpartyWallet: recipient,
    description: memo || `Payment to ${recipient}`,
    memo,
  })

  try {
    // Update wallet balance (deduct amount)
    const newBalance = primaryWallet.balance - amount
    await updateWalletBalance(primaryWallet.walletId, newBalance)

    // Mark transaction as completed
    await updateTransactionStatus(transaction.id, 'completed')

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        type: 'payment',
        amount,
        recipient,
        status: 'completed',
        timestamp: new Date().toISOString(),
      },
      newBalance,
      message: `Successfully sent ${amount.toLocaleString()} GRAIN to ${recipient}`,
    })
  } catch (error) {
    // Mark transaction as failed
    await updateTransactionStatus(transaction.id, 'failed', {
      code: 'EXECUTION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Payment execution failed' },
      { status: 500 }
    )
  }
}

async function handleCreditDraw(
  accountId: string,
  details: { amount: number; interestRate?: number }
) {
  const { amount } = details

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: 'Invalid draw amount' },
      { status: 400 }
    )
  }

  // Get wallet
  const wallets = await getWallets(accountId)
  const primaryWallet = wallets[0]

  if (!primaryWallet) {
    return NextResponse.json(
      { error: 'No wallet found' },
      { status: 400 }
    )
  }

  // Create credit draw transaction
  const transaction = await createTransaction({
    accountId,
    type: 'credit_draw',
    amount,
    currency: 'GRAIN',
    toWallet: primaryWallet.walletId,
    description: `Credit line draw of ${amount} GRAIN`,
  })

  try {
    // Update wallet balance (add drawn amount)
    const newBalance = primaryWallet.balance + amount
    await updateWalletBalance(primaryWallet.walletId, newBalance)

    // Note: In production, would also update credit_lines table
    // await updateCreditLine(accountId, { drawnAmount: currentDrawn + amount })

    // Mark transaction as completed
    await updateTransactionStatus(transaction.id, 'completed')

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        type: 'credit_draw',
        amount,
        status: 'completed',
        timestamp: new Date().toISOString(),
      },
      newBalance,
      message: `Successfully drew ${amount.toLocaleString()} GRAIN from your credit line`,
    })
  } catch (error) {
    await updateTransactionStatus(transaction.id, 'failed', {
      code: 'EXECUTION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Credit draw failed' },
      { status: 500 }
    )
  }
}
