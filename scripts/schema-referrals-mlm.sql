-- ============================================================================
-- GRAIN & VAULT MLM REFERRAL NETWORK
-- Multi-level commission structure from the 4.5% platform fee
-- Run: psql $POSTGRES_URL < scripts/schema-referrals-mlm.sql
-- ============================================================================

-- REFERRAL CHAINS
-- Track the complete referral tree (who referred who)
CREATE TABLE IF NOT EXISTS referral_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,           -- The user
  referrer_id TEXT,                        -- Who directly referred them (L1)
  referrer_l2_id TEXT,                     -- Referrer's referrer (L2)
  referrer_l3_id TEXT,                     -- L2's referrer (L3)

  -- Chain depth tracking
  depth INTEGER NOT NULL DEFAULT 0,        -- How deep in the tree this user is

  -- Stats
  direct_referrals INTEGER DEFAULT 0,      -- Users this person has directly referred
  network_size INTEGER DEFAULT 0,          -- Total downstream network size

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_chains_user ON referral_chains(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_chains_referrer ON referral_chains(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_chains_l2 ON referral_chains(referrer_l2_id);
CREATE INDEX IF NOT EXISTS idx_referral_chains_l3 ON referral_chains(referrer_l3_id);

-- MLM COMMISSION CONFIG
-- Commission percentages by level (% of the 4.5% platform fee)
CREATE TABLE IF NOT EXISTS referral_commission_config (
  level INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 3),

  -- Commission as % of the 4.5% platform fee
  commission_pct DECIMAL(5,2) NOT NULL,    -- e.g., 20.00 = 20% of 4.5% = 0.9%

  -- Effective rate (pre-calculated for convenience)
  effective_rate DECIMAL(5,4) NOT NULL,    -- e.g., 0.0090 = 0.9%

  -- Display
  display_name TEXT NOT NULL,
  description TEXT,

  -- Is this level active?
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert commission structure:
-- Platform fee: 4.5%
-- L1 (direct): 20% of 4.5% = 0.9%
-- L2 (indirect): 10% of 4.5% = 0.45%
-- L3 (network): 5% of 4.5% = 0.225%
-- Total to referrers: 35% of 4.5% = 1.575%
-- Platform keeps: 65% of 4.5% = 2.925%
INSERT INTO referral_commission_config (level, commission_pct, effective_rate, display_name, description)
VALUES
  (1, 20.00, 0.0090, 'Direct Referral', 'Earn 0.9% on every transaction from people you refer'),
  (2, 10.00, 0.0045, 'Network Level 2', 'Earn 0.45% when your referrals bring in new users'),
  (3, 5.00, 0.00225, 'Network Level 3', 'Earn 0.225% from 3rd level network activity')
ON CONFLICT (level) DO UPDATE SET
  commission_pct = EXCLUDED.commission_pct,
  effective_rate = EXCLUDED.effective_rate,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

-- NETWORK COMMISSIONS
-- Track individual commission payments from transactions
CREATE TABLE IF NOT EXISTS network_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The transaction that generated this commission
  source_tx_id UUID NOT NULL,              -- treasury_transactions.id
  source_user_id TEXT NOT NULL,            -- User who made the transaction

  -- Who receives this commission
  recipient_id TEXT NOT NULL,              -- User receiving commission

  -- Commission details
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),

  -- Amounts
  transaction_amount DECIMAL(15,2) NOT NULL,  -- Original transaction amount
  platform_fee DECIMAL(15,2) NOT NULL,        -- 4.5% of transaction
  commission_pct DECIMAL(5,2) NOT NULL,       -- % of fee (e.g., 20.00)
  commission_amount DECIMAL(15,2) NOT NULL,   -- Actual commission earned

  -- GRAIN conversion
  grain_amount INTEGER NOT NULL,              -- Commission in GRAIN
  grain_rate DECIMAL(10,6),                   -- GRAIN per dollar at time of commission

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'failed')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  credited_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_network_commissions_recipient ON network_commissions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_network_commissions_source_user ON network_commissions(source_user_id);
CREATE INDEX IF NOT EXISTS idx_network_commissions_source_tx ON network_commissions(source_tx_id);
CREATE INDEX IF NOT EXISTS idx_network_commissions_level ON network_commissions(level);
CREATE INDEX IF NOT EXISTS idx_network_commissions_status ON network_commissions(status);
CREATE INDEX IF NOT EXISTS idx_network_commissions_created ON network_commissions(created_at DESC);

-- NETWORK STATS (aggregated for dashboard)
CREATE TABLE IF NOT EXISTS network_stats (
  user_id TEXT PRIMARY KEY,

  -- Network size
  direct_referrals INTEGER DEFAULT 0,        -- L1 count
  l2_network_size INTEGER DEFAULT 0,         -- L2 count
  l3_network_size INTEGER DEFAULT 0,         -- L3 count
  total_network_size INTEGER DEFAULT 0,      -- All levels

  -- Earnings by level
  l1_total_earned DECIMAL(15,2) DEFAULT 0,
  l2_total_earned DECIMAL(15,2) DEFAULT 0,
  l3_total_earned DECIMAL(15,2) DEFAULT 0,
  total_earned DECIMAL(15,2) DEFAULT 0,

  -- GRAIN earnings
  l1_grain_earned INTEGER DEFAULT 0,
  l2_grain_earned INTEGER DEFAULT 0,
  l3_grain_earned INTEGER DEFAULT 0,
  total_grain_earned INTEGER DEFAULT 0,

  -- This month
  monthly_earned DECIMAL(15,2) DEFAULT 0,
  monthly_grain_earned INTEGER DEFAULT 0,

  -- Activity
  active_network_users INTEGER DEFAULT 0,    -- Users who transacted this month

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_commission_at TIMESTAMP
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Set up referral chain when new user joins
CREATE OR REPLACE FUNCTION setup_referral_chain()
RETURNS TRIGGER AS $$
DECLARE
  l1_referrer TEXT;
  l2_referrer TEXT;
  l3_referrer TEXT;
  chain_depth INTEGER := 0;
BEGIN
  -- If this referral has a referrer_id (direct referrer)
  IF NEW.referrer_id IS NOT NULL THEN
    l1_referrer := NEW.referrer_id;
    chain_depth := 1;

    -- Look up L1's referrer chain to get L2 and L3
    SELECT referrer_id, referrer_l2_id
    INTO l2_referrer, l3_referrer
    FROM referral_chains
    WHERE user_id = l1_referrer;

    IF l2_referrer IS NOT NULL THEN
      chain_depth := chain_depth + 1;
    END IF;
    IF l3_referrer IS NOT NULL THEN
      chain_depth := chain_depth + 1;
    END IF;
  END IF;

  -- Insert or update chain record
  INSERT INTO referral_chains (
    user_id,
    referrer_id,
    referrer_l2_id,
    referrer_l3_id,
    depth
  ) VALUES (
    NEW.referee_id,
    l1_referrer,
    l2_referrer,
    l3_referrer,
    chain_depth
  )
  ON CONFLICT (user_id) DO UPDATE SET
    referrer_id = COALESCE(referral_chains.referrer_id, l1_referrer),
    referrer_l2_id = COALESCE(referral_chains.referrer_l2_id, l2_referrer),
    referrer_l3_id = COALESCE(referral_chains.referrer_l3_id, l3_referrer),
    depth = GREATEST(referral_chains.depth, chain_depth),
    updated_at = NOW();

  -- Update direct referral count for L1 referrer
  IF l1_referrer IS NOT NULL THEN
    UPDATE referral_chains
    SET direct_referrals = direct_referrals + 1,
        network_size = network_size + 1,
        updated_at = NOW()
    WHERE user_id = l1_referrer;

    -- Update network stats
    INSERT INTO network_stats (user_id, direct_referrals, total_network_size)
    VALUES (l1_referrer, 1, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      direct_referrals = network_stats.direct_referrals + 1,
      total_network_size = network_stats.total_network_size + 1,
      updated_at = NOW();
  END IF;

  -- Update L2 network count
  IF l2_referrer IS NOT NULL THEN
    UPDATE referral_chains
    SET network_size = network_size + 1,
        updated_at = NOW()
    WHERE user_id = l2_referrer;

    UPDATE network_stats
    SET l2_network_size = l2_network_size + 1,
        total_network_size = total_network_size + 1,
        updated_at = NOW()
    WHERE user_id = l2_referrer;
  END IF;

  -- Update L3 network count
  IF l3_referrer IS NOT NULL THEN
    UPDATE referral_chains
    SET network_size = network_size + 1,
        updated_at = NOW()
    WHERE user_id = l3_referrer;

    UPDATE network_stats
    SET l3_network_size = l3_network_size + 1,
        total_network_size = total_network_size + 1,
        updated_at = NOW()
    WHERE user_id = l3_referrer;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Set up chain when referral is marked as signed_up
DROP TRIGGER IF EXISTS setup_chain_on_signup ON referrals;
CREATE TRIGGER setup_chain_on_signup
  AFTER UPDATE OF status ON referrals
  FOR EACH ROW
  WHEN (NEW.status = 'signed_up' AND OLD.status = 'pending')
  EXECUTE FUNCTION setup_referral_chain();

-- Also handle direct inserts with signed_up status
DROP TRIGGER IF EXISTS setup_chain_on_insert ON referrals;
CREATE TRIGGER setup_chain_on_insert
  AFTER INSERT ON referrals
  FOR EACH ROW
  WHEN (NEW.referee_id IS NOT NULL)
  EXECUTE FUNCTION setup_referral_chain();

-- Calculate and distribute network commissions
-- This would typically be called by a cron job or transaction processor
CREATE OR REPLACE FUNCTION distribute_network_commissions(
  p_tx_id UUID,
  p_user_id TEXT,
  p_amount DECIMAL,
  p_grain_rate DECIMAL DEFAULT 0.001  -- 1 GRAIN = $0.001
)
RETURNS TABLE (
  recipient_id TEXT,
  level INTEGER,
  commission_amount DECIMAL,
  grain_amount INTEGER
) AS $$
DECLARE
  platform_fee DECIMAL;
  l1_id TEXT;
  l2_id TEXT;
  l3_id TEXT;
  config RECORD;
  commission DECIMAL;
  grain INTEGER;
BEGIN
  -- Calculate platform fee (4.5%)
  platform_fee := p_amount * 0.045;

  -- Get the user's referral chain
  SELECT referrer_id, referrer_l2_id, referrer_l3_id
  INTO l1_id, l2_id, l3_id
  FROM referral_chains
  WHERE user_id = p_user_id;

  -- Process L1 commission
  IF l1_id IS NOT NULL THEN
    SELECT * INTO config FROM referral_commission_config WHERE level = 1 AND is_active;
    IF config IS NOT NULL THEN
      commission := platform_fee * (config.commission_pct / 100);
      grain := FLOOR(commission / p_grain_rate);

      INSERT INTO network_commissions (
        source_tx_id, source_user_id, recipient_id, level,
        transaction_amount, platform_fee, commission_pct, commission_amount,
        grain_amount, grain_rate, status
      ) VALUES (
        p_tx_id, p_user_id, l1_id, 1,
        p_amount, platform_fee, config.commission_pct, commission,
        grain, p_grain_rate, 'pending'
      );

      -- Update stats
      UPDATE network_stats
      SET l1_total_earned = l1_total_earned + commission,
          l1_grain_earned = l1_grain_earned + grain,
          total_earned = total_earned + commission,
          total_grain_earned = total_grain_earned + grain,
          monthly_earned = monthly_earned + commission,
          monthly_grain_earned = monthly_grain_earned + grain,
          last_commission_at = NOW(),
          updated_at = NOW()
      WHERE user_id = l1_id;

      recipient_id := l1_id;
      level := 1;
      commission_amount := commission;
      grain_amount := grain;
      RETURN NEXT;
    END IF;
  END IF;

  -- Process L2 commission
  IF l2_id IS NOT NULL THEN
    SELECT * INTO config FROM referral_commission_config WHERE level = 2 AND is_active;
    IF config IS NOT NULL THEN
      commission := platform_fee * (config.commission_pct / 100);
      grain := FLOOR(commission / p_grain_rate);

      INSERT INTO network_commissions (
        source_tx_id, source_user_id, recipient_id, level,
        transaction_amount, platform_fee, commission_pct, commission_amount,
        grain_amount, grain_rate, status
      ) VALUES (
        p_tx_id, p_user_id, l2_id, 2,
        p_amount, platform_fee, config.commission_pct, commission,
        grain, p_grain_rate, 'pending'
      );

      UPDATE network_stats
      SET l2_total_earned = l2_total_earned + commission,
          l2_grain_earned = l2_grain_earned + grain,
          total_earned = total_earned + commission,
          total_grain_earned = total_grain_earned + grain,
          monthly_earned = monthly_earned + commission,
          monthly_grain_earned = monthly_grain_earned + grain,
          last_commission_at = NOW(),
          updated_at = NOW()
      WHERE user_id = l2_id;

      recipient_id := l2_id;
      level := 2;
      commission_amount := commission;
      grain_amount := grain;
      RETURN NEXT;
    END IF;
  END IF;

  -- Process L3 commission
  IF l3_id IS NOT NULL THEN
    SELECT * INTO config FROM referral_commission_config WHERE level = 3 AND is_active;
    IF config IS NOT NULL THEN
      commission := platform_fee * (config.commission_pct / 100);
      grain := FLOOR(commission / p_grain_rate);

      INSERT INTO network_commissions (
        source_tx_id, source_user_id, recipient_id, level,
        transaction_amount, platform_fee, commission_pct, commission_amount,
        grain_amount, grain_rate, status
      ) VALUES (
        p_tx_id, p_user_id, l3_id, 3,
        p_amount, platform_fee, config.commission_pct, commission,
        grain, p_grain_rate, 'pending'
      );

      UPDATE network_stats
      SET l3_total_earned = l3_total_earned + commission,
          l3_grain_earned = l3_grain_earned + grain,
          total_earned = total_earned + commission,
          total_grain_earned = total_grain_earned + grain,
          monthly_earned = monthly_earned + commission,
          monthly_grain_earned = monthly_grain_earned + grain,
          last_commission_at = NOW(),
          updated_at = NOW()
      WHERE user_id = l3_id;

      recipient_id := l3_id;
      level := 3;
      commission_amount := commission;
      grain_amount := grain;
      RETURN NEXT;
    END IF;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Network dashboard view
CREATE OR REPLACE VIEW network_dashboard AS
SELECT
  ns.user_id,

  -- Network size
  ns.direct_referrals,
  ns.l2_network_size,
  ns.l3_network_size,
  ns.total_network_size,

  -- Earnings breakdown
  ns.l1_total_earned,
  ns.l2_total_earned,
  ns.l3_total_earned,
  ns.total_earned,

  -- GRAIN earnings
  ns.l1_grain_earned,
  ns.l2_grain_earned,
  ns.l3_grain_earned,
  ns.total_grain_earned,

  -- Monthly
  ns.monthly_earned,
  ns.monthly_grain_earned,

  -- Commission rates
  (SELECT commission_pct FROM referral_commission_config WHERE level = 1) AS l1_commission_pct,
  (SELECT commission_pct FROM referral_commission_config WHERE level = 2) AS l2_commission_pct,
  (SELECT commission_pct FROM referral_commission_config WHERE level = 3) AS l3_commission_pct,

  -- Referral info
  rc.code AS referral_code,
  rc.custom_code,
  rc.tier,

  -- Chain info
  ch.referrer_id AS my_referrer,
  ch.depth AS chain_depth,

  ns.last_commission_at,
  ns.updated_at

FROM network_stats ns
LEFT JOIN referral_codes rc ON ns.user_id = rc.user_id
LEFT JOIN referral_chains ch ON ns.user_id = ch.user_id;

-- Top earners leaderboard
CREATE OR REPLACE VIEW network_leaderboard AS
SELECT
  ns.user_id,
  rc.code AS referral_code,
  rc.tier,
  ns.total_network_size,
  ns.total_earned,
  ns.total_grain_earned,
  ns.monthly_earned,
  ns.monthly_grain_earned,
  RANK() OVER (ORDER BY ns.total_earned DESC) AS all_time_rank,
  RANK() OVER (ORDER BY ns.monthly_earned DESC) AS monthly_rank
FROM network_stats ns
LEFT JOIN referral_codes rc ON ns.user_id = rc.user_id
WHERE ns.total_earned > 0
ORDER BY all_time_rank
LIMIT 100;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE referral_chains IS 'Tracks the MLM referral tree - who referred who up to 3 levels';
COMMENT ON TABLE referral_commission_config IS 'Commission percentages by level (% of 4.5% platform fee)';
COMMENT ON TABLE network_commissions IS 'Individual commission payments from transactions';
COMMENT ON TABLE network_stats IS 'Aggregated network statistics per user';
COMMENT ON FUNCTION distribute_network_commissions IS 'Call this when processing transactions to distribute MLM commissions';
