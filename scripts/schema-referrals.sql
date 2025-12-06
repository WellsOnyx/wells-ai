-- ============================================================================
-- GRAIN & VAULT REFERRAL SYSTEM SCHEMA
-- Run: psql $POSTGRES_URL < scripts/schema-referrals.sql
-- ============================================================================

-- REFERRAL CODES
-- Unique codes for each user to share
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,              -- Clerk user ID (referrer)

  -- Code Details
  code TEXT NOT NULL UNIQUE,                 -- e.g., "JOHN2024", "GV-ABC123"
  custom_code TEXT,                          -- User's custom vanity code (optional)

  -- Tier & Rewards
  tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'growth', 'ambassador')),
  reward_amount INTEGER NOT NULL DEFAULT 500, -- GRAIN per successful referral
  referee_bonus INTEGER NOT NULL DEFAULT 100, -- GRAIN bonus for person signing up

  -- Limits
  max_uses INTEGER,                          -- NULL = unlimited
  uses_count INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),

  -- Stats
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  total_grain_earned INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_tier ON referral_codes(tier);
CREATE INDEX IF NOT EXISTS idx_referral_codes_status ON referral_codes(status);

-- REFERRALS
-- Track individual referral conversions
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referrer (person who shared the code)
  referrer_id TEXT NOT NULL,                 -- Clerk user ID
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,

  -- Referee (person who signed up)
  referee_id TEXT,                           -- Clerk user ID (set after signup)
  referee_email TEXT,                        -- Email used to track before signup

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Code used, waiting for signup
    'signed_up',        -- Account created, waiting for verification
    'verified',         -- KYC/verification complete
    'qualified',        -- Met qualification criteria (e.g., first transaction)
    'rewarded',         -- GRAIN rewards distributed
    'rejected',         -- Failed verification or fraud
    'expired'           -- Took too long to convert
  )),

  -- Qualification
  qualification_type TEXT CHECK (qualification_type IN (
    'signup_only',      -- Just signup is enough
    'kyc_complete',     -- Must complete KYC
    'first_deposit',    -- Must make first deposit
    'first_transaction' -- Must complete first transaction
  )),
  qualified_at TIMESTAMP,

  -- Rewards
  referrer_reward INTEGER,                   -- GRAIN awarded to referrer
  referee_reward INTEGER,                    -- GRAIN awarded to referee
  referrer_rewarded_at TIMESTAMP,
  referee_rewarded_at TIMESTAMP,

  -- Transaction IDs (for reward tracking)
  referrer_tx_id UUID,
  referee_tx_id UUID,

  -- Attribution
  source TEXT,                               -- 'link', 'code', 'email', etc.
  campaign TEXT,                             -- Optional campaign tracking
  landing_page TEXT,                         -- Where they landed

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  signed_up_at TIMESTAMP,
  rewarded_at TIMESTAMP,
  expires_at TIMESTAMP                       -- When pending referral expires
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals(referee_email);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at DESC);

-- REFERRAL REWARDS LEDGER
-- Track all GRAIN rewards from referrals
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,                     -- Clerk user ID receiving reward
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,

  -- Reward Details
  amount INTEGER NOT NULL,                   -- GRAIN amount
  type TEXT NOT NULL CHECK (type IN ('referrer_bonus', 'referee_bonus', 'tier_bonus', 'milestone_bonus')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'failed', 'reversed')),

  -- Transaction
  transaction_id UUID,                       -- Link to treasury_transactions

  -- Details
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  credited_at TIMESTAMP,
  reversed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral ON referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_type ON referral_rewards(type);

-- REFERRAL TIERS CONFIG
-- Configuration for referral tiers (can be updated without code changes)
CREATE TABLE IF NOT EXISTS referral_tier_config (
  tier TEXT PRIMARY KEY CHECK (tier IN ('starter', 'growth', 'ambassador')),

  -- Requirements
  min_successful_referrals INTEGER NOT NULL DEFAULT 0,
  min_total_volume INTEGER,                  -- Optional: minimum transaction volume

  -- Rewards
  reward_per_referral INTEGER NOT NULL,      -- GRAIN per successful referral
  referee_bonus INTEGER NOT NULL,            -- GRAIN bonus for referee

  -- Special Perks
  custom_code_enabled BOOLEAN DEFAULT FALSE,
  priority_support BOOLEAN DEFAULT FALSE,
  early_access BOOLEAN DEFAULT FALSE,

  -- Limits
  max_monthly_rewards INTEGER,               -- Cap on monthly earnings

  -- Display
  display_name TEXT NOT NULL,
  description TEXT,
  badge_color TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default tier configuration
INSERT INTO referral_tier_config (tier, min_successful_referrals, reward_per_referral, referee_bonus, display_name, description, badge_color, custom_code_enabled, priority_support, early_access)
VALUES
  ('starter', 0, 500, 100, 'Starter', 'Welcome to the Grain & Vault referral program', '#6B7280', FALSE, FALSE, FALSE),
  ('growth', 5, 1000, 200, 'Growth', 'Unlocked after 5 successful referrals', '#3B82F6', TRUE, FALSE, TRUE),
  ('ambassador', 20, 2500, 500, 'Ambassador', 'Our top referrers with exclusive perks', '#F59E0B', TRUE, TRUE, TRUE)
ON CONFLICT (tier) DO NOTHING;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_referral_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW EXECUTE FUNCTION update_referral_updated_at();

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_referral_updated_at();

-- Update referral code stats when referral status changes
CREATE OR REPLACE FUNCTION update_referral_code_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats on referral_codes
  UPDATE referral_codes
  SET
    total_referrals = (
      SELECT COUNT(*) FROM referrals WHERE referral_code_id = NEW.referral_code_id
    ),
    successful_referrals = (
      SELECT COUNT(*) FROM referrals
      WHERE referral_code_id = NEW.referral_code_id
      AND status IN ('qualified', 'rewarded')
    ),
    uses_count = (
      SELECT COUNT(*) FROM referrals WHERE referral_code_id = NEW.referral_code_id
    ),
    last_used_at = NOW()
  WHERE id = NEW.referral_code_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_code_stats_on_referral
  AFTER INSERT OR UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_referral_code_stats();

-- Auto-upgrade referrer tier based on successful referrals
CREATE OR REPLACE FUNCTION check_tier_upgrade()
RETURNS TRIGGER AS $$
DECLARE
  new_tier TEXT;
  current_successful INTEGER;
BEGIN
  -- Get current successful referral count
  SELECT successful_referrals INTO current_successful
  FROM referral_codes
  WHERE user_id = NEW.referrer_id;

  -- Determine new tier based on count
  SELECT tier INTO new_tier
  FROM referral_tier_config
  WHERE min_successful_referrals <= current_successful
  ORDER BY min_successful_referrals DESC
  LIMIT 1;

  -- Update tier if changed
  IF new_tier IS NOT NULL THEN
    UPDATE referral_codes
    SET tier = new_tier,
        reward_amount = (SELECT reward_per_referral FROM referral_tier_config WHERE tier = new_tier)
    WHERE user_id = NEW.referrer_id
    AND tier != new_tier;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_tier_upgrade
  AFTER UPDATE OF status ON referrals
  FOR EACH ROW
  WHEN (NEW.status IN ('qualified', 'rewarded'))
  EXECUTE FUNCTION check_tier_upgrade();

-- Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'GV-';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Referral dashboard view
CREATE OR REPLACE VIEW referral_dashboard AS
SELECT
  rc.user_id,
  rc.code,
  rc.tier,
  rc.status,
  rc.reward_amount,
  rc.total_referrals,
  rc.successful_referrals,
  rc.total_grain_earned,

  -- Pending stats
  COALESCE(pending.count, 0) AS pending_referrals,

  -- This month stats
  COALESCE(monthly.count, 0) AS referrals_this_month,
  COALESCE(monthly.earned, 0) AS grain_earned_this_month,

  -- Tier info
  tc.display_name AS tier_name,
  tc.badge_color,
  tc.custom_code_enabled,

  -- Next tier
  next_tier.tier AS next_tier,
  next_tier.min_successful_referrals AS next_tier_requirement,
  (next_tier.min_successful_referrals - rc.successful_referrals) AS referrals_to_next_tier,

  rc.created_at,
  rc.last_used_at
FROM referral_codes rc
LEFT JOIN referral_tier_config tc ON rc.tier = tc.tier

-- Pending referrals
LEFT JOIN (
  SELECT referrer_id, COUNT(*) AS count
  FROM referrals
  WHERE status IN ('pending', 'signed_up', 'verified')
  GROUP BY referrer_id
) pending ON rc.user_id = pending.referrer_id

-- This month's stats
LEFT JOIN (
  SELECT
    referrer_id,
    COUNT(*) AS count,
    SUM(referrer_reward) AS earned
  FROM referrals
  WHERE status = 'rewarded'
  AND rewarded_at >= date_trunc('month', NOW())
  GROUP BY referrer_id
) monthly ON rc.user_id = monthly.referrer_id

-- Next tier info
LEFT JOIN LATERAL (
  SELECT tier, min_successful_referrals
  FROM referral_tier_config
  WHERE min_successful_referrals > rc.successful_referrals
  ORDER BY min_successful_referrals
  LIMIT 1
) next_tier ON true;

-- Leaderboard view
CREATE OR REPLACE VIEW referral_leaderboard AS
SELECT
  rc.user_id,
  rc.code,
  rc.tier,
  rc.successful_referrals,
  rc.total_grain_earned,
  tc.display_name AS tier_name,
  tc.badge_color,
  RANK() OVER (ORDER BY rc.successful_referrals DESC, rc.total_grain_earned DESC) AS rank
FROM referral_codes rc
LEFT JOIN referral_tier_config tc ON rc.tier = tc.tier
WHERE rc.status = 'active'
AND rc.successful_referrals > 0
ORDER BY rank
LIMIT 100;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE referral_codes IS 'Unique referral codes for each user with tier-based rewards';
COMMENT ON TABLE referrals IS 'Individual referral tracking from code use to reward distribution';
COMMENT ON TABLE referral_rewards IS 'Ledger of all GRAIN rewards from referral program';
COMMENT ON TABLE referral_tier_config IS 'Configuration for referral tiers (editable without code changes)';
COMMENT ON FUNCTION generate_referral_code() IS 'Generate unique GV-XXXXXX format referral codes';
