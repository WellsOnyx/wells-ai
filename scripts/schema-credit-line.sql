-- GRAIN Credit Line Model Schema
-- This schema supports the three-layer model:
-- 1. Protected Deposit (Cash Layer)
-- 2. Credit Line (Spending Layer)
-- 3. Appreciation (Growth Layer)

-- ============================================================================
-- CREDIT LINE POSITIONS
-- ============================================================================

-- User credit line positions
CREATE TABLE IF NOT EXISTS credit_line_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,

  -- Protected Deposit (Cash Layer)
  protected_deposit DECIMAL(20,2) NOT NULL DEFAULT 0,
  deposit_grain_price DECIMAL(20,10) NOT NULL DEFAULT 1,

  -- Credit Line (Spending Layer)
  credit_line_limit DECIMAL(24,6) NOT NULL DEFAULT 0,
  credit_line_used DECIMAL(24,6) NOT NULL DEFAULT 0,

  -- Appreciation (Growth Layer)
  appreciation_grain DECIMAL(24,6) NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit line transactions (immutable audit trail)
CREATE TABLE IF NOT EXISTS credit_line_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  position_id UUID REFERENCES credit_line_positions(id),

  -- Transaction type
  type TEXT NOT NULL, -- 'deposit', 'credit_spend', 'credit_repay', 'withdraw', 'appreciation_grant', 'appreciation_spend'

  -- Amounts
  usd_amount DECIMAL(20,2),
  grain_amount DECIMAL(24,6),
  grain_price DECIMAL(20,10) NOT NULL,

  -- Balances after transaction
  protected_deposit_after DECIMAL(20,2),
  credit_line_used_after DECIMAL(24,6),
  appreciation_after DECIMAL(24,6),

  -- Metadata
  counterparty_id TEXT,
  description TEXT,
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_credit_line_transactions_user ON credit_line_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_line_transactions_type ON credit_line_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_line_transactions_created ON credit_line_transactions(created_at);

-- ============================================================================
-- REVENUE ALLOCATION LEDGERS (LOCKED FORMULAS)
-- ============================================================================

-- Master ledgers for each allocation bucket
CREATE TABLE IF NOT EXISTS revenue_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_type TEXT UNIQUE NOT NULL, -- 'tithe', 'wells_onyx', 'liquidity', 'partners', 'founders', 'treasury'

  -- Balances
  balance DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_allocated DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_withdrawn DECIMAL(20,2) NOT NULL DEFAULT 0,

  -- Metadata
  description TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize the ledgers
INSERT INTO revenue_ledgers (ledger_type, description) VALUES
  ('tithe', '10% of all revenue to charitable giving'),
  ('wells_onyx', '30% to Wells Onyx operating expenses'),
  ('liquidity', '30% to GRAIN liquidity backing'),
  ('partners', '30% to partner commissions'),
  ('founders', '30% of float yield to founders annuity'),
  ('treasury', '30% of float yield to treasury equity')
ON CONFLICT (ledger_type) DO NOTHING;

-- Revenue allocation transactions (immutable audit trail)
CREATE TABLE IF NOT EXISTS revenue_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_type TEXT NOT NULL, -- 'wellsai_fee', 'float_yield', 'defi_interest'
  source_amount DECIMAL(20,2) NOT NULL,
  source_transaction_id UUID, -- Reference to originating transaction

  -- WellsAI Fee Splits (10% tithe, 30% wells_onyx, 30% liquidity, 30% partners)
  tithe_amount DECIMAL(20,2),
  wells_onyx_amount DECIMAL(20,2),
  liquidity_amount DECIMAL(20,2),
  partners_amount DECIMAL(20,2),

  -- Float Yield Splits (10% tithe, 30% founders, 30% wells_onyx, 30% treasury)
  founders_amount DECIMAL(20,2),
  treasury_amount DECIMAL(20,2),

  -- GRAIN price at allocation (for audit)
  grain_price_at_allocation DECIMAL(20,10),

  -- Metadata
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_allocations_source ON revenue_allocations(source_type);
CREATE INDEX IF NOT EXISTS idx_revenue_allocations_created ON revenue_allocations(created_at);

-- ============================================================================
-- FOUNDER LEDGERS
-- ============================================================================

-- Founder-specific ledgers for annuity tracking
CREATE TABLE IF NOT EXISTS founder_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id TEXT UNIQUE NOT NULL, -- 'jonah', 'jonathan'

  -- Annuity tracking
  annuity_balance DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_earned DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_withdrawn DECIMAL(20,2) NOT NULL DEFAULT 0,

  -- GRAIN position (founders can have their own credit line position)
  grain_position_id UUID REFERENCES credit_line_positions(id),

  -- Metadata
  display_name TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize founder ledgers
INSERT INTO founder_ledgers (founder_id, display_name) VALUES
  ('jonah', 'Jonah Manning'),
  ('jonathan', 'Jonathan')
ON CONFLICT (founder_id) DO NOTHING;

-- Founder annuity transactions
CREATE TABLE IF NOT EXISTS founder_annuity_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id TEXT NOT NULL REFERENCES founder_ledgers(founder_id),

  -- Transaction type
  type TEXT NOT NULL, -- 'allocation', 'withdrawal', 'reinvest_to_grain'

  -- Amount
  amount DECIMAL(20,2) NOT NULL,

  -- Balances after
  balance_after DECIMAL(20,2) NOT NULL,

  -- Source (for allocations)
  source_allocation_id UUID REFERENCES revenue_allocations(id),

  -- Metadata
  description TEXT,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founder_annuity_founder ON founder_annuity_transactions(founder_id);

-- ============================================================================
-- REAL ASSET REGISTRY
-- ============================================================================

-- Real asset tracking (commercial real estate, precious metals, etc.)
CREATE TABLE IF NOT EXISTS real_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Asset identification
  asset_type TEXT NOT NULL, -- 'commercial_real_estate', 'precious_metals', 'bonds', 'other'
  name TEXT NOT NULL,
  description TEXT,

  -- Legal
  legal_entity TEXT, -- Holding company/LLC
  external_id TEXT, -- Property ID, CUSIP, etc.

  -- Valuation
  acquisition_cost DECIMAL(20,2) NOT NULL,
  acquisition_date DATE NOT NULL,
  current_valuation DECIMAL(20,2) NOT NULL,
  last_appraisal_date DATE,
  appraisal_source TEXT, -- Appraiser name/firm

  -- Income
  monthly_income DECIMAL(20,2) DEFAULT 0,
  income_start_date DATE,

  -- Vault Integration
  equity_contribution DECIMAL(20,2) NOT NULL, -- How much this adds to equity value
  linked_transaction_id UUID, -- Acquisition transaction in Vault

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'pending', 'sold', 'impaired'

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_assets_type ON real_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_real_assets_status ON real_assets(status);

-- Asset valuation history (immutable audit trail)
CREATE TABLE IF NOT EXISTS asset_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES real_assets(id),

  -- Valuation change
  previous_value DECIMAL(20,2) NOT NULL,
  new_value DECIMAL(20,2) NOT NULL,
  change_amount DECIMAL(20,2) NOT NULL,

  -- Source
  source TEXT NOT NULL, -- 'appraisal', 'market', 'manual', 'impairment'
  appraiser TEXT,
  notes TEXT,

  -- Document reference
  supporting_document_id UUID,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_valuations_asset ON asset_valuations(asset_id);

-- Asset documents (deeds, appraisals, contracts, etc.)
CREATE TABLE IF NOT EXISTS asset_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES real_assets(id),

  -- Document info
  document_type TEXT NOT NULL, -- 'deed', 'appraisal', 'contract', 'insurance', 'other'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_hash TEXT, -- SHA-256 for verification
  file_size_bytes INTEGER,

  -- Metadata
  description TEXT,

  -- Timestamps
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_documents_asset ON asset_documents(asset_id);

-- Asset income tracking
CREATE TABLE IF NOT EXISTS asset_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES real_assets(id),

  -- Income details
  income_type TEXT NOT NULL, -- 'rent', 'dividend', 'interest', 'other'
  amount DECIMAL(20,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Revenue allocation (income flows through standard allocation)
  allocation_id UUID REFERENCES revenue_allocations(id),

  -- Metadata
  notes TEXT,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_income_asset ON asset_income(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_income_period ON asset_income(period_start, period_end);

-- ============================================================================
-- VIEWS FOR EASY ACCESS
-- ============================================================================

-- View: Credit line position summary
CREATE OR REPLACE VIEW credit_line_summary AS
SELECT
  p.user_id,
  p.protected_deposit,
  p.deposit_grain_price,
  p.credit_line_limit,
  p.credit_line_used,
  p.credit_line_limit - p.credit_line_used AS credit_line_available,
  p.appreciation_grain,
  p.status,
  p.updated_at,
  -- Calculate current USD values
  p.protected_deposit AS protected_usd,
  (p.credit_line_limit - p.credit_line_used) * p.deposit_grain_price AS available_purchasing_power_usd
FROM credit_line_positions p;

-- View: Revenue ledger summary
CREATE OR REPLACE VIEW revenue_ledger_summary AS
SELECT
  ledger_type,
  balance,
  total_allocated,
  total_withdrawn,
  updated_at
FROM revenue_ledgers
ORDER BY ledger_type;

-- View: Founder summary
CREATE OR REPLACE VIEW founder_summary AS
SELECT
  f.founder_id,
  f.display_name,
  f.annuity_balance,
  f.total_earned,
  f.total_withdrawn,
  p.protected_deposit AS grain_protected_deposit,
  p.credit_line_limit AS grain_credit_limit,
  p.appreciation_grain,
  f.updated_at
FROM founder_ledgers f
LEFT JOIN credit_line_positions p ON f.grain_position_id = p.id;

-- View: Real asset summary
CREATE OR REPLACE VIEW real_asset_summary AS
SELECT
  asset_type,
  COUNT(*) AS asset_count,
  SUM(acquisition_cost) AS total_acquisition_cost,
  SUM(current_valuation) AS total_current_value,
  SUM(current_valuation) - SUM(acquisition_cost) AS total_unrealized_gain,
  SUM(monthly_income) AS total_monthly_income,
  SUM(equity_contribution) AS total_equity_contribution
FROM real_assets
WHERE status = 'active'
GROUP BY asset_type;

-- ============================================================================
-- FUNCTIONS FOR LOCKED FORMULAS
-- ============================================================================

-- Function: Allocate WellsAI fee revenue (1% on transactions)
-- Split: 10% tithe, 30% wells_onyx, 30% liquidity, 30% partners
CREATE OR REPLACE FUNCTION allocate_wellsai_fee(
  fee_amount DECIMAL(20,2),
  source_tx_id UUID DEFAULT NULL,
  grain_price DECIMAL(20,10) DEFAULT 1
) RETURNS UUID AS $$
DECLARE
  allocation_id UUID;
  tithe_amt DECIMAL(20,2);
  wells_onyx_amt DECIMAL(20,2);
  liquidity_amt DECIMAL(20,2);
  partners_amt DECIMAL(20,2);
BEGIN
  -- Calculate splits (LOCKED FORMULA)
  tithe_amt := fee_amount * 0.10;
  wells_onyx_amt := fee_amount * 0.30;
  liquidity_amt := fee_amount * 0.30;
  partners_amt := fee_amount * 0.30;

  -- Insert allocation record
  INSERT INTO revenue_allocations (
    source_type, source_amount, source_transaction_id,
    tithe_amount, wells_onyx_amount, liquidity_amount, partners_amount,
    grain_price_at_allocation
  ) VALUES (
    'wellsai_fee', fee_amount, source_tx_id,
    tithe_amt, wells_onyx_amt, liquidity_amt, partners_amt,
    grain_price
  ) RETURNING id INTO allocation_id;

  -- Update ledger balances
  UPDATE revenue_ledgers SET
    balance = balance + tithe_amt,
    total_allocated = total_allocated + tithe_amt,
    updated_at = NOW()
  WHERE ledger_type = 'tithe';

  UPDATE revenue_ledgers SET
    balance = balance + wells_onyx_amt,
    total_allocated = total_allocated + wells_onyx_amt,
    updated_at = NOW()
  WHERE ledger_type = 'wells_onyx';

  UPDATE revenue_ledgers SET
    balance = balance + liquidity_amt,
    total_allocated = total_allocated + liquidity_amt,
    updated_at = NOW()
  WHERE ledger_type = 'liquidity';

  UPDATE revenue_ledgers SET
    balance = balance + partners_amt,
    total_allocated = total_allocated + partners_amt,
    updated_at = NOW()
  WHERE ledger_type = 'partners';

  RETURN allocation_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Allocate float yield revenue (4.5% on deposits)
-- Split: 10% tithe, 30% founders, 30% wells_onyx, 30% treasury
CREATE OR REPLACE FUNCTION allocate_float_yield(
  yield_amount DECIMAL(20,2),
  source_tx_id UUID DEFAULT NULL,
  grain_price DECIMAL(20,10) DEFAULT 1
) RETURNS UUID AS $$
DECLARE
  allocation_id UUID;
  tithe_amt DECIMAL(20,2);
  founders_amt DECIMAL(20,2);
  wells_onyx_amt DECIMAL(20,2);
  treasury_amt DECIMAL(20,2);
  jonah_amt DECIMAL(20,2);
  jonathan_amt DECIMAL(20,2);
BEGIN
  -- Calculate splits (LOCKED FORMULA)
  tithe_amt := yield_amount * 0.10;
  founders_amt := yield_amount * 0.30;
  wells_onyx_amt := yield_amount * 0.30;
  treasury_amt := yield_amount * 0.30;

  -- Founder split (50/50)
  jonah_amt := founders_amt * 0.50;
  jonathan_amt := founders_amt * 0.50;

  -- Insert allocation record
  INSERT INTO revenue_allocations (
    source_type, source_amount, source_transaction_id,
    tithe_amount, wells_onyx_amount, founders_amount, treasury_amount,
    grain_price_at_allocation
  ) VALUES (
    'float_yield', yield_amount, source_tx_id,
    tithe_amt, wells_onyx_amt, founders_amt, treasury_amt,
    grain_price
  ) RETURNING id INTO allocation_id;

  -- Update ledger balances
  UPDATE revenue_ledgers SET
    balance = balance + tithe_amt,
    total_allocated = total_allocated + tithe_amt,
    updated_at = NOW()
  WHERE ledger_type = 'tithe';

  UPDATE revenue_ledgers SET
    balance = balance + wells_onyx_amt,
    total_allocated = total_allocated + wells_onyx_amt,
    updated_at = NOW()
  WHERE ledger_type = 'wells_onyx';

  UPDATE revenue_ledgers SET
    balance = balance + treasury_amt,
    total_allocated = total_allocated + treasury_amt,
    updated_at = NOW()
  WHERE ledger_type = 'treasury';

  UPDATE revenue_ledgers SET
    balance = balance + founders_amt,
    total_allocated = total_allocated + founders_amt,
    updated_at = NOW()
  WHERE ledger_type = 'founders';

  -- Update founder individual ledgers
  UPDATE founder_ledgers SET
    annuity_balance = annuity_balance + jonah_amt,
    total_earned = total_earned + jonah_amt,
    updated_at = NOW()
  WHERE founder_id = 'jonah';

  INSERT INTO founder_annuity_transactions (founder_id, type, amount, balance_after, source_allocation_id)
  SELECT 'jonah', 'allocation', jonah_amt, annuity_balance, allocation_id
  FROM founder_ledgers WHERE founder_id = 'jonah';

  UPDATE founder_ledgers SET
    annuity_balance = annuity_balance + jonathan_amt,
    total_earned = total_earned + jonathan_amt,
    updated_at = NOW()
  WHERE founder_id = 'jonathan';

  INSERT INTO founder_annuity_transactions (founder_id, type, amount, balance_after, source_allocation_id)
  SELECT 'jonathan', 'allocation', jonathan_amt, annuity_balance, allocation_id
  FROM founder_ledgers WHERE founder_id = 'jonathan';

  RETURN allocation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update timestamp on credit_line_positions
CREATE OR REPLACE FUNCTION update_credit_line_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credit_line_positions_updated
  BEFORE UPDATE ON credit_line_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_line_timestamp();

-- Trigger: Update timestamp on real_assets
CREATE OR REPLACE FUNCTION update_real_asset_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER real_assets_updated
  BEFORE UPDATE ON real_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_real_asset_timestamp();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE credit_line_positions IS 'User credit line positions with protected deposit, credit line, and appreciation layers';
COMMENT ON TABLE credit_line_transactions IS 'Immutable audit trail of all credit line transactions';
COMMENT ON TABLE revenue_ledgers IS 'Master ledgers for revenue allocation buckets (locked formulas)';
COMMENT ON TABLE revenue_allocations IS 'Immutable audit trail of all revenue allocations';
COMMENT ON TABLE founder_ledgers IS 'Founder-specific ledgers for annuity tracking';
COMMENT ON TABLE real_assets IS 'Registry of real/analog assets owned by Grain (real estate, metals, etc.)';
COMMENT ON TABLE asset_valuations IS 'Valuation history for real assets';
COMMENT ON TABLE asset_documents IS 'Documents associated with real assets (deeds, appraisals, etc.)';

COMMENT ON FUNCTION allocate_wellsai_fee IS 'Allocates WellsAI 1% transaction fee: 10% tithe, 30% wells_onyx, 30% liquidity, 30% partners';
COMMENT ON FUNCTION allocate_float_yield IS 'Allocates 4.5% float yield: 10% tithe, 30% founders (50/50), 30% wells_onyx, 30% treasury';
