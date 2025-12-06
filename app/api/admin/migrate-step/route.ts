import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@vercel/postgres'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 second timeout

function getClient() {
  const connectionString = process.env.POSTGRES_URL || process.env.wellsmemory_POSTGRES_URL
  return createClient({ connectionString })
}

const MASTER_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

// Define migration steps - each step runs independently
const MIGRATION_STEPS: Record<number, { name: string; sqls: string[] }> = {
  1: {
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
        grain_value_at_deposit DECIMAL(20, 6) DEFAULT 1.0,
        current_grain_value DECIMAL(20, 6) DEFAULT 1.0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'frozen')),
        kyc_status TEXT DEFAULT 'not-started' CHECK (kyc_status IN ('not-started', 'pending', 'approved', 'rejected')),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_sync_at TIMESTAMP
      )`
    ]
  },
  2: {
    name: 'Transactions & Credit',
    sqls: [
      `CREATE TABLE IF NOT EXISTS treasury_transactions (
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
      )`,
      `CREATE TABLE IF NOT EXISTS treasury_credit_lines (
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
    ]
  },
  3: {
    name: 'Vendors & Invoices',
    sqls: [
      `CREATE TABLE IF NOT EXISTS treasury_vendors (
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
      )`,
      `CREATE TABLE IF NOT EXISTS treasury_invoices (
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
    ]
  },
  4: {
    name: 'Payment Requests & User Wallets',
    sqls: [
      `CREATE TABLE IF NOT EXISTS treasury_payment_requests (
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
      )`,
      `CREATE TABLE IF NOT EXISTS user_wallets (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        wallet_id VARCHAR(255) NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        balance DECIMAL(20, 6) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS circle_webhook_events (
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
    ]
  },
  5: {
    name: 'Inbox Tables',
    sqls: [
      `CREATE TABLE IF NOT EXISTS inbox_conversations (
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
      )`,
      `CREATE TABLE IF NOT EXISTS inbox_messages (
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
    ]
  },
  6: {
    name: 'Inbox Templates & Quick Replies',
    sqls: [
      `CREATE TABLE IF NOT EXISTS inbox_quick_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        shortcut TEXT,
        channel TEXT,
        created_by TEXT,
        use_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS inbox_ai_templates (
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
    ]
  },
  7: {
    name: 'Indexes - Treasury',
    sqls: [
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
      'CREATE INDEX IF NOT EXISTS idx_webhook_events_transfer_id ON circle_webhook_events(circle_transfer_id)'
    ]
  },
  8: {
    name: 'Indexes - Inbox',
    sqls: [
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_contact ON inbox_conversations(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status ON inbox_conversations(status)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_channel ON inbox_conversations(channel)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_last_message ON inbox_conversations(last_message_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_assigned ON inbox_conversations(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON inbox_messages(conversation_id)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_created ON inbox_messages(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_channel ON inbox_messages(channel)'
    ]
  }
}

const TOTAL_STEPS = Object.keys(MIGRATION_STEPS).length

export async function POST(request: NextRequest) {
  const client = getClient()

  try {
    // Verify master key
    const authHeader = request.headers.get('authorization')
    const key = authHeader?.replace('Bearer ', '')

    if (key !== MASTER_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get step from query param
    const { searchParams } = new URL(request.url)
    const stepParam = searchParams.get('step')
    const step = stepParam ? parseInt(stepParam, 10) : 1

    if (step < 1 || step > TOTAL_STEPS) {
      return NextResponse.json({
        error: `Invalid step. Must be between 1 and ${TOTAL_STEPS}`,
        totalSteps: TOTAL_STEPS
      }, { status: 400 })
    }

    const migration = MIGRATION_STEPS[step]

    await client.connect()
    console.log(`🚀 Running migration step ${step}: ${migration.name}`)

    const results: { sql: string; success: boolean; error?: string }[] = []

    for (const sql of migration.sqls) {
      try {
        await client.query(sql)
        const shortSql = sql.substring(0, 60).replace(/\s+/g, ' ') + '...'
        results.push({ sql: shortSql, success: true })
        console.log(`✅ Executed: ${shortSql}`)
      } catch (error: any) {
        const shortSql = sql.substring(0, 60).replace(/\s+/g, ' ') + '...'
        if (error.message?.includes('already exists')) {
          results.push({ sql: shortSql, success: true, error: 'Already exists' })
          console.log(`⚠️ Already exists: ${shortSql}`)
        } else {
          results.push({ sql: shortSql, success: false, error: error.message })
          console.error(`❌ Failed: ${shortSql}`, error.message)
        }
      }
    }

    await client.end()

    const nextStep = step < TOTAL_STEPS ? step + 1 : null

    return NextResponse.json({
      success: true,
      step,
      stepName: migration.name,
      totalSteps: TOTAL_STEPS,
      nextStep,
      results,
      nextUrl: nextStep ? `/api/admin/migrate-step?step=${nextStep}` : null,
      message: nextStep
        ? `Step ${step} complete. Run step ${nextStep} next.`
        : 'All migrations complete!'
    })

  } catch (error: any) {
    console.error('Migration step failed:', error)
    try { await client.end() } catch {}
    return NextResponse.json({
      success: false,
      error: error.message || 'Migration step failed'
    }, { status: 500 })
  }
}

// GET to check status
export async function GET(request: NextRequest) {
  const client = getClient()

  try {
    await client.connect()

    // Check which tables exist
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE 'treasury_%' OR table_name LIKE 'inbox_%' OR table_name IN ('user_wallets', 'circle_webhook_events'))
      ORDER BY table_name
    `)

    const existingTables = tablesResult.rows.map((r: any) => r.table_name)

    // Figure out what step we're on
    const expectedTables: Record<number, string[]> = {
      1: ['treasury_accounts', 'treasury_wallets'],
      2: ['treasury_transactions', 'treasury_credit_lines'],
      3: ['treasury_vendors', 'treasury_invoices'],
      4: ['treasury_payment_requests', 'user_wallets', 'circle_webhook_events'],
      5: ['inbox_conversations', 'inbox_messages'],
      6: ['inbox_quick_replies', 'inbox_ai_templates'],
    }

    let completedSteps = 0
    for (let step = 1; step <= 6; step++) {
      const tablesForStep = expectedTables[step] || []
      const allExist = tablesForStep.every(t => existingTables.includes(t))
      if (allExist) {
        completedSteps = step
      } else {
        break
      }
    }

    // Check indexes (steps 7-8)
    if (completedSteps >= 6) {
      const indexResult = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname LIKE 'idx_treasury_%'
      `)
      if (indexResult.rows.length >= 10) completedSteps = 7

      const inboxIndexResult = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname LIKE 'idx_inbox_%'
      `)
      if (inboxIndexResult.rows.length >= 5) completedSteps = 8
    }

    await client.end()

    const nextStep = completedSteps < TOTAL_STEPS ? completedSteps + 1 : null

    return NextResponse.json({
      success: true,
      existingTables,
      completedSteps,
      totalSteps: TOTAL_STEPS,
      nextStep,
      nextUrl: nextStep ? `/api/admin/migrate-step?step=${nextStep}` : null,
      fullyMigrated: completedSteps >= TOTAL_STEPS,
      message: completedSteps >= TOTAL_STEPS
        ? 'All migrations complete!'
        : `Run step ${nextStep} to continue: POST /api/admin/migrate-step?step=${nextStep}`
    })

  } catch (error: any) {
    try { await client.end() } catch {}
    return NextResponse.json({
      success: false,
      error: error.message,
      nextStep: 1,
      nextUrl: '/api/admin/migrate-step?step=1'
    }, { status: 500 })
  }
}
