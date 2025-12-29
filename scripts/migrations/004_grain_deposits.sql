-- Grain & Vault - Deposit System Tables
-- Run this migration to add ACH/Wire deposit support

-- Virtual Account Numbers (VANs) for each user
-- These allow Circle to auto-attribute incoming deposits
CREATE TABLE IF NOT EXISTS user_virtual_accounts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  virtual_account_number VARCHAR(50) NOT NULL UNIQUE,
  circle_van_id VARCHAR(100),  -- Circle's internal VAN ID if applicable
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups by VAN (for incoming deposit matching)
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_van
ON user_virtual_accounts(virtual_account_number);

-- Deposit sessions - tracks pending deposits
CREATE TABLE IF NOT EXISTS grain_deposit_sessions (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  amount DECIMAL(20, 6) NOT NULL,
  method VARCHAR(20) NOT NULL,  -- 'ach' or 'wire'
  virtual_account_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, received, credited, failed, expired
  circle_transfer_id VARCHAR(100),
  received_amount DECIMAL(20, 6),
  grain_credited DECIMAL(20, 6),
  grain_price_at_credit DECIMAL(20, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_at TIMESTAMP WITH TIME ZONE,
  credited_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index for status checks
CREATE INDEX IF NOT EXISTS idx_deposit_sessions_status
ON grain_deposit_sessions(status, created_at);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_deposit_sessions_user
ON grain_deposit_sessions(user_id, created_at DESC);

-- Treasury holdings - tracks all assets backing GRAIN
CREATE TABLE IF NOT EXISTS grain_treasury (
  id SERIAL PRIMARY KEY,
  asset_type VARCHAR(50) NOT NULL,  -- 'usdc', 'tbill', 'mmf', 'repo'
  asset_name VARCHAR(200),
  amount DECIMAL(30, 8) NOT NULL,
  purchase_price DECIMAL(20, 8),
  current_value DECIMAL(30, 8),
  yield_rate DECIMAL(10, 6),  -- Annual yield for interest-bearing assets
  maturity_date DATE,  -- For T-bills and similar
  custodian VARCHAR(100),  -- 'circle', 'blackrock', etc.
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GRAIN price history - for tracking price over time
CREATE TABLE IF NOT EXISTS grain_price_history (
  id SERIAL PRIMARY KEY,
  price_usd DECIMAL(20, 8) NOT NULL,
  treasury_value DECIMAL(30, 8) NOT NULL,
  total_supply DECIMAL(30, 8) NOT NULL,
  usdc_balance DECIMAL(30, 8),
  other_assets_value DECIMAL(30, 8),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_grain_price_history_time
ON grain_price_history(recorded_at DESC);

-- VAULT audit log - tracks all audits by the VAULT system
CREATE TABLE IF NOT EXISTS vault_audit_log (
  id SERIAL PRIMARY KEY,
  audit_type VARCHAR(50) NOT NULL,  -- 'scheduled', 'triggered', 'manipulation_detected'
  status VARCHAR(20) NOT NULL,  -- 'passed', 'warning', 'failed', 'freeze_triggered'
  treasury_value_reported DECIMAL(30, 8),
  treasury_value_verified DECIMAL(30, 8),
  discrepancy_amount DECIMAL(30, 8),
  discrepancy_percent DECIMAL(10, 6),
  action_taken VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GRAIN price freeze table - when VAULT detects issues
CREATE TABLE IF NOT EXISTS grain_price_freeze (
  id SERIAL PRIMARY KEY,
  triggered_by VARCHAR(100) NOT NULL,  -- 'vault_audit', 'manual', etc.
  reason TEXT NOT NULL,
  frozen_price DECIMAL(20, 8) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- 7 days from start
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  new_price_after_resolution DECIMAL(20, 8),
  status VARCHAR(20) DEFAULT 'active'  -- 'active', 'resolved', 'extended'
);

-- Add columns to existing tables if needed

-- Add idempotency_key to grain_transactions if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grain_transactions' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE grain_transactions ADD COLUMN idempotency_key VARCHAR(100);
    CREATE INDEX IF NOT EXISTS idx_grain_tx_idempotency ON grain_transactions(idempotency_key);
  END IF;
END $$;

-- Add metadata column to grain_transactions if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grain_transactions' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE grain_transactions ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Insert initial treasury record (USDC balance starts at 0)
INSERT INTO grain_treasury (asset_type, asset_name, amount, custodian, status)
VALUES ('usdc', 'Circle USDC', 0, 'circle', 'active')
ON CONFLICT DO NOTHING;

-- Insert initial price history record
INSERT INTO grain_price_history (price_usd, treasury_value, total_supply, usdc_balance, other_assets_value)
VALUES (1.00, 0, 0, 0, 0);

COMMENT ON TABLE user_virtual_accounts IS 'Virtual Account Numbers for Circle ACH/wire deposits';
COMMENT ON TABLE grain_deposit_sessions IS 'Tracks pending and completed deposit sessions';
COMMENT ON TABLE grain_treasury IS 'All assets backing the GRAIN stablecoin';
COMMENT ON TABLE grain_price_history IS 'Historical GRAIN prices for auditing and charts';
COMMENT ON TABLE vault_audit_log IS 'VAULT autonomous auditor log';
COMMENT ON TABLE grain_price_freeze IS 'Price freeze events triggered by VAULT';
