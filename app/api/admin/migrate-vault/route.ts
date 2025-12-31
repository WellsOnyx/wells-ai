/**
 * VAULT Database Migration
 * POST /api/admin/migrate-vault
 *
 * Creates the expert treasury accounting tables:
 * - vault_treasury: Master treasury ledger
 * - vault_positions: User positions (GRAIN holdings + principal)
 * - vault_acquisitions: History of how each GRAIN was acquired
 * - vault_transactions: Full audit trail
 * - vault_asset_valuations: Asset mark-to-market history
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const ADMIN_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

const VAULT_SCHEMA = `
-- Master Treasury Ledger
-- Single row that tracks the entire GRAIN ecosystem state
CREATE TABLE IF NOT EXISTS vault_treasury (
  id SERIAL PRIMARY KEY,

  -- ASSETS (What we OWN)
  asset_cash_usd DECIMAL(20, 2) DEFAULT 0,
  asset_short_term_bonds DECIMAL(20, 2) DEFAULT 0,
  asset_reits DECIMAL(20, 2) DEFAULT 0,
  asset_precious_metals_etf DECIMAL(20, 2) DEFAULT 0,
  asset_real_estate_direct DECIMAL(20, 2) DEFAULT 0,
  asset_precious_metals_direct DECIMAL(20, 2) DEFAULT 0,
  asset_other_investments DECIMAL(20, 2) DEFAULT 0,
  asset_accumulated_fees DECIMAL(20, 2) DEFAULT 0,

  -- LIABILITIES (What we OWE - the VAULT floor)
  liability_total_principal DECIMAL(20, 2) DEFAULT 0,

  -- EQUITY (What belongs to GRAIN holders collectively)
  equity_total_buy_in DECIMAL(20, 2) DEFAULT 0,
  equity_retained_earnings DECIMAL(20, 2) DEFAULT 0,
  equity_unrealized_gains DECIMAL(20, 2) DEFAULT 0,

  -- GRAIN Supply
  grain_supply DECIMAL(20, 8) DEFAULT 0,

  -- Calculated (updated on every transaction)
  total_asset_value DECIMAL(20, 2) DEFAULT 0,
  grain_price DECIMAL(16, 8) DEFAULT 1.0,
  vault_coverage DECIMAL(10, 4) DEFAULT 1.0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_audit_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Positions
-- Each user's GRAIN holdings and principal protection
CREATE TABLE IF NOT EXISTS vault_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,

  -- GRAIN Holdings
  grain_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,

  -- Vault (Principal Protection)
  total_principal DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_equity_paid DECIMAL(20, 2) NOT NULL DEFAULT 0,

  -- Calculated (updated on queries)
  current_grain_value DECIMAL(20, 2) DEFAULT 0,
  protected_floor DECIMAL(20, 2) DEFAULT 0,
  unrealized_gain DECIMAL(20, 2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GRAIN Acquisitions
-- History of how each GRAIN was acquired (for cost basis tracking)
CREATE TABLE IF NOT EXISTS vault_acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES vault_positions(user_id),

  -- Acquisition details
  type TEXT NOT NULL CHECK (type IN ('deposit', 'transfer_in', 'reward', 'dividend')),
  grain_amount DECIMAL(20, 8) NOT NULL,
  price_per_grain DECIMAL(16, 8) NOT NULL,

  -- Cost breakdown
  principal_portion DECIMAL(20, 2) NOT NULL,
  equity_portion DECIMAL(20, 2) NOT NULL,
  total_cost DECIMAL(20, 2) NOT NULL,

  -- Reference
  transaction_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vault Transactions
-- Full audit trail of every operation
CREATE TABLE IF NOT EXISTS vault_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Transaction type
  type TEXT NOT NULL CHECK (type IN (
    'deposit',
    'withdrawal_principal',
    'withdrawal_full',
    'transfer_in',
    'transfer_out',
    'fee_collection',
    'investment_return',
    'asset_revaluation'
  )),

  -- User info
  user_id TEXT,

  -- Amounts
  usd_amount DECIMAL(20, 2) NOT NULL,
  grain_amount DECIMAL(20, 8) NOT NULL DEFAULT 0,
  grain_price DECIMAL(16, 8) NOT NULL,

  -- Breakdown (for deposits)
  principal_portion DECIMAL(20, 2),
  equity_portion DECIMAL(20, 2),

  -- Asset allocation (for deposits)
  allocation_cash DECIMAL(20, 2),
  allocation_investments DECIMAL(20, 2),

  -- Balances after transaction
  user_grain_balance DECIMAL(20, 8),
  user_principal DECIMAL(20, 2),
  treasury_assets DECIMAL(20, 2) NOT NULL,
  treasury_principal DECIMAL(20, 2) NOT NULL,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset Valuations
-- Mark-to-market history for auditing
CREATE TABLE IF NOT EXISTS vault_asset_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'cash_usd',
    'short_term_bonds',
    'reits',
    'precious_metals_etf',
    'real_estate_direct',
    'precious_metals_direct',
    'other_investments'
  )),

  previous_value DECIMAL(20, 2) NOT NULL,
  new_value DECIMAL(20, 2) NOT NULL,
  change_amount DECIMAL(20, 2) NOT NULL,
  change_percent DECIMAL(10, 4),

  -- What caused the revaluation
  source TEXT NOT NULL CHECK (source IN ('appraisal', 'market', 'dividend', 'manual')),
  notes TEXT,

  -- GRAIN price after revaluation
  grain_price_after DECIMAL(16, 8) NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize treasury with starting values
INSERT INTO vault_treasury (
  grain_price,
  vault_coverage
) VALUES (1.0, 1.0)
ON CONFLICT DO NOTHING;
`

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_vault_positions_user ON vault_positions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_vault_positions_balance ON vault_positions(grain_balance DESC)',
  'CREATE INDEX IF NOT EXISTS idx_vault_acquisitions_user ON vault_acquisitions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_vault_acquisitions_type ON vault_acquisitions(type)',
  'CREATE INDEX IF NOT EXISTS idx_vault_transactions_user ON vault_transactions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_vault_transactions_type ON vault_transactions(type)',
  'CREATE INDEX IF NOT EXISTS idx_vault_transactions_created ON vault_transactions(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_vault_valuations_asset ON vault_asset_valuations(asset_type)',
  'CREATE INDEX IF NOT EXISTS idx_vault_valuations_created ON vault_asset_valuations(created_at DESC)',
]

const FUNCTIONS = `
-- Function to recalculate treasury totals
CREATE OR REPLACE FUNCTION recalculate_treasury()
RETURNS void AS $$
DECLARE
  total_assets DECIMAL(20, 2);
  grain_supply_val DECIMAL(20, 8);
  new_grain_price DECIMAL(16, 8);
  total_principal DECIMAL(20, 2);
  new_coverage DECIMAL(10, 4);
BEGIN
  -- Get current treasury row
  SELECT
    asset_cash_usd + asset_short_term_bonds + asset_reits +
    asset_precious_metals_etf + asset_real_estate_direct +
    asset_precious_metals_direct + asset_other_investments + asset_accumulated_fees,
    grain_supply,
    liability_total_principal
  INTO total_assets, grain_supply_val, total_principal
  FROM vault_treasury
  LIMIT 1;

  -- Calculate GRAIN price
  IF grain_supply_val > 0 THEN
    new_grain_price := total_assets / grain_supply_val;
  ELSE
    new_grain_price := 1.0;
  END IF;

  -- Calculate vault coverage
  IF total_principal > 0 THEN
    new_coverage := total_assets / total_principal;
  ELSE
    new_coverage := 1.0;
  END IF;

  -- Update treasury
  UPDATE vault_treasury
  SET
    total_asset_value = total_assets,
    grain_price = new_grain_price,
    vault_coverage = new_coverage,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update user position calculations
CREATE OR REPLACE FUNCTION update_position_calculations(p_user_id TEXT)
RETURNS void AS $$
DECLARE
  current_price DECIMAL(16, 8);
  user_balance DECIMAL(20, 8);
  user_principal DECIMAL(20, 2);
  user_equity_paid DECIMAL(20, 2);
BEGIN
  -- Get current GRAIN price
  SELECT grain_price INTO current_price FROM vault_treasury LIMIT 1;

  -- Get user position
  SELECT grain_balance, total_principal, total_equity_paid
  INTO user_balance, user_principal, user_equity_paid
  FROM vault_positions
  WHERE user_id = p_user_id;

  -- Update calculated fields
  UPDATE vault_positions
  SET
    current_grain_value = user_balance * current_price,
    protected_floor = user_principal,
    unrealized_gain = (user_balance * current_price) - user_principal - user_equity_paid,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate on treasury changes
CREATE OR REPLACE FUNCTION treasury_change_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_treasury();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS treasury_update_trigger ON vault_treasury;
CREATE TRIGGER treasury_update_trigger
AFTER UPDATE OF
  asset_cash_usd, asset_short_term_bonds, asset_reits,
  asset_precious_metals_etf, asset_real_estate_direct,
  asset_precious_metals_direct, asset_other_investments,
  asset_accumulated_fees, liability_total_principal, grain_supply
ON vault_treasury
FOR EACH ROW
EXECUTE FUNCTION treasury_change_trigger();
`

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
      await query(VAULT_SCHEMA)
      results.push('✅ Vault core tables created')
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

    // Run functions
    try {
      await query(FUNCTIONS)
      results.push('✅ Vault functions and triggers created')
    } catch (error: any) {
      results.push(`⚠️ Functions: ${error.message}`)
    }

    // Verify tables
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'vault_%'
      ORDER BY table_name
    `)

    // Get initial treasury state
    const treasury = await query('SELECT * FROM vault_treasury LIMIT 1')

    return NextResponse.json({
      success: true,
      message: 'Vault treasury migration complete',
      tables: tables.rows.map((r: any) => r.table_name),
      treasury: treasury.rows[0] || null,
      log: results
    })

  } catch (error: any) {
    console.error('Vault migration error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error.message
    }, { status: 500 })
  }
}
