-- ============================================================================
-- AI-TO-AI NEGOTIATION PROTOCOL SCHEMA
-- Wells AI Buyer-to-Seller Autonomous Negotiation System
-- ============================================================================

-- ============================================================================
-- TABLE 1: negotiation_sessions
-- Main session table tracking buyer-seller AI negotiations
-- ============================================================================
CREATE TABLE IF NOT EXISTS negotiation_sessions (
  id TEXT PRIMARY KEY,
  protocol_version TEXT NOT NULL DEFAULT '1.0',

  -- RFQ and Quote references
  rfq_id UUID NOT NULL,
  quote_id TEXT NOT NULL,

  -- Agent identities (JSONB for flexibility)
  buyer_agent JSONB NOT NULL,
  seller_agent JSONB NOT NULL,

  -- Negotiation subject
  subject TEXT NOT NULL,

  -- Session state
  status TEXT NOT NULL DEFAULT 'initializing',
  current_round INTEGER NOT NULL DEFAULT 0,
  max_rounds INTEGER NOT NULL DEFAULT 5,

  -- Terms (JSONB for nested structure)
  initial_terms JSONB NOT NULL,
  current_terms JSONB,
  final_terms JSONB,

  -- Message history (array of protocol messages)
  messages JSONB NOT NULL DEFAULT '[]',

  -- Analytics (JSONB for flexibility)
  analytics JSONB NOT NULL DEFAULT '{"roundsUsed": 0, "escalationCount": 0, "agreementReached": false}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_session_status CHECK (status IN (
    'initializing', 'active', 'awaiting_human', 'agreed',
    'rejected', 'stalemate', 'expired', 'cancelled'
  ))
);

-- Indexes for session queries
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_rfq ON negotiation_sessions(rfq_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_status ON negotiation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_buyer ON negotiation_sessions((buyer_agent->>'organizationId'));
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_seller ON negotiation_sessions((seller_agent->>'organizationId'));
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_active ON negotiation_sessions(status, last_activity_at)
  WHERE status IN ('active', 'awaiting_human');
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_expires ON negotiation_sessions(expires_at)
  WHERE status IN ('active', 'awaiting_human');

-- ============================================================================
-- TABLE 2: negotiation_messages
-- Audit trail of all protocol messages exchanged
-- ============================================================================
CREATE TABLE IF NOT EXISTS negotiation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,

  -- Message metadata
  round INTEGER NOT NULL,
  sender_type TEXT NOT NULL, -- 'buyer' or 'seller'
  sender_org_id TEXT NOT NULL,
  sender_org_name TEXT NOT NULL,

  -- Message content
  message_type TEXT NOT NULL,
  terms JSONB,
  constraints JSONB NOT NULL,
  message_text TEXT NOT NULL,
  internal_reasoning TEXT,

  -- Escalation info
  requires_escalation BOOLEAN NOT NULL DEFAULT false,
  escalation_reason TEXT,

  -- AI metrics
  confidence INTEGER,

  -- References
  in_response_to TEXT,
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL,

  -- Constraints
  CONSTRAINT valid_message_type CHECK (message_type IN (
    'proposal', 'counter', 'accept', 'reject',
    'info_request', 'info_response', 'escalate', 'hold', 'resume'
  )),
  CONSTRAINT valid_sender_type CHECK (sender_type IN ('buyer', 'seller'))
);

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_negotiation_messages_session ON negotiation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_messages_round ON negotiation_messages(session_id, round);
CREATE INDEX IF NOT EXISTS idx_negotiation_messages_created ON negotiation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_negotiation_messages_type ON negotiation_messages(message_type);

-- ============================================================================
-- TABLE 3: negotiation_escalations
-- Human review requests and decisions
-- ============================================================================
CREATE TABLE IF NOT EXISTS negotiation_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
  rfq_id UUID NOT NULL,
  organization_id TEXT NOT NULL,

  -- Escalation reason
  reason TEXT NOT NULL,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',

  -- Details for reviewer
  details TEXT NOT NULL,
  suggested_action TEXT,
  review_data JSONB NOT NULL DEFAULT '{}',
  terms_under_review JSONB,

  -- Assignment
  assigned_to TEXT,

  -- Decision
  decision TEXT,
  modified_terms JSONB,
  decision_reason TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Constraints
  CONSTRAINT valid_escalation_reason CHECK (reason IN (
    'budget_exceeded', 'high_value_deal', 'new_counterparty',
    'low_confidence', 'stalemate', 'manual_request',
    'terms_outside_policy', 'unusual_terms', 'compliance_flag', 'system_error'
  )),
  CONSTRAINT valid_escalation_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_escalation_status CHECK (status IN (
    'pending', 'reviewing', 'approved', 'rejected', 'modified', 'expired'
  )),
  CONSTRAINT valid_escalation_decision CHECK (decision IS NULL OR decision IN ('approve', 'reject', 'modify'))
);

-- Indexes for escalation queries
CREATE INDEX IF NOT EXISTS idx_escalations_session ON negotiation_escalations(session_id);
CREATE INDEX IF NOT EXISTS idx_escalations_org ON negotiation_escalations(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalations_pending ON negotiation_escalations(organization_id, status, priority)
  WHERE status IN ('pending', 'reviewing');
CREATE INDEX IF NOT EXISTS idx_escalations_expires ON negotiation_escalations(expires_at)
  WHERE status IN ('pending', 'reviewing');

-- ============================================================================
-- TABLE 4: seller_agent_registry
-- Registry of seller agents available for negotiation
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_agent_registry (
  agent_id TEXT PRIMARY KEY,
  supplier_id UUID NOT NULL,
  organization_name TEXT NOT NULL,

  -- Capabilities
  categories TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,

  -- Pricing rules (JSONB for flexibility)
  pricing_rules JSONB NOT NULL DEFAULT '{
    "baseMargin": 25,
    "minMargin": 10,
    "volumeDiscounts": [],
    "rushFeePercentage": 15
  }',

  -- Capacity constraints
  capacity_constraints JSONB NOT NULL DEFAULT '{
    "maxMonthlyVolume": 10000,
    "currentUtilization": 0.6,
    "leadTimeDays": 14,
    "rushLeadTimeDays": 7
  }',

  -- Timestamps
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for agent registry
CREATE INDEX IF NOT EXISTS idx_seller_agents_supplier ON seller_agent_registry(supplier_id);
CREATE INDEX IF NOT EXISTS idx_seller_agents_active ON seller_agent_registry(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_seller_agents_categories ON seller_agent_registry USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_seller_agents_certs ON seller_agent_registry USING GIN(certifications);

-- ============================================================================
-- TABLE 5: negotiation_analytics
-- Aggregated analytics for negotiation performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS negotiation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Session counts
  total_sessions INTEGER NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  successful_sessions INTEGER NOT NULL DEFAULT 0,
  escalated_sessions INTEGER NOT NULL DEFAULT 0,

  -- Performance metrics
  avg_rounds_to_agreement DECIMAL(5,2),
  avg_price_reduction_percent DECIMAL(5,2),
  avg_time_to_agreement_ms BIGINT,
  total_savings DECIMAL(20,2),

  -- By status breakdown
  status_breakdown JSONB NOT NULL DEFAULT '{}',

  -- By supplier breakdown
  supplier_breakdown JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint for period
  UNIQUE(organization_id, period_start, period_end)
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_org ON negotiation_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON negotiation_analytics(period_start, period_end);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active negotiations summary view
CREATE OR REPLACE VIEW active_negotiations_summary AS
SELECT
  s.id AS session_id,
  s.rfq_id,
  s.status,
  s.current_round,
  s.max_rounds,
  s.buyer_agent->>'organizationName' AS buyer_name,
  s.seller_agent->>'organizationName' AS seller_name,
  s.subject,
  (s.initial_terms->>'totalPrice')::DECIMAL AS initial_price,
  (s.current_terms->>'totalPrice')::DECIMAL AS current_price,
  s.created_at,
  s.last_activity_at,
  s.expires_at,
  (
    SELECT COUNT(*)
    FROM negotiation_escalations e
    WHERE e.session_id = s.id AND e.status IN ('pending', 'reviewing')
  ) AS pending_escalations
FROM negotiation_sessions s
WHERE s.status IN ('active', 'awaiting_human')
ORDER BY s.last_activity_at DESC;

-- Escalations dashboard view
CREATE OR REPLACE VIEW escalations_dashboard AS
SELECT
  e.id AS escalation_id,
  e.session_id,
  s.subject,
  e.reason,
  e.priority,
  e.status,
  e.details,
  e.suggested_action,
  s.buyer_agent->>'organizationName' AS buyer_name,
  s.seller_agent->>'organizationName' AS seller_name,
  (e.terms_under_review->>'totalPrice')::DECIMAL AS amount_under_review,
  e.assigned_to,
  e.created_at,
  e.expires_at,
  EXTRACT(EPOCH FROM (e.expires_at - NOW())) / 60 AS minutes_until_expiry
FROM negotiation_escalations e
JOIN negotiation_sessions s ON e.session_id = s.id
WHERE e.status IN ('pending', 'reviewing')
ORDER BY
  CASE e.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  e.created_at ASC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to expire old escalations
CREATE OR REPLACE FUNCTION expire_old_escalations()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE negotiation_escalations
  SET
    status = 'expired',
    updated_at = NOW()
  WHERE status IN ('pending', 'reviewing')
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old sessions
CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE negotiation_sessions
  SET
    status = 'expired',
    completed_at = NOW()
  WHERE status IN ('active', 'awaiting_human')
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate organization analytics
CREATE OR REPLACE FUNCTION update_org_analytics(
  p_org_id TEXT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO negotiation_analytics (
    organization_id,
    period_start,
    period_end,
    total_sessions,
    completed_sessions,
    successful_sessions,
    escalated_sessions,
    avg_rounds_to_agreement,
    avg_price_reduction_percent,
    avg_time_to_agreement_ms,
    total_savings
  )
  SELECT
    p_org_id,
    p_period_start,
    p_period_end,
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('agreed', 'rejected', 'stalemate', 'expired')),
    COUNT(*) FILTER (WHERE status = 'agreed'),
    COUNT(*) FILTER (WHERE (analytics->>'escalationCount')::INTEGER > 0),
    AVG((analytics->>'roundsUsed')::INTEGER) FILTER (WHERE status = 'agreed'),
    AVG((analytics->>'reductionPercentage')::DECIMAL) FILTER (WHERE status = 'agreed'),
    AVG((analytics->>'timeToAgreementMs')::BIGINT) FILTER (WHERE status = 'agreed'),
    SUM((analytics->>'priceReduction')::DECIMAL) FILTER (WHERE status = 'agreed')
  FROM negotiation_sessions
  WHERE buyer_agent->>'organizationId' = p_org_id
    AND created_at >= p_period_start
    AND created_at < p_period_end
  ON CONFLICT (organization_id, period_start, period_end)
  DO UPDATE SET
    total_sessions = EXCLUDED.total_sessions,
    completed_sessions = EXCLUDED.completed_sessions,
    successful_sessions = EXCLUDED.successful_sessions,
    escalated_sessions = EXCLUDED.escalated_sessions,
    avg_rounds_to_agreement = EXCLUDED.avg_rounds_to_agreement,
    avg_price_reduction_percent = EXCLUDED.avg_price_reduction_percent,
    avg_time_to_agreement_ms = EXCLUDED.avg_time_to_agreement_ms,
    total_savings = EXCLUDED.total_savings,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update last_activity_at on message insert
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE negotiation_sessions
  SET last_activity_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_activity ON negotiation_messages;
CREATE TRIGGER trigger_update_session_activity
  AFTER INSERT ON negotiation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- ============================================================================
-- DONE
-- ============================================================================

COMMENT ON TABLE negotiation_sessions IS 'AI-to-AI negotiation sessions between buyer and seller Wells agents';
COMMENT ON TABLE negotiation_messages IS 'Audit trail of all protocol messages exchanged during negotiations';
COMMENT ON TABLE negotiation_escalations IS 'Human review requests and decisions for negotiations';
COMMENT ON TABLE seller_agent_registry IS 'Registry of seller agents available for autonomous negotiation';
COMMENT ON TABLE negotiation_analytics IS 'Aggregated performance analytics for negotiation system';
