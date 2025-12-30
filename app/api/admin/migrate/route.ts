import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Verify master key - check at runtime, not module level
    // Trim whitespace in case env var has trailing newline
    const MASTER_KEY = process.env.COLD_START_MASTER_KEY?.trim()
    const authHeader = request.headers.get('authorization')
    const key = authHeader?.replace('Bearer ', '')?.trim()

    if (!MASTER_KEY) {
      console.error('CRITICAL: COLD_START_MASTER_KEY environment variable is not set')
      return NextResponse.json({
        error: 'Server configuration error - COLD_START_MASTER_KEY not set',
        hint: 'Add COLD_START_MASTER_KEY to Vercel environment variables'
      }, { status: 500 })
    }

    if (key !== MASTER_KEY) {
      return NextResponse.json({ error: 'Unauthorized - invalid master key' }, { status: 401 })
    }

    console.log('🚀 Starting Treasury SDK database migration...\n')

    const results: { statement: string; success: boolean; error?: string }[] = []

    // Create tables using raw SQL via sql.query()
    const tableStatements = [
      {
        name: 'treasury_accounts',
        sql: `CREATE TABLE IF NOT EXISTS treasury_accounts (
          id TEXT PRIMARY KEY,
          clerk_user_id TEXT NOT NULL UNIQUE,
          company_name TEXT NOT NULL,
          company_size TEXT NOT NULL,
          industry TEXT NOT NULL,
          country TEXT NOT NULL DEFAULT 'US',
          erp_system TEXT NOT NULL,
          erp_version TEXT,
          erp_connected BOOLEAN DEFAULT FALSE,
          erp_config JSONB DEFAULT '{}',
          tier TEXT NOT NULL DEFAULT 'starter',
          status TEXT NOT NULL DEFAULT 'active',
          api_key TEXT NOT NULL UNIQUE,
          sdk_enabled BOOLEAN DEFAULT TRUE,
          grain_balance DECIMAL(20, 2) DEFAULT 0,
          credit_line DECIMAL(20, 2) DEFAULT 0,
          used_credit DECIMAL(20, 2) DEFAULT 0,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          onboarding_completed_at TIMESTAMP,
          last_activity_at TIMESTAMP,
          email TEXT,
          phone TEXT,
          full_name TEXT,
          date_of_birth TEXT,
          ssn_last_four TEXT,
          address_line1 TEXT,
          address_line2 TEXT,
          city TEXT,
          state TEXT,
          zip_code TEXT,
          employment_status TEXT,
          annual_income_range TEXT,
          net_worth_range TEXT,
          investment_experience TEXT,
          source_of_funds TEXT,
          wallet_address TEXT,
          verification_level TEXT DEFAULT 'basic',
          daily_deposit_limit DECIMAL(20, 2) DEFAULT 1000,
          daily_withdraw_limit DECIMAL(20, 2) DEFAULT 1000,
          lifetime_deposit_limit DECIMAL(20, 2) DEFAULT 10000,
          terms_accepted_at TIMESTAMP
        )`
      },
      {
        name: 'treasury_wallets',
        sql: `CREATE TABLE IF NOT EXISTS treasury_wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
          wallet_id TEXT NOT NULL UNIQUE,
          address TEXT NOT NULL UNIQUE,
          blockchain TEXT NOT NULL DEFAULT 'BASE',
          currency TEXT NOT NULL DEFAULT 'GRAIN',
          balance DECIMAL(20, 2) DEFAULT 0,
          grain_value_at_deposit DECIMAL(20, 6) DEFAULT 1.0,
          current_grain_value DECIMAL(20, 6) DEFAULT 1.0,
          status TEXT NOT NULL DEFAULT 'active',
          kyc_status TEXT DEFAULT 'not-started',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_sync_at TIMESTAMP
        )`
      },
      {
        name: 'treasury_transactions',
        sql: `CREATE TABLE IF NOT EXISTS treasury_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          amount DECIMAL(20, 2) NOT NULL,
          currency TEXT NOT NULL DEFAULT 'GRAIN',
          status TEXT NOT NULL DEFAULT 'pending',
          from_wallet TEXT,
          to_wallet TEXT,
          circle_tx_id TEXT,
          circle_transfer_id TEXT,
          counterparty_id TEXT,
          counterparty_name TEXT,
          counterparty_wallet TEXT,
          erp_reference TEXT,
          cost_center TEXT,
          gl_account TEXT,
          description TEXT,
          memo TEXT,
          metadata JSONB DEFAULT '{}',
          error_code TEXT,
          error_message TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMP,
          failed_at TIMESTAMP
        )`
      },
      {
        name: 'treasury_credit_lines',
        sql: `CREATE TABLE IF NOT EXISTS treasury_credit_lines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE UNIQUE,
          limit_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
          drawn_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
          interest_rate DECIMAL(5, 4) DEFAULT 0.0000,
          grace_period_days INTEGER DEFAULT 30,
          status TEXT NOT NULL DEFAULT 'active',
          last_draw_at TIMESTAMP,
          last_repay_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      {
        name: 'treasury_vendors',
        sql: `CREATE TABLE IF NOT EXISTS treasury_vendors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
          vendor_id TEXT NOT NULL,
          vendor_name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          wallet_id TEXT,
          wallet_address TEXT,
          payment_terms TEXT,
          early_payment_discount DECIMAL(5, 2),
          early_payment_days INTEGER,
          auto_pay_enabled BOOLEAN DEFAULT FALSE,
          trust_score INTEGER,
          status TEXT NOT NULL DEFAULT 'active',
          onboarding_status TEXT DEFAULT 'invited',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          invited_at TIMESTAMP,
          onboarded_at TIMESTAMP,
          last_payment_at TIMESTAMP,
          UNIQUE(account_id, vendor_id)
        )`
      },
      {
        name: 'treasury_invoices',
        sql: `CREATE TABLE IF NOT EXISTS treasury_invoices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
          vendor_id UUID REFERENCES treasury_vendors(id) ON DELETE SET NULL,
          erp_invoice_id TEXT NOT NULL,
          invoice_number TEXT NOT NULL,
          amount DECIMAL(20, 2) NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          invoice_date DATE NOT NULL,
          due_date DATE NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          payment_status TEXT DEFAULT 'unpaid',
          paid_amount DECIMAL(20, 2) DEFAULT 0,
          transaction_id UUID REFERENCES treasury_transactions(id),
          erp_po_number TEXT,
          cost_center TEXT,
          gl_account TEXT,
          description TEXT,
          metadata JSONB DEFAULT '{}',
          synced_at TIMESTAMP,
          sync_status TEXT DEFAULT 'synced',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMP,
          UNIQUE(account_id, erp_invoice_id)
        )`
      },
      {
        name: 'treasury_payment_requests',
        sql: `CREATE TABLE IF NOT EXISTS treasury_payment_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
          payment_id TEXT NOT NULL UNIQUE,
          amount DECIMAL(20, 2) NOT NULL,
          currency TEXT NOT NULL DEFAULT 'GRAIN',
          customer_email TEXT,
          customer_name TEXT,
          erp_reference TEXT,
          invoice_number TEXT,
          memo TEXT,
          payment_link TEXT NOT NULL,
          qr_code_url TEXT,
          wallet_address TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          due_date DATE,
          expires_at TIMESTAMP,
          paid_amount DECIMAL(20, 2) DEFAULT 0,
          transaction_id UUID REFERENCES treasury_transactions(id),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMP
        )`
      },
      {
        name: 'user_wallets',
        sql: `CREATE TABLE IF NOT EXISTS user_wallets (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL UNIQUE,
          wallet_id VARCHAR(255) NOT NULL,
          wallet_address VARCHAR(255) NOT NULL,
          balance DECIMAL(20, 6) DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'circle_webhook_events',
        sql: `CREATE TABLE IF NOT EXISTS circle_webhook_events (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(255) NOT NULL UNIQUE,
          event_type VARCHAR(100) NOT NULL,
          circle_transfer_id VARCHAR(255),
          payload JSONB NOT NULL,
          status VARCHAR(50) DEFAULT 'received',
          error_message TEXT,
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      },
      // Unified Inbox tables
      {
        name: 'inbox_conversations',
        sql: `CREATE TABLE IF NOT EXISTS inbox_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_id TEXT NOT NULL,
          contact_name TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          contact_company TEXT,
          subject TEXT,
          channel TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          priority TEXT DEFAULT 'normal',
          intent TEXT,
          sentiment TEXT,
          category TEXT,
          assigned_to TEXT,
          unread_count INTEGER DEFAULT 1,
          last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_message_preview TEXT,
          lead_id UUID,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      {
        name: 'inbox_messages',
        sql: `CREATE TABLE IF NOT EXISTS inbox_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          content_html TEXT,
          direction TEXT NOT NULL,
          sender_type TEXT NOT NULL,
          sender_id TEXT,
          sender_name TEXT,
          channel TEXT NOT NULL,
          channel_message_id TEXT,
          email_subject TEXT,
          email_from TEXT,
          email_to TEXT,
          email_cc TEXT,
          email_attachments JSONB DEFAULT '[]',
          sms_from TEXT,
          sms_to TEXT,
          ai_generated BOOLEAN DEFAULT FALSE,
          ai_approved BOOLEAN,
          ai_approved_by TEXT,
          ai_approved_at TIMESTAMP,
          status TEXT DEFAULT 'sent',
          error_message TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          sent_at TIMESTAMP,
          delivered_at TIMESTAMP,
          read_at TIMESTAMP
        )`
      },
      {
        name: 'inbox_quick_replies',
        sql: `CREATE TABLE IF NOT EXISTS inbox_quick_replies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT,
          shortcut TEXT,
          channel TEXT,
          created_by TEXT,
          use_count INTEGER DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      {
        name: 'inbox_ai_templates',
        sql: `CREATE TABLE IF NOT EXISTS inbox_ai_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          system_prompt TEXT NOT NULL,
          example_input TEXT,
          example_output TEXT,
          category TEXT,
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      // Cold Start tables
      {
        name: 'coldstart_campaigns',
        sql: `CREATE TABLE IF NOT EXISTS coldstart_campaigns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          name TEXT,
          icp_config JSONB NOT NULL,
          channels JSONB NOT NULL DEFAULT '[]',
          geo TEXT DEFAULT 'United States',
          daily_volume INTEGER DEFAULT 50,
          status TEXT DEFAULT 'draft',
          total_contacts INTEGER DEFAULT 0,
          total_reached INTEGER DEFAULT 0,
          total_responses INTEGER DEFAULT 0,
          total_meetings INTEGER DEFAULT 0,
          total_deals INTEGER DEFAULT 0,
          total_spend DECIMAL(12, 2) DEFAULT 0,
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'coldstart_contacts',
        sql: `CREATE TABLE IF NOT EXISTS coldstart_contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID REFERENCES coldstart_campaigns(id),
          first_name TEXT,
          last_name TEXT,
          email TEXT,
          phone TEXT,
          linkedin_url TEXT,
          company_name TEXT,
          company_domain TEXT,
          company_size TEXT,
          industry TEXT,
          title TEXT,
          department TEXT,
          seniority TEXT,
          apollo_id TEXT,
          zoominfo_id TEXT,
          linkedin_id TEXT,
          enrichment_data JSONB,
          status TEXT DEFAULT 'pending',
          last_contacted_at TIMESTAMP,
          last_response_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'coldstart_activities',
        sql: `CREATE TABLE IF NOT EXISTS coldstart_activities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID REFERENCES coldstart_campaigns(id),
          contact_id UUID REFERENCES coldstart_contacts(id),
          activity_type TEXT NOT NULL,
          channel TEXT NOT NULL,
          message TEXT,
          details JSONB,
          call_duration_seconds INTEGER,
          call_recording_url TEXT,
          call_transcript TEXT,
          outcome TEXT,
          sentiment TEXT,
          next_action TEXT,
          provider TEXT,
          provider_id TEXT,
          provider_response JSONB,
          cost DECIMAL(8, 4) DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'coldstart_conversations',
        sql: `CREATE TABLE IF NOT EXISTS coldstart_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID REFERENCES coldstart_campaigns(id),
          contact_id UUID REFERENCES coldstart_contacts(id),
          channel TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          messages JSONB DEFAULT '[]',
          total_messages INTEGER DEFAULT 0,
          last_message_at TIMESTAMP,
          intent_signals JSONB,
          buying_stage TEXT,
          pain_points JSONB,
          outcome TEXT,
          meeting_scheduled_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'coldstart_voice_calls',
        sql: `CREATE TABLE IF NOT EXISTS coldstart_voice_calls (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID REFERENCES coldstart_campaigns(id),
          contact_id UUID REFERENCES coldstart_contacts(id),
          activity_id UUID REFERENCES coldstart_activities(id),
          phone_number TEXT,
          provider TEXT,
          provider_call_id TEXT,
          status TEXT,
          direction TEXT DEFAULT 'outbound',
          initiated_at TIMESTAMP,
          answered_at TIMESTAMP,
          ended_at TIMESTAMP,
          duration_seconds INTEGER,
          recording_url TEXT,
          transcript TEXT,
          transcript_json JSONB,
          summary TEXT,
          sentiment TEXT,
          key_topics JSONB,
          objections JSONB,
          next_actions JSONB,
          outcome TEXT,
          meeting_details JSONB,
          cost DECIMAL(8, 4),
          created_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'coldstart_linkedin_activities',
        sql: `CREATE TABLE IF NOT EXISTS coldstart_linkedin_activities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID REFERENCES coldstart_campaigns(id),
          contact_id UUID REFERENCES coldstart_contacts(id),
          action_type TEXT,
          linkedin_url TEXT,
          message_content TEXT,
          post_url TEXT,
          status TEXT,
          sent_at TIMESTAMP,
          response_at TIMESTAMP,
          response_content TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'coldstart_icp_templates',
        sql: `CREATE TABLE IF NOT EXISTS coldstart_icp_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          title TEXT,
          keywords JSONB,
          industries JSONB,
          company_size TEXT,
          geo TEXT,
          pain_points JSONB,
          value_props JSONB,
          voice_script JSONB,
          linkedin_script JSONB,
          email_script JSONB,
          is_default BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'coldstart_integrations',
        sql: `CREATE TABLE IF NOT EXISTS coldstart_integrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          api_key TEXT,
          config JSONB,
          credits_remaining INTEGER,
          last_sync_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      },
      // GRAIN Stablecoin tables
      {
        name: 'grain_transactions',
        sql: `CREATE TABLE IF NOT EXISTS grain_transactions (
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
        )`
      },
      {
        name: 'grain_credit_lines',
        sql: `CREATE TABLE IF NOT EXISTS grain_credit_lines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL UNIQUE,
          tier TEXT NOT NULL DEFAULT 'starter',
          max_limit DECIMAL(20, 6) NOT NULL DEFAULT 0,
          current_balance DECIMAL(20, 6) NOT NULL DEFAULT 0,
          interest_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
          grace_period_days INTEGER DEFAULT 30,
          status TEXT NOT NULL DEFAULT 'active',
          last_draw_date TIMESTAMP,
          last_payment_date TIMESTAMP,
          next_payment_due TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      {
        name: 'grain_escrow',
        sql: `CREATE TABLE IF NOT EXISTS grain_escrow (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deal_id TEXT NOT NULL UNIQUE,
          buyer_user_id TEXT NOT NULL,
          supplier_user_id TEXT,
          amount DECIMAL(20, 6) NOT NULL,
          fee_amount DECIMAL(20, 6) DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'locked',
          locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
          released_at TIMESTAMP,
          refunded_at TIMESTAMP,
          release_conditions JSONB DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      {
        name: 'grain_treasury_snapshots',
        sql: `CREATE TABLE IF NOT EXISTS grain_treasury_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          snapshot_date DATE NOT NULL UNIQUE,
          total_grain_supply DECIMAL(20, 6) NOT NULL,
          total_usdc_backing DECIMAL(20, 6) NOT NULL,
          backing_ratio DECIMAL(10, 6) NOT NULL,
          asset_vault_value DECIMAL(20, 6) DEFAULT 0,
          grain_value DECIMAL(10, 6) DEFAULT 1.0,
          total_credit_extended DECIMAL(20, 6) NOT NULL,
          effective_leverage DECIMAL(10, 6) NOT NULL,
          active_escrow_amount DECIMAL(20, 6) NOT NULL,
          transaction_count_24h INTEGER NOT NULL,
          transaction_volume_24h DECIMAL(20, 6) NOT NULL,
          unique_users_24h INTEGER NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      {
        name: 'grain_asset_holdings',
        sql: `CREATE TABLE IF NOT EXISTS grain_asset_holdings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          purchase_price DECIMAL(20, 6) NOT NULL,
          current_value DECIMAL(20, 6) NOT NULL,
          purchase_date TIMESTAMP NOT NULL,
          on_chain_address TEXT,
          blockchain TEXT,
          yield_rate DECIMAL(8, 4),
          status TEXT NOT NULL DEFAULT 'active',
          last_valuation_at TIMESTAMP,
          valuation_source TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      {
        name: 'grain_treasury_events',
        sql: `CREATE TABLE IF NOT EXISTS grain_treasury_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          amount DECIMAL(20, 6) NOT NULL,
          source TEXT,
          circle_transfer_id TEXT,
          sweep_id UUID,
          swept_at TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      {
        name: 'grain_interest_sweeps',
        sql: `CREATE TABLE IF NOT EXISTS grain_interest_sweeps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          amount DECIMAL(20, 6) NOT NULL,
          source TEXT NOT NULL,
          sweep_date TIMESTAMP NOT NULL,
          tx_hash TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          asset_purchase_id UUID,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      },
      // Unified Payments Tables (GRAIN-first architecture)
      {
        name: 'unified_transactions',
        sql: `CREATE TABLE IF NOT EXISTS unified_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          counterparty_id TEXT,
          counterparty_address TEXT,
          type VARCHAR(50) NOT NULL,
          amount DECIMAL(20, 8) NOT NULL,
          currency VARCHAR(10) NOT NULL,
          rail VARCHAR(20) NOT NULL,
          method VARCHAR(30) NOT NULL,
          fee_amount DECIMAL(20, 8) DEFAULT 0,
          fee_currency VARCHAR(10) DEFAULT 'GRAIN',
          reference TEXT,
          memo TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          error_message TEXT,
          grain_price_at_execution DECIMAL(20, 8),
          credit_line_draw DECIMAL(20, 8) DEFAULT 0,
          conversion_rate DECIMAL(20, 8),
          escrow_id UUID,
          circle_transfer_id TEXT,
          stripe_payment_intent_id TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        )`
      },
      {
        name: 'grain_escrows',
        sql: `CREATE TABLE IF NOT EXISTS grain_escrows (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          from_user_id TEXT NOT NULL,
          to_user_id TEXT NOT NULL,
          grain_amount DECIMAL(20, 8) NOT NULL,
          grain_price_at_lock DECIMAL(20, 8) NOT NULL,
          usd_equivalent_at_lock DECIMAL(20, 2) NOT NULL,
          released_amount DECIMAL(20, 8) DEFAULT 0,
          grain_price_at_release DECIMAL(20, 8),
          release_conditions TEXT NOT NULL,
          release_date TIMESTAMPTZ,
          allow_partial_release BOOLEAN DEFAULT false,
          reference TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'locked',
          released_by TEXT,
          released_at TIMESTAMPTZ,
          disputed_at TIMESTAMPTZ,
          dispute_reason TEXT,
          dispute_resolved_at TIMESTAMPTZ,
          dispute_resolution TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'payroll_batches',
        sql: `CREATE TABLE IF NOT EXISTS payroll_batches (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_user_id TEXT NOT NULL,
          total_grain DECIMAL(20, 8) NOT NULL,
          total_usd DECIMAL(20, 2) NOT NULL,
          grain_price DECIMAL(20, 8) NOT NULL,
          entry_count INTEGER NOT NULL,
          success_count INTEGER NOT NULL,
          failed_count INTEGER DEFAULT 0,
          pay_period_start DATE,
          pay_period_end DATE,
          status VARCHAR(20) DEFAULT 'completed',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'user_balances',
        sql: `CREATE TABLE IF NOT EXISTS user_balances (
          user_id TEXT PRIMARY KEY,
          usdc_balance DECIMAL(20, 8) DEFAULT 0,
          pending_deposits DECIMAL(20, 8) DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      // Security Infrastructure Tables
      {
        name: 'grain_system_controls',
        sql: `CREATE TABLE IF NOT EXISTS grain_system_controls (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          operation_type VARCHAR(50) NOT NULL UNIQUE,
          is_paused BOOLEAN DEFAULT FALSE,
          pause_reason TEXT,
          paused_by TEXT,
          paused_at TIMESTAMPTZ,
          resumed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      },
      {
        name: 'grain_frozen_accounts',
        sql: `CREATE TABLE IF NOT EXISTS grain_frozen_accounts (
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
        )`
      },
      {
        name: 'grain_emergency_audit_log',
        sql: `CREATE TABLE IF NOT EXISTS grain_emergency_audit_log (
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
        )`
      },
      {
        name: 'grain_audit_logs',
        sql: `CREATE TABLE IF NOT EXISTS grain_audit_logs (
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
        )`
      },
      {
        name: 'aml_screening_results',
        sql: `CREATE TABLE IF NOT EXISTS aml_screening_results (
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
        )`
      },
      {
        name: 'aml_alerts',
        sql: `CREATE TABLE IF NOT EXISTS aml_alerts (
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
        )`
      },
      {
        name: 'grain_verification_sessions',
        sql: `CREATE TABLE IF NOT EXISTS grain_verification_sessions (
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
        )`
      }
    ]

    // Create each table using sql.query for raw SQL
    for (const table of tableStatements) {
      try {
        await sql.query(table.sql)
        results.push({ statement: `CREATE TABLE ${table.name}`, success: true })
        console.log(`✅ Created table: ${table.name}`)
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          results.push({ statement: `CREATE TABLE ${table.name}`, success: true, error: 'Already exists' })
          console.log(`⚠️ Table already exists: ${table.name}`)
        } else {
          results.push({ statement: `CREATE TABLE ${table.name}`, success: false, error: error.message })
          console.error(`❌ Failed to create table ${table.name}:`, error.message)
        }
      }
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_treasury_accounts_clerk_user ON treasury_accounts(clerk_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_accounts_api_key ON treasury_accounts(api_key)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_accounts_status ON treasury_accounts(status)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_accounts_created ON treasury_accounts(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_wallets_account ON treasury_wallets(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_wallets_wallet_id ON treasury_wallets(wallet_id)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_wallets_address ON treasury_wallets(address)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_transactions_account ON treasury_transactions(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_transactions_type ON treasury_transactions(type)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_transactions_status ON treasury_transactions(status)',
      'CREATE INDEX IF NOT EXISTS idx_treasury_transactions_created ON treasury_transactions(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_webhook_events_transfer_id ON circle_webhook_events(circle_transfer_id)',
      // Inbox indexes
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_contact ON inbox_conversations(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status ON inbox_conversations(status)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_channel ON inbox_conversations(channel)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_last_message ON inbox_conversations(last_message_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_assigned ON inbox_conversations(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON inbox_messages(conversation_id)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_created ON inbox_messages(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_channel ON inbox_messages(channel)',
      // Cold Start indexes
      'CREATE INDEX IF NOT EXISTS idx_coldstart_campaigns_user ON coldstart_campaigns(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_coldstart_campaigns_status ON coldstart_campaigns(status)',
      'CREATE INDEX IF NOT EXISTS idx_coldstart_contacts_campaign ON coldstart_contacts(campaign_id)',
      'CREATE INDEX IF NOT EXISTS idx_coldstart_contacts_status ON coldstart_contacts(status)',
      'CREATE INDEX IF NOT EXISTS idx_coldstart_activities_campaign ON coldstart_activities(campaign_id)',
      'CREATE INDEX IF NOT EXISTS idx_coldstart_activities_contact ON coldstart_activities(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_coldstart_activities_type ON coldstart_activities(activity_type)',
      'CREATE INDEX IF NOT EXISTS idx_coldstart_voice_calls_campaign ON coldstart_voice_calls(campaign_id)',
      'CREATE INDEX IF NOT EXISTS idx_coldstart_linkedin_campaign ON coldstart_linkedin_activities(campaign_id)',
      // GRAIN indexes
      'CREATE INDEX IF NOT EXISTS idx_grain_transactions_user ON grain_transactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_grain_transactions_type ON grain_transactions(type)',
      'CREATE INDEX IF NOT EXISTS idx_grain_transactions_status ON grain_transactions(status)',
      'CREATE INDEX IF NOT EXISTS idx_grain_transactions_deal ON grain_transactions(deal_id)',
      'CREATE INDEX IF NOT EXISTS idx_grain_credit_lines_user ON grain_credit_lines(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_grain_credit_lines_status ON grain_credit_lines(status)',
      'CREATE INDEX IF NOT EXISTS idx_grain_escrow_deal ON grain_escrow(deal_id)',
      'CREATE INDEX IF NOT EXISTS idx_grain_escrow_buyer ON grain_escrow(buyer_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_grain_escrow_status ON grain_escrow(status)',
      // Security infrastructure indexes
      'CREATE INDEX IF NOT EXISTS idx_grain_audit_logs_actor ON grain_audit_logs(actor_id)',
      'CREATE INDEX IF NOT EXISTS idx_grain_audit_logs_timestamp ON grain_audit_logs(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_grain_audit_logs_event_type ON grain_audit_logs(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_aml_screening_user ON aml_screening_results(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_aml_screening_created ON aml_screening_results(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_aml_alerts_status ON aml_alerts(status)',
      'CREATE INDEX IF NOT EXISTS idx_aml_alerts_user ON aml_alerts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_aml_alerts_severity ON aml_alerts(severity)',
      'CREATE INDEX IF NOT EXISTS idx_verification_sessions_user ON grain_verification_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_verification_sessions_status ON grain_verification_sessions(status)',
      'CREATE INDEX IF NOT EXISTS idx_frozen_accounts_user ON grain_frozen_accounts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_frozen_accounts_status ON grain_frozen_accounts(status)',
      'CREATE INDEX IF NOT EXISTS idx_emergency_audit_admin ON grain_emergency_audit_log(admin_id)',
      'CREATE INDEX IF NOT EXISTS idx_emergency_audit_created ON grain_emergency_audit_log(created_at DESC)',
    ]

    for (const indexSql of indexes) {
      try {
        await sql.query(indexSql)
        results.push({ statement: indexSql.substring(0, 60) + '...', success: true })
      } catch (error: any) {
        results.push({ statement: indexSql.substring(0, 60) + '...', success: false, error: error.message })
      }
    }

    // Add security columns to existing tables
    const alterStatements = [
      // grain_transactions columns
      { table: 'grain_transactions', column: 'circle_reference_id', sql: 'ALTER TABLE grain_transactions ADD COLUMN IF NOT EXISTS circle_reference_id TEXT' },
      { table: 'grain_transactions', column: 'screening_id', sql: 'ALTER TABLE grain_transactions ADD COLUMN IF NOT EXISTS screening_id TEXT' },
      { table: 'grain_transactions', column: 'metadata', sql: "ALTER TABLE grain_transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'" },
      // user_wallets columns
      { table: 'user_wallets', column: 'verification_level', sql: 'ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS verification_level INTEGER DEFAULT 1' },
      { table: 'user_wallets', column: 'daily_limit', sql: 'ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS daily_limit DECIMAL(20,2) DEFAULT 1000' },
      { table: 'user_wallets', column: 'daily_used', sql: 'ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS daily_used DECIMAL(20,2) DEFAULT 0' },
      { table: 'user_wallets', column: 'daily_reset_at', sql: 'ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMPTZ DEFAULT NOW()' },
    ]

    for (const alter of alterStatements) {
      try {
        await sql.query(alter.sql)
        results.push({ statement: `ALTER ${alter.table}.${alter.column}`, success: true })
        console.log(`✅ Added column: ${alter.table}.${alter.column}`)
      } catch (error: any) {
        // Column might already exist, which is fine
        if (error.message?.includes('already exists')) {
          results.push({ statement: `ALTER ${alter.table}.${alter.column}`, success: true, error: 'Already exists' })
        } else {
          results.push({ statement: `ALTER ${alter.table}.${alter.column}`, success: false, error: error.message })
          console.error(`❌ Failed to add column ${alter.table}.${alter.column}:`, error.message)
        }
      }
    }

    // Initialize system accounts
    try {
      await sql.query(`
        INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance)
        VALUES
          ('WELLS_ESCROW_ACCOUNT', 'ESCROW', 'ESCROW', 0),
          ('WELLS_TREASURY', 'TREASURY', 'TREASURY', 0)
        ON CONFLICT (user_id) DO NOTHING
      `)
      results.push({ statement: 'Initialize system accounts', success: true })
    } catch (error: any) {
      results.push({ statement: 'Initialize system accounts', success: false, error: error.message })
    }

    // Verify tables created
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE 'treasury_%' OR table_name LIKE 'inbox_%' OR table_name LIKE 'coldstart_%' OR table_name LIKE 'grain_%' OR table_name LIKE 'aml_%' OR table_name IN ('user_wallets', 'circle_webhook_events'))
      ORDER BY table_name
    `

    const tables = tablesResult.rows.map((r: any) => r.table_name)

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      tables,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Migration failed',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

// GET to check migration status
export async function GET() {
  try {
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE 'treasury_%' OR table_name LIKE 'inbox_%' OR table_name LIKE 'coldstart_%' OR table_name LIKE 'grain_%' OR table_name LIKE 'aml_%' OR table_name IN ('user_wallets', 'circle_webhook_events'))
      ORDER BY table_name
    `

    const tables = tablesResult.rows.map((r: any) => r.table_name)

    // Count records in each table
    const counts: Record<string, number> = {}
    for (const table of tables) {
      try {
        const result = await sql.query(`SELECT COUNT(*) as count FROM ${table}`)
        counts[table] = Number(result.rows[0]?.count || 0)
      } catch {
        counts[table] = -1 // Error reading
      }
    }

    return NextResponse.json({
      success: true,
      tables,
      counts,
      migrationNeeded: tables.length < 7,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      migrationNeeded: true
    }, { status: 500 })
  }
}
