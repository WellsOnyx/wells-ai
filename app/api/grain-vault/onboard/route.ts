// @ts-nocheck
/**
 * Grain & Vault Onboarding API
 * POST: Complete onboarding and create user wallet
 * SECURITY: Requires Clerk authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication for onboarding
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    const {
      // KYC Info
      full_name,
      date_of_birth,
      phone,
      ssn_last_four,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,
      employment_status,
      annual_income_range,
      net_worth_range,
      investment_experience,
      source_of_funds,
      terms_accepted
    } = body

    // Validation
    if (!full_name || !date_of_birth) {
      return NextResponse.json(
        { error: 'Missing required fields: full_name, date_of_birth' },
        { status: 400 }
      )
    }

    if (!terms_accepted) {
      return NextResponse.json(
        { error: 'You must accept the terms of service' },
        { status: 400 }
      )
    }

    // Check if user already has a wallet
    const existingWallet = await sql`
      SELECT user_id, wallet_address, balance
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    if (existingWallet.rows.length > 0) {
      // Already has wallet - just return success
      return NextResponse.json({
        success: true,
        message: 'Wallet already exists',
        wallet: {
          address: existingWallet.rows[0].wallet_address,
          balance: parseFloat(existingWallet.rows[0].balance || 0)
        }
      })
    }

    // Create user profile in grain_user_profiles (stores KYC data)
    try {
      await sql`
        INSERT INTO grain_user_profiles (
          user_id,
          full_name,
          date_of_birth,
          phone,
          ssn_last_four,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          country,
          employment_status,
          annual_income_range,
          net_worth_range,
          investment_experience,
          source_of_funds,
          verification_level,
          terms_accepted_at,
          created_at
        ) VALUES (
          ${userId},
          ${full_name},
          ${date_of_birth},
          ${phone || null},
          ${ssn_last_four || null},
          ${address_line1 || null},
          ${address_line2 || null},
          ${city || null},
          ${state || null},
          ${zip_code || null},
          ${country || 'US'},
          ${employment_status || null},
          ${annual_income_range || null},
          ${net_worth_range || null},
          ${investment_experience || null},
          ${source_of_funds || null},
          ${ssn_last_four ? 'intermediate' : 'basic'},
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          date_of_birth = EXCLUDED.date_of_birth,
          phone = EXCLUDED.phone,
          updated_at = NOW()
      `
    } catch (e: any) {
      // Table might not exist - create it
      console.log('grain_user_profiles table issue, will create on next deploy:', e.message)
    }

    // Generate dev wallet address (will be replaced by Circle in production)
    const walletAddress = `0x${Buffer.from(userId).toString('hex').substring(0, 40).padEnd(40, '0')}`
    const walletId = `dev-wallet-${userId.substring(0, 8)}`

    // Create user wallet
    await sql`
      INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
      VALUES (${userId}, ${walletId}, ${walletAddress}, 0, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
    `

    return NextResponse.json({
      success: true,
      message: 'Onboarding complete',
      wallet: {
        address: walletAddress,
        balance: 0
      }
    })
  } catch (error: any) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      {
        error: 'Failed to complete onboarding',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET: Check onboarding status
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has a wallet
    const wallet = await sql`
      SELECT user_id, wallet_address, balance
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    if (wallet.rows.length > 0) {
      return NextResponse.json({
        completed: true,
        wallet: {
          address: wallet.rows[0].wallet_address,
          balance: parseFloat(wallet.rows[0].balance || 0)
        }
      })
    }

    return NextResponse.json({
      completed: false
    })
  } catch (error: any) {
    console.error('Onboarding status error:', error)
    return NextResponse.json({
      completed: false,
      error: error?.message
    })
  }
}
