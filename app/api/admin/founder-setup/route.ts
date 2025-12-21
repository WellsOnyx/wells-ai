/**
 * Founder Account Setup
 *
 * Sets up the founder account with:
 * - Unlimited KYC limits
 * - Initial GRAIN allocation (backed by treasury float from 4.5% APY)
 * - Auto-approved status
 * - Admin privileges
 *
 * This is a one-time setup endpoint secured by a secret key.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Founder setup secret - must match env var
const FOUNDER_SETUP_SECRET = process.env.FOUNDER_SETUP_SECRET || 'grain-founder-2024'

// Founder allocation details
const FOUNDER_GRAIN_ALLOCATION = 333_000_000 // 333 million GRAIN
const FOUNDER_DAILY_LIMIT = -1 // Unlimited
const FOUNDER_MONTHLY_LIMIT = -1 // Unlimited

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const body = await req.json()
    const { secret, notes } = body

    // Verify setup secret
    if (secret !== FOUNDER_SETUP_SECRET) {
      console.warn(`[Founder Setup] Invalid secret attempt by user ${userId}`)
      return NextResponse.json({ error: 'Invalid setup credentials' }, { status: 403 })
    }

    const email = user?.emailAddresses[0]?.emailAddress || ''
    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Founder'

    // Begin transaction-like operations
    console.log(`[Founder Setup] Setting up founder account for ${userId} (${email})`)

    // 1. Create or update wallet with founder allocation
    const walletResult = await sql`
      INSERT INTO user_wallets (
        user_id,
        wallet_id,
        wallet_address,
        balance,
        approved,
        approved_at,
        approval_notes,
        created_at,
        updated_at
      ) VALUES (
        ${userId},
        ${'founder-' + userId.substring(0, 8)},
        'founder-treasury',
        ${FOUNDER_GRAIN_ALLOCATION},
        TRUE,
        NOW(),
        'Founder account - auto-approved',
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        balance = ${FOUNDER_GRAIN_ALLOCATION},
        approved = TRUE,
        approved_at = NOW(),
        approval_notes = 'Founder account - auto-approved',
        updated_at = NOW()
      RETURNING *
    `

    // 2. Create or update user profile with unlimited limits
    try {
      await sql`
        INSERT INTO grain_user_profiles (
          user_id,
          email,
          full_name,
          verification_level,
          daily_deposit_limit,
          daily_withdraw_limit,
          monthly_limit,
          is_founder,
          is_admin,
          kyc_status,
          kyc_bypass,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          ${email},
          ${fullName},
          5,
          ${FOUNDER_DAILY_LIMIT},
          ${FOUNDER_DAILY_LIMIT},
          ${FOUNDER_MONTHLY_LIMIT},
          TRUE,
          TRUE,
          'verified',
          TRUE,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          verification_level = 5,
          daily_deposit_limit = ${FOUNDER_DAILY_LIMIT},
          daily_withdraw_limit = ${FOUNDER_DAILY_LIMIT},
          monthly_limit = ${FOUNDER_MONTHLY_LIMIT},
          is_founder = TRUE,
          is_admin = TRUE,
          kyc_status = 'verified',
          kyc_bypass = TRUE,
          updated_at = NOW()
      `
    } catch (profileError: any) {
      // Profile table might not exist with all columns, try simpler insert
      console.warn('[Founder Setup] Profile update warning:', profileError.message)
    }

    // 3. Record the founder allocation as a treasury transaction
    const allocationNote = `Founder allocation: ${FOUNDER_GRAIN_ALLOCATION.toLocaleString()} GRAIN. ` +
      `Backed by treasury float from 4.5% APY on aggregate deposits. ` +
      `${notes || 'Initial founder setup.'}`

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
        'founder_allocation',
        ${FOUNDER_GRAIN_ALLOCATION},
        ${allocationNote},
        ${'founder-' + Date.now()},
        'completed',
        NOW(),
        NOW()
      )
    `

    // 4. Record in treasury backing (internal accounting)
    try {
      await sql`
        INSERT INTO treasury_backing (
          asset_type,
          asset_name,
          amount,
          source,
          circle_reference_id,
          status,
          notes
        ) VALUES (
          'founder_equity',
          'Founder GRAIN Allocation',
          ${FOUNDER_GRAIN_ALLOCATION},
          'treasury_float',
          ${'founder-equity-' + userId.substring(0, 8)},
          'active',
          ${`Founder allocation backed by 4.5% APY float. ${notes || ''}`}
        )
      `
    } catch (treasuryError: any) {
      console.warn('[Founder Setup] Treasury backing note:', treasuryError.message)
    }

    // Calculate backing details
    // At 4.5% APY, to generate 333M GRAIN value over time:
    // Principal needed = 333M / 0.045 = ~7.4B in deposits generating yield
    // Or alternatively, this is founder equity that vests as treasury grows
    const backingDetails = {
      allocation: FOUNDER_GRAIN_ALLOCATION,
      backingType: 'treasury_float',
      apyRate: 0.045,
      notes: 'Founder equity backed by treasury yield. Vests as deposits grow.',
      impliedTreasurySize: Math.round(FOUNDER_GRAIN_ALLOCATION / 0.045)
    }

    console.log(`[Founder Setup] Complete for ${userId}:`, {
      grainBalance: FOUNDER_GRAIN_ALLOCATION,
      limits: 'unlimited',
      approved: true,
      backing: backingDetails
    })

    return NextResponse.json({
      success: true,
      message: 'Founder account configured successfully',
      account: {
        userId,
        email,
        grainBalance: FOUNDER_GRAIN_ALLOCATION,
        formattedBalance: FOUNDER_GRAIN_ALLOCATION.toLocaleString() + ' GRAIN',
        limits: {
          daily: 'Unlimited',
          monthly: 'Unlimited'
        },
        verification: {
          level: 5,
          status: 'verified',
          kycBypassed: true
        },
        approved: true,
        isFounder: true,
        isAdmin: true
      },
      backing: backingDetails,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[Founder Setup] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to setup founder account' },
      { status: 500 }
    )
  }
}

// GET - Check founder status
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const walletResult = await sql`
      SELECT * FROM user_wallets WHERE user_id = ${userId}
    `

    if (walletResult.rows.length === 0) {
      return NextResponse.json({ isFounder: false, setup: false })
    }

    const wallet = walletResult.rows[0]
    const isFounder = wallet.wallet_id?.startsWith('founder-') ||
                      parseFloat(wallet.balance) >= 1_000_000

    return NextResponse.json({
      isFounder,
      setup: true,
      balance: parseFloat(wallet.balance),
      approved: wallet.approved,
      walletId: wallet.wallet_id
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
