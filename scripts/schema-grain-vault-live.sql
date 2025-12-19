-- ============================================================================
-- GRAIN & VAULT LIVE PAYMENTS SCHEMA
-- Extends grain-vault schema for live payment processing
-- ============================================================================

-- ============================================================================
-- LINKED BANK ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS linked_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,

  -- Stripe Integration
  stripe_payment_method_id TEXT UNIQUE,

  -- Bank Details
  institution_name TEXT NOT NULL,
  account_name TEXT,
  account_mask TEXT NOT NULL, -- Last 4 digits
  account_type TEXT DEFAULT 'checking', -- 'checking', 'savings'
  routing_number TEXT,

  -- Verification
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'removed', 'expired'

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linked_banks_account ON linked_bank_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_linked_banks_stripe ON linked_bank_accounts(stripe_payment_method_id);

-- ============================================================================
-- ADD COLUMNS TO TREASURY_ACCOUNTS
-- ============================================================================

-- Add Stripe customer ID if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treasury_accounts' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE treasury_accounts ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- Add Circle wallet IDs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treasury_accounts' AND column_name = 'circle_wallet_id'
  ) THEN
    ALTER TABLE treasury_accounts ADD COLUMN circle_wallet_id TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treasury_accounts' AND column_name = 'circle_wallet_set_id'
  ) THEN
    ALTER TABLE treasury_accounts ADD COLUMN circle_wallet_set_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_treasury_stripe_customer ON treasury_accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_treasury_circle_wallet ON treasury_accounts(circle_wallet_id);

-- ============================================================================
-- ADD COLUMNS TO GRAIN_TRANSACTIONS
-- ============================================================================

-- Add Stripe payment intent ID if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grain_transactions' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE grain_transactions ADD COLUMN stripe_payment_intent_id TEXT;
  END IF;
END $$;

-- Add Circle transfer ID if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grain_transactions' AND column_name = 'circle_transfer_id'
  ) THEN
    ALTER TABLE grain_transactions ADD COLUMN circle_transfer_id TEXT;
  END IF;
END $$;

-- Add linked bank reference if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grain_transactions' AND column_name = 'linked_bank_id'
  ) THEN
    ALTER TABLE grain_transactions ADD COLUMN linked_bank_id UUID REFERENCES linked_bank_accounts(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grain_tx_stripe ON grain_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_grain_tx_circle ON grain_transactions(circle_transfer_id);

-- ============================================================================
-- PAYMENT AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  account_id UUID REFERENCES treasury_accounts(id),
  transaction_id UUID REFERENCES grain_transactions(id),

  -- Event Details
  event_type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'conversion', 'error'
  event_source TEXT NOT NULL, -- 'stripe', 'circle', 'plaid', 'internal'
  event_data JSONB,

  -- Request Context
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_account ON payment_audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_transaction ON payment_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON payment_audit_log(created_at DESC);

-- ============================================================================
-- DAILY LIMITS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES treasury_accounts(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Totals for the day
  total_deposits DECIMAL(20,2) DEFAULT 0,
  total_withdrawals DECIMAL(20,2) DEFAULT 0,
  deposit_count INTEGER DEFAULT 0,
  withdrawal_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_limits_account_date ON daily_limit_tracking(account_id, date);

-- ============================================================================
-- FUNCTION: Update Daily Limits
-- ============================================================================

CREATE OR REPLACE FUNCTION update_daily_limits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.type = 'deposit' THEN
      INSERT INTO daily_limit_tracking (account_id, date, total_deposits, deposit_count)
      VALUES (NEW.account_id, CURRENT_DATE, NEW.usd_amount, 1)
      ON CONFLICT (account_id, date)
      DO UPDATE SET
        total_deposits = daily_limit_tracking.total_deposits + NEW.usd_amount,
        deposit_count = daily_limit_tracking.deposit_count + 1,
        updated_at = NOW();
    ELSIF NEW.type = 'withdraw' THEN
      INSERT INTO daily_limit_tracking (account_id, date, total_withdrawals, withdrawal_count)
      VALUES (NEW.account_id, CURRENT_DATE, NEW.usd_amount, 1)
      ON CONFLICT (account_id, date)
      DO UPDATE SET
        total_withdrawals = daily_limit_tracking.total_withdrawals + NEW.usd_amount,
        withdrawal_count = daily_limit_tracking.withdrawal_count + 1,
        updated_at = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for daily limits
DROP TRIGGER IF EXISTS trigger_update_daily_limits ON grain_transactions;
CREATE TRIGGER trigger_update_daily_limits
AFTER UPDATE ON grain_transactions
FOR EACH ROW
EXECUTE FUNCTION update_daily_limits();

-- ============================================================================
-- FUNCTION: Check Daily Limits
-- ============================================================================

CREATE OR REPLACE FUNCTION check_daily_limits(
  p_account_id UUID,
  p_amount DECIMAL,
  p_type TEXT -- 'deposit' or 'withdraw'
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_total DECIMAL,
  daily_limit DECIMAL,
  remaining DECIMAL
) AS $$
DECLARE
  v_current_total DECIMAL;
  v_daily_limit DECIMAL;
BEGIN
  -- Get current day's total
  IF p_type = 'deposit' THEN
    SELECT COALESCE(total_deposits, 0) INTO v_current_total
    FROM daily_limit_tracking
    WHERE account_id = p_account_id AND date = CURRENT_DATE;

    SELECT daily_deposit_limit INTO v_daily_limit
    FROM treasury_accounts
    WHERE id = p_account_id;
  ELSE
    SELECT COALESCE(total_withdrawals, 0) INTO v_current_total
    FROM daily_limit_tracking
    WHERE account_id = p_account_id AND date = CURRENT_DATE;

    SELECT daily_withdraw_limit INTO v_daily_limit
    FROM treasury_accounts
    WHERE id = p_account_id;
  END IF;

  v_current_total := COALESCE(v_current_total, 0);
  v_daily_limit := COALESCE(v_daily_limit, 10000);

  RETURN QUERY SELECT
    (v_current_total + p_amount) <= v_daily_limit,
    v_current_total,
    v_daily_limit,
    GREATEST(0, v_daily_limit - v_current_total);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- WEBHOOK EVENTS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  provider TEXT NOT NULL, -- 'stripe', 'circle', 'plaid'
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,

  -- Payload
  payload JSONB NOT NULL,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  error TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_created ON webhook_events(created_at DESC);
