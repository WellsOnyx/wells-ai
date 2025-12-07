-- ============================================================================
-- TRILLION DOLLAR SCALE SCHEMA
-- Infrastructure for capturing $1T in spend in 30 days
-- Run: psql $POSTGRES_URL < scripts/schema-trillion-scale.sql
-- ============================================================================

-- ============================================================================
-- SILENT ACCOUNTS
-- Accounts created automatically - users don't know they exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS silent_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (we figure out who you are)
  email TEXT,
  phone TEXT,
  company_name TEXT,
  ein TEXT,

  -- Derived from transaction data / enrichment
  inferred_industry TEXT,
  inferred_revenue_range TEXT,
  inferred_employee_count TEXT,
  enrichment_data JSONB DEFAULT '{}',

  -- Auto-created wallet (ready to receive instantly)
  wallet_address TEXT UNIQUE NOT NULL,
  wallet_created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Activity tracking
  first_touch TEXT NOT NULL,           -- How they first encountered Wells
  touch_count INTEGER DEFAULT 1,
  total_volume_received DECIMAL(20,2) DEFAULT 0,
  total_volume_sent DECIMAL(20,2) DEFAULT 0,

  -- Activation level
  activation_level TEXT DEFAULT 'ghost'
    CHECK (activation_level IN ('ghost', 'aware', 'active', 'power')),

  -- Network tracking
  parent_account_id UUID REFERENCES silent_accounts(id),
  network_depth INTEGER DEFAULT 0,
  children_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT at_least_one_identifier CHECK (
    email IS NOT NULL OR phone IS NOT NULL OR company_name IS NOT NULL OR ein IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_silent_accounts_email ON silent_accounts(email);
CREATE INDEX IF NOT EXISTS idx_silent_accounts_phone ON silent_accounts(phone);
CREATE INDEX IF NOT EXISTS idx_silent_accounts_ein ON silent_accounts(ein);
CREATE INDEX IF NOT EXISTS idx_silent_accounts_wallet ON silent_accounts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_silent_accounts_activation ON silent_accounts(activation_level);
CREATE INDEX IF NOT EXISTS idx_silent_accounts_parent ON silent_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_silent_accounts_volume ON silent_accounts(total_volume_received DESC);

-- ============================================================================
-- VIRAL PAYMENTS
-- Every payment is an invitation - recipients automatically enrolled
-- ============================================================================

CREATE TABLE IF NOT EXISTS viral_payments (
  id TEXT PRIMARY KEY,

  -- Sender (existing Wells user)
  sender_id TEXT NOT NULL,
  sender_wallet TEXT NOT NULL,

  -- Recipient (may not exist yet - created on demand)
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_company TEXT,
  recipient_wallet TEXT,
  recipient_account_id UUID REFERENCES silent_accounts(id),

  -- Payment details
  amount_usdc DECIMAL(20,2) NOT NULL,
  memo TEXT,
  invoice_id TEXT,

  -- Viral mechanics
  referral_code TEXT NOT NULL,
  claim_url TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'expired', 'returned', 'processing')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,

  -- Fee tracking
  wells_fee DECIMAL(20,2) DEFAULT 0,
  referrer_bonus DECIMAL(20,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_viral_payments_sender ON viral_payments(sender_id);
CREATE INDEX IF NOT EXISTS idx_viral_payments_recipient_email ON viral_payments(recipient_email);
CREATE INDEX IF NOT EXISTS idx_viral_payments_status ON viral_payments(status);
CREATE INDEX IF NOT EXISTS idx_viral_payments_referral ON viral_payments(referral_code);
CREATE INDEX IF NOT EXISTS idx_viral_payments_expires ON viral_payments(expires_at);
CREATE INDEX IF NOT EXISTS idx_viral_payments_created ON viral_payments(created_at DESC);

-- ============================================================================
-- VIRAL EVENTS
-- Track every viral action for optimization
-- ============================================================================

CREATE TABLE IF NOT EXISTS viral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event TEXT NOT NULL,
  data JSONB NOT NULL,

  -- Attribution
  account_id UUID REFERENCES silent_accounts(id),
  referral_code TEXT,
  partner_id UUID,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viral_events_event ON viral_events(event);
CREATE INDEX IF NOT EXISTS idx_viral_events_account ON viral_events(account_id);
CREATE INDEX IF NOT EXISTS idx_viral_events_created ON viral_events(created_at DESC);

-- ============================================================================
-- NETWORK NODES
-- Track network multiplication and viral growth
-- ============================================================================

CREATE TABLE IF NOT EXISTS network_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES silent_accounts(id),

  -- Network position
  depth INTEGER NOT NULL DEFAULT 0,
  parent_id UUID REFERENCES network_nodes(id),
  children_count INTEGER DEFAULT 0,

  -- Network value
  direct_volume DECIMAL(20,2) DEFAULT 0,
  network_volume DECIMAL(20,2) DEFAULT 0,  -- All downstream

  -- Viral metrics
  referrals_sent INTEGER DEFAULT 0,
  referrals_converted INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_network_nodes_parent ON network_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_network_nodes_depth ON network_nodes(depth);
CREATE INDEX IF NOT EXISTS idx_network_nodes_volume ON network_nodes(network_volume DESC);

-- ============================================================================
-- CREDIT LINES
-- Instant credit approval based on transaction history
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES silent_accounts(id),

  -- Credit terms
  credit_limit DECIMAL(20,2) NOT NULL,
  available DECIMAL(20,2) NOT NULL,
  used DECIMAL(20,2) DEFAULT 0,

  -- Pricing
  apr DECIMAL(5,4) NOT NULL,         -- What we charge (e.g., 0.12 = 12%)
  funding_cost DECIMAL(5,4) NOT NULL, -- Our cost of capital
  spread DECIMAL(5,4) NOT NULL,       -- Our margin

  -- Approval
  approval_source TEXT NOT NULL
    CHECK (approval_source IN ('transaction_history', 'erp_data', 'credit_bureau', 'instant', 'manual')),
  approval_data JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'frozen', 'closed', 'pending')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_lines_account ON credit_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_lines_status ON credit_lines(status);
CREATE INDEX IF NOT EXISTS idx_credit_lines_available ON credit_lines(available DESC);

-- ============================================================================
-- CREDIT TRANSACTIONS
-- Track credit usage and repayments
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_line_id UUID NOT NULL REFERENCES credit_lines(id),
  account_id UUID NOT NULL REFERENCES silent_accounts(id),

  -- Transaction
  amount DECIMAL(20,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('draw', 'repayment', 'fee', 'interest')),

  -- Related payment
  payment_id TEXT REFERENCES viral_payments(id),
  invoice_id TEXT,

  -- Due date for draws
  due_date TIMESTAMP,
  paid_date TIMESTAMP,

  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'written_off')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_credit_line ON credit_transactions(credit_line_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_account ON credit_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_due_date ON credit_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_credit_tx_status ON credit_transactions(status);

-- ============================================================================
-- WHITE LABEL PARTNERS
-- Other platforms embed Wells treasury
-- ============================================================================

CREATE TABLE IF NOT EXISTS white_label_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Partner info
  company_name TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  contact_email TEXT,

  -- API access
  api_key TEXT UNIQUE NOT NULL,
  api_key_hash TEXT NOT NULL,
  webhook_url TEXT,
  webhook_secret TEXT,

  -- Revenue share
  revenue_share_percent DECIMAL(5,2) NOT NULL,  -- Partner's cut (e.g., 20.00 = 20%)

  -- Volume tracking
  total_volume DECIMAL(24,2) DEFAULT 0,
  monthly_volume DECIMAL(24,2) DEFAULT 0,
  transaction_count BIGINT DEFAULT 0,

  -- Fees earned
  total_fees_collected DECIMAL(20,2) DEFAULT 0,
  total_partner_share DECIMAL(20,2) DEFAULT 0,
  total_wells_share DECIMAL(20,2) DEFAULT 0,

  -- Rate limits
  rate_limit_per_minute INTEGER DEFAULT 1000,
  rate_limit_per_day INTEGER DEFAULT 100000,

  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('active', 'suspended', 'pending', 'terminated')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_white_label_api_key ON white_label_partners(api_key);
CREATE INDEX IF NOT EXISTS idx_white_label_domain ON white_label_partners(domain);
CREATE INDEX IF NOT EXISTS idx_white_label_status ON white_label_partners(status);
CREATE INDEX IF NOT EXISTS idx_white_label_volume ON white_label_partners(total_volume DESC);

-- ============================================================================
-- WHITE LABEL TRANSACTIONS
-- Transactions processed through white-label partners
-- ============================================================================

CREATE TABLE IF NOT EXISTS white_label_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES white_label_partners(id),

  -- Transaction details
  external_id TEXT,  -- Partner's transaction ID
  sender_external_id TEXT NOT NULL,
  recipient_external_id TEXT NOT NULL,
  amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USDC',

  -- Silent accounts created
  sender_account_id UUID REFERENCES silent_accounts(id),
  recipient_account_id UUID REFERENCES silent_accounts(id),

  -- Fees
  wells_fee DECIMAL(20,2) NOT NULL,
  partner_share DECIMAL(20,2) NOT NULL,
  wells_net DECIMAL(20,2) NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wl_tx_partner ON white_label_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_wl_tx_external ON white_label_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_wl_tx_status ON white_label_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wl_tx_created ON white_label_transactions(created_at DESC);

-- ============================================================================
-- ERP INTERCEPTS
-- Capture entire spend automatically from connected ERPs
-- ============================================================================

CREATE TABLE IF NOT EXISTS erp_intercepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES silent_accounts(id),

  -- ERP info
  erp_type TEXT NOT NULL,  -- quickbooks, xero, netsuite, sap, etc.
  erp_connection_id TEXT NOT NULL,

  -- Invoice/Bill data
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'bill', 'payment', 'expense')),
  external_id TEXT NOT NULL,
  vendor_name TEXT,
  vendor_email TEXT,
  vendor_account_id UUID REFERENCES silent_accounts(id),

  -- Amounts
  amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  due_date TIMESTAMP,

  -- Intercept status
  intercept_status TEXT DEFAULT 'detected'
    CHECK (intercept_status IN ('detected', 'pending_approval', 'approved', 'paid', 'skipped')),

  -- Payment via Wells
  wells_payment_id TEXT REFERENCES viral_payments(id),
  paid_at TIMESTAMP,

  -- Original data
  raw_data JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_intercepts_account ON erp_intercepts(account_id);
CREATE INDEX IF NOT EXISTS idx_erp_intercepts_vendor ON erp_intercepts(vendor_account_id);
CREATE INDEX IF NOT EXISTS idx_erp_intercepts_status ON erp_intercepts(intercept_status);
CREATE INDEX IF NOT EXISTS idx_erp_intercepts_due ON erp_intercepts(due_date);
CREATE INDEX IF NOT EXISTS idx_erp_intercepts_amount ON erp_intercepts(amount DESC);

-- ============================================================================
-- SCALE METRICS (Materialized for speed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scale_metrics_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_time TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Account metrics
  total_accounts BIGINT DEFAULT 0,
  ghost_accounts BIGINT DEFAULT 0,
  aware_accounts BIGINT DEFAULT 0,
  active_accounts BIGINT DEFAULT 0,
  power_accounts BIGINT DEFAULT 0,

  -- Volume metrics
  total_volume DECIMAL(24,2) DEFAULT 0,
  daily_volume DECIMAL(24,2) DEFAULT 0,
  weekly_volume DECIMAL(24,2) DEFAULT 0,
  monthly_volume DECIMAL(24,2) DEFAULT 0,

  -- Viral metrics
  viral_coefficient DECIMAL(8,6) DEFAULT 0,
  avg_network_depth DECIMAL(8,4) DEFAULT 0,

  -- Fee metrics
  total_fees DECIMAL(20,2) DEFAULT 0,
  daily_fees DECIMAL(20,2) DEFAULT 0,

  -- Credit metrics
  total_credit_extended DECIMAL(24,2) DEFAULT 0,
  total_credit_outstanding DECIMAL(24,2) DEFAULT 0,

  -- White label metrics
  total_partner_volume DECIMAL(24,2) DEFAULT 0,
  active_partners INTEGER DEFAULT 0,

  -- Projections
  projected_30_day_volume DECIMAL(24,2) DEFAULT 0,
  projected_30_day_accounts BIGINT DEFAULT 0,

  UNIQUE(snapshot_time)
);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshot_time ON scale_metrics_snapshot(snapshot_time DESC);

-- ============================================================================
-- TRILLION DOLLAR TRACKER
-- Daily progress toward $1T
-- ============================================================================

CREATE TABLE IF NOT EXISTS trillion_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_date DATE NOT NULL UNIQUE,

  -- Daily metrics
  daily_volume DECIMAL(24,2) DEFAULT 0,
  cumulative_volume DECIMAL(24,2) DEFAULT 0,

  -- Target comparison
  target_volume DECIMAL(24,2) NOT NULL,
  variance DECIMAL(24,2) DEFAULT 0,
  on_track BOOLEAN DEFAULT FALSE,

  -- Contributing factors
  new_accounts INTEGER DEFAULT 0,
  viral_payments_created INTEGER DEFAULT 0,
  viral_payments_claimed INTEGER DEFAULT 0,
  erp_intercepts_processed INTEGER DEFAULT 0,
  white_label_volume DECIMAL(24,2) DEFAULT 0,

  -- Run rates
  daily_run_rate DECIMAL(24,2) DEFAULT 0,
  required_run_rate DECIMAL(24,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trillion_tracker_date ON trillion_tracker(tracking_date DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update silent account volumes on viral payment claim
CREATE OR REPLACE FUNCTION update_account_volumes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'claimed' AND OLD.status = 'pending' THEN
    -- Update sender's sent volume
    UPDATE silent_accounts
    SET total_volume_sent = total_volume_sent + NEW.amount_usdc,
        last_activity_at = NOW()
    WHERE wallet_address = NEW.sender_wallet;

    -- Update recipient's received volume
    UPDATE silent_accounts
    SET total_volume_received = total_volume_received + NEW.amount_usdc,
        last_activity_at = NOW(),
        activation_level = CASE
          WHEN activation_level = 'ghost' THEN 'aware'
          ELSE activation_level
        END
    WHERE wallet_address = NEW.recipient_wallet;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_volumes_on_claim
  AFTER UPDATE ON viral_payments
  FOR EACH ROW
  WHEN (NEW.status = 'claimed')
  EXECUTE FUNCTION update_account_volumes();

-- Update network node volumes
CREATE OR REPLACE FUNCTION propagate_network_volume()
RETURNS TRIGGER AS $$
DECLARE
  current_node_id UUID;
  parent_node_id UUID;
BEGIN
  -- Get the node for this account
  SELECT id, parent_id INTO current_node_id, parent_node_id
  FROM network_nodes
  WHERE account_id = NEW.id;

  -- Propagate volume up the tree
  WHILE parent_node_id IS NOT NULL LOOP
    UPDATE network_nodes
    SET network_volume = network_volume + (NEW.total_volume_sent + NEW.total_volume_received) -
                         (OLD.total_volume_sent + OLD.total_volume_received),
        updated_at = NOW()
    WHERE id = parent_node_id;

    SELECT parent_id INTO parent_node_id
    FROM network_nodes
    WHERE id = parent_node_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER propagate_volume_changes
  AFTER UPDATE ON silent_accounts
  FOR EACH ROW
  WHEN (NEW.total_volume_sent != OLD.total_volume_sent OR
        NEW.total_volume_received != OLD.total_volume_received)
  EXECUTE FUNCTION propagate_network_volume();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Real-time scale dashboard
CREATE OR REPLACE VIEW scale_dashboard AS
SELECT
  (SELECT COUNT(*) FROM silent_accounts) AS total_accounts,
  (SELECT COUNT(*) FROM silent_accounts WHERE activation_level = 'ghost') AS ghost_accounts,
  (SELECT COUNT(*) FROM silent_accounts WHERE activation_level = 'aware') AS aware_accounts,
  (SELECT COUNT(*) FROM silent_accounts WHERE activation_level = 'active') AS active_accounts,
  (SELECT COUNT(*) FROM silent_accounts WHERE activation_level = 'power') AS power_accounts,

  (SELECT COALESCE(SUM(amount_usdc), 0) FROM viral_payments WHERE status = 'claimed') AS total_claimed_volume,
  (SELECT COALESCE(SUM(amount_usdc), 0) FROM viral_payments
   WHERE status = 'claimed' AND claimed_at > NOW() - INTERVAL '24 hours') AS daily_volume,
  (SELECT COALESCE(SUM(amount_usdc), 0) FROM viral_payments
   WHERE status = 'claimed' AND claimed_at > NOW() - INTERVAL '7 days') AS weekly_volume,

  (SELECT COUNT(*) FROM viral_payments WHERE status = 'pending') AS pending_payments,
  (SELECT COALESCE(SUM(amount_usdc), 0) FROM viral_payments WHERE status = 'pending') AS pending_volume,

  (SELECT COUNT(*) FROM white_label_partners WHERE status = 'active') AS active_partners,
  (SELECT COALESCE(SUM(total_volume), 0) FROM white_label_partners) AS partner_volume,

  (SELECT COALESCE(SUM(used), 0) FROM credit_lines WHERE status = 'active') AS credit_outstanding;

-- Network growth view
CREATE OR REPLACE VIEW network_growth AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS new_accounts,
  COUNT(*) FILTER (WHERE parent_account_id IS NOT NULL) AS referred_accounts,
  AVG(network_depth) AS avg_depth
FROM silent_accounts
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Viral funnel
CREATE OR REPLACE VIEW viral_funnel AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS payments_created,
  COUNT(*) FILTER (WHERE status = 'claimed') AS payments_claimed,
  COUNT(*) FILTER (WHERE status = 'expired') AS payments_expired,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'claimed')::DECIMAL /
    NULLIF(COUNT(*), 0) * 100, 2
  ) AS claim_rate_percent,
  COALESCE(SUM(amount_usdc) FILTER (WHERE status = 'claimed'), 0) AS claimed_volume
FROM viral_payments
GROUP BY DATE(created_at)
ORDER BY date DESC;
