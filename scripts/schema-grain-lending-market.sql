-- GRAIN Secondary Lending Market Schema
-- Enables GRAIN holders to lend their GRAIN to back others' mortgages

-- Lenders offering GRAIN for backing loans
CREATE TABLE IF NOT EXISTS grain_lending_pool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lender_id TEXT NOT NULL,
  lender_email TEXT NOT NULL,
  lender_name TEXT,

  -- GRAIN details
  grain_amount DECIMAL(20, 2) NOT NULL CHECK (grain_amount > 0),
  grain_available DECIMAL(20, 2) NOT NULL CHECK (grain_available >= 0),
  grain_locked DECIMAL(20, 2) DEFAULT 0 CHECK (grain_locked >= 0),

  -- Lending terms
  annual_rate DECIMAL(5, 2) NOT NULL CHECK (annual_rate >= 0 AND annual_rate <= 100),
  min_loan_amount DECIMAL(20, 2) DEFAULT 0,
  max_loan_amount DECIMAL(20, 2),
  min_term_months INTEGER DEFAULT 12,
  max_term_months INTEGER DEFAULT 360,

  -- Preferences
  accepted_loan_types TEXT[] DEFAULT ARRAY['mortgage', 'auto', 'personal', 'business'],
  max_ltv DECIMAL(5, 2) DEFAULT 80 CHECK (max_ltv > 0 AND max_ltv <= 100),
  auto_approve BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  total_earnings DECIMAL(20, 2) DEFAULT 0,
  total_loans_backed INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT grain_amount_consistency CHECK (grain_amount = grain_available + grain_locked)
);

-- Track all locked GRAIN (both borrower collateral and lender backing)
CREATE TABLE IF NOT EXISTS grain_collateral_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Lock details
  lock_type TEXT NOT NULL CHECK (lock_type IN ('primary_collateral', 'secondary_lock', 'lender_backing')),
  grain_amount DECIMAL(20, 2) NOT NULL CHECK (grain_amount > 0),

  -- Owner
  owner_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_role TEXT NOT NULL CHECK (owner_role IN ('borrower', 'lender')),

  -- Related records
  loan_id UUID,
  lending_pool_id UUID REFERENCES grain_lending_pool(id),
  match_id UUID,

  -- Lock status
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'liquidated')),
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,

  -- Release conditions
  release_condition TEXT CHECK (release_condition IN ('loan_paid', 'loan_defaulted', 'backing_removed', 'manual')),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  FOREIGN KEY (loan_id) REFERENCES deals(id) ON DELETE CASCADE
);

-- Matches between lenders and borrowers
CREATE TABLE IF NOT EXISTS grain_lending_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parties
  lender_pool_id UUID NOT NULL REFERENCES grain_lending_pool(id),
  lender_id TEXT NOT NULL,
  borrower_id TEXT NOT NULL,
  loan_id UUID NOT NULL REFERENCES deals(id),

  -- Match details
  grain_backed DECIMAL(20, 2) NOT NULL CHECK (grain_backed > 0),
  backing_rate DECIMAL(5, 2) NOT NULL CHECK (backing_rate >= 0),

  -- Lock references
  borrower_lock_released_id UUID REFERENCES grain_collateral_locks(id),
  lender_lock_id UUID REFERENCES grain_collateral_locks(id),

  -- Terms
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expected_end_date TIMESTAMP WITH TIME ZONE,
  actual_end_date TIMESTAMP WITH TIME ZONE,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'defaulted', 'cancelled')),

  -- Earnings tracking
  total_earnings_paid DECIMAL(20, 2) DEFAULT 0,
  last_payment_date TIMESTAMP WITH TIME ZONE,

  -- Approval
  approved_by_lender BOOLEAN DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Track lender earnings from backing loans
CREATE TABLE IF NOT EXISTS grain_lender_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  match_id UUID NOT NULL REFERENCES grain_lending_matches(id),
  lender_pool_id UUID NOT NULL REFERENCES grain_lending_pool(id),
  lender_id TEXT NOT NULL,
  loan_id UUID NOT NULL REFERENCES deals(id),

  -- Payment details
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  loan_payment_amount DECIMAL(20, 2) NOT NULL,
  lender_earnings_amount DECIMAL(20, 2) NOT NULL CHECK (lender_earnings_amount >= 0),
  earnings_rate DECIMAL(5, 2) NOT NULL,

  -- Calculation
  grain_backed DECIMAL(20, 2) NOT NULL,
  days_backed INTEGER NOT NULL,
  calculation_method TEXT DEFAULT 'proportional',

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_grain_lending_pool_status ON grain_lending_pool(status);
CREATE INDEX IF NOT EXISTS idx_grain_lending_pool_lender ON grain_lending_pool(lender_id);
CREATE INDEX IF NOT EXISTS idx_grain_lending_pool_available ON grain_lending_pool(grain_available) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_grain_collateral_locks_owner ON grain_collateral_locks(owner_id);
CREATE INDEX IF NOT EXISTS idx_grain_collateral_locks_loan ON grain_collateral_locks(loan_id);
CREATE INDEX IF NOT EXISTS idx_grain_collateral_locks_status ON grain_collateral_locks(status);
CREATE INDEX IF NOT EXISTS idx_grain_collateral_locks_type ON grain_collateral_locks(lock_type);

CREATE INDEX IF NOT EXISTS idx_grain_lending_matches_lender ON grain_lending_matches(lender_id);
CREATE INDEX IF NOT EXISTS idx_grain_lending_matches_borrower ON grain_lending_matches(borrower_id);
CREATE INDEX IF NOT EXISTS idx_grain_lending_matches_loan ON grain_lending_matches(loan_id);
CREATE INDEX IF NOT EXISTS idx_grain_lending_matches_status ON grain_lending_matches(status);

CREATE INDEX IF NOT EXISTS idx_grain_lender_earnings_lender ON grain_lender_earnings(lender_id);
CREATE INDEX IF NOT EXISTS idx_grain_lender_earnings_match ON grain_lender_earnings(match_id);
CREATE INDEX IF NOT EXISTS idx_grain_lender_earnings_date ON grain_lender_earnings(payment_date);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_grain_lending_pool_updated_at
  BEFORE UPDATE ON grain_lending_pool
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grain_lending_matches_updated_at
  BEFORE UPDATE ON grain_lending_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Views for analytics
CREATE OR REPLACE VIEW grain_lending_pool_stats AS
SELECT
  COUNT(*) as total_pools,
  COUNT(*) FILTER (WHERE status = 'active') as active_pools,
  SUM(grain_amount) as total_grain_pooled,
  SUM(grain_available) as total_grain_available,
  SUM(grain_locked) as total_grain_locked,
  AVG(annual_rate) as avg_rate,
  MIN(annual_rate) as min_rate,
  MAX(annual_rate) as max_rate,
  SUM(total_earnings) as total_platform_earnings,
  SUM(total_loans_backed) as total_loans_backed
FROM grain_lending_pool;

CREATE OR REPLACE VIEW grain_lender_performance AS
SELECT
  lender_id,
  lender_email,
  COUNT(DISTINCT id) as pools_count,
  SUM(grain_amount) as total_grain,
  SUM(grain_locked) as grain_in_use,
  SUM(total_earnings) as lifetime_earnings,
  SUM(total_loans_backed) as loans_backed,
  AVG(annual_rate) as avg_rate,
  MAX(created_at) as last_pool_created
FROM grain_lending_pool
GROUP BY lender_id, lender_email;

CREATE OR REPLACE VIEW active_grain_matches AS
SELECT
  m.*,
  glp.lender_name,
  glp.annual_rate as pool_rate,
  d.amount as loan_amount,
  d.deal_type as loan_type,
  d.status as loan_status
FROM grain_lending_matches m
JOIN grain_lending_pool glp ON m.lender_pool_id = glp.id
JOIN deals d ON m.loan_id = d.id
WHERE m.status = 'active';

-- Comments for documentation
COMMENT ON TABLE grain_lending_pool IS 'Lenders offering GRAIN to back others mortgages for yield';
COMMENT ON TABLE grain_collateral_locks IS 'All locked GRAIN tracking - both collateral and backing';
COMMENT ON TABLE grain_lending_matches IS 'Matches between GRAIN lenders and loan borrowers';
COMMENT ON TABLE grain_lender_earnings IS 'Historical earnings paid to GRAIN lenders';
