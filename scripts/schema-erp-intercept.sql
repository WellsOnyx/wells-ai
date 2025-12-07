-- ============================================================================
-- WELLS AI: SWITCHLESS ERP SPEND INTERCEPT
-- "Invisible Infrastructure for Enterprise Procurement"
-- ============================================================================
--
-- THE VISION:
-- Sit invisibly inside SAP, Oracle, Coupa, Ariba - capture spend without
-- anyone knowing you're there. No IT projects. No change management.
-- Just margin.
--
-- THREE INTERCEPTION LAYERS:
-- 1. Virtual Vendor - We ARE the vendor in their system
-- 2. Punch-Out Catalog - Our marketplace appears in their requisition flow
-- 3. Payment Layer - Virtual cards capture margin at settlement
--
-- THE RESULT:
-- "Add us as a vendor. We'll save you 15% on MRO spend."
-- 15 minute setup. No IT. No training. Just savings.
--
-- ============================================================================

-- ============================================================================
-- LAYER 1: EXTERNAL ERP CONNECTIONS
-- ============================================================================

-- Enterprise customers connected to Wells AI
CREATE TABLE IF NOT EXISTS erp_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer identification
  customer_code VARCHAR(50) NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  company_domain VARCHAR(255),

  -- ERP details
  erp_type VARCHAR(50) NOT NULL CHECK (erp_type IN (
    'sap_s4hana', 'sap_ecc', 'sap_ariba', 'oracle_fusion', 'oracle_ebs',
    'coupa', 'jaggaer', 'workday', 'netsuite', 'dynamics365', 'other'
  )),
  erp_version VARCHAR(50),
  erp_instance_id VARCHAR(255),

  -- Integration method
  integration_type VARCHAR(50) NOT NULL CHECK (integration_type IN (
    'virtual_vendor',      -- We're registered as a vendor
    'punchout_catalog',    -- OCI/cXML punch-out
    'edi_direct',          -- Direct EDI connection
    'api_integration',     -- REST/SOAP API
    'payment_intercept',   -- Virtual card only
    'hybrid'               -- Multiple methods
  )),

  -- Connection credentials (encrypted in production)
  api_endpoint TEXT,
  api_credentials JSONB DEFAULT '{}',

  -- Our vendor identity in their system
  vendor_number VARCHAR(100),
  vendor_name VARCHAR(255),
  payment_terms VARCHAR(50) DEFAULT 'NET30',

  -- Spend metrics
  annual_spend_estimate DECIMAL(20,2),
  monthly_spend_target DECIMAL(20,2),
  total_spend_captured DECIMAL(20,2) DEFAULT 0,
  total_margin_earned DECIMAL(20,2) DEFAULT 0,

  -- Categories we intercept
  spend_categories TEXT[] DEFAULT ARRAY['MRO', 'office_supplies', 'it_hardware'],

  -- Contract terms
  margin_share_pct DECIMAL(5,2) DEFAULT 50.00,  -- Customer gets 50% of savings
  minimum_margin_pct DECIMAL(5,2) DEFAULT 5.00, -- We keep at least 5%

  -- Status
  status VARCHAR(20) DEFAULT 'onboarding' CHECK (status IN (
    'onboarding', 'active', 'paused', 'churned'
  )),
  go_live_date DATE,

  -- Contacts
  primary_contact_name VARCHAR(255),
  primary_contact_email VARCHAR(255),
  procurement_contact_email VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_customers_code ON erp_customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_erp_customers_status ON erp_customers(status);

-- ============================================================================
-- LAYER 2: PUNCH-OUT CATALOG SYSTEM (OCI/cXML)
-- ============================================================================

-- Punch-out session management
CREATE TABLE IF NOT EXISTS punchout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES erp_customers(id),

  -- Session identity
  session_token VARCHAR(255) NOT NULL UNIQUE,
  buyer_cookie VARCHAR(500),  -- cXML BuyerCookie

  -- User context (from ERP)
  user_id VARCHAR(100),
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  cost_center VARCHAR(100),
  department VARCHAR(100),

  -- Requisition context
  requisition_id VARCHAR(100),
  requisition_name VARCHAR(255),

  -- Cart state
  cart_items JSONB DEFAULT '[]',
  cart_total DECIMAL(20,4) DEFAULT 0,
  cart_currency VARCHAR(10) DEFAULT 'USD',

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '4 hours',

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'submitted', 'expired', 'cancelled'
  )),

  -- Return URL (where to POST the cart)
  return_url TEXT NOT NULL,

  -- Protocol details
  protocol VARCHAR(20) DEFAULT 'cxml' CHECK (protocol IN ('cxml', 'oci')),
  protocol_version VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_punchout_token ON punchout_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_punchout_customer ON punchout_sessions(customer_id);

-- Punch-out credentials (DUNS, shared secrets)
CREATE TABLE IF NOT EXISTS punchout_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES erp_customers(id),

  -- Identity
  from_domain VARCHAR(255) NOT NULL,  -- Buyer's domain
  from_identity VARCHAR(255) NOT NULL, -- Buyer's DUNS or ID

  to_domain VARCHAR(255) DEFAULT 'wellsonyx.io',
  to_identity VARCHAR(255) DEFAULT 'wellsonyx',

  -- Authentication
  shared_secret_hash VARCHAR(255) NOT NULL,

  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (customer_id, from_domain, from_identity)
);

-- ============================================================================
-- LAYER 3: EDI DOCUMENT INTERCHANGE
-- ============================================================================

-- EDI trading partner setup
CREATE TABLE IF NOT EXISTS edi_trading_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES erp_customers(id),

  -- ISA/GS identifiers
  isa_qualifier VARCHAR(2) NOT NULL,
  isa_id VARCHAR(15) NOT NULL,
  gs_id VARCHAR(15) NOT NULL,

  -- Communication
  connection_type VARCHAR(20) CHECK (connection_type IN (
    'as2', 'sftp', 'van', 'api'
  )),
  as2_url TEXT,
  as2_id VARCHAR(100),
  sftp_host VARCHAR(255),
  sftp_path VARCHAR(255),

  -- Document types enabled
  supports_850 BOOLEAN DEFAULT TRUE,   -- Purchase Order
  supports_855 BOOLEAN DEFAULT TRUE,   -- PO Acknowledgment
  supports_856 BOOLEAN DEFAULT TRUE,   -- Ship Notice (ASN)
  supports_810 BOOLEAN DEFAULT TRUE,   -- Invoice
  supports_820 BOOLEAN DEFAULT FALSE,  -- Payment Order
  supports_997 BOOLEAN DEFAULT TRUE,   -- Functional Ack

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EDI documents (all interchange)
CREATE TABLE IF NOT EXISTS edi_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES erp_customers(id),
  trading_partner_id UUID REFERENCES edi_trading_partners(id),

  -- Document identification
  document_type VARCHAR(10) NOT NULL CHECK (document_type IN (
    '850', '855', '856', '810', '820', '997'
  )),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Control numbers
  isa_control_number VARCHAR(20),
  gs_control_number VARCHAR(20),
  st_control_number VARCHAR(20),

  -- Business references
  po_number VARCHAR(100),
  invoice_number VARCHAR(100),
  shipment_id VARCHAR(100),

  -- Content
  raw_edi TEXT,
  parsed_content JSONB,

  -- Processing
  status VARCHAR(20) DEFAULT 'received' CHECK (status IN (
    'received', 'validated', 'processing', 'processed', 'error', 'ack_sent'
  )),
  error_message TEXT,
  processed_at TIMESTAMPTZ,

  -- Linked internal order
  internal_order_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edi_docs_customer ON edi_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_edi_docs_type ON edi_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_edi_docs_po ON edi_documents(po_number);

-- ============================================================================
-- INTERNAL ORDER MANAGEMENT (THE BRAIN)
-- ============================================================================

-- All orders flowing through Wells (from any source)
CREATE TABLE IF NOT EXISTS intercept_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  customer_id UUID NOT NULL REFERENCES erp_customers(id),
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN (
    'punchout', 'edi_850', 'api', 'manual', 'email_po'
  )),
  source_session_id UUID,  -- punchout_sessions.id if punchout
  source_edi_id UUID,      -- edi_documents.id if EDI

  -- Customer's PO details
  customer_po_number VARCHAR(100) NOT NULL,
  customer_po_date DATE,
  customer_requisition_id VARCHAR(100),

  -- Requestor info
  requestor_name VARCHAR(255),
  requestor_email VARCHAR(255),
  requestor_department VARCHAR(100),
  cost_center VARCHAR(100),

  -- Ship to
  ship_to_name VARCHAR(255),
  ship_to_address TEXT,
  ship_to_city VARCHAR(100),
  ship_to_state VARCHAR(50),
  ship_to_zip VARCHAR(20),
  ship_to_country VARCHAR(50) DEFAULT 'US',

  -- Bill to
  bill_to_name VARCHAR(255),
  bill_to_address TEXT,

  -- Financials (what customer sees)
  customer_subtotal DECIMAL(20,4) NOT NULL,
  customer_shipping DECIMAL(20,4) DEFAULT 0,
  customer_tax DECIMAL(20,4) DEFAULT 0,
  customer_total DECIMAL(20,4) NOT NULL,
  customer_currency VARCHAR(10) DEFAULT 'USD',

  -- Financials (our actual cost)
  supplier_subtotal DECIMAL(20,4),
  supplier_shipping DECIMAL(20,4),
  supplier_tax DECIMAL(20,4),
  supplier_total DECIMAL(20,4),

  -- Margin captured
  gross_margin DECIMAL(20,4),
  margin_pct DECIMAL(8,4),
  customer_savings DECIMAL(20,4),  -- What we show them they saved

  -- Status
  status VARCHAR(30) DEFAULT 'received' CHECK (status IN (
    'received', 'validated', 'routing', 'routed',
    'supplier_confirmed', 'partially_shipped', 'shipped',
    'delivered', 'invoiced', 'paid', 'closed', 'cancelled'
  )),

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  routed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Special handling
  priority VARCHAR(20) DEFAULT 'normal',
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intercept_orders_customer ON intercept_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_intercept_orders_po ON intercept_orders(customer_po_number);
CREATE INDEX IF NOT EXISTS idx_intercept_orders_status ON intercept_orders(status);

-- Order line items
CREATE TABLE IF NOT EXISTS intercept_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES intercept_orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,

  -- What customer ordered
  customer_sku VARCHAR(100),
  customer_description TEXT NOT NULL,
  customer_unit_price DECIMAL(20,4) NOT NULL,
  quantity DECIMAL(20,4) NOT NULL,
  uom VARCHAR(20) DEFAULT 'EA',
  customer_line_total DECIMAL(20,4) NOT NULL,

  -- What we're actually fulfilling
  supplier_id UUID,
  supplier_sku VARCHAR(100),
  supplier_description TEXT,
  supplier_unit_price DECIMAL(20,4),
  supplier_line_total DECIMAL(20,4),

  -- Catalog reference
  catalog_item_id UUID,

  -- Margin on this line
  line_margin DECIMAL(20,4),
  line_margin_pct DECIMAL(8,4),

  -- Fulfillment
  quantity_shipped DECIMAL(20,4) DEFAULT 0,
  quantity_backordered DECIMAL(20,4) DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order ON intercept_order_lines(order_id);

-- ============================================================================
-- SUPPLIER NETWORK (WHO ACTUALLY FULFILLS)
-- ============================================================================

-- Suppliers in our network
CREATE TABLE IF NOT EXISTS supplier_network (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  supplier_code VARCHAR(50) NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  dba_name VARCHAR(255),

  -- Contact
  primary_email VARCHAR(255),
  orders_email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),

  -- Address
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  country VARCHAR(50) DEFAULT 'US',

  -- Capabilities
  categories TEXT[] DEFAULT '{}',
  brands TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',

  -- Fulfillment
  avg_ship_days INTEGER DEFAULT 3,
  drop_ship_capable BOOLEAN DEFAULT TRUE,
  white_label_capable BOOLEAN DEFAULT FALSE,

  -- Commercial terms
  discount_pct DECIMAL(5,2) DEFAULT 0,  -- Off list price
  payment_terms VARCHAR(50) DEFAULT 'NET30',
  min_order_value DECIMAL(20,2) DEFAULT 0,

  -- Integration
  integration_type VARCHAR(30) DEFAULT 'email' CHECK (integration_type IN (
    'email', 'portal', 'api', 'edi', 'punchout'
  )),
  api_endpoint TEXT,
  api_credentials JSONB DEFAULT '{}',

  -- Performance
  fill_rate_pct DECIMAL(5,2),
  on_time_pct DECIMAL(5,2),
  quality_score DECIMAL(3,2),

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'onboarding', 'active', 'paused', 'terminated'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_code ON supplier_network(supplier_code);
CREATE INDEX IF NOT EXISTS idx_supplier_categories ON supplier_network USING GIN(categories);

-- Supplier catalog items
CREATE TABLE IF NOT EXISTS supplier_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_network(id),

  -- Product identification
  supplier_sku VARCHAR(100) NOT NULL,
  manufacturer_sku VARCHAR(100),
  upc VARCHAR(20),

  -- Description
  name VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  brand VARCHAR(100),
  manufacturer VARCHAR(255),

  -- Pricing
  list_price DECIMAL(20,4),
  our_cost DECIMAL(20,4) NOT NULL,  -- What we pay
  suggested_sell DECIMAL(20,4),      -- What we charge
  margin_pct DECIMAL(8,4),

  -- Units
  uom VARCHAR(20) DEFAULT 'EA',
  pack_size INTEGER DEFAULT 1,

  -- Inventory
  in_stock BOOLEAN DEFAULT TRUE,
  stock_quantity INTEGER,
  lead_time_days INTEGER DEFAULT 3,

  -- Attributes
  attributes JSONB DEFAULT '{}',
  specifications JSONB DEFAULT '{}',

  -- Media
  image_url TEXT,
  spec_sheet_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (supplier_id, supplier_sku)
);

CREATE INDEX IF NOT EXISTS idx_catalog_supplier ON supplier_catalog(supplier_id);
CREATE INDEX IF NOT EXISTS idx_catalog_sku ON supplier_catalog(supplier_sku);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON supplier_catalog(category);
CREATE INDEX IF NOT EXISTS idx_catalog_search ON supplier_catalog USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================================================
-- ROUTING ENGINE (AI DECIDES WHO FULFILLS)
-- ============================================================================

-- Routing rules
CREATE TABLE IF NOT EXISTS routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 100,  -- Lower = higher priority

  -- Match conditions (JSONB for flexibility)
  conditions JSONB NOT NULL,
  /*
    Example conditions:
    {
      "category": "MRO",
      "customer_id": "uuid",
      "min_line_value": 100,
      "brand": "3M"
    }
  */

  -- Routing action
  action_type VARCHAR(30) NOT NULL CHECK (action_type IN (
    'route_to_supplier',
    'route_to_cheapest',
    'route_to_fastest',
    'route_to_preferred',
    'manual_review',
    'reject'
  )),

  -- If route_to_supplier
  supplier_id UUID REFERENCES supplier_network(id),

  -- Settings
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routing decisions log
CREATE TABLE IF NOT EXISTS routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id UUID NOT NULL REFERENCES intercept_order_lines(id),

  -- Decision
  selected_supplier_id UUID REFERENCES supplier_network(id),
  matched_rule_id UUID REFERENCES routing_rules(id),

  -- Alternatives considered
  alternatives JSONB,  -- [{supplier_id, cost, score, reason}]

  -- Why this choice
  decision_reason TEXT,
  confidence_score DECIMAL(5,2),

  -- Savings achieved
  best_alternative_cost DECIMAL(20,4),
  selected_cost DECIMAL(20,4),
  savings_vs_list DECIMAL(20,4),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PAYMENT INTERCEPT (VIRTUAL CARDS)
-- ============================================================================

-- Virtual cards issued for orders
CREATE TABLE IF NOT EXISTS payment_virtual_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES intercept_orders(id),
  supplier_id UUID NOT NULL REFERENCES supplier_network(id),

  -- Card details (from Airwallex/Stripe)
  provider VARCHAR(30) NOT NULL CHECK (provider IN ('airwallex', 'stripe', 'marqeta')),
  external_card_id VARCHAR(255) NOT NULL,

  card_number_last4 VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,

  -- Limits
  authorized_amount DECIMAL(20,4) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- Usage
  spent_amount DECIMAL(20,4) DEFAULT 0,
  remaining_amount DECIMAL(20,4),

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'pending', 'active', 'used', 'expired', 'cancelled'
  )),

  -- Transactions
  transactions JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vcards_order ON payment_virtual_cards(order_id);
CREATE INDEX IF NOT EXISTS idx_vcards_supplier ON payment_virtual_cards(supplier_id);

-- ============================================================================
-- ANALYTICS & MARGIN TRACKING
-- ============================================================================

-- Daily spend aggregation
CREATE TABLE IF NOT EXISTS spend_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES erp_customers(id),
  summary_date DATE NOT NULL,

  -- Volume
  order_count INTEGER DEFAULT 0,
  line_count INTEGER DEFAULT 0,

  -- Customer spend (what they paid)
  customer_spend DECIMAL(20,4) DEFAULT 0,

  -- Supplier cost (what we paid)
  supplier_cost DECIMAL(20,4) DEFAULT 0,

  -- Margin
  gross_margin DECIMAL(20,4) DEFAULT 0,
  margin_pct DECIMAL(8,4) DEFAULT 0,

  -- Customer's share of savings
  customer_rebate DECIMAL(20,4) DEFAULT 0,

  -- Wells revenue
  wells_revenue DECIMAL(20,4) DEFAULT 0,

  -- Category breakdown
  category_breakdown JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (customer_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_spend_daily_customer ON spend_daily_summary(customer_id);
CREATE INDEX IF NOT EXISTS idx_spend_daily_date ON spend_daily_summary(summary_date DESC);

-- ============================================================================
-- FUNCTIONS: PUNCH-OUT HANDLING
-- ============================================================================

-- Create new punch-out session
CREATE OR REPLACE FUNCTION create_punchout_session(
  p_customer_code VARCHAR(50),
  p_buyer_cookie VARCHAR(500),
  p_return_url TEXT,
  p_user_email VARCHAR(255) DEFAULT NULL,
  p_user_name VARCHAR(255) DEFAULT NULL,
  p_cost_center VARCHAR(100) DEFAULT NULL,
  p_protocol VARCHAR(20) DEFAULT 'cxml'
)
RETURNS TABLE (
  session_id UUID,
  session_token VARCHAR(255),
  redirect_url TEXT
) AS $$
DECLARE
  v_customer_id UUID;
  v_session_id UUID;
  v_token VARCHAR(255);
BEGIN
  -- Get customer
  SELECT id INTO v_customer_id FROM erp_customers WHERE customer_code = p_customer_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_customer_code;
  END IF;

  -- Generate session token
  v_token := 'WPS-' || ENCODE(gen_random_bytes(24), 'hex');

  -- Create session
  INSERT INTO punchout_sessions (
    customer_id, session_token, buyer_cookie, return_url,
    user_email, user_name, cost_center, protocol
  ) VALUES (
    v_customer_id, v_token, p_buyer_cookie, p_return_url,
    p_user_email, p_user_name, p_cost_center, p_protocol
  )
  RETURNING id INTO v_session_id;

  RETURN QUERY SELECT
    v_session_id,
    v_token,
    'https://wellsonyx.io/shop?session=' || v_token;
END;
$$ LANGUAGE plpgsql;

-- Submit punch-out cart (returns cXML OrderMessage)
CREATE OR REPLACE FUNCTION submit_punchout_cart(
  p_session_token VARCHAR(255),
  p_cart_items JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  cart_total DECIMAL(20,4),
  item_count INTEGER,
  cxml_order_message TEXT
) AS $$
DECLARE
  v_session RECORD;
  v_total DECIMAL(20,4) := 0;
  v_count INTEGER := 0;
BEGIN
  -- Get session
  SELECT * INTO v_session FROM punchout_sessions WHERE session_token = p_session_token;
  IF NOT FOUND OR v_session.status != 'active' THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  -- Calculate total
  SELECT
    COUNT(*),
    COALESCE(SUM((item->>'quantity')::DECIMAL * (item->>'unit_price')::DECIMAL), 0)
  INTO v_count, v_total
  FROM jsonb_array_elements(p_cart_items) AS item;

  -- Update session
  UPDATE punchout_sessions SET
    cart_items = p_cart_items,
    cart_total = v_total,
    status = 'submitted',
    submitted_at = NOW()
  WHERE id = v_session.id;

  -- Return success (cXML generation would happen in application layer)
  RETURN QUERY SELECT
    TRUE,
    v_total,
    v_count,
    'CXML_PLACEHOLDER'::TEXT;  -- Application layer generates actual cXML
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: ORDER PROCESSING
-- ============================================================================

-- Process incoming order (from any source)
CREATE OR REPLACE FUNCTION process_incoming_order(
  p_customer_id UUID,
  p_source_type VARCHAR(30),
  p_po_number VARCHAR(100),
  p_lines JSONB,
  p_ship_to JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_customer_total DECIMAL(20,4) := 0;
  v_line JSONB;
  v_line_num INTEGER := 0;
BEGIN
  -- Calculate total
  SELECT COALESCE(SUM((l->>'quantity')::DECIMAL * (l->>'unit_price')::DECIMAL), 0)
  INTO v_customer_total
  FROM jsonb_array_elements(p_lines) AS l;

  -- Create order
  INSERT INTO intercept_orders (
    customer_id, source_type, customer_po_number, customer_po_date,
    customer_subtotal, customer_total,
    ship_to_name, ship_to_address, ship_to_city, ship_to_state, ship_to_zip
  ) VALUES (
    p_customer_id, p_source_type, p_po_number, CURRENT_DATE,
    v_customer_total, v_customer_total,
    p_ship_to->>'name', p_ship_to->>'address', p_ship_to->>'city',
    p_ship_to->>'state', p_ship_to->>'zip'
  )
  RETURNING id INTO v_order_id;

  -- Create line items
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_num := v_line_num + 1;
    INSERT INTO intercept_order_lines (
      order_id, line_number,
      customer_sku, customer_description,
      customer_unit_price, quantity, uom,
      customer_line_total
    ) VALUES (
      v_order_id, v_line_num,
      v_line->>'sku', v_line->>'description',
      (v_line->>'unit_price')::DECIMAL, (v_line->>'quantity')::DECIMAL,
      COALESCE(v_line->>'uom', 'EA'),
      (v_line->>'quantity')::DECIMAL * (v_line->>'unit_price')::DECIMAL
    );
  END LOOP;

  -- Trigger routing (async in real system)
  UPDATE intercept_orders SET status = 'routing' WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- Route order to suppliers
CREATE OR REPLACE FUNCTION route_order_lines(p_order_id UUID)
RETURNS TABLE (
  line_id UUID,
  supplier_id UUID,
  supplier_name VARCHAR(255),
  supplier_cost DECIMAL(20,4),
  margin_pct DECIMAL(8,4)
) AS $$
DECLARE
  v_line RECORD;
  v_best_supplier RECORD;
  v_customer_price DECIMAL(20,4);
  v_margin DECIMAL(20,4);
BEGIN
  -- For each unrouted line
  FOR v_line IN
    SELECT * FROM intercept_order_lines
    WHERE order_id = p_order_id AND supplier_id IS NULL
  LOOP
    -- Find best supplier (simplified - real logic would be more complex)
    SELECT
      sc.supplier_id,
      sn.company_name,
      sc.our_cost,
      sc.id as catalog_item_id
    INTO v_best_supplier
    FROM supplier_catalog sc
    JOIN supplier_network sn ON sc.supplier_id = sn.id
    WHERE sc.is_active = TRUE
    AND sn.status = 'active'
    AND (
      sc.name ILIKE '%' || v_line.customer_description || '%'
      OR sc.supplier_sku = v_line.customer_sku
    )
    ORDER BY sc.our_cost ASC
    LIMIT 1;

    IF v_best_supplier.supplier_id IS NOT NULL THEN
      v_margin := v_line.customer_unit_price - v_best_supplier.our_cost;

      -- Update line
      UPDATE intercept_order_lines SET
        supplier_id = v_best_supplier.supplier_id,
        supplier_unit_price = v_best_supplier.our_cost,
        supplier_line_total = v_best_supplier.our_cost * v_line.quantity,
        catalog_item_id = v_best_supplier.catalog_item_id,
        line_margin = v_margin * v_line.quantity,
        line_margin_pct = CASE WHEN v_line.customer_unit_price > 0
          THEN (v_margin / v_line.customer_unit_price) * 100 ELSE 0 END,
        status = 'routed'
      WHERE id = v_line.id;

      -- Record decision
      INSERT INTO routing_decisions (
        order_line_id, selected_supplier_id,
        selected_cost, savings_vs_list, decision_reason
      ) VALUES (
        v_line.id, v_best_supplier.supplier_id,
        v_best_supplier.our_cost * v_line.quantity,
        v_margin * v_line.quantity,
        'Best price from catalog match'
      );

      RETURN QUERY SELECT
        v_line.id,
        v_best_supplier.supplier_id,
        v_best_supplier.company_name,
        v_best_supplier.our_cost * v_line.quantity,
        CASE WHEN v_line.customer_unit_price > 0
          THEN (v_margin / v_line.customer_unit_price) * 100 ELSE 0 END;
    END IF;
  END LOOP;

  -- Update order totals
  UPDATE intercept_orders SET
    supplier_subtotal = (SELECT SUM(supplier_line_total) FROM intercept_order_lines WHERE order_id = p_order_id),
    supplier_total = (SELECT SUM(supplier_line_total) FROM intercept_order_lines WHERE order_id = p_order_id),
    gross_margin = customer_subtotal - (SELECT COALESCE(SUM(supplier_line_total), 0) FROM intercept_order_lines WHERE order_id = p_order_id),
    margin_pct = CASE WHEN customer_subtotal > 0 THEN
      ((customer_subtotal - (SELECT COALESCE(SUM(supplier_line_total), 0) FROM intercept_order_lines WHERE order_id = p_order_id)) / customer_subtotal) * 100
      ELSE 0 END,
    status = 'routed',
    routed_at = NOW()
  WHERE id = p_order_id;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS: OPERATIONAL DASHBOARDS
-- ============================================================================

-- Customer spend overview
CREATE OR REPLACE VIEW customer_spend_overview AS
SELECT
  c.customer_code,
  c.company_name,
  c.erp_type,
  c.integration_type,
  c.status,
  c.go_live_date,
  c.annual_spend_estimate,
  c.total_spend_captured,
  c.total_margin_earned,
  COUNT(DISTINCT o.id) as total_orders,
  SUM(o.customer_total) as total_customer_spend,
  SUM(o.gross_margin) as total_margin,
  AVG(o.margin_pct) as avg_margin_pct,
  MAX(o.created_at) as last_order_date
FROM erp_customers c
LEFT JOIN intercept_orders o ON c.id = o.customer_id
GROUP BY c.id;

-- Orders pending routing
CREATE OR REPLACE VIEW orders_pending_routing AS
SELECT
  o.id,
  c.company_name as customer,
  o.customer_po_number,
  o.customer_total,
  o.status,
  o.received_at,
  COUNT(l.id) as line_count,
  SUM(CASE WHEN l.supplier_id IS NULL THEN 1 ELSE 0 END) as unrouted_lines
FROM intercept_orders o
JOIN erp_customers c ON o.customer_id = c.id
JOIN intercept_order_lines l ON o.id = l.order_id
WHERE o.status IN ('received', 'routing')
GROUP BY o.id, c.company_name;

-- Supplier performance
CREATE OR REPLACE VIEW supplier_performance AS
SELECT
  s.supplier_code,
  s.company_name,
  s.status,
  COUNT(DISTINCT ol.order_id) as orders_fulfilled,
  SUM(ol.supplier_line_total) as total_cost,
  SUM(ol.line_margin) as total_margin_generated,
  AVG(ol.line_margin_pct) as avg_margin_pct,
  s.fill_rate_pct,
  s.on_time_pct
FROM supplier_network s
LEFT JOIN intercept_order_lines ol ON s.id = ol.supplier_id
GROUP BY s.id;

-- Daily margin report
CREATE OR REPLACE VIEW daily_margin_report AS
SELECT
  DATE(o.created_at) as order_date,
  c.company_name as customer,
  COUNT(o.id) as orders,
  SUM(o.customer_total) as customer_spend,
  SUM(o.supplier_total) as supplier_cost,
  SUM(o.gross_margin) as gross_margin,
  ROUND(AVG(o.margin_pct), 2) as avg_margin_pct,
  SUM(o.gross_margin) * (c.margin_share_pct / 100) as customer_rebate,
  SUM(o.gross_margin) * (1 - c.margin_share_pct / 100) as wells_revenue
FROM intercept_orders o
JOIN erp_customers c ON o.customer_id = c.id
WHERE o.status NOT IN ('cancelled')
GROUP BY DATE(o.created_at), c.id
ORDER BY order_date DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE erp_customers IS 'Enterprise customers with ERP integrations - the companies whose spend we intercept';
COMMENT ON TABLE punchout_sessions IS 'Active punch-out shopping sessions from ERP users';
COMMENT ON TABLE edi_documents IS 'All EDI documents exchanged - 850 POs, 855 Acks, 856 ASNs, 810 Invoices';
COMMENT ON TABLE intercept_orders IS 'All orders flowing through Wells - from any source';
COMMENT ON TABLE supplier_network IS 'Our supplier network - who actually fulfills orders';
COMMENT ON TABLE supplier_catalog IS 'Product catalog with our negotiated pricing';
COMMENT ON TABLE routing_rules IS 'Rules engine for deciding which supplier fulfills';
COMMENT ON TABLE payment_virtual_cards IS 'Virtual cards issued for supplier payments';

COMMENT ON FUNCTION create_punchout_session IS 'Initialize a cXML/OCI punch-out session from ERP';
COMMENT ON FUNCTION process_incoming_order IS 'Process order from any source (punch-out, EDI, API)';
COMMENT ON FUNCTION route_order_lines IS 'AI routes each line to best supplier for margin capture';

-- ============================================================================
-- THE MAGIC:
-- ============================================================================
--
-- 1. Customer adds "Wells Onyx" as vendor in SAP (15 minutes)
-- 2. User creates requisition, our catalog appears via punch-out
-- 3. Cart goes back to SAP, PO generated to "Wells Onyx"
-- 4. We receive 850, route to actual supplier
-- 5. Supplier ships direct to customer (drop ship)
-- 6. We invoice customer at agreed price
-- 7. We pay supplier at our negotiated price
-- 8. Difference = margin captured
--
-- THEY NEVER KNOW WE'RE THERE.
--
-- ============================================================================
