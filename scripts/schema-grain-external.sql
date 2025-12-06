-- ============================================================================
-- GRAIN EXTERNAL LEDGER SYSTEM
-- The Ultimate Appreciating Stablecoin
-- ============================================================================
--
-- GRAIN Economics:
-- - Backed by USD reserves + HARD ASSET PORTFOLIO
-- - Appreciates through: platform fees + asset appreciation + asset income
-- - Hard assets: Manufacturing facilities, real estate, revenue-generating investments
-- - Creates MULTIPLIER EFFECT: Assets appreciate + generate income
--
-- Value Growth Mechanism:
-- - Platform earns fees (4.5% transactions, 0.5% FX margins, etc.)
-- - Net fees after operations invested into hard assets
-- - GRAIN Price = (USD Reserve + Hard Asset Value) / Circulating Supply
-- - As assets appreciate and generate income, GRAIN price rises exponentially
--
-- Backing Model:
-- - Tier 1: USD Cash Reserves (liquid, immediate redemption)
-- - Tier 2: Hard Assets (real estate, manufacturing, infrastructure)
-- - Tier 3: Asset Income (rent, dividends, operating profits)
--
-- ============================================================================

-- ============================================================================
-- GRAIN TOKEN SUPPLY & RESERVES
-- ============================================================================

-- Master GRAIN token state
CREATE TABLE IF NOT EXISTS grain_token (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Single row table

  -- Supply
  total_supply DECIMAL(20,6) NOT NULL DEFAULT 0,
  circulating_supply DECIMAL(20,6) NOT NULL DEFAULT 0,
  burned_supply DECIMAL(20,6) NOT NULL DEFAULT 0,

  -- Tier 1: USD Reserve (liquid backing)
  usd_reserve DECIMAL(20,4) NOT NULL DEFAULT 0,
  yield_reserve DECIMAL(20,4) NOT NULL DEFAULT 0,  -- Accumulated yield for distribution

  -- Tier 2: Hard Asset Portfolio (manufacturing, real estate, infrastructure)
  hard_asset_cost_basis DECIMAL(20,4) NOT NULL DEFAULT 0,    -- Original investment
  hard_asset_current_value DECIMAL(20,4) NOT NULL DEFAULT 0, -- Latest appraised value
  hard_asset_appreciation DECIMAL(20,4) NOT NULL DEFAULT 0,  -- Unrealized gains

  -- Tier 3: Asset Income (rent, dividends, operating profits)
  asset_income_ytd DECIMAL(20,4) NOT NULL DEFAULT 0,
  asset_income_total DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- Total backing = usd_reserve + hard_asset_current_value + yield_reserve
  total_backing DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- Backing breakdown (for transparency)
  liquid_backing_pct DECIMAL(5,2) NOT NULL DEFAULT 100.00,   -- % in USD cash
  hard_asset_backing_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- % in hard assets

  -- Price (calculated: total_backing / circulating_supply)
  current_price DECIMAL(20,8) NOT NULL DEFAULT 1.00000000,
  launch_price DECIMAL(20,8) NOT NULL DEFAULT 1.00000000,
  all_time_high DECIMAL(20,8) NOT NULL DEFAULT 1.00000000,

  -- Yield metrics (from platform fees + asset income)
  total_yield_distributed DECIMAL(20,4) NOT NULL DEFAULT 0,
  yield_rate_apy DECIMAL(8,4) NOT NULL DEFAULT 0,  -- Current APY

  -- Multiplier tracking (asset returns vs platform fees)
  platform_fee_income_total DECIMAL(20,4) NOT NULL DEFAULT 0,
  asset_income_multiplier DECIMAL(8,4) NOT NULL DEFAULT 1.0000, -- How much assets amplify returns

  -- Stats
  total_holders INTEGER NOT NULL DEFAULT 0,
  total_transactions BIGINT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize token
INSERT INTO grain_token (id) VALUES (1) ON CONFLICT DO NOTHING;

-- GRAIN price history (for charts)
CREATE TABLE IF NOT EXISTS grain_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price DECIMAL(20,8) NOT NULL,
  circulating_supply DECIMAL(20,6) NOT NULL,
  total_backing DECIMAL(20,4) NOT NULL,
  yield_reserve DECIMAL(20,4) NOT NULL,
  total_holders INTEGER NOT NULL,
  volume_24h DECIMAL(20,4) DEFAULT 0,

  -- Snapshot type
  snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('hourly', 'daily', 'weekly', 'monthly')),

  UNIQUE (recorded_at, snapshot_type)
);

CREATE INDEX IF NOT EXISTS idx_grain_price_date ON grain_price_history(recorded_at DESC);

-- ============================================================================
-- HARD ASSET PORTFOLIO (Manufacturing, Real Estate, Infrastructure)
-- ============================================================================

-- Asset categories
CREATE TABLE IF NOT EXISTS grain_asset_categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  target_allocation_pct DECIMAL(5,2) DEFAULT 0, -- Target % of portfolio
  max_allocation_pct DECIMAL(5,2) DEFAULT 100,  -- Max allowed %
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  liquidity_days INTEGER DEFAULT 90,  -- Days to liquidate if needed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default asset categories
INSERT INTO grain_asset_categories (id, name, description, target_allocation_pct, risk_level, liquidity_days) VALUES
  ('manufacturing', 'Manufacturing Facilities', 'Production facilities, equipment, and operations', 40, 'medium', 180),
  ('real_estate', 'Real Estate', 'Commercial and industrial properties', 35, 'low', 120),
  ('infrastructure', 'Infrastructure', 'Warehouses, logistics, distribution centers', 15, 'low', 90),
  ('equipment', 'Equipment & Machinery', 'Heavy equipment, specialized machinery', 10, 'medium', 60)
ON CONFLICT (id) DO NOTHING;

-- Individual hard assets owned by GRAIN treasury
CREATE TABLE IF NOT EXISTS grain_hard_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Asset identification
  asset_code VARCHAR(50) NOT NULL UNIQUE,  -- e.g., "MFG-001", "RE-MIAMI-01"
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id VARCHAR(50) REFERENCES grain_asset_categories(id),

  -- Asset type details
  asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN (
    'manufacturing_facility', 'production_line', 'real_estate_commercial',
    'real_estate_industrial', 'warehouse', 'distribution_center',
    'equipment', 'machinery', 'land', 'mixed_use'
  )),

  -- Location
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  country VARCHAR(50) DEFAULT 'USA',
  coordinates POINT,

  -- Acquisition
  acquired_date DATE NOT NULL,
  acquisition_cost DECIMAL(20,4) NOT NULL,
  acquisition_fees DECIMAL(20,4) DEFAULT 0,
  total_cost_basis DECIMAL(20,4) NOT NULL,  -- acquisition_cost + fees + improvements

  -- Current valuation
  current_value DECIMAL(20,4) NOT NULL,
  last_appraisal_date DATE,
  last_appraisal_value DECIMAL(20,4),
  appraiser VARCHAR(255),
  valuation_method VARCHAR(50) DEFAULT 'appraisal', -- 'appraisal', 'market_comp', 'income', 'cost'

  -- Appreciation tracking
  appreciation_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
  appreciation_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
  annual_appreciation_rate DECIMAL(8,4) DEFAULT 0,

  -- Income generation
  generates_income BOOLEAN DEFAULT TRUE,
  income_type VARCHAR(50), -- 'rent', 'operations', 'lease', 'royalty'
  expected_annual_income DECIMAL(20,4) DEFAULT 0,
  actual_ytd_income DECIMAL(20,4) DEFAULT 0,
  actual_total_income DECIMAL(20,4) DEFAULT 0,

  -- Operating metrics (for manufacturing)
  capacity_utilization_pct DECIMAL(5,2),
  operating_margin_pct DECIMAL(5,2),
  employees INTEGER,

  -- Financing (if any debt on asset)
  debt_amount DECIMAL(20,4) DEFAULT 0,
  debt_rate DECIMAL(5,4) DEFAULT 0,
  debt_maturity DATE,
  net_equity DECIMAL(20,4),  -- current_value - debt_amount

  -- Insurance and maintenance
  insured_value DECIMAL(20,4),
  insurance_annual_cost DECIMAL(20,4) DEFAULT 0,
  maintenance_annual_cost DECIMAL(20,4) DEFAULT 0,
  property_tax_annual DECIMAL(20,4) DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'under_development', 'for_sale', 'sold', 'impaired'
  )),

  -- Ownership structure
  ownership_pct DECIMAL(5,2) DEFAULT 100.00,  -- % owned by GRAIN treasury
  holding_entity VARCHAR(255),  -- LLC or entity that holds the asset

  -- Documents (links to supporting docs)
  deed_url TEXT,
  appraisal_url TEXT,
  insurance_url TEXT,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_assets_category ON grain_hard_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_grain_assets_status ON grain_hard_assets(status);
CREATE INDEX IF NOT EXISTS idx_grain_assets_value ON grain_hard_assets(current_value DESC);

-- Asset valuations history (track appreciation over time)
CREATE TABLE IF NOT EXISTS grain_asset_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES grain_hard_assets(id),

  valuation_date DATE NOT NULL,
  valuation_type VARCHAR(30) NOT NULL CHECK (valuation_type IN (
    'appraisal', 'market_comp', 'income_approach', 'cost_approach', 'internal', 'quarterly'
  )),

  -- Values
  previous_value DECIMAL(20,4),
  new_value DECIMAL(20,4) NOT NULL,
  change_amount DECIMAL(20,4),
  change_pct DECIMAL(8,4),

  -- For appraisals
  appraiser_name VARCHAR(255),
  appraiser_company VARCHAR(255),
  appraiser_license VARCHAR(100),

  -- Supporting data
  comparable_sales JSONB,  -- Comparable property sales used
  income_data JSONB,       -- NOI, cap rate for income approach
  notes TEXT,

  -- Document reference
  report_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (asset_id, valuation_date, valuation_type)
);

CREATE INDEX IF NOT EXISTS idx_grain_valuations_asset ON grain_asset_valuations(asset_id);
CREATE INDEX IF NOT EXISTS idx_grain_valuations_date ON grain_asset_valuations(valuation_date DESC);

-- Asset income records (rent, operating profits, etc.)
CREATE TABLE IF NOT EXISTS grain_asset_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES grain_hard_assets(id),

  income_date DATE NOT NULL,
  income_period VARCHAR(20) NOT NULL CHECK (income_period IN ('monthly', 'quarterly', 'annual', 'one_time')),

  -- Income details
  income_type VARCHAR(50) NOT NULL CHECK (income_type IN (
    'rent', 'lease', 'operating_profit', 'royalty', 'dividend',
    'sale_proceeds', 'refinance_cash_out', 'other'
  )),
  gross_income DECIMAL(20,4) NOT NULL,

  -- Expenses (for net calculation)
  operating_expenses DECIMAL(20,4) DEFAULT 0,
  maintenance_costs DECIMAL(20,4) DEFAULT 0,
  property_taxes DECIMAL(20,4) DEFAULT 0,
  insurance_costs DECIMAL(20,4) DEFAULT 0,
  management_fees DECIMAL(20,4) DEFAULT 0,
  debt_service DECIMAL(20,4) DEFAULT 0,

  -- Net income
  net_income DECIMAL(20,4) NOT NULL,  -- gross - all expenses

  -- Distribution to GRAIN
  distributed_to_grain BOOLEAN DEFAULT TRUE,
  distribution_amount DECIMAL(20,4),  -- Amount added to GRAIN backing
  distribution_date DATE,

  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_asset_income_asset ON grain_asset_income(asset_id);
CREATE INDEX IF NOT EXISTS idx_grain_asset_income_date ON grain_asset_income(income_date DESC);

-- Asset investments (capital deployed into assets)
CREATE TABLE IF NOT EXISTS grain_asset_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Investment details
  investment_date DATE NOT NULL,
  investment_type VARCHAR(30) NOT NULL CHECK (investment_type IN (
    'acquisition', 'improvement', 'expansion', 'equipment', 'maintenance_capex', 'development'
  )),

  -- Source of funds
  source VARCHAR(50) NOT NULL CHECK (source IN (
    'platform_fees', 'asset_income', 'debt_financing', 'equity_raise', 'refinance'
  )),
  amount DECIMAL(20,4) NOT NULL,

  -- Asset reference (NULL if new acquisition)
  asset_id UUID REFERENCES grain_hard_assets(id),
  new_asset_code VARCHAR(50),  -- For new acquisitions

  -- Impact on GRAIN
  reduces_usd_reserve BOOLEAN DEFAULT TRUE,  -- Did this reduce USD backing?
  usd_reserve_impact DECIMAL(20,4),           -- Amount removed from USD reserve
  expected_return_pct DECIMAL(8,4),           -- Expected annual return

  description TEXT,
  approved_by VARCHAR(255),
  approval_date DATE,

  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_investments_date ON grain_asset_investments(investment_date DESC);
CREATE INDEX IF NOT EXISTS idx_grain_investments_asset ON grain_asset_investments(asset_id);

-- Portfolio summary view (real-time portfolio metrics)
CREATE OR REPLACE VIEW grain_asset_portfolio AS
SELECT
  COUNT(*) as total_assets,
  SUM(total_cost_basis) as total_cost_basis,
  SUM(current_value) as total_current_value,
  SUM(appreciation_amount) as total_appreciation,
  ROUND(SUM(appreciation_amount) / NULLIF(SUM(total_cost_basis), 0) * 100, 2) as appreciation_pct,
  SUM(debt_amount) as total_debt,
  SUM(net_equity) as total_net_equity,
  SUM(expected_annual_income) as expected_annual_income,
  SUM(actual_ytd_income) as actual_ytd_income,
  ROUND(SUM(actual_ytd_income) / NULLIF(SUM(total_cost_basis), 0) * 100, 2) as income_yield_pct
FROM grain_hard_assets
WHERE status = 'active';

-- Portfolio by category view
CREATE OR REPLACE VIEW grain_portfolio_by_category AS
SELECT
  gc.id as category_id,
  gc.name as category_name,
  COUNT(gha.id) as asset_count,
  COALESCE(SUM(gha.total_cost_basis), 0) as cost_basis,
  COALESCE(SUM(gha.current_value), 0) as current_value,
  COALESCE(SUM(gha.appreciation_amount), 0) as appreciation,
  COALESCE(SUM(gha.actual_ytd_income), 0) as ytd_income,
  gc.target_allocation_pct,
  ROUND(COALESCE(SUM(gha.current_value), 0) / NULLIF((SELECT SUM(current_value) FROM grain_hard_assets WHERE status = 'active'), 0) * 100, 2) as actual_allocation_pct
FROM grain_asset_categories gc
LEFT JOIN grain_hard_assets gha ON gc.id = gha.category_id AND gha.status = 'active'
GROUP BY gc.id, gc.name, gc.target_allocation_pct;

-- ============================================================================
-- EXTERNAL GRAIN WALLETS
-- ============================================================================

-- External wallet holders (not G&V internal users)
CREATE TABLE IF NOT EXISTS grain_external_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Wallet identification
  wallet_address VARCHAR(100) NOT NULL UNIQUE,  -- Public wallet address (generated)
  wallet_type VARCHAR(30) NOT NULL CHECK (wallet_type IN (
    'individual', 'business', 'exchange', 'custodian', 'protocol', 'treasury'
  )),

  -- Owner info (optional for anonymous wallets)
  email VARCHAR(255),
  name VARCHAR(255),
  company VARCHAR(255),

  -- KYC status (for large transactions)
  kyc_status VARCHAR(20) DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'verified', 'rejected')),
  kyc_tier INTEGER DEFAULT 0,  -- 0=none, 1=basic, 2=full
  kyc_verified_at TIMESTAMPTZ,

  -- Balance
  grain_balance DECIMAL(20,6) NOT NULL DEFAULT 0,
  grain_locked DECIMAL(20,6) NOT NULL DEFAULT 0,   -- In pending transactions
  grain_available DECIMAL(20,6) NOT NULL DEFAULT 0,

  -- Cost basis tracking (for tax reporting)
  total_cost_basis_usd DECIMAL(20,4) NOT NULL DEFAULT 0,
  average_cost_per_grain DECIMAL(20,8) NOT NULL DEFAULT 0,

  -- Yield tracking
  total_yield_earned DECIMAL(20,4) NOT NULL DEFAULT 0,
  unclaimed_yield DECIMAL(20,4) NOT NULL DEFAULT 0,
  yield_auto_compound BOOLEAN DEFAULT TRUE,  -- Auto-reinvest yield into GRAIN

  -- API access
  api_key_hash VARCHAR(255),
  api_enabled BOOLEAN DEFAULT FALSE,
  api_rate_limit INTEGER DEFAULT 100,  -- Requests per minute

  -- Limits
  daily_withdrawal_limit DECIMAL(20,4) DEFAULT 10000,  -- Based on KYC tier
  monthly_withdrawal_limit DECIMAL(20,4) DEFAULT 100000,

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grain_wallet_address ON grain_external_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_grain_wallet_email ON grain_external_wallets(email);
CREATE INDEX IF NOT EXISTS idx_grain_wallet_balance ON grain_external_wallets(grain_balance DESC);

-- ============================================================================
-- GRAIN TRANSACTIONS LEDGER
-- ============================================================================

-- All GRAIN movements
CREATE TABLE IF NOT EXISTS grain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash VARCHAR(100) NOT NULL UNIQUE,  -- Transaction hash for reference

  -- Transaction type
  tx_type VARCHAR(30) NOT NULL CHECK (tx_type IN (
    'mint',           -- New GRAIN created (deposit USD)
    'burn',           -- GRAIN destroyed (withdraw USD)
    'transfer',       -- Wallet to wallet
    'yield_credit',   -- Yield distribution
    'yield_compound', -- Yield auto-compounded
    'fee',            -- Transaction fee
    'adjustment'      -- Manual adjustment
  )),

  -- Parties
  from_wallet_id UUID REFERENCES grain_external_wallets(id),
  from_address VARCHAR(100),
  to_wallet_id UUID REFERENCES grain_external_wallets(id),
  to_address VARCHAR(100),

  -- Amounts
  grain_amount DECIMAL(20,6) NOT NULL,
  usd_value DECIMAL(20,4) NOT NULL,  -- USD value at time of transaction
  grain_price DECIMAL(20,8) NOT NULL, -- GRAIN price at time of transaction

  -- For mint/burn
  usd_deposited DECIMAL(20,4),
  usd_withdrawn DECIMAL(20,4),

  -- Fees
  fee_grain DECIMAL(20,6) DEFAULT 0,
  fee_usd DECIMAL(20,4) DEFAULT 0,
  fee_rate DECIMAL(8,6) DEFAULT 0,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'failed', 'reversed'
  )),

  -- External references
  external_tx_id VARCHAR(255),  -- Bank transfer, card payment, etc.
  payment_method VARCHAR(50),   -- 'bank_transfer', 'card', 'crypto', 'internal'

  memo TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grain_tx_hash ON grain_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_grain_tx_from ON grain_transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_grain_tx_to ON grain_transactions(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_grain_tx_type ON grain_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_grain_tx_date ON grain_transactions(created_at DESC);

-- ============================================================================
-- YIELD DISTRIBUTION SYSTEM
-- ============================================================================

-- Platform fee income tracking (feeds into GRAIN yield)
CREATE TABLE IF NOT EXISTS grain_yield_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Platform Income Sources
  transaction_fees DECIMAL(20,4) NOT NULL DEFAULT 0,      -- 4.5% platform fee
  fx_margin_income DECIMAL(20,4) NOT NULL DEFAULT 0,      -- FX spread income
  credit_line_interest DECIMAL(20,4) NOT NULL DEFAULT 0,  -- Interest on credit
  treasury_yield DECIMAL(20,4) NOT NULL DEFAULT 0,        -- Yield from cash reserves
  other_platform_income DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- Hard Asset Income Sources (MULTIPLIER EFFECT)
  manufacturing_income DECIMAL(20,4) NOT NULL DEFAULT 0,  -- Operating profits from manufacturing
  real_estate_income DECIMAL(20,4) NOT NULL DEFAULT 0,    -- Rent, lease payments
  infrastructure_income DECIMAL(20,4) NOT NULL DEFAULT 0, -- Warehouse/logistics income
  equipment_income DECIMAL(20,4) NOT NULL DEFAULT 0,      -- Equipment lease income
  asset_sale_gains DECIMAL(20,4) NOT NULL DEFAULT 0,      -- Capital gains from asset sales

  -- Asset Appreciation (unrealized gains add to backing)
  asset_appreciation DECIMAL(20,4) NOT NULL DEFAULT 0,    -- Quarterly asset revaluations

  -- Totals
  gross_platform_income DECIMAL(20,4) NOT NULL DEFAULT 0,
  gross_asset_income DECIMAL(20,4) NOT NULL DEFAULT 0,
  gross_income DECIMAL(20,4) NOT NULL DEFAULT 0,          -- Platform + Asset income
  operating_costs DECIMAL(20,4) NOT NULL DEFAULT 0,
  net_income DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- Distribution (after operating costs)
  to_grain_reserve_pct DECIMAL(5,2) NOT NULL DEFAULT 30,   -- % of net income to GRAIN yield
  to_grain_reserve_amt DECIMAL(20,4) NOT NULL DEFAULT 0,
  to_hard_asset_investment_pct DECIMAL(5,2) NOT NULL DEFAULT 50,  -- % invested into assets
  to_hard_asset_investment_amt DECIMAL(20,4) NOT NULL DEFAULT 0,
  to_operations_pct DECIMAL(5,2) NOT NULL DEFAULT 20,       -- % for operations
  to_operations_amt DECIMAL(20,4) NOT NULL DEFAULT 0,

  -- Multiplier tracking
  asset_income_vs_platform DECIMAL(8,4),  -- Asset income / Platform income ratio
  cumulative_multiplier DECIMAL(8,4),     -- Total returns / Original investment

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'distributed')),
  distributed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (period_start, period_end)
);

-- Individual yield distributions
CREATE TABLE IF NOT EXISTS grain_yield_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Distribution batch
  distribution_id VARCHAR(50) NOT NULL,
  distribution_date DATE NOT NULL,

  -- Wallet
  wallet_id UUID NOT NULL REFERENCES grain_external_wallets(id),
  wallet_address VARCHAR(100) NOT NULL,

  -- Calculation
  grain_balance_snapshot DECIMAL(20,6) NOT NULL,
  supply_percentage DECIMAL(12,8) NOT NULL,  -- Wallet's % of total supply

  -- Yield
  yield_pool_total DECIMAL(20,4) NOT NULL,
  yield_amount_usd DECIMAL(20,4) NOT NULL,
  yield_amount_grain DECIMAL(20,6) NOT NULL, -- Converted to GRAIN at current price

  -- Distribution method
  auto_compounded BOOLEAN NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'failed')),
  credited_at TIMESTAMPTZ,
  tx_id UUID REFERENCES grain_transactions(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_yield_dist_wallet ON grain_yield_distributions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_grain_yield_dist_date ON grain_yield_distributions(distribution_date DESC);

-- ============================================================================
-- API ACCESS & INTEGRATIONS
-- ============================================================================

-- API keys for external integrations
CREATE TABLE IF NOT EXISTS grain_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES grain_external_wallets(id),

  key_prefix VARCHAR(20) NOT NULL,  -- First 8 chars for identification
  key_hash VARCHAR(255) NOT NULL,   -- Hashed full key

  name VARCHAR(255) NOT NULL,

  -- Permissions
  can_read BOOLEAN DEFAULT TRUE,
  can_transfer BOOLEAN DEFAULT FALSE,
  can_mint_burn BOOLEAN DEFAULT FALSE,

  -- Limits
  rate_limit INTEGER DEFAULT 100,
  daily_transfer_limit DECIMAL(20,4),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_api_prefix ON grain_api_keys(key_prefix);

-- Webhook subscriptions for integrations
CREATE TABLE IF NOT EXISTS grain_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES grain_external_wallets(id),

  url VARCHAR(500) NOT NULL,
  secret_hash VARCHAR(255) NOT NULL,

  -- Events to notify
  events TEXT[] DEFAULT ARRAY['transfer', 'yield', 'price_change'],

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate unique wallet address
CREATE OR REPLACE FUNCTION grain_generate_wallet_address()
RETURNS VARCHAR(100) AS $$
DECLARE
  v_address VARCHAR(100);
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate address: GRAIN-XXXX-XXXX-XXXX-XXXX
    v_address := 'GRAIN-' ||
      UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
      UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
      UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
      UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    SELECT EXISTS(SELECT 1 FROM grain_external_wallets WHERE wallet_address = v_address) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_address;
END;
$$ LANGUAGE plpgsql;

-- Generate transaction hash
CREATE OR REPLACE FUNCTION grain_generate_tx_hash()
RETURNS VARCHAR(100) AS $$
BEGIN
  RETURN 'GTX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 16));
END;
$$ LANGUAGE plpgsql;

-- Calculate current GRAIN price (includes USD reserves + hard assets)
CREATE OR REPLACE FUNCTION grain_calculate_price()
RETURNS DECIMAL(20,8) AS $$
DECLARE
  v_token RECORD;
  v_hard_asset_value DECIMAL(20,4);
  v_total_backing DECIMAL(20,4);
BEGIN
  SELECT * INTO v_token FROM grain_token WHERE id = 1;

  IF v_token.circulating_supply = 0 THEN
    RETURN 1.00000000;
  END IF;

  -- Get current hard asset portfolio value
  SELECT COALESCE(SUM(net_equity), 0) INTO v_hard_asset_value
  FROM grain_hard_assets WHERE status = 'active';

  -- Total backing = USD reserve + yield reserve + hard asset value
  v_total_backing := v_token.usd_reserve + v_token.yield_reserve + v_hard_asset_value;

  -- Update token with current values
  UPDATE grain_token SET
    hard_asset_current_value = v_hard_asset_value,
    total_backing = v_total_backing,
    liquid_backing_pct = CASE WHEN v_total_backing > 0 THEN ROUND(v_token.usd_reserve / v_total_backing * 100, 2) ELSE 100 END,
    hard_asset_backing_pct = CASE WHEN v_total_backing > 0 THEN ROUND(v_hard_asset_value / v_total_backing * 100, 2) ELSE 0 END
  WHERE id = 1;

  RETURN ROUND(v_total_backing / v_token.circulating_supply, 8);
END;
$$ LANGUAGE plpgsql;

-- Sync total backing from all sources
CREATE OR REPLACE FUNCTION grain_sync_backing()
RETURNS VOID AS $$
DECLARE
  v_usd_reserve DECIMAL(20,4);
  v_yield_reserve DECIMAL(20,4);
  v_hard_asset_value DECIMAL(20,4);
  v_hard_asset_cost DECIMAL(20,4);
  v_total_backing DECIMAL(20,4);
  v_circulating DECIMAL(20,6);
BEGIN
  -- Get token reserves
  SELECT usd_reserve, yield_reserve, circulating_supply
  INTO v_usd_reserve, v_yield_reserve, v_circulating
  FROM grain_token WHERE id = 1;

  -- Get hard asset totals
  SELECT
    COALESCE(SUM(total_cost_basis), 0),
    COALESCE(SUM(net_equity), 0)
  INTO v_hard_asset_cost, v_hard_asset_value
  FROM grain_hard_assets WHERE status = 'active';

  v_total_backing := v_usd_reserve + v_yield_reserve + v_hard_asset_value;

  -- Update token state
  UPDATE grain_token SET
    hard_asset_cost_basis = v_hard_asset_cost,
    hard_asset_current_value = v_hard_asset_value,
    hard_asset_appreciation = v_hard_asset_value - v_hard_asset_cost,
    total_backing = v_total_backing,
    current_price = CASE WHEN v_circulating > 0 THEN v_total_backing / v_circulating ELSE 1 END,
    liquid_backing_pct = CASE WHEN v_total_backing > 0 THEN ROUND(v_usd_reserve / v_total_backing * 100, 2) ELSE 100 END,
    hard_asset_backing_pct = CASE WHEN v_total_backing > 0 THEN ROUND(v_hard_asset_value / v_total_backing * 100, 2) ELSE 0 END,
    updated_at = NOW()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- Mint new GRAIN (deposit USD)
CREATE OR REPLACE FUNCTION grain_mint(
  p_wallet_id UUID,
  p_usd_amount DECIMAL(20,4),
  p_external_tx_id VARCHAR(255) DEFAULT NULL,
  p_payment_method VARCHAR(50) DEFAULT 'bank_transfer'
)
RETURNS TABLE (
  tx_hash VARCHAR(100),
  grain_minted DECIMAL(20,6),
  new_balance DECIMAL(20,6),
  price_per_grain DECIMAL(20,8)
) AS $$
DECLARE
  v_price DECIMAL(20,8);
  v_grain_amount DECIMAL(20,6);
  v_tx_hash VARCHAR(100);
  v_wallet RECORD;
BEGIN
  -- Get current price
  v_price := grain_calculate_price();

  -- Calculate GRAIN to mint
  v_grain_amount := ROUND(p_usd_amount / v_price, 6);

  -- Generate tx hash
  v_tx_hash := grain_generate_tx_hash();

  -- Update token supply
  UPDATE grain_token SET
    total_supply = total_supply + v_grain_amount,
    circulating_supply = circulating_supply + v_grain_amount,
    usd_reserve = usd_reserve + p_usd_amount,
    total_backing = total_backing + p_usd_amount,
    current_price = grain_calculate_price(),
    total_transactions = total_transactions + 1,
    updated_at = NOW()
  WHERE id = 1;

  -- Update wallet balance
  UPDATE grain_external_wallets SET
    grain_balance = grain_balance + v_grain_amount,
    grain_available = grain_available + v_grain_amount,
    total_cost_basis_usd = total_cost_basis_usd + p_usd_amount,
    average_cost_per_grain = CASE
      WHEN grain_balance + v_grain_amount > 0
      THEN (total_cost_basis_usd + p_usd_amount) / (grain_balance + v_grain_amount)
      ELSE v_price
    END,
    updated_at = NOW(),
    last_activity_at = NOW()
  WHERE id = p_wallet_id
  RETURNING * INTO v_wallet;

  -- Record transaction
  INSERT INTO grain_transactions (
    tx_hash, tx_type, to_wallet_id, to_address,
    grain_amount, usd_value, grain_price,
    usd_deposited, status, external_tx_id, payment_method, confirmed_at
  ) VALUES (
    v_tx_hash, 'mint', p_wallet_id, v_wallet.wallet_address,
    v_grain_amount, p_usd_amount, v_price,
    p_usd_amount, 'confirmed', p_external_tx_id, p_payment_method, NOW()
  );

  RETURN QUERY SELECT v_tx_hash, v_grain_amount, v_wallet.grain_balance, v_price;
END;
$$ LANGUAGE plpgsql;

-- Burn GRAIN (withdraw USD)
CREATE OR REPLACE FUNCTION grain_burn(
  p_wallet_id UUID,
  p_grain_amount DECIMAL(20,6)
)
RETURNS TABLE (
  tx_hash VARCHAR(100),
  usd_withdrawn DECIMAL(20,4),
  grain_burned DECIMAL(20,6),
  new_balance DECIMAL(20,6)
) AS $$
DECLARE
  v_price DECIMAL(20,8);
  v_usd_amount DECIMAL(20,4);
  v_tx_hash VARCHAR(100);
  v_wallet RECORD;
BEGIN
  -- Check balance
  SELECT * INTO v_wallet FROM grain_external_wallets WHERE id = p_wallet_id;
  IF v_wallet.grain_available < p_grain_amount THEN
    RAISE EXCEPTION 'Insufficient GRAIN balance';
  END IF;

  -- Get current price
  v_price := grain_calculate_price();

  -- Calculate USD to withdraw
  v_usd_amount := ROUND(p_grain_amount * v_price, 4);

  -- Generate tx hash
  v_tx_hash := grain_generate_tx_hash();

  -- Update token supply
  UPDATE grain_token SET
    circulating_supply = circulating_supply - p_grain_amount,
    burned_supply = burned_supply + p_grain_amount,
    usd_reserve = usd_reserve - v_usd_amount,
    total_backing = total_backing - v_usd_amount,
    current_price = grain_calculate_price(),
    total_transactions = total_transactions + 1,
    updated_at = NOW()
  WHERE id = 1;

  -- Update wallet balance
  UPDATE grain_external_wallets SET
    grain_balance = grain_balance - p_grain_amount,
    grain_available = grain_available - p_grain_amount,
    updated_at = NOW(),
    last_activity_at = NOW()
  WHERE id = p_wallet_id
  RETURNING * INTO v_wallet;

  -- Record transaction
  INSERT INTO grain_transactions (
    tx_hash, tx_type, from_wallet_id, from_address,
    grain_amount, usd_value, grain_price,
    usd_withdrawn, status, confirmed_at
  ) VALUES (
    v_tx_hash, 'burn', p_wallet_id, v_wallet.wallet_address,
    p_grain_amount, v_usd_amount, v_price,
    v_usd_amount, 'confirmed', NOW()
  );

  RETURN QUERY SELECT v_tx_hash, v_usd_amount, p_grain_amount, v_wallet.grain_balance;
END;
$$ LANGUAGE plpgsql;

-- Transfer GRAIN between wallets
CREATE OR REPLACE FUNCTION grain_transfer(
  p_from_wallet_id UUID,
  p_to_wallet_id UUID,
  p_grain_amount DECIMAL(20,6),
  p_memo TEXT DEFAULT NULL
)
RETURNS TABLE (
  tx_hash VARCHAR(100),
  grain_transferred DECIMAL(20,6),
  fee_grain DECIMAL(20,6),
  from_new_balance DECIMAL(20,6),
  to_new_balance DECIMAL(20,6)
) AS $$
DECLARE
  v_price DECIMAL(20,8);
  v_tx_hash VARCHAR(100);
  v_fee DECIMAL(20,6);
  v_net_amount DECIMAL(20,6);
  v_from_wallet RECORD;
  v_to_wallet RECORD;
BEGIN
  -- Check balance
  SELECT * INTO v_from_wallet FROM grain_external_wallets WHERE id = p_from_wallet_id;
  IF v_from_wallet.grain_available < p_grain_amount THEN
    RAISE EXCEPTION 'Insufficient GRAIN balance';
  END IF;

  -- Calculate fee (0.1% transfer fee)
  v_fee := ROUND(p_grain_amount * 0.001, 6);
  v_net_amount := p_grain_amount - v_fee;

  -- Get current price
  v_price := grain_calculate_price();
  v_tx_hash := grain_generate_tx_hash();

  -- Update from wallet
  UPDATE grain_external_wallets SET
    grain_balance = grain_balance - p_grain_amount,
    grain_available = grain_available - p_grain_amount,
    updated_at = NOW(),
    last_activity_at = NOW()
  WHERE id = p_from_wallet_id
  RETURNING * INTO v_from_wallet;

  -- Update to wallet
  UPDATE grain_external_wallets SET
    grain_balance = grain_balance + v_net_amount,
    grain_available = grain_available + v_net_amount,
    updated_at = NOW(),
    last_activity_at = NOW()
  WHERE id = p_to_wallet_id
  RETURNING * INTO v_to_wallet;

  -- Fee goes to yield reserve
  UPDATE grain_token SET
    yield_reserve = yield_reserve + (v_fee * v_price),
    total_backing = total_backing + (v_fee * v_price),
    total_transactions = total_transactions + 1,
    updated_at = NOW()
  WHERE id = 1;

  -- Burn the fee (reduce supply, increase price for all holders)
  UPDATE grain_token SET
    circulating_supply = circulating_supply - v_fee,
    burned_supply = burned_supply + v_fee,
    current_price = grain_calculate_price()
  WHERE id = 1;

  -- Record transaction
  INSERT INTO grain_transactions (
    tx_hash, tx_type,
    from_wallet_id, from_address,
    to_wallet_id, to_address,
    grain_amount, usd_value, grain_price,
    fee_grain, fee_usd, fee_rate,
    status, memo, confirmed_at
  ) VALUES (
    v_tx_hash, 'transfer',
    p_from_wallet_id, v_from_wallet.wallet_address,
    p_to_wallet_id, v_to_wallet.wallet_address,
    v_net_amount, v_net_amount * v_price, v_price,
    v_fee, v_fee * v_price, 0.001,
    'confirmed', p_memo, NOW()
  );

  RETURN QUERY SELECT v_tx_hash, v_net_amount, v_fee, v_from_wallet.grain_balance, v_to_wallet.grain_balance;
END;
$$ LANGUAGE plpgsql;

-- Add yield to reserve (called when platform earns fees)
CREATE OR REPLACE FUNCTION grain_add_yield(
  p_amount DECIMAL(20,4),
  p_source VARCHAR(50) DEFAULT 'platform_fees'
)
RETURNS DECIMAL(20,8) AS $$
DECLARE
  v_new_price DECIMAL(20,8);
BEGIN
  UPDATE grain_token SET
    yield_reserve = yield_reserve + p_amount,
    total_backing = total_backing + p_amount,
    platform_fee_income_total = platform_fee_income_total + CASE WHEN p_source = 'platform_fees' THEN p_amount ELSE 0 END,
    current_price = grain_calculate_price(),
    updated_at = NOW()
  WHERE id = 1
  RETURNING current_price INTO v_new_price;

  -- Update all-time high if needed
  UPDATE grain_token SET
    all_time_high = GREATEST(all_time_high, v_new_price)
  WHERE id = 1;

  RETURN v_new_price;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HARD ASSET MANAGEMENT FUNCTIONS
-- ============================================================================

-- Register a new hard asset (acquisition)
CREATE OR REPLACE FUNCTION grain_register_asset(
  p_asset_code VARCHAR(50),
  p_name VARCHAR(255),
  p_category_id VARCHAR(50),
  p_asset_type VARCHAR(50),
  p_acquisition_cost DECIMAL(20,4),
  p_acquisition_fees DECIMAL(20,4) DEFAULT 0,
  p_address TEXT DEFAULT NULL,
  p_city VARCHAR(100) DEFAULT NULL,
  p_state VARCHAR(50) DEFAULT NULL,
  p_expected_annual_income DECIMAL(20,4) DEFAULT 0,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  asset_id UUID,
  total_cost_basis DECIMAL(20,4),
  new_grain_price DECIMAL(20,8),
  new_total_backing DECIMAL(20,4)
) AS $$
DECLARE
  v_asset_id UUID;
  v_cost_basis DECIMAL(20,4);
  v_new_price DECIMAL(20,8);
BEGIN
  v_cost_basis := p_acquisition_cost + p_acquisition_fees;

  -- Create the asset
  INSERT INTO grain_hard_assets (
    asset_code, name, description, category_id, asset_type,
    address, city, state,
    acquired_date, acquisition_cost, acquisition_fees, total_cost_basis,
    current_value, net_equity,
    expected_annual_income, generates_income
  ) VALUES (
    p_asset_code, p_name, p_description, p_category_id, p_asset_type,
    p_address, p_city, p_state,
    CURRENT_DATE, p_acquisition_cost, p_acquisition_fees, v_cost_basis,
    v_cost_basis, v_cost_basis,  -- Initial value = cost basis
    p_expected_annual_income, p_expected_annual_income > 0
  )
  RETURNING id INTO v_asset_id;

  -- Record initial valuation
  INSERT INTO grain_asset_valuations (
    asset_id, valuation_date, valuation_type,
    previous_value, new_value, change_amount, change_pct,
    notes
  ) VALUES (
    v_asset_id, CURRENT_DATE, 'cost_approach',
    0, v_cost_basis, v_cost_basis, 100,
    'Initial acquisition at cost'
  );

  -- Record the investment transaction
  INSERT INTO grain_asset_investments (
    investment_date, investment_type, source, amount,
    asset_id, new_asset_code,
    reduces_usd_reserve, usd_reserve_impact,
    description, status
  ) VALUES (
    CURRENT_DATE, 'acquisition', 'platform_fees', v_cost_basis,
    v_asset_id, p_asset_code,
    TRUE, v_cost_basis,
    'Asset acquisition: ' || p_name, 'completed'
  );

  -- Update USD reserve (funds moved to hard assets)
  UPDATE grain_token SET
    usd_reserve = usd_reserve - v_cost_basis,
    hard_asset_cost_basis = hard_asset_cost_basis + v_cost_basis,
    hard_asset_current_value = hard_asset_current_value + v_cost_basis,
    updated_at = NOW()
  WHERE id = 1;

  -- Recalculate backing (total stays same, just reallocated)
  PERFORM grain_sync_backing();

  -- Get new price
  SELECT current_price INTO v_new_price FROM grain_token WHERE id = 1;

  RETURN QUERY
  SELECT v_asset_id, v_cost_basis, v_new_price,
         (SELECT total_backing FROM grain_token WHERE id = 1);
END;
$$ LANGUAGE plpgsql;

-- Record asset valuation/appraisal (updates equity)
CREATE OR REPLACE FUNCTION grain_record_valuation(
  p_asset_id UUID,
  p_new_value DECIMAL(20,4),
  p_valuation_type VARCHAR(30) DEFAULT 'appraisal',
  p_appraiser_name VARCHAR(255) DEFAULT NULL,
  p_appraiser_company VARCHAR(255) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  previous_value DECIMAL(20,4),
  new_value DECIMAL(20,4),
  change_amount DECIMAL(20,4),
  change_pct DECIMAL(8,4),
  new_equity DECIMAL(20,4),
  new_grain_price DECIMAL(20,8)
) AS $$
DECLARE
  v_asset RECORD;
  v_change DECIMAL(20,4);
  v_change_pct DECIMAL(8,4);
  v_new_equity DECIMAL(20,4);
  v_new_price DECIMAL(20,8);
BEGIN
  -- Get current asset state
  SELECT * INTO v_asset FROM grain_hard_assets WHERE id = p_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset not found';
  END IF;

  -- Calculate change
  v_change := p_new_value - v_asset.current_value;
  v_change_pct := CASE WHEN v_asset.current_value > 0
    THEN ROUND((v_change / v_asset.current_value) * 100, 4)
    ELSE 0
  END;

  -- Calculate new equity
  v_new_equity := p_new_value - v_asset.debt_amount;

  -- Record the valuation
  INSERT INTO grain_asset_valuations (
    asset_id, valuation_date, valuation_type,
    previous_value, new_value, change_amount, change_pct,
    appraiser_name, appraiser_company, notes
  ) VALUES (
    p_asset_id, CURRENT_DATE, p_valuation_type,
    v_asset.current_value, p_new_value, v_change, v_change_pct,
    p_appraiser_name, p_appraiser_company, p_notes
  );

  -- Update the asset
  UPDATE grain_hard_assets SET
    current_value = p_new_value,
    last_appraisal_date = CURRENT_DATE,
    last_appraisal_value = p_new_value,
    appraiser = p_appraiser_company,
    valuation_method = p_valuation_type,
    appreciation_amount = p_new_value - total_cost_basis,
    appreciation_pct = CASE WHEN total_cost_basis > 0
      THEN ROUND((p_new_value - total_cost_basis) / total_cost_basis * 100, 4)
      ELSE 0
    END,
    net_equity = v_new_equity,
    updated_at = NOW()
  WHERE id = p_asset_id;

  -- Sync backing (this updates GRAIN price)
  PERFORM grain_sync_backing();

  -- Get new price
  SELECT current_price INTO v_new_price FROM grain_token WHERE id = 1;

  -- Update all-time high if needed
  UPDATE grain_token SET
    all_time_high = GREATEST(all_time_high, v_new_price)
  WHERE id = 1;

  RETURN QUERY
  SELECT v_asset.current_value, p_new_value, v_change, v_change_pct, v_new_equity, v_new_price;
END;
$$ LANGUAGE plpgsql;

-- Record asset income (rent, operating profits, etc.)
CREATE OR REPLACE FUNCTION grain_record_asset_income(
  p_asset_id UUID,
  p_income_type VARCHAR(50),
  p_gross_income DECIMAL(20,4),
  p_operating_expenses DECIMAL(20,4) DEFAULT 0,
  p_property_taxes DECIMAL(20,4) DEFAULT 0,
  p_insurance_costs DECIMAL(20,4) DEFAULT 0,
  p_debt_service DECIMAL(20,4) DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  net_income DECIMAL(20,4),
  distributed_to_grain DECIMAL(20,4),
  new_grain_price DECIMAL(20,8),
  asset_ytd_income DECIMAL(20,4)
) AS $$
DECLARE
  v_net DECIMAL(20,4);
  v_distributed DECIMAL(20,4);
  v_new_price DECIMAL(20,8);
  v_ytd DECIMAL(20,4);
BEGIN
  -- Calculate net income
  v_net := p_gross_income - p_operating_expenses - p_property_taxes - p_insurance_costs - p_debt_service;

  -- All net income goes to GRAIN backing
  v_distributed := v_net;

  -- Record the income
  INSERT INTO grain_asset_income (
    asset_id, income_date, income_period,
    income_type, gross_income,
    operating_expenses, property_taxes, insurance_costs, debt_service,
    net_income,
    distributed_to_grain, distribution_amount, distribution_date,
    notes
  ) VALUES (
    p_asset_id, CURRENT_DATE, 'monthly',
    p_income_type, p_gross_income,
    p_operating_expenses, p_property_taxes, p_insurance_costs, p_debt_service,
    v_net,
    TRUE, v_distributed, CURRENT_DATE,
    p_notes
  );

  -- Update asset YTD income
  UPDATE grain_hard_assets SET
    actual_ytd_income = actual_ytd_income + v_net,
    actual_total_income = actual_total_income + v_net,
    updated_at = NOW()
  WHERE id = p_asset_id
  RETURNING actual_ytd_income INTO v_ytd;

  -- Add net income to GRAIN yield reserve
  UPDATE grain_token SET
    yield_reserve = yield_reserve + v_distributed,
    asset_income_ytd = asset_income_ytd + v_distributed,
    asset_income_total = asset_income_total + v_distributed,
    updated_at = NOW()
  WHERE id = 1;

  -- Recalculate price
  PERFORM grain_sync_backing();

  SELECT current_price INTO v_new_price FROM grain_token WHERE id = 1;

  -- Update all-time high
  UPDATE grain_token SET
    all_time_high = GREATEST(all_time_high, v_new_price)
  WHERE id = 1;

  RETURN QUERY SELECT v_net, v_distributed, v_new_price, v_ytd;
END;
$$ LANGUAGE plpgsql;

-- Calculate portfolio metrics
CREATE OR REPLACE FUNCTION grain_portfolio_metrics()
RETURNS TABLE (
  total_assets INTEGER,
  total_cost_basis DECIMAL(20,4),
  total_current_value DECIMAL(20,4),
  total_appreciation DECIMAL(20,4),
  appreciation_pct DECIMAL(8,4),
  total_debt DECIMAL(20,4),
  total_net_equity DECIMAL(20,4),
  ytd_income DECIMAL(20,4),
  income_yield_pct DECIMAL(8,4),
  grain_price DECIMAL(20,8),
  total_backing DECIMAL(20,4),
  liquid_backing_pct DECIMAL(5,2),
  hard_asset_backing_pct DECIMAL(5,2),
  multiplier DECIMAL(8,4)
) AS $$
DECLARE
  v_portfolio RECORD;
  v_token RECORD;
BEGIN
  -- Get portfolio totals
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(gha.total_cost_basis), 0),
    COALESCE(SUM(gha.current_value), 0),
    COALESCE(SUM(gha.appreciation_amount), 0),
    COALESCE(SUM(gha.debt_amount), 0),
    COALESCE(SUM(gha.net_equity), 0),
    COALESCE(SUM(gha.actual_ytd_income), 0)
  INTO v_portfolio
  FROM grain_hard_assets gha
  WHERE gha.status = 'active';

  -- Get token state
  SELECT * INTO v_token FROM grain_token WHERE id = 1;

  RETURN QUERY SELECT
    v_portfolio.count,
    v_portfolio.sum,            -- cost_basis
    v_portfolio.sum,            -- current_value (2nd sum)
    v_portfolio.sum,            -- appreciation (3rd sum)
    CASE WHEN v_portfolio.sum > 0 THEN ROUND(v_portfolio.sum / v_portfolio.sum * 100, 4) ELSE 0 END,
    v_portfolio.sum,            -- debt
    v_portfolio.sum,            -- net_equity
    v_portfolio.sum,            -- ytd_income
    CASE WHEN v_portfolio.sum > 0 THEN ROUND(v_portfolio.sum / v_portfolio.sum * 100, 4) ELSE 0 END,
    v_token.current_price,
    v_token.total_backing,
    v_token.liquid_backing_pct,
    v_token.hard_asset_backing_pct,
    v_token.asset_income_multiplier;
END;
$$ LANGUAGE plpgsql;

-- Validate asset (ensure data integrity)
CREATE OR REPLACE FUNCTION grain_validate_asset(p_asset_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  issues TEXT[]
) AS $$
DECLARE
  v_asset RECORD;
  v_issues TEXT[] := ARRAY[]::TEXT[];
  v_last_valuation DATE;
  v_income_count INTEGER;
BEGIN
  SELECT * INTO v_asset FROM grain_hard_assets WHERE id = p_asset_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, ARRAY['Asset not found'];
    RETURN;
  END IF;

  -- Check required fields
  IF v_asset.asset_code IS NULL OR v_asset.asset_code = '' THEN
    v_issues := array_append(v_issues, 'Missing asset code');
  END IF;

  IF v_asset.total_cost_basis <= 0 THEN
    v_issues := array_append(v_issues, 'Invalid cost basis');
  END IF;

  IF v_asset.current_value <= 0 THEN
    v_issues := array_append(v_issues, 'Invalid current value');
  END IF;

  -- Check valuation freshness (should be valued within 365 days)
  SELECT MAX(valuation_date) INTO v_last_valuation
  FROM grain_asset_valuations WHERE asset_id = p_asset_id;

  IF v_last_valuation IS NULL OR v_last_valuation < CURRENT_DATE - INTERVAL '365 days' THEN
    v_issues := array_append(v_issues, 'Valuation stale (>365 days old)');
  END IF;

  -- Check income reporting if asset generates income
  IF v_asset.generates_income THEN
    SELECT COUNT(*) INTO v_income_count
    FROM grain_asset_income
    WHERE asset_id = p_asset_id
    AND income_date >= DATE_TRUNC('year', CURRENT_DATE);

    IF v_income_count = 0 AND v_asset.expected_annual_income > 0 THEN
      v_issues := array_append(v_issues, 'No income recorded this year');
    END IF;
  END IF;

  -- Check equity calculation
  IF v_asset.net_equity != v_asset.current_value - v_asset.debt_amount THEN
    v_issues := array_append(v_issues, 'Net equity calculation mismatch');
  END IF;

  RETURN QUERY SELECT array_length(v_issues, 1) IS NULL OR array_length(v_issues, 1) = 0, v_issues;
END;
$$ LANGUAGE plpgsql;

-- Calculate equity increase for an asset
CREATE OR REPLACE FUNCTION grain_asset_equity_growth(p_asset_id UUID)
RETURNS TABLE (
  asset_code VARCHAR(50),
  asset_name VARCHAR(255),
  cost_basis DECIMAL(20,4),
  current_value DECIMAL(20,4),
  appreciation DECIMAL(20,4),
  appreciation_pct DECIMAL(8,4),
  total_income DECIMAL(20,4),
  total_return DECIMAL(20,4),
  total_return_pct DECIMAL(8,4),
  annualized_return_pct DECIMAL(8,4),
  holding_period_days INTEGER
) AS $$
DECLARE
  v_asset RECORD;
  v_days INTEGER;
  v_total_return DECIMAL(20,4);
  v_annualized DECIMAL(8,4);
BEGIN
  SELECT * INTO v_asset FROM grain_hard_assets WHERE id = p_asset_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_days := CURRENT_DATE - v_asset.acquired_date;
  v_total_return := v_asset.appreciation_amount + v_asset.actual_total_income;

  -- Annualized return (simple calculation)
  IF v_days > 0 AND v_asset.total_cost_basis > 0 THEN
    v_annualized := ROUND((v_total_return / v_asset.total_cost_basis) * (365.0 / v_days) * 100, 4);
  ELSE
    v_annualized := 0;
  END IF;

  RETURN QUERY SELECT
    v_asset.asset_code,
    v_asset.name,
    v_asset.total_cost_basis,
    v_asset.current_value,
    v_asset.appreciation_amount,
    v_asset.appreciation_pct,
    v_asset.actual_total_income,
    v_total_return,
    CASE WHEN v_asset.total_cost_basis > 0 THEN ROUND(v_total_return / v_asset.total_cost_basis * 100, 4) ELSE 0 END,
    v_annualized,
    v_days;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- GRAIN token overview (with hard asset backing)
CREATE OR REPLACE VIEW grain_token_overview AS
SELECT
  total_supply,
  circulating_supply,
  burned_supply,

  -- Tier 1: Cash Reserves
  usd_reserve,
  yield_reserve,

  -- Tier 2: Hard Assets
  hard_asset_cost_basis,
  hard_asset_current_value,
  hard_asset_appreciation,

  -- Tier 3: Asset Income
  asset_income_ytd,
  asset_income_total,

  -- Total Backing
  total_backing,
  liquid_backing_pct,
  hard_asset_backing_pct,

  -- Price & Performance
  current_price,
  launch_price,
  all_time_high,
  ROUND((current_price - launch_price) / NULLIF(launch_price, 0) * 100, 2) as price_appreciation_pct,

  -- Yield & Multiplier
  yield_rate_apy,
  total_yield_distributed,
  platform_fee_income_total,
  asset_income_multiplier,

  -- Stats
  total_holders,
  total_transactions,
  total_backing as market_cap,
  updated_at
FROM grain_token WHERE id = 1;

-- Complete asset register with equity metrics
CREATE OR REPLACE VIEW grain_asset_register AS
SELECT
  gha.id,
  gha.asset_code,
  gha.name,
  gc.name as category,
  gha.asset_type,
  gha.city || ', ' || gha.state as location,
  gha.acquired_date,
  gha.total_cost_basis,
  gha.current_value,
  gha.appreciation_amount,
  gha.appreciation_pct,
  gha.debt_amount,
  gha.net_equity,
  gha.expected_annual_income,
  gha.actual_ytd_income,
  gha.actual_total_income,
  CASE WHEN gha.total_cost_basis > 0
    THEN ROUND(gha.actual_ytd_income / gha.total_cost_basis * 100, 2)
    ELSE 0
  END as current_yield_pct,
  gha.last_appraisal_date,
  gha.valuation_method,
  gha.status,
  CURRENT_DATE - gha.acquired_date as holding_period_days,
  gha.appreciation_amount + gha.actual_total_income as total_return,
  CASE WHEN gha.total_cost_basis > 0
    THEN ROUND((gha.appreciation_amount + gha.actual_total_income) / gha.total_cost_basis * 100, 2)
    ELSE 0
  END as total_return_pct
FROM grain_hard_assets gha
LEFT JOIN grain_asset_categories gc ON gha.category_id = gc.id
ORDER BY gha.current_value DESC;

-- Equity growth tracking (all assets)
CREATE OR REPLACE VIEW grain_equity_growth AS
SELECT
  gha.asset_code,
  gha.name,
  gc.name as category,
  gha.total_cost_basis as original_investment,
  gha.current_value,
  gha.appreciation_amount as capital_appreciation,
  gha.actual_total_income as income_earned,
  gha.appreciation_amount + gha.actual_total_income as total_value_created,
  gha.debt_amount,
  gha.net_equity,
  CASE WHEN gha.total_cost_basis > 0
    THEN ROUND((gha.net_equity - gha.total_cost_basis + gha.debt_amount) / gha.total_cost_basis * 100, 2)
    ELSE 0
  END as equity_growth_pct,
  gha.acquired_date,
  CURRENT_DATE - gha.acquired_date as days_held,
  CASE WHEN gha.total_cost_basis > 0 AND (CURRENT_DATE - gha.acquired_date) > 0
    THEN ROUND(((gha.appreciation_amount + gha.actual_total_income) / gha.total_cost_basis) * (365.0 / (CURRENT_DATE - gha.acquired_date)) * 100, 2)
    ELSE 0
  END as annualized_return_pct
FROM grain_hard_assets gha
LEFT JOIN grain_asset_categories gc ON gha.category_id = gc.id
WHERE gha.status = 'active'
ORDER BY (gha.appreciation_amount + gha.actual_total_income) DESC;

-- Valuation history timeline
CREATE OR REPLACE VIEW grain_valuation_timeline AS
SELECT
  gav.valuation_date,
  gha.asset_code,
  gha.name as asset_name,
  gav.valuation_type,
  gav.previous_value,
  gav.new_value,
  gav.change_amount,
  gav.change_pct,
  gav.appraiser_company,
  gav.notes,
  SUM(gav.change_amount) OVER (PARTITION BY gha.id ORDER BY gav.valuation_date) as cumulative_change
FROM grain_asset_valuations gav
JOIN grain_hard_assets gha ON gav.asset_id = gha.id
ORDER BY gav.valuation_date DESC;

-- Asset income summary
CREATE OR REPLACE VIEW grain_income_summary AS
SELECT
  gha.asset_code,
  gha.name as asset_name,
  gc.name as category,
  COUNT(gai.id) as income_records,
  SUM(gai.gross_income) as total_gross_income,
  SUM(gai.net_income) as total_net_income,
  AVG(gai.net_income) as avg_monthly_net,
  SUM(gai.distribution_amount) as total_distributed_to_grain,
  CASE WHEN gha.total_cost_basis > 0
    THEN ROUND(SUM(gai.net_income) / gha.total_cost_basis * 100, 2)
    ELSE 0
  END as income_yield_pct
FROM grain_hard_assets gha
LEFT JOIN grain_asset_categories gc ON gha.category_id = gc.id
LEFT JOIN grain_asset_income gai ON gha.id = gai.asset_id
WHERE gha.status = 'active'
GROUP BY gha.id, gha.asset_code, gha.name, gc.name, gha.total_cost_basis
ORDER BY SUM(gai.net_income) DESC NULLS LAST;

-- GRAIN backing composition
CREATE OR REPLACE VIEW grain_backing_composition AS
SELECT
  'USD Cash Reserve' as backing_type,
  usd_reserve as amount,
  liquid_backing_pct as percentage,
  1 as liquidity_rank
FROM grain_token WHERE id = 1
UNION ALL
SELECT
  'Yield Reserve' as backing_type,
  yield_reserve as amount,
  ROUND(yield_reserve / NULLIF(total_backing, 0) * 100, 2) as percentage,
  2 as liquidity_rank
FROM grain_token WHERE id = 1
UNION ALL
SELECT
  'Hard Assets (Net Equity)' as backing_type,
  hard_asset_current_value as amount,
  hard_asset_backing_pct as percentage,
  3 as liquidity_rank
FROM grain_token WHERE id = 1
ORDER BY liquidity_rank;

-- Top GRAIN holders
CREATE OR REPLACE VIEW grain_top_holders AS
SELECT
  wallet_address,
  wallet_type,
  name,
  company,
  grain_balance,
  ROUND(grain_balance * (SELECT current_price FROM grain_token WHERE id = 1), 2) as usd_value,
  ROUND(grain_balance / NULLIF((SELECT circulating_supply FROM grain_token WHERE id = 1), 0) * 100, 4) as supply_pct,
  total_yield_earned,
  created_at,
  last_activity_at
FROM grain_external_wallets
WHERE status = 'active' AND grain_balance > 0
ORDER BY grain_balance DESC;

-- Recent GRAIN transactions
CREATE OR REPLACE VIEW grain_recent_transactions AS
SELECT
  tx_hash,
  tx_type,
  from_address,
  to_address,
  grain_amount,
  usd_value,
  grain_price,
  fee_grain,
  status,
  created_at
FROM grain_transactions
ORDER BY created_at DESC
LIMIT 100;

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================

-- Core Tables
COMMENT ON TABLE grain_token IS 'Master GRAIN token state - single row tracking supply, reserves, hard assets, and price';
COMMENT ON TABLE grain_external_wallets IS 'External GRAIN wallet holders - individuals, businesses, exchanges';
COMMENT ON TABLE grain_transactions IS 'All GRAIN token movements - mint, burn, transfer, yield';
COMMENT ON TABLE grain_yield_sources IS 'Platform + Asset income that feeds GRAIN yield';
COMMENT ON TABLE grain_yield_distributions IS 'Individual yield credits to wallet holders';

-- Hard Asset Tables
COMMENT ON TABLE grain_asset_categories IS 'Asset categories: Manufacturing, Real Estate, Infrastructure, Equipment';
COMMENT ON TABLE grain_hard_assets IS 'Individual hard assets owned by GRAIN treasury - manufacturing facilities, real estate, etc.';
COMMENT ON TABLE grain_asset_valuations IS 'Asset valuation history - appraisals, market comps, internal valuations';
COMMENT ON TABLE grain_asset_income IS 'Asset income records - rent, operating profits, lease payments';
COMMENT ON TABLE grain_asset_investments IS 'Capital deployment into hard assets - tracks fund flows from USD to assets';

-- Core Functions
COMMENT ON FUNCTION grain_mint IS 'Mint new GRAIN by depositing USD - price = total_backing / supply';
COMMENT ON FUNCTION grain_burn IS 'Burn GRAIN to withdraw USD at current price';
COMMENT ON FUNCTION grain_transfer IS 'Transfer GRAIN with 0.1% fee (burned to increase price)';
COMMENT ON FUNCTION grain_add_yield IS 'Add platform fees to yield reserve (increases GRAIN price)';
COMMENT ON FUNCTION grain_calculate_price IS 'Calculate GRAIN price from USD + Hard Assets / Circulating Supply';
COMMENT ON FUNCTION grain_sync_backing IS 'Sync total backing from all sources (USD reserve + yield + hard assets)';

-- Hard Asset Functions
COMMENT ON FUNCTION grain_register_asset IS 'Register new hard asset acquisition - moves USD to hard asset backing';
COMMENT ON FUNCTION grain_record_valuation IS 'Record asset appraisal/valuation - updates equity and GRAIN price';
COMMENT ON FUNCTION grain_record_asset_income IS 'Record asset income (rent, profits) - adds to yield reserve';
COMMENT ON FUNCTION grain_validate_asset IS 'Validate asset data integrity - checks valuations, income reporting';
COMMENT ON FUNCTION grain_asset_equity_growth IS 'Calculate equity increase for an asset - appreciation + income';

-- Views
COMMENT ON VIEW grain_token_overview IS 'Complete GRAIN token metrics with hard asset backing';
COMMENT ON VIEW grain_asset_register IS 'Complete asset register with equity metrics and returns';
COMMENT ON VIEW grain_equity_growth IS 'Equity growth tracking for all assets - appreciation + income';
COMMENT ON VIEW grain_valuation_timeline IS 'Chronological history of all asset valuations';
COMMENT ON VIEW grain_income_summary IS 'Summary of income by asset with yield calculations';
COMMENT ON VIEW grain_backing_composition IS 'GRAIN backing breakdown: USD, Yield Reserve, Hard Assets';
COMMENT ON VIEW grain_asset_portfolio IS 'Portfolio-level metrics: total value, appreciation, income';
COMMENT ON VIEW grain_portfolio_by_category IS 'Portfolio allocation by asset category';

-- ============================================================================
-- GRAIN ECONOMICS SUMMARY
-- ============================================================================
--
-- PRICE FORMULA:
--   GRAIN Price = (USD Reserve + Yield Reserve + Hard Asset Net Equity) / Circulating Supply
--
-- VALUE GROWTH MECHANISMS:
--   1. Platform Fee Income (30% → Yield Reserve)
--   2. Hard Asset Appreciation (revaluations increase backing)
--   3. Hard Asset Income (rent, operations → Yield Reserve)
--   4. Transfer Fee Burns (0.1% burned, reduces supply)
--
-- MULTIPLIER EFFECT:
--   - Platform fees invested into hard assets (manufacturing, real estate)
--   - Assets appreciate over time (real estate, equipment value)
--   - Assets generate income (rent, operating profits)
--   - Income reinvested → more assets → more income → exponential growth
--
-- BACKING TIERS:
--   Tier 1: USD Cash Reserve (100% liquid, immediate redemption)
--   Tier 2: Hard Asset Equity (90-180 day liquidity)
--   Tier 3: Yield Reserve (accumulated income for distribution)
--
-- ============================================================================
