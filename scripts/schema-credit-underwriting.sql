-- Credit Underwriting Schema
-- Wells AI Credit Lines: Instant approval based on transaction visibility

-- Credit applications tracking
CREATE TABLE IF NOT EXISTS credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, activated

  -- Application data
  requested_amount DECIMAL(15,2),
  approved_amount DECIMAL(15,2),
  approved_apr DECIMAL(5,2),

  -- Connected accounts
  plaid_access_token TEXT,
  plaid_item_id TEXT,
  codat_company_id TEXT,

  -- Underwriting results
  credit_score INTEGER, -- 0-1000
  risk_tier TEXT, -- prime, near_prime, subprime

  -- Decision metadata
  decision_factors JSONB, -- detailed breakdown
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Underwriting data snapshots
CREATE TABLE IF NOT EXISTS underwriting_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL,

  -- Data source
  data_source TEXT NOT NULL, -- plaid, codat, wells_transactions
  data_type TEXT NOT NULL, -- bank_transactions, financials, metrics

  -- Snapshot data
  raw_data JSONB NOT NULL,

  -- Calculated metrics
  metrics JSONB,

  -- Timestamps
  data_period_start DATE,
  data_period_end DATE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_application FOREIGN KEY (application_id) REFERENCES credit_applications(id)
);

-- Credit lines (main table - may already exist, adding if not)
CREATE TABLE IF NOT EXISTS credit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  application_id UUID,

  -- Credit terms
  credit_limit DECIMAL(15,2) NOT NULL,
  available_credit DECIMAL(15,2) NOT NULL,
  apr DECIMAL(5,2) NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, closed

  -- Risk management
  risk_tier TEXT NOT NULL,
  auto_pay_enabled BOOLEAN DEFAULT false,
  auto_pay_account_id TEXT,

  -- Monitoring
  last_review_date TIMESTAMPTZ,
  next_review_date TIMESTAMPTZ,

  -- Timestamps
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_application FOREIGN KEY (application_id) REFERENCES credit_applications(id)
);

-- Credit draws (when customer uses credit)
CREATE TABLE IF NOT EXISTS credit_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_line_id UUID NOT NULL,

  -- Draw details
  amount DECIMAL(15,2) NOT NULL,
  purpose TEXT, -- equipment, inventory, payroll, general

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, disbursed, failed

  -- Disbursement
  disbursed_to_account TEXT,
  disbursed_at TIMESTAMPTZ,

  -- Metadata
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_credit_line FOREIGN KEY (credit_line_id) REFERENCES credit_lines(id)
);

-- Credit payments
CREATE TABLE IF NOT EXISTS credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_line_id UUID NOT NULL,

  -- Payment details
  amount DECIMAL(15,2) NOT NULL,
  principal_amount DECIMAL(15,2) NOT NULL,
  interest_amount DECIMAL(15,2) NOT NULL,

  -- Payment method
  payment_method TEXT, -- ach, intercept, manual
  payment_source_account TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed

  -- Timestamps
  scheduled_date DATE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_credit_line FOREIGN KEY (credit_line_id) REFERENCES credit_lines(id)
);

-- Credit transactions (legacy support - consolidated view)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_line_id UUID NOT NULL,

  -- Transaction details
  transaction_type TEXT NOT NULL, -- draw, payment, fee, interest
  amount DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,

  -- References
  draw_id UUID,
  payment_id UUID,

  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_credit_line FOREIGN KEY (credit_line_id) REFERENCES credit_lines(id),
  CONSTRAINT fk_draw FOREIGN KEY (draw_id) REFERENCES credit_draws(id),
  CONSTRAINT fk_payment FOREIGN KEY (payment_id) REFERENCES credit_payments(id)
);

-- Payment intercepts (Wells advantage: we can intercept incoming payments)
CREATE TABLE IF NOT EXISTS payment_intercepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_line_id UUID NOT NULL,

  -- Intercept rule
  intercept_percentage DECIMAL(5,2) NOT NULL, -- % of incoming to auto-apply
  min_intercept_amount DECIMAL(15,2),
  max_intercept_amount DECIMAL(15,2),

  -- Status
  enabled BOOLEAN DEFAULT true,

  -- Statistics
  total_intercepted DECIMAL(15,2) DEFAULT 0,
  intercept_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,

  CONSTRAINT fk_credit_line FOREIGN KEY (credit_line_id) REFERENCES credit_lines(id)
);

-- Credit alerts and monitoring
CREATE TABLE IF NOT EXISTS credit_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_line_id UUID NOT NULL,

  -- Alert details
  alert_type TEXT NOT NULL, -- payment_due, missed_payment, limit_exceeded, risk_flag
  severity TEXT NOT NULL, -- info, warning, critical
  message TEXT NOT NULL,

  -- Status
  acknowledged BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  CONSTRAINT fk_credit_line FOREIGN KEY (credit_line_id) REFERENCES credit_lines(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_applications_user ON credit_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_applications_status ON credit_applications(status);
CREATE INDEX IF NOT EXISTS idx_underwriting_data_application ON underwriting_data(application_id);
CREATE INDEX IF NOT EXISTS idx_credit_lines_user ON credit_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_lines_status ON credit_lines(status);
CREATE INDEX IF NOT EXISTS idx_credit_draws_credit_line ON credit_draws(credit_line_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_credit_line ON credit_payments(credit_line_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_credit_line ON credit_transactions(credit_line_id);
CREATE INDEX IF NOT EXISTS idx_payment_intercepts_credit_line ON payment_intercepts(credit_line_id);
CREATE INDEX IF NOT EXISTS idx_credit_alerts_credit_line ON credit_alerts(credit_line_id);

-- Views for quick access
CREATE OR REPLACE VIEW credit_line_summary AS
SELECT
  cl.id,
  cl.user_id,
  cl.credit_limit,
  cl.available_credit,
  cl.credit_limit - cl.available_credit as used_credit,
  cl.apr,
  cl.status,
  cl.risk_tier,
  COUNT(DISTINCT cd.id) as total_draws,
  COUNT(DISTINCT cp.id) as total_payments,
  COALESCE(SUM(CASE WHEN cp.status = 'completed' THEN cp.amount ELSE 0 END), 0) as total_paid,
  MAX(cp.processed_at) as last_payment_date
FROM credit_lines cl
LEFT JOIN credit_draws cd ON cd.credit_line_id = cl.id
LEFT JOIN credit_payments cp ON cp.credit_line_id = cl.id
GROUP BY cl.id;
