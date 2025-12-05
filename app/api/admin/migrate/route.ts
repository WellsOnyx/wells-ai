import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// Master key for admin operations
const MASTER_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

export async function POST(request: NextRequest) {
  try {
    // Verify master key
    const authHeader = request.headers.get('authorization')
    const key = authHeader?.replace('Bearer ', '')

    if (key !== MASTER_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      }
    ]

    // Create each table
    for (const table of statements) {
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
    ]

    for (const indexSql of indexes) {
      try {
        await sql.query(indexSql)
        results.push({ statement: indexSql.substring(0, 60) + '...', success: true })
      } catch (error: any) {
        results.push({ statement: indexSql.substring(0, 60) + '...', success: false, error: error.message })
      }
    }

    // Verify tables created
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'treasury_%'
      ORDER BY table_name
    `

    const tables = tablesResult.rows.map(r => r.table_name)

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
      error: error.message || 'Migration failed'
    }, { status: 500 })
  }
}

// GET to check migration status
export async function GET(request: NextRequest) {
  try {
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE 'treasury_%' OR table_name IN ('user_wallets', 'circle_webhook_events'))
      ORDER BY table_name
    `

    const tables = tablesResult.rows.map(r => r.table_name)

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
