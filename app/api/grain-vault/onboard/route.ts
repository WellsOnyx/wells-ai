// @ts-nocheck
/**
 * Grain & Vault Enterprise Onboarding API
 *
 * POST: Complete KYC onboarding and create user wallet
 * GET: Check onboarding status
 *
 * SECURITY: Requires Clerk authentication
 *
 * Supported Countries: US, CA, MX, AR, GB, AE, JP, SG
 * Blocked: All US-sanctioned countries
 *
 * Verification Levels:
 * - Level 1: Email verified ($1K daily limit)
 * - Level 2: Phone + Address verified ($10K daily limit)
 * - Level 3: Full KYC + ID verified ($100K daily limit)
 * - Level 4: Enhanced due diligence (unlimited)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import {
  isCountrySupported,
  isCountrySanctioned,
  getCountryConfig,
  validateTaxId,
  validatePostalCode,
  IdType
} from '@/lib/grain-vault/countries'

// ============================================================================
// TYPES
// ============================================================================

interface OnboardingRequest {
  // Personal Information
  full_name: string
  first_name?: string
  last_name?: string
  date_of_birth: string
  phone?: string
  nationality?: string

  // Country of Residence (REQUIRED)
  country_of_residence: string  // ISO 3166-1 alpha-2: US, CA, MX, AR, GB, AE, JP, SG

  // Government ID
  government_id_type?: string   // Country-specific ID types
  government_id_expiry?: string

  // Tax ID (Country-specific)
  tax_id_type?: string          // ssn, sin, curp, cuit, ni_number, my_number, nric
  tax_id_last_four?: string     // Last 4 digits only (we never store full tax IDs)

  // Address
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string                // State/Province/Prefecture/Emirate
  zip_code?: string             // ZIP/Postal Code/Postcode
  country?: string

  // Financial Profile
  employment_status?: 'employed' | 'self-employed' | 'retired' | 'student' | 'unemployed' | 'other'
  employer_name?: string
  occupation?: string
  annual_income_range?: 'under_25k' | '25k_50k' | '50k_100k' | '100k_250k' | '250k_500k' | '500k_1m' | '1m_plus'
  net_worth_range?: 'under_50k' | '50k_100k' | '100k_500k' | '500k_1m' | '1m_5m' | '5m_plus'
  investment_experience?: 'none' | 'beginner' | 'intermediate' | 'experienced' | 'professional'
  source_of_funds?: 'salary' | 'business' | 'investments' | 'inheritance' | 'gift' | 'savings' | 'other'
  source_of_funds_detail?: string

  // Risk Profile
  investment_objectives?: 'preservation' | 'income' | 'growth' | 'speculation'
  risk_tolerance?: 'conservative' | 'moderate' | 'aggressive'
  time_horizon?: 'short' | 'medium' | 'long'

  // Terms
  terms_accepted: boolean
  marketing_consent?: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate verification level based on provided information
 */
function calculateVerificationLevel(data: OnboardingRequest, emailVerified: boolean): number {
  // Level 1: Basic info only
  if (!emailVerified) return 1

  const countryConfig = getCountryConfig(data.country_of_residence)

  // Level 2: Phone + Address
  const hasAddress = data.address_line1 && data.city && data.zip_code
  const needsState = countryConfig?.address.hasState ?? true
  const stateOk = !needsState || data.state
  if (!hasAddress || !stateOk) return 1

  // Level 3: Full KYC with Tax ID (country-specific)
  const hasFinancialProfile = data.employment_status && data.source_of_funds
  const requiresTaxId = countryConfig?.kyc.requiresTaxId ?? false
  const hasTaxId = !requiresTaxId || (data.tax_id_last_four && data.tax_id_last_four.length >= 3)
  if (hasFinancialProfile && hasTaxId) return 3

  // Level 2: Has address but no full KYC
  return 2
}

/**
 * Get limits based on verification level and country
 */
function getLimitsForLevel(level: number, countryCode: string = 'US'): {
  daily_deposit: number
  daily_withdraw: number
  monthly_deposit: number
  monthly_withdraw: number
  lifetime_deposit: number
} {
  const countryConfig = getCountryConfig(countryCode)

  // Country-specific limits from config
  const level1Daily = countryConfig?.limits.level1Daily || 1000
  const level2Daily = countryConfig?.limits.level2Daily || 10000
  const level3Daily = countryConfig?.limits.level3Daily || 100000

  switch (level) {
    case 1:
      return {
        daily_deposit: level1Daily,
        daily_withdraw: level1Daily,
        monthly_deposit: level1Daily * 10,
        monthly_withdraw: level1Daily * 10,
        lifetime_deposit: level1Daily * 50
      }
    case 2:
      return {
        daily_deposit: level2Daily,
        daily_withdraw: level2Daily,
        monthly_deposit: level2Daily * 10,
        monthly_withdraw: level2Daily * 10,
        lifetime_deposit: level2Daily * 50
      }
    case 3:
      return {
        daily_deposit: level3Daily,
        daily_withdraw: level3Daily,
        monthly_deposit: level3Daily * 10,
        monthly_withdraw: level3Daily * 10,
        lifetime_deposit: level3Daily * 50
      }
    case 4:
      return {
        daily_deposit: 1000000,
        daily_withdraw: 1000000,
        monthly_deposit: 10000000,
        monthly_withdraw: 10000000,
        lifetime_deposit: 100000000
      }
    default:
      return {
        daily_deposit: level1Daily,
        daily_withdraw: level1Daily,
        monthly_deposit: level1Daily * 10,
        monthly_withdraw: level1Daily * 10,
        lifetime_deposit: level1Daily * 50
      }
  }
}

// WELLS MASTER WALLET - All deposits go here for custodial management
const WELLS_MASTER_WALLET_ADDRESS = process.env.WELLS_MASTER_WALLET_ADDRESS || ''

/**
 * Generate ledger wallet ID (unique identifier for user's ledger entry)
 * Note: In custodial model, all users share the same deposit address (master wallet)
 */
function generateWalletId(userId: string): string {
  return `grain-ledger-${userId.substring(0, 8)}-${Date.now().toString(36)}`
}

// ============================================================================
// POST: Complete Onboarding
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const { userId } = await auth()
    console.log('[onboard POST] userId:', userId)

    if (!userId) {
      console.log('[onboard POST] No userId - returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Clerk user for email
    const user = await currentUser()
    if (!user) {
      console.log('[onboard POST] No Clerk user found')
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    console.log('[onboard POST] Clerk user email:', user.primaryEmailAddress?.emailAddress)

    const email = user.primaryEmailAddress?.emailAddress
    const emailVerified = user.primaryEmailAddress?.verification?.status === 'verified'

    const body: OnboardingRequest = await req.json()

    // ========================================================================
    // VALIDATION
    // ========================================================================

    // Country validation (CRITICAL - must check before anything else)
    const countryOfResidence = body.country_of_residence?.toUpperCase() || 'US'

    // Check for sanctioned countries FIRST
    if (isCountrySanctioned(countryOfResidence)) {
      console.warn(`[SECURITY] Blocked onboarding attempt from sanctioned country: ${countryOfResidence}, userId: ${userId}`)
      return NextResponse.json(
        {
          error: 'Service not available',
          code: 'SANCTIONED_COUNTRY',
          message: 'We are unable to provide services in your country at this time due to regulatory requirements.'
        },
        { status: 403 }
      )
    }

    // Check nationality for sanctioned countries
    if (body.nationality && isCountrySanctioned(body.nationality.toUpperCase())) {
      console.warn(`[SECURITY] Blocked onboarding attempt from sanctioned nationality: ${body.nationality}, userId: ${userId}`)
      return NextResponse.json(
        {
          error: 'Service not available',
          code: 'SANCTIONED_NATIONALITY',
          message: 'We are unable to provide services to nationals of certain countries at this time due to regulatory requirements.'
        },
        { status: 403 }
      )
    }

    // Check if country is supported
    if (!isCountrySupported(countryOfResidence)) {
      return NextResponse.json(
        {
          error: 'Country not supported',
          code: 'UNSUPPORTED_COUNTRY',
          message: `We currently support the following countries: US, CA, MX, AR, GB, AE, JP, SG`
        },
        { status: 400 }
      )
    }

    // Get country-specific config
    const countryConfig = getCountryConfig(countryOfResidence)

    // Basic validation
    if (!body.full_name) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      )
    }

    if (!body.date_of_birth) {
      return NextResponse.json(
        { error: 'Date of birth is required' },
        { status: 400 }
      )
    }

    // Age validation (country-specific)
    const minAge = countryConfig?.kyc.minAge || 18
    const dob = new Date(body.date_of_birth)
    const today = new Date()
    const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    if (age < minAge) {
      return NextResponse.json(
        {
          error: `Minimum age requirement not met`,
          message: `You must be at least ${minAge} years old to use this service in ${countryConfig?.name || 'your country'}.`
        },
        { status: 400 }
      )
    }

    if (!body.terms_accepted) {
      return NextResponse.json(
        { error: 'You must accept the terms of service' },
        { status: 400 }
      )
    }

    // Postal code validation (if provided)
    if (body.zip_code && !validatePostalCode(body.zip_code, countryOfResidence)) {
      return NextResponse.json(
        {
          error: 'Invalid postal code format',
          message: `Please enter a valid ${countryConfig?.address.postalCodeLabel || 'postal code'} for ${countryConfig?.name || 'your country'}.`
        },
        { status: 400 }
      )
    }

    // Calculate verification level
    const verificationLevel = calculateVerificationLevel(body, emailVerified)
    const limits = getLimitsForLevel(verificationLevel, countryOfResidence)

    // Check if profile already exists
    let existingProfile = null
    try {
      const profileResult = await sql`
        SELECT id, user_id, verification_level FROM grain_user_profiles
        WHERE user_id = ${userId}
      `
      existingProfile = profileResult.rows[0]
    } catch (e) {
      // Table might not exist yet - will be created by migration endpoint
    }

    if (existingProfile) {
      // Update existing profile
      await sql`
        UPDATE grain_user_profiles SET
          full_name = ${body.full_name},
          first_name = ${body.first_name || null},
          last_name = ${body.last_name || null},
          date_of_birth = ${body.date_of_birth},
          phone = ${body.phone || null},
          nationality = ${body.nationality || null},
          country_of_residence = ${countryOfResidence},
          tax_id_type = ${body.tax_id_type || null},
          ssn_last_four = ${body.tax_id_last_four || null},
          government_id_type = ${body.government_id_type || null},
          government_id_expiry = ${body.government_id_expiry || null},
          address_line1 = ${body.address_line1 || null},
          address_line2 = ${body.address_line2 || null},
          city = ${body.city || null},
          state = ${body.state || null},
          zip_code = ${body.zip_code || null},
          country = ${countryOfResidence},
          employment_status = ${body.employment_status || null},
          employer_name = ${body.employer_name || null},
          occupation = ${body.occupation || null},
          annual_income_range = ${body.annual_income_range || null},
          net_worth_range = ${body.net_worth_range || null},
          investment_experience = ${body.investment_experience || null},
          source_of_funds = ${body.source_of_funds || null},
          source_of_funds_detail = ${body.source_of_funds_detail || null},
          investment_objectives = ${body.investment_objectives || null},
          risk_tolerance = ${body.risk_tolerance || null},
          time_horizon = ${body.time_horizon || null},
          verification_level = ${verificationLevel},
          daily_deposit_limit = ${limits.daily_deposit},
          daily_withdraw_limit = ${limits.daily_withdraw},
          monthly_deposit_limit = ${limits.monthly_deposit},
          monthly_withdraw_limit = ${limits.monthly_withdraw},
          lifetime_deposit_limit = ${limits.lifetime_deposit},
          marketing_consent = ${body.marketing_consent || false},
          updated_at = NOW(),
          updated_by = ${userId}
        WHERE user_id = ${userId}
      `
    } else {
      // Create new profile
      await sql`
        INSERT INTO grain_user_profiles (
          user_id,
          clerk_user_id,
          email,
          email_verified,
          full_name,
          first_name,
          last_name,
          date_of_birth,
          phone,
          nationality,
          country_of_residence,
          tax_id_type,
          ssn_last_four,
          government_id_type,
          government_id_expiry,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          country,
          employment_status,
          employer_name,
          occupation,
          annual_income_range,
          net_worth_range,
          investment_experience,
          source_of_funds,
          source_of_funds_detail,
          investment_objectives,
          risk_tolerance,
          time_horizon,
          verification_level,
          verification_status,
          daily_deposit_limit,
          daily_withdraw_limit,
          monthly_deposit_limit,
          monthly_withdraw_limit,
          lifetime_deposit_limit,
          terms_version,
          terms_accepted_at,
          privacy_policy_version,
          privacy_policy_accepted_at,
          marketing_consent,
          status,
          created_at,
          created_by
        ) VALUES (
          ${userId},
          ${userId},
          ${email || null},
          ${emailVerified},
          ${body.full_name},
          ${body.first_name || null},
          ${body.last_name || null},
          ${body.date_of_birth},
          ${body.phone || null},
          ${body.nationality || null},
          ${countryOfResidence},
          ${body.tax_id_type || null},
          ${body.tax_id_last_four || null},
          ${body.government_id_type || null},
          ${body.government_id_expiry || null},
          ${body.address_line1 || null},
          ${body.address_line2 || null},
          ${body.city || null},
          ${body.state || null},
          ${body.zip_code || null},
          ${countryOfResidence},
          ${body.employment_status || null},
          ${body.employer_name || null},
          ${body.occupation || null},
          ${body.annual_income_range || null},
          ${body.net_worth_range || null},
          ${body.investment_experience || null},
          ${body.source_of_funds || null},
          ${body.source_of_funds_detail || null},
          ${body.investment_objectives || null},
          ${body.risk_tolerance || null},
          ${body.time_horizon || null},
          ${verificationLevel},
          'approved',
          ${limits.daily_deposit},
          ${limits.daily_withdraw},
          ${limits.monthly_deposit},
          ${limits.monthly_withdraw},
          ${limits.lifetime_deposit},
          '1.0',
          NOW(),
          '1.0',
          NOW(),
          ${body.marketing_consent || false},
          'active',
          NOW(),
          ${userId}
        )
      `
    }

    // Check if user already has a wallet entry in the ledger
    console.log('[onboard POST] Checking for existing wallet ledger entry for userId:', userId)
    const walletResult = await sql`
      SELECT user_id, wallet_id, wallet_address, balance
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    let wallet = walletResult.rows[0]
    console.log('[onboard POST] Existing wallet entry found:', !!wallet)

    // Get master wallet address - all users share this for deposits
    const masterWalletAddress = WELLS_MASTER_WALLET_ADDRESS || 'pending-config'

    if (!wallet) {
      // Create ledger entry for this user
      // In custodial model, all users share the same deposit address (master wallet)
      const walletId = generateWalletId(userId)

      console.log('[onboard POST] Creating ledger entry:', { userId, walletId, masterWalletAddress })

      await sql`
        INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
        VALUES (${userId}, ${walletId}, ${masterWalletAddress}, 0, NOW(), NOW())
      `

      console.log('[onboard POST] Ledger entry created successfully')

      wallet = {
        wallet_address: masterWalletAddress,
        wallet_id: walletId,
        balance: 0
      }

      // Record treasury event
      try {
        await sql`
          INSERT INTO grain_treasury_events (type, amount, user_id, notes, created_at)
          VALUES ('system_adjustment', 0, ${userId}, 'Ledger entry created during onboarding (custodial model)', NOW())
        `
      } catch (e) {
        // Table might not exist yet
        console.log('[onboard POST] Treasury event insert failed:', e)
      }
    } else {
      // Update existing wallet entry to use master wallet address if needed
      if (WELLS_MASTER_WALLET_ADDRESS && wallet.wallet_address !== WELLS_MASTER_WALLET_ADDRESS) {
        await sql`
          UPDATE user_wallets
          SET wallet_address = ${WELLS_MASTER_WALLET_ADDRESS}, updated_at = NOW()
          WHERE user_id = ${userId}
        `
        wallet.wallet_address = WELLS_MASTER_WALLET_ADDRESS
        console.log('[onboard POST] Updated wallet entry to use master wallet address')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding complete',
      profile: {
        user_id: userId,
        country_of_residence: countryOfResidence,
        country_name: countryConfig?.name || countryOfResidence,
        verification_level: verificationLevel,
        verification_status: 'approved',
        limits: {
          daily_deposit: limits.daily_deposit,
          daily_withdraw: limits.daily_withdraw,
          monthly_deposit: limits.monthly_deposit,
          monthly_withdraw: limits.monthly_withdraw,
          lifetime_deposit: limits.lifetime_deposit
        }
      },
      wallet: {
        address: wallet.wallet_address,
        balance: parseFloat(wallet.balance || 0)
      }
    })
  } catch (error: any) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      {
        error: 'Failed to complete onboarding',
        details: error?.message || 'Unknown error',
        code: error?.code
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: Check Onboarding Status
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has a profile
    let profile = null
    try {
      const profileResult = await sql`
        SELECT
          user_id,
          full_name,
          verification_level,
          verification_status,
          daily_deposit_limit,
          daily_withdraw_limit,
          status,
          created_at
        FROM grain_user_profiles
        WHERE user_id = ${userId}
      `
      profile = profileResult.rows[0]
    } catch (e) {
      // Table might not exist yet
    }

    // Check if user has a wallet
    let wallet = null
    try {
      const walletResult = await sql`
        SELECT user_id, wallet_address, balance
        FROM user_wallets
        WHERE user_id = ${userId}
      `
      wallet = walletResult.rows[0]
    } catch (e) {
      // Table might not exist
    }

    if (profile && wallet) {
      return NextResponse.json({
        completed: true,
        profile: {
          full_name: profile.full_name,
          verification_level: profile.verification_level,
          verification_status: profile.verification_status,
          status: profile.status,
          limits: {
            daily_deposit: parseFloat(profile.daily_deposit_limit),
            daily_withdraw: parseFloat(profile.daily_withdraw_limit)
          }
        },
        wallet: {
          address: wallet.wallet_address,
          balance: parseFloat(wallet.balance || 0)
        }
      })
    }

    // Check if just has wallet but no profile (legacy)
    if (wallet && !profile) {
      return NextResponse.json({
        completed: false,
        has_wallet: true,
        wallet: {
          address: wallet.wallet_address,
          balance: parseFloat(wallet.balance || 0)
        },
        message: 'Please complete your profile to access full features'
      })
    }

    return NextResponse.json({
      completed: false,
      has_wallet: false,
      message: 'Please complete onboarding to create your wallet'
    })
  } catch (error: any) {
    console.error('Onboarding status error:', error)
    return NextResponse.json({
      completed: false,
      error: error?.message
    })
  }
}
