#!/usr/bin/env node
/**
 * Local migration runner - runs the same migrations as the step-based API
 * Usage: POSTGRES_URL="..." node scripts/run-migrations.js
 */

const { Client } = require('pg')

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.wellsmemory_POSTGRES_URL

if (!POSTGRES_URL) {
  console.error('Error: POSTGRES_URL environment variable is required')
  process.exit(1)
}

const MIGRATIONS = [
  {
    step: 1,
    name: 'Core Treasury Tables',
    sqls: [
      `CREATE TABLE IF NOT EXISTS treasury_accounts (
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
      )`,
      `CREATE TABLE IF NOT EXISTS treasury_wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
        wallet_id TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL UNIQUE,
        blockchain TEXT NOT NULL DEFAULT 'BASE',
        currency TEXT NOT NULL DEFAULT 'GRAIN',
        balance DECIMAL(20, 2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    ]
  },
  {
    step: 2,
    name: 'Transactions & Credit Lines',
    sqls: [
      `CREATE TABLE IF NOT EXISTS treasury_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
        wallet_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'payment', 'credit_draw', 'credit_repay', 'grain_mint', 'grain_burn')),
        amount DECIMAL(20, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'GRAIN',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
        reference TEXT UNIQUE,
        description TEXT,
        metadata JSONB DEFAULT '{}',
        erp_synced BOOLEAN DEFAULT FALSE,
        erp_sync_at TIMESTAMP,
        erp_reference TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS treasury_credit_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
        max_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
        used_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
        available_amount DECIMAL(20, 2) GENERATED ALWAYS AS (max_amount - used_amount) STORED,
        apr DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'frozen', 'closed')),
        approved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    ]
  },
  {
    step: 3,
    name: 'Vendors & Invoices',
    sqls: [
      `CREATE TABLE IF NOT EXISTS treasury_vendors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('supplier', 'contractor', 'service_provider', 'other')),
        email TEXT,
        wallet_address TEXT,
        payment_terms TEXT DEFAULT 'net30',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS treasury_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
        vendor_id UUID REFERENCES treasury_vendors(id) ON DELETE SET NULL,
        invoice_number TEXT NOT NULL,
        amount DECIMAL(20, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'paid', 'cancelled', 'disputed')),
        due_date DATE NOT NULL,
        paid_at TIMESTAMP,
        description TEXT,
        line_items JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        erp_synced BOOLEAN DEFAULT FALSE,
        erp_reference TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    ]
  },
  {
    step: 4,
    name: 'Payment Requests & User Wallets',
    sqls: [
      `CREATE TABLE IF NOT EXISTS treasury_payment_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
        vendor_id UUID REFERENCES treasury_vendors(id) ON DELETE SET NULL,
        invoice_id UUID REFERENCES treasury_invoices(id) ON DELETE SET NULL,
        amount DECIMAL(20, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        payment_method TEXT NOT NULL CHECK (payment_method IN ('ach', 'wire', 'stablecoin', 'grain', 'card')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'failed', 'cancelled')),
        approver_id TEXT,
        approved_at TIMESTAMP,
        scheduled_date DATE,
        executed_at TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS user_wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clerk_user_id TEXT NOT NULL,
        wallet_type TEXT NOT NULL CHECK (wallet_type IN ('personal', 'business', 'treasury')),
        address TEXT NOT NULL UNIQUE,
        blockchain TEXT NOT NULL DEFAULT 'BASE',
        balance DECIMAL(20, 2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS circle_webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type TEXT NOT NULL,
        event_id TEXT NOT NULL UNIQUE,
        payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP,
        error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    ]
  },
  {
    step: 5,
    name: 'Inbox Tables',
    sqls: [
      `CREATE TABLE IF NOT EXISTS inbox_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clerk_user_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        external_id TEXT,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        subject TEXT,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived', 'snoozed')),
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        labels JSONB DEFAULT '[]',
        assigned_to TEXT,
        last_message_at TIMESTAMP,
        unread_count INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS inbox_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
        direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'html', 'markdown')),
        attachments JSONB DEFAULT '[]',
        external_id TEXT,
        sent_by TEXT,
        read_at TIMESTAMP,
        delivered_at TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    ]
  },
  {
    step: 6,
    name: 'Inbox Templates & Quick Replies',
    sqls: [
      `CREATE TABLE IF NOT EXISTS inbox_quick_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clerk_user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        shortcut TEXT,
        category TEXT,
        use_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS inbox_ai_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clerk_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    ]
  },
  {
    step: 7,
    name: 'Indexes - Treasury',
    sqls: [
      `CREATE INDEX IF NOT EXISTS idx_treasury_accounts_clerk ON treasury_accounts(clerk_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_accounts_status ON treasury_accounts(status)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_wallets_account ON treasury_wallets(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_transactions_account ON treasury_transactions(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_transactions_status ON treasury_transactions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_transactions_created ON treasury_transactions(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_credit_lines_account ON treasury_credit_lines(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_vendors_account ON treasury_vendors(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_invoices_account ON treasury_invoices(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_invoices_status ON treasury_invoices(status)`,
      `CREATE INDEX IF NOT EXISTS idx_treasury_payment_requests_account ON treasury_payment_requests(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_wallets_clerk ON user_wallets(clerk_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_circle_webhook_events_event_id ON circle_webhook_events(event_id)`
    ]
  },
  {
    step: 8,
    name: 'Indexes - Inbox',
    sqls: [
      `CREATE INDEX IF NOT EXISTS idx_inbox_conversations_clerk ON inbox_conversations(clerk_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status ON inbox_conversations(status)`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_conversations_channel ON inbox_conversations(channel)`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_conversations_last_message ON inbox_conversations(last_message_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON inbox_messages(conversation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_messages_created ON inbox_messages(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_quick_replies_clerk ON inbox_quick_replies(clerk_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_inbox_ai_templates_clerk ON inbox_ai_templates(clerk_user_id)`
    ]
  }
]

async function runMigrations() {
  const client = new Client({ connectionString: POSTGRES_URL })

  try {
    await client.connect()
    console.log('Connected to database\n')

    for (const migration of MIGRATIONS) {
      console.log(`\n=== Step ${migration.step}: ${migration.name} ===`)

      for (const sql of migration.sqls) {
        try {
          await client.query(sql)
          const tableName = sql.match(/CREATE (?:TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[1] || 'query'
          console.log(`  ✓ ${tableName}`)
        } catch (err) {
          console.error(`  ✗ Error: ${err.message}`)
          // Continue with other migrations
        }
      }
    }

    console.log('\n=== Migration Complete ===\n')

    // Show table summary
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    console.log('Tables in database:')
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`))

  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigrations()
