-- ============================================================================
-- WELLS AI FEE TRACKING SCHEMA
-- Tracks 1% fees on all Wells-sourced transactions
-- ============================================================================

-- Main fee tracking table
CREATE TABLE IF NOT EXISTS wells_fees (
  id TEXT PRIMARY KEY,

  -- Source ERP
  erp_system TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT,

  -- Vendor
  vendor_id TEXT,
  vendor_name TEXT,

  -- Amounts
  gross_amount DECIMAL(20, 2) NOT NULL,
  fee_amount DECIMAL(20, 2) NOT NULL,
  fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Wells references
  wells_deal_id TEXT NOT NULL,
  wells_rfq_id TEXT,

  -- Line item data (ERP-specific format)
  line_item_data JSONB DEFAULT '{}',

  -- Payment tracking
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'invoiced', 'paid', 'failed', 'waived')
  ),
  payment_date TIMESTAMP,
  payment_reference TEXT,
  payment_method TEXT,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Prevent duplicate fees per invoice
  UNIQUE(erp_system, invoice_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wells_fees_deal ON wells_fees(wells_deal_id);
CREATE INDEX IF NOT EXISTS idx_wells_fees_rfq ON wells_fees(wells_rfq_id);
CREATE INDEX IF NOT EXISTS idx_wells_fees_status ON wells_fees(payment_status);
CREATE INDEX IF NOT EXISTS idx_wells_fees_erp ON wells_fees(erp_system);
CREATE INDEX IF NOT EXISTS idx_wells_fees_created ON wells_fees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wells_fees_vendor ON wells_fees(vendor_id);

-- Fee payment events (audit trail)
CREATE TABLE IF NOT EXISTS wells_fee_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id TEXT NOT NULL REFERENCES wells_fees(id),
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  amount DECIMAL(20, 2),
  notes TEXT,
  actor TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wells_fee_events_fee ON wells_fee_events(fee_id);
CREATE INDEX IF NOT EXISTS idx_wells_fee_events_type ON wells_fee_events(event_type);

-- Monthly fee summary view
CREATE OR REPLACE VIEW wells_fee_summary AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  erp_system,
  COUNT(*) AS total_fees,
  SUM(gross_amount) AS total_gross_volume,
  SUM(fee_amount) AS total_fee_revenue,
  SUM(fee_amount) FILTER (WHERE payment_status = 'paid') AS collected_fees,
  SUM(fee_amount) FILTER (WHERE payment_status = 'pending') AS pending_fees,
  AVG(fee_percent) AS avg_fee_percent
FROM wells_fees
GROUP BY DATE_TRUNC('month', created_at), erp_system
ORDER BY month DESC, erp_system;

-- Pending fees view (for collections)
CREATE OR REPLACE VIEW wells_pending_fees AS
SELECT
  f.*,
  CURRENT_DATE - DATE(f.created_at) AS days_outstanding
FROM wells_fees f
WHERE f.payment_status = 'pending'
ORDER BY f.created_at ASC;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_wells_fees_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wells_fees_updated_at ON wells_fees;
CREATE TRIGGER update_wells_fees_updated_at
  BEFORE UPDATE ON wells_fees
  FOR EACH ROW EXECUTE FUNCTION update_wells_fees_timestamp();

-- Function to mark fee as paid
CREATE OR REPLACE FUNCTION mark_fee_paid(
  p_fee_id TEXT,
  p_payment_reference TEXT,
  p_payment_method TEXT DEFAULT 'wire'
)
RETURNS wells_fees AS $$
DECLARE
  v_fee wells_fees;
BEGIN
  UPDATE wells_fees
  SET
    payment_status = 'paid',
    payment_date = NOW(),
    payment_reference = p_payment_reference,
    payment_method = p_payment_method
  WHERE id = p_fee_id
  RETURNING * INTO v_fee;

  -- Record event
  INSERT INTO wells_fee_events (fee_id, event_type, old_status, new_status, amount, notes)
  VALUES (p_fee_id, 'payment_received', 'pending', 'paid', v_fee.fee_amount, p_payment_reference);

  RETURN v_fee;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE wells_fees IS 'Tracks 1% fees on all Wells AI-sourced transactions';
COMMENT ON COLUMN wells_fees.line_item_data IS 'ERP-specific line item format for injection';
COMMENT ON COLUMN wells_fees.payment_status IS 'pending=awaiting payment, paid=received, waived=forgiven';
