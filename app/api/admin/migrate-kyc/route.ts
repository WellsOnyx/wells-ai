// @ts-nocheck
/**
 * KYC Schema Migration Endpoint
 * POST: Run the grain_user_profiles schema migration
 *
 * SECURITY: This should be removed after migration or protected
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(req: NextRequest) {
  try {
    // Run migration statements one at a time
    const results: { step: string; status: string; error?: string }[] = []

    // 1. Create grain_user_profiles table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_user_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL UNIQUE,
          clerk_user_id TEXT NOT NULL,
          email TEXT,
          email_verified BOOLEAN DEFAULT FALSE,
          phone TEXT,
          phone_verified BOOLEAN DEFAULT FALSE,
          full_name TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          date_of_birth DATE,
          ssn_last_four TEXT,
          ssn_hash TEXT,
          government_id_type TEXT,
          government_id_number_hash TEXT,
          government_id_expiry DATE,
          government_id_verified BOOLEAN DEFAULT FALSE,
          address_line1 TEXT,
          address_line2 TEXT,
          city TEXT,
          state TEXT,
          zip_code TEXT,
          country TEXT DEFAULT 'US',
          address_verified BOOLEAN DEFAULT FALSE,
          address_verification_date TIMESTAMP,
          employment_status TEXT,
          employer_name TEXT,
          occupation TEXT,
          annual_income_range TEXT,
          net_worth_range TEXT,
          investment_experience TEXT,
          source_of_funds TEXT,
          source_of_funds_detail TEXT,
          investment_objectives TEXT,
          risk_tolerance TEXT,
          time_horizon TEXT,
          verification_level INTEGER DEFAULT 1,
          verification_status TEXT DEFAULT 'pending',
          verification_notes TEXT,
          verification_documents JSONB DEFAULT '[]',
          daily_deposit_limit DECIMAL(20, 2) DEFAULT 1000,
          daily_withdraw_limit DECIMAL(20, 2) DEFAULT 1000,
          monthly_deposit_limit DECIMAL(20, 2) DEFAULT 10000,
          monthly_withdraw_limit DECIMAL(20, 2) DEFAULT 10000,
          lifetime_deposit_limit DECIMAL(20, 2) DEFAULT 50000,
          pep_status BOOLEAN DEFAULT FALSE,
          pep_details TEXT,
          sanctions_check_date TIMESTAMP,
          sanctions_check_result TEXT,
          aml_risk_score INTEGER,
          status TEXT DEFAULT 'active',
          suspension_reason TEXT,
          terms_version TEXT DEFAULT '1.0',
          terms_accepted_at TIMESTAMP,
          privacy_policy_version TEXT DEFAULT '1.0',
          privacy_policy_accepted_at TIMESTAMP,
          marketing_consent BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          last_login_at TIMESTAMP,
          last_activity_at TIMESTAMP,
          created_by TEXT,
          updated_by TEXT
        )
      `
      results.push({ step: 'Create grain_user_profiles', status: 'success' })
    } catch (e: any) {
      results.push({ step: 'Create grain_user_profiles', status: e.message.includes('already exists') ? 'skipped' : 'error', error: e.message })
    }

    // 2. Create indexes for grain_user_profiles
    const indexes = [
      { name: 'idx_grain_user_profiles_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_user_id ON grain_user_profiles(user_id)' },
      { name: 'idx_grain_user_profiles_clerk_id', sql: 'CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_clerk_id ON grain_user_profiles(clerk_user_id)' },
      { name: 'idx_grain_user_profiles_email', sql: 'CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_email ON grain_user_profiles(email)' },
      { name: 'idx_grain_user_profiles_status', sql: 'CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_status ON grain_user_profiles(status)' },
    ]

    for (const idx of indexes) {
      try {
        await sql.query(idx.sql)
        results.push({ step: `Create ${idx.name}`, status: 'success' })
      } catch (e: any) {
        results.push({ step: `Create ${idx.name}`, status: 'skipped', error: e.message })
      }
    }

    // 3. Create grain_treasury_events table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_treasury_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          amount DECIMAL(20, 6) NOT NULL,
          currency TEXT DEFAULT 'USDC',
          user_id TEXT,
          circle_transfer_id TEXT,
          transaction_hash TEXT,
          notes TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          created_by TEXT
        )
      `
      results.push({ step: 'Create grain_treasury_events', status: 'success' })
    } catch (e: any) {
      results.push({ step: 'Create grain_treasury_events', status: e.message.includes('already exists') ? 'skipped' : 'error', error: e.message })
    }

    // 4. Create grain_asset_holdings table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_asset_holdings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          asset_type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          purchase_price DECIMAL(20, 2) NOT NULL,
          purchase_date DATE NOT NULL,
          current_value DECIMAL(20, 2) NOT NULL,
          last_valuation_date DATE NOT NULL,
          valuation_method TEXT,
          annual_yield_percent DECIMAL(5, 2),
          last_income_date DATE,
          total_income_received DECIMAL(20, 2) DEFAULT 0,
          status TEXT DEFAULT 'active',
          external_id TEXT,
          external_system TEXT,
          documents JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      results.push({ step: 'Create grain_asset_holdings', status: 'success' })
    } catch (e: any) {
      results.push({ step: 'Create grain_asset_holdings', status: e.message.includes('already exists') ? 'skipped' : 'error', error: e.message })
    }

    // 5. Create grain_verification_requests table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_verification_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          profile_id UUID,
          verification_type TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          documents JSONB DEFAULT '[]',
          reviewer_id TEXT,
          reviewer_notes TEXT,
          rejection_reason TEXT,
          submitted_at TIMESTAMP DEFAULT NOW(),
          reviewed_at TIMESTAMP,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      results.push({ step: 'Create grain_verification_requests', status: 'success' })
    } catch (e: any) {
      results.push({ step: 'Create grain_verification_requests', status: e.message.includes('already exists') ? 'skipped' : 'error', error: e.message })
    }

    // 6. Verify user_wallets table exists
    try {
      const check = await sql`SELECT COUNT(*) as count FROM user_wallets LIMIT 1`
      results.push({ step: 'Verify user_wallets', status: 'success' })
    } catch (e: any) {
      // Create it if it doesn't exist
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS user_wallets (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL UNIQUE,
            wallet_id VARCHAR(255) NOT NULL,
            wallet_address VARCHAR(255) NOT NULL,
            balance DECIMAL(20, 6) DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `
        results.push({ step: 'Create user_wallets', status: 'success' })
      } catch (e2: any) {
        results.push({ step: 'Create user_wallets', status: 'error', error: e2.message })
      }
    }

    // 7. Verify grain_transactions table exists
    try {
      const check = await sql`SELECT COUNT(*) as count FROM grain_transactions LIMIT 1`
      results.push({ step: 'Verify grain_transactions', status: 'success' })
    } catch (e: any) {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS grain_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            amount DECIMAL(20, 6) NOT NULL,
            to_user_id TEXT,
            deal_id TEXT,
            reason TEXT,
            circle_transfer_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            error_message TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMP
          )
        `
        results.push({ step: 'Create grain_transactions', status: 'success' })
      } catch (e2: any) {
        results.push({ step: 'Create grain_transactions', status: 'error', error: e2.message })
      }
    }

    // Count successes/errors
    const successCount = results.filter(r => r.status === 'success').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    const errorCount = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: errorCount === 0,
      summary: {
        success: successCount,
        skipped: skippedCount,
        errors: errorCount
      },
      results
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Check table status
  try {
    const tables = ['grain_user_profiles', 'grain_treasury_events', 'grain_asset_holdings', 'grain_verification_requests', 'user_wallets', 'grain_transactions']
    const status: Record<string, { exists: boolean; rowCount?: number }> = {}

    for (const table of tables) {
      try {
        const result = await sql.query(`SELECT COUNT(*) as count FROM ${table}`)
        status[table] = { exists: true, rowCount: parseInt(result.rows[0].count) }
      } catch (e) {
        status[table] = { exists: false }
      }
    }

    return NextResponse.json({ tables: status })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
