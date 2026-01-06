-- ============================================================================
-- GRAIN & VAULT COLLATERAL MANAGEMENT SCHEMA
-- Tracks all collateral backing user deposits for 100% protection
-- ============================================================================

-- ============================================================================
-- COLLATERAL ASSETS
-- All assets that back user deposits
-- ============================================================================

CREATE TABLE IF NOT EXISTS collateral_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  type TEXT NOT NULL, -- 'fdic_deposit', 'treasury_bill', 'treasury_bond', 'treasury_note', 'money_market', 'real_estate', 'precious_metals', 'other'
  name TEXT NOT NULL,
  description TEXT,

  -- Custody Information
  custodian TEXT NOT NULL,                    -- e.g., 'Silicon Valley Bank', 'Treasury Direct', 'BNY Mellon'
  custodian_account_id TEXT,                  -- Account/reference number at custodian
  custodian_contact_email TEXT,               -- Contact for verification

  -- Valuation
  face_value DECIMAL(24,2) NOT NULL,          -- Original/face value
  current_value DECIMAL(24,2) NOT NULL,       -- Current market value
  last_valuation TIMESTAMP NOT NULL DEFAULT NOW(),
  valuation_source TEXT,                      -- 'market', 'appraisal', 'custodian', 'manual'

  -- Interest-Bearing Assets
  interest_rate DECIMAL(8,6),                 -- APY (e.g., 0.0525 for 5.25%)
  maturity_date DATE,                         -- When the asset matures (T-bills, bonds, CDs)

  -- Allocation Tracking
  allocated_amount DECIMAL(24,2) DEFAULT 0,   -- Amount currently allocated to deposits
  available_amount DECIMAL(24,2) NOT NULL,    -- Amount available for new allocations

  -- Insurance/Protection
  insurance_provider TEXT,                    -- e.g., 'FDIC', 'SIPC', null
  insurance_limit DECIMAL(20,2),              -- Coverage limit per account

  -- Status
  status TEXT NOT NULL DEFAULT 'active',      -- 'active', 'pending', 'matured', 'liquidating', 'released', 'impaired'
  status_reason TEXT,                         -- Reason for non-active status

  -- Timestamps
  acquired_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for collateral_assets
CREATE INDEX IF NOT EXISTS idx_collateral_assets_type ON collateral_assets(type);
CREATE INDEX IF NOT EXISTS idx_collateral_assets_status ON collateral_assets(status);
CREATE INDEX IF NOT EXISTS idx_collateral_assets_custodian ON collateral_assets(custodian);
CREATE INDEX IF NOT EXISTS idx_collateral_assets_maturity ON collateral_assets(maturity_date) WHERE maturity_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collateral_assets_valuation ON collateral_assets(last_valuation);

-- ============================================================================
-- COLLATERAL ALLOCATIONS
-- Links collateral assets to specific user deposits
-- ============================================================================

CREATE TABLE IF NOT EXISTS collateral_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  asset_id UUID NOT NULL REFERENCES collateral_assets(id) ON DELETE RESTRICT,
  deposit_id TEXT NOT NULL,                   -- Reference to user's deposit transaction
  user_id TEXT NOT NULL,                      -- User who owns the deposit

  -- Allocation
  allocated_amount DECIMAL(24,2) NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active',      -- 'active', 'released'
  allocated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  released_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for collateral_allocations
CREATE INDEX IF NOT EXISTS idx_collateral_allocations_asset ON collateral_allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_collateral_allocations_deposit ON collateral_allocations(deposit_id);
CREATE INDEX IF NOT EXISTS idx_collateral_allocations_user ON collateral_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_collateral_allocations_status ON collateral_allocations(status);

-- ============================================================================
-- COLLATERAL VALUATIONS
-- History of valuations for each asset
-- ============================================================================

CREATE TABLE IF NOT EXISTS collateral_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  asset_id UUID NOT NULL REFERENCES collateral_assets(id) ON DELETE CASCADE,

  -- Valuation Data
  previous_value DECIMAL(24,2) NOT NULL,
  new_value DECIMAL(24,2) NOT NULL,
  change_amount DECIMAL(24,2) NOT NULL,
  change_percent DECIMAL(10,4) NOT NULL,

  -- Source
  source TEXT NOT NULL,                       -- 'market', 'appraisal', 'custodian', 'manual', 'maturity'
  appraiser TEXT,                             -- Who performed the valuation
  notes TEXT,

  -- Timestamps
  valued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for collateral_valuations
CREATE INDEX IF NOT EXISTS idx_collateral_valuations_asset ON collateral_valuations(asset_id);
CREATE INDEX IF NOT EXISTS idx_collateral_valuations_valued_at ON collateral_valuations(valued_at DESC);
CREATE INDEX IF NOT EXISTS idx_collateral_valuations_source ON collateral_valuations(source);

-- ============================================================================
-- VIEW: Collateral Summary by Type
-- ============================================================================

CREATE OR REPLACE VIEW collateral_summary_by_type AS
SELECT
  type,
  COUNT(*) as asset_count,
  COALESCE(SUM(face_value), 0) as total_face_value,
  COALESCE(SUM(current_value), 0) as total_current_value,
  COALESCE(SUM(allocated_amount), 0) as total_allocated,
  COALESCE(SUM(available_amount), 0) as total_available,
  COALESCE(AVG(interest_rate), 0) as avg_interest_rate
FROM collateral_assets
WHERE status = 'active'
GROUP BY type
ORDER BY total_current_value DESC;

-- ============================================================================
-- VIEW: User Collateral Backing
-- Shows collateral backing for each user
-- ============================================================================

CREATE OR REPLACE VIEW user_collateral_backing AS
SELECT
  cal.user_id,
  ta.email,
  ta.full_name,
  ta.usd_balance as deposit_amount,
  COALESCE(SUM(cal.allocated_amount), 0) as total_collateral_backing,
  CASE
    WHEN ta.usd_balance > 0
    THEN COALESCE(SUM(cal.allocated_amount), 0) / ta.usd_balance
    ELSE 1
  END as coverage_ratio,
  COUNT(DISTINCT cal.asset_id) as backing_assets_count
FROM collateral_allocations cal
JOIN treasury_accounts ta ON cal.user_id::uuid = ta.id
WHERE cal.status = 'active'
GROUP BY cal.user_id, ta.email, ta.full_name, ta.usd_balance;

-- ============================================================================
-- VIEW: Collateralization Health Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW collateralization_health AS
SELECT
  (SELECT COALESCE(SUM(current_value), 0) FROM collateral_assets WHERE status = 'active') as total_collateral,
  (SELECT COALESCE(SUM(allocated_amount), 0) FROM collateral_assets WHERE status = 'active') as total_allocated,
  (SELECT COALESCE(SUM(available_amount), 0) FROM collateral_assets WHERE status = 'active') as total_available,
  (SELECT COALESCE(SUM(usd_balance), 0) FROM treasury_accounts WHERE status = 'active') as total_deposits,
  CASE
    WHEN (SELECT COALESCE(SUM(usd_balance), 0) FROM treasury_accounts WHERE status = 'active') > 0
    THEN (SELECT COALESCE(SUM(current_value), 0) FROM collateral_assets WHERE status = 'active') /
         (SELECT COALESCE(SUM(usd_balance), 0) FROM treasury_accounts WHERE status = 'active')
    ELSE 1
  END as collateralization_ratio,
  (SELECT COUNT(*) FROM collateral_assets WHERE status = 'active') as active_asset_count,
  (SELECT COUNT(*) FROM collateral_assets WHERE maturity_date IS NOT NULL AND maturity_date <= NOW() + INTERVAL '14 days' AND status = 'active') as maturing_soon_count,
  (SELECT COUNT(*) FROM collateral_assets WHERE last_valuation < NOW() - INTERVAL '7 days' AND status = 'active') as stale_valuation_count;

-- ============================================================================
-- FUNCTION: Calculate Collateralization Ratio
-- ============================================================================

CREATE OR REPLACE FUNCTION get_collateralization_ratio()
RETURNS TABLE (
  total_collateral DECIMAL(24,2),
  total_deposits DECIMAL(24,2),
  collateralization_ratio DECIMAL(10,4),
  is_fully_collateralized BOOLEAN,
  excess_collateral DECIMAL(24,2),
  collateral_gap DECIMAL(24,2)
) AS $$
DECLARE
  v_total_collateral DECIMAL(24,2);
  v_total_deposits DECIMAL(24,2);
  v_ratio DECIMAL(10,4);
BEGIN
  -- Get total collateral
  SELECT COALESCE(SUM(current_value), 0) INTO v_total_collateral
  FROM collateral_assets
  WHERE status = 'active';

  -- Get total deposits
  SELECT COALESCE(SUM(usd_balance), 0) INTO v_total_deposits
  FROM treasury_accounts
  WHERE status = 'active';

  -- Calculate ratio
  IF v_total_deposits > 0 THEN
    v_ratio := v_total_collateral / v_total_deposits;
  ELSE
    v_ratio := CASE WHEN v_total_collateral > 0 THEN 999.99 ELSE 1.00 END;
  END IF;

  RETURN QUERY SELECT
    v_total_collateral,
    v_total_deposits,
    v_ratio,
    (v_ratio >= 1),
    GREATEST(v_total_collateral - v_total_deposits, 0),
    GREATEST(v_total_deposits - v_total_collateral, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Auto-allocate collateral to a deposit
-- ============================================================================

CREATE OR REPLACE FUNCTION allocate_collateral_to_deposit(
  p_deposit_id TEXT,
  p_user_id TEXT,
  p_amount DECIMAL(24,2)
)
RETURNS TABLE (
  allocation_id UUID,
  asset_id UUID,
  asset_name TEXT,
  allocated_amount DECIMAL(24,2)
) AS $$
DECLARE
  v_remaining DECIMAL(24,2);
  v_asset RECORD;
  v_allocate_amount DECIMAL(24,2);
  v_allocation_id UUID;
BEGIN
  v_remaining := p_amount;

  -- Priority order: fdic_deposit, treasury_bill, money_market, treasury_note, treasury_bond, precious_metals, real_estate, other
  FOR v_asset IN
    SELECT *
    FROM collateral_assets
    WHERE status = 'active' AND available_amount > 0
    ORDER BY
      CASE type
        WHEN 'fdic_deposit' THEN 1
        WHEN 'treasury_bill' THEN 2
        WHEN 'money_market' THEN 3
        WHEN 'treasury_note' THEN 4
        WHEN 'treasury_bond' THEN 5
        WHEN 'precious_metals' THEN 6
        WHEN 'real_estate' THEN 7
        ELSE 8
      END,
      available_amount DESC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_allocate_amount := LEAST(v_asset.available_amount, v_remaining);

    -- Create allocation
    INSERT INTO collateral_allocations (asset_id, deposit_id, user_id, allocated_amount, status, allocated_at)
    VALUES (v_asset.id, p_deposit_id, p_user_id, v_allocate_amount, 'active', NOW())
    RETURNING id INTO v_allocation_id;

    -- Update asset
    UPDATE collateral_assets
    SET allocated_amount = allocated_amount + v_allocate_amount,
        available_amount = available_amount - v_allocate_amount,
        updated_at = NOW()
    WHERE id = v_asset.id;

    v_remaining := v_remaining - v_allocate_amount;

    RETURN QUERY SELECT v_allocation_id, v_asset.id, v_asset.name, v_allocate_amount;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Release collateral from a withdrawal
-- ============================================================================

CREATE OR REPLACE FUNCTION release_collateral_from_withdrawal(
  p_deposit_id TEXT,
  p_amount DECIMAL(24,2)
)
RETURNS TABLE (
  released_amount DECIMAL(24,2),
  asset_id UUID,
  asset_name TEXT
) AS $$
DECLARE
  v_remaining DECIMAL(24,2);
  v_allocation RECORD;
  v_release_amount DECIMAL(24,2);
BEGIN
  v_remaining := p_amount;

  -- Release from allocations in FIFO order
  FOR v_allocation IN
    SELECT cal.*, ca.name as asset_name
    FROM collateral_allocations cal
    JOIN collateral_assets ca ON cal.asset_id = ca.id
    WHERE cal.deposit_id = p_deposit_id AND cal.status = 'active'
    ORDER BY cal.allocated_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_release_amount := LEAST(v_allocation.allocated_amount, v_remaining);

    IF v_release_amount >= v_allocation.allocated_amount THEN
      -- Full release
      UPDATE collateral_allocations
      SET status = 'released', released_at = NOW()
      WHERE id = v_allocation.id;
    ELSE
      -- Partial release
      UPDATE collateral_allocations
      SET allocated_amount = allocated_amount - v_release_amount
      WHERE id = v_allocation.id;
    END IF;

    -- Update asset
    UPDATE collateral_assets
    SET allocated_amount = allocated_amount - v_release_amount,
        available_amount = available_amount + v_release_amount,
        updated_at = NOW()
    WHERE id = v_allocation.asset_id;

    v_remaining := v_remaining - v_release_amount;

    RETURN QUERY SELECT v_release_amount, v_allocation.asset_id, v_allocation.asset_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_collateral_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_collateral_assets_timestamp
BEFORE UPDATE ON collateral_assets
FOR EACH ROW
EXECUTE FUNCTION update_collateral_timestamp();

-- ============================================================================
-- SEED DATA: Initial Collateral Assets
-- Demonstrates the types of collateral that back deposits
-- ============================================================================

INSERT INTO collateral_assets (
  type, name, description, custodian, face_value, current_value,
  interest_rate, maturity_date, insurance_provider, insurance_limit, status
) VALUES
  -- FDIC-Insured Bank Deposits
  (
    'fdic_deposit',
    'Primary Operating Account - SVB',
    'FDIC-insured business checking account',
    'Silicon Valley Bank',
    500000.00, 500000.00,
    0.0150, NULL,
    'FDIC', 250000.00,
    'active'
  ),
  (
    'fdic_deposit',
    'Reserve Account - Chase',
    'FDIC-insured high-yield savings',
    'JPMorgan Chase',
    250000.00, 250000.00,
    0.0400, NULL,
    'FDIC', 250000.00,
    'active'
  ),

  -- Treasury Bills
  (
    'treasury_bill',
    '13-Week T-Bill - Q1 2024',
    'Short-term US Treasury bill',
    'Treasury Direct',
    200000.00, 199500.00,
    0.0525, '2024-04-15',
    NULL, NULL,
    'active'
  ),
  (
    'treasury_bill',
    '26-Week T-Bill - Q1 2024',
    'Medium-term US Treasury bill',
    'Treasury Direct',
    300000.00, 298000.00,
    0.0535, '2024-07-15',
    NULL, NULL,
    'active'
  ),

  -- Money Market
  (
    'money_market',
    'Vanguard Federal Money Market',
    'Government money market fund',
    'Vanguard',
    150000.00, 150000.00,
    0.0520, NULL,
    'SIPC', 500000.00,
    'active'
  )
ON CONFLICT DO NOTHING;

-- Record initial valuations
INSERT INTO collateral_valuations (asset_id, previous_value, new_value, change_amount, change_percent, source, notes, valued_at)
SELECT id, current_value, current_value, 0, 0, 'manual', 'Initial registration', NOW()
FROM collateral_assets
WHERE NOT EXISTS (
  SELECT 1 FROM collateral_valuations cv WHERE cv.asset_id = collateral_assets.id
);
