-- ============================================================================
-- UNIFIED PAYMENTS SCHEMA
-- The foundation for GRAIN-first payment infrastructure
-- ============================================================================

-- ============================================================================
-- UNIFIED TRANSACTION LEDGER
-- Single source of truth for ALL transactions across WellsAI and Grain & Vault
-- ============================================================================

CREATE TABLE IF NOT EXISTS unified_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  user_id TEXT NOT NULL,              -- Initiator (payer)
  counterparty_id TEXT,               -- Recipient (can be null for deposits/withdrawals)
  counterparty_address TEXT,          -- External address (wallet, bank account)

  -- Transaction Details
  type VARCHAR(50) NOT NULL,          -- payment, transfer, escrow_fund, escrow_release, fee, payroll, refund, credit_draw, credit_repay, deposit, withdrawal, conversion
  amount DECIMAL(20, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,      -- GRAIN, USDC, USD

  -- Routing
  rail VARCHAR(20) NOT NULL,          -- grain, usdc, usd
  method VARCHAR(30) NOT NULL,        -- balance, credit_line, deposit, conversion

  -- Fees (always in GRAIN)
  fee_amount DECIMAL(20, 8) DEFAULT 0,
  fee_currency VARCHAR(10) DEFAULT 'GRAIN',

  -- Reference & Context
  reference TEXT,                     -- Deal ID, Invoice ID, Job ID, etc.
  memo TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, reversed
  error_message TEXT,

  -- GRAIN-specific
  grain_price_at_execution DECIMAL(20, 8), -- Price at time of transaction
  credit_line_draw DECIMAL(20, 8) DEFAULT 0,
  conversion_rate DECIMAL(20, 8),

  -- Escrow linkage
  escrow_id UUID,

  -- External references
  circle_transfer_id TEXT,
  stripe_payment_intent_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for unified_transactions
CREATE INDEX IF NOT EXISTS idx_unified_txn_user ON unified_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_txn_counterparty ON unified_transactions(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_unified_txn_type ON unified_transactions(type);
CREATE INDEX IF NOT EXISTS idx_unified_txn_status ON unified_transactions(status);
CREATE INDEX IF NOT EXISTS idx_unified_txn_reference ON unified_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_unified_txn_created ON unified_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_txn_rail ON unified_transactions(rail);

-- ============================================================================
-- GRAIN ESCROWS
-- Hold GRAIN for deals, disputes, milestone payments
-- Escrow appreciates with GRAIN price during lock period
-- ============================================================================

CREATE TABLE IF NOT EXISTS grain_escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  from_user_id TEXT NOT NULL,         -- Funder
  to_user_id TEXT NOT NULL,           -- Recipient

  -- Amounts
  grain_amount DECIMAL(20, 8) NOT NULL,
  grain_price_at_lock DECIMAL(20, 8) NOT NULL,
  usd_equivalent_at_lock DECIMAL(20, 2) NOT NULL,

  -- Release tracking
  released_amount DECIMAL(20, 8) DEFAULT 0,
  grain_price_at_release DECIMAL(20, 8),

  -- Conditions
  release_conditions TEXT NOT NULL,   -- Human-readable conditions
  release_date TIMESTAMPTZ,           -- Optional scheduled release
  allow_partial_release BOOLEAN DEFAULT false,

  -- Reference
  reference TEXT NOT NULL,            -- Deal ID, RFQ ID, etc.

  -- Status
  status VARCHAR(20) DEFAULT 'locked', -- locked, partial, released, disputed, refunded
  released_by TEXT,
  released_at TIMESTAMPTZ,

  -- Dispute handling
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  dispute_resolution TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_from ON grain_escrows(from_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_to ON grain_escrows(to_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_reference ON grain_escrows(reference);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON grain_escrows(status);

-- ============================================================================
-- PAYROLL BATCHES
-- Track GRAIN payroll runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS payroll_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_user_id TEXT NOT NULL,

  -- Totals
  total_grain DECIMAL(20, 8) NOT NULL,
  total_usd DECIMAL(20, 2) NOT NULL,
  grain_price DECIMAL(20, 8) NOT NULL,

  -- Counts
  entry_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failed_count INTEGER DEFAULT 0,

  -- Period
  pay_period_start DATE,
  pay_period_end DATE,

  -- Status
  status VARCHAR(20) DEFAULT 'completed',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_company ON payroll_batches(company_user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_created ON payroll_batches(created_at DESC);

-- ============================================================================
-- USER WALLETS (Enhanced)
-- GRAIN wallet for all users
-- ============================================================================

-- Ensure user_wallets exists and has correct structure
CREATE TABLE IF NOT EXISTS user_wallets (
  user_id TEXT PRIMARY KEY,
  balance DECIMAL(20, 8) DEFAULT 0,
  locked_balance DECIMAL(20, 8) DEFAULT 0,  -- In escrow
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add locked_balance if not exists
ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS locked_balance DECIMAL(20, 8) DEFAULT 0;

-- ============================================================================
-- USER BALANCES (USDC fallback)
-- For users who haven't fully moved to GRAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_balances (
  user_id TEXT PRIMARY KEY,
  usdc_balance DECIMAL(20, 8) DEFAULT 0,
  pending_deposits DECIMAL(20, 8) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GRAIN CREDIT LINES (Enhanced)
-- ============================================================================

-- Ensure table exists with all fields
CREATE TABLE IF NOT EXISTS grain_credit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Tier and limits
  tier VARCHAR(20) DEFAULT 'none',    -- none, starter, established, preferred, enterprise
  max_limit DECIMAL(20, 8) DEFAULT 0,
  current_balance DECIMAL(20, 8) DEFAULT 0, -- Amount drawn

  -- Rates
  apr DECIMAL(5, 2) DEFAULT 0,        -- Annual percentage rate

  -- Repayment
  minimum_payment DECIMAL(20, 8) DEFAULT 0,
  next_payment_due TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, closed

  -- History
  total_drawn_lifetime DECIMAL(20, 8) DEFAULT 0,
  total_repaid_lifetime DECIMAL(20, 8) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_user ON grain_credit_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tier ON grain_credit_lines(tier);

-- ============================================================================
-- UNIFIED USER IDENTITY
-- Links WellsAI users with Grain & Vault treasury accounts
-- ============================================================================

-- Add clerk_user_id to treasury_accounts if not exists
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS wellsai_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_treasury_clerk ON treasury_accounts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_treasury_wellsai ON treasury_accounts(wellsai_user_id);

-- ============================================================================
-- GRAIN ASSET HOLDINGS (Treasury backing)
-- Track all assets backing GRAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS grain_asset_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  asset_type VARCHAR(50) NOT NULL,    -- usdc, usd_cash, t_bills, fee_income, defi_yield, etc.
  symbol VARCHAR(20),

  quantity DECIMAL(20, 8) NOT NULL,
  current_value DECIMAL(20, 2) NOT NULL,

  source VARCHAR(100),                -- Where it came from
  custodian VARCHAR(100),             -- Circle, Coinbase, Bank, etc.

  -- On-chain verification
  chain VARCHAR(20),
  contract_address TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holdings_type ON grain_asset_holdings(asset_type);
CREATE INDEX IF NOT EXISTS idx_holdings_active ON grain_asset_holdings(is_active);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User's complete financial profile
CREATE OR REPLACE VIEW user_financial_profile AS
SELECT
  COALESCE(u.id, ta.id::text) as user_id,
  COALESCE(u.email, ta.email) as email,
  COALESCE(w.balance, ta.grain_balance, 0) as grain_balance,
  COALESCE(w.locked_balance, 0) as grain_locked,
  COALESCE(ub.usdc_balance, 0) as usdc_balance,
  COALESCE(cl.tier, 'none') as credit_tier,
  COALESCE(cl.max_limit, 0) as credit_limit,
  COALESCE(cl.current_balance, 0) as credit_used,
  COALESCE(cl.max_limit - cl.current_balance, 0) as credit_available,
  COALESCE(cl.apr, 0) as credit_apr,
  COALESCE(ta.verification_level, 'none') as kyc_level,
  COALESCE(ta.daily_deposit_limit, 10000) as daily_limit
FROM users u
FULL OUTER JOIN treasury_accounts ta ON ta.clerk_user_id = u.id OR ta.email = u.email
LEFT JOIN user_wallets w ON w.user_id = u.id OR w.user_id = ta.id::text
LEFT JOIN user_balances ub ON ub.user_id = u.id
LEFT JOIN grain_credit_lines cl ON cl.user_id = u.id OR cl.user_id = ta.id::text;

-- Treasury backing summary
CREATE OR REPLACE VIEW treasury_backing_summary AS
SELECT
  SUM(CASE WHEN asset_type IN ('usdc', 'usd_cash') THEN current_value ELSE 0 END) as usdc_backing,
  SUM(CASE WHEN asset_type NOT IN ('usdc', 'usd_cash') THEN current_value ELSE 0 END) as asset_value,
  SUM(current_value) as total_backing,
  (SELECT COALESCE(SUM(balance), 0) FROM user_wallets) as total_supply,
  CASE
    WHEN (SELECT COALESCE(SUM(balance), 0) FROM user_wallets) > 0
    THEN SUM(current_value) / (SELECT SUM(balance) FROM user_wallets)
    ELSE 1.0
  END as grain_price,
  COUNT(*) as asset_count
FROM grain_asset_holdings
WHERE is_active = true;

-- Daily transaction volume
CREATE OR REPLACE VIEW daily_transaction_volume AS
SELECT
  DATE(created_at) as date,
  rail,
  COUNT(*) as transaction_count,
  SUM(amount) as volume,
  SUM(fee_amount) as fees_collected,
  AVG(grain_price_at_execution) as avg_grain_price
FROM unified_transactions
WHERE status = 'completed'
GROUP BY DATE(created_at), rail
ORDER BY date DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate GRAIN price
CREATE OR REPLACE FUNCTION get_grain_price()
RETURNS DECIMAL AS $$
DECLARE
  total_backing DECIMAL;
  total_supply DECIMAL;
  price DECIMAL;
BEGIN
  SELECT COALESCE(SUM(current_value), 0) INTO total_backing
  FROM grain_asset_holdings WHERE is_active = true;

  SELECT COALESCE(SUM(balance), 0) INTO total_supply
  FROM user_wallets;

  IF total_supply > 0 THEN
    price := total_backing / total_supply;
  ELSE
    price := 1.0;
  END IF;

  -- Floor at $1.00
  RETURN GREATEST(price, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Credit a user's GRAIN wallet
CREATE OR REPLACE FUNCTION credit_grain(
  p_user_id TEXT,
  p_amount DECIMAL,
  p_source TEXT DEFAULT 'deposit'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Ensure wallet exists
  INSERT INTO user_wallets (user_id, balance, created_at, updated_at)
  VALUES (p_user_id, 0, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Credit balance
  UPDATE user_wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Debit a user's GRAIN wallet
CREATE OR REPLACE FUNCTION debit_grain(
  p_user_id TEXT,
  p_amount DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance DECIMAL;
BEGIN
  SELECT balance INTO current_balance
  FROM user_wallets WHERE user_id = p_user_id;

  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN false;
  END IF;

  UPDATE user_wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
DROP TRIGGER IF EXISTS trg_unified_txn_updated ON unified_transactions;
CREATE TRIGGER trg_unified_txn_updated
  BEFORE UPDATE ON unified_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_escrow_updated ON grain_escrows;
CREATE TRIGGER trg_escrow_updated
  BEFORE UPDATE ON grain_escrows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_wallet_updated ON user_wallets;
CREATE TRIGGER trg_wallet_updated
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE unified_transactions IS 'Single ledger for ALL transactions - GRAIN, USDC, USD across WellsAI and Grain & Vault';
COMMENT ON TABLE grain_escrows IS 'GRAIN escrows for deals - appreciates during lock period';
COMMENT ON TABLE payroll_batches IS 'GRAIN payroll runs for job marketplace';
COMMENT ON VIEW user_financial_profile IS 'Complete financial profile merging WellsAI users and treasury accounts';
COMMENT ON VIEW treasury_backing_summary IS 'Real-time GRAIN backing and price calculation';
COMMENT ON FUNCTION get_grain_price() IS 'Calculate current GRAIN price from treasury backing';
