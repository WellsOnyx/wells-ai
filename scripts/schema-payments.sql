/**
 * PAYMENT RAILS DATABASE SCHEMA
 *
 * Complete schema for Circle (USDC) and Stripe (fiat) payment infrastructure.
 * Integrates with float treasury system for yield generation.
 *
 * TABLES:
 * - Circle wallets and payments
 * - Stripe customers and payment intents
 * - Stripe connected accounts and payouts
 * - User balances and transaction history
 */

-- ============================================================================
-- CIRCLE TABLES (USDC Payments)
-- ============================================================================

-- Circle wallets (one per user)
CREATE TABLE IF NOT EXISTS circle_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  wallet_id TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  blockchain TEXT NOT NULL DEFAULT 'MATIC', -- ETH, MATIC, AVAX
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_circle_wallets_user_id ON circle_wallets(user_id);
CREATE INDEX idx_circle_wallets_wallet_id ON circle_wallets(wallet_id);

-- Circle payments (outgoing USDC)
CREATE TABLE IF NOT EXISTS circle_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id TEXT NOT NULL UNIQUE,
  from_user_id TEXT NOT NULL,
  from_wallet_id TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_usdc DECIMAL(20, 6) NOT NULL,
  status TEXT NOT NULL, -- pending, confirmed, complete, failed
  transaction_hash TEXT,
  blockchain TEXT NOT NULL DEFAULT 'MATIC',
  float_position_id UUID REFERENCES float_positions(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_circle_payments_user_id ON circle_payments(from_user_id);
CREATE INDEX idx_circle_payments_transfer_id ON circle_payments(transfer_id);
CREATE INDEX idx_circle_payments_status ON circle_payments(status);
CREATE INDEX idx_circle_payments_float_position ON circle_payments(float_position_id);

-- Circle incoming payments (received USDC)
CREATE TABLE IF NOT EXISTS circle_incoming_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  transfer_id TEXT NOT NULL UNIQUE,
  amount_usdc DECIMAL(20, 6) NOT NULL,
  transaction_hash TEXT NOT NULL,
  blockchain TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_circle_incoming_user_id ON circle_incoming_payments(user_id);
CREATE INDEX idx_circle_incoming_tx_hash ON circle_incoming_payments(transaction_hash);

-- ============================================================================
-- STRIPE TABLES (Fiat Payments)
-- ============================================================================

-- Stripe customers (one per user)
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  default_payment_method_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_customer_id ON stripe_customers(customer_id);

-- Stripe payment intents (deposits)
CREATE TABLE IF NOT EXISTS stripe_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL, -- requires_payment_method, requires_confirmation, processing, succeeded, canceled
  client_secret TEXT,
  payment_method_id TEXT,
  payment_type TEXT DEFAULT 'card', -- card, ach
  float_position_id UUID REFERENCES float_positions(id),
  failure_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_payment_intents_user_id ON stripe_payment_intents(user_id);
CREATE INDEX idx_stripe_payment_intents_payment_intent_id ON stripe_payment_intents(payment_intent_id);
CREATE INDEX idx_stripe_payment_intents_status ON stripe_payment_intents(status);
CREATE INDEX idx_stripe_payment_intents_float_position ON stripe_payment_intents(float_position_id);

-- Stripe connected accounts (for payouts)
CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL UNIQUE,
  email TEXT,
  business_type TEXT, -- individual, company
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_connected_accounts_user_id ON stripe_connected_accounts(user_id);
CREATE INDEX idx_stripe_connected_accounts_account_id ON stripe_connected_accounts(account_id);

-- Stripe payouts (withdrawals to bank)
CREATE TABLE IF NOT EXISTS stripe_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  payout_id TEXT NOT NULL UNIQUE,
  transfer_id TEXT NOT NULL,
  amount_usdc DECIMAL(20, 6) NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL, -- pending, in_transit, paid, failed, canceled
  arrival_date TIMESTAMPTZ NOT NULL,
  failure_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_payouts_user_id ON stripe_payouts(user_id);
CREATE INDEX idx_stripe_payouts_payout_id ON stripe_payouts(payout_id);
CREATE INDEX idx_stripe_payouts_status ON stripe_payouts(status);

-- ============================================================================
-- USER BALANCES
-- ============================================================================

-- User USDC balances (unified across all rails)
CREATE TABLE IF NOT EXISTS user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  usdc_balance DECIMAL(20, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_balances_user_id ON user_balances(user_id);

-- Balance transaction ledger
CREATE TABLE IF NOT EXISTS balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount DECIMAL(20, 6) NOT NULL,
  type TEXT NOT NULL, -- credit, debit
  source TEXT NOT NULL, -- card_deposit, ach_deposit, payment_received, bank_withdrawal, float_yield
  balance_after DECIMAL(20, 6) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_balance_transactions_user_id ON balance_transactions(user_id);
CREATE INDEX idx_balance_transactions_created_at ON balance_transactions(created_at DESC);
CREATE INDEX idx_balance_transactions_type ON balance_transactions(type);

-- ============================================================================
-- FLOAT TABLES (Integration with Treasury System)
-- ============================================================================

-- Float positions (already exists in schema-treasury.sql, but documenting integration)
-- Links payment -> float position -> vault deployment -> yield distribution

-- Account rewards (float yield earnings)
CREATE TABLE IF NOT EXISTS account_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  amount DECIMAL(20, 6) NOT NULL,
  reward_type TEXT NOT NULL, -- float_yield, referral_bonus, etc
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid
  float_position_id UUID REFERENCES float_positions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_account_rewards_account_id ON account_rewards(account_id);
CREATE INDEX idx_account_rewards_status ON account_rewards(status);
CREATE INDEX idx_account_rewards_float_position ON account_rewards(float_position_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_circle_wallets_updated_at BEFORE UPDATE ON circle_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_circle_payments_updated_at BEFORE UPDATE ON circle_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_customers_updated_at BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_payment_intents_updated_at BEFORE UPDATE ON stripe_payment_intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_connected_accounts_updated_at BEFORE UPDATE ON stripe_connected_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_payouts_updated_at BEFORE UPDATE ON stripe_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_balances_updated_at BEFORE UPDATE ON user_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User payment summary view
CREATE OR REPLACE VIEW user_payment_summary AS
SELECT
  b.user_id,
  b.usdc_balance,
  COALESCE(SUM(CASE WHEN spi.status = 'succeeded' THEN spi.amount_cents / 100.0 ELSE 0 END), 0) as total_deposited,
  COALESCE(SUM(CASE WHEN sp.status IN ('paid', 'in_transit') THEN sp.amount_usdc ELSE 0 END), 0) as total_withdrawn,
  COALESCE(SUM(CASE WHEN ar.status = 'paid' THEN ar.amount ELSE 0 END), 0) as total_yield_earned,
  COALESCE(SUM(CASE WHEN ar.status = 'pending' THEN ar.amount ELSE 0 END), 0) as pending_yield
FROM user_balances b
LEFT JOIN stripe_payment_intents spi ON spi.user_id = b.user_id
LEFT JOIN stripe_payouts sp ON sp.user_id = b.user_id
LEFT JOIN account_rewards ar ON ar.account_id = b.user_id AND ar.reward_type = 'float_yield'
GROUP BY b.user_id, b.usdc_balance;

-- Active float positions by user
CREATE OR REPLACE VIEW user_active_float AS
SELECT
  cp.from_user_id as user_id,
  COUNT(DISTINCT fp.id) as active_positions,
  COALESCE(SUM(fp.amount_usdc), 0) as total_float_amount,
  COALESCE(SUM(fp.yield_earned), 0) as total_yield_earned
FROM circle_payments cp
INNER JOIN float_positions fp ON fp.id = cp.float_position_id
WHERE fp.status IN ('pending', 'deployed')
GROUP BY cp.from_user_id;

-- ============================================================================
-- SEED DATA (Development)
-- ============================================================================

-- Create demo user balance
INSERT INTO user_balances (user_id, usdc_balance)
VALUES ('demo-user', 1000.00)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE circle_wallets IS 'Circle wallets for USDC payments';
COMMENT ON TABLE circle_payments IS 'Outgoing USDC payments via Circle';
COMMENT ON TABLE circle_incoming_payments IS 'Incoming USDC payments received';
COMMENT ON TABLE stripe_customers IS 'Stripe customers for fiat payments';
COMMENT ON TABLE stripe_payment_intents IS 'Card/ACH deposits via Stripe';
COMMENT ON TABLE stripe_connected_accounts IS 'Stripe connected accounts for payouts';
COMMENT ON TABLE stripe_payouts IS 'Bank withdrawals via Stripe';
COMMENT ON TABLE user_balances IS 'Unified USDC balances across all rails';
COMMENT ON TABLE balance_transactions IS 'Ledger of all balance changes';
COMMENT ON TABLE account_rewards IS 'Float yield earnings and other rewards';

-- ============================================================================
-- GRANTS (if needed)
-- ============================================================================

-- Grant appropriate permissions to your application role
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO your_app_role;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_role;
