-- ============================================================================
-- GRAIN & VAULT SCHEMA
-- Treasury infrastructure with proper GRAIN economics
-- ============================================================================

-- ============================================================================
-- TREASURY ACCOUNTS (Users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS treasury_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL,
  date_of_birth DATE,

  -- Identity
  ssn_last_four TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',

  -- Financial Profile
  employment_status TEXT, -- 'employed', 'self-employed', 'retired', 'student', 'other'
  annual_income_range TEXT, -- 'under_50k', '50k_100k', '100k_250k', '250k_plus'
  net_worth_range TEXT, -- 'under_100k', '100k_500k', '500k_1m', '1m_plus'
  investment_experience TEXT, -- 'none', 'beginner', 'intermediate', 'experienced'
  source_of_funds TEXT, -- 'salary', 'business', 'investments', 'inheritance', 'other'

  -- Account
  wallet_address TEXT UNIQUE NOT NULL,
  grain_balance DECIMAL(24,6) DEFAULT 0,
  usd_balance DECIMAL(20,2) DEFAULT 0,
  average_purchase_price DECIMAL(20,10) DEFAULT 0, -- Track cost basis

  -- Verification
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  identity_verified BOOLEAN DEFAULT false,
  verification_level TEXT DEFAULT 'basic', -- 'basic', 'intermediate', 'advanced'

  -- Limits (based on verification level)
  daily_deposit_limit DECIMAL(20,2) DEFAULT 10000,
  daily_withdraw_limit DECIMAL(20,2) DEFAULT 10000,
  lifetime_deposit_limit DECIMAL(20,2) DEFAULT 50000,

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'suspended', 'closed'
  terms_accepted_at TIMESTAMP,
  onboarding_completed_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_accounts_email ON treasury_accounts(email);
CREATE INDEX IF NOT EXISTS idx_treasury_accounts_wallet ON treasury_accounts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_treasury_accounts_status ON treasury_accounts(status);

-- ============================================================================
-- TREASURY BACKING (The reserves that back GRAIN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS treasury_backing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Asset Info
  asset_type TEXT NOT NULL, -- 'usd_cash', 't_bills', 'stablecoin', 'money_market', 'commercial_paper'
  asset_name TEXT NOT NULL, -- e.g., 'USDC', '3-Month T-Bill', 'Money Market Fund'
  amount DECIMAL(24,2) NOT NULL,

  -- Yield Info (optional - this is NOT paid to users, it grows the treasury)
  apy DECIMAL(8,6) DEFAULT 0,
  accrued_interest DECIMAL(24,2) DEFAULT 0,

  -- Custody
  custodian TEXT, -- e.g., 'Circle', 'State Street', 'BNY Mellon'
  custody_account TEXT,

  -- Verification
  last_verified TIMESTAMP DEFAULT NOW(),
  verification_method TEXT, -- 'blockchain', 'bank_statement', 'custodian_api'
  verification_proof TEXT, -- URL to proof or transaction hash

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'maturing', 'matured', 'withdrawn'

  -- Source tracking
  source TEXT, -- 'circle_card_deposit', 'circle_transfer', 'wire_transfer', 'manual'
  circle_reference_id TEXT, -- Circle payment/transfer ID

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_backing_type ON treasury_backing(asset_type);
CREATE INDEX IF NOT EXISTS idx_treasury_backing_status ON treasury_backing(status);
CREATE INDEX IF NOT EXISTS idx_treasury_backing_circle_ref ON treasury_backing(circle_reference_id);

-- Add source columns to existing table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treasury_backing' AND column_name = 'source'
  ) THEN
    ALTER TABLE treasury_backing ADD COLUMN source TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treasury_backing' AND column_name = 'circle_reference_id'
  ) THEN
    ALTER TABLE treasury_backing ADD COLUMN circle_reference_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_treasury_backing_circle_ref ON treasury_backing(circle_reference_id);
  END IF;
END $$;

-- ============================================================================
-- GRAIN PRICE HISTORY (Track GRAIN appreciation over time)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grain_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Price Data
  price_usd DECIMAL(20,10) NOT NULL,
  total_treasury_usd DECIMAL(24,2) NOT NULL,
  circulating_supply DECIMAL(24,6) NOT NULL,

  -- Metadata
  recorded_at TIMESTAMP DEFAULT NOW(),
  recording_method TEXT DEFAULT 'automatic' -- 'automatic', 'manual', 'system'
);

CREATE INDEX IF NOT EXISTS idx_grain_price_history_recorded ON grain_price_history(recorded_at DESC);

-- ============================================================================
-- GRAIN TRANSACTIONS (All GRAIN activity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  account_id UUID NOT NULL REFERENCES treasury_accounts(id),

  -- Transaction Details
  type TEXT NOT NULL, -- 'deposit', 'withdraw', 'buy_grain', 'sell_grain', 'transfer_in', 'transfer_out'

  -- Amounts
  usd_amount DECIMAL(20,2),
  grain_amount DECIMAL(24,6),
  grain_price DECIMAL(20,10) NOT NULL, -- Price at time of transaction
  fee_usd DECIMAL(20,2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'

  -- Payment Method (for deposits/withdrawals)
  payment_method TEXT, -- 'bank_transfer', 'wire', 'card', 'crypto'
  payment_reference TEXT,

  -- Metadata
  description TEXT,
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grain_transactions_account ON grain_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_grain_transactions_type ON grain_transactions(type);
CREATE INDEX IF NOT EXISTS idx_grain_transactions_status ON grain_transactions(status);
CREATE INDEX IF NOT EXISTS idx_grain_transactions_created ON grain_transactions(created_at DESC);

-- ============================================================================
-- ONBOARDING STATE (Track onboarding progress)
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email TEXT UNIQUE NOT NULL,

  -- Progress
  current_step TEXT DEFAULT 'basic_info', -- 'basic_info', 'identity', 'financial', 'wallet', 'deposit'
  completed_steps TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Collected Data (stored temporarily during onboarding)
  basic_info JSONB,
  identity_info JSONB,
  financial_info JSONB,
  wallet_info JSONB,

  -- Verification Tokens
  email_verification_token TEXT,
  email_verified BOOLEAN DEFAULT false,
  phone_verification_token TEXT,
  phone_verified BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboarding_email ON onboarding_state(email);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_state(status);

-- ============================================================================
-- FUNCTIONS: Calculate GRAIN Price
-- ============================================================================

CREATE OR REPLACE FUNCTION get_grain_price()
RETURNS TABLE (
  price_usd DECIMAL(20,10),
  total_treasury DECIMAL(24,2),
  circulating_supply DECIMAL(24,6),
  change_24h DECIMAL(10,4)
) AS $$
DECLARE
  v_total_treasury DECIMAL(24,2);
  v_circulating_supply DECIMAL(24,6);
  v_current_price DECIMAL(20,10);
  v_price_24h_ago DECIMAL(20,10);
  v_change_24h DECIMAL(10,4);
BEGIN
  -- Get total treasury value (sum of all active backing)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_treasury
  FROM treasury_backing
  WHERE status = 'active';

  -- Get circulating supply (sum of all GRAIN balances)
  SELECT COALESCE(SUM(grain_balance), 1) INTO v_circulating_supply
  FROM treasury_accounts
  WHERE status = 'active';

  -- Ensure we don't divide by zero
  IF v_circulating_supply = 0 THEN
    v_circulating_supply := 1;
  END IF;

  -- Calculate current price: Treasury / Supply
  v_current_price := v_total_treasury / v_circulating_supply;

  -- Get price 24h ago
  SELECT price_usd INTO v_price_24h_ago
  FROM grain_price_history
  WHERE recorded_at <= NOW() - INTERVAL '24 hours'
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Calculate 24h change percentage
  IF v_price_24h_ago IS NOT NULL AND v_price_24h_ago > 0 THEN
    v_change_24h := ((v_current_price - v_price_24h_ago) / v_price_24h_ago) * 100;
  ELSE
    v_change_24h := 0;
  END IF;

  RETURN QUERY SELECT v_current_price, v_total_treasury, v_circulating_supply, v_change_24h;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: Record GRAIN Price (run periodically)
-- ============================================================================

CREATE OR REPLACE FUNCTION record_grain_price()
RETURNS UUID AS $$
DECLARE
  v_price_data RECORD;
  v_new_id UUID;
BEGIN
  -- Get current price
  SELECT * INTO v_price_data FROM get_grain_price() LIMIT 1;

  -- Insert into history
  INSERT INTO grain_price_history (
    price_usd,
    total_treasury_usd,
    circulating_supply,
    recorded_at
  ) VALUES (
    v_price_data.price_usd,
    v_price_data.total_treasury,
    v_price_data.circulating_supply,
    NOW()
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: Update Account Balances After Transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION update_account_balance_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Buy GRAIN: Deduct USD, add GRAIN
    IF NEW.type = 'buy_grain' THEN
      UPDATE treasury_accounts
      SET
        usd_balance = usd_balance - NEW.usd_amount - NEW.fee_usd,
        grain_balance = grain_balance + NEW.grain_amount,
        -- Update average purchase price (cost basis)
        average_purchase_price = (
          (average_purchase_price * grain_balance + NEW.grain_price * NEW.grain_amount) /
          (grain_balance + NEW.grain_amount)
        ),
        updated_at = NOW()
      WHERE id = NEW.account_id;

    -- Sell GRAIN: Deduct GRAIN, add USD
    ELSIF NEW.type = 'sell_grain' THEN
      UPDATE treasury_accounts
      SET
        grain_balance = grain_balance - NEW.grain_amount,
        usd_balance = usd_balance + NEW.usd_amount - NEW.fee_usd,
        updated_at = NOW()
      WHERE id = NEW.account_id;

    -- Deposit USD
    ELSIF NEW.type = 'deposit' THEN
      UPDATE treasury_accounts
      SET
        usd_balance = usd_balance + NEW.usd_amount,
        updated_at = NOW()
      WHERE id = NEW.account_id;

    -- Withdraw USD
    ELSIF NEW.type = 'withdraw' THEN
      UPDATE treasury_accounts
      SET
        usd_balance = usd_balance - NEW.usd_amount - NEW.fee_usd,
        updated_at = NOW()
      WHERE id = NEW.account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_balance_after_transaction
AFTER UPDATE ON grain_transactions
FOR EACH ROW
EXECUTE FUNCTION update_account_balance_from_transaction();

-- ============================================================================
-- SEED DATA: Initial Treasury Backing
-- ============================================================================

-- Start with $1M in treasury backing
INSERT INTO treasury_backing (asset_type, asset_name, amount, custodian, verification_method)
VALUES
  ('usd_cash', 'USD Cash Reserve', 500000.00, 'Silicon Valley Bank', 'bank_statement'),
  ('t_bills', '3-Month US Treasury Bills', 300000.00, 'BNY Mellon', 'custodian_api'),
  ('stablecoin', 'USDC', 200000.00, 'Circle', 'blockchain')
ON CONFLICT DO NOTHING;

-- Record initial GRAIN price (assumes 1M GRAIN minted initially)
-- Price = $1,000,000 / 1,000,000 = $1.00
INSERT INTO grain_price_history (price_usd, total_treasury_usd, circulating_supply)
VALUES (1.0000000000, 1000000.00, 1000000.000000)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PERIODIC TASK: Record GRAIN price every hour
-- ============================================================================
-- Note: In production, set up a cron job or scheduled task to call:
-- SELECT record_grain_price();
