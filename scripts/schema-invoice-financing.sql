-- ============================================================================
-- INVOICE FINANCING ENGINE
-- "Get Paid Today. Pay Later. Everyone Wins."
-- ============================================================================
--
-- THE $3 TRILLION OPPORTUNITY:
-- B2B invoices typically have NET30-90 terms. Suppliers need cash now.
-- Buyers want to extend terms. We sit in the middle and make everyone happy.
--
-- THE MODEL:
-- 1. Supplier ships goods, generates invoice
-- 2. Supplier requests early payment (factoring)
-- 3. Wells AI pays supplier immediately from G&V treasury
-- 4. Buyer pays Wells on original terms (NET30/60/90)
-- 5. Spread = Wells revenue + GRAIN rewards for early payment
--
-- DYNAMIC DISCOUNTING:
-- "Pay in 10 days, save 2%"
-- "Pay in 20 days, save 1%"
-- "Pay on time, earn GRAIN"
--
-- ============================================================================

-- ============================================================================
-- FINANCING PROGRAMS & LIMITS
-- ============================================================================

-- Customer financing programs (buyers)
CREATE TABLE IF NOT EXISTS financing_programs_buyer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES erp_customers(id),

  -- Program terms
  program_name VARCHAR(100) NOT NULL,
  program_type VARCHAR(30) NOT NULL CHECK (program_type IN (
    'reverse_factoring',  -- Buyer-led, supplier benefits
    'dynamic_discounting', -- Early payment discounts
    'supply_chain_finance' -- Full program
  )),

  -- Credit limits
  credit_limit DECIMAL(20,2) NOT NULL,
  credit_used DECIMAL(20,2) DEFAULT 0,
  credit_available DECIMAL(20,2) GENERATED ALWAYS AS (credit_limit - credit_used) STORED,

  -- Terms
  standard_payment_days INTEGER DEFAULT 30,
  extended_payment_days INTEGER DEFAULT 60, -- What we offer
  max_extension_days INTEGER DEFAULT 90,

  -- Pricing (annual percentage rate)
  base_apr DECIMAL(6,3) DEFAULT 8.000, -- 8% APR base
  risk_premium DECIMAL(6,3) DEFAULT 0, -- Added based on credit
  effective_apr DECIMAL(6,3) GENERATED ALWAYS AS (base_apr + risk_premium) STORED,

  -- Fees
  platform_fee_pct DECIMAL(5,3) DEFAULT 0.500, -- 0.5% platform fee

  -- GRAIN rewards
  grain_reward_enabled BOOLEAN DEFAULT TRUE,
  grain_reward_rate DECIMAL(10,4) DEFAULT 1.0, -- GRAIN per $1000 financed

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'pending_approval', 'active', 'suspended', 'closed'
  )),
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(100),

  -- Risk assessment
  credit_score INTEGER,
  risk_rating VARCHAR(10) CHECK (risk_rating IN ('AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'C', 'D')),
  last_risk_review TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financing_buyer_customer ON financing_programs_buyer(customer_id);

-- Supplier financing programs (sellers)
CREATE TABLE IF NOT EXISTS financing_programs_supplier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_network(id),

  -- Program terms
  program_name VARCHAR(100) NOT NULL,
  program_type VARCHAR(30) NOT NULL CHECK (program_type IN (
    'factoring',          -- Sell invoices at discount
    'early_payment',      -- Get paid early, small fee
    'revenue_advance'     -- Advance against expected revenue
  )),

  -- Limits
  advance_limit DECIMAL(20,2) NOT NULL,
  advance_used DECIMAL(20,2) DEFAULT 0,
  advance_available DECIMAL(20,2) GENERATED ALWAYS AS (advance_limit - advance_used) STORED,

  -- Advance rates
  advance_rate_pct DECIMAL(5,2) DEFAULT 95.00, -- Pay 95% upfront
  reserve_rate_pct DECIMAL(5,2) DEFAULT 5.00,  -- Hold 5% until buyer pays

  -- Pricing (discount from invoice)
  discount_rate_pct DECIMAL(6,3) DEFAULT 2.000, -- 2% discount for immediate
  per_day_rate DECIMAL(6,4) DEFAULT 0.0333,     -- 0.033% per day (~1%/month)

  -- Payment speed
  payment_speed VARCHAR(20) DEFAULT 'same_day' CHECK (payment_speed IN (
    'same_day', 'next_day', 't_plus_2'
  )),

  -- GRAIN rewards
  grain_reward_enabled BOOLEAN DEFAULT TRUE,
  grain_bonus_rate DECIMAL(10,4) DEFAULT 0.5, -- Bonus GRAIN for using financing

  -- Status
  status VARCHAR(20) DEFAULT 'active',

  -- Performance
  invoices_financed INTEGER DEFAULT 0,
  total_volume_financed DECIMAL(20,2) DEFAULT 0,
  avg_days_to_collection INTEGER,
  default_rate_pct DECIMAL(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financing_supplier ON financing_programs_supplier(supplier_id);

-- ============================================================================
-- INVOICES & FINANCING REQUESTS
-- ============================================================================

-- Invoices eligible for financing
CREATE TABLE IF NOT EXISTS financeable_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  order_id UUID REFERENCES intercept_orders(id),

  -- Parties
  buyer_id UUID NOT NULL REFERENCES erp_customers(id),
  supplier_id UUID NOT NULL REFERENCES supplier_network(id),

  -- Invoice details
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,

  -- Amounts
  invoice_amount DECIMAL(20,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- Payment terms
  payment_terms VARCHAR(50), -- NET30, NET60, etc.
  -- Note: days_until_due computed at query time, not stored (CURRENT_DATE isn't immutable)

  -- Financing status
  financing_status VARCHAR(30) DEFAULT 'eligible' CHECK (financing_status IN (
    'not_eligible',   -- Doesn't qualify
    'eligible',       -- Can be financed
    'requested',      -- Supplier requested financing
    'approved',       -- Approved for financing
    'funded',         -- Money sent to supplier
    'collecting',     -- Waiting for buyer payment
    'collected',      -- Buyer paid
    'defaulted'       -- Buyer didn't pay
  )),

  -- Financing details (populated when financed)
  financed_at TIMESTAMPTZ,
  advance_amount DECIMAL(20,2),    -- What supplier received
  reserve_amount DECIMAL(20,2),    -- Held until collection
  discount_amount DECIMAL(20,2),   -- Our fee

  -- Collection
  collected_at TIMESTAMPTZ,
  collected_amount DECIMAL(20,2),
  reserve_released_at TIMESTAMPTZ,

  -- Dynamic discount offers
  early_payment_offers JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (buyer_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_buyer ON financeable_invoices(buyer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON financeable_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON financeable_invoices(financing_status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON financeable_invoices(due_date);

-- Financing transactions ledger
CREATE TABLE IF NOT EXISTS financing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES financeable_invoices(id),

  -- Transaction type
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'advance',          -- Money to supplier
    'discount_fee',     -- Our cut
    'platform_fee',     -- Platform fee
    'reserve_hold',     -- Reserve held
    'buyer_payment',    -- Buyer pays us
    'reserve_release',  -- Reserve back to supplier
    'grain_reward',     -- GRAIN issued
    'late_fee',         -- Late payment fee
    'write_off'         -- Bad debt
  )),

  -- Direction
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('credit', 'debit')),

  -- Amounts
  amount DECIMAL(20,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- Parties
  from_account VARCHAR(100),
  to_account VARCHAR(100),

  -- Reference
  reference VARCHAR(255),
  notes TEXT,

  -- G&V integration
  gv_transaction_id UUID, -- Link to Grain & Vault ledger
  grain_amount DECIMAL(20,4), -- If GRAIN was involved

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_invoice ON financing_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_type ON financing_transactions(transaction_type);

-- ============================================================================
-- DYNAMIC DISCOUNTING
-- ============================================================================

-- Early payment discount offers
CREATE TABLE IF NOT EXISTS early_payment_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES financeable_invoices(id),

  -- Offer terms
  discount_pct DECIMAL(5,3) NOT NULL,    -- e.g., 2.000 for 2%
  discount_amount DECIMAL(20,2) NOT NULL,

  -- Payment deadline
  pay_by_date DATE NOT NULL,
  days_early INTEGER NOT NULL,

  -- What buyer pays
  original_amount DECIMAL(20,2) NOT NULL,
  discounted_amount DECIMAL(20,2) NOT NULL,

  -- GRAIN bonus for accepting
  grain_bonus INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'accepted', 'expired', 'cancelled'
  )),

  -- Acceptance
  accepted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_invoice ON early_payment_offers(invoice_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON early_payment_offers(status);

-- Standard discount schedule (template)
CREATE TABLE IF NOT EXISTS discount_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Can be global or customer-specific
  customer_id UUID REFERENCES erp_customers(id), -- NULL = global default

  name VARCHAR(100) NOT NULL,

  -- Tiers (JSON array of {days_early, discount_pct, grain_bonus})
  tiers JSONB NOT NULL DEFAULT '[
    {"days_early": 30, "discount_pct": 2.0, "grain_bonus": 100},
    {"days_early": 20, "discount_pct": 1.5, "grain_bonus": 75},
    {"days_early": 10, "discount_pct": 1.0, "grain_bonus": 50},
    {"days_early": 5, "discount_pct": 0.5, "grain_bonus": 25}
  ]',

  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTIONS: FINANCING OPERATIONS
-- ============================================================================

-- Request financing for an invoice (supplier action)
CREATE OR REPLACE FUNCTION request_invoice_financing(
  p_invoice_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  advance_amount DECIMAL(20,2),
  reserve_amount DECIMAL(20,2),
  discount_amount DECIMAL(20,2),
  message TEXT
) AS $$
DECLARE
  v_invoice RECORD;
  v_program RECORD;
  v_advance DECIMAL(20,2);
  v_reserve DECIMAL(20,2);
  v_discount DECIMAL(20,2);
  v_days INTEGER;
BEGIN
  -- Get invoice
  SELECT * INTO v_invoice FROM financeable_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 'Invoice not found'::TEXT;
    RETURN;
  END IF;

  -- Check eligibility
  IF v_invoice.financing_status != 'eligible' THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL,
      ('Invoice not eligible: ' || v_invoice.financing_status)::TEXT;
    RETURN;
  END IF;

  -- Get supplier's financing program
  SELECT * INTO v_program FROM financing_programs_supplier
  WHERE supplier_id = v_invoice.supplier_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 'No financing program'::TEXT;
    RETURN;
  END IF;

  -- Check limits
  IF v_invoice.invoice_amount > v_program.advance_available THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 'Exceeds available limit'::TEXT;
    RETURN;
  END IF;

  -- Calculate days until due (computed at runtime since CURRENT_DATE isn't immutable for GENERATED cols)
  v_days := GREATEST(0, v_invoice.due_date - CURRENT_DATE);
  v_discount := v_invoice.invoice_amount * (v_program.discount_rate_pct / 100) +
                v_invoice.invoice_amount * (v_program.per_day_rate / 100) * v_days;
  v_reserve := v_invoice.invoice_amount * (v_program.reserve_rate_pct / 100);
  v_advance := v_invoice.invoice_amount - v_discount - v_reserve;

  -- Update invoice
  UPDATE financeable_invoices SET
    financing_status = 'approved',
    advance_amount = v_advance,
    reserve_amount = v_reserve,
    discount_amount = v_discount,
    updated_at = NOW()
  WHERE id = p_invoice_id;

  -- Update supplier program usage
  UPDATE financing_programs_supplier SET
    advance_used = advance_used + v_invoice.invoice_amount,
    updated_at = NOW()
  WHERE id = v_program.id;

  RETURN QUERY SELECT TRUE, v_advance, v_reserve, v_discount,
    'Financing approved - ready for funding'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Fund an approved invoice (money to supplier)
CREATE OR REPLACE FUNCTION fund_invoice(
  p_invoice_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  transaction_id UUID,
  amount_funded DECIMAL(20,2),
  grain_earned DECIMAL(20,4),
  message TEXT
) AS $$
DECLARE
  v_invoice RECORD;
  v_tx_id UUID;
  v_grain DECIMAL(20,4) := 0;
BEGIN
  -- Get invoice
  SELECT * INTO v_invoice FROM financeable_invoices WHERE id = p_invoice_id;
  IF NOT FOUND OR v_invoice.financing_status != 'approved' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 'Invoice not ready for funding'::TEXT;
    RETURN;
  END IF;

  -- Record advance transaction
  INSERT INTO financing_transactions (
    invoice_id, transaction_type, direction, amount, from_account, to_account, reference
  ) VALUES (
    p_invoice_id, 'advance', 'debit', v_invoice.advance_amount,
    'wells_treasury', 'supplier_' || v_invoice.supplier_id::TEXT,
    'Advance for invoice ' || v_invoice.invoice_number
  )
  RETURNING id INTO v_tx_id;

  -- Record discount fee
  INSERT INTO financing_transactions (
    invoice_id, transaction_type, direction, amount, from_account, to_account
  ) VALUES (
    p_invoice_id, 'discount_fee', 'credit', v_invoice.discount_amount,
    'supplier_' || v_invoice.supplier_id::TEXT, 'wells_revenue'
  );

  -- Record reserve hold
  INSERT INTO financing_transactions (
    invoice_id, transaction_type, direction, amount, from_account, to_account
  ) VALUES (
    p_invoice_id, 'reserve_hold', 'debit', v_invoice.reserve_amount,
    'wells_treasury', 'reserve_' || v_invoice.supplier_id::TEXT
  );

  -- Calculate GRAIN reward
  v_grain := (v_invoice.invoice_amount / 1000); -- 1 GRAIN per $1000

  -- Record GRAIN reward
  INSERT INTO financing_transactions (
    invoice_id, transaction_type, direction, amount, grain_amount, to_account
  ) VALUES (
    p_invoice_id, 'grain_reward', 'credit', 0, v_grain,
    'supplier_grain_' || v_invoice.supplier_id::TEXT
  );

  -- Update invoice status
  UPDATE financeable_invoices SET
    financing_status = 'funded',
    financed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_invoice_id;

  RETURN QUERY SELECT TRUE, v_tx_id, v_invoice.advance_amount, v_grain,
    'Invoice funded successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Generate early payment offers for an invoice
CREATE OR REPLACE FUNCTION generate_early_payment_offers(
  p_invoice_id UUID,
  p_schedule_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_invoice RECORD;
  v_schedule RECORD;
  v_tier JSONB;
  v_offers_created INTEGER := 0;
  v_discount_pct DECIMAL(5,3);
  v_discount_amount DECIMAL(20,2);
  v_pay_by DATE;
  v_discounted_amount DECIMAL(20,2);
BEGIN
  -- Get invoice
  SELECT * INTO v_invoice FROM financeable_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Get schedule (customer-specific or default)
  IF p_schedule_id IS NOT NULL THEN
    SELECT * INTO v_schedule FROM discount_schedules WHERE id = p_schedule_id;
  ELSE
    SELECT * INTO v_schedule FROM discount_schedules
    WHERE (customer_id = v_invoice.buyer_id OR customer_id IS NULL)
    AND is_active = TRUE
    ORDER BY customer_id NULLS LAST
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Generate offer for each tier
  FOR v_tier IN SELECT * FROM jsonb_array_elements(v_schedule.tiers)
  LOOP
    v_pay_by := v_invoice.due_date - (v_tier->>'days_early')::INTEGER;

    -- Skip if pay_by is in the past
    IF v_pay_by <= CURRENT_DATE THEN CONTINUE; END IF;

    v_discount_pct := (v_tier->>'discount_pct')::DECIMAL;
    v_discount_amount := v_invoice.invoice_amount * (v_discount_pct / 100);
    v_discounted_amount := v_invoice.invoice_amount - v_discount_amount;

    INSERT INTO early_payment_offers (
      invoice_id, discount_pct, discount_amount, pay_by_date, days_early,
      original_amount, discounted_amount, grain_bonus,
      valid_until
    ) VALUES (
      p_invoice_id, v_discount_pct, v_discount_amount, v_pay_by,
      (v_tier->>'days_early')::INTEGER,
      v_invoice.invoice_amount, v_discounted_amount,
      COALESCE((v_tier->>'grain_bonus')::INTEGER, 0),
      v_pay_by::TIMESTAMPTZ + INTERVAL '1 day'
    )
    ON CONFLICT DO NOTHING;

    v_offers_created := v_offers_created + 1;
  END LOOP;

  RETURN v_offers_created;
END;
$$ LANGUAGE plpgsql;

-- Accept early payment offer
CREATE OR REPLACE FUNCTION accept_early_payment_offer(
  p_offer_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  amount_due DECIMAL(20,2),
  savings DECIMAL(20,2),
  grain_earned INTEGER,
  pay_by DATE,
  message TEXT
) AS $$
DECLARE
  v_offer RECORD;
  v_invoice RECORD;
BEGIN
  -- Get offer
  SELECT * INTO v_offer FROM early_payment_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0, NULL::DATE, 'Offer not found'::TEXT;
    RETURN;
  END IF;

  -- Check validity
  IF v_offer.status != 'active' THEN
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0, NULL::DATE, 'Offer not active'::TEXT;
    RETURN;
  END IF;

  IF v_offer.valid_until < NOW() THEN
    UPDATE early_payment_offers SET status = 'expired' WHERE id = p_offer_id;
    RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0, NULL::DATE, 'Offer expired'::TEXT;
    RETURN;
  END IF;

  -- Accept offer
  UPDATE early_payment_offers SET
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = p_offer_id;

  -- Update invoice
  UPDATE financeable_invoices SET
    early_payment_offers = early_payment_offers || jsonb_build_object(
      'offer_id', p_offer_id,
      'accepted_at', NOW(),
      'discount_pct', v_offer.discount_pct
    ),
    updated_at = NOW()
  WHERE id = v_offer.invoice_id;

  RETURN QUERY SELECT
    TRUE,
    v_offer.discounted_amount,
    v_offer.discount_amount,
    v_offer.grain_bonus,
    v_offer.pay_by_date,
    'Offer accepted - pay by ' || v_offer.pay_by_date::TEXT || ' to save $' || v_offer.discount_amount::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS: FINANCING DASHBOARDS
-- ============================================================================

-- Financing pipeline overview
CREATE OR REPLACE VIEW financing_pipeline AS
SELECT
  financing_status,
  COUNT(*) as invoice_count,
  SUM(invoice_amount) as total_amount,
  SUM(advance_amount) as total_advanced,
  SUM(discount_amount) as total_discount_earned,
  AVG(due_date - CURRENT_DATE) as avg_days_to_due
FROM financeable_invoices
GROUP BY financing_status;

-- Supplier financing summary
CREATE OR REPLACE VIEW supplier_financing_summary AS
SELECT
  sn.supplier_code,
  sn.company_name,
  fps.program_type,
  fps.advance_limit,
  fps.advance_used,
  fps.advance_available,
  fps.advance_rate_pct,
  fps.discount_rate_pct,
  fps.invoices_financed,
  fps.total_volume_financed,
  fps.default_rate_pct
FROM financing_programs_supplier fps
JOIN supplier_network sn ON fps.supplier_id = sn.id
WHERE fps.status = 'active';

-- Buyer financing summary
CREATE OR REPLACE VIEW buyer_financing_summary AS
SELECT
  ec.customer_code,
  ec.company_name,
  fpb.program_type,
  fpb.credit_limit,
  fpb.credit_used,
  fpb.credit_available,
  fpb.effective_apr,
  fpb.standard_payment_days,
  fpb.extended_payment_days,
  fpb.risk_rating
FROM financing_programs_buyer fpb
JOIN erp_customers ec ON fpb.customer_id = ec.id
WHERE fpb.status = 'active';

-- Daily financing activity
CREATE OR REPLACE VIEW daily_financing_activity AS
SELECT
  DATE(created_at) as activity_date,
  transaction_type,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as credits,
  SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as debits,
  SUM(COALESCE(grain_amount, 0)) as grain_issued
FROM financing_transactions
GROUP BY DATE(created_at), transaction_type
ORDER BY activity_date DESC, transaction_type;

-- Early payment offer performance
CREATE OR REPLACE VIEW early_payment_offer_stats AS
SELECT
  DATE(created_at) as offer_date,
  COUNT(*) as offers_created,
  SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
  SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
  SUM(CASE WHEN status = 'accepted' THEN discount_amount ELSE 0 END) as total_discounts_given,
  SUM(CASE WHEN status = 'accepted' THEN grain_bonus ELSE 0 END) as total_grain_awarded,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  ) as acceptance_rate_pct
FROM early_payment_offers
GROUP BY DATE(created_at)
ORDER BY offer_date DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE financing_programs_buyer IS 'Customer programs for extended payment terms and dynamic discounting';
COMMENT ON TABLE financing_programs_supplier IS 'Supplier programs for early payment/factoring';
COMMENT ON TABLE financeable_invoices IS 'Invoices that can be financed - core of the financing engine';
COMMENT ON TABLE financing_transactions IS 'Double-entry ledger for all financing money movement';
COMMENT ON TABLE early_payment_offers IS 'Dynamic discount offers for early payment';
COMMENT ON TABLE discount_schedules IS 'Templates for generating early payment offers';

COMMENT ON FUNCTION request_invoice_financing IS 'Supplier requests early payment on an invoice';
COMMENT ON FUNCTION fund_invoice IS 'Execute funding - money moves from treasury to supplier';
COMMENT ON FUNCTION generate_early_payment_offers IS 'Create discount offers for an invoice based on schedule';
COMMENT ON FUNCTION accept_early_payment_offer IS 'Buyer accepts a discount offer';

-- ============================================================================
-- THE ECONOMICS
-- ============================================================================
--
-- EXAMPLE: $100,000 invoice, NET60
--
-- WITHOUT WELLS:
--   Supplier waits 60 days for payment
--   Supplier may need to borrow at 12%+ APR
--   Buyer pays $100,000 on day 60
--
-- WITH WELLS FINANCING:
--   Day 0: Supplier gets $97,000 (2% discount + 1% reserve)
--   Day 0: Wells holds $1,000 reserve, earns $2,000 discount
--   Day 60: Buyer pays $100,000 to Wells
--   Day 60: Wells releases $1,000 reserve to supplier
--   Day 60: Wells nets $2,000 revenue
--
-- WITH DYNAMIC DISCOUNTING:
--   Day 10: Buyer accepts "Pay now, save 2%" offer
--   Day 10: Buyer pays $98,000, earns 100 GRAIN
--   Day 10: Supplier gets full $100,000 (buyer absorbed discount)
--   Day 10: Wells saves cost of capital, gains customer loyalty
--
-- EVERYONE WINS.
-- ============================================================================
