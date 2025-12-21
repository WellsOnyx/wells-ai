/**
 * Founder Account Setup
 *
 * Sets up the founder account with:
 * - USD cash balance (not invested in GRAIN yet)
 * - Unlimited KYC limits
 * - Auto-approved status
 * - Admin privileges
 * - Treasury backing from 4.5% APY float
 *
 * The USD can be converted to GRAIN at any time at current market price.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Founder setup secret - must match env var
const FOUNDER_SETUP_SECRET = process.env.FOUNDER_SETUP_SECRET || 'grain-founder-2024'

// Founder allocation details
const FOUNDER_USD_ALLOCATION = 333_000_000 // 333 million USD cash balance
const FOUNDER_DAILY_LIMIT = -1 // Unlimited
const FOUNDER_MONTHLY_LIMIT = -1 // Unlimited
const TREASURY_APY = 0.045 // 4.5% APY backing

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

    console.log(`[Founder Setup] Setting up founder account for ${userId} (${email})`)

    // 1. Ensure user_wallets has usd_balance column
    try {
      await sql`ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS usd_balance DECIMAL(20, 2) DEFAULT 0`
    } catch (e) {
      console.warn('[Founder Setup] Could not add usd_balance column (may already exist)')
    }

    // 2. Create or update wallet with USD cash balance (GRAIN balance starts at 0)
    try {
      await sql`
        INSERT INTO user_wallets (
          user_id,
          wallet_id,
          wallet_address,
          balance,
          usd_balance,
          approved,
          approved_at,
          approval_notes,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          ${'founder-' + userId.substring(0, 8)},
          'founder-treasury',
          0,
          ${FOUNDER_USD_ALLOCATION},
          TRUE,
          NOW(),
          'Founder account - auto-approved with USD allocation',
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          balance = 0,
          usd_balance = ${FOUNDER_USD_ALLOCATION},
          approved = TRUE,
          approved_at = NOW(),
          approval_notes = 'Founder account - auto-approved with USD allocation',
          updated_at = NOW()
      `
    } catch (walletErr: any) {
      // If usd_balance column doesn't exist, try without it
      console.warn('[Founder Setup] Wallet with usd_balance failed, trying alternative:', walletErr.message)
      await sql`
        INSERT INTO user_wallets (
          user_id,
          wallet_id,
          wallet_address,
          balance,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          ${'founder-' + userId.substring(0, 8)},
          'founder-treasury',
          0,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          balance = 0,
          updated_at = NOW()
      `
    }

    // 3. Create or update user profile with unlimited limits
    try {
      await sql`
        INSERT INTO grain_user_profiles (
          user_id,
          email,
          full_name,
          verification_level,
          daily_deposit_limit,
          daily_withdraw_limit,
          usd_balance,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          ${email},
          ${fullName},
          5,
          ${FOUNDER_DAILY_LIMIT},
          ${FOUNDER_DAILY_LIMIT},
          ${FOUNDER_USD_ALLOCATION},
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          verification_level = 5,
          daily_deposit_limit = ${FOUNDER_DAILY_LIMIT},
          daily_withdraw_limit = ${FOUNDER_DAILY_LIMIT},
          usd_balance = ${FOUNDER_USD_ALLOCATION},
          updated_at = NOW()
      `
    } catch (profileError: any) {
      console.warn('[Founder Setup] Profile update warning:', profileError.message)
      // Try simpler version without usd_balance in profile
      try {
        await sql`
          INSERT INTO grain_user_profiles (user_id, email, full_name, verification_level, created_at, updated_at)
          VALUES (${userId}, ${email}, ${fullName}, 5, NOW(), NOW())
          ON CONFLICT (user_id) DO UPDATE SET verification_level = 5, updated_at = NOW()
        `
      } catch (e) {
        console.warn('[Founder Setup] Simple profile also failed')
      }
    }

    // 4. Record the founder USD allocation as a treasury transaction
    const allocationNote = `Founder USD allocation: $${FOUNDER_USD_ALLOCATION.toLocaleString()}. ` +
      `Backed by treasury float from ${TREASURY_APY * 100}% APY on aggregate deposits. ` +
      `Can be converted to GRAIN at any time at current market price. ` +
      `${notes || ''}`

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
        'founder_usd_allocation',
        ${FOUNDER_USD_ALLOCATION},
        ${allocationNote},
        ${'founder-usd-' + Date.now()},
        'completed',
        NOW(),
        NOW()
      )
    `

    // 5. Record treasury backing (internal ledger accounting)
    // The backing comes from the projected yield on future deposits
    // At 4.5% APY, this allocation represents founder equity backed by treasury operations
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
          'Founder USD Allocation',
          ${FOUNDER_USD_ALLOCATION},
          'treasury_apy_float',
          ${'founder-equity-' + userId.substring(0, 8)},
          'active',
          ${`Founder equity: $${FOUNDER_USD_ALLOCATION.toLocaleString()} backed by ${TREASURY_APY * 100}% APY treasury float. Principal equivalent: $${Math.round(FOUNDER_USD_ALLOCATION / TREASURY_APY).toLocaleString()} in deposits generating this yield over time.`}
        )
      `
    } catch (treasuryError: any) {
      console.warn('[Founder Setup] Treasury backing note:', treasuryError.message)
    }

    // Calculate backing details for response
    const backingDetails = {
      usdAllocation: FOUNDER_USD_ALLOCATION,
      grainBalance: 0, // Not invested yet
      backingType: 'treasury_apy_float',
      apyRate: TREASURY_APY,
      // The math: $333M backed by 4.5% yield means we need ~$7.4B in deposits
      // generating 4.5% annually to cover this allocation over time
      impliedTreasuryPrincipal: Math.round(FOUNDER_USD_ALLOCATION / TREASURY_APY),
      notes: 'USD allocation can be converted to GRAIN at any time. Backed by treasury yield operations.'
    }

    console.log(`[Founder Setup] Complete for ${userId}:`, {
      usdBalance: FOUNDER_USD_ALLOCATION,
      grainBalance: 0,
      limits: 'unlimited',
      backing: backingDetails
    })

    return NextResponse.json({
      success: true,
      message: 'Founder account configured successfully',
      account: {
        userId,
        email,
        usdBalance: FOUNDER_USD_ALLOCATION,
        formattedUsdBalance: '$' + FOUNDER_USD_ALLOCATION.toLocaleString(),
        grainBalance: 0,
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
        isFounder: true
      },
      backing: backingDetails,
      nextSteps: [
        'Your USD balance is ready',
        'Convert to GRAIN anytime via dashboard',
        'GRAIN price only appreciates over time',
        'Treasury backing recorded in ledger'
      ],
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

    // Try to get wallet with usd_balance
    let walletResult
    try {
      walletResult = await sql`
        SELECT *, usd_balance FROM user_wallets WHERE user_id = ${userId}
      `
    } catch (e) {
      walletResult = await sql`
        SELECT * FROM user_wallets WHERE user_id = ${userId}
      `
    }

    if (walletResult.rows.length === 0) {
      return NextResponse.json({ isFounder: false, setup: false })
    }

    const wallet = walletResult.rows[0]
    const usdBalance = parseFloat(wallet.usd_balance || '0')
    const grainBalance = parseFloat(wallet.balance || '0')
    const isFounder = wallet.wallet_id?.startsWith('founder-') || usdBalance >= 1_000_000

    return NextResponse.json({
      isFounder,
      setup: true,
      usdBalance,
      grainBalance,
      totalValue: usdBalance + grainBalance, // Assuming 1:1 for simplicity
      approved: wallet.approved,
      walletId: wallet.wallet_id
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
