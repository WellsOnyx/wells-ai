-- ============================================================================
-- GRAIN & VAULT TREASURY SDK SCHEMA
-- Run: psql $POSTGRES_URL < scripts/schema-treasury.sql
-- ============================================================================

-- TREASURY ACCOUNTS
-- Organization accounts with API access and credit facilities
CREATE TABLE IF NOT EXISTS treasury_accounts (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,

  -- Company Information
  company_name TEXT NOT NULL,
  company_size TEXT NOT NULL CHECK (company_size IN ('startup', 'smb', 'mid-market', 'enterprise')),
  industry TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',

  -- ERP Integration
  erp_system TEXT NOT NULL CHECK (erp_system IN ('sap', 'oracle', 'netsuite', 'dynamics365', 'workday', 'coupa', 'other', 'none')),
  erp_version TEXT,
  erp_connected BOOLEAN DEFAULT FALSE,
  erp_config JSONB DEFAULT '{}',

  -- Account Status
  tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'growth', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'closed')),

  -- API Access
  api_key TEXT NOT NULL UNIQUE,
  sdk_enabled BOOLEAN DEFAULT TRUE,

  -- Balances (denormalized for performance)
  grain_balance DECIMAL(20, 2) DEFAULT 0,
  credit_line DECIMAL(20, 2) DEFAULT 0,
  used_credit DECIMAL(20, 2) DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  onboarding_completed_at TIMESTAMP,
  last_activity_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treasury_accounts_clerk_user ON treasury_accounts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_treasury_accounts_api_key ON treasury_accounts(api_key);
CREATE INDEX IF NOT EXISTS idx_treasury_accounts_status ON treasury_accounts(status);
CREATE INDEX IF NOT EXISTS idx_treasury_accounts_tier ON treasury_accounts(tier);
CREATE INDEX IF NOT EXISTS idx_treasury_accounts_created ON treasury_accounts(created_at DESC);

-- TREASURY WALLETS
-- Circle blockchain wallets for each account
CREATE TABLE IF NOT EXISTS treasury_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,

  -- Circle Wallet Info
  wallet_id TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL UNIQUE,
  blockchain TEXT NOT NULL DEFAULT 'BASE',
  currency TEXT NOT NULL DEFAULT 'GRAIN',

  -- Balance & Value
  balance DECIMAL(20, 2) DEFAULT 0,
  grain_value_at_deposit DECIMAL(20, 6) DEFAULT 1.0,
  current_grain_value DECIMAL(20, 6) DEFAULT 1.0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'frozen')),
  kyc_status TEXT DEFAULT 'not-started' CHECK (kyc_status IN ('not-started', 'pending', 'approved', 'rejected')),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treasury_wallets_account ON treasury_wallets(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_wallets_wallet_id ON treasury_wallets(wallet_id);
CREATE INDEX IF NOT EXISTS idx_treasury_wallets_address ON treasury_wallets(address);
CREATE INDEX IF NOT EXISTS idx_treasury_wallets_status ON treasury_wallets(status);

-- TREASURY TRANSACTIONS
-- All GRAIN movements (payments, receipts, credit draws, etc.)
CREATE TABLE IF NOT EXISTS treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,

  -- Transaction Type
  type TEXT NOT NULL CHECK (type IN ('payment', 'receipt', 'credit_draw', 'credit_repay', 'conversion', 'reserve')),

  -- Amount
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GRAIN' CHECK (currency IN ('GRAIN', 'USDC', 'USD')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Wallets
  from_wallet TEXT,
  to_wallet TEXT,

  -- Circle Integration
  circle_tx_id TEXT,
  circle_transfer_id TEXT,

  -- Counterparty
  counterparty_id TEXT,
  counterparty_name TEXT,
  counterparty_wallet TEXT,

  -- ERP Integration
  erp_reference TEXT,
  cost_center TEXT,
  gl_account TEXT,

  -- Details
  description TEXT,
  memo TEXT,

  -- Metadata (flexible for future needs)
  metadata JSONB DEFAULT '{}',

  -- Error tracking
  error_code TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treasury_transactions_account ON treasury_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_type ON treasury_transactions(type);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_status ON treasury_transactions(status);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_created ON treasury_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_circle_tx ON treasury_transactions(circle_tx_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_erp_ref ON treasury_transactions(erp_reference);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_from_wallet ON treasury_transactions(from_wallet);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_to_wallet ON treasury_transactions(to_wallet);

-- TREASURY CREDIT LINES
-- Credit facilities (1:1 with GRAIN deposits)
CREATE TABLE IF NOT EXISTS treasury_credit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,

  -- Credit Line Details
  limit_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  drawn_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  available_amount DECIMAL(20, 2) GENERATED ALWAYS AS (limit_amount - drawn_amount) STORED,

  -- Terms
  interest_rate DECIMAL(5, 4) DEFAULT 0.0000, -- 0% interest on GRAIN-backed credit
  grace_period_days INTEGER DEFAULT 30,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),

  -- Tracking
  last_draw_at TIMESTAMP,
  last_repay_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_treasury_credit_lines_account ON treasury_credit_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_credit_lines_status ON treasury_credit_lines(status);

-- TREASURY VENDORS
-- Vendor wallets for payments
CREATE TABLE IF NOT EXISTS treasury_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,

  -- Vendor Details
  vendor_id TEXT NOT NULL, -- ERP vendor ID
  vendor_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Wallet
  wallet_id TEXT,
  wallet_address TEXT,

  -- Payment Terms
  payment_terms TEXT, -- 'Net30', 'Net60', etc.
  early_payment_discount DECIMAL(5, 2),
  early_payment_days INTEGER,

  -- Settings
  auto_pay_enabled BOOLEAN DEFAULT FALSE,
  trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  onboarding_status TEXT DEFAULT 'invited' CHECK (onboarding_status IN ('invited', 'pending', 'completed', 'declined')),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  invited_at TIMESTAMP,
  onboarded_at TIMESTAMP,
  last_payment_at TIMESTAMP,

  UNIQUE(account_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_treasury_vendors_account ON treasury_vendors(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_vendors_vendor_id ON treasury_vendors(vendor_id);
CREATE INDEX IF NOT EXISTS idx_treasury_vendors_email ON treasury_vendors(email);
CREATE INDEX IF NOT EXISTS idx_treasury_vendors_wallet ON treasury_vendors(wallet_address);
CREATE INDEX IF NOT EXISTS idx_treasury_vendors_status ON treasury_vendors(status);

-- TREASURY INVOICES
-- Synced invoices from ERP systems
CREATE TABLE IF NOT EXISTS treasury_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES treasury_vendors(id) ON DELETE SET NULL,

  -- Invoice Details
  erp_invoice_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,

  -- Amount
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Dates
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled', 'overdue')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'failed')),

  -- Payment
  paid_amount DECIMAL(20, 2) DEFAULT 0,
  transaction_id UUID REFERENCES treasury_transactions(id),

  -- ERP Reference
  erp_po_number TEXT,
  cost_center TEXT,
  gl_account TEXT,

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Sync tracking
  synced_at TIMESTAMP,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP,

  UNIQUE(account_id, erp_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_treasury_invoices_account ON treasury_invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_invoices_vendor ON treasury_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_treasury_invoices_erp_id ON treasury_invoices(erp_invoice_id);
CREATE INDEX IF NOT EXISTS idx_treasury_invoices_status ON treasury_invoices(status);
CREATE INDEX IF NOT EXISTS idx_treasury_invoices_payment_status ON treasury_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_treasury_invoices_due_date ON treasury_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_treasury_invoices_created ON treasury_invoices(created_at DESC);

-- TREASURY PAYMENT REQUESTS
-- Receivables / Payment requests sent to customers
CREATE TABLE IF NOT EXISTS treasury_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,

  -- Request Details
  payment_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GRAIN',

  -- Customer
  customer_email TEXT,
  customer_name TEXT,

  -- Reference
  erp_reference TEXT,
  invoice_number TEXT,
  memo TEXT,

  -- Payment Links
  payment_link TEXT NOT NULL,
  qr_code_url TEXT,
  wallet_address TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),

  -- Dates
  due_date DATE,
  expires_at TIMESTAMP,

  -- Payment tracking
  paid_amount DECIMAL(20, 2) DEFAULT 0,
  transaction_id UUID REFERENCES treasury_transactions(id),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treasury_payment_requests_account ON treasury_payment_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_payment_requests_payment_id ON treasury_payment_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_treasury_payment_requests_status ON treasury_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_treasury_payment_requests_email ON treasury_payment_requests(customer_email);
CREATE INDEX IF NOT EXISTS idx_treasury_payment_requests_due_date ON treasury_payment_requests(due_date);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_treasury_accounts_updated_at
  BEFORE UPDATE ON treasury_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_treasury_wallets_updated_at
  BEFORE UPDATE ON treasury_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_treasury_transactions_updated_at
  BEFORE UPDATE ON treasury_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_treasury_credit_lines_updated_at
  BEFORE UPDATE ON treasury_credit_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_treasury_vendors_updated_at
  BEFORE UPDATE ON treasury_vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_treasury_invoices_updated_at
  BEFORE UPDATE ON treasury_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_treasury_payment_requests_updated_at
  BEFORE UPDATE ON treasury_payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update account balances from credit line
CREATE OR REPLACE FUNCTION sync_account_credit_line()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE treasury_accounts
  SET
    credit_line = NEW.limit_amount,
    used_credit = NEW.drawn_amount,
    updated_at = NOW()
  WHERE id = NEW.account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_credit_to_account
  AFTER INSERT OR UPDATE ON treasury_credit_lines
  FOR EACH ROW EXECUTE FUNCTION sync_account_credit_line();

-- Update account balance from wallet
CREATE OR REPLACE FUNCTION sync_account_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE treasury_accounts
  SET
    grain_balance = (
      SELECT COALESCE(SUM(balance), 0)
      FROM treasury_wallets
      WHERE account_id = NEW.account_id AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = NEW.account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_wallet_to_account
  AFTER INSERT OR UPDATE ON treasury_wallets
  FOR EACH ROW EXECUTE FUNCTION sync_account_wallet_balance();

-- Mark invoices as overdue
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE treasury_invoices
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE
    AND payment_status = 'unpaid';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Dashboard view with aggregated metrics
CREATE OR REPLACE VIEW treasury_dashboard AS
SELECT
  a.id AS account_id,
  a.company_name,
  a.tier,
  a.status,

  -- Balances
  a.grain_balance,
  a.credit_line,
  a.used_credit,
  (a.credit_line - a.used_credit) AS available_credit,

  -- Transaction counts (30 days)
  COALESCE(t30.transaction_count, 0) AS transactions_30d,
  COALESCE(t30.payment_count, 0) AS payments_30d,
  COALESCE(t30.receipt_count, 0) AS receipts_30d,
  COALESCE(t30.total_volume, 0) AS volume_30d,

  -- Vendors
  COALESCE(v.vendor_count, 0) AS vendor_count,
  COALESCE(v.active_vendors, 0) AS active_vendors,

  -- Invoices
  COALESCE(i.pending_invoices, 0) AS pending_invoices,
  COALESCE(i.overdue_invoices, 0) AS overdue_invoices,
  COALESCE(i.pending_amount, 0) AS pending_invoice_amount,

  a.created_at,
  a.last_activity_at
FROM treasury_accounts a

-- Transactions last 30 days
LEFT JOIN (
  SELECT
    account_id,
    COUNT(*) AS transaction_count,
    COUNT(*) FILTER (WHERE type = 'payment') AS payment_count,
    COUNT(*) FILTER (WHERE type = 'receipt') AS receipt_count,
    SUM(amount) AS total_volume
  FROM treasury_transactions
  WHERE created_at >= NOW() - INTERVAL '30 days'
    AND status = 'completed'
  GROUP BY account_id
) t30 ON a.id = t30.account_id

-- Vendors
LEFT JOIN (
  SELECT
    account_id,
    COUNT(*) AS vendor_count,
    COUNT(*) FILTER (WHERE status = 'active') AS active_vendors
  FROM treasury_vendors
  GROUP BY account_id
) v ON a.id = v.account_id

-- Invoices
LEFT JOIN (
  SELECT
    account_id,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_invoices,
    COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_invoices,
    SUM(amount) FILTER (WHERE status IN ('pending', 'overdue') AND payment_status = 'unpaid') AS pending_amount
  FROM treasury_invoices
  GROUP BY account_id
) i ON a.id = i.account_id;

-- ============================================================================
-- GRANT PERMISSIONS (if using specific user)
-- ============================================================================

-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_db_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_db_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_db_user;

-- ============================================================================
-- ADDITIONAL TABLES FOR CIRCLE WEBHOOK INTEGRATION
-- ============================================================================

-- USER WALLETS (for individual users, not treasury accounts)
CREATE TABLE IF NOT EXISTS user_wallets (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  wallet_id VARCHAR(255) NOT NULL,          -- Circle wallet ID
  wallet_address VARCHAR(255) NOT NULL,     -- Base L2 blockchain address
  balance DECIMAL(20, 6) DEFAULT 0,         -- GRAIN/USDC balance
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_id ON user_wallets(wallet_id);

-- CIRCLE WEBHOOK EVENTS LOG
-- Track all Circle webhook events for debugging and reconciliation
CREATE TABLE IF NOT EXISTS circle_webhook_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL UNIQUE,    -- Circle's notification ID
  event_type VARCHAR(100) NOT NULL,         -- payment.completed, transfer.failed, etc.
  circle_transfer_id VARCHAR(255),          -- Related transfer/payment ID
  payload JSONB NOT NULL,                   -- Full webhook payload
  status VARCHAR(50) DEFAULT 'received',    -- received, processed, failed
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_transfer_id ON circle_webhook_events(circle_transfer_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON circle_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON circle_webhook_events(created_at DESC);

-- Add columns to treasury_transactions for webhook integration (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treasury_transactions' AND column_name = 'circle_transaction_hash'
  ) THEN
    ALTER TABLE treasury_transactions
    ADD COLUMN circle_transaction_hash VARCHAR(255),
    ADD COLUMN payment_method VARCHAR(50);

    CREATE INDEX IF NOT EXISTS idx_treasury_transactions_tx_hash ON treasury_transactions(circle_transaction_hash);
  END IF;
END $$;

-- ============================================================================
-- SAMPLE DATA (optional, for testing)
-- ============================================================================

-- INSERT INTO treasury_accounts (id, clerk_user_id, company_name, company_size, industry, country, erp_system, tier, api_key)
-- VALUES (
--   'gv_test_001',
--   'user_test_001',
--   'Test Company Inc',
--   'startup',
--   'Technology',
--   'US',
--   'netsuite',
--   'starter',
--   'gv_test_api_key_12345'
-- );

-- Sample user wallet
-- INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance)
-- VALUES
--   ('user_test_001', 'circle_wallet_001', '0x1234567890abcdef1234567890abcdef12345678', 1000.00);

-- Sample transaction
-- INSERT INTO treasury_transactions (account_id, type, amount, currency, status, description)
-- VALUES
--   ('gv_test_001', 'payment', 100.00, 'GRAIN', 'pending', 'Test payment');

COMMENT ON TABLE user_wallets IS 'Circle wallet information for individual users - Base L2 blockchain addresses';
COMMENT ON TABLE circle_webhook_events IS 'Log of all Circle webhook events for reconciliation and debugging';
COMMENT ON COLUMN circle_webhook_events.event_type IS 'payment.completed, payment.failed, transfer.completed, transfer.failed, payout.completed, payout.failed';
COMMENT ON COLUMN treasury_transactions.circle_transaction_hash IS 'Base L2 blockchain transaction hash from Circle webhook';
