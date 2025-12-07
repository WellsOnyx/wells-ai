-- ============================================================================
-- WELLS ONYX FEE SYSTEM SCHEMA
-- Success fee capture and tracking
-- Run: psql $POSTGRES_URL < scripts/schema-fees.sql
-- ============================================================================

-- FEES TABLE
-- Track all success fees captured from deals
-- Note: deal_id references either 'deals' or 'escrow_deals' table depending on your setup
CREATE TABLE IF NOT EXISTS fees (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL, -- References deal (no FK constraint for flexibility)
  user_id TEXT, -- Seller who paid the fee (for reporting)

  -- Fee Calculation
  deal_amount DECIMAL(20, 2) NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('standard', 'white-glove', 'complex')),
  fee_percent DECIMAL(5, 2) NOT NULL, -- 1.00, 3.30, 7.70
  fee_amount DECIMAL(20, 2) NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),

  -- Circle Integration
  circle_transfer_id TEXT, -- Transfer ID for fee payment to Wells treasury
  circle_transaction_hash TEXT, -- Blockchain transaction hash

  -- Invoice
  invoice_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  captured_at TIMESTAMP,
  refunded_at TIMESTAMP,

  -- Ensure one fee per deal
  UNIQUE(deal_id)
);

CREATE INDEX IF NOT EXISTS idx_fees_deal_id ON fees(deal_id);
CREATE INDEX IF NOT EXISTS idx_fees_user_id ON fees(user_id);
CREATE INDEX IF NOT EXISTS idx_fees_status ON fees(status);
CREATE INDEX IF NOT EXISTS idx_fees_tier ON fees(tier);
CREATE INDEX IF NOT EXISTS idx_fees_captured_at ON fees(captured_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_fees_created_at ON fees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fees_circle_transfer ON fees(circle_transfer_id);

-- FEE INVOICES TABLE
-- Generated invoices for fee payments
CREATE TABLE IF NOT EXISTS fee_invoices (
  id TEXT PRIMARY KEY,
  fee_id TEXT NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  deal_id TEXT NOT NULL, -- References deal (no FK constraint for flexibility)

  -- Invoice Details
  amount DECIMAL(20, 2) NOT NULL,
  tier TEXT NOT NULL,
  fee_percent DECIMAL(5, 2) NOT NULL,

  -- Parties
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  deal_description TEXT,

  -- Invoice Dates
  issued_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP,
  paid_date TIMESTAMP,

  -- Status
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),

  -- PDF/Document
  pdf_url TEXT,
  invoice_number TEXT, -- Human-readable invoice number

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_invoices_fee_id ON fee_invoices(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_deal_id ON fee_invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_buyer_id ON fee_invoices(buyer_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_seller_id ON fee_invoices(seller_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_status ON fee_invoices(status);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_issued_date ON fee_invoices(issued_date DESC);

-- FEE SPLITS TABLE
-- Track how fees are distributed (for potential revenue sharing in future)
CREATE TABLE IF NOT EXISTS fee_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id TEXT NOT NULL REFERENCES fees(id) ON DELETE CASCADE,

  -- Split Details
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('wells_treasury', 'referral', 'partner', 'affiliate')),
  recipient_id TEXT, -- User ID or partner ID
  recipient_wallet TEXT,

  -- Amount
  split_percent DECIMAL(5, 2) NOT NULL,
  split_amount DECIMAL(20, 2) NOT NULL,

  -- Circle Transfer
  circle_transfer_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'transferred', 'failed')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  transferred_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fee_splits_fee_id ON fee_splits(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_splits_recipient_type ON fee_splits(recipient_type);
CREATE INDEX IF NOT EXISTS idx_fee_splits_recipient_id ON fee_splits(recipient_id);
CREATE INDEX IF NOT EXISTS idx_fee_splits_status ON fee_splits(status);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_fee_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fee_invoices_timestamp
  BEFORE UPDATE ON fee_invoices
  FOR EACH ROW EXECUTE FUNCTION update_fee_invoices_updated_at();

-- Auto-populate user_id from deal when fee is created
CREATE OR REPLACE FUNCTION populate_fee_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT seller_id INTO NEW.user_id
    FROM deals
    WHERE id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fee_user_id
  BEFORE INSERT ON fees
  FOR EACH ROW EXECUTE FUNCTION populate_fee_user_id();

-- Generate sequential invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number = 'WO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON fee_invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Fee summary view for reporting
CREATE OR REPLACE VIEW fee_summary AS
SELECT
  DATE_TRUNC('day', f.captured_at) AS date,
  f.tier,
  COUNT(*) AS fee_count,
  SUM(f.fee_amount) AS total_fees,
  AVG(f.fee_amount) AS avg_fee,
  MIN(f.fee_amount) AS min_fee,
  MAX(f.fee_amount) AS max_fee,
  SUM(f.deal_amount) AS total_deal_volume
FROM fees f
WHERE f.status = 'captured'
GROUP BY DATE_TRUNC('day', f.captured_at), f.tier
ORDER BY date DESC, tier;

-- User fee history view
CREATE OR REPLACE VIEW user_fee_history AS
SELECT
  f.id,
  f.deal_id,
  f.user_id,
  f.deal_amount,
  f.fee_amount,
  f.tier,
  f.fee_percent,
  f.status,
  f.captured_at,
  f.invoice_id,
  d.description AS deal_description,
  d.buyer_id,
  d.seller_id,
  i.invoice_number,
  i.pdf_url AS invoice_url
FROM fees f
INNER JOIN deals d ON f.deal_id = d.id
LEFT JOIN fee_invoices i ON f.invoice_id = i.id
ORDER BY f.captured_at DESC NULLS LAST, f.created_at DESC;

-- Treasury fee revenue view
CREATE OR REPLACE VIEW treasury_fee_revenue AS
SELECT
  DATE_TRUNC('month', f.captured_at) AS month,
  f.tier,
  COUNT(*) AS transaction_count,
  SUM(f.fee_amount) AS total_revenue,
  SUM(f.deal_amount) AS total_deal_volume,
  AVG(f.fee_percent) AS avg_fee_percent
FROM fees f
WHERE f.status = 'captured'
GROUP BY DATE_TRUNC('month', f.captured_at), f.tier
ORDER BY month DESC, tier;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE fees IS 'Success fees captured from completed deals';
COMMENT ON TABLE fee_invoices IS 'Generated invoices for fee payments';
COMMENT ON TABLE fee_splits IS 'Revenue sharing splits for fees (future use)';

COMMENT ON COLUMN fees.tier IS 'standard (1%), white-glove (3.3%), complex (7.7%)';
COMMENT ON COLUMN fees.fee_percent IS 'Percentage as decimal (1.00 = 1%)';
COMMENT ON COLUMN fees.circle_transfer_id IS 'Circle transfer ID for fee payment to Wells treasury';

COMMENT ON COLUMN fee_invoices.invoice_number IS 'Human-readable invoice number (WO-YYYY-XXXXXX)';

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Example fee record (commented out)
-- INSERT INTO fees (id, deal_id, deal_amount, tier, fee_percent, fee_amount, status)
-- VALUES (
--   'fee_test_001',
--   'deal_test_001',
--   10000.00,
--   'standard',
--   1.00,
--   100.00,
--   'captured'
-- );

-- ============================================================================
-- ANALYTICS QUERIES
-- ============================================================================

-- Total fees collected (all time)
-- SELECT SUM(fee_amount) AS total_fees, COUNT(*) AS fee_count FROM fees WHERE status = 'captured';

-- Fees by tier (last 30 days)
-- SELECT tier, COUNT(*) as count, SUM(fee_amount) as total FROM fees
-- WHERE status = 'captured' AND captured_at >= NOW() - INTERVAL '30 days'
-- GROUP BY tier;

-- Top deals by fee amount
-- SELECT deal_id, deal_amount, fee_amount, tier, captured_at FROM fees
-- WHERE status = 'captured'
-- ORDER BY fee_amount DESC
-- LIMIT 10;

-- Revenue by month
-- SELECT * FROM treasury_fee_revenue ORDER BY month DESC LIMIT 12;
