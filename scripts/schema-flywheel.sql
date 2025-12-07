-- =====================================================
-- FLYWHEEL SCHEMA: Wells AI Float → Grain & Vault Treasury
-- =====================================================
-- This connects Wells AI payment float to Grain & Vault yield
-- strategies, creating a compounding growth flywheel.
--
-- FLYWHEEL MECHANICS:
-- 1. Wells AI processes payments → Creates float (settlement delay)
-- 2. Float deployed to Grain & Vault → Generates yield
-- 3. Yield distributed → 50% Wells, 30% GRAIN, 20% participants
-- 4. GRAIN appreciation → Better rates → More volume → More float
-- =====================================================

-- FLOAT POSITIONS
-- Track every float position from Wells AI
CREATE TABLE IF NOT EXISTS float_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'viral_payment', 'white_label', 'credit_draw', 'erp_intercept'
  source_id TEXT NOT NULL,
  amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USDC',
  sender_account_id UUID,
  recipient_account_id UUID,
  partner_id UUID,
  status TEXT DEFAULT 'pending', -- pending, deployed, settled
  settlement_due TIMESTAMP NOT NULL,
  deployed_at TIMESTAMP,
  settled_at TIMESTAMP,
  vault_deposit_id UUID,
  yield_earned DECIMAL(20,6) DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

-- VAULT DEPOSITS
-- Float deployed to Grain & Vault strategies
CREATE TABLE IF NOT EXISTS vault_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  float_position_id UUID REFERENCES float_positions(id),
  amount DECIMAL(20,2) NOT NULL,
  strategy TEXT DEFAULT 'treasury_bills', -- treasury_bills, money_market, stablecoin_yield
  apy_at_deposit DECIMAL(8,6) NOT NULL,
  current_value DECIMAL(20,6) NOT NULL,
  yield_accrued DECIMAL(20,6) DEFAULT 0,
  status TEXT DEFAULT 'active', -- active, withdrawing, withdrawn
  deposited_at TIMESTAMP NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMP,
  grain_pool_id UUID
);

-- GRAIN POOLS
-- GRAIN token backing pools
CREATE TABLE IF NOT EXISTS grain_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_name TEXT NOT NULL UNIQUE,
  total_backing_value DECIMAL(24,2) DEFAULT 0, -- USD backing
  total_grain_allocated DECIMAL(24,6) DEFAULT 0, -- GRAIN tokens assigned to this pool
  current_apy DECIMAL(8,6) NOT NULL,
  yield_to_date DECIMAL(24,6) DEFAULT 0,
  wells_share_earned DECIMAL(24,6) DEFAULT 0, -- 50%
  grain_appreciation_fund DECIMAL(24,6) DEFAULT 0, -- 30%
  participant_rewards_fund DECIMAL(24,6) DEFAULT 0, -- 20%
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- GRAIN PRICE HISTORY
-- Track GRAIN token price over time
CREATE TABLE IF NOT EXISTS grain_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_usd DECIMAL(20,10) NOT NULL,
  total_backing DECIMAL(24,2) NOT NULL,
  circulating_supply DECIMAL(24,6) NOT NULL,
  market_cap DECIMAL(24,2) NOT NULL,
  daily_volume DECIMAL(24,2) DEFAULT 0,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(recorded_at)
);

-- YIELD DISTRIBUTIONS
-- Track all yield distributions
CREATE TABLE IF NOT EXISTS yield_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'vault_deposit', 'grain_pool'
  source_id UUID NOT NULL,
  total_yield DECIMAL(20,6) NOT NULL,
  wells_share DECIMAL(20,6) NOT NULL, -- 50%
  grain_appreciation DECIMAL(20,6) NOT NULL, -- 30%
  participant_rewards DECIMAL(20,6) NOT NULL, -- 20%
  grain_price_at_distribution DECIMAL(20,10),
  distributed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ACCOUNT REWARDS
-- Participant rewards from the flywheel
CREATE TABLE IF NOT EXISTS account_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL, -- References silent_accounts
  reward_type TEXT NOT NULL, -- 'float_yield', 'referral_bonus', 'volume_bonus', 'grain_dividend'
  amount DECIMAL(20,6) NOT NULL,
  currency TEXT DEFAULT 'USDC',
  grain_equivalent DECIMAL(20,6), -- If paid in GRAIN
  source_transaction_id TEXT,
  source_float_id UUID,
  status TEXT DEFAULT 'pending', -- pending, credited, claimed
  credited_at TIMESTAMP,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- DAILY FLOAT METRICS
-- Aggregate float metrics for dashboards
CREATE TABLE IF NOT EXISTS daily_float_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL UNIQUE,
  total_float_outstanding DECIMAL(24,2) DEFAULT 0,
  total_deployed_to_vault DECIMAL(24,2) DEFAULT 0,
  daily_new_float DECIMAL(24,2) DEFAULT 0,
  daily_settled_float DECIMAL(24,2) DEFAULT 0,
  daily_yield_generated DECIMAL(20,6) DEFAULT 0,
  daily_wells_revenue DECIMAL(20,6) DEFAULT 0,
  daily_grain_appreciation DECIMAL(20,6) DEFAULT 0,
  daily_participant_rewards DECIMAL(20,6) DEFAULT 0,
  avg_settlement_days DECIMAL(5,2) DEFAULT 3,
  grain_price_open DECIMAL(20,10),
  grain_price_close DECIMAL(20,10),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- FLYWHEEL SNAPSHOTS
-- Track overall flywheel health
CREATE TABLE IF NOT EXISTS flywheel_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_time TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Float metrics
  total_float_all_time DECIMAL(24,2) DEFAULT 0,
  current_float_outstanding DECIMAL(24,2) DEFAULT 0,
  avg_float_duration_days DECIMAL(5,2) DEFAULT 3,

  -- Vault metrics
  total_deployed_to_vault DECIMAL(24,2) DEFAULT 0,
  current_vault_balance DECIMAL(24,2) DEFAULT 0,
  total_yield_generated DECIMAL(24,6) DEFAULT 0,
  current_blended_apy DECIMAL(8,6) DEFAULT 0,

  -- Revenue metrics
  total_wells_revenue DECIMAL(24,6) DEFAULT 0,
  daily_wells_revenue DECIMAL(20,6) DEFAULT 0,

  -- GRAIN metrics
  grain_total_supply DECIMAL(24,6) DEFAULT 1000000000, -- 1B total
  grain_circulating_supply DECIMAL(24,6) DEFAULT 0,
  grain_price_usd DECIMAL(20,10) DEFAULT 1.0,
  grain_market_cap DECIMAL(24,2) DEFAULT 0,
  grain_backing_value DECIMAL(24,2) DEFAULT 0,

  -- Participant metrics
  total_participant_rewards DECIMAL(24,6) DEFAULT 0,
  unique_reward_recipients INTEGER DEFAULT 0,

  -- Growth metrics
  float_growth_rate_7d DECIMAL(8,4) DEFAULT 0,
  yield_growth_rate_7d DECIMAL(8,4) DEFAULT 0,

  UNIQUE(snapshot_time)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_float_positions_source ON float_positions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_float_positions_status ON float_positions(status);
CREATE INDEX IF NOT EXISTS idx_float_positions_settlement ON float_positions(settlement_due);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_status ON vault_deposits(status);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_pool ON vault_deposits(grain_pool_id);
CREATE INDEX IF NOT EXISTS idx_yield_distributions_source ON yield_distributions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_account_rewards_account ON account_rewards(account_id);
CREATE INDEX IF NOT EXISTS idx_account_rewards_status ON account_rewards(status);
CREATE INDEX IF NOT EXISTS idx_daily_float_metrics_date ON daily_float_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_grain_price_recorded ON grain_price_history(recorded_at);

-- INITIAL GRAIN POOL
INSERT INTO grain_pools (pool_name, total_backing_value, current_apy)
VALUES ('primary_treasury', 0, 0.045)
ON CONFLICT (pool_name) DO NOTHING;

-- INITIAL GRAIN PRICE
INSERT INTO grain_price_history (price_usd, total_backing, circulating_supply, market_cap)
VALUES (1.00, 0, 0, 0)
ON CONFLICT DO NOTHING;
