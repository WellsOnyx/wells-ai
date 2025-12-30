-- ERP Credentials Schema Extension
-- Adds encrypted credential storage for all 11 ERP providers
--
-- Encryption: AES-256-GCM with provider-specific key derivation
-- Format: keyId:iv:ciphertext:authTag (all hex encoded)

-- Add new columns to erp_connections for extended credential storage
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Sage Intacct specific columns
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS intacct_sender_id TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS intacct_sender_password TEXT; -- encrypted
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS intacct_user_id TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS intacct_user_password TEXT; -- encrypted
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS intacct_company_id TEXT;

-- Workday specific columns
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS workday_integration_id TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS workday_integration_secret TEXT; -- encrypted
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS workday_data_center VARCHAR(10) DEFAULT 'us';

-- NetSuite Token-Based Auth columns (for non-OAuth)
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS netsuite_account_id TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS netsuite_consumer_key TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS netsuite_consumer_secret TEXT; -- encrypted
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS netsuite_token_key TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS netsuite_token_secret TEXT; -- encrypted

-- SAP specific columns
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS sap_api_endpoint TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS sap_company_database TEXT;

-- Oracle specific columns
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS oracle_host TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS oracle_data_center TEXT;

-- Dynamics 365 specific columns
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS dynamics_environment TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS dynamics_variant VARCHAR(30) DEFAULT 'business_central';

-- Acumatica specific columns
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS acumatica_instance_url TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS acumatica_tenant TEXT;

-- Infor specific columns
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS infor_ion_gateway_url TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS infor_tenant TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS infor_product VARCHAR(20) DEFAULT 'csf';

-- Coupa specific columns
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS coupa_instance_url TEXT;

-- Credential metadata
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS credential_key_id TEXT;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS credentials_rotated_at TIMESTAMPTZ;
ALTER TABLE erp_connections ADD COLUMN IF NOT EXISTS oauth_scopes TEXT[];

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_erp_connections_user ON erp_connections(user_id);

-- ============================================================================
-- CREDENTIAL AUDIT LOG
-- Tracks all credential operations for security compliance
-- ============================================================================

CREATE TABLE IF NOT EXISTS erp_credential_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES erp_connections(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,

  -- Action details
  action VARCHAR(50) NOT NULL, -- 'store', 'refresh', 'rotate', 'revoke', 'access'
  provider VARCHAR(50) NOT NULL,

  -- Request context
  ip_address INET,
  user_agent TEXT,

  -- Result
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_erp_credential_audit_connection ON erp_credential_audit(connection_id);
CREATE INDEX IF NOT EXISTS idx_erp_credential_audit_user ON erp_credential_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_erp_credential_audit_action ON erp_credential_audit(action);
CREATE INDEX IF NOT EXISTS idx_erp_credential_audit_created ON erp_credential_audit(created_at DESC);

-- ============================================================================
-- KEY ROTATION TRACKING
-- Tracks encryption key rotations for compliance
-- ============================================================================

CREATE TABLE IF NOT EXISTS erp_key_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Key identifiers (never store actual keys)
  old_key_id TEXT NOT NULL,
  new_key_id TEXT NOT NULL,

  -- Rotation details
  rotated_by TEXT NOT NULL, -- user_id of admin
  connections_rotated INTEGER DEFAULT 0,
  connections_failed INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for key rotation tracking
CREATE INDEX IF NOT EXISTS idx_erp_key_rotations_status ON erp_key_rotations(status);
CREATE INDEX IF NOT EXISTS idx_erp_key_rotations_created ON erp_key_rotations(created_at DESC);

-- ============================================================================
-- TOKEN REFRESH JOBS
-- Track automatic token refresh attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS erp_token_refresh_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES erp_connections(id) ON DELETE CASCADE,

  -- Job details
  provider VARCHAR(50) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,

  -- Execution
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Result
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed'
  new_token_expires_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for refresh job scheduling
CREATE INDEX IF NOT EXISTS idx_erp_token_refresh_jobs_scheduled ON erp_token_refresh_jobs(scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_erp_token_refresh_jobs_connection ON erp_token_refresh_jobs(connection_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for connections needing token refresh
CREATE OR REPLACE VIEW erp_connections_needing_refresh AS
SELECT
  id,
  provider,
  user_id,
  company_id,
  token_expires_at,
  EXTRACT(EPOCH FROM (token_expires_at - NOW())) as seconds_until_expiry
FROM erp_connections
WHERE connection_status = 'active'
  AND token_expires_at IS NOT NULL
  AND token_expires_at < NOW() + INTERVAL '10 minutes'
ORDER BY token_expires_at ASC;

-- View for credential audit summary
CREATE OR REPLACE VIEW erp_credential_audit_summary AS
SELECT
  provider,
  action,
  COUNT(*) as total_actions,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
  MAX(created_at) as last_action_at
FROM erp_credential_audit
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY provider, action
ORDER BY provider, action;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to log credential audit
CREATE OR REPLACE FUNCTION log_credential_audit(
  p_connection_id UUID,
  p_user_id TEXT,
  p_action VARCHAR(50),
  p_provider VARCHAR(50),
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO erp_credential_audit (
    connection_id,
    user_id,
    action,
    provider,
    success,
    error_message,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_connection_id,
    p_user_id,
    p_action,
    p_provider,
    p_success,
    p_error_message,
    p_ip_address,
    p_user_agent,
    p_metadata
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to schedule token refresh
CREATE OR REPLACE FUNCTION schedule_token_refresh(
  p_connection_id UUID,
  p_provider VARCHAR(50),
  p_token_expires_at TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
  v_refresh_threshold INTERVAL;
BEGIN
  -- Set refresh threshold based on provider
  v_refresh_threshold := CASE p_provider
    WHEN 'xero' THEN INTERVAL '5 minutes'
    WHEN 'sap' THEN INTERVAL '5 minutes'
    WHEN 'workday' THEN INTERVAL '5 minutes'
    ELSE INTERVAL '10 minutes'
  END;

  -- Delete any pending refresh jobs for this connection
  DELETE FROM erp_token_refresh_jobs
  WHERE connection_id = p_connection_id AND status = 'pending';

  -- Schedule new refresh job
  INSERT INTO erp_token_refresh_jobs (
    connection_id,
    provider,
    scheduled_at
  ) VALUES (
    p_connection_id,
    p_provider,
    p_token_expires_at - v_refresh_threshold
  ) RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-schedule refresh when token is updated
CREATE OR REPLACE FUNCTION trigger_schedule_token_refresh()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token_expires_at IS NOT NULL
     AND NEW.provider != 'sage_intacct'
     AND (OLD.token_expires_at IS NULL OR NEW.token_expires_at != OLD.token_expires_at) THEN
    PERFORM schedule_token_refresh(NEW.id, NEW.provider, NEW.token_expires_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trg_schedule_token_refresh ON erp_connections;
CREATE TRIGGER trg_schedule_token_refresh
  AFTER INSERT OR UPDATE OF token_expires_at ON erp_connections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_schedule_token_refresh();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE erp_credential_audit IS 'Audit log for all ERP credential operations';
COMMENT ON TABLE erp_key_rotations IS 'Tracks encryption key rotation events';
COMMENT ON TABLE erp_token_refresh_jobs IS 'Scheduled jobs for automatic token refresh';
COMMENT ON COLUMN erp_connections.intacct_sender_password IS 'Encrypted - AES-256-GCM';
COMMENT ON COLUMN erp_connections.intacct_user_password IS 'Encrypted - AES-256-GCM';
COMMENT ON COLUMN erp_connections.workday_integration_secret IS 'Encrypted - AES-256-GCM';
COMMENT ON COLUMN erp_connections.netsuite_consumer_secret IS 'Encrypted - AES-256-GCM';
COMMENT ON COLUMN erp_connections.netsuite_token_secret IS 'Encrypted - AES-256-GCM';
COMMENT ON COLUMN erp_connections.access_token IS 'Encrypted - AES-256-GCM';
COMMENT ON COLUMN erp_connections.refresh_token IS 'Encrypted - AES-256-GCM';
COMMENT ON COLUMN erp_connections.webhook_secret IS 'Encrypted - AES-256-GCM';
