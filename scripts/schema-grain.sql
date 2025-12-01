-- Grain & Vault Database Schema
-- PostgreSQL Schema for all Grain & Vault tables

-- ============================================================================
-- FOUNDING INVESTORS
-- ============================================================================

CREATE TABLE IF NOT EXISTS founding_investors (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  investment_amount DECIMAL(18, 2) NOT NULL,
  grain_amount DECIMAL(18, 6) NOT NULL,
  kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  vesting_schedule JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'minted', 'mint_failed', 'completed')),
  mint_tx_hash VARCHAR(66),
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_founding_investors_address ON founding_investors(address);
CREATE INDEX idx_founding_investors_status ON founding_investors(status);
CREATE INDEX idx_founding_investors_kyc ON founding_investors(kyc_status);

-- ============================================================================
-- VAULT TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_transactions (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  user_address VARCHAR(42) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  usdc_amount DECIMAL(18, 2) NOT NULL,
  grain_amount DECIMAL(18, 6) NOT NULL,
  nav_price DECIMAL(18, 6) NOT NULL,
  fee DECIMAL(18, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_vault_tx_user ON vault_transactions(user_address);
CREATE INDEX idx_vault_tx_type ON vault_transactions(type);
CREATE INDEX idx_vault_tx_status ON vault_transactions(status);
CREATE INDEX idx_vault_tx_created ON vault_transactions(created_at DESC);

-- ============================================================================
-- WITHDRAWAL REQUESTS (for timelock)
-- ============================================================================

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(255) NOT NULL UNIQUE,
  user_address VARCHAR(42) NOT NULL,
  grain_amount DECIMAL(18, 6) NOT NULL,
  usdc_amount DECIMAL(18, 2) NOT NULL,
  nav_price DECIMAL(18, 6) NOT NULL,
  fee DECIMAL(18, 2) NOT NULL,
  execute_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled')),
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP
);

CREATE INDEX idx_withdrawal_requests_user ON withdrawal_requests(user_address);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_execute ON withdrawal_requests(execute_at);

-- ============================================================================
-- ESCROWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS escrows (
  id SERIAL PRIMARY KEY,
  escrow_id VARCHAR(255) NOT NULL UNIQUE,
  seller VARCHAR(42) NOT NULL,
  buyer VARCHAR(42) NOT NULL,
  amount DECIMAL(18, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL CHECK (currency IN ('USDC', 'GRAIN')),
  milestones JSONB NOT NULL,
  dispute_resolver VARCHAR(42),
  deadline TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'disputed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  disputed_at TIMESTAMP
);

CREATE INDEX idx_escrows_seller ON escrows(seller);
CREATE INDEX idx_escrows_buyer ON escrows(buyer);
CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrows_created ON escrows(created_at DESC);

-- ============================================================================
-- ESCROW TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id SERIAL PRIMARY KEY,
  escrow_id VARCHAR(255) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('milestone_complete', 'dispute_raised', 'dispute_resolved')),
  milestone_index INT,
  amount DECIMAL(18, 2),
  tx_hash VARCHAR(66),
  completed_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (escrow_id) REFERENCES escrows(escrow_id)
);

CREATE INDEX idx_escrow_tx_escrow ON escrow_transactions(escrow_id);
CREATE INDEX idx_escrow_tx_type ON escrow_transactions(type);

-- ============================================================================
-- ESCROW DISPUTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS escrow_disputes (
  id SERIAL PRIMARY KEY,
  escrow_id VARCHAR(255) NOT NULL,
  raised_by VARCHAR(42) NOT NULL,
  reason TEXT NOT NULL,
  evidence JSONB,
  tx_hash VARCHAR(66),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'resolved')),
  resolution TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (escrow_id) REFERENCES escrows(escrow_id)
);

CREATE INDEX idx_disputes_escrow ON escrow_disputes(escrow_id);
CREATE INDEX idx_disputes_status ON escrow_disputes(status);

-- ============================================================================
-- GRAIN EVENTS (for tracking all token movements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grain_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('mint', 'burn', 'transfer')),
  address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42),
  amount DECIMAL(18, 6) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_grain_events_address ON grain_events(address);
CREATE INDEX idx_grain_events_type ON grain_events(event_type);
CREATE INDEX idx_grain_events_created ON grain_events(created_at DESC);

-- ============================================================================
-- NAV UPDATES (audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nav_updates (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) NOT NULL,
  old_nav DECIMAL(18, 6) NOT NULL,
  new_nav DECIMAL(18, 6) NOT NULL,
  old_assets DECIMAL(18, 2),
  new_assets DECIMAL(18, 2),
  reason TEXT,
  updated_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_nav_updates_created ON nav_updates(created_at DESC);

-- ============================================================================
-- SYSTEM EVENTS (for monitoring and alerts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_system_events_type ON system_events(event_type);
CREATE INDEX idx_system_events_severity ON system_events(severity);
CREATE INDEX idx_system_events_created ON system_events(created_at DESC);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Founding Investor Summary
CREATE OR REPLACE VIEW v_founding_investor_summary AS
SELECT
  COUNT(*) as total_investors,
  SUM(investment_amount) as total_invested,
  SUM(grain_amount) as total_grain_allocated,
  AVG(investment_amount) as avg_investment,
  COUNT(CASE WHEN kyc_status = 'verified' THEN 1 END) as verified_investors,
  COUNT(CASE WHEN status = 'minted' THEN 1 END) as minted_investors
FROM founding_investors;

-- Daily Vault Activity
CREATE OR REPLACE VIEW v_daily_vault_activity AS
SELECT
  DATE(created_at) as date,
  type,
  COUNT(*) as transaction_count,
  SUM(usdc_amount) as total_usdc,
  SUM(grain_amount) as total_grain,
  SUM(fee) as total_fees
FROM vault_transactions
WHERE status = 'completed'
GROUP BY DATE(created_at), type
ORDER BY date DESC;

-- Escrow Summary
CREATE OR REPLACE VIEW v_escrow_summary AS
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_value,
  AVG(amount) as avg_value
FROM escrows
GROUP BY status;

-- Active Withdrawal Requests
CREATE OR REPLACE VIEW v_active_withdrawal_requests AS
SELECT
  wr.*,
  (execute_at - NOW()) as time_remaining
FROM withdrawal_requests wr
WHERE status = 'pending'
  AND execute_at > NOW()
ORDER BY execute_at;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_founding_investors_updated_at BEFORE UPDATE ON founding_investors
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_escrows_updated_at BEFORE UPDATE ON escrows
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_escrow_disputes_updated_at BEFORE UPDATE ON escrow_disputes
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Log schema creation
INSERT INTO system_events (event_type, severity, description)
VALUES ('schema_created', 'info', 'Grain & Vault database schema initialized');

-- ============================================================================
-- PERMISSIONS (if needed)
-- ============================================================================

-- Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE founding_investors IS 'Founding investors with vesting schedules';
COMMENT ON TABLE vault_transactions IS 'All GRAIN vault deposits and withdrawals';
COMMENT ON TABLE withdrawal_requests IS 'Time-locked withdrawal requests (>$100K)';
COMMENT ON TABLE escrows IS 'Milestone-based B2B escrow contracts';
COMMENT ON TABLE escrow_transactions IS 'Transaction history for each escrow';
COMMENT ON TABLE escrow_disputes IS 'Disputed escrow cases';
COMMENT ON TABLE grain_events IS 'Blockchain event log for GRAIN token';
COMMENT ON TABLE nav_updates IS 'NAV price update audit trail';
COMMENT ON TABLE system_events IS 'System-wide events and monitoring';
