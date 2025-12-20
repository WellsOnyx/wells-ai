-- ============================================================================
-- IDENTITY VERIFICATION SCHEMA
-- Grain & Vault KYC Compliance - Multi-provider verification sessions
-- Run: psql $POSTGRES_URL < scripts/schema-identity-verification.sql
-- ============================================================================

-- ============================================================================
-- GRAIN VERIFICATION SESSIONS
-- Tracks verification sessions from providers (Veriff, Jumio, Persona)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session Identification
  session_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('veriff', 'jumio', 'persona')),

  -- User Reference
  user_id TEXT NOT NULL,

  -- Session Status
  -- pending: Session created, awaiting user action
  -- in_review: Provider is reviewing submission
  -- approved: Verification successful
  -- rejected: Verification failed
  -- expired: Session timed out
  -- resubmission_required: User needs to resubmit
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_review', 'approved', 'rejected', 'expired', 'resubmission_required'
  )),

  -- Verification URL (for user to complete verification)
  verification_url TEXT,

  -- Timestamps
  expires_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Result Data (JSON from provider)
  result_data JSONB,

  -- Additional Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_sessions_user_id ON grain_verification_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_status ON grain_verification_sessions(status);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_session_id ON grain_verification_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_provider ON grain_verification_sessions(provider);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_created ON grain_verification_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_expires ON grain_verification_sessions(expires_at);

-- ============================================================================
-- VERIFICATION AUDIT LOG
-- Immutable record of all verification-related events
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_verification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event Type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'session_created',
    'session_started',
    'session_completed',
    'session_expired',
    'document_submitted',
    'document_verified',
    'document_rejected',
    'selfie_submitted',
    'selfie_verified',
    'selfie_rejected',
    'level_upgraded',
    'level_downgraded',
    'manual_review_required',
    'manual_review_completed',
    'webhook_received',
    'webhook_processed',
    'error'
  )),

  -- References
  user_id TEXT NOT NULL,
  session_id TEXT,

  -- Event Details
  previous_status TEXT,
  new_status TEXT,
  previous_level INTEGER,
  new_level INTEGER,

  -- Additional Data
  details JSONB DEFAULT '{}',
  error_message TEXT,

  -- Source Info
  ip_address TEXT,
  user_agent TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_verification_audit_user ON grain_verification_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_session ON grain_verification_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_type ON grain_verification_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_verification_audit_created ON grain_verification_audit_log(created_at DESC);

-- ============================================================================
-- VERIFICATION DOCUMENTS
-- Stores document metadata (not the actual documents for security)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User and Session Reference
  user_id TEXT NOT NULL,
  session_id TEXT,

  -- Document Type
  document_type TEXT NOT NULL CHECK (document_type IN (
    'drivers_license',
    'passport',
    'national_id',
    'residence_permit',
    'selfie',
    'proof_of_address',
    'bank_statement',
    'utility_bill',
    'tax_document',
    'other'
  )),

  -- Document Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'verified', 'rejected', 'expired'
  )),

  -- Extracted Data (from provider, encrypted)
  document_number_hash TEXT, -- Hashed for security
  issuing_country TEXT,
  issue_date DATE,
  expiry_date DATE,
  extracted_data JSONB, -- Other extracted fields

  -- Verification Results
  verification_score DECIMAL(5, 2),
  fraud_signals JSONB DEFAULT '[]',
  rejection_reasons JSONB DEFAULT '[]',

  -- Provider Reference
  provider TEXT,
  provider_document_id TEXT,

  -- Timestamps
  submitted_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for document queries
CREATE INDEX IF NOT EXISTS idx_verification_docs_user ON grain_verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_session ON grain_verification_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_type ON grain_verification_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_verification_docs_status ON grain_verification_documents(status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_verification_sessions_updated_at
  BEFORE UPDATE ON grain_verification_sessions
  FOR EACH ROW EXECUTE FUNCTION update_verification_updated_at();

CREATE TRIGGER update_verification_documents_updated_at
  BEFORE UPDATE ON grain_verification_documents
  FOR EACH ROW EXECUTE FUNCTION update_verification_updated_at();

-- Auto-expire old pending sessions (run via cron job or application)
CREATE OR REPLACE FUNCTION expire_old_verification_sessions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE grain_verification_sessions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active verification sessions per user
CREATE OR REPLACE VIEW active_verification_sessions AS
SELECT
  s.user_id,
  s.session_id,
  s.provider,
  s.status,
  s.verification_url,
  s.expires_at,
  s.created_at,
  p.verification_level,
  p.email,
  p.full_name
FROM grain_verification_sessions s
LEFT JOIN grain_user_profiles p ON s.user_id = p.user_id
WHERE s.status IN ('pending', 'in_review')
  AND (s.expires_at IS NULL OR s.expires_at > NOW())
ORDER BY s.created_at DESC;

-- Verification metrics for dashboard
CREATE OR REPLACE VIEW verification_metrics AS
SELECT
  DATE(created_at) as date,
  provider,
  status,
  COUNT(*) as count
FROM grain_verification_sessions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), provider, status
ORDER BY DATE(created_at) DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get user's verification history
CREATE OR REPLACE FUNCTION get_user_verification_history(p_user_id TEXT)
RETURNS TABLE (
  session_id TEXT,
  provider TEXT,
  status TEXT,
  level_achieved INTEGER,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.session_id,
    s.provider,
    s.status,
    COALESCE((s.result_data->>'level')::INTEGER, 0) as level_achieved,
    s.created_at,
    s.completed_at
  FROM grain_verification_sessions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Check if user needs verification upgrade for amount
CREATE OR REPLACE FUNCTION check_verification_for_amount(
  p_user_id TEXT,
  p_amount DECIMAL
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_level INTEGER,
  required_level INTEGER,
  current_limit DECIMAL,
  message TEXT
) AS $$
DECLARE
  v_current_level INTEGER;
  v_daily_limit DECIMAL;
  v_required_level INTEGER;
BEGIN
  -- Get current level and limits
  SELECT verification_level, daily_deposit_limit
  INTO v_current_level, v_daily_limit
  FROM grain_user_profiles
  WHERE user_id = p_user_id;

  -- Default to level 1 if not found
  IF v_current_level IS NULL THEN
    v_current_level := 1;
    v_daily_limit := 1000;
  END IF;

  -- Determine required level
  IF p_amount <= 1000 THEN
    v_required_level := 1;
  ELSIF p_amount <= 10000 THEN
    v_required_level := 2;
  ELSIF p_amount <= 100000 THEN
    v_required_level := 3;
  ELSE
    v_required_level := 4;
  END IF;

  -- Return result
  IF v_current_level >= v_required_level THEN
    RETURN QUERY SELECT
      TRUE,
      v_current_level,
      v_required_level,
      v_daily_limit,
      'Transaction allowed'::TEXT;
  ELSE
    RETURN QUERY SELECT
      FALSE,
      v_current_level,
      v_required_level,
      v_daily_limit,
      FORMAT('Verification level %s required for transactions over $%s', v_required_level, v_daily_limit)::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE grain_verification_sessions IS 'KYC verification sessions from identity providers (Veriff, Jumio, Persona)';
COMMENT ON TABLE grain_verification_audit_log IS 'Immutable audit trail for all verification events';
COMMENT ON TABLE grain_verification_documents IS 'Document metadata for verification (actual docs stored by provider)';

COMMENT ON COLUMN grain_verification_sessions.session_id IS 'Unique session ID from verification provider';
COMMENT ON COLUMN grain_verification_sessions.verification_url IS 'URL for user to complete verification flow';
COMMENT ON COLUMN grain_verification_sessions.result_data IS 'Full verification result from provider (JSON)';

COMMENT ON FUNCTION expire_old_verification_sessions() IS 'Call periodically to expire stale pending sessions';
COMMENT ON FUNCTION check_verification_for_amount(TEXT, DECIMAL) IS 'Check if user verification level allows transaction amount';
