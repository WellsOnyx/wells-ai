/**
 * GRAIN Tokenomics Migration
 * POST /api/admin/migrate-grain
 *
 * Creates tables for:
 * - grain_balances: User balances
 * - grain_transactions: All transactions
 * - grain_escrow: Escrow holds (24-72hr)
 * - grain_disputes: Dispute resolution
 * - grain_treasury: Treasury tracking
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const ADMIN_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

const GRAIN_SCHEMA = `
-- User GRAIN balances
CREATE TABLE IF NOT EXISTS grain_balances (
  user_id TEXT PRIMARY KEY,
  balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_deposited_usd DECIMAL(16, 2) DEFAULT 0,
  total_withdrawn_usd DECIMAL(16, 2) DEFAULT 0,
  risk_flagged BOOLEAN DEFAULT FALSE,
  kyc_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- All GRAIN transactions
CREATE TABLE IF NOT EXISTS grain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'deposit', 'withdrawal', 'transfer_in', 'transfer_out',
    'payment', 'escrow_release', 'escrow_refund'
  )),
  amount DECIMAL(20, 8) NOT NULL,
  amount_usd DECIMAL(16, 2) NOT NULL,
  grain_rate DECIMAL(12, 8) NOT NULL DEFAULT 1.0,
  principal_portion DECIMAL(16, 2) DEFAULT 0,
  equity_portion DECIMAL(16, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'escrowed', 'completed', 'disputed', 'refunded', 'cancelled'
  )),
  escrow_release_at TIMESTAMPTZ,
  counterparty_id TEXT,
  order_id TEXT,
  external_ref TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Escrow holds (24-72hr)
CREATE TABLE IF NOT EXISTS grain_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES grain_transactions(id),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  principal_portion DECIMAL(16, 2) DEFAULT 0,
  equity_portion DECIMAL(16, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN (
    'held', 'released', 'refunded', 'disputed'
  )),
  hold_started_at TIMESTAMPTZ DEFAULT NOW(),
  release_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  dispute_id UUID,
  order_id TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dispute resolution
CREATE TABLE IF NOT EXISTS grain_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES grain_escrow(id),
  initiator_id TEXT NOT NULL,
  respondent_id TEXT NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  reason TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'resolved_sender', 'resolved_receiver',
    'split', 'escalated', 'closed'
  )),
  resolution TEXT,
  split_ratio DECIMAL(5, 4),
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Treasury tracking
CREATE TABLE IF NOT EXISTS grain_treasury (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  total_grain_supply DECIMAL(24, 8) NOT NULL,
  total_usd_reserves DECIMAL(20, 2) NOT NULL,
  grain_rate DECIMAL(12, 8) NOT NULL DEFAULT 1.0,

  -- Asset breakdown
  liquid_reserves DECIMAL(20, 2) DEFAULT 0,
  real_estate_value DECIMAL(20, 2) DEFAULT 0,
  other_assets_value DECIMAL(20, 2) DEFAULT 0,

  -- Health metrics
  collateralization_ratio DECIMAL(8, 4) DEFAULT 1.0,
  appreciation_ytd DECIMAL(8, 4) DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlement configuration
CREATE TABLE IF NOT EXISTS grain_settlement_config (
  id SERIAL PRIMARY KEY,
  escrow_hours_standard INTEGER DEFAULT 24,
  escrow_hours_high_value INTEGER DEFAULT 48,
  escrow_hours_new_user INTEGER DEFAULT 72,
  escrow_hours_flagged INTEGER DEFAULT 72,
  high_value_threshold DECIMAL(16, 2) DEFAULT 10000,
  new_user_days INTEGER DEFAULT 30,
  dispute_window_hours INTEGER DEFAULT 24,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settlement config
INSERT INTO grain_settlement_config (
  escrow_hours_standard, escrow_hours_high_value, escrow_hours_new_user,
  escrow_hours_flagged, high_value_threshold, new_user_days, dispute_window_hours
) VALUES (24, 48, 72, 72, 10000, 30, 24)
ON CONFLICT DO NOTHING;

-- Initial treasury snapshot
INSERT INTO grain_treasury (
  total_grain_supply, total_usd_reserves, grain_rate,
  liquid_reserves, collateralization_ratio
) VALUES (0, 0, 1.0, 0, 1.0)
ON CONFLICT DO NOTHING;
`

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_grain_balances_updated ON grain_balances(updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_grain_transactions_user ON grain_transactions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_grain_transactions_type ON grain_transactions(type)',
  'CREATE INDEX IF NOT EXISTS idx_grain_transactions_status ON grain_transactions(status)',
  'CREATE INDEX IF NOT EXISTS idx_grain_transactions_created ON grain_transactions(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_grain_escrow_sender ON grain_escrow(sender_id)',
  'CREATE INDEX IF NOT EXISTS idx_grain_escrow_receiver ON grain_escrow(receiver_id)',
  'CREATE INDEX IF NOT EXISTS idx_grain_escrow_status ON grain_escrow(status)',
  'CREATE INDEX IF NOT EXISTS idx_grain_escrow_release ON grain_escrow(release_at)',
  'CREATE INDEX IF NOT EXISTS idx_grain_disputes_escrow ON grain_disputes(escrow_id)',
  'CREATE INDEX IF NOT EXISTS idx_grain_disputes_status ON grain_disputes(status)',
  'CREATE INDEX IF NOT EXISTS idx_grain_treasury_snapshot ON grain_treasury(snapshot_at DESC)',
]

export async function POST(request: Request) {
  try {
    const { adminKey } = await request.json().catch(() => ({}))
    const runtimeKey = process.env.COLD_START_MASTER_KEY || ADMIN_KEY

    if (adminKey !== runtimeKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: string[] = []

    // Run main schema
    try {
      await query(GRAIN_SCHEMA)
      results.push('✅ GRAIN core tables created')
    } catch (error: any) {
      results.push(`⚠️ Core tables: ${error.message}`)
    }

    // Run indexes
    for (const idx of INDEXES) {
      try {
        await query(idx)
        results.push(`✅ ${idx.match(/idx_\w+/)?.[0] || 'index'}`)
      } catch (error: any) {
        if (error.code === '42P07' || error.message.includes('already exists')) {
          results.push(`⏭️ Index already exists`)
        } else {
          results.push(`⚠️ Index error: ${error.message}`)
        }
      }
    }

    // Verify tables
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'grain_%'
      ORDER BY table_name
    `)

    return NextResponse.json({
      success: true,
      message: 'GRAIN tokenomics migration complete',
      tables: tables.rows.map(r => r.table_name),
      log: results
    })

  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error.message
    }, { status: 500 })
  }
}
