import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// Create client for direct connection (works with Prisma Postgres)
function getClient() {
  const connectionString = process.env.POSTGRES_URL || process.env.wellsmemory_POSTGRES_URL
  return createClient({ connectionString })
}

// Master key for admin operations
const MASTER_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

export async function POST(request: NextRequest) {
  const client = getClient()

  try {
    // Verify master key
    const authHeader = request.headers.get('authorization')
    const key = authHeader?.replace('Bearer ', '')

    if (key !== MASTER_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await client.connect()
    console.log('🚀 Starting Treasury SDK database migration...\n')

    const results: { statement: string; success: boolean; error?: string }[] = []

    // Create tables one by one
    const statements = [
      {
        name: 'treasury_accounts',
        sql: `CREATE TABLE IF NOT EXISTS treasury_accounts (
          id TEXT PRIMARY KEY,
          clerk_user_id TEXT NOT NULL UNIQUE,
          company_name TEXT NOT NULL,
          company_size TEXT NOT NULL CHECK (company_size IN ('startup', 'smb', 'mid-market', 'enterprise')),
          industry TEXT NOT NULL,
          country TEXT NOT NULL DEFAULT 'US',
          erp_system TEXT NOT NULL CHECK (erp_system IN ('sap', 'oracle', 'netsuite', 'dynamics365', 'workday', 'coupa', 'other', 'none')),
          erp_version TEXT,
          erp_connected BOOLEAN DEFAULT FALSE,
          erp_config JSONB DEFAULT '{}',
          tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'growth', 'enterprise')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'closed')),
          api_key TEXT NOT NULL UNIQUE,
          sdk_enabled BOOLEAN DEFAULT TRUE,
          grain_balance DECIMAL(20, 2) DEFAULT 0,
          credit_line DECIMAL(20, 2) DEFAULT 0,
          used_credit DECIMAL(20, 2) DEFAULT 0,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          onboarding_completed_at TIMESTAMP,
          last_activity_at TIMESTAMP
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
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'frozen')),
          kyc_status TEXT DEFAULT 'not-started' CHECK (kyc_status IN ('not-started', 'pending', 'approved', 'rejected')),
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
          type TEXT NOT NULL CHECK (type IN ('payment', 'receipt', 'credit_draw', 'credit_repay', 'conversion', 'reserve')),
          amount DECIMAL(20, 2) NOT NULL,
          currency TEXT NOT NULL DEFAULT 'GRAIN' CHECK (currency IN ('GRAIN', 'USDC', 'USD')),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
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
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
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
          trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
          onboarding_status TEXT DEFAULT 'invited' CHECK (onboarding_status IN ('invited', 'pending', 'completed', 'declined')),
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
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled', 'overdue')),
          payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'failed')),
          paid_amount DECIMAL(20, 2) DEFAULT 0,
          transaction_id UUID REFERENCES treasury_transactions(id),
          erp_po_number TEXT,
          cost_center TEXT,
          gl_account TEXT,
          description TEXT,
          metadata JSONB DEFAULT '{}',
          synced_at TIMESTAMP,
          sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
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
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
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
          channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'slack', 'chat', 'whatsapp')),
          status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'archived')),
          priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
          intent TEXT,
          sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
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
          direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
          sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'user', 'ai', 'system')),
          sender_id TEXT,
          sender_name TEXT,
          channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'slack', 'chat', 'whatsapp')),
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
          status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'pending_approval', 'sending', 'sent', 'delivered', 'failed', 'read')),
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
      }
    ]

    // Create each table
    for (const table of statements) {
      try {
        await client.query(table.sql)
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
    ]

    for (const indexSql of indexes) {
      try {
        await client.query(indexSql)
        results.push({ statement: indexSql.substring(0, 60) + '...', success: true })
      } catch (error: any) {
        results.push({ statement: indexSql.substring(0, 60) + '...', success: false, error: error.message })
      }
    }

    // Verify tables created
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE 'treasury_%' OR table_name LIKE 'inbox_%' OR table_name LIKE 'coldstart_%' OR table_name IN ('user_wallets', 'circle_webhook_events'))
      ORDER BY table_name
    `)

    const tables = tablesResult.rows.map((r: any) => r.table_name)

    await client.end()

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      tables,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Migration failed:', error)
    try { await client.end() } catch {}
    return NextResponse.json({
      success: false,
      error: error.message || 'Migration failed'
    }, { status: 500 })
  }
}

// GET to check migration status
export async function GET() {
  const client = getClient()

  try {
    await client.connect()

    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE 'treasury_%' OR table_name LIKE 'inbox_%' OR table_name LIKE 'coldstart_%' OR table_name IN ('user_wallets', 'circle_webhook_events'))
      ORDER BY table_name
    `)

    const tables = tablesResult.rows.map((r: any) => r.table_name)

    // Count records in each table
    const counts: Record<string, number> = {}
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`)
        counts[table] = Number(result.rows[0]?.count || 0)
      } catch {
        counts[table] = -1 // Error reading
      }
    }

    await client.end()

    return NextResponse.json({
      success: true,
      tables,
      counts,
      migrationNeeded: tables.length < 7,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    try { await client.end() } catch {}
    return NextResponse.json({
      success: false,
      error: error.message,
      migrationNeeded: true
    }, { status: 500 })
  }
}
