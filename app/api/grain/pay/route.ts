// @ts-nocheck
/**
 * GRAIN Pay API
 *
 * POST /api/grain/pay - Execute a GRAIN payment
 *
 * This is the primary payment endpoint for the unified system.
 * All transactions should go through this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { grainRail, PaymentRequest, TransactionType } from '@/lib/payments/grain-rail'
import { unifiedUser } from '@/lib/identity/unified-user'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      toUserId,
      toEmail,
      toAddress,
      amount,
      currency = 'USD',
      type = 'payment',
      reference,
      memo,
      allowCreditLine = true,
      allowConversion = true,
    } = body

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Get sender's unified identity
    const sender = await unifiedUser.get(clerkUserId)
    if (!sender) {
      return NextResponse.json(
        { error: 'Account not found. Please complete onboarding.' },
        { status: 400 }
      )
    }

    // Resolve recipient
    let recipientId: string | undefined

    if (toUserId) {
      recipientId = toUserId
    } else if (toEmail) {
      const recipient = await unifiedUser.findByEmail(toEmail)
      if (recipient) {
        recipientId = recipient.unifiedId
      } else {
        // Create a new account for the recipient
        const newRecipient = await unifiedUser.createOrLink({
          email: toEmail,
          source: 'grainvault',
        })
        recipientId = newRecipient.unifiedId
      }
    }

    // Build payment request
    const paymentRequest: PaymentRequest = {
      fromUserId: sender.unifiedId,
      toUserId: recipientId,
      toAddress,
      amount,
      currency: currency as 'USD' | 'GRAIN',
      type: type as TransactionType,
      reference,
      memo,
      allowCreditLine,
      allowConversion,
    }

    // Route the payment first to show user what will happen
    const route = await grainRail.route(paymentRequest)

    if (!route.canExecute) {
      // Return routing info so UI can show funding options
      return NextResponse.json({
        success: false,
        needsFunding: true,
        route: {
          rail: route.rail,
          method: route.method,
          grainNeeded: route.grainAmount,
          usdNeeded: route.usdAmount,
          fee: route.fee,
          reason: route.reason,
        },
        profile: {
          grainBalance: sender.grainBalance,
          usdcBalance: sender.usdcBalance,
          creditAvailable: sender.creditAvailable,
        },
      }, { status: 402 }) // Payment Required
    }

    // Execute the payment
    const result = await grainRail.pay(paymentRequest)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        failureReason: result.failureReason,
      }, { status: 400 })
    }

    // Get updated balance
    const updatedProfile = await grainRail.getProfile(sender.unifiedId)

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      rail: result.rail,
      method: result.method,
      executed: {
        amount: result.executedAmount,
        currency: result.executedCurrency,
        fee: result.feeAmount,
        feeCurrency: result.feeCurrency,
      },
      recipient: {
        receives: result.recipientReceives,
        currency: result.recipientCurrency,
      },
      creditUsed: result.creditLineUsed,
      conversionRate: result.conversionRate,
      newBalance: {
        grain: updatedProfile?.grainBalance || 0,
        usdc: updatedProfile?.usdcBalance || 0,
        creditAvailable: updatedProfile?.creditAvailable || 0,
      },
    })

  } catch (error: any) {
    console.error('[GRAIN Pay] Error:', error)
    return NextResponse.json(
      { error: 'Payment failed', details: error.message },
      { status: 500 }
    )
  }
}
