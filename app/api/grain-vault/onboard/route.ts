// @ts-nocheck
/**
 * Grain & Vault Onboarding API
 * POST: Complete onboarding and create treasury account
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'

// Generate unique wallet address
function generateWalletAddress(email: string): string {
  const hash = crypto.createHash('sha256').update(email + Date.now()).digest('hex')
  return `GRAIN${hash.substring(0, 40).toUpperCase()}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      // Basic Info
      email,
      phone,
      full_name,
      date_of_birth,

      // Identity
      ssn_last_four,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,

      // Financial Profile
      employment_status,
      annual_income_range,
      net_worth_range,
      investment_experience,
      source_of_funds,

      // Terms
      terms_accepted
    } = body

    // Validation
    if (!email || !full_name || !date_of_birth) {
      return NextResponse.json(
        { error: 'Missing required fields: email, full_name, date_of_birth' },
        { status: 400 }
      )
    }

    if (!terms_accepted) {
      return NextResponse.json(
        { error: 'You must accept the terms of service' },
        { status: 400 }
      )
    }

    // Check if account already exists
    const existingAccount = await sql`
      SELECT id FROM treasury_accounts WHERE email = ${email}
    `

    if (existingAccount.rows.length > 0) {
      return NextResponse.json(
        { error: 'Account with this email already exists' },
        { status: 409 }
      )
    }

    // Generate wallet address
    const walletAddress = generateWalletAddress(email)

    // Determine verification level and limits based on info provided
    let verificationLevel = 'basic'
    let dailyDepositLimit = 1000
    let dailyWithdrawLimit = 1000
    let lifetimeDepositLimit = 10000

    if (ssn_last_four && address_line1 && city && state && zip_code) {
      verificationLevel = 'intermediate'
      dailyDepositLimit = 10000
      dailyWithdrawLimit = 10000
      lifetimeDepositLimit = 100000
    }

    if (employment_status && annual_income_range && net_worth_range) {
      verificationLevel = 'advanced'
      dailyDepositLimit = 50000
      dailyWithdrawLimit = 50000
      lifetimeDepositLimit = 500000
    }

    // Create treasury account
    const result = await sql`
      INSERT INTO treasury_accounts (
        email,
        phone,
        full_name,
        date_of_birth,
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
        wallet_address,
        verification_level,
        daily_deposit_limit,
        daily_withdraw_limit,
        lifetime_deposit_limit,
        status,
        terms_accepted_at,
        onboarding_completed_at
      ) VALUES (
        ${email},
        ${phone || null},
        ${full_name},
        ${date_of_birth},
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
        ${walletAddress},
        ${verificationLevel},
        ${dailyDepositLimit},
        ${dailyWithdrawLimit},
        ${lifetimeDepositLimit},
        'active',
        NOW(),
        NOW()
      )
      RETURNING id, wallet_address, verification_level, daily_deposit_limit, daily_withdraw_limit
    `

    const account = result.rows[0]

    // Update onboarding state if exists
    await sql`
      UPDATE onboarding_state
      SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE email = ${email}
    `

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        email,
        wallet_address: account.wallet_address,
        verification_level: account.verification_level,
        limits: {
          daily_deposit: parseFloat(account.daily_deposit_limit),
          daily_withdraw: parseFloat(account.daily_withdraw_limit)
        }
      }
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}

// GET: Get onboarding progress
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Check if already has account
    const account = await sql`
      SELECT id, wallet_address, status, onboarding_completed_at
      FROM treasury_accounts
      WHERE email = ${email}
    `

    if (account.rows.length > 0) {
      return NextResponse.json({
        completed: true,
        account: account.rows[0]
      })
    }

    // Check onboarding state
    const onboarding = await sql`
      SELECT * FROM onboarding_state WHERE email = ${email}
    `

    if (onboarding.rows.length > 0) {
      const state = onboarding.rows[0]
      return NextResponse.json({
        completed: false,
        current_step: state.current_step,
        completed_steps: state.completed_steps,
        email_verified: state.email_verified,
        phone_verified: state.phone_verified
      })
    }

    // No onboarding started
    return NextResponse.json({
      completed: false,
      current_step: 'basic_info',
      completed_steps: []
    })
  } catch (error) {
    console.error('Get onboarding error:', error)
    return NextResponse.json(
      { error: 'Failed to get onboarding status' },
      { status: 500 }
    )
  }
}
