-- ============================================================================
-- ATTRIBUTION NETWORK SCHEMA
-- Enterprise affiliate network for peer-to-peer introductions
-- Run: psql $POSTGRES_URL < scripts/schema-attribution.sql
-- ============================================================================

-- USER CONNECTIONS (30 max per user)
-- Direct peer-to-peer connections for offer introductions
CREATE TABLE IF NOT EXISTS attr_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Connection parties
  requester_id TEXT NOT NULL,           -- Who initiated the connection
  accepter_id TEXT NOT NULL,            -- Who accepted

  -- User display info (denormalized for perf)
  requester_name TEXT,
  requester_email TEXT,
  accepter_name TEXT,
  accepter_email TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'removed')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure unique connections (bidirectional)
  UNIQUE (requester_id, accepter_id)
);

CREATE INDEX IF NOT EXISTS idx_attr_connections_requester ON attr_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_attr_connections_accepter ON attr_connections(accepter_id);
CREATE INDEX IF NOT EXISTS idx_attr_connections_status ON attr_connections(status);

-- OFFERS
-- Enterprise deals/opportunities with custom commission terms
CREATE TABLE IF NOT EXISTS attr_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  owner_id TEXT NOT NULL,               -- User who created the offer
  owner_name TEXT,

  -- Offer details
  title TEXT NOT NULL,
  description TEXT,
  value DECIMAL(20, 2) NOT NULL,        -- Deal value in USD
  currency TEXT DEFAULT 'USD',

  -- Commission structure (user-defined per level)
  l1_commission_pct DECIMAL(5, 2) NOT NULL DEFAULT 10.00,  -- Level 1 (direct introducer)
  l2_commission_pct DECIMAL(5, 2) NOT NULL DEFAULT 5.00,   -- Level 2
  l3_commission_pct DECIMAL(5, 2) NOT NULL DEFAULT 3.00,   -- Level 3
  l4_commission_pct DECIMAL(5, 2) NOT NULL DEFAULT 2.00,   -- Level 4

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'cancelled')),

  -- Metadata
  category TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',

  -- Expiry
  expires_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attr_offers_owner ON attr_offers(owner_id);
CREATE INDEX IF NOT EXISTS idx_attr_offers_status ON attr_offers(status);

-- OFFER INTRODUCTIONS
-- Track when an offer is shared through the network
CREATE TABLE IF NOT EXISTS attr_introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  offer_id UUID NOT NULL REFERENCES attr_offers(id) ON DELETE CASCADE,

  -- Who introduced to whom
  introducer_id TEXT NOT NULL,          -- Person making the introduction
  recipient_id TEXT NOT NULL,           -- Person receiving the introduction

  -- Display info
  introducer_name TEXT,
  recipient_name TEXT,

  -- Chain position (1-4)
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),

  -- Upstream chain (who introduced the introducer to this offer)
  parent_introduction_id UUID REFERENCES attr_introductions(id),

  -- Full chain tracking for fast lookups (denormalized)
  l1_user_id TEXT,
  l2_user_id TEXT,
  l3_user_id TEXT,
  l4_user_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'interested', 'passed', 'converted')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  viewed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attr_introductions_offer ON attr_introductions(offer_id);
CREATE INDEX IF NOT EXISTS idx_attr_introductions_introducer ON attr_introductions(introducer_id);
CREATE INDEX IF NOT EXISTS idx_attr_introductions_recipient ON attr_introductions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_attr_introductions_level ON attr_introductions(level);

-- DEAL CLOSURES
-- When an offer closes with someone in the chain
CREATE TABLE IF NOT EXISTS attr_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  offer_id UUID NOT NULL REFERENCES attr_offers(id),
  introduction_id UUID REFERENCES attr_introductions(id),

  -- Final closer
  closer_id TEXT NOT NULL,              -- Who closed the deal (end of chain)
  closer_name TEXT,

  -- Deal terms
  actual_value DECIMAL(20, 2) NOT NULL, -- Final deal value
  currency TEXT DEFAULT 'USD',

  -- Chain at closure (frozen snapshot)
  l1_user_id TEXT,
  l2_user_id TEXT,
  l3_user_id TEXT,
  l4_user_id TEXT,

  -- Commission rates at closure (frozen)
  l1_pct DECIMAL(5, 2),
  l2_pct DECIMAL(5, 2),
  l3_pct DECIMAL(5, 2),
  l4_pct DECIMAL(5, 2),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'paid', 'disputed', 'cancelled')),

  -- External reference
  external_deal_id TEXT,                -- Link to deals_v2 if applicable
  proof_url TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP,
  paid_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attr_closures_offer ON attr_closures(offer_id);
CREATE INDEX IF NOT EXISTS idx_attr_closures_closer ON attr_closures(closer_id);
CREATE INDEX IF NOT EXISTS idx_attr_closures_status ON attr_closures(status);

-- COMMISSION PAYOUTS
-- Individual commission payments per level
CREATE TABLE IF NOT EXISTS attr_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  closure_id UUID NOT NULL REFERENCES attr_closures(id),
  offer_id UUID NOT NULL REFERENCES attr_offers(id),

  -- Recipient
  recipient_id TEXT NOT NULL,
  recipient_name TEXT,

  -- Level and amounts
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  deal_value DECIMAL(20, 2) NOT NULL,
  commission_pct DECIMAL(5, 2) NOT NULL,
  commission_usd DECIMAL(20, 2) NOT NULL,

  -- GRAIN conversion (1 GRAIN = $0.001 USD, so 1000 GRAIN = $1)
  grain_amount BIGINT NOT NULL,
  grain_rate DECIMAL(10, 6) DEFAULT 0.001,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'failed')),

  -- Transaction tracking
  grain_tx_id TEXT,                      -- Reference to grain transaction

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  credited_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attr_commissions_closure ON attr_commissions(closure_id);
CREATE INDEX IF NOT EXISTS idx_attr_commissions_recipient ON attr_commissions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_attr_commissions_status ON attr_commissions(status);

-- NETWORK STATS (aggregated per user)
CREATE TABLE IF NOT EXISTS attr_network_stats (
  user_id TEXT PRIMARY KEY,

  -- Connection counts
  direct_connections INTEGER DEFAULT 0,

  -- Network reach (4 levels)
  l1_network_size INTEGER DEFAULT 0,
  l2_network_size INTEGER DEFAULT 0,
  l3_network_size INTEGER DEFAULT 0,
  l4_network_size INTEGER DEFAULT 0,
  total_network_size INTEGER DEFAULT 0,

  -- Activity
  total_offers_created INTEGER DEFAULT 0,
  total_offers_closed INTEGER DEFAULT 0,
  total_introductions_made INTEGER DEFAULT 0,
  total_introductions_received INTEGER DEFAULT 0,

  -- Commission earnings by level (USD)
  l1_total_earned DECIMAL(15, 2) DEFAULT 0,
  l2_total_earned DECIMAL(15, 2) DEFAULT 0,
  l3_total_earned DECIMAL(15, 2) DEFAULT 0,
  l4_total_earned DECIMAL(15, 2) DEFAULT 0,
  total_earned DECIMAL(15, 2) DEFAULT 0,

  -- GRAIN
  total_grain_earned BIGINT DEFAULT 0,

  -- Monthly (reset monthly)
  monthly_earned DECIMAL(15, 2) DEFAULT 0,
  monthly_grain_earned BIGINT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user has reached 30 connection limit
CREATE OR REPLACE FUNCTION check_connection_limit(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  connection_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO connection_count
  FROM attr_connections
  WHERE (requester_id = p_user_id OR accepter_id = p_user_id)
    AND status = 'active';
  RETURN connection_count;
END;
$$ LANGUAGE plpgsql;

-- Get user's direct connections
CREATE OR REPLACE FUNCTION get_user_connections(p_user_id TEXT)
RETURNS TABLE (
  connection_id UUID,
  connected_user_id TEXT,
  connected_user_name TEXT,
  connected_user_email TEXT,
  direction TEXT,
  connected_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    CASE WHEN c.requester_id = p_user_id THEN c.accepter_id ELSE c.requester_id END,
    CASE WHEN c.requester_id = p_user_id THEN c.accepter_name ELSE c.requester_name END,
    CASE WHEN c.requester_id = p_user_id THEN c.accepter_email ELSE c.requester_email END,
    CASE WHEN c.requester_id = p_user_id THEN 'sent'::TEXT ELSE 'received'::TEXT END,
    c.accepted_at
  FROM attr_connections c
  WHERE (c.requester_id = p_user_id OR c.accepter_id = p_user_id)
    AND c.status = 'active'
  ORDER BY c.accepted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Calculate commissions for a closure
CREATE OR REPLACE FUNCTION calculate_closure_commissions(p_closure_id UUID)
RETURNS TABLE (
  recipient_id TEXT,
  level INTEGER,
  commission_usd DECIMAL,
  grain_amount BIGINT
) AS $$
DECLARE
  v_closure RECORD;
  v_grain_rate DECIMAL := 0.001; -- 1 GRAIN = $0.001
BEGIN
  SELECT * INTO v_closure FROM attr_closures WHERE id = p_closure_id;

  -- L1 commission
  IF v_closure.l1_user_id IS NOT NULL AND v_closure.l1_pct > 0 THEN
    RETURN QUERY SELECT
      v_closure.l1_user_id,
      1,
      v_closure.actual_value * v_closure.l1_pct / 100,
      (v_closure.actual_value * v_closure.l1_pct / 100 / v_grain_rate)::BIGINT;
  END IF;

  -- L2 commission
  IF v_closure.l2_user_id IS NOT NULL AND v_closure.l2_pct > 0 THEN
    RETURN QUERY SELECT
      v_closure.l2_user_id,
      2,
      v_closure.actual_value * v_closure.l2_pct / 100,
      (v_closure.actual_value * v_closure.l2_pct / 100 / v_grain_rate)::BIGINT;
  END IF;

  -- L3 commission
  IF v_closure.l3_user_id IS NOT NULL AND v_closure.l3_pct > 0 THEN
    RETURN QUERY SELECT
      v_closure.l3_user_id,
      3,
      v_closure.actual_value * v_closure.l3_pct / 100,
      (v_closure.actual_value * v_closure.l3_pct / 100 / v_grain_rate)::BIGINT;
  END IF;

  -- L4 commission
  IF v_closure.l4_user_id IS NOT NULL AND v_closure.l4_pct > 0 THEN
    RETURN QUERY SELECT
      v_closure.l4_user_id,
      4,
      v_closure.actual_value * v_closure.l4_pct / 100,
      (v_closure.actual_value * v_closure.l4_pct / 100 / v_grain_rate)::BIGINT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update network stats for a user
CREATE OR REPLACE FUNCTION update_user_network_stats(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO attr_network_stats (user_id, direct_connections, updated_at)
  VALUES (p_user_id, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    direct_connections = (
      SELECT COUNT(*) FROM attr_connections
      WHERE (requester_id = p_user_id OR accepter_id = p_user_id) AND status = 'active'
    ),
    total_offers_created = (
      SELECT COUNT(*) FROM attr_offers WHERE owner_id = p_user_id
    ),
    total_introductions_made = (
      SELECT COUNT(*) FROM attr_introductions WHERE introducer_id = p_user_id
    ),
    total_introductions_received = (
      SELECT COUNT(*) FROM attr_introductions WHERE recipient_id = p_user_id
    ),
    total_earned = (
      SELECT COALESCE(SUM(commission_usd), 0) FROM attr_commissions
      WHERE recipient_id = p_user_id AND status = 'credited'
    ),
    total_grain_earned = (
      SELECT COALESCE(SUM(grain_amount), 0) FROM attr_commissions
      WHERE recipient_id = p_user_id AND status = 'credited'
    ),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
