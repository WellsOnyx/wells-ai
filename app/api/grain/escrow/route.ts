// @ts-nocheck
/**
 * GRAIN Escrow API
 *
 * POST /api/grain/escrow - Create an escrow
 * POST /api/grain/escrow/release - Release an escrow
 * GET /api/grain/escrow - Get escrow details
 *
 * GRAIN escrows appreciate with the GRAIN price during lock period,
 * giving both parties incentive to close deals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { grainRail, EscrowRequest } from '@/lib/payments/grain-rail'
import { unifiedUser } from '@/lib/identity/unified-user'
import { neon } from '@neondatabase/serverless'

const sql = process.env.DATABASE_URL?.startsWith('postgres')
  ? neon(process.env.DATABASE_URL)
  : null

export const runtime = 'nodejs'

/**
 * POST - Create a new escrow
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      action = 'create',
      escrowId,
      toUserId,
      toEmail,
      amount,
      currency = 'USD',
      releaseConditions,
      releaseDate,
      reference,
      allowPartialRelease = false,
      partialAmount,
    } = body

    // Handle escrow release
    if (action === 'release') {
      if (!escrowId) {
        return NextResponse.json({ error: 'Missing escrowId' }, { status: 400 })
      }

      const result = await grainRail.releaseEscrow(escrowId, clerkUserId, partialAmount)

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        escrowId,
        releasedAmount: result.releasedAmount,
        currentValue: result.currentValue,
        message: `Released ${result.releasedAmount.toLocaleString()} GRAIN (worth $${result.currentValue.toFixed(2)})`,
      })
    }

    // Create new escrow
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!releaseConditions) {
      return NextResponse.json({ error: 'Release conditions required' }, { status: 400 })
    }

    // Get sender
    const sender = await unifiedUser.get(clerkUserId)
    if (!sender) {
      return NextResponse.json(
        { error: 'Account not found. Please complete onboarding.' },
        { status: 400 }
      )
    }

    // Resolve recipient
    let recipientId: string

    if (toUserId) {
      recipientId = toUserId
    } else if (toEmail) {
      const recipient = await unifiedUser.findByEmail(toEmail)
      if (recipient) {
        recipientId = recipient.unifiedId
      } else {
        // Create new account for recipient
        const newRecipient = await unifiedUser.createOrLink({
          email: toEmail,
          source: 'grainvault',
        })
        recipientId = newRecipient.unifiedId
      }
    } else {
      return NextResponse.json({ error: 'Recipient required (toUserId or toEmail)' }, { status: 400 })
    }

    // Create escrow request
    const escrowRequest: EscrowRequest = {
      fromUserId: sender.unifiedId,
      toUserId: recipientId,
      amount,
      currency: currency as 'USD' | 'GRAIN',
      releaseConditions,
      releaseDate: releaseDate ? new Date(releaseDate) : undefined,
      reference: reference || `escrow-${Date.now()}`,
      allowPartialRelease,
    }

    const result = await grainRail.escrow(escrowRequest)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    // Get GRAIN price for response
    const { price } = await grainRail.getPrice()

    return NextResponse.json({
      success: true,
      escrowId: result.escrowId,
      grainAmount: result.grainAmount,
      grainPriceAtLock: result.grainPriceAtLock,
      usdEquivalent: result.grainAmount * price,
      estimatedValueAtRelease: result.estimatedValueAtRelease,
      message: `Created escrow for ${result.grainAmount.toLocaleString()} GRAIN ($${(result.grainAmount * price).toFixed(2)})`,
      note: 'GRAIN escrows appreciate with price. Current value may exceed initial amount at release.',
    })

  } catch (error: any) {
    console.error('[GRAIN Escrow] Error:', error)
    return NextResponse.json(
      { error: 'Escrow operation failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Get escrow details
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const escrowId = searchParams.get('escrowId')
    const reference = searchParams.get('reference')

    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Get user's unified identity
    const user = await unifiedUser.get(clerkUserId)
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 })
    }

    let escrows

    if (escrowId) {
      // Get specific escrow
      escrows = await sql`
        SELECT
          e.*,
          fp.email as from_email,
          tp.email as to_email
        FROM grain_escrows e
        LEFT JOIN treasury_accounts fp ON fp.id::text = e.from_user_id OR fp.clerk_user_id = e.from_user_id
        LEFT JOIN treasury_accounts tp ON tp.id::text = e.to_user_id OR tp.clerk_user_id = e.to_user_id
        WHERE e.id = ${escrowId}
          AND (e.from_user_id = ${user.unifiedId} OR e.to_user_id = ${user.unifiedId})
      `
    } else if (reference) {
      // Get escrows by reference
      escrows = await sql`
        SELECT
          e.*,
          fp.email as from_email,
          tp.email as to_email
        FROM grain_escrows e
        LEFT JOIN treasury_accounts fp ON fp.id::text = e.from_user_id OR fp.clerk_user_id = e.from_user_id
        LEFT JOIN treasury_accounts tp ON tp.id::text = e.to_user_id OR tp.clerk_user_id = e.to_user_id
        WHERE e.reference = ${reference}
          AND (e.from_user_id = ${user.unifiedId} OR e.to_user_id = ${user.unifiedId})
      `
    } else {
      // Get all user's escrows
      escrows = await sql`
        SELECT
          e.*,
          fp.email as from_email,
          tp.email as to_email
        FROM grain_escrows e
        LEFT JOIN treasury_accounts fp ON fp.id::text = e.from_user_id OR fp.clerk_user_id = e.from_user_id
        LEFT JOIN treasury_accounts tp ON tp.id::text = e.to_user_id OR tp.clerk_user_id = e.to_user_id
        WHERE e.from_user_id = ${user.unifiedId} OR e.to_user_id = ${user.unifiedId}
        ORDER BY e.created_at DESC
        LIMIT 50
      `
    }

    // Get current GRAIN price for appreciation calculation
    const { price } = await grainRail.getPrice()

    // Transform escrows with appreciation info
    const transformedEscrows = escrows.map((e: any) => {
      const grainAmount = parseFloat(e.grain_amount)
      const priceAtLock = parseFloat(e.grain_price_at_lock)
      const currentValue = grainAmount * price
      const valueAtLock = grainAmount * priceAtLock
      const appreciation = currentValue - valueAtLock
      const appreciationPercent = priceAtLock > 0 ? ((price - priceAtLock) / priceAtLock) * 100 : 0

      return {
        id: e.id,
        fromUserId: e.from_user_id,
        fromEmail: e.from_email,
        toUserId: e.to_user_id,
        toEmail: e.to_email,
        grainAmount,
        releasedAmount: parseFloat(e.released_amount || '0'),
        grainPriceAtLock: priceAtLock,
        currentGrainPrice: price,
        usdValueAtLock: valueAtLock,
        currentUsdValue: currentValue,
        appreciation,
        appreciationPercent: appreciationPercent.toFixed(2),
        releaseConditions: e.release_conditions,
        releaseDate: e.release_date,
        allowPartialRelease: e.allow_partial_release,
        reference: e.reference,
        status: e.status,
        releasedAt: e.released_at,
        releasedBy: e.released_by,
        disputedAt: e.disputed_at,
        disputeReason: e.dispute_reason,
        createdAt: e.created_at,
        isIncoming: e.to_user_id === user.unifiedId,
        isOutgoing: e.from_user_id === user.unifiedId,
      }
    })

    return NextResponse.json({
      escrows: transformedEscrows,
      currentGrainPrice: price,
    })

  } catch (error: any) {
    console.error('[GRAIN Escrow GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get escrows', details: error.message },
      { status: 500 }
    )
  }
}
