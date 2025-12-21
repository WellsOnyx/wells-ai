/**
 * Card Deposit API
 *
 * Handles card payment processing via Circle's Payments API
 *
 * FLOW:
 * 1. Receive card details from checkout page
 * 2. Encrypt card data using Circle's PGP public key
 * 3. Create card on Circle
 * 4. Create payment using the card
 * 5. Handle 3DS if required
 * 6. Credit user's GRAIN balance on success
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import { CIRCLE_CONFIG, circleRequest, generateIdempotencyKey } from '@/lib/circle'

// Check if Circle is configured
function isCircleConfigured(): boolean {
  return Boolean(CIRCLE_CONFIG.apiKey && CIRCLE_CONFIG.apiKey.length > 10)
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const body = await req.json()
    const {
      sessionId,
      paymentIntentId,
      amount,
      card,
      billing,
      metadata = {}
    } = body

    // Validate required fields
    if (!amount || amount < 1) {
      return NextResponse.json({ error: 'Minimum deposit is $1' }, { status: 400 })
    }
    if (amount > 10000) {
      return NextResponse.json({ error: 'Maximum card deposit is $10,000' }, { status: 400 })
    }
    if (!card || !card.number || !card.cvv || !card.expMonth || !card.expYear) {
      return NextResponse.json({ error: 'Card details are required' }, { status: 400 })
    }

    const reference = sessionId || paymentIntentId || generateIdempotencyKey('card', userId)

    // If Circle is not configured, use demo mode
    if (!isCircleConfigured()) {
      return handleDemoPayment(userId, amount, reference)
    }

    // Production: Process with Circle
    return handleCirclePayment(userId, amount, card, billing, reference, metadata, user?.emailAddresses[0]?.emailAddress)

  } catch (error: any) {
    console.error('[Card Deposit] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process card payment' },
      { status: 500 }
    )
  }
}

// Demo mode payment (when Circle not configured)
async function handleDemoPayment(
  userId: string,
  amount: number,
  reference: string
): Promise<NextResponse> {
  const grainAmount = amount // 1:1 for now

  // Create wallet if needed
  await sql`
    INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
    VALUES (
      ${userId},
      ${'grain-' + userId.substring(0, 8) + '-' + Date.now().toString(36)},
      'custodial',
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING
  `

  // Record transaction
  await sql`
    INSERT INTO grain_transactions (
      user_id,
      type,
      amount,
      reason,
      circle_transfer_id,
      status,
      created_at,
      completed_at
    ) VALUES (
      ${userId},
      'deposit',
      ${grainAmount},
      'Demo card deposit (sandbox)',
      ${reference},
      'completed',
      NOW(),
      NOW()
    )
  `

  // Credit balance
  await sql`
    UPDATE user_wallets
    SET balance = balance + ${grainAmount}, updated_at = NOW()
    WHERE user_id = ${userId}
  `

  // Get new balance
  const balanceResult = await sql`
    SELECT balance FROM user_wallets WHERE user_id = ${userId}
  `
  const newBalance = parseFloat(balanceResult.rows[0]?.balance || '0')

  console.log(`[Card Deposit] DEMO: User ${userId} deposited $${amount}, credited ${grainAmount} GRAIN`)

  return NextResponse.json({
    success: true,
    demo: true,
    grainAmount,
    grainPrice: 1.0,
    depositAmount: amount,
    newBalance,
    transactionId: reference
  })
}

// Real Circle payment processing
async function handleCirclePayment(
  userId: string,
  amount: number,
  card: {
    number: string
    cvv: string
    expMonth: number
    expYear: number
  },
  billing: {
    name: string
    line1: string
    city: string
    postalCode: string
    country: string
  },
  reference: string,
  metadata: Record<string, string>,
  email?: string
): Promise<NextResponse> {
  try {
    // Step 1: Get Circle's encryption public key
    const keyResponse = await circleRequest<{
      keyId: string
      publicKey: string
    }>('/encryption/public')

    if (!keyResponse.success || !keyResponse.data) {
      throw new Error('Failed to get encryption key')
    }

    const { keyId, publicKey } = keyResponse.data

    // Step 2: Encrypt card data
    // Note: In production, you'd use Circle's official encryption library
    // For now, we'll create the encrypted payload format Circle expects
    const encryptedData = await encryptCardData(card, keyId, publicKey)

    // Step 3: Create card on Circle
    const cardIdempotencyKey = generateIdempotencyKey('card', userId)
    const cardResponse = await circleRequest<{
      id: string
      status: string
      fingerprint: string
      network: string
      last4: string
    }>('/cards', {
      method: 'POST',
      body: {
        idempotencyKey: cardIdempotencyKey,
        keyId,
        encryptedData: encryptedData.encryptedMessage,
        billingDetails: {
          name: billing.name,
          line1: billing.line1,
          city: billing.city,
          postalCode: billing.postalCode,
          country: billing.country
        },
        metadata: {
          userId,
          email: email || metadata.email || '',
          ipAddress: metadata.ipAddress || '0.0.0.0',
          sessionId: reference
        }
      }
    })

    if (!cardResponse.success || !cardResponse.data) {
      console.error('[Card Deposit] Failed to create card:', cardResponse.error)
      throw new Error(cardResponse.error || 'Failed to create card')
    }

    const circleCard = cardResponse.data

    // Step 4: Create payment using the card
    const paymentIdempotencyKey = generateIdempotencyKey('pay', userId)
    const paymentResponse = await circleRequest<{
      id: string
      status: string
      amount: { amount: string; currency: string }
      verification?: {
        cvv: string
        avs: string
      }
      requiredAction?: {
        type: string
        redirectUrl: string
      }
    }>('/payments', {
      method: 'POST',
      body: {
        idempotencyKey: paymentIdempotencyKey,
        keyId,
        encryptedData: encryptedData.encryptedCvv, // CVV for this payment
        amount: {
          amount: amount.toFixed(2),
          currency: 'USD'
        },
        source: {
          id: circleCard.id,
          type: 'card'
        },
        verification: 'cvv',
        metadata: {
          userId,
          email: email || metadata.email || '',
          sessionId: reference
        }
      }
    })

    if (!paymentResponse.success || !paymentResponse.data) {
      console.error('[Card Deposit] Failed to create payment:', paymentResponse.error)
      throw new Error(paymentResponse.error || 'Payment failed')
    }

    const payment = paymentResponse.data

    // Check if 3DS is required
    if (payment.requiredAction?.type === 'three_d_secure_redirect') {
      // Return redirect URL for 3DS
      return NextResponse.json({
        success: true,
        requires3DS: true,
        redirectUrl: payment.requiredAction.redirectUrl,
        paymentId: payment.id,
        transactionId: reference
      })
    }

    // Check payment status
    if (payment.status === 'confirmed' || payment.status === 'paid') {
      // Payment successful - credit user
      const grainAmount = amount // 1:1 for now

      // Create wallet if needed
      await sql`
        INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
        VALUES (
          ${userId},
          ${'grain-' + userId.substring(0, 8) + '-' + Date.now().toString(36)},
          'custodial',
          0,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO NOTHING
      `

      // Record transaction
      await sql`
        INSERT INTO grain_transactions (
          user_id,
          type,
          amount,
          reason,
          circle_transfer_id,
          status,
          created_at,
          completed_at
        ) VALUES (
          ${userId},
          'deposit',
          ${grainAmount},
          'Card deposit via Circle',
          ${payment.id},
          'completed',
          NOW(),
          NOW()
        )
      `

      // Credit balance
      await sql`
        UPDATE user_wallets
        SET balance = balance + ${grainAmount}, updated_at = NOW()
        WHERE user_id = ${userId}
      `

      // Get new balance
      const balanceResult = await sql`
        SELECT balance FROM user_wallets WHERE user_id = ${userId}
      `
      const newBalance = parseFloat(balanceResult.rows[0]?.balance || '0')

      console.log(`[Card Deposit] User ${userId} deposited $${amount}, credited ${grainAmount} GRAIN`)

      return NextResponse.json({
        success: true,
        grainAmount,
        grainPrice: 1.0,
        depositAmount: amount,
        newBalance,
        paymentId: payment.id,
        transactionId: reference
      })
    } else if (payment.status === 'pending') {
      // Payment is pending - needs verification
      return NextResponse.json({
        success: true,
        status: 'pending',
        message: 'Payment is being processed. You will receive your GRAIN shortly.',
        paymentId: payment.id,
        transactionId: reference
      })
    } else {
      throw new Error(`Payment status: ${payment.status}`)
    }

  } catch (error: any) {
    console.error('[Card Deposit] Circle error:', error)
    throw error
  }
}

// Encrypt card data for Circle (simplified version)
// In production, use Circle's official encryption library: @circle-fin/w3s-pw-web-sdk
async function encryptCardData(
  card: { number: string; cvv: string; expMonth: number; expYear: number },
  keyId: string,
  publicKey: string
): Promise<{ encryptedMessage: string; encryptedCvv: string }> {
  // Note: This is a simplified placeholder
  // In production, you MUST use Circle's official encryption
  // The public key from Circle is a PGP key that must be used with OpenPGP.js

  // For now, we'll base64 encode as a placeholder
  // This will NOT work in production - you need proper PGP encryption
  const cardData = JSON.stringify({
    number: card.number,
    cvv: card.cvv
  })

  const encryptedMessage = Buffer.from(cardData).toString('base64')
  const encryptedCvv = Buffer.from(card.cvv).toString('base64')

  // TODO: Implement proper PGP encryption using OpenPGP.js
  // Example:
  // import * as openpgp from 'openpgp'
  // const publicKeyArmored = publicKey
  // const message = await openpgp.createMessage({ text: cardData })
  // const encrypted = await openpgp.encrypt({
  //   message,
  //   encryptionKeys: await openpgp.readKey({ armoredKey: publicKeyArmored })
  // })
  // return { encryptedMessage: encrypted, encryptedCvv: ... }

  console.warn('[Card Deposit] Using placeholder encryption - implement proper PGP for production!')

  return { encryptedMessage, encryptedCvv }
}
