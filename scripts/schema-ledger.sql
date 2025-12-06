-- ============================================================================
-- GRAIN & VAULT COMPREHENSIVE LEDGER SYSTEM
-- Double-entry bookkeeping with multi-currency and GRAIN token support
-- ============================================================================

-- SEQUENCE for journal numbers
CREATE SEQUENCE IF NOT EXISTS gv_journal_seq START 1;

-- ============================================================================
-- CURRENCIES - Supported currencies and tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_currencies (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  currency_type VARCHAR(20) NOT NULL CHECK (currency_type IN ('fiat', 'crypto', 'token')),
  decimal_places INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  is_base_currency BOOLEAN DEFAULT FALSE,
  blockchain VARCHAR(50),
  contract_address VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed currencies
INSERT INTO gv_currencies (code, name, symbol, currency_type, decimal_places, is_active, is_base_currency) VALUES
  ('USD', 'US Dollar', '$', 'fiat', 2, TRUE, TRUE),
  ('EUR', 'Euro', '€', 'fiat', 2, TRUE, FALSE),
  ('GBP', 'British Pound', '£', 'fiat', 2, TRUE, FALSE),
  ('CAD', 'Canadian Dollar', 'C$', 'fiat', 2, TRUE, FALSE),
  ('AUD', 'Australian Dollar', 'A$', 'fiat', 2, TRUE, FALSE),
  ('JPY', 'Japanese Yen', '¥', 'fiat', 0, TRUE, FALSE),
  ('CHF', 'Swiss Franc', 'CHF', 'fiat', 2, TRUE, FALSE),
  ('USDC', 'USD Coin', 'USDC', 'crypto', 6, TRUE, FALSE),
  ('GRAIN', 'Grain Token', 'G', 'token', 6, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- EXCHANGE RATES - Historical FX rates
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(10) NOT NULL REFERENCES gv_currencies(code),
  to_currency VARCHAR(10) NOT NULL REFERENCES gv_currencies(code),
  rate DECIMAL(20,10) NOT NULL,
  inverse_rate DECIMAL(20,10) NOT NULL,
  effective_date DATE NOT NULL,
  rate_source VARCHAR(50) NOT NULL CHECK (rate_source IN ('manual', 'api_feed', 'market_close', 'spot', 'internal')),
  source_reference VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_gv_fx_pair ON gv_exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_gv_fx_date ON gv_exchange_rates(effective_date DESC);

-- ============================================================================
-- FX MARGIN CONFIG - Programmatic markup on currency conversions
-- Users pay: Airwallex fee (~0.5%) + Grain & Vault margin (configurable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_fx_margin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Currency pair (NULL = default for all pairs)
  from_currency VARCHAR(10) REFERENCES gv_currencies(code),
  to_currency VARCHAR(10) REFERENCES gv_currencies(code),

  -- Margin rates in basis points (100bp = 1%)
  base_margin_bp INTEGER NOT NULL DEFAULT 50,       -- Default: 50bp = 0.5%
  min_margin_bp INTEGER NOT NULL DEFAULT 33,        -- Min: 33bp = 0.33%
  max_margin_bp INTEGER NOT NULL DEFAULT 100,       -- Max: 100bp = 1%

  -- Volume-based tiering (monthly volume in USD)
  tier_threshold_1 DECIMAL(20,2) DEFAULT 10000,     -- Under $10k = base margin
  tier_threshold_2 DECIMAL(20,2) DEFAULT 50000,     -- $10k-$50k = reduced margin
  tier_threshold_3 DECIMAL(20,2) DEFAULT 100000,    -- $50k-$100k = minimum margin
  -- Over $100k = negotiated rate

  tier_1_margin_bp INTEGER DEFAULT 50,              -- Default tier
  tier_2_margin_bp INTEGER DEFAULT 40,              -- Mid-volume tier
  tier_3_margin_bp INTEGER DEFAULT 33,              -- High-volume tier

  -- Provider fees (for cost tracking)
  provider_fee_bp INTEGER DEFAULT 50,               -- Airwallex ~50bp
  provider_name VARCHAR(100) DEFAULT 'airwallex',

  is_active BOOLEAN DEFAULT TRUE,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active config per currency pair
  UNIQUE NULLS NOT DISTINCT (from_currency, to_currency, is_active)
);

-- Insert default config (applies to all currency pairs)
INSERT INTO gv_fx_margin_config (
  from_currency, to_currency,
  base_margin_bp, min_margin_bp, max_margin_bp,
  provider_fee_bp, provider_name
) VALUES (
  NULL, NULL,
  50, 33, 100,
  50, 'airwallex'
) ON CONFLICT DO NOTHING;

-- FX conversion tracking (for revenue reporting)
CREATE TABLE IF NOT EXISTS gv_fx_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  journal_id UUID REFERENCES gv_ledger_journals(id),

  -- Conversion details
  from_currency VARCHAR(10) NOT NULL REFERENCES gv_currencies(code),
  to_currency VARCHAR(10) NOT NULL REFERENCES gv_currencies(code),
  from_amount DECIMAL(20,4) NOT NULL,
  to_amount DECIMAL(20,4) NOT NULL,

  -- Rates
  mid_market_rate DECIMAL(20,10) NOT NULL,          -- True market rate
  customer_rate DECIMAL(20,10) NOT NULL,            -- Rate user gets (with margin)
  rate_spread_pct DECIMAL(8,4) NOT NULL,            -- Total spread %

  -- Fee breakdown
  provider_fee_bp INTEGER NOT NULL,                 -- Airwallex cut
  platform_margin_bp INTEGER NOT NULL,              -- Grain & Vault cut
  total_spread_bp INTEGER NOT NULL,                 -- provider + platform

  -- Revenue
  provider_fee_amount DECIMAL(20,4) NOT NULL,       -- $ paid to Airwallex
  platform_margin_amount DECIMAL(20,4) NOT NULL,    -- $ revenue for G&V
  total_fee_amount DECIMAL(20,4) NOT NULL,          -- Total user pays

  -- Volume tier used
  volume_tier INTEGER DEFAULT 1,
  monthly_volume DECIMAL(20,2),

  -- External reference
  provider_tx_id VARCHAR(255),
  provider_reference JSONB,

  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gv_fx_conv_user ON gv_fx_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_gv_fx_conv_date ON gv_fx_conversions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gv_fx_conv_pair ON gv_fx_conversions(from_currency, to_currency);

-- Seed GRAIN rate (1 GRAIN = $1 initially)
INSERT INTO gv_exchange_rates (from_currency, to_currency, rate, inverse_rate, effective_date, rate_source)
VALUES ('GRAIN', 'USD', 1.000000, 1.000000, CURRENT_DATE, 'internal')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LEDGER ACCOUNTS - Chart of accounts for wallets
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR(50) NOT NULL UNIQUE,
  account_name VARCHAR(255) NOT NULL,

  account_type VARCHAR(30) NOT NULL CHECK (account_type IN (
    'asset', 'liability', 'equity', 'revenue', 'expense'
  )),

  account_subtype VARCHAR(50) CHECK (account_subtype IN (
    'user_wallet', 'platform_treasury', 'receivables', 'float_pool', 'escrow',
    'commission_receivable', 'user_liability', 'referral_payable', 'tax_payable',
    'transaction_fee', 'spread_income', 'yield_income',
    'commission_expense', 'processing_cost', 'fx_loss'
  )),

  parent_account_id UUID REFERENCES gv_ledger_accounts(id),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD' REFERENCES gv_currencies(code),
  is_grain_account BOOLEAN DEFAULT FALSE,

  normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  current_balance DECIMAL(20,4) NOT NULL DEFAULT 0,
  pending_balance DECIMAL(20,4) NOT NULL DEFAULT 0,

  owner_type VARCHAR(30) CHECK (owner_type IN ('user', 'vendor', 'platform', 'escrow', 'system')),
  owner_id VARCHAR(255),

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system_account BOOLEAN NOT NULL DEFAULT FALSE,
  allow_negative BOOLEAN NOT NULL DEFAULT FALSE,

  description TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gv_accounts_type ON gv_ledger_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_gv_accounts_owner ON gv_ledger_accounts(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_gv_accounts_currency ON gv_ledger_accounts(currency);

-- ============================================================================
-- LEDGER JOURNALS - Transaction groups (immutable once posted)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_ledger_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number VARCHAR(50) NOT NULL UNIQUE,

  journal_type VARCHAR(50) NOT NULL CHECK (journal_type IN (
    'deposit', 'withdrawal', 'transfer', 'payment', 'receipt',
    'fee_collection', 'commission_accrual', 'commission_payout',
    'fx_conversion', 'yield_accrual', 'adjustment', 'reversal', 'opening_balance'
  )),

  transaction_date DATE NOT NULL,
  posting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period VARCHAR(7) NOT NULL,
  fiscal_year INTEGER NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'reversed')),

  source_type VARCHAR(50),
  source_id UUID,
  external_reference VARCHAR(255),

  is_reversal BOOLEAN DEFAULT FALSE,
  reverses_journal_id UUID REFERENCES gv_ledger_journals(id),
  reversed_by_journal_id UUID REFERENCES gv_ledger_journals(id),

  description TEXT NOT NULL,
  memo TEXT,

  total_debits DECIMAL(20,4) NOT NULL DEFAULT 0,
  total_credits DECIMAL(20,4) NOT NULL DEFAULT 0,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  posted_by VARCHAR(255),

  CONSTRAINT journal_balance CHECK (status != 'posted' OR total_debits = total_credits)
);

CREATE INDEX IF NOT EXISTS idx_gv_journals_type ON gv_ledger_journals(journal_type);
CREATE INDEX IF NOT EXISTS idx_gv_journals_date ON gv_ledger_journals(transaction_date);
CREATE INDEX IF NOT EXISTS idx_gv_journals_status ON gv_ledger_journals(status);
CREATE INDEX IF NOT EXISTS idx_gv_journals_source ON gv_ledger_journals(source_type, source_id);

-- ============================================================================
-- LEDGER ENTRIES - Double-entry lines (debit/credit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES gv_ledger_journals(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,

  account_id UUID NOT NULL REFERENCES gv_ledger_accounts(id),
  account_code VARCHAR(50) NOT NULL,

  debit DECIMAL(20,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(20,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),

  original_currency VARCHAR(10) NOT NULL,
  original_amount DECIMAL(20,4) NOT NULL,
  exchange_rate DECIMAL(12,6) NOT NULL DEFAULT 1.000000,
  base_currency_amount DECIMAL(20,4) NOT NULL,

  grain_quantity DECIMAL(20,6),
  grain_unit_value DECIMAL(20,6),

  running_balance DECIMAL(20,4),
  description TEXT,

  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT entry_debit_xor_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0) OR (debit = 0 AND credit = 0)
  ),
  UNIQUE(journal_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_gv_entries_journal ON gv_ledger_entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_gv_entries_account ON gv_ledger_entries(account_id);

-- ============================================================================
-- USER BALANCES - Aggregated view for dashboard (denormalized for speed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- USD Balance
  usd_available DECIMAL(20,4) NOT NULL DEFAULT 0,
  usd_pending DECIMAL(20,4) NOT NULL DEFAULT 0,
  usd_total DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- GRAIN Position
  grain_quantity DECIMAL(20,6) NOT NULL DEFAULT 0,
  grain_cost_basis DECIMAL(20,4) NOT NULL DEFAULT 0,
  grain_current_value DECIMAL(20,4) NOT NULL DEFAULT 0,
  grain_appreciation DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- Credit Line (1:1 with GRAIN)
  credit_line_total DECIMAL(20,4) NOT NULL DEFAULT 0,
  credit_line_used DECIMAL(20,4) NOT NULL DEFAULT 0,
  credit_line_available DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- Network Earnings
  network_earnings_total DECIMAL(20,4) NOT NULL DEFAULT 0,
  network_earnings_pending DECIMAL(20,4) NOT NULL DEFAULT 0,
  network_earnings_this_month DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- Display currency preference
  display_currency VARCHAR(10) NOT NULL DEFAULT 'USD',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_transaction_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gv_user_balances_user ON gv_user_balances(user_id);

-- ============================================================================
-- TRANSACTIONS - User-facing transaction history
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  journal_id UUID REFERENCES gv_ledger_journals(id),

  -- Transaction Info
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'deposit', 'withdrawal', 'send', 'receive', 'convert',
    'commission', 'reward', 'fee', 'refund', 'adjustment'
  )),

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'
  )),

  -- Amounts
  amount DECIMAL(20,4) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',

  -- For conversions
  destination_amount DECIMAL(20,4),
  destination_currency VARCHAR(10),
  exchange_rate DECIMAL(12,6),

  -- Fees
  fee_amount DECIMAL(20,4) DEFAULT 0,
  fee_currency VARCHAR(10) DEFAULT 'USD',

  -- Counterparty
  counterparty_type VARCHAR(30) CHECK (counterparty_type IN ('user', 'bank', 'card', 'crypto', 'system')),
  counterparty_id TEXT,
  counterparty_name VARCHAR(255),

  -- Metadata
  description TEXT,
  category VARCHAR(50),
  reference VARCHAR(255),
  external_id VARCHAR(255),

  -- For display
  display_title VARCHAR(255),
  display_icon VARCHAR(50),

  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gv_transactions_user ON gv_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_gv_transactions_type ON gv_transactions(type);
CREATE INDEX IF NOT EXISTS idx_gv_transactions_status ON gv_transactions(status);
CREATE INDEX IF NOT EXISTS idx_gv_transactions_date ON gv_transactions(created_at DESC);

-- ============================================================================
-- BALANCE SNAPSHOTS - Daily snapshots for reporting
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,

  usd_balance DECIMAL(20,4) NOT NULL,
  grain_quantity DECIMAL(20,6) NOT NULL,
  grain_value_usd DECIMAL(20,4) NOT NULL,
  credit_used DECIMAL(20,4) NOT NULL,
  network_earnings DECIMAL(20,4) NOT NULL,
  total_portfolio_value DECIMAL(20,4) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_gv_snapshots_user_date ON gv_balance_snapshots(user_id, snapshot_date DESC);

-- ============================================================================
-- AUDIT LOG - Track all changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS gv_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by VARCHAR(255),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  session_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_gv_audit_table ON gv_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_gv_audit_record ON gv_audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_gv_audit_date ON gv_audit_log(changed_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get current GRAIN value
CREATE OR REPLACE FUNCTION gv_get_grain_value(p_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(20,6) AS $$
BEGIN
  RETURN COALESCE(
    (SELECT rate FROM gv_exchange_rates
     WHERE from_currency = 'GRAIN' AND to_currency = 'USD'
     AND effective_date <= p_date
     ORDER BY effective_date DESC LIMIT 1),
    1.000000
  );
END;
$$ LANGUAGE plpgsql;

-- Get FX margin for user based on volume tier
CREATE OR REPLACE FUNCTION gv_get_fx_margin(
  p_user_id TEXT,
  p_from_currency VARCHAR(10),
  p_to_currency VARCHAR(10)
) RETURNS TABLE (
  margin_bp INTEGER,
  provider_fee_bp INTEGER,
  total_spread_bp INTEGER,
  volume_tier INTEGER
) AS $$
DECLARE
  v_monthly_volume DECIMAL(20,2);
  v_config RECORD;
  v_margin INTEGER;
  v_tier INTEGER;
BEGIN
  -- Get user's monthly FX volume
  SELECT COALESCE(SUM(from_amount), 0) INTO v_monthly_volume
  FROM gv_fx_conversions
  WHERE user_id = p_user_id
  AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

  -- Get margin config (specific pair first, then default)
  SELECT * INTO v_config
  FROM gv_fx_margin_config
  WHERE is_active = TRUE
  AND (
    (from_currency = p_from_currency AND to_currency = p_to_currency)
    OR (from_currency IS NULL AND to_currency IS NULL)
  )
  ORDER BY from_currency NULLS LAST
  LIMIT 1;

  -- Default if no config
  IF v_config IS NULL THEN
    RETURN QUERY SELECT 50, 50, 100, 1;
    RETURN;
  END IF;

  -- Determine tier based on volume
  IF v_monthly_volume >= v_config.tier_threshold_3 THEN
    v_margin := v_config.tier_3_margin_bp;
    v_tier := 3;
  ELSIF v_monthly_volume >= v_config.tier_threshold_2 THEN
    v_margin := v_config.tier_2_margin_bp;
    v_tier := 2;
  ELSIF v_monthly_volume >= v_config.tier_threshold_1 THEN
    v_margin := v_config.tier_1_margin_bp;
    v_tier := 1;
  ELSE
    v_margin := v_config.base_margin_bp;
    v_tier := 1;
  END IF;

  RETURN QUERY SELECT
    v_margin,
    v_config.provider_fee_bp,
    v_margin + v_config.provider_fee_bp,
    v_tier;
END;
$$ LANGUAGE plpgsql;

-- Calculate customer FX rate with margin
CREATE OR REPLACE FUNCTION gv_calculate_customer_rate(
  p_user_id TEXT,
  p_from_currency VARCHAR(10),
  p_to_currency VARCHAR(10),
  p_amount DECIMAL(20,4)
) RETURNS TABLE (
  mid_market_rate DECIMAL(20,10),
  customer_rate DECIMAL(20,10),
  from_amount DECIMAL(20,4),
  to_amount DECIMAL(20,4),
  provider_fee_bp INTEGER,
  platform_margin_bp INTEGER,
  total_spread_bp INTEGER,
  provider_fee_amount DECIMAL(20,4),
  platform_margin_amount DECIMAL(20,4),
  total_fee_amount DECIMAL(20,4),
  volume_tier INTEGER
) AS $$
DECLARE
  v_mid_rate DECIMAL(20,10);
  v_margin RECORD;
  v_customer_rate DECIMAL(20,10);
  v_to_amount DECIMAL(20,4);
  v_spread_multiplier DECIMAL(10,6);
  v_fee_from_spread DECIMAL(20,4);
BEGIN
  -- Get mid-market rate
  SELECT rate INTO v_mid_rate
  FROM gv_exchange_rates
  WHERE from_currency = p_from_currency AND to_currency = p_to_currency
  AND effective_date <= CURRENT_DATE
  ORDER BY effective_date DESC LIMIT 1;

  IF v_mid_rate IS NULL THEN
    RAISE EXCEPTION 'No exchange rate found for %/%', p_from_currency, p_to_currency;
  END IF;

  -- Get margin config
  SELECT * INTO v_margin FROM gv_get_fx_margin(p_user_id, p_from_currency, p_to_currency);

  -- Calculate customer rate (worse than mid-market by spread %)
  -- spread_multiplier = 1 - (total_spread_bp / 10000)
  v_spread_multiplier := 1 - (v_margin.total_spread_bp::DECIMAL / 10000);
  v_customer_rate := v_mid_rate * v_spread_multiplier;

  -- Calculate what user receives
  v_to_amount := ROUND(p_amount * v_customer_rate, 4);

  -- Calculate fee amounts
  v_fee_from_spread := ROUND(p_amount * v_mid_rate - v_to_amount, 4);

  RETURN QUERY SELECT
    v_mid_rate,
    v_customer_rate,
    p_amount,
    v_to_amount,
    v_margin.provider_fee_bp,
    v_margin.margin_bp,
    v_margin.total_spread_bp,
    ROUND(v_fee_from_spread * (v_margin.provider_fee_bp::DECIMAL / v_margin.total_spread_bp), 4),
    ROUND(v_fee_from_spread * (v_margin.margin_bp::DECIMAL / v_margin.total_spread_bp), 4),
    v_fee_from_spread,
    v_margin.volume_tier;
END;
$$ LANGUAGE plpgsql;

-- Convert to base currency (USD)
CREATE OR REPLACE FUNCTION gv_convert_to_usd(
  p_amount DECIMAL(20,4),
  p_currency VARCHAR(10),
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS DECIMAL(20,4) AS $$
DECLARE
  v_rate DECIMAL(20,10);
BEGIN
  IF p_currency = 'USD' THEN
    RETURN p_amount;
  END IF;

  SELECT rate INTO v_rate
  FROM gv_exchange_rates
  WHERE from_currency = p_currency AND to_currency = 'USD'
  AND effective_date <= p_date
  ORDER BY effective_date DESC LIMIT 1;

  RETURN ROUND(p_amount * COALESCE(v_rate, 1), 4);
END;
$$ LANGUAGE plpgsql;

-- Update user balance (called after transactions)
CREATE OR REPLACE FUNCTION gv_update_user_balance(p_user_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_grain_value DECIMAL(20,6);
BEGIN
  v_grain_value := gv_get_grain_value();

  INSERT INTO gv_user_balances (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE gv_user_balances
  SET
    grain_current_value = grain_quantity * v_grain_value,
    grain_appreciation = (grain_quantity * v_grain_value) - grain_cost_basis,
    credit_line_total = grain_quantity * v_grain_value,
    credit_line_available = (grain_quantity * v_grain_value) - credit_line_used,
    usd_total = usd_available + usd_pending,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Prevent modification of posted journals
CREATE OR REPLACE FUNCTION gv_prevent_journal_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'posted' AND NEW.status != 'reversed' THEN
    RAISE EXCEPTION 'Cannot modify posted journal %', OLD.journal_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gv_journal_immutability ON gv_ledger_journals;
CREATE TRIGGER gv_journal_immutability
  BEFORE UPDATE ON gv_ledger_journals
  FOR EACH ROW
  EXECUTE FUNCTION gv_prevent_journal_modification();

-- Update timestamps
CREATE OR REPLACE FUNCTION gv_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gv_update_user_balances_timestamp ON gv_user_balances;
CREATE TRIGGER gv_update_user_balances_timestamp
  BEFORE UPDATE ON gv_user_balances
  FOR EACH ROW
  EXECUTE FUNCTION gv_update_timestamp();

DROP TRIGGER IF EXISTS gv_update_transactions_timestamp ON gv_transactions;
CREATE TRIGGER gv_update_transactions_timestamp
  BEFORE UPDATE ON gv_transactions
  FOR EACH ROW
  EXECUTE FUNCTION gv_update_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Dashboard summary view
CREATE OR REPLACE VIEW gv_dashboard_summary AS
SELECT
  ub.user_id,

  -- Balances
  ub.usd_available,
  ub.usd_pending,
  ub.usd_total,

  -- GRAIN
  ub.grain_quantity,
  ub.grain_current_value,
  ub.grain_appreciation,
  gv_get_grain_value() as grain_unit_price,

  -- Credit
  ub.credit_line_total,
  ub.credit_line_used,
  ub.credit_line_available,
  CASE WHEN ub.credit_line_total > 0
       THEN ROUND((ub.credit_line_used / ub.credit_line_total) * 100, 2)
       ELSE 0 END as credit_utilization_pct,

  -- Network
  ub.network_earnings_total,
  ub.network_earnings_pending,
  ub.network_earnings_this_month,

  -- Portfolio
  (ub.usd_total + ub.grain_current_value - ub.credit_line_used) as total_portfolio_value,

  -- Display
  ub.display_currency,
  ub.updated_at,
  ub.last_transaction_at

FROM gv_user_balances ub;

-- Transaction history view (for dashboard)
CREATE OR REPLACE VIEW gv_transaction_history AS
SELECT
  t.id,
  t.user_id,
  t.type,
  t.status,
  t.amount,
  t.currency,
  t.destination_amount,
  t.destination_currency,
  t.fee_amount,
  t.counterparty_name,
  t.display_title,
  t.display_icon,
  t.category,
  t.created_at,
  t.completed_at,

  -- Formatting
  CASE
    WHEN t.type IN ('deposit', 'receive', 'commission', 'reward', 'refund') THEN 'income'
    WHEN t.type IN ('withdrawal', 'send', 'fee') THEN 'expense'
    ELSE 'neutral'
  END as flow_direction,

  -- Date grouping
  CASE
    WHEN DATE(t.created_at) = CURRENT_DATE THEN 'Today'
    WHEN DATE(t.created_at) = CURRENT_DATE - 1 THEN 'Yesterday'
    WHEN DATE(t.created_at) >= CURRENT_DATE - 7 THEN 'This Week'
    WHEN DATE(t.created_at) >= DATE_TRUNC('month', CURRENT_DATE) THEN 'This Month'
    ELSE TO_CHAR(t.created_at, 'Month YYYY')
  END as date_group

FROM gv_transactions t
ORDER BY t.created_at DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- FX revenue summary view (for admin dashboard)
CREATE OR REPLACE VIEW gv_fx_revenue_summary AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as conversion_count,
  SUM(from_amount) as total_volume,
  SUM(total_fee_amount) as total_fees,
  SUM(provider_fee_amount) as provider_fees,
  SUM(platform_margin_amount) as platform_revenue,
  AVG(platform_margin_bp) as avg_margin_bp,
  ROUND(SUM(platform_margin_amount) / NULLIF(SUM(from_amount), 0) * 10000, 2) as effective_margin_bp
FROM gv_fx_conversions
WHERE status = 'completed'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Monthly FX revenue
CREATE OR REPLACE VIEW gv_fx_monthly_revenue AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  from_currency,
  to_currency,
  COUNT(*) as conversion_count,
  SUM(from_amount) as total_volume,
  SUM(platform_margin_amount) as platform_revenue,
  SUM(provider_fee_amount) as provider_cost,
  AVG(platform_margin_bp)::INTEGER as avg_margin_bp
FROM gv_fx_conversions
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', created_at), from_currency, to_currency
ORDER BY month DESC, total_volume DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE gv_currencies IS 'Supported currencies and tokens';
COMMENT ON TABLE gv_exchange_rates IS 'Historical exchange rates for multi-currency support';
COMMENT ON TABLE gv_fx_margin_config IS 'Configurable FX markup by currency pair and volume tier';
COMMENT ON TABLE gv_fx_conversions IS 'FX conversion history with fee breakdown for revenue tracking';
COMMENT ON TABLE gv_ledger_accounts IS 'Chart of accounts for double-entry bookkeeping';
COMMENT ON TABLE gv_ledger_journals IS 'Immutable transaction journals (groups of entries)';
COMMENT ON TABLE gv_ledger_entries IS 'Individual debit/credit entries within journals';
COMMENT ON TABLE gv_user_balances IS 'Denormalized user balance summary for fast dashboard queries';
COMMENT ON TABLE gv_transactions IS 'User-facing transaction history';
COMMENT ON TABLE gv_balance_snapshots IS 'Daily balance snapshots for reporting';
COMMENT ON TABLE gv_audit_log IS 'Audit trail for all ledger changes';
