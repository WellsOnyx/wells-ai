-- ============================================================================
-- ESCROW SYSTEM SCHEMA
-- Secure deal escrow with USDC via Circle
-- Run: psql $POSTGRES_URL < scripts/schema-escrow.sql
-- ============================================================================

-- ESCROW DEALS
-- Main escrow table for holding funds until delivery
CREATE TABLE IF NOT EXISTS escrow_deals (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL UNIQUE,

  -- Parties
  buyer_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_email TEXT NOT NULL,

  -- Amounts (in USDC)
  amount DECIMAL(20, 2) NOT NULL,
  platform_fee DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(20, 2) NOT NULL,

  -- Circle Wallet
  escrow_wallet_id TEXT NOT NULL UNIQUE,
  escrow_wallet_address TEXT NOT NULL UNIQUE,
  funding_transfer_id TEXT,
  release_transfer_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'created' CHECK (
    status IN ('created', 'funded', 'released', 'disputed', 'refunded', 'cancelled')
  ),

  -- Party Wallets
  buyer_wallet_id TEXT,
  buyer_wallet_address TEXT,
  seller_wallet_id TEXT,
  seller_wallet_address TEXT,

  -- Details
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  funded_at TIMESTAMP,
  released_at TIMESTAMP,
  refunded_at TIMESTAMP,
  disputed_at TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escrow_deals_deal_id ON escrow_deals(deal_id);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_buyer ON escrow_deals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_seller ON escrow_deals(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_status ON escrow_deals(status);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_created ON escrow_deals(created_at DESC);

-- ESCROW MILESTONES
-- Multi-stage payments with approval workflow
CREATE TABLE IF NOT EXISTS escrow_milestones (
  id TEXT PRIMARY KEY,
  escrow_id TEXT NOT NULL REFERENCES escrow_deals(id) ON DELETE CASCADE,

  -- Milestone details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  due_date TIMESTAMP,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'completed', 'approved', 'rejected', 'released')
  ),

  -- Deliverables
  deliverables JSONB DEFAULT '[]',
  completed_deliverables JSONB DEFAULT '[]',

  -- Approval
  approved_by TEXT,
  approved_at TIMESTAMP,
  rejected_by TEXT,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,

  -- Release
  released_at TIMESTAMP,
  release_transfer_id TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow ON escrow_milestones(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_status ON escrow_milestones(status);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_due_date ON escrow_milestones(due_date);

-- ESCROW DISPUTES
-- Dispute resolution system
CREATE TABLE IF NOT EXISTS escrow_disputes (
  id TEXT PRIMARY KEY,
  escrow_id TEXT NOT NULL REFERENCES escrow_deals(id) ON DELETE CASCADE,

  -- Filer
  filed_by TEXT NOT NULL CHECK (filed_by IN ('buyer', 'seller')),
  filed_by_user_id TEXT NOT NULL,

  -- Dispute details
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'investigating', 'resolved', 'withdrawn')
  ),
  resolution TEXT CHECK (
    resolution IN ('buyer_favor', 'seller_favor', 'split', 'withdrawn')
  ),

  -- Resolution details
  resolved_by TEXT,
  resolution_notes TEXT,
  buyer_refund_amount DECIMAL(20, 2),
  seller_release_amount DECIMAL(20, 2),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  investigated_at TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escrow_disputes_escrow ON escrow_disputes(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_disputes_status ON escrow_disputes(status);
CREATE INDEX IF NOT EXISTS idx_escrow_disputes_filed_by ON escrow_disputes(filed_by_user_id);

-- ESCROW TRANSACTIONS
-- All fund movements in/out of escrow
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id TEXT PRIMARY KEY,
  escrow_id TEXT NOT NULL REFERENCES escrow_deals(id) ON DELETE CASCADE,

  -- Transaction details
  type TEXT NOT NULL CHECK (
    type IN ('fund', 'release', 'refund', 'fee', 'milestone_release')
  ),
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDC',

  -- Circle
  circle_transfer_id TEXT NOT NULL,
  circle_transaction_hash TEXT,

  -- Wallets
  from_wallet_id TEXT,
  from_wallet_address TEXT,
  to_wallet_id TEXT,
  to_wallet_address TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),

  -- Error handling
  error_code TEXT,
  error_message TEXT,

  -- Metadata
  milestone_id TEXT REFERENCES escrow_milestones(id),
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_escrow ON escrow_transactions(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_type ON escrow_transactions(type);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_circle_id ON escrow_transactions(circle_transfer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_milestone ON escrow_transactions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_created ON escrow_transactions(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_escrow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_escrow_deals_updated_at
  BEFORE UPDATE ON escrow_deals
  FOR EACH ROW EXECUTE FUNCTION update_escrow_updated_at();

CREATE TRIGGER update_escrow_milestones_updated_at
  BEFORE UPDATE ON escrow_milestones
  FOR EACH ROW EXECUTE FUNCTION update_escrow_updated_at();

CREATE TRIGGER update_escrow_disputes_updated_at
  BEFORE UPDATE ON escrow_disputes
  FOR EACH ROW EXECUTE FUNCTION update_escrow_updated_at();

CREATE TRIGGER update_escrow_transactions_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION update_escrow_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active escrows dashboard
CREATE OR REPLACE VIEW escrow_dashboard AS
SELECT
  e.id,
  e.deal_id,
  e.buyer_id,
  e.seller_id,
  e.amount,
  e.platform_fee,
  e.total_amount,
  e.status,
  e.created_at,
  e.funded_at,

  -- Milestone progress
  COALESCE(m.total_milestones, 0) AS total_milestones,
  COALESCE(m.completed_milestones, 0) AS completed_milestones,
  COALESCE(m.approved_milestones, 0) AS approved_milestones,
  COALESCE(m.released_milestones, 0) AS released_milestones,

  -- Transaction counts
  COALESCE(t.transaction_count, 0) AS transaction_count,
  COALESCE(t.total_released, 0) AS total_released,
  COALESCE(t.total_refunded, 0) AS total_refunded,

  -- Disputes
  CASE WHEN d.id IS NOT NULL THEN TRUE ELSE FALSE END AS has_dispute,
  d.status AS dispute_status

FROM escrow_deals e

-- Milestones
LEFT JOIN (
  SELECT
    escrow_id,
    COUNT(*) AS total_milestones,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_milestones,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_milestones,
    COUNT(*) FILTER (WHERE status = 'released') AS released_milestones
  FROM escrow_milestones
  GROUP BY escrow_id
) m ON e.id = m.escrow_id

-- Transactions
LEFT JOIN (
  SELECT
    escrow_id,
    COUNT(*) AS transaction_count,
    SUM(amount) FILTER (WHERE type IN ('release', 'milestone_release') AND status = 'completed') AS total_released,
    SUM(amount) FILTER (WHERE type = 'refund' AND status = 'completed') AS total_refunded
  FROM escrow_transactions
  GROUP BY escrow_id
) t ON e.id = t.escrow_id

-- Disputes
LEFT JOIN escrow_disputes d ON e.id = d.escrow_id AND d.status IN ('open', 'investigating')

WHERE e.status IN ('funded', 'disputed')
ORDER BY e.created_at DESC;

-- Pending milestone approvals
CREATE OR REPLACE VIEW pending_milestone_approvals AS
SELECT
  m.*,
  e.deal_id,
  e.buyer_id,
  e.seller_id,
  e.buyer_email,
  e.seller_email,
  e.status AS escrow_status
FROM escrow_milestones m
JOIN escrow_deals e ON m.escrow_id = e.id
WHERE m.status = 'completed'
  AND e.status = 'funded'
ORDER BY m.due_date ASC NULLS LAST, m.created_at ASC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get escrow statistics for a user
CREATE OR REPLACE FUNCTION get_user_escrow_stats(user_id TEXT)
RETURNS TABLE (
  total_escrows BIGINT,
  active_escrows BIGINT,
  completed_escrows BIGINT,
  disputed_escrows BIGINT,
  total_volume DECIMAL,
  as_buyer_volume DECIMAL,
  as_seller_volume DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_escrows,
    COUNT(*) FILTER (WHERE status IN ('funded', 'disputed')) AS active_escrows,
    COUNT(*) FILTER (WHERE status = 'released') AS completed_escrows,
    COUNT(*) FILTER (WHERE status = 'disputed') AS disputed_escrows,
    COALESCE(SUM(amount), 0) AS total_volume,
    COALESCE(SUM(amount) FILTER (WHERE buyer_id = user_id), 0) AS as_buyer_volume,
    COALESCE(SUM(amount) FILTER (WHERE seller_id = user_id), 0) AS as_seller_volume
  FROM escrow_deals
  WHERE buyer_id = user_id OR seller_id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate escrow completion rate for a user
CREATE OR REPLACE FUNCTION get_escrow_completion_rate(user_id TEXT)
RETURNS DECIMAL AS $$
DECLARE
  total_count BIGINT;
  completed_count BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'released')
  INTO total_count, completed_count
  FROM escrow_deals
  WHERE (buyer_id = user_id OR seller_id = user_id)
    AND status IN ('released', 'refunded', 'disputed');

  IF total_count = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((completed_count::DECIMAL / total_count::DECIMAL) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE escrow_deals IS 'Escrow accounts holding USDC until deal delivery confirmation';
COMMENT ON TABLE escrow_milestones IS 'Multi-stage payment milestones with approval workflow';
COMMENT ON TABLE escrow_disputes IS 'Dispute resolution system for escrow deals';
COMMENT ON TABLE escrow_transactions IS 'All fund movements in/out of escrow wallets';

COMMENT ON COLUMN escrow_deals.escrow_wallet_id IS 'Circle wallet ID created for this escrow';
COMMENT ON COLUMN escrow_deals.escrow_wallet_address IS 'Base L2 blockchain address for escrow wallet';
COMMENT ON COLUMN escrow_deals.total_amount IS 'amount + platform_fee - total to be deposited';

COMMENT ON COLUMN escrow_transactions.type IS 'fund: buyer deposits, release: pay seller, refund: return to buyer, fee: platform fee, milestone_release: milestone payment';
COMMENT ON COLUMN escrow_transactions.circle_transfer_id IS 'Circle API transfer ID';
COMMENT ON COLUMN escrow_transactions.circle_transaction_hash IS 'On-chain transaction hash';
