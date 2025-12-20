-- ============================================================================
-- GRAIN & VAULT KYC/AML SCHEMA
-- Enterprise-grade user profiles and compliance tracking
-- Run: psql $POSTGRES_URL < scripts/schema-grain-kyc.sql
-- ============================================================================

-- ============================================================================
-- GRAIN USER PROFILES
-- Complete KYC/AML data for regulatory compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Clerk Integration
  user_id TEXT NOT NULL UNIQUE,
  clerk_user_id TEXT NOT NULL,

  -- Personal Information (PII - encrypted at rest)
  email TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE NOT NULL,

  -- Government ID
  ssn_last_four TEXT,
  ssn_hash TEXT, -- Hashed full SSN for verification
  government_id_type TEXT CHECK (government_id_type IN ('drivers_license', 'passport', 'state_id', 'military_id')),
  government_id_number_hash TEXT,
  government_id_expiry DATE,
  government_id_verified BOOLEAN DEFAULT FALSE,

  -- Address (Required for KYC Level 2+)
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  address_verified BOOLEAN DEFAULT FALSE,
  address_verification_date TIMESTAMP,

  -- Financial Profile (Required for KYC Level 3+)
  employment_status TEXT CHECK (employment_status IN ('employed', 'self-employed', 'retired', 'student', 'unemployed', 'other')),
  employer_name TEXT,
  occupation TEXT,
  annual_income_range TEXT CHECK (annual_income_range IN ('under_25k', '25k_50k', '50k_100k', '100k_250k', '250k_500k', '500k_1m', '1m_plus')),
  net_worth_range TEXT CHECK (net_worth_range IN ('under_50k', '50k_100k', '100k_500k', '500k_1m', '1m_5m', '5m_plus')),
  investment_experience TEXT CHECK (investment_experience IN ('none', 'beginner', 'intermediate', 'experienced', 'professional')),
  source_of_funds TEXT CHECK (source_of_funds IN ('salary', 'business', 'investments', 'inheritance', 'gift', 'savings', 'other')),
  source_of_funds_detail TEXT,

  -- Risk Profile
  investment_objectives TEXT CHECK (investment_objectives IN ('preservation', 'income', 'growth', 'speculation')),
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  time_horizon TEXT CHECK (time_horizon IN ('short', 'medium', 'long')),

  -- Verification Levels
  -- Level 1: Email verified, basic info ($1K daily limit)
  -- Level 2: Phone + Address verified ($10K daily limit)
  -- Level 3: Full KYC + ID verified ($100K daily limit)
  -- Level 4: Enhanced due diligence (unlimited)
  verification_level INTEGER DEFAULT 1 CHECK (verification_level BETWEEN 1 AND 4),
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'in_review', 'approved', 'rejected', 'suspended')),
  verification_notes TEXT,
  verification_documents JSONB DEFAULT '[]',

  -- Transaction Limits (in USD)
  daily_deposit_limit DECIMAL(20, 2) DEFAULT 1000,
  daily_withdraw_limit DECIMAL(20, 2) DEFAULT 1000,
  monthly_deposit_limit DECIMAL(20, 2) DEFAULT 10000,
  monthly_withdraw_limit DECIMAL(20, 2) DEFAULT 10000,
  lifetime_deposit_limit DECIMAL(20, 2) DEFAULT 50000,

  -- Compliance Tracking
  pep_status BOOLEAN DEFAULT FALSE, -- Politically Exposed Person
  pep_details TEXT,
  sanctions_check_date TIMESTAMP,
  sanctions_check_result TEXT CHECK (sanctions_check_result IN ('clear', 'match', 'review')),
  aml_risk_score INTEGER CHECK (aml_risk_score BETWEEN 0 AND 100),

  -- Account Status
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'frozen', 'closed')),
  suspension_reason TEXT,

  -- Terms & Agreements
  terms_version TEXT DEFAULT '1.0',
  terms_accepted_at TIMESTAMP,
  privacy_policy_version TEXT DEFAULT '1.0',
  privacy_policy_accepted_at TIMESTAMP,
  marketing_consent BOOLEAN DEFAULT FALSE,

  -- Audit Trail
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  created_by TEXT,
  updated_by TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_user_id ON grain_user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_clerk_id ON grain_user_profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_email ON grain_user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_phone ON grain_user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_verification ON grain_user_profiles(verification_level, verification_status);
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_status ON grain_user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_created ON grain_user_profiles(created_at DESC);

-- ============================================================================
-- GRAIN TREASURY EVENTS
-- Audit log for all treasury operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_treasury_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event Type
  type TEXT NOT NULL CHECK (type IN (
    'usdc_deposit', 'usdc_withdraw',
    'grain_mint', 'grain_burn',
    'asset_purchase', 'asset_sale', 'asset_revaluation',
    'interest_accrual', 'fee_capture',
    'pending_deposit', 'pending_withdrawal',
    'compliance_hold', 'compliance_release',
    'system_adjustment', 'audit_entry'
  )),

  -- Amount
  amount DECIMAL(20, 6) NOT NULL,
  currency TEXT DEFAULT 'USDC',

  -- References
  user_id TEXT,
  circle_transfer_id TEXT,
  transaction_hash TEXT,

  -- Details
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_grain_treasury_events_type ON grain_treasury_events(type);
CREATE INDEX IF NOT EXISTS idx_grain_treasury_events_user ON grain_treasury_events(user_id);
CREATE INDEX IF NOT EXISTS idx_grain_treasury_events_circle ON grain_treasury_events(circle_transfer_id);
CREATE INDEX IF NOT EXISTS idx_grain_treasury_events_created ON grain_treasury_events(created_at DESC);

-- ============================================================================
-- GRAIN ASSET HOLDINGS
-- Real assets backing GRAIN (real estate, treasuries, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_asset_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Asset Type
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'real_estate', 'treasury_bills', 'money_market',
    'corporate_bonds', 'usdc_reserve', 'other'
  )),

  -- Asset Details
  name TEXT NOT NULL,
  description TEXT,

  -- Valuation
  purchase_price DECIMAL(20, 2) NOT NULL,
  purchase_date DATE NOT NULL,
  current_value DECIMAL(20, 2) NOT NULL,
  last_valuation_date DATE NOT NULL,
  valuation_method TEXT CHECK (valuation_method IN ('market', 'appraisal', 'cost', 'dcf')),

  -- Income
  annual_yield_percent DECIMAL(5, 2),
  last_income_date DATE,
  total_income_received DECIMAL(20, 2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'impaired')),

  -- External References
  external_id TEXT,
  external_system TEXT,

  -- Documents
  documents JSONB DEFAULT '[]',

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_asset_holdings_type ON grain_asset_holdings(asset_type);
CREATE INDEX IF NOT EXISTS idx_grain_asset_holdings_status ON grain_asset_holdings(status);
CREATE INDEX IF NOT EXISTS idx_grain_asset_holdings_valuation ON grain_asset_holdings(last_valuation_date);

-- ============================================================================
-- GRAIN VERIFICATION REQUESTS
-- Track ID verification submissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User
  user_id TEXT NOT NULL,
  profile_id UUID REFERENCES grain_user_profiles(id),

  -- Request Type
  verification_type TEXT NOT NULL CHECK (verification_type IN (
    'email', 'phone', 'identity', 'address', 'source_of_funds', 'enhanced_due_diligence'
  )),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),

  -- Documents
  documents JSONB DEFAULT '[]',

  -- Review
  reviewer_id TEXT,
  reviewer_notes TEXT,
  rejection_reason TEXT,

  -- Timestamps
  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  expires_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_verification_user ON grain_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_grain_verification_status ON grain_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_grain_verification_type ON grain_verification_requests(verification_type);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_grain_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_grain_user_profiles_updated_at
  BEFORE UPDATE ON grain_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_grain_updated_at();

CREATE TRIGGER update_grain_asset_holdings_updated_at
  BEFORE UPDATE ON grain_asset_holdings
  FOR EACH ROW EXECUTE FUNCTION update_grain_updated_at();

CREATE TRIGGER update_grain_verification_updated_at
  BEFORE UPDATE ON grain_verification_requests
  FOR EACH ROW EXECUTE FUNCTION update_grain_updated_at();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate user limits based on verification level
CREATE OR REPLACE FUNCTION calculate_user_limits(p_verification_level INTEGER)
RETURNS TABLE(
  daily_deposit DECIMAL,
  daily_withdraw DECIMAL,
  monthly_deposit DECIMAL,
  monthly_withdraw DECIMAL,
  lifetime_deposit DECIMAL
) AS $$
BEGIN
  CASE p_verification_level
    WHEN 1 THEN
      RETURN QUERY SELECT 1000::DECIMAL, 1000::DECIMAL, 10000::DECIMAL, 10000::DECIMAL, 50000::DECIMAL;
    WHEN 2 THEN
      RETURN QUERY SELECT 10000::DECIMAL, 10000::DECIMAL, 100000::DECIMAL, 100000::DECIMAL, 500000::DECIMAL;
    WHEN 3 THEN
      RETURN QUERY SELECT 100000::DECIMAL, 100000::DECIMAL, 1000000::DECIMAL, 1000000::DECIMAL, 5000000::DECIMAL;
    WHEN 4 THEN
      RETURN QUERY SELECT 1000000::DECIMAL, 1000000::DECIMAL, 10000000::DECIMAL, 10000000::DECIMAL, 100000000::DECIMAL;
    ELSE
      RETURN QUERY SELECT 1000::DECIMAL, 1000::DECIMAL, 10000::DECIMAL, 10000::DECIMAL, 50000::DECIMAL;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update user limits when verification level changes
CREATE OR REPLACE FUNCTION update_user_limits_on_verification()
RETURNS TRIGGER AS $$
DECLARE
  limits RECORD;
BEGIN
  IF NEW.verification_level != OLD.verification_level THEN
    SELECT * INTO limits FROM calculate_user_limits(NEW.verification_level);

    NEW.daily_deposit_limit := limits.daily_deposit;
    NEW.daily_withdraw_limit := limits.daily_withdraw;
    NEW.monthly_deposit_limit := limits.monthly_deposit;
    NEW.monthly_withdraw_limit := limits.monthly_withdraw;
    NEW.lifetime_deposit_limit := limits.lifetime_deposit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_user_limits
  BEFORE UPDATE ON grain_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_limits_on_verification();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE grain_user_profiles IS 'Complete KYC/AML user profiles for Grain & Vault regulatory compliance';
COMMENT ON TABLE grain_treasury_events IS 'Immutable audit log of all treasury operations';
COMMENT ON TABLE grain_asset_holdings IS 'Real assets backing GRAIN token value';
COMMENT ON TABLE grain_verification_requests IS 'ID verification and document submission tracking';

COMMENT ON COLUMN grain_user_profiles.verification_level IS 'L1: Email ($1K), L2: Phone+Address ($10K), L3: Full KYC ($100K), L4: Enhanced DD (unlimited)';
COMMENT ON COLUMN grain_user_profiles.pep_status IS 'Politically Exposed Person - requires enhanced monitoring';
COMMENT ON COLUMN grain_user_profiles.aml_risk_score IS 'Anti-Money Laundering risk score 0-100, higher = more risk';
