/**
 * Grain & Vault Database Migration API
 * POST: Run the Circle payments migration
 * Uses createClient from @vercel/postgres for proper connection handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// Create client for direct connection (works with Prisma Postgres)
function getClient() {
  const connectionString = process.env.POSTGRES_URL || process.env.wellsmemory_POSTGRES_URL;
  return createClient({ connectionString });
}

export async function POST(req: NextRequest) {
  const client = getClient();

  try {
    // Simple auth check - require admin secret
    const authHeader = req.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || 'grain-vault-migrate-2024';

    if (authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get optional step parameter (1-8)
    const body = await req.json().catch(() => ({}));
    const step = body.step || 0; // 0 = run all, 1-8 = run specific step

    const results: string[] = [];

    await client.connect();

    const runStep = async (stepNum: number) => {
      switch (stepNum) {
        case 1:
          // Create treasury_accounts table (base table)
          await client.query(`
            CREATE TABLE IF NOT EXISTS treasury_accounts (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              clerk_user_id TEXT UNIQUE,
              email TEXT UNIQUE NOT NULL,
              phone TEXT,
              full_name TEXT NOT NULL,
              date_of_birth DATE,
              wallet_address TEXT,
              circle_wallet_id TEXT,
              circle_wallet_set_id TEXT,
              circle_user_token TEXT,
              grain_balance DECIMAL(24,6) DEFAULT 0,
              usd_balance DECIMAL(20,2) DEFAULT 0,
              verification_level TEXT DEFAULT 'basic',
              daily_deposit_limit DECIMAL(20,2) DEFAULT 10000,
              daily_withdraw_limit DECIMAL(20,2) DEFAULT 10000,
              status TEXT DEFAULT 'active',
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `);
          results.push('Step 1: Created treasury_accounts table');
          break;

        case 2:
          // Create grain_transactions table (base table)
          await client.query(`
            CREATE TABLE IF NOT EXISTS grain_transactions (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              account_id UUID REFERENCES treasury_accounts(id),
              type TEXT NOT NULL,
              usd_amount DECIMAL(20,2),
              grain_amount DECIMAL(24,6),
              fee_amount DECIMAL(20,2) DEFAULT 0,
              grain_price DECIMAL(20,10) DEFAULT 1.0,
              counterparty_id UUID,
              deal_id TEXT,
              circle_transfer_id TEXT,
              circle_payout_id TEXT,
              status TEXT DEFAULT 'pending',
              description TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              completed_at TIMESTAMP
            )
          `);
          results.push('Step 2: Created grain_transactions table');
          break;

        case 3:
          // Create indexes on base tables
          await client.query(`CREATE INDEX IF NOT EXISTS idx_treasury_email ON treasury_accounts(email)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_treasury_clerk ON treasury_accounts(clerk_user_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_treasury_status ON treasury_accounts(status)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_treasury_circle_wallet ON treasury_accounts(circle_wallet_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_grain_tx_account ON grain_transactions(account_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_grain_tx_type ON grain_transactions(type)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_grain_tx_status ON grain_transactions(status)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_grain_tx_circle ON grain_transactions(circle_transfer_id)`);
          results.push('Step 3: Created indexes on base tables');
          break;

        case 4:
          // Create circle_webhook_events table
          await client.query(`
            CREATE TABLE IF NOT EXISTS circle_webhook_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              event_id TEXT NOT NULL UNIQUE,
              event_type TEXT NOT NULL,
              payload JSONB NOT NULL,
              processed BOOLEAN DEFAULT false,
              processed_at TIMESTAMP,
              error TEXT,
              created_at TIMESTAMP DEFAULT NOW()
            )
          `);
          results.push('Step 4: Created circle_webhook_events table');
          break;

        case 5:
          // Create deposit_sessions table
          await client.query(`
            CREATE TABLE IF NOT EXISTS deposit_sessions (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              account_id UUID NOT NULL,
              amount DECIMAL(20,2) NOT NULL,
              currency TEXT DEFAULT 'USD',
              status TEXT DEFAULT 'pending',
              circle_payment_id TEXT,
              redirect_url TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
              completed_at TIMESTAMP
            )
          `);
          results.push('Step 5: Created deposit_sessions table');
          break;

        case 6:
          // Create withdrawal_requests table
          await client.query(`
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              account_id UUID NOT NULL,
              amount DECIMAL(20,2) NOT NULL,
              fee DECIMAL(20,2) DEFAULT 0,
              net_amount DECIMAL(20,2) NOT NULL,
              currency TEXT DEFAULT 'USD',
              bank_account_number_last4 TEXT,
              bank_routing_number_last4 TEXT,
              bank_account_holder_name TEXT,
              circle_payout_id TEXT,
              circle_bank_account_id TEXT,
              status TEXT DEFAULT 'pending',
              error_message TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              estimated_arrival TIMESTAMP,
              completed_at TIMESTAMP
            )
          `);
          results.push('Step 6: Created withdrawal_requests table');
          break;

        case 7:
          // Create payment_audit_log table
          await client.query(`
            CREATE TABLE IF NOT EXISTS payment_audit_log (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              account_id UUID,
              transaction_id UUID,
              action TEXT NOT NULL,
              details JSONB,
              ip_address TEXT,
              user_agent TEXT,
              created_at TIMESTAMP DEFAULT NOW()
            )
          `);
          results.push('Step 7: Created payment_audit_log table');
          break;

        case 8:
          // Create indexes on new tables
          await client.query(`CREATE INDEX IF NOT EXISTS idx_circle_events_type ON circle_webhook_events(event_type)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_circle_events_processed ON circle_webhook_events(processed)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_deposit_sessions_account ON deposit_sessions(account_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_deposit_sessions_status ON deposit_sessions(status)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_account ON withdrawal_requests(account_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_account ON payment_audit_log(account_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON payment_audit_log(action)`);
          results.push('Step 8: Created indexes on new tables');
          break;
      }
    };

    // Run specific step or all steps
    if (step > 0) {
      try {
        await runStep(step);
      } catch (e: any) {
        results.push(`Step ${step} error: ${e.message}`);
      }
    } else {
      // Run all steps
      for (let i = 1; i <= 8; i++) {
        try {
          await runStep(i);
        } catch (e: any) {
          results.push(`Step ${i} error: ${e.message}`);
        }
      }
    }

    await client.end();

    return NextResponse.json({
      success: true,
      message: step > 0 ? `Step ${step} completed` : 'All steps completed',
      results,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    try { await client.end(); } catch {}
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/migrate/grain-vault',
    method: 'POST',
    description: 'Run Grain & Vault Circle payments migration',
    auth: 'Bearer token required (ADMIN_SECRET)',
  });
}
