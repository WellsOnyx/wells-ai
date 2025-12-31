/**
 * VAULT Database Migration
 * POST /api/admin/migrate-vault
 *
 * Creates the expert treasury accounting tables with USDC Liquidity + Equity Value model:
 * - vault_treasury: Master treasury ledger (USDC Liquidity + Equity Value)
 * - vault_positions: User positions (GRAIN holdings + principal)
 * - vault_acquisitions: History of how each GRAIN was acquired
 * - vault_transactions: Full audit trail
 * - vault_equity_valuations: Equity revaluation history
 *
 * THE VALUE EQUATION:
 *   GRAIN PRICE = (USDC Liquidity + Equity Value) / GRAIN Supply
 *
 * Where:
 *   - USDC Liquidity = Cash available for withdrawals
 *   - Equity Value = Platform valuation + Investments + WellsAI fees
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const ADMIN_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

// Initial platform valuation ($5M conservative seed stage)
const INITIAL_PLATFORM_VALUATION = 5_000_000
const INITIAL_GRAIN_SUPPLY = 5_000_000 // 5M GRAIN
const FOUNDER_POOL_PCT = 0.15 // 15%
const TREASURY_RESERVE_PCT = 0.05 // 5%

const VAULT_SCHEMA = `
-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER TREASURY LEDGER
-- Single row that tracks the entire GRAIN ecosystem state
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vault_treasury (
  id SERIAL PRIMARY KEY,

  -- ═══════════════════════════════════════════════════════════════════════════
  -- USDC LIQUIDITY (Cash - what users can withdraw)
  -- ═══════════════════════════════════════════════════════════════════════════
  liquidity_usdc_cash DECIMAL(20, 2) DEFAULT 0,        -- Instant access
  liquidity_usdc_reserve DECIMAL(20, 2) DEFAULT 0,    -- Same-day access

  -- ═══════════════════════════════════════════════════════════════════════════
  -- EQUITY VALUE (Platform + Investments + Revenue)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Platform Valuation (WellsAI + GRAIN as a company)
  equity_platform_valuation DECIMAL(20, 2) DEFAULT ${INITIAL_PLATFORM_VALUATION},
  equity_platform_valuation_date TIMESTAMPTZ DEFAULT NOW(),

  -- Investment Portfolio
  equity_real_estate DECIMAL(20, 2) DEFAULT 0,
  equity_precious_metals DECIMAL(20, 2) DEFAULT 0,
  equity_bonds DECIMAL(20, 2) DEFAULT 0,
  equity_other_investments DECIMAL(20, 2) DEFAULT 0,

  -- Accumulated Revenue
  equity_wellsai_fees DECIMAL(20, 2) DEFAULT 0,        -- 33bps from transactions
  equity_investment_income DECIMAL(20, 2) DEFAULT 0,   -- Dividends, rent, interest
  equity_unrealized_gains DECIMAL(20, 2) DEFAULT 0,    -- Paper gains

  -- ═══════════════════════════════════════════════════════════════════════════
  -- LIABILITIES (The VAULT floor - always owed to users)
  -- ═══════════════════════════════════════════════════════════════════════════
  liability_total_principal DECIMAL(20, 2) DEFAULT 0,  -- 1:1 owed to users
  liability_total_equity_buyin DECIMAL(20, 2) DEFAULT 0, -- Premium paid above base

  -- ═══════════════════════════════════════════════════════════════════════════
  -- GRAIN SUPPLY
  -- ═══════════════════════════════════════════════════════════════════════════
  grain_supply DECIMAL(20, 8) DEFAULT ${INITIAL_GRAIN_SUPPLY * (1 - FOUNDER_POOL_PCT - TREASURY_RESERVE_PCT)},
  grain_founder_pool DECIMAL(20, 8) DEFAULT ${INITIAL_GRAIN_SUPPLY * FOUNDER_POOL_PCT},
  grain_treasury_reserve DECIMAL(20, 8) DEFAULT ${INITIAL_GRAIN_SUPPLY * TREASURY_RESERVE_PCT},

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CALCULATED VALUES (updated on every transaction)
  -- ═══════════════════════════════════════════════════════════════════════════
  calc_usdc_liquidity DECIMAL(20, 2) DEFAULT 0,
  calc_equity_value DECIMAL(20, 2) DEFAULT ${INITIAL_PLATFORM_VALUATION},
  calc_total_ecosystem_value DECIMAL(20, 2) DEFAULT ${INITIAL_PLATFORM_VALUATION},
  calc_grain_price DECIMAL(16, 8) DEFAULT ${(INITIAL_PLATFORM_VALUATION / (INITIAL_GRAIN_SUPPLY * (1 - FOUNDER_POOL_PCT - TREASURY_RESERVE_PCT))).toFixed(8)},
  calc_vault_coverage DECIMAL(10, 4) DEFAULT 999999.9999,  -- Infinity until first deposit
  calc_liquidity_coverage DECIMAL(10, 4) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_audit_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- USER POSITIONS
-- Each user's GRAIN holdings and principal protection
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vault_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,

  -- GRAIN Holdings
  grain_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,

  -- Vault (Principal Protection)
  total_principal DECIMAL(20, 2) NOT NULL DEFAULT 0,   -- Always withdrawable 1:1
  total_equity_paid DECIMAL(20, 2) NOT NULL DEFAULT 0, -- Premium paid above $1 base

  -- Calculated (updated on queries)
  current_grain_value DECIMAL(20, 2) DEFAULT 0,
  protected_floor DECIMAL(20, 2) DEFAULT 0,
  unrealized_gain DECIMAL(20, 2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- GRAIN ACQUISITIONS
-- History of how each GRAIN was acquired (for cost basis tracking)
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- VAULT TRANSACTIONS
-- Full audit trail of every operation
-- ═══════════════════════════════════════════════════════════════════════════
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
    'equity_revaluation',
    'platform_valuation_update'
  )),

  -- User info
  user_id TEXT,

  -- Amounts
  usdc_amount DECIMAL(20, 2) NOT NULL,
  grain_amount DECIMAL(20, 8) NOT NULL DEFAULT 0,
  grain_price DECIMAL(16, 8) NOT NULL,

  -- Breakdown (for deposits)
  principal_portion DECIMAL(20, 2),
  equity_portion DECIMAL(20, 2),

  -- Allocation (for deposits)
  allocation_cash DECIMAL(20, 2),
  allocation_reserve DECIMAL(20, 2),

  -- Balances after transaction
  user_grain_balance DECIMAL(20, 8),
  user_principal DECIMAL(20, 2),

  -- Treasury state after transaction
  treasury_usdc_liquidity DECIMAL(20, 2) NOT NULL,
  treasury_equity_value DECIMAL(20, 2) NOT NULL,
  treasury_total_value DECIMAL(20, 2) NOT NULL,
  treasury_principal DECIMAL(20, 2) NOT NULL,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- EQUITY VALUATIONS
-- Mark-to-market history for auditing
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vault_equity_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'platform_valuation',
    'real_estate',
    'precious_metals',
    'bonds',
    'other_investments'
  )),

  previous_value DECIMAL(20, 2) NOT NULL,
  new_value DECIMAL(20, 2) NOT NULL,
  change_amount DECIMAL(20, 2) NOT NULL,
  change_percent DECIMAL(10, 4),

  -- What caused the revaluation
  source TEXT NOT NULL CHECK (source IN ('seed', 'series_a', 'series_b', 'appraisal', 'market', 'manual')),
  notes TEXT,

  -- GRAIN price after revaluation
  grain_price_after DECIMAL(16, 8) NOT NULL,
  equity_value_after DECIMAL(20, 2) NOT NULL,
  total_value_after DECIMAL(20, 2) NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize treasury with platform valuation
-- This creates the cold start state
INSERT INTO vault_treasury (
  equity_platform_valuation,
  calc_equity_value,
  calc_total_ecosystem_value,
  calc_grain_price
) VALUES (
  ${INITIAL_PLATFORM_VALUATION},
  ${INITIAL_PLATFORM_VALUATION},
  ${INITIAL_PLATFORM_VALUATION},
  ${(INITIAL_PLATFORM_VALUATION / (INITIAL_GRAIN_SUPPLY * (1 - FOUNDER_POOL_PCT - TREASURY_RESERVE_PCT))).toFixed(8)}
)
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
  'CREATE INDEX IF NOT EXISTS idx_vault_valuations_asset ON vault_equity_valuations(asset_type)',
  'CREATE INDEX IF NOT EXISTS idx_vault_valuations_created ON vault_equity_valuations(created_at DESC)',
]

const FUNCTIONS = `
-- ═══════════════════════════════════════════════════════════════════════════
-- RECALCULATE TREASURY
-- Updates all calculated fields based on current state
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION recalculate_vault_treasury()
RETURNS void AS $$
DECLARE
  usdc_liquidity DECIMAL(20, 2);
  equity_value DECIMAL(20, 2);
  total_value DECIMAL(20, 2);
  total_grain DECIMAL(20, 8);
  grain_price DECIMAL(16, 8);
  total_principal DECIMAL(20, 2);
  vault_coverage DECIMAL(10, 4);
  liquidity_coverage DECIMAL(10, 4);
BEGIN
  -- Get current values
  SELECT
    -- USDC Liquidity
    liquidity_usdc_cash + liquidity_usdc_reserve,
    -- Equity Value
    equity_platform_valuation + equity_real_estate + equity_precious_metals +
    equity_bonds + equity_other_investments + equity_wellsai_fees +
    equity_investment_income + equity_unrealized_gains,
    -- Total GRAIN supply
    grain_supply + grain_founder_pool + grain_treasury_reserve,
    -- Total principal owed
    liability_total_principal
  INTO usdc_liquidity, equity_value, total_grain, total_principal
  FROM vault_treasury
  LIMIT 1;

  -- Total ecosystem value
  total_value := usdc_liquidity + equity_value;

  -- Calculate GRAIN price
  IF total_grain > 0 THEN
    grain_price := total_value / total_grain;
  ELSE
    grain_price := 1.0;
  END IF;

  -- Calculate coverage ratios
  IF total_principal > 0 THEN
    vault_coverage := total_value / total_principal;
    liquidity_coverage := usdc_liquidity / total_principal;
  ELSE
    vault_coverage := 999999.9999;  -- Infinity
    liquidity_coverage := CASE WHEN usdc_liquidity > 0 THEN 999999.9999 ELSE 0 END;
  END IF;

  -- Update calculated fields
  UPDATE vault_treasury
  SET
    calc_usdc_liquidity = usdc_liquidity,
    calc_equity_value = equity_value,
    calc_total_ecosystem_value = total_value,
    calc_grain_price = grain_price,
    calc_vault_coverage = vault_coverage,
    calc_liquidity_coverage = liquidity_coverage,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATE USER POSITION CALCULATIONS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_vault_position_calculations(p_user_id TEXT)
RETURNS void AS $$
DECLARE
  current_price DECIMAL(16, 8);
  user_balance DECIMAL(20, 8);
  user_principal DECIMAL(20, 2);
  user_equity_paid DECIMAL(20, 2);
BEGIN
  -- Get current GRAIN price
  SELECT calc_grain_price INTO current_price FROM vault_treasury LIMIT 1;

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

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER: Recalculate on treasury changes
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION vault_treasury_change_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_vault_treasury();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vault_treasury_update_trigger ON vault_treasury;
CREATE TRIGGER vault_treasury_update_trigger
AFTER UPDATE OF
  liquidity_usdc_cash, liquidity_usdc_reserve,
  equity_platform_valuation, equity_real_estate, equity_precious_metals,
  equity_bonds, equity_other_investments, equity_wellsai_fees,
  equity_investment_income, equity_unrealized_gains,
  liability_total_principal, liability_total_equity_buyin,
  grain_supply, grain_founder_pool, grain_treasury_reserve
ON vault_treasury
FOR EACH ROW
EXECUTE FUNCTION vault_treasury_change_trigger();
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
      results.push('✅ Vault core tables created (USDC Liquidity + Equity Value model)')
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

    // Calculate cold start GRAIN price
    const coldStartPrice = INITIAL_PLATFORM_VALUATION / (INITIAL_GRAIN_SUPPLY * (1 - FOUNDER_POOL_PCT - TREASURY_RESERVE_PCT))

    return NextResponse.json({
      success: true,
      message: 'Vault treasury migration complete - USDC Liquidity + Equity Value model',
      model: {
        description: 'GRAIN PRICE = (USDC Liquidity + Equity Value) / GRAIN Supply',
        coldStart: {
          platformValuation: `$${INITIAL_PLATFORM_VALUATION.toLocaleString()}`,
          grainSupply: INITIAL_GRAIN_SUPPLY.toLocaleString(),
          founderPool: `${FOUNDER_POOL_PCT * 100}%`,
          treasuryReserve: `${TREASURY_RESERVE_PCT * 100}%`,
          circulatingSupply: (INITIAL_GRAIN_SUPPLY * (1 - FOUNDER_POOL_PCT - TREASURY_RESERVE_PCT)).toLocaleString(),
          initialGrainPrice: `$${coldStartPrice.toFixed(4)}`
        }
      },
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
