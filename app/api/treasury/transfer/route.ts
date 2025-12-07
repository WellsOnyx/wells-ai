/**
 * Treasury Transfer Operations API
 *
 * POST /api/treasury/transfer - Initiate a USDC transfer
 * GET /api/treasury/transfer?txId=xxx - Get transfer status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCircleClient } from '@/lib/circle/client'
import {
  createTransaction,
  updateTransactionStatus,
  getTransaction,
  getWalletByWalletId,
  getAccountByApiKey,
  updateWalletBalance,
} from '@/lib/treasury-db'

// ============================================================================
// POST - Initiate USDC transfer
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
    const {
      fromWalletId,
      toAddress,
      amount,
      reference,
      costCenter,
      glAccount,
      description,
      memo,
    } = body

    // Validate required fields
    if (!fromWalletId || !toAddress || !amount) {
      return NextResponse.json(
        { error: 'fromWalletId, toAddress, and amount are required' },
        { status: 400 }
      )
    }

    // Validate amount
    const transferAmount = parseFloat(amount)
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Get wallet and verify ownership
    const wallet = await getWalletByWalletId(fromWalletId)
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      )
    }

    if (wallet.accountId !== account.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to wallet' },
        { status: 403 }
      )
    }

    // Initialize Circle client
    const circleClient = getCircleClient()

    // Check wallet balance
    const balance = await circleClient.getWalletBalance(fromWalletId)
    if (balance < transferAmount) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          balance: balance,
          required: transferAmount,
        },
        { status: 400 }
      )
    }

    // Check approval threshold
    if (account.tier === 'starter' && transferAmount > 10000) {
      return NextResponse.json(
        {
          error: 'Transfer amount exceeds approval threshold for starter tier',
          threshold: 10000,
        },
        { status: 400 }
      )
    }

    // Create transaction record in database
    const transaction = await createTransaction({
      accountId: account.id,
      type: 'payment',
      amount: transferAmount,
      currency: 'USDC',
      fromWallet: fromWalletId,
      counterpartyWallet: toAddress,
      erpReference: reference,
      costCenter,
      glAccount,
      description,
      memo,
      metadata: {
        initiated_via: 'api',
      },
    })

    try {
      // Initiate Circle transfer
      const circleTransfer = await circleClient.initiateTransfer({
        fromWalletId,
        toAddress,
        amount: transferAmount.toFixed(6), // USDC has 6 decimals
        userId: account.id,
        refId: transaction.id,
      })

      // Update transaction with Circle details
      await updateTransactionStatus(transaction.id, 'processing')

      // Update transaction with Circle transfer ID
      await updateTransactionStatus(transaction.id, 'processing')

      return NextResponse.json({
        success: true,
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: 'processing',
          fromWallet: fromWalletId,
          toAddress: toAddress,
          circleTransferId: circleTransfer.id,
          txHash: circleTransfer.txHash,
          reference: reference,
          createdAt: transaction.createdAt,
        },
        circle: {
          transferId: circleTransfer.id,
          state: circleTransfer.state,
          blockchain: circleTransfer.blockchain,
          txHash: circleTransfer.txHash,
        },
      })
    } catch (error) {
      // Update transaction status to failed
      await updateTransactionStatus(transaction.id, 'failed', {
        code: 'CIRCLE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  } catch (error) {
    console.error('Error initiating transfer:', error)
    return NextResponse.json(
      {
        error: 'Failed to initiate transfer',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get transfer status
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const txId = searchParams.get('txId')
    const circleTransferId = searchParams.get('circleTransferId')

    if (!txId && !circleTransferId) {
      return NextResponse.json(
        { error: 'txId or circleTransferId is required' },
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

    // Get transaction from database
    if (!txId) {
      return NextResponse.json(
        { error: 'txId is required for status lookup' },
        { status: 400 }
      )
    }

    const transaction = await getTransaction(txId)

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Verify transaction belongs to account
    if (transaction.accountId !== account.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to transaction' },
        { status: 403 }
      )
    }

    // If transaction is already completed or failed, return from database
    if (transaction.status === 'completed' || transaction.status === 'failed' || transaction.status === 'cancelled') {
      return NextResponse.json({
        success: true,
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          fromWallet: transaction.fromWallet,
          toWallet: transaction.toWallet,
          counterpartyWallet: transaction.counterpartyWallet,
          circleTransferId: transaction.circleTransferId,
          txHash: transaction.circleTxId,
          reference: transaction.erpReference,
          description: transaction.description,
          errorCode: transaction.errorCode,
          errorMessage: transaction.errorMessage,
          createdAt: transaction.createdAt,
          completedAt: transaction.completedAt,
          failedAt: transaction.failedAt,
        },
      })
    }

    // Get status from Circle if still processing
    if (circleTransferId || transaction.circleTransferId) {
      try {
        const circleClient = getCircleClient()
        const status = await circleClient.getTransactionStatus(
          (circleTransferId || transaction.circleTransferId) as string
        )

        // Update database based on Circle status
        if (status.status === 'complete') {
          await updateTransactionStatus(transaction.id, 'completed')
        } else if (status.status === 'failed') {
          await updateTransactionStatus(transaction.id, 'failed', {
            code: 'CIRCLE_TRANSFER_FAILED',
            message: status.errorReason || 'Transfer failed',
          })
        } else if (status.status === 'cancelled') {
          await updateTransactionStatus(transaction.id, 'cancelled')
        }

        // Get updated transaction
        const updatedTransaction = await getTransaction(txId)

        return NextResponse.json({
          success: true,
          transaction: {
            id: updatedTransaction!.id,
            type: updatedTransaction!.type,
            amount: updatedTransaction!.amount,
            currency: updatedTransaction!.currency,
            status: updatedTransaction!.status,
            fromWallet: updatedTransaction!.fromWallet,
            toWallet: updatedTransaction!.toWallet,
            counterpartyWallet: updatedTransaction!.counterpartyWallet,
            circleTransferId: updatedTransaction!.circleTransferId,
            txHash: status.txHash,
            blockHeight: status.blockHeight,
            reference: updatedTransaction!.erpReference,
            description: updatedTransaction!.description,
            errorCode: updatedTransaction!.errorCode,
            errorMessage: updatedTransaction!.errorMessage,
            createdAt: updatedTransaction!.createdAt,
            completedAt: updatedTransaction!.completedAt,
            failedAt: updatedTransaction!.failedAt,
          },
          circle: {
            status: status.status,
            txHash: status.txHash,
            blockHeight: status.blockHeight,
            errorReason: status.errorReason,
          },
        })
      } catch (error) {
        console.error('Error getting Circle transfer status:', error)
        // Fall back to database status
      }
    }

    // Return database status
    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        fromWallet: transaction.fromWallet,
        toWallet: transaction.toWallet,
        counterpartyWallet: transaction.counterpartyWallet,
        circleTransferId: transaction.circleTransferId,
        reference: transaction.erpReference,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    })
  } catch (error) {
    console.error('Error getting transfer status:', error)
    return NextResponse.json(
      {
        error: 'Failed to get transfer status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
