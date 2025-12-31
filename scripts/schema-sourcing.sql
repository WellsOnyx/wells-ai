-- ============================================================================
-- BUYER SOURCING INTAKE & DISCOVERY SYSTEM
-- ============================================================================
--
-- This schema supports the buyer-side sourcing workflow:
-- 1. Buyer submits sourcing request
-- 2. AI matches suppliers to the request
-- 3. Introductions are made
-- 4. Deals are negotiated and closed
-- 5. Transactions are tracked (with 1% fee via GRAIN)
--
-- Run: psql $POSTGRES_URL < scripts/schema-sourcing.sql
-- ============================================================================

-- ============================================================================
-- SOURCING REQUESTS
-- What buyers need to source
-- ============================================================================

CREATE TABLE IF NOT EXISTS sourcing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  company_name TEXT,

  -- Request basics
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Category (matches lib/wells-ai/sourcing/categories.ts)
  category_id TEXT NOT NULL,
  subcategory_id TEXT,

  -- Specifications (JSONB for flexibility)
  -- Contains all the category-specific specs filled out by the buyer
  specifications JSONB NOT NULL DEFAULT '{}',

  -- Quantity and frequency
  quantity DECIMAL(20,2),
  unit_of_measure TEXT,
  order_frequency TEXT CHECK (order_frequency IN (
    'one-time', 'weekly', 'monthly', 'quarterly', 'annually', 'as-needed'
  )),

  -- Budget
  budget_min DECIMAL(20,2),
  budget_max DECIMAL(20,2),
  budget_currency TEXT DEFAULT 'USD',

  -- Location / Delivery
  delivery_location TEXT NOT NULL,
  delivery_country TEXT DEFAULT 'US',

  -- Timeline
  urgency TEXT DEFAULT 'standard' CHECK (urgency IN (
    'urgent', 'standard', 'future', 'ongoing'
  )),
  needed_by DATE,

  -- Pain points with current suppliers
  current_pain_points TEXT,
  current_suppliers TEXT, -- Names of current suppliers, if any

  -- Certifications required
  required_certifications TEXT[] DEFAULT '{}',

  -- Additional notes
  additional_requirements TEXT,

  -- Preferences
  prefer_grain_enabled BOOLEAN DEFAULT TRUE, -- Prefer suppliers using GRAIN for instant payment
  prefer_domestic BOOLEAN DEFAULT FALSE,

  -- Status
  status TEXT DEFAULT 'submitted' CHECK (status IN (
    'draft', 'submitted', 'matching', 'matched', 'in_review',
    'quoted', 'negotiating', 'deal_closed', 'cancelled'
  )),

  -- Matching metadata
  matches_count INTEGER DEFAULT 0,
  best_match_score INTEGER,
  last_matched_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_user ON sourcing_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_status ON sourcing_requests(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_category ON sourcing_requests(category_id, subcategory_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_urgency ON sourcing_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_created ON sourcing_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_specs ON sourcing_requests USING GIN(specifications);

-- ============================================================================
-- SOURCING MATCHES
-- AI-matched suppliers for each request
-- ============================================================================

CREATE TABLE IF NOT EXISTS sourcing_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  request_id UUID NOT NULL REFERENCES sourcing_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Match scoring
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_reasoning TEXT, -- AI explanation of why this is a good match

  -- Score breakdown (JSONB for flexibility)
  -- { "product_match": 85, "capacity": 90, "certifications": 100, "lead_time": 75, "location": 80, "price_range": 70 }
  score_breakdown JSONB DEFAULT '{}',

  -- GRAIN bonus
  grain_enabled BOOLEAN DEFAULT FALSE, -- Whether this supplier accepts GRAIN
  grain_bonus_applied BOOLEAN DEFAULT FALSE,

  -- AI analysis
  strengths TEXT[] DEFAULT '{}',
  concerns TEXT[] DEFAULT '{}',

  -- Estimates from AI
  estimated_price_low DECIMAL(20,2),
  estimated_price_high DECIMAL(20,2),
  estimated_lead_time_days INTEGER,

  -- Buyer interaction status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'interested', 'declined', 'intro_requested',
    'intro_sent', 'in_negotiation', 'quote_received', 'won', 'lost'
  )),

  -- Buyer notes
  buyer_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ,

  -- Unique constraint
  UNIQUE (request_id, supplier_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_request ON sourcing_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_supplier ON sourcing_matches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_score ON sourcing_matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_status ON sourcing_matches(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_grain ON sourcing_matches(grain_enabled) WHERE grain_enabled = TRUE;

-- ============================================================================
-- SOURCING INTRODUCTIONS
-- When buyer requests intro to a matched supplier
-- ============================================================================

CREATE TABLE IF NOT EXISTS sourcing_introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  match_id UUID NOT NULL REFERENCES sourcing_matches(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES sourcing_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Buyer info
  buyer_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_company TEXT,
  buyer_message TEXT, -- Optional custom message from buyer

  -- Supplier info (denormalized for quick access)
  supplier_email TEXT NOT NULL,
  supplier_company TEXT NOT NULL,

  -- Intro status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'viewed', 'responded', 'meeting_scheduled', 'declined'
  )),

  -- Intro content (generated by AI)
  intro_subject TEXT,
  intro_body TEXT,

  -- Response tracking
  supplier_response TEXT,
  supplier_responded_at TIMESTAMPTZ,

  -- Meeting scheduling (if applicable)
  meeting_scheduled_at TIMESTAMPTZ,
  meeting_link TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sourcing_intros_match ON sourcing_introductions(match_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_intros_request ON sourcing_introductions(request_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_intros_supplier ON sourcing_introductions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_intros_buyer ON sourcing_introductions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_intros_status ON sourcing_introductions(status);

-- ============================================================================
-- SOURCING TRANSACTIONS
-- Completed deals with fee tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS sourcing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  request_id UUID NOT NULL REFERENCES sourcing_requests(id),
  match_id UUID NOT NULL REFERENCES sourcing_matches(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),

  -- Parties
  buyer_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,

  -- Deal details
  deal_value DECIMAL(20,2) NOT NULL,
  deal_currency TEXT DEFAULT 'USD',
  deal_description TEXT,

  -- Fee calculation (1% success fee)
  fee_percentage DECIMAL(5,4) DEFAULT 0.01, -- 1%
  fee_amount DECIMAL(20,2) NOT NULL,
  fee_currency TEXT DEFAULT 'USD',

  -- Payment method
  payment_method TEXT CHECK (payment_method IN (
    'grain', 'usdc', 'wire', 'ach', 'check', 'other'
  )),
  grain_payment_id TEXT, -- If paid via GRAIN

  -- Links to escrow if used
  escrow_id TEXT REFERENCES escrow_deals(id),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'fee_collected', 'completed', 'disputed', 'refunded'
  )),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  fee_collected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sourcing_tx_request ON sourcing_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_tx_match ON sourcing_transactions(match_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_tx_supplier ON sourcing_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_tx_buyer ON sourcing_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_tx_status ON sourcing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_tx_grain ON sourcing_transactions(grain_payment_id) WHERE grain_payment_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sourcing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all sourcing tables
DO $$
BEGIN
  -- sourcing_requests
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sourcing_requests_updated_at') THEN
    CREATE TRIGGER update_sourcing_requests_updated_at
      BEFORE UPDATE ON sourcing_requests
      FOR EACH ROW EXECUTE FUNCTION update_sourcing_updated_at();
  END IF;

  -- sourcing_matches
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sourcing_matches_updated_at') THEN
    CREATE TRIGGER update_sourcing_matches_updated_at
      BEFORE UPDATE ON sourcing_matches
      FOR EACH ROW EXECUTE FUNCTION update_sourcing_updated_at();
  END IF;

  -- sourcing_introductions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sourcing_intros_updated_at') THEN
    CREATE TRIGGER update_sourcing_intros_updated_at
      BEFORE UPDATE ON sourcing_introductions
      FOR EACH ROW EXECUTE FUNCTION update_sourcing_updated_at();
  END IF;

  -- sourcing_transactions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sourcing_tx_updated_at') THEN
    CREATE TRIGGER update_sourcing_tx_updated_at
      BEFORE UPDATE ON sourcing_transactions
      FOR EACH ROW EXECUTE FUNCTION update_sourcing_updated_at();
  END IF;
END $$;

-- Update match count on sourcing_requests when matches are added
CREATE OR REPLACE FUNCTION update_request_match_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sourcing_requests
    SET
      matches_count = matches_count + 1,
      best_match_score = GREATEST(COALESCE(best_match_score, 0), NEW.match_score),
      last_matched_at = NOW()
    WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sourcing_requests
    SET matches_count = matches_count - 1
    WHERE id = OLD.request_id;

    -- Recalculate best match score
    UPDATE sourcing_requests
    SET best_match_score = (
      SELECT MAX(match_score) FROM sourcing_matches WHERE request_id = OLD.request_id
    )
    WHERE id = OLD.request_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_request_match_counts ON sourcing_matches;
CREATE TRIGGER trigger_update_request_match_counts
  AFTER INSERT OR DELETE ON sourcing_matches
  FOR EACH ROW EXECUTE FUNCTION update_request_match_counts();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active sourcing requests with match summary
CREATE OR REPLACE VIEW sourcing_requests_summary AS
SELECT
  r.*,
  COALESCE(m.total_matches, 0) AS total_matches,
  COALESCE(m.interested_count, 0) AS interested_count,
  COALESCE(m.intro_sent_count, 0) AS intro_sent_count,
  COALESCE(m.negotiating_count, 0) AS negotiating_count,
  m.top_supplier_name,
  m.top_match_score
FROM sourcing_requests r
LEFT JOIN (
  SELECT
    request_id,
    COUNT(*) AS total_matches,
    COUNT(*) FILTER (WHERE status = 'interested') AS interested_count,
    COUNT(*) FILTER (WHERE status IN ('intro_requested', 'intro_sent')) AS intro_sent_count,
    COUNT(*) FILTER (WHERE status = 'in_negotiation') AS negotiating_count,
    (
      SELECT s.company_name
      FROM sourcing_matches sm
      JOIN suppliers s ON sm.supplier_id = s.id
      WHERE sm.request_id = sourcing_matches.request_id
      ORDER BY sm.match_score DESC
      LIMIT 1
    ) AS top_supplier_name,
    MAX(match_score) AS top_match_score
  FROM sourcing_matches
  GROUP BY request_id
) m ON r.id = m.request_id
WHERE r.status NOT IN ('cancelled', 'draft')
ORDER BY r.created_at DESC;

-- Supplier match leaderboard (which suppliers win the most deals)
CREATE OR REPLACE VIEW supplier_win_rates AS
SELECT
  s.id,
  s.company_name,
  COUNT(DISTINCT sm.request_id) AS total_matches,
  COUNT(DISTINCT sm.request_id) FILTER (WHERE sm.status = 'won') AS wins,
  COUNT(DISTINCT sm.request_id) FILTER (WHERE sm.status = 'lost') AS losses,
  ROUND(
    COUNT(DISTINCT sm.request_id) FILTER (WHERE sm.status = 'won')::DECIMAL /
    NULLIF(COUNT(DISTINCT sm.request_id) FILTER (WHERE sm.status IN ('won', 'lost')), 0) * 100,
    1
  ) AS win_rate_pct,
  AVG(sm.match_score) AS avg_match_score,
  SUM(st.deal_value) AS total_deal_value,
  SUM(st.fee_amount) AS total_fees_generated
FROM suppliers s
LEFT JOIN sourcing_matches sm ON s.id = sm.supplier_id
LEFT JOIN sourcing_transactions st ON sm.id = st.match_id AND st.status = 'completed'
GROUP BY s.id, s.company_name
ORDER BY wins DESC, avg_match_score DESC;

-- Buyer sourcing dashboard stats
CREATE OR REPLACE VIEW buyer_sourcing_stats AS
SELECT
  user_id,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status IN ('submitted', 'matching', 'matched')) AS active_count,
  COUNT(*) FILTER (WHERE status = 'deal_closed') AS closed_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  SUM(matches_count) AS total_matches_received,
  AVG(best_match_score) AS avg_best_match_score,
  SUM(CASE WHEN status = 'deal_closed' THEN 1 ELSE 0 END)::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('deal_closed', 'cancelled')), 0) * 100 AS success_rate
FROM sourcing_requests
GROUP BY user_id;

-- Transaction fee summary for Wells treasury
CREATE OR REPLACE VIEW sourcing_fee_summary AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS transactions,
  SUM(deal_value) AS total_deal_value,
  SUM(fee_amount) AS total_fees,
  AVG(fee_percentage) * 100 AS avg_fee_pct,
  COUNT(*) FILTER (WHERE payment_method = 'grain') AS grain_payments,
  SUM(fee_amount) FILTER (WHERE payment_method = 'grain') AS grain_fees
FROM sourcing_transactions
WHERE status IN ('fee_collected', 'completed')
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get buyer's sourcing stats
CREATE OR REPLACE FUNCTION get_buyer_sourcing_stats(p_user_id TEXT)
RETURNS TABLE (
  total_requests BIGINT,
  active_requests BIGINT,
  pending_introductions BIGINT,
  deals_in_progress BIGINT,
  completed_deals BIGINT,
  total_savings DECIMAL,
  total_spend DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT r.id) AS total_requests,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('submitted', 'matching', 'matched', 'in_review', 'quoted')) AS active_requests,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status IN ('pending', 'sent')) AS pending_introductions,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'negotiating') AS deals_in_progress,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') AS completed_deals,
    COALESCE(SUM(
      CASE WHEN t.status = 'completed' AND r.budget_max IS NOT NULL
      THEN r.budget_max - t.deal_value
      ELSE 0 END
    ), 0) AS total_savings,
    COALESCE(SUM(t.deal_value) FILTER (WHERE t.status = 'completed'), 0) AS total_spend
  FROM sourcing_requests r
  LEFT JOIN sourcing_introductions i ON r.id = i.request_id AND i.buyer_id = p_user_id
  LEFT JOIN sourcing_transactions t ON r.id = t.request_id
  WHERE r.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate savings for a transaction (if budget was specified)
CREATE OR REPLACE FUNCTION calculate_sourcing_savings(
  p_deal_value DECIMAL,
  p_budget_max DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF p_budget_max IS NULL OR p_budget_max <= 0 THEN
    RETURN 0;
  END IF;
  RETURN GREATEST(p_budget_max - p_deal_value, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sourcing_requests IS 'Buyer sourcing requests - what they need to purchase';
COMMENT ON TABLE sourcing_matches IS 'AI-matched suppliers for each sourcing request';
COMMENT ON TABLE sourcing_introductions IS 'Introduction requests from buyers to matched suppliers';
COMMENT ON TABLE sourcing_transactions IS 'Completed deals with fee tracking for Wells treasury';

COMMENT ON COLUMN sourcing_requests.specifications IS 'JSONB containing all category-specific specs from intake form';
COMMENT ON COLUMN sourcing_requests.prefer_grain_enabled IS 'If true, GRAIN-enabled suppliers are prioritized in matching';
COMMENT ON COLUMN sourcing_matches.grain_enabled IS 'Whether this supplier accepts GRAIN for instant payment';
COMMENT ON COLUMN sourcing_matches.grain_bonus_applied IS 'Whether +15% GRAIN bonus was applied to match score';
COMMENT ON COLUMN sourcing_transactions.fee_percentage IS 'Wells success fee - default 1% (0.01)';
COMMENT ON COLUMN sourcing_transactions.grain_payment_id IS 'Links to GRAIN payment if paid through Wells payment rails';
