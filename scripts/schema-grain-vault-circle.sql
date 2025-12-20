-- ============================================================================
-- GRAIN & VAULT - CIRCLE-ONLY PAYMENTS SCHEMA
-- Uses Circle for all payments (no Stripe)
-- ============================================================================

-- ============================================================================
-- ADD CIRCLE COLUMNS TO TREASURY_ACCOUNTS
-- ============================================================================

-- Circle wallet IDs
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treasury_accounts' AND column_name = 'circle_user_token'
  ) THEN
    ALTER TABLE treasury_accounts ADD COLUMN circle_user_token TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_treasury_circle_wallet ON treasury_accounts(circle_wallet_id);

-- ============================================================================
-- ADD CIRCLE COLUMNS TO GRAIN_TRANSACTIONS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grain_transactions' AND column_name = 'circle_transfer_id'
  ) THEN
    ALTER TABLE grain_transactions ADD COLUMN circle_transfer_id TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grain_transactions' AND column_name = 'circle_payout_id'
  ) THEN
    ALTER TABLE grain_transactions ADD COLUMN circle_payout_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grain_tx_circle ON grain_transactions(circle_transfer_id);

-- ============================================================================
-- CIRCLE WEBHOOK EVENTS (IDEMPOTENCY TABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Circle notification ID (unique per webhook delivery)
  notification_id TEXT NOT NULL,

  -- Event Details
  event_type TEXT NOT NULL,
  circle_event_id TEXT,

  -- Payload (optional - for debugging)
  payload JSONB,

  -- Processing Status
  processed BOOLEAN DEFAULT false,
  success BOOLEAN,
  action_taken TEXT,

  -- Associated data
  user_id TEXT,
  amount DECIMAL(20,6),

  -- Error tracking
  error_message TEXT,

  -- Timestamps
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(notification_id)
);

-- Indexes for webhook processing
CREATE INDEX IF NOT EXISTS idx_circle_events_notification ON circle_webhook_events(notification_id);
CREATE INDEX IF NOT EXISTS idx_circle_events_type ON circle_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_circle_events_processed ON circle_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_circle_events_user ON circle_webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_events_created ON circle_webhook_events(created_at DESC);

-- Add new columns to existing table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'notification_id'
  ) THEN
    ALTER TABLE circle_webhook_events ADD COLUMN notification_id TEXT;
    ALTER TABLE circle_webhook_events ADD CONSTRAINT unique_notification_id UNIQUE (notification_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'circle_event_id'
  ) THEN
    ALTER TABLE circle_webhook_events ADD COLUMN circle_event_id TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'success'
  ) THEN
    ALTER TABLE circle_webhook_events ADD COLUMN success BOOLEAN;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'action_taken'
  ) THEN
    ALTER TABLE circle_webhook_events ADD COLUMN action_taken TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE circle_webhook_events ADD COLUMN user_id TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'amount'
  ) THEN
    ALTER TABLE circle_webhook_events ADD COLUMN amount DECIMAL(20,6);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE circle_webhook_events ADD COLUMN error_message TEXT;
  END IF;
END $$;

-- Rename 'error' to 'error_message' if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'error'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circle_webhook_events' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE circle_webhook_events RENAME COLUMN error TO error_message;
  END IF;
END $$;

-- ============================================================================
-- DEPOSIT SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS deposit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES treasury_accounts(id),

  -- Session Details
  amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled', 'expired'

  -- Circle Integration
  circle_payment_id TEXT,
  redirect_url TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deposit_sessions_account ON deposit_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_deposit_sessions_status ON deposit_sessions(status);

-- ============================================================================
-- WITHDRAWAL REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES treasury_accounts(id),

  -- Amount
  amount DECIMAL(20,2) NOT NULL,
  fee DECIMAL(20,2) DEFAULT 0,
  net_amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Bank Details (encrypted in production)
  bank_account_number_last4 TEXT,
  bank_routing_number_last4 TEXT,
  bank_account_holder_name TEXT,

  -- Circle Integration
  circle_payout_id TEXT,
  circle_bank_account_id TEXT,

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  estimated_arrival TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_account ON withdrawal_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  account_id UUID REFERENCES treasury_accounts(id),
  transaction_id UUID,

  -- Event
  action TEXT NOT NULL, -- 'create_account', 'deposit', 'withdrawal', 'buy_grain', 'sell_grain', 'transfer'
  details JSONB,

  -- Context
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_account ON payment_audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON payment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON payment_audit_log(created_at DESC);

-- ============================================================================
-- FUNCTION: Log Payment Action
-- ============================================================================

CREATE OR REPLACE FUNCTION log_payment_action(
  p_account_id UUID,
  p_transaction_id UUID,
  p_action TEXT,
  p_details JSONB,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO payment_audit_log (
    account_id,
    transaction_id,
    action,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_account_id,
    p_transaction_id,
    p_action,
    p_details,
    p_ip,
    p_user_agent
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Account Summary
-- ============================================================================

CREATE OR REPLACE FUNCTION get_account_summary(p_account_id UUID)
RETURNS TABLE (
  account_id UUID,
  email TEXT,
  full_name TEXT,
  wallet_address TEXT,
  usd_balance DECIMAL,
  grain_balance DECIMAL,
  verification_level TEXT,
  status TEXT,
  total_deposits DECIMAL,
  total_withdrawals DECIMAL,
  total_grain_bought DECIMAL,
  total_grain_sold DECIMAL,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ta.id as account_id,
    ta.email,
    ta.full_name,
    ta.wallet_address,
    COALESCE(ta.usd_balance, 0) as usd_balance,
    COALESCE(ta.grain_balance, 0) as grain_balance,
    ta.verification_level,
    ta.status,
    COALESCE(SUM(CASE WHEN gt.type = 'deposit' AND gt.status = 'completed' THEN gt.usd_amount ELSE 0 END), 0) as total_deposits,
    COALESCE(SUM(CASE WHEN gt.type = 'withdraw' AND gt.status = 'completed' THEN gt.usd_amount ELSE 0 END), 0) as total_withdrawals,
    COALESCE(SUM(CASE WHEN gt.type = 'buy_grain' AND gt.status = 'completed' THEN gt.grain_amount ELSE 0 END), 0) as total_grain_bought,
    COALESCE(SUM(CASE WHEN gt.type = 'sell_grain' AND gt.status = 'completed' THEN gt.grain_amount ELSE 0 END), 0) as total_grain_sold,
    COUNT(gt.id) as transaction_count
  FROM treasury_accounts ta
  LEFT JOIN grain_transactions gt ON gt.account_id = ta.id
  WHERE ta.id = p_account_id
  GROUP BY ta.id, ta.email, ta.full_name, ta.wallet_address, ta.usd_balance, ta.grain_balance, ta.verification_level, ta.status;
END;
$$ LANGUAGE plpgsql;
