-- ============================================================================
-- GRAIN & VAULT - CIRCLE-ONLY PAYMENTS SCHEMA
-- Simplified for Vercel Postgres Dashboard (copy-paste ready)
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE NEW TABLES
-- ============================================================================

-- Circle Webhook Events
CREATE TABLE IF NOT EXISTS circle_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Deposit Sessions
CREATE TABLE IF NOT EXISTS deposit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES treasury_accounts(id),
  amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  circle_payment_id TEXT,
  redirect_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
  completed_at TIMESTAMP
);

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES treasury_accounts(id),
  amount DECIMAL(20,2) NOT NULL,
  fee DECIMAL(20,2) DEFAULT 0,
  net_amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  bank_account_number_last4 TEXT,
  bank_routing_number_last4 TEXT,
  bank_account_holder_name TEXT,
  circle_payout_id TEXT,
  circle_bank_account_id TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  estimated_arrival TIMESTAMP,
  completed_at TIMESTAMP
);

-- Payment Audit Log
CREATE TABLE IF NOT EXISTS payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES treasury_accounts(id),
  transaction_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: ADD COLUMNS TO EXISTING TABLES
-- Run these one at a time. If a column already exists, you'll get an error - just skip it.
-- ============================================================================

-- Add Circle columns to treasury_accounts
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS circle_wallet_id TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS circle_wallet_set_id TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS circle_user_token TEXT;

-- Add Circle columns to grain_transactions
ALTER TABLE grain_transactions ADD COLUMN IF NOT EXISTS circle_transfer_id TEXT;
ALTER TABLE grain_transactions ADD COLUMN IF NOT EXISTS circle_payout_id TEXT;

-- ============================================================================
-- STEP 3: CREATE INDEXES
-- ============================================================================

-- Indexes for circle_webhook_events
CREATE INDEX IF NOT EXISTS idx_circle_events_type ON circle_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_circle_events_processed ON circle_webhook_events(processed);

-- Indexes for deposit_sessions
CREATE INDEX IF NOT EXISTS idx_deposit_sessions_account ON deposit_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_deposit_sessions_status ON deposit_sessions(status);

-- Indexes for withdrawal_requests
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_account ON withdrawal_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- Indexes for payment_audit_log
CREATE INDEX IF NOT EXISTS idx_audit_account ON payment_audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON payment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON payment_audit_log(created_at DESC);

-- Indexes for treasury_accounts (Circle)
CREATE INDEX IF NOT EXISTS idx_treasury_circle_wallet ON treasury_accounts(circle_wallet_id);

-- Indexes for grain_transactions (Circle)
CREATE INDEX IF NOT EXISTS idx_grain_tx_circle ON grain_transactions(circle_transfer_id);

-- ============================================================================
-- DONE! All tables, columns, and indexes created.
-- ============================================================================
