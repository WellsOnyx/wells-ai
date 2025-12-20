-- ============================================================================
-- AML SCREENING AND OFAC SANCTIONS SCHEMA
-- For Grain & Vault compliance
-- Run: psql $POSTGRES_URL < scripts/schema-aml-screening.sql
-- ============================================================================

-- ============================================================================
-- AML SCREENING RESULTS
-- Stores all screening outcomes for users and transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS aml_screening_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiers
  screening_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  transaction_id TEXT,

  -- Screening Type
  screening_type TEXT NOT NULL CHECK (screening_type IN ('user', 'transaction', 'periodic', 'manual')),

  -- Results
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'blocked')),
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  action TEXT NOT NULL CHECK (action IN ('approve', 'review', 'block', 'report')),

  -- OFAC/Sanctions
  ofac_match BOOLEAN DEFAULT FALSE,
  ofac_match_details JSONB DEFAULT '[]',

  -- Flags
  flags JSONB DEFAULT '[]',

  -- Compliance Requirements
  requires_manual_review BOOLEAN DEFAULT FALSE,
  requires_ctr BOOLEAN DEFAULT FALSE, -- Currency Transaction Report
  requires_sar BOOLEAN DEFAULT FALSE, -- Suspicious Activity Report

  -- Review Status
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'in_review', 'approved', 'rejected', 'escalated')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aml_screening_user ON aml_screening_results(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_screening_transaction ON aml_screening_results(transaction_id);
CREATE INDEX IF NOT EXISTS idx_aml_screening_type ON aml_screening_results(screening_type);
CREATE INDEX IF NOT EXISTS idx_aml_screening_risk ON aml_screening_results(risk_level);
CREATE INDEX IF NOT EXISTS idx_aml_screening_action ON aml_screening_results(action);
CREATE INDEX IF NOT EXISTS idx_aml_screening_ofac ON aml_screening_results(ofac_match) WHERE ofac_match = TRUE;
CREATE INDEX IF NOT EXISTS idx_aml_screening_review ON aml_screening_results(review_status) WHERE review_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_aml_screening_created ON aml_screening_results(created_at DESC);

-- ============================================================================
-- AML ALERTS
-- Compliance team alerts for review
-- ============================================================================
CREATE TABLE IF NOT EXISTS aml_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  user_id TEXT NOT NULL,
  screening_id TEXT REFERENCES aml_screening_results(screening_id),
  transaction_id TEXT,

  -- Alert Details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'sanctions_match',
    'high_risk',
    'structuring',
    'sar_required',
    'ctr_required',
    'manual_review',
    'velocity_breach',
    'pep_activity',
    'unusual_pattern'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'escalated', 'dismissed')),
  resolution TEXT CHECK (resolution IN ('approved', 'rejected', 'escalated', 'false_positive')),
  resolution_notes TEXT,

  -- Details
  details JSONB DEFAULT '{}',

  -- Audit
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  escalated_to TEXT,
  escalated_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aml_alerts_user ON aml_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_screening ON aml_alerts(screening_id);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_type ON aml_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_severity ON aml_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_status ON aml_alerts(status);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_pending ON aml_alerts(status, severity) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_aml_alerts_created ON aml_alerts(created_at DESC);

-- ============================================================================
-- CURRENCY TRANSACTION REPORTS (CTR)
-- For transactions over $10,000
-- ============================================================================
CREATE TABLE IF NOT EXISTS aml_ctr_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  transaction_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  screening_id TEXT,

  -- Transaction Details
  transaction_amount DECIMAL(20, 2),
  transaction_type TEXT,
  transaction_date TIMESTAMP,

  -- Filing Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'filed', 'accepted', 'rejected')),
  filing_date TIMESTAMP,
  fincen_confirmation TEXT,

  -- Report Details
  report_data JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  filed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aml_ctr_user ON aml_ctr_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_ctr_transaction ON aml_ctr_reports(transaction_id);
CREATE INDEX IF NOT EXISTS idx_aml_ctr_status ON aml_ctr_reports(status);
CREATE INDEX IF NOT EXISTS idx_aml_ctr_pending ON aml_ctr_reports(status) WHERE status = 'pending';

-- ============================================================================
-- SUSPICIOUS ACTIVITY REPORTS (SAR)
-- For suspicious patterns and activities
-- ============================================================================
CREATE TABLE IF NOT EXISTS aml_sar_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  user_id TEXT NOT NULL,
  screening_id TEXT,
  alert_ids TEXT[], -- Multiple alerts can trigger one SAR

  -- Report Details
  suspicious_activity TEXT NOT NULL,
  activity_description TEXT,
  details JSONB DEFAULT '{}',

  -- Involved Amounts
  total_amount DECIMAL(20, 2),
  date_range_start DATE,
  date_range_end DATE,

  -- Filing Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'filed', 'accepted', 'rejected')),
  filing_date TIMESTAMP,
  fincen_confirmation TEXT,

  -- Internal Review
  prepared_by TEXT,
  reviewed_by TEXT,
  approved_by TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  filed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aml_sar_user ON aml_sar_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_sar_screening ON aml_sar_reports(screening_id);
CREATE INDEX IF NOT EXISTS idx_aml_sar_status ON aml_sar_reports(status);
CREATE INDEX IF NOT EXISTS idx_aml_sar_pending ON aml_sar_reports(status) WHERE status IN ('draft', 'pending');

-- ============================================================================
-- WATCHLIST ENTRIES
-- Custom watchlist for internal monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS aml_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entry Details
  entry_type TEXT NOT NULL CHECK (entry_type IN ('name', 'email', 'phone', 'address', 'ip_address', 'wallet_address')),
  entry_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,

  -- Reason
  reason TEXT NOT NULL,
  source TEXT, -- 'internal', 'external', 'law_enforcement'

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'removed')),
  expires_at TIMESTAMP,

  -- Audit
  added_by TEXT NOT NULL,
  removed_by TEXT,
  removed_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aml_watchlist_type ON aml_watchlist(entry_type);
CREATE INDEX IF NOT EXISTS idx_aml_watchlist_value ON aml_watchlist(normalized_value);
CREATE INDEX IF NOT EXISTS idx_aml_watchlist_status ON aml_watchlist(status);
CREATE INDEX IF NOT EXISTS idx_aml_watchlist_active ON aml_watchlist(entry_type, normalized_value) WHERE status = 'active';

-- ============================================================================
-- OFAC SCREENING CACHE
-- Cache external OFAC checks to reduce API calls
-- ============================================================================
CREATE TABLE IF NOT EXISTS aml_ofac_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Search Parameters
  search_name TEXT NOT NULL,
  search_country TEXT,
  search_hash TEXT UNIQUE NOT NULL, -- Hash of normalized search params

  -- Results
  match_found BOOLEAN DEFAULT FALSE,
  match_details JSONB DEFAULT '[]',
  match_score INTEGER,

  -- Cache Control
  expires_at TIMESTAMP NOT NULL,
  provider TEXT DEFAULT 'internal', -- 'internal', 'complyadvantage', 'dowjones'

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aml_ofac_cache_hash ON aml_ofac_cache(search_hash);
CREATE INDEX IF NOT EXISTS idx_aml_ofac_cache_expires ON aml_ofac_cache(expires_at);

-- ============================================================================
-- TRANSACTION VELOCITY TRACKING
-- Track transaction patterns for anomaly detection
-- ============================================================================
CREATE TABLE IF NOT EXISTS aml_transaction_velocity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User
  user_id TEXT NOT NULL,

  -- Time Window
  window_type TEXT NOT NULL CHECK (window_type IN ('hourly', 'daily', 'weekly', 'monthly')),
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,

  -- Metrics
  transaction_count INTEGER DEFAULT 0,
  total_amount DECIMAL(20, 2) DEFAULT 0,
  deposit_count INTEGER DEFAULT 0,
  deposit_amount DECIMAL(20, 2) DEFAULT 0,
  withdrawal_count INTEGER DEFAULT 0,
  withdrawal_amount DECIMAL(20, 2) DEFAULT 0,

  -- Averages (for comparison)
  avg_transaction_amount DECIMAL(20, 2) DEFAULT 0,
  max_transaction_amount DECIMAL(20, 2) DEFAULT 0,

  -- Flags
  velocity_breach BOOLEAN DEFAULT FALSE,
  structuring_detected BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint for time windows
  UNIQUE(user_id, window_type, window_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aml_velocity_user ON aml_transaction_velocity(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_velocity_window ON aml_transaction_velocity(window_type, window_start);
CREATE INDEX IF NOT EXISTS idx_aml_velocity_breach ON aml_transaction_velocity(velocity_breach) WHERE velocity_breach = TRUE;

-- ============================================================================
-- COMPLIANCE AUDIT LOG
-- Immutable log of all compliance-related actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS aml_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Action Details
  action_type TEXT NOT NULL CHECK (action_type IN (
    'screening_performed',
    'alert_created',
    'alert_resolved',
    'alert_escalated',
    'ctr_filed',
    'sar_filed',
    'user_blocked',
    'user_unblocked',
    'watchlist_add',
    'watchlist_remove',
    'manual_review',
    'limit_override',
    'config_change'
  )),

  -- References
  user_id TEXT,
  screening_id TEXT,
  alert_id TEXT,
  report_id TEXT,

  -- Actor
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMP DEFAULT NOW(),

  -- Details
  action_details JSONB DEFAULT '{}',
  reason TEXT,

  -- IP/Session Tracking
  ip_address TEXT,
  user_agent TEXT,

  -- Immutable - no updated_at
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aml_audit_action ON aml_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_aml_audit_user ON aml_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_audit_performer ON aml_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_aml_audit_created ON aml_audit_log(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_aml_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_aml_screening_results_updated_at
  BEFORE UPDATE ON aml_screening_results
  FOR EACH ROW EXECUTE FUNCTION update_aml_updated_at();

CREATE TRIGGER update_aml_alerts_updated_at
  BEFORE UPDATE ON aml_alerts
  FOR EACH ROW EXECUTE FUNCTION update_aml_updated_at();

CREATE TRIGGER update_aml_ctr_reports_updated_at
  BEFORE UPDATE ON aml_ctr_reports
  FOR EACH ROW EXECUTE FUNCTION update_aml_updated_at();

CREATE TRIGGER update_aml_sar_reports_updated_at
  BEFORE UPDATE ON aml_sar_reports
  FOR EACH ROW EXECUTE FUNCTION update_aml_updated_at();

CREATE TRIGGER update_aml_watchlist_updated_at
  BEFORE UPDATE ON aml_watchlist
  FOR EACH ROW EXECUTE FUNCTION update_aml_updated_at();

CREATE TRIGGER update_aml_velocity_updated_at
  BEFORE UPDATE ON aml_transaction_velocity
  FOR EACH ROW EXECUTE FUNCTION update_aml_updated_at();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get pending alerts count by severity
CREATE OR REPLACE FUNCTION get_aml_alert_summary()
RETURNS TABLE(
  severity TEXT,
  pending_count BIGINT,
  oldest_pending TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.severity,
    COUNT(*) as pending_count,
    MIN(a.created_at) as oldest_pending
  FROM aml_alerts a
  WHERE a.status = 'pending'
  GROUP BY a.severity
  ORDER BY
    CASE a.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

-- Get user risk profile
CREATE OR REPLACE FUNCTION get_user_risk_profile(p_user_id TEXT)
RETURNS TABLE(
  latest_risk_score INTEGER,
  screening_count BIGINT,
  alert_count BIGINT,
  pending_alerts BIGINT,
  has_sanctions_match BOOLEAN,
  last_screening_date TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT risk_score FROM aml_screening_results
      WHERE user_id = p_user_id
      ORDER BY created_at DESC LIMIT 1
    ), 0) as latest_risk_score,
    (SELECT COUNT(*) FROM aml_screening_results WHERE user_id = p_user_id) as screening_count,
    (SELECT COUNT(*) FROM aml_alerts WHERE user_id = p_user_id) as alert_count,
    (SELECT COUNT(*) FROM aml_alerts WHERE user_id = p_user_id AND status = 'pending') as pending_alerts,
    (SELECT EXISTS(SELECT 1 FROM aml_screening_results WHERE user_id = p_user_id AND ofac_match = TRUE)) as has_sanctions_match,
    (SELECT MAX(created_at) FROM aml_screening_results WHERE user_id = p_user_id) as last_screening_date;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired OFAC cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_ofac_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM aml_ofac_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Dashboard view for compliance team
CREATE OR REPLACE VIEW aml_compliance_dashboard AS
SELECT
  (SELECT COUNT(*) FROM aml_alerts WHERE status = 'pending') as pending_alerts,
  (SELECT COUNT(*) FROM aml_alerts WHERE status = 'pending' AND severity = 'critical') as critical_alerts,
  (SELECT COUNT(*) FROM aml_sar_reports WHERE status = 'pending') as pending_sars,
  (SELECT COUNT(*) FROM aml_ctr_reports WHERE status = 'pending') as pending_ctrs,
  (SELECT COUNT(*) FROM aml_screening_results WHERE created_at > NOW() - INTERVAL '24 hours') as screenings_24h,
  (SELECT COUNT(*) FROM aml_screening_results WHERE created_at > NOW() - INTERVAL '24 hours' AND ofac_match = TRUE) as sanctions_matches_24h,
  (SELECT COUNT(*) FROM aml_screening_results WHERE created_at > NOW() - INTERVAL '24 hours' AND risk_level = 'high') as high_risk_24h,
  (SELECT COUNT(*) FROM aml_screening_results WHERE created_at > NOW() - INTERVAL '7 days') as screenings_7d;

-- High risk users view
CREATE OR REPLACE VIEW aml_high_risk_users AS
SELECT DISTINCT
  s.user_id,
  MAX(s.risk_score) as max_risk_score,
  COUNT(*) as screening_count,
  BOOL_OR(s.ofac_match) as has_sanctions_match,
  MAX(s.created_at) as last_screening,
  (SELECT COUNT(*) FROM aml_alerts a WHERE a.user_id = s.user_id AND a.status = 'pending') as pending_alerts
FROM aml_screening_results s
WHERE s.risk_level IN ('high', 'blocked')
  OR s.ofac_match = TRUE
GROUP BY s.user_id
ORDER BY max_risk_score DESC, last_screening DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE aml_screening_results IS 'Stores all AML/OFAC screening outcomes for audit trail';
COMMENT ON TABLE aml_alerts IS 'Compliance team alerts requiring review or action';
COMMENT ON TABLE aml_ctr_reports IS 'Currency Transaction Reports for transactions over $10,000';
COMMENT ON TABLE aml_sar_reports IS 'Suspicious Activity Reports for FinCEN filing';
COMMENT ON TABLE aml_watchlist IS 'Internal watchlist for enhanced monitoring';
COMMENT ON TABLE aml_ofac_cache IS 'Cache for external OFAC API responses';
COMMENT ON TABLE aml_transaction_velocity IS 'Transaction velocity tracking for anomaly detection';
COMMENT ON TABLE aml_audit_log IS 'Immutable audit log of all compliance actions';

COMMENT ON COLUMN aml_screening_results.requires_ctr IS 'Transaction exceeds $10,000 CTR threshold';
COMMENT ON COLUMN aml_screening_results.requires_sar IS 'Suspicious activity detected, SAR may be required';
COMMENT ON COLUMN aml_alerts.severity IS 'critical: immediate action, high: same day, medium: within 48h, low: routine';
