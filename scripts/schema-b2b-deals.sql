-- ============================================================================
-- WELLS AI - FRICTIONLESS B2B TRANSACTION SCHEMA
-- ============================================================================
-- "Yes, proceed" = deal done, money escrowed, everyone wins
--
-- Core philosophy:
-- - Verbal/chat agreement is binding
-- - Instant escrow on confirmation
-- - Automatic settlement on delivery
-- - Zero paperwork for standard terms
-- ============================================================================

-- ============================================================================
-- B2B DEALS - The core transaction record
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  buyer_id TEXT NOT NULL,              -- Clerk user ID
  buyer_company TEXT,
  buyer_email TEXT,
  seller_id TEXT NOT NULL,             -- Clerk user ID
  seller_company TEXT,
  seller_email TEXT,

  -- Deal Terms (agreed via conversation)
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(20,2) NOT NULL,       -- USD value
  currency TEXT DEFAULT 'USD',
  grain_amount DECIMAL(24,6),          -- GRAIN equivalent at lock
  grain_price_at_deal DECIMAL(20,10),  -- GRAIN price when deal made

  -- Payment Terms
  payment_terms TEXT DEFAULT 'immediate',  -- immediate, net30, net60, milestone
  payment_method TEXT DEFAULT 'escrow',    -- escrow, direct, credit_line

  -- Escrow
  escrow_id UUID,                      -- Links to grain_escrows
  escrow_funded BOOLEAN DEFAULT FALSE,
  escrow_funded_at TIMESTAMP,

  -- Delivery
  delivery_type TEXT DEFAULT 'confirmation', -- confirmation, tracking, milestone, auto
  expected_delivery DATE,
  actual_delivery TIMESTAMP,

  -- Status Flow: proposed → accepted → funded → delivered → completed
  status TEXT NOT NULL DEFAULT 'proposed',

  -- Confirmation (the magic moment)
  buyer_confirmed BOOLEAN DEFAULT FALSE,
  buyer_confirmed_at TIMESTAMP,
  buyer_confirmation_method TEXT,      -- chat, voice, button, api
  buyer_confirmation_message TEXT,     -- "yes, proceed" or similar

  seller_confirmed BOOLEAN DEFAULT FALSE,
  seller_confirmed_at TIMESTAMP,
  seller_confirmation_method TEXT,
  seller_confirmation_message TEXT,

  -- Auto-settlement
  auto_release BOOLEAN DEFAULT TRUE,   -- Auto-release on delivery confirmation
  auto_release_days INTEGER DEFAULT 3, -- Days after delivery if no dispute

  -- Fees (1% total, split per allocation)
  platform_fee DECIMAL(20,2),
  fee_paid BOOLEAN DEFAULT FALSE,

  -- Reference
  rfq_id UUID,                         -- If originated from RFQ
  quote_id UUID,                       -- If originated from quote
  invoice_id UUID,                     -- Generated invoice
  contract_id UUID,                    -- If formal contract needed
  conversation_id TEXT,                -- Chat thread where deal was made

  -- Metadata
  terms_snapshot JSONB,                -- Snapshot of agreed terms
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_b2b_deals_buyer ON b2b_deals(buyer_id);
CREATE INDEX idx_b2b_deals_seller ON b2b_deals(seller_id);
CREATE INDEX idx_b2b_deals_status ON b2b_deals(status);
CREATE INDEX idx_b2b_deals_escrow ON b2b_deals(escrow_id);
CREATE INDEX idx_b2b_deals_created ON b2b_deals(created_at DESC);

-- ============================================================================
-- DEAL CONFIRMATIONS - Audit trail of agreements
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES b2b_deals(id) ON DELETE CASCADE,

  -- Who confirmed
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,                  -- buyer, seller

  -- How they confirmed
  method TEXT NOT NULL,                -- chat, voice, button, api, email
  channel TEXT,                        -- wellsai, slack, teams, sms, email

  -- What they said
  message TEXT,                        -- The actual confirmation message
  intent_score DECIMAL(5,4),           -- AI confidence in intent (0.95+)

  -- Context
  conversation_id TEXT,
  message_id TEXT,

  -- Binding
  is_binding BOOLEAN DEFAULT TRUE,
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_confirmations_deal ON deal_confirmations(deal_id);
CREATE INDEX idx_confirmations_user ON deal_confirmations(user_id);

-- ============================================================================
-- DEAL MESSAGES - Conversation history for the deal
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES b2b_deals(id) ON DELETE CASCADE,

  -- Sender
  user_id TEXT,
  role TEXT NOT NULL,                  -- buyer, seller, system, ai

  -- Message
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',    -- text, proposal, counter, confirmation, status

  -- AI Analysis
  intent TEXT,                         -- negotiate, accept, reject, clarify, confirm
  sentiment DECIMAL(5,4),              -- -1 to 1
  extracted_terms JSONB,               -- Any terms mentioned

  -- Channel
  channel TEXT,                        -- wellsai, slack, email, sms
  external_id TEXT,                    -- ID in external system

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_messages_deal ON deal_messages(deal_id);
CREATE INDEX idx_deal_messages_created ON deal_messages(created_at);

-- ============================================================================
-- DEAL TEMPLATES - Pre-approved terms for instant deals
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id TEXT NOT NULL,
  company_id TEXT,

  -- Template
  name TEXT NOT NULL,
  description TEXT,

  -- Default Terms
  default_payment_terms TEXT DEFAULT 'immediate',
  default_payment_method TEXT DEFAULT 'escrow',
  default_delivery_type TEXT DEFAULT 'confirmation',
  default_auto_release BOOLEAN DEFAULT TRUE,
  default_auto_release_days INTEGER DEFAULT 3,

  -- Pricing
  pricing_type TEXT DEFAULT 'fixed',   -- fixed, tiered, custom
  fixed_price DECIMAL(20,2),
  price_tiers JSONB,                   -- Quantity-based pricing

  -- Limits
  min_amount DECIMAL(20,2),
  max_amount DECIMAL(20,2),
  requires_approval_above DECIMAL(20,2),

  -- Auto-accept
  auto_accept BOOLEAN DEFAULT FALSE,   -- Instantly accept matching requests
  auto_accept_from JSONB,              -- Trusted buyer IDs

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_templates_user ON deal_templates(user_id);
CREATE INDEX idx_deal_templates_active ON deal_templates(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- TRUSTED PARTIES - Pre-approved trading partners
-- ============================================================================

CREATE TABLE IF NOT EXISTS trusted_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship
  user_id TEXT NOT NULL,               -- Who trusts
  trusted_user_id TEXT NOT NULL,       -- Who is trusted

  -- Trust Level
  trust_level TEXT DEFAULT 'standard', -- standard, elevated, unlimited

  -- Limits
  max_deal_amount DECIMAL(20,2),       -- Max per deal without approval
  daily_limit DECIMAL(20,2),           -- Max per day
  monthly_limit DECIMAL(20,2),         -- Max per month

  -- Auto-approve
  auto_approve BOOLEAN DEFAULT FALSE,  -- Auto-approve deals from this party
  auto_fund BOOLEAN DEFAULT FALSE,     -- Auto-fund escrow
  auto_release BOOLEAN DEFAULT TRUE,   -- Auto-release on delivery

  -- Stats
  total_deals INTEGER DEFAULT 0,
  total_volume DECIMAL(20,2) DEFAULT 0,
  successful_deals INTEGER DEFAULT 0,
  disputed_deals INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, trusted_user_id)
);

CREATE INDEX idx_trusted_user ON trusted_parties(user_id);
CREATE INDEX idx_trusted_partner ON trusted_parties(trusted_user_id);

-- ============================================================================
-- DEAL DELIVERIES - Tracking delivery and completion
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES b2b_deals(id) ON DELETE CASCADE,

  -- Delivery Info
  delivery_type TEXT NOT NULL,         -- physical, digital, service, confirmation

  -- Physical Delivery
  tracking_number TEXT,
  carrier TEXT,
  shipping_address JSONB,

  -- Digital Delivery
  download_url TEXT,
  access_granted BOOLEAN DEFAULT FALSE,

  -- Service Delivery
  service_completed BOOLEAN DEFAULT FALSE,
  completion_notes TEXT,

  -- Confirmation
  delivered_at TIMESTAMP,
  confirmed_by TEXT,                   -- user_id who confirmed
  confirmation_method TEXT,            -- auto, manual, tracking

  -- Evidence
  proof_of_delivery JSONB,             -- Photos, signatures, etc.

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deliveries_deal ON deal_deliveries(deal_id);

-- ============================================================================
-- INSTANT OFFERS - Quick proposals that can be accepted immediately
-- ============================================================================

CREATE TABLE IF NOT EXISTS instant_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  from_user_id TEXT NOT NULL,
  from_company TEXT,
  to_user_id TEXT,                     -- NULL = open offer
  to_company TEXT,

  -- Offer
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Terms
  payment_terms TEXT DEFAULT 'immediate',
  delivery_terms TEXT,
  valid_until TIMESTAMP,

  -- Status
  status TEXT DEFAULT 'open',          -- open, accepted, rejected, expired, withdrawn

  -- Acceptance
  accepted_by TEXT,
  accepted_at TIMESTAMP,
  deal_id UUID REFERENCES b2b_deals(id),

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_offers_from ON instant_offers(from_user_id);
CREATE INDEX idx_offers_to ON instant_offers(to_user_id);
CREATE INDEX idx_offers_status ON instant_offers(status);
CREATE INDEX idx_offers_valid ON instant_offers(valid_until) WHERE status = 'open';

-- ============================================================================
-- DEAL INVOICES - Auto-generated invoices
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES b2b_deals(id) ON DELETE CASCADE,

  -- Invoice Details
  invoice_number TEXT UNIQUE NOT NULL,

  -- Parties
  from_user_id TEXT NOT NULL,
  from_company TEXT,
  from_address JSONB,

  to_user_id TEXT NOT NULL,
  to_company TEXT,
  to_address JSONB,

  -- Amounts
  subtotal DECIMAL(20,2) NOT NULL,
  tax_amount DECIMAL(20,2) DEFAULT 0,
  tax_rate DECIMAL(5,4),
  total DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Status
  status TEXT DEFAULT 'draft',         -- draft, sent, paid, overdue, cancelled

  -- Dates
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_at TIMESTAMP,

  -- PDF
  pdf_url TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_deal ON deal_invoices(deal_id);
CREATE INDEX idx_invoices_from ON deal_invoices(from_user_id);
CREATE INDEX idx_invoices_to ON deal_invoices(to_user_id);
CREATE INDEX idx_invoices_status ON deal_invoices(status);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active deals requiring action
CREATE OR REPLACE VIEW v_deals_requiring_action AS
SELECT
  d.*,
  CASE
    WHEN d.status = 'proposed' AND NOT d.seller_confirmed THEN 'awaiting_seller'
    WHEN d.status = 'proposed' AND NOT d.buyer_confirmed THEN 'awaiting_buyer'
    WHEN d.status = 'accepted' AND NOT d.escrow_funded THEN 'awaiting_funding'
    WHEN d.status = 'funded' THEN 'awaiting_delivery'
    WHEN d.status = 'delivered' THEN 'awaiting_release'
    ELSE 'unknown'
  END as action_needed,
  CASE
    WHEN d.status = 'proposed' AND NOT d.seller_confirmed THEN d.seller_id
    WHEN d.status = 'proposed' AND NOT d.buyer_confirmed THEN d.buyer_id
    WHEN d.status = 'accepted' AND NOT d.escrow_funded THEN d.buyer_id
    WHEN d.status = 'delivered' THEN d.buyer_id
    ELSE NULL
  END as action_by
FROM b2b_deals d
WHERE d.status NOT IN ('completed', 'cancelled', 'refunded');

-- Deal summary for dashboard
CREATE OR REPLACE VIEW v_deal_summary AS
SELECT
  user_id,
  role,
  COUNT(*) as total_deals,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_deals,
  COUNT(*) FILTER (WHERE status IN ('proposed', 'accepted', 'funded', 'delivered')) as active_deals,
  SUM(amount) FILTER (WHERE status = 'completed') as completed_volume,
  SUM(amount) FILTER (WHERE status IN ('proposed', 'accepted', 'funded', 'delivered')) as active_volume,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) FILTER (WHERE status = 'completed') as avg_completion_hours
FROM (
  SELECT buyer_id as user_id, 'buyer' as role, status, amount, created_at, updated_at FROM b2b_deals
  UNION ALL
  SELECT seller_id as user_id, 'seller' as role, status, amount, created_at, updated_at FROM b2b_deals
) deals
GROUP BY user_id, role;

-- Trusted party performance
CREATE OR REPLACE VIEW v_trusted_party_performance AS
SELECT
  tp.*,
  CASE
    WHEN tp.total_deals > 0
    THEN ROUND(100.0 * tp.successful_deals / tp.total_deals, 2)
    ELSE 0
  END as success_rate
FROM trusted_parties tp
WHERE tp.is_active = TRUE;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'INV';
  year_part TEXT := TO_CHAR(NOW(), 'YY');
  sequence_num INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM deal_invoices
  WHERE invoice_number LIKE prefix || '-' || year_part || '-%';

  new_number := prefix || '-' || year_part || '-' || LPAD(sequence_num::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Check if deal can auto-approve
CREATE OR REPLACE FUNCTION can_auto_approve_deal(
  p_buyer_id TEXT,
  p_seller_id TEXT,
  p_amount DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  trust_record trusted_parties%ROWTYPE;
  daily_total DECIMAL;
BEGIN
  -- Check if trusted relationship exists
  SELECT * INTO trust_record
  FROM trusted_parties
  WHERE user_id = p_buyer_id
  AND trusted_user_id = p_seller_id
  AND is_active = TRUE
  AND auto_approve = TRUE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check amount limits
  IF trust_record.max_deal_amount IS NOT NULL
     AND p_amount > trust_record.max_deal_amount THEN
    RETURN FALSE;
  END IF;

  -- Check daily limit
  IF trust_record.daily_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO daily_total
    FROM b2b_deals
    WHERE buyer_id = p_buyer_id
    AND seller_id = p_seller_id
    AND created_at >= CURRENT_DATE
    AND status NOT IN ('cancelled', 'refunded');

    IF (daily_total + p_amount) > trust_record.daily_limit THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
