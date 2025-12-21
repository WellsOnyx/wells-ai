-- ============================================================================
-- USER APPROVAL SCHEMA
-- Manual approval requirement for Grain & Vault signups
-- Run: psql $POSTGRES_URL < scripts/schema-user-approval.sql
-- ============================================================================

-- Add approved column to user_wallets table
ALTER TABLE user_wallets
  ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;

-- Add approval metadata columns
ALTER TABLE user_wallets
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Index for filtering unapproved users
CREATE INDEX IF NOT EXISTS idx_user_wallets_approved ON user_wallets(approved);
CREATE INDEX IF NOT EXISTS idx_user_wallets_approval_pending ON user_wallets(approved) WHERE approved = FALSE;

-- ============================================================================
-- ADMIN APPROVAL LOG
-- Track all approval/rejection actions for audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_approval_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User being approved/rejected
  user_id TEXT NOT NULL,
  wallet_id TEXT,

  -- Action
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'revoke', 'reinstate')),

  -- Admin who performed the action
  admin_id TEXT NOT NULL,
  admin_email TEXT,

  -- Details
  reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_approval_log_user ON user_approval_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_approval_log_admin ON user_approval_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_user_approval_log_action ON user_approval_log(action);
CREATE INDEX IF NOT EXISTS idx_user_approval_log_created ON user_approval_log(created_at DESC);

-- ============================================================================
-- VIEW: Pending Approvals
-- Quick view of all users awaiting approval
-- ============================================================================

CREATE OR REPLACE VIEW pending_user_approvals AS
SELECT
  uw.user_id,
  uw.wallet_id,
  uw.wallet_address,
  uw.balance,
  uw.created_at AS signup_date,
  uw.updated_at,
  EXTRACT(EPOCH FROM (NOW() - uw.created_at)) / 3600 AS hours_pending
FROM user_wallets uw
WHERE uw.approved = FALSE
ORDER BY uw.created_at ASC;

COMMENT ON VIEW pending_user_approvals IS 'Users awaiting manual approval to access Grain & Vault';
