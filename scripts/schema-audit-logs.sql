-- ============================================================================
-- GRAIN & VAULT AUDIT LOGGING SCHEMA
-- Comprehensive, immutable audit logging for regulatory compliance
--
-- Compliance with:
-- - SOC 2 Type II
-- - PCI DSS
-- - Bank Secrecy Act (BSA)
-- - FINRA
-- - GDPR Article 30
--
-- Retention: 7 years per financial regulations
--
-- Run: psql $POSTGRES_URL < scripts/schema-audit-logs.sql
-- ============================================================================

-- ============================================================================
-- MAIN AUDIT LOG TABLE
-- Append-only: NO UPDATES OR DELETES ALLOWED
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_audit_logs (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sequence number for ordering within same timestamp
  sequence_number BIGSERIAL,

  -- Event classification
  event_type TEXT NOT NULL,

  -- Actor (who performed the action)
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'system', 'api')),

  -- Target (who was affected, if different from actor)
  target_user_id TEXT,

  -- Request context
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,

  -- Event details (JSONB for flexibility)
  details JSONB NOT NULL DEFAULT '{}',

  -- Outcome
  result TEXT NOT NULL CHECK (result IN ('success', 'failure', 'partial', 'blocked')),

  -- Risk assessment
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Timestamps
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  -- Immutability verification
  hash TEXT NOT NULL, -- SHA-256 hash of entry contents
  previous_hash TEXT, -- Previous entry's hash for chain verification

  -- Partition key for time-based partitioning
  log_date DATE GENERATED ALWAYS AS (DATE(timestamp)) STORED
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON grain_audit_logs(actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON grain_audit_logs(target_user_id, timestamp DESC) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON grain_audit_logs(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON grain_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk ON grain_audit_logs(risk_level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result ON grain_audit_logs(result, timestamp DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_events ON grain_audit_logs(actor_id, event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_security ON grain_audit_logs(event_type, risk_level, timestamp DESC)
  WHERE event_type LIKE 'security.%' OR event_type LIKE 'auth.%';

-- JSONB indexes for details searching
CREATE INDEX IF NOT EXISTS idx_audit_logs_details_gin ON grain_audit_logs USING GIN (details);
CREATE INDEX IF NOT EXISTS idx_audit_logs_transaction_id ON grain_audit_logs((details->>'transactionId'))
  WHERE details->>'transactionId' IS NOT NULL;

-- Session tracking
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON grain_audit_logs(session_id, timestamp DESC)
  WHERE session_id IS NOT NULL;

-- Request tracing
CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON grain_audit_logs(request_id)
  WHERE request_id IS NOT NULL;

-- Date-based for retention queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON grain_audit_logs(log_date, timestamp DESC);

-- ============================================================================
-- ARCHIVE TABLE
-- For logs older than 1 year (still within 7-year retention)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_audit_logs_archive (
  -- All columns from main table
  id UUID PRIMARY KEY,
  sequence_number BIGINT,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  target_user_id TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,
  details JSONB NOT NULL,
  result TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB,
  hash TEXT NOT NULL,
  previous_hash TEXT,

  -- Archive metadata
  archive_id UUID NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Partition by year for efficient querying
  archive_year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM timestamp)) STORED
);

CREATE INDEX IF NOT EXISTS idx_audit_archive_timestamp ON grain_audit_logs_archive(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_archive_actor ON grain_audit_logs_archive(actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_archive_archive ON grain_audit_logs_archive(archive_id);
CREATE INDEX IF NOT EXISTS idx_audit_archive_year ON grain_audit_logs_archive(archive_year);

-- ============================================================================
-- SECURITY ALERTS TABLE
-- Detected suspicious patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pattern information
  pattern_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  occurrences INTEGER NOT NULL,
  time_window TEXT NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),

  -- Alert details
  details JSONB DEFAULT '{}',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'acknowledged', 'investigating', 'resolved', 'false_positive', 'escalated'
  )),

  -- Resolution
  resolved_by TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON grain_security_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_pattern ON grain_security_alerts(pattern_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON grain_security_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_risk ON grain_security_alerts(risk_score DESC, created_at DESC);

-- ============================================================================
-- ALERT CONFIGURATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pattern configuration
  pattern_type TEXT NOT NULL UNIQUE,
  threshold INTEGER NOT NULL,
  time_window_minutes INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Notification channels
  notify_email BOOLEAN DEFAULT TRUE,
  notify_sms BOOLEAN DEFAULT FALSE,
  notify_slack BOOLEAN DEFAULT TRUE,
  notify_webhook BOOLEAN DEFAULT FALSE,
  webhook_url TEXT,

  -- Status
  enabled BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- DATA ACCESS LOG TABLE
-- Track who viewed what PII (GDPR compliance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Accessor
  accessor_id TEXT NOT NULL,
  accessor_type TEXT NOT NULL CHECK (accessor_type IN ('user', 'admin', 'system', 'api')),

  -- Data accessed
  data_subject_id TEXT NOT NULL, -- The user whose data was accessed
  data_type TEXT NOT NULL, -- e.g., 'pii', 'financial', 'kyc', 'transactions'
  data_fields TEXT[], -- Specific fields accessed

  -- Access context
  access_reason TEXT,
  access_method TEXT NOT NULL CHECK (access_method IN ('view', 'export', 'query', 'api')),
  record_count INTEGER DEFAULT 1,

  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,

  -- Timestamps
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_access_accessor ON grain_data_access_logs(accessor_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_access_subject ON grain_data_access_logs(data_subject_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_access_type ON grain_data_access_logs(data_type, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_access_date ON grain_data_access_logs(accessed_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Prevent updates on audit log table (immutability enforcement)
CREATE OR REPLACE FUNCTION prevent_audit_log_updates()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. Updates are not allowed.';
END;
$$ LANGUAGE plpgsql;

-- Prevent deletes on audit log table (immutability enforcement)
CREATE OR REPLACE FUNCTION prevent_audit_log_deletes()
RETURNS TRIGGER AS $$
DECLARE
  retention_cutoff TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Allow deletes only for logs older than 7 years
  retention_cutoff := NOW() - INTERVAL '7 years';

  IF OLD.timestamp > retention_cutoff THEN
    RAISE EXCEPTION 'Audit logs within 7-year retention period cannot be deleted. Log timestamp: %, Cutoff: %',
      OLD.timestamp, retention_cutoff;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_grain_audit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Prevent updates to audit logs
DROP TRIGGER IF EXISTS prevent_audit_updates ON grain_audit_logs;
CREATE TRIGGER prevent_audit_updates
  BEFORE UPDATE ON grain_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_updates();

-- Prevent unauthorized deletes
DROP TRIGGER IF EXISTS prevent_audit_deletes ON grain_audit_logs;
CREATE TRIGGER prevent_audit_deletes
  BEFORE DELETE ON grain_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_deletes();

-- Update timestamps on security alerts
DROP TRIGGER IF EXISTS update_security_alerts_timestamp ON grain_security_alerts;
CREATE TRIGGER update_security_alerts_timestamp
  BEFORE UPDATE ON grain_security_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_grain_audit_updated_at();

-- Update timestamps on alert configurations
DROP TRIGGER IF EXISTS update_alert_config_timestamp ON grain_alert_configurations;
CREATE TRIGGER update_alert_config_timestamp
  BEFORE UPDATE ON grain_alert_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_grain_audit_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- High-risk activity summary
CREATE OR REPLACE VIEW grain_high_risk_activity AS
SELECT
  DATE(timestamp) as log_date,
  event_type,
  risk_level,
  COUNT(*) as event_count,
  COUNT(DISTINCT actor_id) as unique_actors,
  array_agg(DISTINCT actor_id) as actors
FROM grain_audit_logs
WHERE risk_level IN ('high', 'critical')
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp), event_type, risk_level
ORDER BY log_date DESC, event_count DESC;

-- User activity summary
CREATE OR REPLACE VIEW grain_user_activity_summary AS
SELECT
  actor_id,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE result = 'failure') as failed_events,
  COUNT(*) FILTER (WHERE risk_level IN ('high', 'critical')) as high_risk_events,
  MIN(timestamp) as first_activity,
  MAX(timestamp) as last_activity,
  COUNT(DISTINCT DATE(timestamp)) as active_days
FROM grain_audit_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY actor_id
ORDER BY high_risk_events DESC, failed_events DESC;

-- Security alerts dashboard
CREATE OR REPLACE VIEW grain_security_alerts_dashboard AS
SELECT
  status,
  pattern_type,
  COUNT(*) as alert_count,
  AVG(risk_score)::INTEGER as avg_risk_score,
  MAX(created_at) as latest_alert
FROM grain_security_alerts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status, pattern_type
ORDER BY status, alert_count DESC;

-- ============================================================================
-- SEED DATA: Default alert configurations
-- ============================================================================
INSERT INTO grain_alert_configurations (
  pattern_type, threshold, time_window_minutes, risk_level,
  notify_email, notify_sms, notify_slack, enabled
) VALUES
  ('failed_logins', 5, 15, 'high', TRUE, FALSE, TRUE, TRUE),
  ('large_withdrawal', 1, 1440, 'high', TRUE, TRUE, TRUE, TRUE),
  ('rapid_transactions', 10, 60, 'medium', FALSE, FALSE, TRUE, TRUE),
  ('pii_bulk_access', 100, 60, 'critical', TRUE, TRUE, TRUE, TRUE),
  ('unusual_hours_activity', 5, 60, 'medium', TRUE, FALSE, FALSE, TRUE),
  ('new_device_high_value', 1, 1440, 'high', TRUE, TRUE, FALSE, TRUE)
ON CONFLICT (pattern_type) DO UPDATE SET
  threshold = EXCLUDED.threshold,
  time_window_minutes = EXCLUDED.time_window_minutes,
  risk_level = EXCLUDED.risk_level,
  updated_at = NOW();

-- ============================================================================
-- POLICIES (Row Level Security - for future multi-tenant support)
-- ============================================================================

-- Note: Enable RLS when multi-tenant support is needed
-- ALTER TABLE grain_audit_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY audit_logs_read_policy ON grain_audit_logs
--   FOR SELECT USING (
--     current_setting('app.current_user_role', true) = 'admin'
--     OR actor_id = current_setting('app.current_user_id', true)
--     OR target_user_id = current_setting('app.current_user_id', true)
--   );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE grain_audit_logs IS 'Immutable audit log for all security and compliance events. Retention: 7 years.';
COMMENT ON TABLE grain_audit_logs_archive IS 'Archive table for audit logs older than 1 year (still within retention period).';
COMMENT ON TABLE grain_security_alerts IS 'Security alerts triggered by suspicious pattern detection.';
COMMENT ON TABLE grain_alert_configurations IS 'Configuration for security alert thresholds and notifications.';
COMMENT ON TABLE grain_data_access_logs IS 'GDPR-compliant log of all PII data access.';

COMMENT ON COLUMN grain_audit_logs.hash IS 'SHA-256 hash of entry contents for immutability verification.';
COMMENT ON COLUMN grain_audit_logs.previous_hash IS 'Hash of previous entry for blockchain-style chain verification.';
COMMENT ON COLUMN grain_audit_logs.sequence_number IS 'Auto-incrementing sequence for ordering entries with same timestamp.';

-- ============================================================================
-- MAINTENANCE PROCEDURES
-- ============================================================================

-- Procedure to verify audit log integrity
CREATE OR REPLACE PROCEDURE verify_audit_log_integrity(
  OUT total_checked INTEGER,
  OUT invalid_count INTEGER,
  OUT is_valid BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  prev_hash TEXT := NULL;
  current_row RECORD;
  invalid_entries INTEGER := 0;
  total_entries INTEGER := 0;
BEGIN
  FOR current_row IN
    SELECT id, hash, previous_hash
    FROM grain_audit_logs
    ORDER BY created_at ASC, sequence_number ASC
  LOOP
    total_entries := total_entries + 1;

    -- Check chain continuity
    IF prev_hash IS NOT NULL AND current_row.previous_hash != prev_hash THEN
      invalid_entries := invalid_entries + 1;
      RAISE NOTICE 'Chain break at entry %: expected previous_hash %, got %',
        current_row.id, prev_hash, current_row.previous_hash;
    END IF;

    prev_hash := current_row.hash;
  END LOOP;

  total_checked := total_entries;
  invalid_count := invalid_entries;
  is_valid := (invalid_entries = 0);
END;
$$;

-- Procedure to get audit statistics
CREATE OR REPLACE FUNCTION get_audit_stats()
RETURNS TABLE(
  total_logs BIGINT,
  logs_today BIGINT,
  logs_this_week BIGINT,
  logs_this_month BIGINT,
  high_risk_count BIGINT,
  failed_auth_count BIGINT,
  oldest_log TIMESTAMP WITH TIME ZONE,
  newest_log TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_logs,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 day')::BIGINT as logs_today,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days')::BIGINT as logs_this_week,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days')::BIGINT as logs_this_month,
    COUNT(*) FILTER (WHERE risk_level IN ('high', 'critical'))::BIGINT as high_risk_count,
    COUNT(*) FILTER (WHERE event_type = 'auth.login.failed')::BIGINT as failed_auth_count,
    MIN(timestamp) as oldest_log,
    MAX(timestamp) as newest_log
  FROM grain_audit_logs;
END;
$$;
