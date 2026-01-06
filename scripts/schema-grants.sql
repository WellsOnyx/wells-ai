-- GRAIN Grant Disbursement System Schema
-- For nonprofits and endowments using the GRAIN ecosystem
--
-- KEY INSIGHT: Grants come from CREDIT LINE, not protected deposit.
-- This preserves the endowment's principal/corpus.
--
-- ============================================================================
-- GRANTS TABLE
-- ============================================================================

-- Grants table - tracks grant allocations from endowments
CREATE TABLE IF NOT EXISTS grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Grantor (endowment)
  endowment_id TEXT NOT NULL,  -- References credit_line_positions.user_id

  -- Grantee
  grantee_id TEXT,             -- Optional: if grantee is a GRAIN user
  grantee_name TEXT NOT NULL,
  grantee_type TEXT NOT NULL DEFAULT 'nonprofit',  -- 'nonprofit', 'individual', 'institution', 'other'

  -- Grant details
  amount DECIMAL(24,6) NOT NULL,           -- GRAIN amount
  usd_value_at_creation DECIMAL(20,2),     -- USD value when grant was created
  purpose TEXT NOT NULL,
  description TEXT,

  -- Restricted fund linkage (optional)
  restricted_fund_id UUID REFERENCES restricted_funds(id),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'disbursed', 'completed', 'cancelled', 'rejected'
  approved_by TEXT,
  approved_at TIMESTAMP,

  -- Agreement
  agreement_id UUID,
  agreement_url TEXT,

  -- Disbursement tracking
  total_disbursed DECIMAL(24,6) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(24,6) NOT NULL,

  -- Timeline
  grant_period_start DATE,
  grant_period_end DATE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for grants
CREATE INDEX IF NOT EXISTS idx_grants_endowment ON grants(endowment_id);
CREATE INDEX IF NOT EXISTS idx_grants_grantee ON grants(grantee_id);
CREATE INDEX IF NOT EXISTS idx_grants_status ON grants(status);
CREATE INDEX IF NOT EXISTS idx_grants_restricted_fund ON grants(restricted_fund_id);
CREATE INDEX IF NOT EXISTS idx_grants_created ON grants(created_at);

-- ============================================================================
-- GRANT DISBURSEMENTS TABLE
-- ============================================================================

-- Individual disbursements from grants
CREATE TABLE IF NOT EXISTS grant_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES grants(id),

  -- Amounts
  amount DECIMAL(24,6) NOT NULL,           -- GRAIN disbursed
  usd_value DECIMAL(20,2) NOT NULL,        -- USD value at disbursement
  grain_price DECIMAL(20,10) NOT NULL,     -- Price at time of disbursement

  -- Credit line transaction reference
  credit_line_transaction_id UUID,         -- References credit_line_transactions(id)

  -- Method
  method TEXT NOT NULL,                    -- 'ach', 'wire', 'check', 'grain_transfer', 'other'
  method_details JSONB,                    -- Additional method-specific info

  -- Receipt
  receipt_id TEXT NOT NULL UNIQUE,         -- Human-readable receipt ID
  receipt_url TEXT,                        -- Link to receipt document

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'

  -- Timestamps
  disbursed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes for disbursements
CREATE INDEX IF NOT EXISTS idx_grant_disbursements_grant ON grant_disbursements(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_disbursements_status ON grant_disbursements(status);
CREATE INDEX IF NOT EXISTS idx_grant_disbursements_receipt ON grant_disbursements(receipt_id);
CREATE INDEX IF NOT EXISTS idx_grant_disbursements_date ON grant_disbursements(disbursed_at);

-- ============================================================================
-- RESTRICTED FUNDS TABLE
-- ============================================================================

-- Restricted funds within an endowment
-- These are sub-allocations of the credit line for specific purposes
CREATE TABLE IF NOT EXISTS restricted_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endowment_id TEXT NOT NULL,              -- References credit_line_positions.user_id

  -- Fund details
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  restrictions TEXT NOT NULL,              -- What the fund can be used for

  -- Allocation (from credit line)
  allocated_grain DECIMAL(24,6) NOT NULL DEFAULT 0,
  used_grain DECIMAL(24,6) NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for restricted funds
CREATE INDEX IF NOT EXISTS idx_restricted_funds_endowment ON restricted_funds(endowment_id);
CREATE INDEX IF NOT EXISTS idx_restricted_funds_name ON restricted_funds(name);

-- ============================================================================
-- GRANT AGREEMENTS TABLE
-- ============================================================================

-- Grant agreements (legal documents)
CREATE TABLE IF NOT EXISTS grant_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES grants(id),

  -- Agreement details
  agreement_number TEXT NOT NULL UNIQUE,
  document_url TEXT,
  terms TEXT NOT NULL,

  -- Signatures
  signed_at TIMESTAMP,
  signed_by TEXT,
  grantor_signature_url TEXT,
  grantee_signature_url TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for agreements
CREATE INDEX IF NOT EXISTS idx_grant_agreements_grant ON grant_agreements(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_agreements_number ON grant_agreements(agreement_number);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Grant summary with current values
CREATE OR REPLACE VIEW grant_summary AS
SELECT
  g.id,
  g.endowment_id,
  g.grantee_name,
  g.grantee_type,
  g.amount,
  g.usd_value_at_creation,
  g.purpose,
  g.status,
  g.total_disbursed,
  g.remaining_amount,
  rf.name AS restricted_fund_name,
  rf.restrictions AS fund_restrictions,
  -- Calculate percent disbursed
  CASE
    WHEN g.amount > 0 THEN ROUND((g.total_disbursed / g.amount * 100)::numeric, 2)
    ELSE 0
  END AS percent_disbursed,
  -- Count disbursements
  (SELECT COUNT(*) FROM grant_disbursements WHERE grant_id = g.id) AS disbursement_count,
  g.created_at,
  g.updated_at
FROM grants g
LEFT JOIN restricted_funds rf ON g.restricted_fund_id = rf.id;

-- View: Endowment grant statistics
CREATE OR REPLACE VIEW endowment_grant_stats AS
SELECT
  endowment_id,
  COUNT(*) AS total_grants,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_grants,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_grants,
  COUNT(*) FILTER (WHERE status = 'disbursed') AS disbursed_grants,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_grants,
  COUNT(*) FILTER (WHERE status IN ('cancelled', 'rejected')) AS cancelled_grants,
  COALESCE(SUM(amount), 0) AS total_amount_granted,
  COALESCE(SUM(total_disbursed), 0) AS total_amount_disbursed,
  COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('approved', 'disbursed')), 0) AS total_amount_pending
FROM grants
GROUP BY endowment_id;

-- View: Restricted fund summary
CREATE OR REPLACE VIEW restricted_fund_summary AS
SELECT
  rf.id,
  rf.endowment_id,
  rf.name,
  rf.purpose,
  rf.restrictions,
  rf.allocated_grain,
  rf.used_grain,
  rf.allocated_grain - rf.used_grain AS available_grain,
  -- Count linked grants
  (SELECT COUNT(*) FROM grants WHERE restricted_fund_id = rf.id) AS grant_count,
  (SELECT COUNT(*) FROM grants WHERE restricted_fund_id = rf.id AND status IN ('approved', 'disbursed')) AS active_grant_count,
  rf.created_at,
  rf.updated_at
FROM restricted_funds rf;

-- View: Recent disbursements
CREATE OR REPLACE VIEW recent_disbursements AS
SELECT
  d.id,
  d.grant_id,
  g.grantee_name,
  g.endowment_id,
  d.amount,
  d.usd_value,
  d.grain_price,
  d.method,
  d.receipt_id,
  d.status,
  d.disbursed_at,
  d.completed_at
FROM grant_disbursements d
JOIN grants g ON d.grant_id = g.id
ORDER BY d.disbursed_at DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get grant disbursement total
CREATE OR REPLACE FUNCTION get_grant_disbursement_total(p_grant_id UUID)
RETURNS TABLE(
  total_amount DECIMAL(24,6),
  total_usd DECIMAL(20,2),
  disbursement_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount), 0)::DECIMAL(24,6) AS total_amount,
    COALESCE(SUM(usd_value), 0)::DECIMAL(20,2) AS total_usd,
    COUNT(*)::INTEGER AS disbursement_count
  FROM grant_disbursements
  WHERE grant_id = p_grant_id AND status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- Function: Check if grant can be disbursed
CREATE OR REPLACE FUNCTION can_disburse_grant(p_grant_id UUID, p_amount DECIMAL(24,6))
RETURNS TABLE(
  can_disburse BOOLEAN,
  reason TEXT,
  remaining_amount DECIMAL(24,6)
) AS $$
DECLARE
  v_grant RECORD;
BEGIN
  SELECT * INTO v_grant FROM grants WHERE id = p_grant_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Grant not found'::TEXT, 0::DECIMAL(24,6);
    RETURN;
  END IF;

  IF v_grant.status NOT IN ('approved', 'disbursed') THEN
    RETURN QUERY SELECT FALSE,
      ('Grant status must be approved or disbursed. Current: ' || v_grant.status)::TEXT,
      v_grant.remaining_amount;
    RETURN;
  END IF;

  IF p_amount > v_grant.remaining_amount THEN
    RETURN QUERY SELECT FALSE,
      ('Amount exceeds remaining balance. Remaining: ' || v_grant.remaining_amount)::TEXT,
      v_grant.remaining_amount;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, 'OK'::TEXT, v_grant.remaining_amount;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update timestamp on grants
CREATE OR REPLACE FUNCTION update_grant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grants_updated ON grants;
CREATE TRIGGER grants_updated
  BEFORE UPDATE ON grants
  FOR EACH ROW
  EXECUTE FUNCTION update_grant_timestamp();

-- Trigger: Update timestamp on restricted_funds
DROP TRIGGER IF EXISTS restricted_funds_updated ON restricted_funds;
CREATE TRIGGER restricted_funds_updated
  BEFORE UPDATE ON restricted_funds
  FOR EACH ROW
  EXECUTE FUNCTION update_grant_timestamp();

-- Trigger: Update grant totals when disbursement is completed
CREATE OR REPLACE FUNCTION update_grant_on_disbursement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE grants
    SET total_disbursed = total_disbursed + NEW.amount,
        remaining_amount = remaining_amount - NEW.amount,
        status = CASE
          WHEN remaining_amount - NEW.amount <= 0 THEN 'completed'
          ELSE 'disbursed'
        END,
        updated_at = NOW()
    WHERE id = NEW.grant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger is optional - the application handles this logic
-- Uncomment if you want database-level enforcement
-- DROP TRIGGER IF EXISTS disbursement_completed ON grant_disbursements;
-- CREATE TRIGGER disbursement_completed
--   AFTER INSERT OR UPDATE ON grant_disbursements
--   FOR EACH ROW
--   EXECUTE FUNCTION update_grant_on_disbursement();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE grants IS 'Grant allocations from endowments to grantees. Grants come from CREDIT LINE, not protected deposit.';
COMMENT ON TABLE grant_disbursements IS 'Individual fund disbursements from grants. Each disbursement uses credit line, not principal.';
COMMENT ON TABLE restricted_funds IS 'Sub-allocations within an endowment for specific purposes.';
COMMENT ON TABLE grant_agreements IS 'Legal grant agreements with terms and signatures.';

COMMENT ON COLUMN grants.endowment_id IS 'References credit_line_positions.user_id - the grantor';
COMMENT ON COLUMN grants.amount IS 'Total GRAIN allocated to this grant';
COMMENT ON COLUMN grants.remaining_amount IS 'GRAIN not yet disbursed';
COMMENT ON COLUMN grants.status IS 'pending -> approved -> disbursed -> completed';

COMMENT ON COLUMN grant_disbursements.credit_line_transaction_id IS 'Links to credit_line_transactions for audit trail';
COMMENT ON COLUMN grant_disbursements.receipt_id IS 'Human-readable receipt ID for grantee records';

COMMENT ON COLUMN restricted_funds.allocated_grain IS 'GRAIN allocated from credit line to this fund';
COMMENT ON COLUMN restricted_funds.used_grain IS 'GRAIN disbursed from this fund via grants';

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to insert sample data for testing
/*
-- Sample restricted fund
INSERT INTO restricted_funds (endowment_id, name, purpose, restrictions, allocated_grain)
VALUES (
  'sample_endowment_001',
  'Youth Education Fund',
  'Support educational programs for underserved youth',
  'Must be used for educational purposes only. Cannot fund religious activities.',
  100000
);

-- Sample grant
INSERT INTO grants (
  endowment_id, grantee_name, grantee_type, amount, usd_value_at_creation,
  purpose, description, status, remaining_amount
)
VALUES (
  'sample_endowment_001',
  'Local Community School',
  'nonprofit',
  10000,
  10000,
  'After-school STEM program funding',
  'Funding for materials, instructors, and equipment for the 2024 after-school STEM program.',
  'approved',
  10000
);
*/

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
--
-- To run this schema:
-- 1. Ensure credit_line_positions table exists (from schema-credit-line.sql)
-- 2. Run this schema to create grants tables
-- 3. Foreign key to restricted_funds is optional (restricted_fund_id can be NULL)
--
-- Key relationships:
-- - grants.endowment_id -> credit_line_positions.user_id
-- - grants.restricted_fund_id -> restricted_funds.id
-- - grant_disbursements.grant_id -> grants.id
-- - grant_disbursements.credit_line_transaction_id -> credit_line_transactions.id
-- - grant_agreements.grant_id -> grants.id
--
