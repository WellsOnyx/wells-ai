/**
 * Airwallex Payment Creation
 *
 * Creates payment intent with split settlement for marketplace transactions
 * Includes guardrails: validation, fraud detection, rate limiting, audit logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createEscrow } from '@/lib/transactions'
import { validateTransaction, auditLog } from '@/lib/payment-guardrails'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { transactionId, amount, wellsFee, sellerId, metadata, userType = 'verified' } = body

    // Validate inputs
    if (!transactionId || !amount || !wellsFee || !sellerId) {
      return NextResponse.json(
        { error: 'Missing required fields: transactionId, amount, wellsFee, sellerId' },
        { status: 400 }
      )
    }

    // GUARDRAILS: Comprehensive validation
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined

    const validation = await validateTransaction({
      userId,
      amount,
      sellerId,
      userType,
      metadata,
      ipAddress
    })

    if (!validation.valid) {
      // Audit failed attempt
      await auditLog({
        userId,
        action: 'payment_creation_blocked',
        resource: 'payment',
        resourceId: transactionId,
        amount,
        metadata: {
          sellerId,
          errors: validation.errors,
          riskScore: validation.riskScore
        },
        ipAddress
      })

      return NextResponse.json(
        {
          error: validation.errors[0],
          allErrors: validation.errors,
          warnings: validation.warnings,
          riskScore: validation.riskScore
        },
        { status: 400 }
      )
    }

    // Log warnings if any (but allow transaction)
    if (validation.warnings.length > 0) {
      console.warn('[PAYMENT] Transaction warnings:', validation.warnings)
    }

    // Create escrow with Airwallex
    const result = await createEscrow({
      transactionId,
      amount,
      wellsFee,
      sellerId,
      metadata
    })

    if (!result.success) {
      // Audit failed creation
      await auditLog({
        userId,
        action: 'payment_creation_failed',
        resource: 'payment',
        resourceId: transactionId,
        amount,
        metadata: {
          sellerId,
          error: result.error
        },
        ipAddress
      })

      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Audit successful payment creation
    await auditLog({
      userId,
      action: 'payment_created',
      resource: 'payment',
      resourceId: result.paymentIntentId!,
      amount,
      metadata: {
        transactionId,
        sellerId,
        riskScore: validation.riskScore,
        warnings: validation.warnings
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      paymentIntentId: result.paymentIntentId,
      clientSecret: result.clientSecret,
      message: 'Payment intent created successfully',
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined
    })
  } catch (error: any) {
    console.error('[AIRWALLEX] Payment creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    )
  }
}
