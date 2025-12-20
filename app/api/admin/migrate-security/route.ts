/**
 * Security Infrastructure Migration API
 *
 * Run via: POST /api/admin/migrate-security
 * Requires admin authorization
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// List of authorized admin user IDs
const ADMIN_USER_IDS = [
  process.env.EMERGENCY_ADMIN_1,
  process.env.EMERGENCY_ADMIN_2,
  process.env.EMERGENCY_ADMIN_3,
].filter(Boolean)

export async function POST(req: NextRequest) {
  try {
    // Check authorization
    const { userId } = await auth()
    const authHeader = req.headers.get('authorization')
    const masterKey = process.env.EMERGENCY_MASTER_KEY

    const isAdmin = userId && ADMIN_USER_IDS.includes(userId)
    const hasMasterKey = authHeader === `Bearer ${masterKey}` && masterKey

    if (!isAdmin && !hasMasterKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: { step: string; success: boolean; error?: string }[] = []

    // Step 1: Emergency controls tables
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_system_controls (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          operation_type VARCHAR(50) NOT NULL UNIQUE,
          is_paused BOOLEAN DEFAULT FALSE,
          pause_reason TEXT,
          paused_by TEXT,
          paused_at TIMESTAMPTZ,
          resumed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      results.push({ step: 'grain_system_controls', success: true })
    } catch (e: any) {
      results.push({ step: 'grain_system_controls', success: false, error: e.message })
    }

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_frozen_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          freeze_reason TEXT NOT NULL,
          frozen_by TEXT NOT NULL,
          frozen_at TIMESTAMPTZ DEFAULT NOW(),
          unfrozen_at TIMESTAMPTZ,
          review_notes TEXT,
          status VARCHAR(20) DEFAULT 'frozen',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      results.push({ step: 'grain_frozen_accounts', success: true })
    } catch (e: any) {
      results.push({ step: 'grain_frozen_accounts', success: false, error: e.message })
    }

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_emergency_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          action_type VARCHAR(50) NOT NULL,
          operation_type VARCHAR(50),
          user_id TEXT,
          admin_id TEXT NOT NULL,
          reason TEXT,
          metadata JSONB DEFAULT '{}',
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      results.push({ step: 'grain_emergency_audit_log', success: true })
    } catch (e: any) {
      results.push({ step: 'grain_emergency_audit_log', success: false, error: e.message })
    }

    // Step 2: Audit logs table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          event_type VARCHAR(100) NOT NULL,
          event_category VARCHAR(50) NOT NULL,
          actor_id TEXT,
          target_user_id TEXT,
          ip_address TEXT,
          user_agent TEXT,
          action_details JSONB DEFAULT '{}',
          result VARCHAR(20) DEFAULT 'success',
          risk_level VARCHAR(20) DEFAULT 'low',
          request_id TEXT,
          session_id TEXT,
          previous_hash TEXT,
          hash TEXT,
          retention_expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      results.push({ step: 'grain_audit_logs', success: true })
    } catch (e: any) {
      results.push({ step: 'grain_audit_logs', success: false, error: e.message })
    }

    // Step 3: AML screening tables
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS aml_screening_results (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          screening_type VARCHAR(50) NOT NULL,
          passed BOOLEAN NOT NULL,
          risk_score INTEGER,
          risk_level VARCHAR(20),
          action_taken VARCHAR(50),
          flags JSONB DEFAULT '[]',
          details JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      results.push({ step: 'aml_screening_results', success: true })
    } catch (e: any) {
      results.push({ step: 'aml_screening_results', success: false, error: e.message })
    }

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS aml_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          alert_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          description TEXT,
          details JSONB DEFAULT '{}',
          assigned_to TEXT,
          resolved_at TIMESTAMPTZ,
          resolved_by TEXT,
          resolution_notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      results.push({ step: 'aml_alerts', success: true })
    } catch (e: any) {
      results.push({ step: 'aml_alerts', success: false, error: e.message })
    }

    // Step 4: Identity verification tables
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS grain_verification_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          provider VARCHAR(50) NOT NULL,
          provider_session_id TEXT,
          status VARCHAR(30) DEFAULT 'pending',
          verification_url TEXT,
          result JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ
        )
      `
      results.push({ step: 'grain_verification_sessions', success: true })
    } catch (e: any) {
      results.push({ step: 'grain_verification_sessions', success: false, error: e.message })
    }

    // Step 5: Circle webhook tracking
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS circle_webhook_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          notification_id TEXT UNIQUE,
          circle_event_id TEXT,
          event_type VARCHAR(100) NOT NULL,
          payload JSONB NOT NULL,
          success BOOLEAN,
          action_taken TEXT,
          user_id TEXT,
          amount DECIMAL(20,2),
          error_message TEXT,
          processed_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      results.push({ step: 'circle_webhook_events', success: true })
    } catch (e: any) {
      results.push({ step: 'circle_webhook_events', success: false, error: e.message })
    }

    // Step 6: Add columns to existing tables
    try {
      await sql`ALTER TABLE grain_transactions ADD COLUMN IF NOT EXISTS circle_reference_id TEXT`
      await sql`ALTER TABLE grain_transactions ADD COLUMN IF NOT EXISTS screening_id TEXT`
      await sql`ALTER TABLE grain_transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`
      results.push({ step: 'grain_transactions_columns', success: true })
    } catch (e: any) {
      results.push({ step: 'grain_transactions_columns', success: false, error: e.message })
    }

    try {
      await sql`ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS verification_level INTEGER DEFAULT 1`
      await sql`ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS daily_limit DECIMAL(20,2) DEFAULT 1000`
      await sql`ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS daily_used DECIMAL(20,2) DEFAULT 0`
      await sql`ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMPTZ DEFAULT NOW()`
      results.push({ step: 'user_wallets_columns', success: true })
    } catch (e: any) {
      results.push({ step: 'user_wallets_columns', success: false, error: e.message })
    }

    // Step 7: Create indexes
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON grain_audit_logs(actor_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON grain_audit_logs(timestamp DESC)`
      await sql`CREATE INDEX IF NOT EXISTS idx_aml_screening_user ON aml_screening_results(user_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_aml_alerts_status ON aml_alerts(status)`
      await sql`CREATE INDEX IF NOT EXISTS idx_verification_user ON grain_verification_sessions(user_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_frozen_accounts_user ON grain_frozen_accounts(user_id)`
      results.push({ step: 'indexes', success: true })
    } catch (e: any) {
      results.push({ step: 'indexes', success: false, error: e.message })
    }

    // Summary
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: failureCount === 0,
      message: `Migration completed: ${successCount} succeeded, ${failureCount} failed`,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Security migrations endpoint',
    usage: 'POST to this endpoint with admin authorization to run migrations',
    required: 'Authorization header with master key or authenticated admin user'
  })
}
