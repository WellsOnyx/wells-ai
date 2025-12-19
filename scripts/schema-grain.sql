-- GRAIN Stablecoin Schema
-- Circle-native implementation with credit lines

-- ============================================================================
-- GRAIN TRANSACTIONS (Ledger entries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw', 'transfer', 'credit_draw', 'credit_repay', 'escrow_lock', 'escrow_release', 'fee')),
  amount DECIMAL(20, 6) NOT NULL,
  to_user_id TEXT,
  deal_id TEXT,
  reason TEXT,
  circle_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grain_transactions_user ON grain_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_grain_transactions_type ON grain_transactions(type);
CREATE INDEX IF NOT EXISTS idx_grain_transactions_status ON grain_transactions(status);
CREATE INDEX IF NOT EXISTS idx_grain_transactions_created ON grain_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grain_transactions_deal ON grain_transactions(deal_id);

-- ============================================================================
-- GRAIN CREDIT LINES
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_credit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'established', 'preferred', 'enterprise')),
  max_limit DECIMAL(20, 6) NOT NULL DEFAULT 0,
  current_balance DECIMAL(20, 6) NOT NULL DEFAULT 0,
  interest_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
  grace_period_days INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'delinquent', 'closed')),
  last_draw_date TIMESTAMP,
  last_payment_date TIMESTAMP,
  next_payment_due TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_credit_lines_user ON grain_credit_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_grain_credit_lines_status ON grain_credit_lines(status);
CREATE INDEX IF NOT EXISTS idx_grain_credit_lines_tier ON grain_credit_lines(tier);

-- ============================================================================
-- ESCROW ACCOUNTS (For deal funds)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL UNIQUE,
  buyer_user_id TEXT NOT NULL,
  supplier_user_id TEXT,
  amount DECIMAL(20, 6) NOT NULL,
  fee_amount DECIMAL(20, 6) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'refunded', 'disputed')),
  locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  released_at TIMESTAMP,
  refunded_at TIMESTAMP,
  release_conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_escrow_deal ON grain_escrow(deal_id);
CREATE INDEX IF NOT EXISTS idx_grain_escrow_buyer ON grain_escrow(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_grain_escrow_supplier ON grain_escrow(supplier_user_id);
CREATE INDEX IF NOT EXISTS idx_grain_escrow_status ON grain_escrow(status);

-- ============================================================================
-- TREASURY METRICS (Snapshots for reporting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_treasury_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  total_grain_supply DECIMAL(20, 6) NOT NULL,
  total_usdc_backing DECIMAL(20, 6) NOT NULL,
  backing_ratio DECIMAL(10, 6) NOT NULL,
  total_credit_extended DECIMAL(20, 6) NOT NULL,
  effective_leverage DECIMAL(10, 6) NOT NULL,
  active_escrow_amount DECIMAL(20, 6) NOT NULL,
  transaction_count_24h INTEGER NOT NULL,
  transaction_volume_24h DECIMAL(20, 6) NOT NULL,
  unique_users_24h INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_treasury_snapshots_date ON grain_treasury_snapshots(snapshot_date DESC);

-- ============================================================================
-- Initialize system accounts
-- ============================================================================
INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance)
VALUES
  ('WELLS_ESCROW_ACCOUNT', 'ESCROW', 'ESCROW', 0),
  ('WELLS_TREASURY', 'TREASURY', 'TREASURY', 0)
ON CONFLICT (user_id) DO NOTHING;
