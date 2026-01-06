-- ============================================================================
-- RESTRICTED FUND TRACKING FOR GRAIN & VAULT ENDOWMENTS
-- Supports nonprofit fund accounting with proper restriction tracking
-- Fund Types: Unrestricted, Temporarily Restricted, Permanently Restricted
-- ============================================================================

-- ============================================================================
-- RESTRICTED FUNDS TABLE
-- Core fund definitions with restriction metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS restricted_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,                          -- Organization/endowment owner

  -- Fund Identity
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT,                                  -- Specific donor-defined purpose

  -- Restriction Type
  restriction_type TEXT NOT NULL CHECK (restriction_type IN (
    'unrestricted',           -- Can use for anything
    'temporarily_restricted', -- Donor-specified purpose, releases over time
    'permanently_restricted'  -- Principal can never be spent (true endowment)
  )),

  -- Donor Information (optional)
  donor_id UUID,
  donor_name TEXT,
  donor_anonymous BOOLEAN DEFAULT false,
  gift_date DATE,
  gift_agreement_url TEXT,                       -- Link to gift agreement/documentation

  -- Time-based Release (for temporarily restricted)
  release_schedule TEXT,                         -- 'immediate', 'annual', 'quarterly', 'milestone', 'custom'
  release_start_date DATE,
  release_end_date DATE,
  release_amount_per_period DECIMAL(20,2),

  -- Purpose-based Release (for temporarily restricted)
  purpose_fulfilled BOOLEAN DEFAULT false,
  purpose_fulfillment_date DATE,
  purpose_fulfillment_notes TEXT,

  -- For Permanently Restricted (Endowment)
  spending_policy TEXT,                          -- e.g., '5% of trailing 12-quarter average'
  spending_rate_percent DECIMAL(5,4),            -- e.g., 0.05 for 5%
  underwater_threshold DECIMAL(20,2),            -- Minimum corpus value before spending stops

  -- Linked Accounts
  linked_grant_ids UUID[],                       -- Grants funded by this fund
  linked_program_ids UUID[],                     -- Programs funded by this fund

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active',
    'frozen',                 -- Administrative hold
    'fully_released',         -- All restrictions released
    'closed'                  -- Fund closed/transferred
  )),

  -- Audit
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restricted_funds_org ON restricted_funds(org_id);
CREATE INDEX IF NOT EXISTS idx_restricted_funds_type ON restricted_funds(restriction_type);
CREATE INDEX IF NOT EXISTS idx_restricted_funds_status ON restricted_funds(status);
CREATE INDEX IF NOT EXISTS idx_restricted_funds_donor ON restricted_funds(donor_id);

-- ============================================================================
-- FUND BALANCES TABLE
-- Track multiple balance components per fund
-- ============================================================================

CREATE TABLE IF NOT EXISTS fund_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES restricted_funds(id) ON DELETE CASCADE,

  -- Core Balances
  protected_principal DECIMAL(20,2) DEFAULT 0,   -- Original gift/protected amount
  accumulated_earnings DECIMAL(20,2) DEFAULT 0,  -- Investment earnings
  appreciation DECIMAL(20,2) DEFAULT 0,          -- Unrealized gains
  credit_used DECIMAL(20,2) DEFAULT 0,           -- Credit line utilization

  -- Spending Tracking
  total_spent DECIMAL(20,2) DEFAULT 0,           -- Cumulative spending
  total_released DECIMAL(20,2) DEFAULT 0,        -- Restrictions released
  spendable_balance DECIMAL(20,2) DEFAULT 0,     -- Currently available to spend

  -- For Endowments
  corpus_value DECIMAL(20,2) DEFAULT 0,          -- Current total fund value
  is_underwater BOOLEAN DEFAULT false,           -- Corpus below original gift
  underwater_amount DECIMAL(20,2) DEFAULT 0,     -- How much underwater

  -- Market Values (for investments)
  cost_basis DECIMAL(20,2) DEFAULT 0,
  market_value DECIMAL(20,2) DEFAULT 0,
  unrealized_gain_loss DECIMAL(20,2) DEFAULT 0,

  -- Timestamps
  last_valuation_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(fund_id)
);

CREATE INDEX IF NOT EXISTS idx_fund_balances_fund ON fund_balances(fund_id);

-- ============================================================================
-- FUND TRANSACTIONS TABLE
-- All financial activity for a fund
-- ============================================================================

CREATE TABLE IF NOT EXISTS fund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES restricted_funds(id) ON DELETE CASCADE,

  -- Transaction Type
  type TEXT NOT NULL CHECK (type IN (
    'initial_gift',           -- Original contribution
    'additional_gift',        -- Subsequent contributions
    'investment_income',      -- Dividends, interest
    'realized_gain',          -- Investment gains
    'realized_loss',          -- Investment losses
    'appreciation',           -- Unrealized gains adjustment
    'depreciation',           -- Unrealized losses adjustment
    'grant_expense',          -- Spending via grants
    'program_expense',        -- Direct program spending
    'admin_fee',              -- Management/admin fees
    'transfer_in',            -- From another fund
    'transfer_out',           -- To another fund
    'restriction_release',    -- Move from restricted to unrestricted
    'credit_draw',            -- Credit line usage
    'credit_repayment'        -- Credit line repayment
  )),

  -- Amounts
  amount DECIMAL(20,2) NOT NULL,
  balance_after DECIMAL(20,2),                   -- Running balance

  -- Details
  description TEXT,
  reference_id TEXT,                             -- External reference (check #, wire ref, etc.)

  -- Related Entities
  related_grant_id UUID,
  related_program_id UUID,
  counterparty_fund_id UUID,                     -- For transfers

  -- Approval/Authorization
  approved_by UUID,
  approved_at TIMESTAMP,
  authorization_notes TEXT,

  -- Audit
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_transactions_fund ON fund_transactions(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_transactions_type ON fund_transactions(type);
CREATE INDEX IF NOT EXISTS idx_fund_transactions_created ON fund_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_transactions_grant ON fund_transactions(related_grant_id);

-- ============================================================================
-- RESTRICTION RELEASES TABLE
-- Track when and why restrictions are released
-- ============================================================================

CREATE TABLE IF NOT EXISTS restriction_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES restricted_funds(id) ON DELETE CASCADE,

  -- Release Details
  amount DECIMAL(20,2) NOT NULL,
  release_type TEXT NOT NULL CHECK (release_type IN (
    'time_based',             -- Scheduled release
    'purpose_fulfilled',      -- Purpose completed
    'board_approved',         -- Board discretionary release
    'donor_approved',         -- Donor modification
    'legal_requirement',      -- Court order, etc.
    'fund_termination'        -- Fund closure
  )),

  reason TEXT NOT NULL,
  supporting_documentation TEXT,                 -- URLs to supporting docs

  -- What the release is for
  destination_fund_id UUID,                      -- If transferring to another fund
  destination_type TEXT,                         -- 'unrestricted', 'program', 'grant'

  -- Authorization
  authorized_by UUID,
  authorization_date DATE,
  board_resolution_date DATE,
  board_resolution_reference TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'completed',
    'rejected',
    'cancelled'
  )),

  -- Audit
  released_at TIMESTAMP,
  released_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restriction_releases_fund ON restriction_releases(fund_id);
CREATE INDEX IF NOT EXISTS idx_restriction_releases_status ON restriction_releases(status);
CREATE INDEX IF NOT EXISTS idx_restriction_releases_date ON restriction_releases(released_at DESC);

-- ============================================================================
-- FUND ALLOCATIONS TABLE
-- Track how deposits are allocated across funds
-- ============================================================================

CREATE TABLE IF NOT EXISTS fund_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  deposit_id UUID,                               -- Reference to original deposit
  deposit_amount DECIMAL(20,2) NOT NULL,
  deposit_date DATE NOT NULL,
  donor_id UUID,

  -- Allocation
  fund_id UUID NOT NULL REFERENCES restricted_funds(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(20,2) NOT NULL,
  allocation_percentage DECIMAL(5,4),            -- e.g., 0.25 for 25%

  -- Purpose Designation
  designation TEXT,                              -- Specific designation within fund
  donor_intent TEXT,                             -- Donor's stated intent

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'confirmed',
    'deposited',
    'rejected'
  )),

  -- Audit
  allocated_by UUID,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_allocations_fund ON fund_allocations(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_allocations_deposit ON fund_allocations(deposit_id);
CREATE INDEX IF NOT EXISTS idx_fund_allocations_donor ON fund_allocations(donor_id);

-- ============================================================================
-- SPENDING VALIDATION TABLE
-- Pre-authorization checks for spending requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS spending_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES restricted_funds(id) ON DELETE CASCADE,

  -- Request Details
  requested_amount DECIMAL(20,2) NOT NULL,
  purpose TEXT NOT NULL,
  beneficiary TEXT,

  -- Validation Results
  is_valid BOOLEAN NOT NULL,
  validation_errors TEXT[],                      -- Array of error messages
  validation_warnings TEXT[],                    -- Array of warning messages

  -- Checks Performed
  restriction_check_passed BOOLEAN,
  balance_check_passed BOOLEAN,
  spending_policy_check_passed BOOLEAN,
  underwater_check_passed BOOLEAN,
  purpose_alignment_check_passed BOOLEAN,

  -- Available Amount
  max_spendable DECIMAL(20,2),
  recommended_amount DECIMAL(20,2),

  -- If Approved
  approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP,
  transaction_id UUID,                           -- Link to resulting transaction

  -- Audit
  requested_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spending_validations_fund ON spending_validations(fund_id);
CREATE INDEX IF NOT EXISTS idx_spending_validations_valid ON spending_validations(is_valid);

-- ============================================================================
-- FUNCTIONS: Calculate Spendable Balance
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_spendable_balance(p_fund_id UUID)
RETURNS TABLE (
  spendable DECIMAL(20,2),
  restriction_type TEXT,
  is_underwater BOOLEAN,
  corpus_value DECIMAL(20,2)
) AS $$
DECLARE
  v_fund restricted_funds%ROWTYPE;
  v_balance fund_balances%ROWTYPE;
  v_spendable DECIMAL(20,2);
BEGIN
  -- Get fund and balance
  SELECT * INTO v_fund FROM restricted_funds WHERE id = p_fund_id;
  SELECT * INTO v_balance FROM fund_balances WHERE fund_id = p_fund_id;

  IF v_fund IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL(20,2), 'unknown'::TEXT, false, 0::DECIMAL(20,2);
    RETURN;
  END IF;

  -- Calculate based on restriction type
  CASE v_fund.restriction_type
    WHEN 'unrestricted' THEN
      -- All balance is spendable
      v_spendable := COALESCE(v_balance.protected_principal, 0) +
                     COALESCE(v_balance.accumulated_earnings, 0) +
                     COALESCE(v_balance.appreciation, 0) -
                     COALESCE(v_balance.credit_used, 0) -
                     COALESCE(v_balance.total_spent, 0);

    WHEN 'temporarily_restricted' THEN
      -- Only released amounts are spendable
      v_spendable := COALESCE(v_balance.total_released, 0) - COALESCE(v_balance.total_spent, 0);

    WHEN 'permanently_restricted' THEN
      -- Only earnings/appreciation based on spending policy
      IF v_fund.spending_rate_percent IS NOT NULL THEN
        -- Apply spending rate to corpus (if not underwater)
        IF NOT COALESCE(v_balance.is_underwater, false) THEN
          v_spendable := COALESCE(v_balance.corpus_value, 0) * COALESCE(v_fund.spending_rate_percent, 0);
          -- Cap at accumulated earnings
          v_spendable := LEAST(v_spendable, COALESCE(v_balance.accumulated_earnings, 0) + COALESCE(v_balance.appreciation, 0));
        ELSE
          v_spendable := 0;
        END IF;
      ELSE
        v_spendable := 0;
      END IF;
  END CASE;

  -- Ensure non-negative
  v_spendable := GREATEST(v_spendable, 0);

  RETURN QUERY SELECT
    v_spendable,
    v_fund.restriction_type,
    COALESCE(v_balance.is_underwater, false),
    COALESCE(v_balance.corpus_value, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: Validate Spending
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_spending(
  p_fund_id UUID,
  p_amount DECIMAL(20,2),
  p_purpose TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  max_spendable DECIMAL(20,2),
  errors TEXT[],
  warnings TEXT[]
) AS $$
DECLARE
  v_fund restricted_funds%ROWTYPE;
  v_spendable_result RECORD;
  v_errors TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_is_valid BOOLEAN := true;
BEGIN
  -- Get fund
  SELECT * INTO v_fund FROM restricted_funds WHERE id = p_fund_id;

  IF v_fund IS NULL THEN
    v_errors := array_append(v_errors, 'Fund not found');
    RETURN QUERY SELECT false, 0::DECIMAL(20,2), v_errors, v_warnings;
    RETURN;
  END IF;

  -- Check fund status
  IF v_fund.status != 'active' THEN
    v_errors := array_append(v_errors, 'Fund is not active (status: ' || v_fund.status || ')');
    v_is_valid := false;
  END IF;

  -- Get spendable balance
  SELECT * INTO v_spendable_result FROM calculate_spendable_balance(p_fund_id);

  -- Check amount against spendable
  IF p_amount > v_spendable_result.spendable THEN
    v_errors := array_append(v_errors, 'Requested amount (' || p_amount || ') exceeds spendable balance (' || v_spendable_result.spendable || ')');
    v_is_valid := false;
  END IF;

  -- Check underwater status for endowments
  IF v_fund.restriction_type = 'permanently_restricted' AND v_spendable_result.is_underwater THEN
    v_errors := array_append(v_errors, 'Endowment is underwater - spending suspended');
    v_is_valid := false;
  END IF;

  -- Check purpose alignment for restricted funds
  IF v_fund.restriction_type != 'unrestricted' AND v_fund.purpose IS NOT NULL THEN
    IF p_purpose IS NULL OR p_purpose = '' THEN
      v_warnings := array_append(v_warnings, 'Purpose not specified for restricted fund spending');
    END IF;
  END IF;

  -- Warn if spending more than 50% of available
  IF p_amount > v_spendable_result.spendable * 0.5 THEN
    v_warnings := array_append(v_warnings, 'Large spending request (> 50% of available balance)');
  END IF;

  RETURN QUERY SELECT v_is_valid, v_spendable_result.spendable, v_errors, v_warnings;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: Process Scheduled Releases
-- ============================================================================

CREATE OR REPLACE FUNCTION process_scheduled_releases()
RETURNS INTEGER AS $$
DECLARE
  v_fund RECORD;
  v_release_count INTEGER := 0;
  v_release_amount DECIMAL(20,2);
BEGIN
  -- Find funds with time-based releases due
  FOR v_fund IN
    SELECT rf.*, fb.protected_principal, fb.total_released
    FROM restricted_funds rf
    JOIN fund_balances fb ON fb.fund_id = rf.id
    WHERE rf.restriction_type = 'temporarily_restricted'
      AND rf.release_schedule IS NOT NULL
      AND rf.release_schedule != 'milestone'
      AND rf.status = 'active'
      AND rf.release_start_date <= CURRENT_DATE
      AND (rf.release_end_date IS NULL OR rf.release_end_date >= CURRENT_DATE)
  LOOP
    -- Calculate release amount based on schedule
    v_release_amount := COALESCE(v_fund.release_amount_per_period, 0);

    IF v_release_amount > 0 AND
       (v_fund.total_released + v_release_amount) <= v_fund.protected_principal THEN

      -- Create release record
      INSERT INTO restriction_releases (
        fund_id,
        amount,
        release_type,
        reason,
        status,
        released_at
      ) VALUES (
        v_fund.id,
        v_release_amount,
        'time_based',
        'Scheduled ' || v_fund.release_schedule || ' release',
        'completed',
        NOW()
      );

      -- Update balance
      UPDATE fund_balances
      SET total_released = total_released + v_release_amount,
          spendable_balance = spendable_balance + v_release_amount,
          updated_at = NOW()
      WHERE fund_id = v_fund.id;

      -- Create transaction
      INSERT INTO fund_transactions (
        fund_id,
        type,
        amount,
        description
      ) VALUES (
        v_fund.id,
        'restriction_release',
        v_release_amount,
        'Scheduled ' || v_fund.release_schedule || ' release'
      );

      v_release_count := v_release_count + 1;
    END IF;
  END LOOP;

  RETURN v_release_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Update Balance Timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_fund_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fund_balance_updated
BEFORE UPDATE ON fund_balances
FOR EACH ROW
EXECUTE FUNCTION update_fund_balance_timestamp();

-- ============================================================================
-- TRIGGER: Update Fund Timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_restricted_fund_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restricted_fund_updated
BEFORE UPDATE ON restricted_funds
FOR EACH ROW
EXECUTE FUNCTION update_restricted_fund_timestamp();

-- ============================================================================
-- VIEW: Fund Summary with Balances
-- ============================================================================

CREATE OR REPLACE VIEW v_fund_summary AS
SELECT
  rf.id,
  rf.org_id,
  rf.name,
  rf.description,
  rf.restriction_type,
  rf.purpose,
  rf.donor_name,
  rf.status,
  rf.created_at,
  fb.protected_principal,
  fb.accumulated_earnings,
  fb.appreciation,
  fb.total_spent,
  fb.total_released,
  fb.spendable_balance,
  fb.corpus_value,
  fb.is_underwater,
  fb.market_value,
  (SELECT spendable FROM calculate_spendable_balance(rf.id)) as calculated_spendable,
  (SELECT COUNT(*) FROM fund_transactions WHERE fund_id = rf.id) as transaction_count,
  (SELECT COUNT(*) FROM restriction_releases WHERE fund_id = rf.id AND status = 'completed') as release_count
FROM restricted_funds rf
LEFT JOIN fund_balances fb ON fb.fund_id = rf.id;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to insert sample data
/*
INSERT INTO restricted_funds (org_id, name, restriction_type, purpose, donor_name) VALUES
  (gen_random_uuid(), 'General Operations Fund', 'unrestricted', NULL, NULL),
  (gen_random_uuid(), 'Smith Family Scholarship', 'temporarily_restricted', 'Scholarships for first-generation students', 'Smith Family Foundation'),
  (gen_random_uuid(), 'Johnson Endowment', 'permanently_restricted', 'General endowment support', 'Robert Johnson Estate');
*/
