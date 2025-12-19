-- ============================================================================
-- GRAIN & VAULT - COMPLETE MIGRATION
-- Copy this entire SQL and run in Prisma Data Platform dashboard
-- https://console.prisma.io/ -> Your Project -> Data Browser -> SQL tab
-- ============================================================================

-- ============================================================================
-- TABLE 1: treasury_accounts (User accounts with GRAIN balances)
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  wallet_address TEXT,
  circle_wallet_id TEXT,
  circle_wallet_set_id TEXT,
  circle_user_token TEXT,
  grain_balance DECIMAL(24,6) DEFAULT 0,
  usd_balance DECIMAL(20,2) DEFAULT 0,
  verification_level TEXT DEFAULT 'basic',
  daily_deposit_limit DECIMAL(20,2) DEFAULT 10000,
  daily_withdraw_limit DECIMAL(20,2) DEFAULT 10000,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE 2: grain_transactions (All GRAIN activity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES treasury_accounts(id),
  type TEXT NOT NULL,
  usd_amount DECIMAL(20,2),
  grain_amount DECIMAL(24,6),
  fee_amount DECIMAL(20,2) DEFAULT 0,
  grain_price DECIMAL(20,10) DEFAULT 1.0,
  counterparty_id UUID,
  deal_id TEXT,
  circle_transfer_id TEXT,
  circle_payout_id TEXT,
  status TEXT DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ============================================================================
-- TABLE 3: deposit_sessions (Track deposit flow)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deposit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES treasury_accounts(id),
  amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  circle_payment_id TEXT,
  redirect_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
  completed_at TIMESTAMP
);

-- ============================================================================
-- TABLE 4: withdrawal_requests (Track withdrawals to bank)
-- ============================================================================
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES treasury_accounts(id),
  amount DECIMAL(20,2) NOT NULL,
  fee DECIMAL(20,2) DEFAULT 0,
  net_amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  bank_account_number_last4 TEXT,
  bank_routing_number_last4 TEXT,
  bank_account_holder_name TEXT,
  circle_payout_id TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  estimated_arrival TIMESTAMP,
  completed_at TIMESTAMP
);

-- ============================================================================
-- TABLE 5: payment_audit_log (Audit trail)
-- ============================================================================
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
-- TABLE 6: circle_webhook_events (Circle payment notifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS circle_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (Run after tables are created)
-- ============================================================================

-- treasury_accounts indexes
CREATE INDEX IF NOT EXISTS idx_treasury_email ON treasury_accounts(email);
CREATE INDEX IF NOT EXISTS idx_treasury_clerk ON treasury_accounts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_treasury_status ON treasury_accounts(status);
CREATE INDEX IF NOT EXISTS idx_treasury_circle_wallet ON treasury_accounts(circle_wallet_id);

-- grain_transactions indexes
CREATE INDEX IF NOT EXISTS idx_grain_tx_account ON grain_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_grain_tx_type ON grain_transactions(type);
CREATE INDEX IF NOT EXISTS idx_grain_tx_status ON grain_transactions(status);
CREATE INDEX IF NOT EXISTS idx_grain_tx_created ON grain_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grain_tx_circle ON grain_transactions(circle_transfer_id);

-- deposit_sessions indexes
CREATE INDEX IF NOT EXISTS idx_deposit_account ON deposit_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_deposit_status ON deposit_sessions(status);

-- withdrawal_requests indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_account ON withdrawal_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);

-- payment_audit_log indexes
CREATE INDEX IF NOT EXISTS idx_audit_account ON payment_audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON payment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON payment_audit_log(created_at DESC);

-- circle_webhook_events indexes
CREATE INDEX IF NOT EXISTS idx_circle_events_type ON circle_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_circle_events_processed ON circle_webhook_events(processed);

-- ============================================================================
-- DONE! All 6 tables and indexes created.
-- ============================================================================
