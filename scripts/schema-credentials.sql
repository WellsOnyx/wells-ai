-- =============================================================================
-- User Credentials Schema for WellsAI
-- =============================================================================
--
-- Secure storage for OAuth tokens, API keys, and webhook secrets per user.
-- All sensitive data is encrypted at rest using AES-256-GCM.
--
-- Tables:
-- - user_credentials: Main credential storage
-- - credential_audit_log: Audit trail for all credential operations
-- - credential_refresh_jobs: Scheduled token refresh jobs
-- - credential_key_rotations: Key rotation tracking
--
-- Encryption format: keyId:iv:ciphertext:authTag (all hex encoded)
--
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Provider types
DO $$ BEGIN
  CREATE TYPE credential_provider AS ENUM (
    -- Email
    'gmail', 'outlook',
    -- Social
    'linkedin', 'twitter', 'instagram',
    -- Communication
    'slack', 'discord', 'teams', 'twilio',
    -- Financial/Payments
    'stripe', 'plaid', 'circle',
    -- ERP/Accounting
    'quickbooks', 'xero', 'netsuite',
    -- CRM
    'salesforce', 'hubspot',
    -- Productivity
    'notion', 'airtable', 'google',
    -- AI/Data
    'openai', 'anthropic', 'apollo',
    -- Calendar
    'google_calendar', 'outlook_calendar', 'calendly',
    -- Custom
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Credential types
DO $$ BEGIN
  CREATE TYPE credential_type AS ENUM (
    'oauth',           -- OAuth 2.0 tokens
    'api_key',         -- Simple API keys
    'webhook_secret',  -- Webhook verification secrets
    'session_token',   -- Session-based auth
    'certificate',     -- Client certificates
    'service_account'  -- Service account JSON
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Connection health status
DO $$ BEGIN
  CREATE TYPE connection_health AS ENUM (
    'healthy',         -- Connection is working
    'expiring',        -- Token expires within 24 hours
    'expired',         -- Token is expired
    'refresh_failed',  -- Last refresh attempt failed
    'invalid',         -- Credentials are invalid
    'unknown'          -- Health check not performed yet
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Audit action types
DO $$ BEGIN
  CREATE TYPE credential_audit_action AS ENUM (
    'store',
    'refresh',
    'rotate',
    'revoke',
    'access',
    'health_check',
    'decrypt'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- MAIN CREDENTIALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Provider and type
  provider credential_provider NOT NULL,
  credential_type credential_type NOT NULL,

  -- Encrypted credential data (AES-256-GCM)
  -- Format: keyId:iv:ciphertext:authTag (all hex encoded)
  encrypted_data TEXT NOT NULL,

  -- Key management for rotation support
  key_id TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,

  -- OAuth-specific fields
  scopes TEXT[] DEFAULT '{}',
  token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  last_refresh_at TIMESTAMPTZ,
  refresh_attempts INTEGER DEFAULT 0,

  -- Health monitoring
  health connection_health NOT NULL DEFAULT 'unknown',
  last_health_check TIMESTAMPTZ,
  health_check_error TEXT,

  -- Metadata
  label TEXT,                    -- User-friendly name (e.g., "Work Gmail")
  email TEXT,                    -- Associated email/account
  account_id TEXT,               -- Provider's account ID
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uk_user_provider_account UNIQUE (user_id, provider, account_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_credentials_user ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_provider ON user_credentials(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_credentials_active ON user_credentials(user_id, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_credentials_health ON user_credentials(health)
  WHERE health IN ('expired', 'refresh_failed', 'invalid');
CREATE INDEX IF NOT EXISTS idx_credentials_expiring ON user_credentials(token_expires_at)
  WHERE token_expires_at IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_credentials_key_version ON user_credentials(key_version);

-- =============================================================================
-- AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS credential_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credential_id UUID REFERENCES user_credentials(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,

  -- Action details
  action credential_audit_action NOT NULL,
  provider credential_provider NOT NULL,

  -- Request context
  ip_address INET,
  user_agent TEXT,

  -- Result
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_credential ON credential_audit_log(credential_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON credential_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON credential_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON credential_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_recent ON credential_audit_log(user_id, created_at DESC);

-- =============================================================================
-- TOKEN REFRESH JOBS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS credential_refresh_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credential_id UUID NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,

  -- Job details
  provider credential_provider NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,

  -- Execution tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Result
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  new_token_expires_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for job scheduling
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_pending ON credential_refresh_jobs(scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_credential ON credential_refresh_jobs(credential_id);
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_status ON credential_refresh_jobs(status, scheduled_at);

-- =============================================================================
-- KEY ROTATION TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS credential_key_rotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Key identifiers (never store actual keys in DB)
  old_key_id TEXT NOT NULL,
  new_key_id TEXT NOT NULL,

  -- Rotation details
  rotated_by TEXT NOT NULL,  -- user_id of admin who initiated
  credentials_rotated INTEGER DEFAULT 0,
  credentials_failed INTEGER DEFAULT 0,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for key rotation
CREATE INDEX IF NOT EXISTS idx_key_rotations_status ON credential_key_rotations(status);
CREATE INDEX IF NOT EXISTS idx_key_rotations_created ON credential_key_rotations(created_at DESC);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: Credentials needing refresh (expiring within 10 minutes)
CREATE OR REPLACE VIEW credentials_needing_refresh AS
SELECT
  id,
  user_id,
  provider,
  credential_type,
  token_expires_at,
  health,
  EXTRACT(EPOCH FROM (token_expires_at - NOW())) as seconds_until_expiry
FROM user_credentials
WHERE is_active = true
  AND token_expires_at IS NOT NULL
  AND token_expires_at < NOW() + INTERVAL '10 minutes'
  AND health != 'invalid'
ORDER BY token_expires_at ASC;

-- View: Credential health summary by user
CREATE OR REPLACE VIEW credential_health_summary AS
SELECT
  user_id,
  COUNT(*) as total_credentials,
  COUNT(*) FILTER (WHERE health = 'healthy') as healthy,
  COUNT(*) FILTER (WHERE health = 'expiring') as expiring,
  COUNT(*) FILTER (WHERE health = 'expired') as expired,
  COUNT(*) FILTER (WHERE health = 'refresh_failed') as refresh_failed,
  COUNT(*) FILTER (WHERE health = 'invalid') as invalid,
  COUNT(*) FILTER (WHERE health = 'unknown') as unknown,
  MAX(updated_at) as last_updated
FROM user_credentials
WHERE is_active = true
GROUP BY user_id;

-- View: Credentials by provider
CREATE OR REPLACE VIEW credentials_by_provider AS
SELECT
  provider,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_credentials,
  COUNT(*) FILTER (WHERE is_active AND health = 'healthy') as active_healthy,
  COUNT(*) FILTER (WHERE health IN ('expired', 'refresh_failed', 'invalid')) as problematic
FROM user_credentials
GROUP BY provider
ORDER BY unique_users DESC;

-- View: Recent audit activity
CREATE OR REPLACE VIEW recent_credential_activity AS
SELECT
  cal.id,
  cal.user_id,
  cal.action,
  cal.provider,
  cal.success,
  cal.error_message,
  cal.created_at,
  uc.label as credential_label,
  uc.email as credential_email
FROM credential_audit_log cal
LEFT JOIN user_credentials uc ON cal.credential_id = uc.id
WHERE cal.created_at > NOW() - INTERVAL '7 days'
ORDER BY cal.created_at DESC;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function: Log credential audit event
CREATE OR REPLACE FUNCTION log_credential_audit(
  p_credential_id UUID,
  p_user_id TEXT,
  p_action credential_audit_action,
  p_provider credential_provider,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO credential_audit_log (
    credential_id, user_id, action, provider, success,
    error_message, ip_address, user_agent, metadata
  ) VALUES (
    p_credential_id, p_user_id, p_action, p_provider, p_success,
    p_error_message, p_ip_address, p_user_agent, p_metadata
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update credential health based on expiration
CREATE OR REPLACE FUNCTION update_credential_health()
RETURNS TRIGGER AS $$
BEGIN
  -- Update health based on token expiration
  IF NEW.token_expires_at IS NOT NULL THEN
    IF NEW.token_expires_at < NOW() THEN
      NEW.health := 'expired';
    ELSIF NEW.token_expires_at < NOW() + INTERVAL '24 hours' THEN
      NEW.health := 'expiring';
    ELSIF NEW.health = 'expiring' OR NEW.health = 'expired' THEN
      -- Reset to healthy if token was refreshed
      NEW.health := 'healthy';
    END IF;
  END IF;

  -- Always update the timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update credential health on update
DROP TRIGGER IF EXISTS trg_update_credential_health ON user_credentials;
CREATE TRIGGER trg_update_credential_health
  BEFORE UPDATE ON user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_credential_health();

-- Function: Schedule token refresh when expires_at is set
CREATE OR REPLACE FUNCTION schedule_token_refresh()
RETURNS TRIGGER AS $$
DECLARE
  v_scheduled_at TIMESTAMPTZ;
BEGIN
  -- Only schedule for OAuth credentials
  IF NEW.credential_type = 'oauth' AND NEW.token_expires_at IS NOT NULL THEN
    -- Schedule refresh 10 minutes before expiry
    v_scheduled_at := NEW.token_expires_at - INTERVAL '10 minutes';

    -- Only schedule if in the future
    IF v_scheduled_at > NOW() THEN
      -- Remove any existing pending jobs
      DELETE FROM credential_refresh_jobs
      WHERE credential_id = NEW.id AND status = 'pending';

      -- Create new refresh job
      INSERT INTO credential_refresh_jobs (credential_id, provider, scheduled_at)
      VALUES (NEW.id, NEW.provider, v_scheduled_at);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-schedule refresh when token_expires_at changes
DROP TRIGGER IF EXISTS trg_schedule_token_refresh ON user_credentials;
CREATE TRIGGER trg_schedule_token_refresh
  AFTER INSERT OR UPDATE OF token_expires_at ON user_credentials
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION schedule_token_refresh();

-- Function: Get user's active credentials for a provider
CREATE OR REPLACE FUNCTION get_active_credentials(
  p_user_id TEXT,
  p_provider credential_provider
) RETURNS TABLE (
  id UUID,
  credential_type credential_type,
  label TEXT,
  email TEXT,
  health connection_health,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uc.id,
    uc.credential_type,
    uc.label,
    uc.email,
    uc.health,
    uc.token_expires_at,
    uc.created_at
  FROM user_credentials uc
  WHERE uc.user_id = p_user_id
    AND uc.provider = p_provider
    AND uc.is_active = true
  ORDER BY uc.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if user has healthy credentials for provider
CREATE OR REPLACE FUNCTION has_healthy_credentials(
  p_user_id TEXT,
  p_provider credential_provider
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_credentials
    WHERE user_id = p_user_id
      AND provider = p_provider
      AND is_active = true
      AND health IN ('healthy', 'expiring')
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Clean up old audit logs (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM credential_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function: Clean up completed/failed refresh jobs (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_refresh_jobs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM credential_refresh_jobs
  WHERE status IN ('success', 'failed')
    AND created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_credentials IS 'Encrypted storage for user OAuth tokens, API keys, and secrets';
COMMENT ON COLUMN user_credentials.encrypted_data IS 'AES-256-GCM encrypted credential data. Format: keyId:iv:ciphertext:authTag';
COMMENT ON COLUMN user_credentials.key_id IS 'ID of encryption key used, for rotation support';
COMMENT ON COLUMN user_credentials.key_version IS 'Version of encryption key, incremented on rotation';
COMMENT ON COLUMN user_credentials.health IS 'Current connection health status based on token validity';
COMMENT ON COLUMN user_credentials.refresh_attempts IS 'Counter for failed refresh attempts, reset on success';

COMMENT ON TABLE credential_audit_log IS 'Audit trail for all credential operations (GDPR/SOC2 compliance)';
COMMENT ON TABLE credential_refresh_jobs IS 'Scheduled jobs for automatic OAuth token refresh';
COMMENT ON TABLE credential_key_rotations IS 'Tracks encryption key rotation events for compliance';

COMMENT ON VIEW credentials_needing_refresh IS 'Credentials with tokens expiring in the next 10 minutes';
COMMENT ON VIEW credential_health_summary IS 'Health status summary grouped by user';
COMMENT ON VIEW credentials_by_provider IS 'Credential counts and health by provider';

COMMENT ON FUNCTION log_credential_audit IS 'Log a credential operation to the audit trail';
COMMENT ON FUNCTION update_credential_health IS 'Auto-update health status based on token expiration';
COMMENT ON FUNCTION schedule_token_refresh IS 'Auto-schedule refresh job when token_expires_at is set';
COMMENT ON FUNCTION has_healthy_credentials IS 'Check if user has working credentials for a provider';

-- =============================================================================
-- GRANTS (adjust roles as needed)
-- =============================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_credentials TO wells_app;
-- GRANT SELECT, INSERT ON credential_audit_log TO wells_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON credential_refresh_jobs TO wells_app;
-- GRANT SELECT, INSERT, UPDATE ON credential_key_rotations TO wells_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wells_app;

-- =============================================================================
-- SAMPLE DATA (for development only - remove in production)
-- =============================================================================

-- Uncomment to insert test data:
-- INSERT INTO user_credentials (user_id, provider, credential_type, encrypted_data, key_id, key_version, label, email, health)
-- VALUES
--   ('test_user_1', 'gmail', 'oauth', 'wells_cred_v1:000000000000:encrypted:authtag', 'wells_cred_v1', 1, 'Work Gmail', 'user@company.com', 'healthy'),
--   ('test_user_1', 'slack', 'oauth', 'wells_cred_v1:000000000000:encrypted:authtag', 'wells_cred_v1', 1, 'Company Slack', NULL, 'healthy'),
--   ('test_user_1', 'openai', 'api_key', 'wells_cred_v1:000000000000:encrypted:authtag', 'wells_cred_v1', 1, 'OpenAI API', NULL, 'healthy');
