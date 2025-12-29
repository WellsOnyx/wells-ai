-- ============================================================================
-- WELLSAI CONVERSATIONAL ERP SCHEMA
-- AI-native ERP - No forms, no dashboards, just talk to Wells
-- Run: psql $POSTGRES_URL < scripts/schema-wells-erp.sql
-- ============================================================================

-- ============================================================================
-- VENDORS TABLE
-- AI-managed supplier/customer registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_vendors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Basic Info
  name TEXT NOT NULL,
  display_name TEXT,
  vendor_type TEXT NOT NULL DEFAULT 'supplier' CHECK (vendor_type IN ('supplier', 'customer', 'both', 'prospect')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('prospect', 'pending', 'active', 'preferred', 'suspended', 'blacklisted', 'inactive')),

  -- Contact Info
  email TEXT,
  phone TEXT,
  website TEXT,
  contacts JSONB DEFAULT '[]', -- Array of { name, email, phone, role, isPrimary }

  -- Addresses
  addresses JSONB DEFAULT '[]', -- Array of { type, line1, line2, city, state, postalCode, country }

  -- Financial
  payment_terms JSONB DEFAULT '{"terms": "NET30", "currency": "USD"}',
  bank_account JSONB, -- { bankName, accountNumber, routingNumber, swift }
  tax_id TEXT,

  -- Categories and Products
  categories TEXT[] DEFAULT '{}',
  products TEXT[],
  certifications TEXT[],

  -- Performance Tracking
  performance_score JSONB DEFAULT '{"overall": 50, "delivery": 50, "quality": 50, "pricing": 50, "communication": 50, "lastUpdated": null}',
  ratings JSONB DEFAULT '[]', -- Array of { id, category, rating, comment, relatedPoId, ratedAt, ratedBy }

  -- Metrics (calculated)
  total_orders INTEGER DEFAULT 0,
  total_spend DECIMAL(20, 2) DEFAULT 0,
  average_order_value DECIMAL(20, 2) DEFAULT 0,
  last_order_date TIMESTAMP,

  -- Notes and Tags
  notes TEXT,
  internal_notes TEXT,
  tags TEXT[] DEFAULT '{}',

  -- AI Tracking
  created_by_ai BOOLEAN DEFAULT false,
  ai_conversation_id TEXT,

  -- Wells Integration
  wells_supplier_id TEXT, -- Link to main suppliers table if exists

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wells_vendors_user_id ON wells_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_vendors_name ON wells_vendors(user_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_wells_vendors_type ON wells_vendors(user_id, vendor_type);
CREATE INDEX IF NOT EXISTS idx_wells_vendors_status ON wells_vendors(status);
CREATE INDEX IF NOT EXISTS idx_wells_vendors_categories ON wells_vendors USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_wells_vendors_total_spend ON wells_vendors(user_id, total_spend DESC);

-- ============================================================================
-- INVOICES TABLE
-- AI-native invoicing
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  vendor_id TEXT REFERENCES wells_vendors(id) ON DELETE SET NULL,

  -- Vendor Info (denormalized for speed)
  vendor_name TEXT NOT NULL,
  vendor_email TEXT,

  -- Amounts
  subtotal DECIMAL(20, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  wells_fee DECIMAL(20, 2) NOT NULL DEFAULT 0, -- 1% Wells AI fee
  total_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(20, 2) NOT NULL DEFAULT 0,
  amount_due DECIMAL(20, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Dates
  invoice_date TIMESTAMP NOT NULL DEFAULT NOW(),
  due_date TIMESTAMP NOT NULL,
  paid_date TIMESTAMP,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'disputed')),

  -- Line Items
  line_items JSONB DEFAULT '[]', -- Array of { id, description, quantity, unitPrice, amount, category }

  -- Details
  description TEXT,
  notes TEXT,
  payment_terms TEXT DEFAULT 'NET30',
  po_number TEXT,

  -- AI Tracking
  created_by_ai BOOLEAN DEFAULT false,
  ai_conversation_id TEXT,
  ai_command TEXT,

  -- Wells Integration
  wells_deal_id TEXT,
  wells_transaction_id TEXT,

  -- Reminders
  reminders_sent INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP,
  next_reminder_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wells_invoices_user_id ON wells_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_invoices_vendor_id ON wells_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_wells_invoices_status ON wells_invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wells_invoices_due_date ON wells_invoices(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_wells_invoices_created_at ON wells_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wells_invoices_invoice_number ON wells_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_wells_invoices_overdue ON wells_invoices(user_id, due_date) WHERE status NOT IN ('paid', 'cancelled');

-- ============================================================================
-- PURCHASE ORDERS TABLE
-- AI-native PO management
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  supplier_id TEXT REFERENCES wells_vendors(id) ON DELETE SET NULL,

  -- Supplier Info (denormalized for speed)
  supplier_name TEXT NOT NULL,
  supplier_email TEXT,
  supplier_phone TEXT,

  -- Amounts
  subtotal DECIMAL(20, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  wells_fee DECIMAL(20, 2) NOT NULL DEFAULT 0, -- 1% Wells AI fee
  total_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Dates
  order_date TIMESTAMP NOT NULL DEFAULT NOW(),
  expected_delivery_date TIMESTAMP,
  actual_delivery_date TIMESTAMP,
  payment_due_date TIMESTAMP,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_approval', 'approved', 'sent', 'acknowledged',
    'in_production', 'shipped', 'partial_received', 'received', 'completed', 'cancelled', 'disputed'
  )),

  -- Items
  items JSONB DEFAULT '[]', -- Array of { id, sku, description, quantity, unitPrice, amount, deliveredQuantity, category }

  -- Shipping
  shipping_address TEXT,
  shipping_method TEXT,
  tracking_number TEXT,

  -- Payment
  payment_terms TEXT DEFAULT 'NET30',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  amount_paid DECIMAL(20, 2) NOT NULL DEFAULT 0,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- AI Tracking
  created_by_ai BOOLEAN DEFAULT false,
  ai_conversation_id TEXT,
  ai_command TEXT,

  -- Wells Integration
  wells_deal_id TEXT,
  wells_rfq_id TEXT,
  linked_invoice_id TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wells_po_user_id ON wells_purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_po_supplier_id ON wells_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wells_po_status ON wells_purchase_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wells_po_order_date ON wells_purchase_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_wells_po_po_number ON wells_purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_wells_po_delivery ON wells_purchase_orders(user_id, expected_delivery_date) WHERE status NOT IN ('received', 'completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_wells_po_payment ON wells_purchase_orders(user_id, payment_due_date) WHERE payment_status != 'paid';

-- ============================================================================
-- UNIFIED TRANSACTIONS LEDGER
-- Track all financial activity for analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Reference to source document
  reference_id TEXT NOT NULL, -- invoice_id or po_id
  type TEXT NOT NULL, -- 'invoice_created', 'payment_received', 'po_created', 'po_received', 'wells_fee_captured', etc.

  -- Amount
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Metadata
  metadata JSONB DEFAULT '{}', -- { invoiceNumber, poNumber, vendorName, supplierName, wellsFee, etc. }

  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(id)
);

CREATE INDEX IF NOT EXISTS idx_wells_tx_user_id ON wells_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_tx_reference ON wells_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_wells_tx_type ON wells_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_wells_tx_created_at ON wells_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wells_tx_user_date ON wells_transactions(user_id, created_at DESC);

-- ============================================================================
-- FINANCIAL PERIODS (Monthly summaries for fast reporting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_financial_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Period
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Summary Stats
  total_revenue DECIMAL(20, 2) DEFAULT 0,
  total_expenses DECIMAL(20, 2) DEFAULT 0,
  net_income DECIMAL(20, 2) DEFAULT 0,
  wells_fees_collected DECIMAL(20, 2) DEFAULT 0,

  -- Activity Counts
  invoices_created INTEGER DEFAULT 0,
  invoices_paid INTEGER DEFAULT 0,
  pos_created INTEGER DEFAULT 0,
  pos_received INTEGER DEFAULT 0,
  vendors_added INTEGER DEFAULT 0,

  -- Timestamps
  calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_wells_fp_user_id ON wells_financial_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_fp_period ON wells_financial_periods(user_id, period_year DESC, period_month DESC);

-- ============================================================================
-- ERP SETTINGS (Per-user configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_erp_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- ERP Mode
  erp_mode TEXT NOT NULL DEFAULT 'wells_native' CHECK (erp_mode IN ('wells_native', 'sap', 'netsuite', 'oracle', 'dynamics', 'quickbooks', 'xero', 'other')),
  external_erp_connected BOOLEAN DEFAULT false,
  external_erp_sync_enabled BOOLEAN DEFAULT false,

  -- Default Settings
  default_payment_terms TEXT DEFAULT 'NET30',
  default_currency TEXT DEFAULT 'USD',
  auto_send_reminders BOOLEAN DEFAULT true,
  reminder_days_before_due INTEGER DEFAULT 7,

  -- Wells Fee Settings
  wells_fee_enabled BOOLEAN DEFAULT true,
  wells_fee_percentage DECIMAL(5, 2) DEFAULT 1.00,

  -- Notification Preferences
  email_on_invoice_paid BOOLEAN DEFAULT true,
  email_on_po_received BOOLEAN DEFAULT true,
  email_on_overdue BOOLEAN DEFAULT true,

  -- Company Info (for invoices/POs)
  company_name TEXT,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_logo_url TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wells_erp_settings_user ON wells_erp_settings(user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_wells_erp_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vendor updated_at trigger
DROP TRIGGER IF EXISTS update_wells_vendors_timestamp ON wells_vendors;
CREATE TRIGGER update_wells_vendors_timestamp
  BEFORE UPDATE ON wells_vendors
  FOR EACH ROW EXECUTE FUNCTION update_wells_erp_timestamp();

-- Invoice updated_at trigger
DROP TRIGGER IF EXISTS update_wells_invoices_timestamp ON wells_invoices;
CREATE TRIGGER update_wells_invoices_timestamp
  BEFORE UPDATE ON wells_invoices
  FOR EACH ROW EXECUTE FUNCTION update_wells_erp_timestamp();

-- PO updated_at trigger
DROP TRIGGER IF EXISTS update_wells_po_timestamp ON wells_purchase_orders;
CREATE TRIGGER update_wells_po_timestamp
  BEFORE UPDATE ON wells_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_wells_erp_timestamp();

-- Settings updated_at trigger
DROP TRIGGER IF EXISTS update_wells_erp_settings_timestamp ON wells_erp_settings;
CREATE TRIGGER update_wells_erp_settings_timestamp
  BEFORE UPDATE ON wells_erp_settings
  FOR EACH ROW EXECUTE FUNCTION update_wells_erp_timestamp();

-- Update vendor metrics when PO is created/updated
CREATE OR REPLACE FUNCTION update_vendor_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL THEN
    UPDATE wells_vendors
    SET
      total_orders = (
        SELECT COUNT(*) FROM wells_purchase_orders
        WHERE supplier_id = NEW.supplier_id AND status != 'cancelled'
      ),
      total_spend = (
        SELECT COALESCE(SUM(total_amount), 0) FROM wells_purchase_orders
        WHERE supplier_id = NEW.supplier_id AND status NOT IN ('draft', 'cancelled')
      ),
      last_order_date = (
        SELECT MAX(order_date) FROM wells_purchase_orders
        WHERE supplier_id = NEW.supplier_id AND status != 'cancelled'
      ),
      average_order_value = (
        SELECT COALESCE(AVG(total_amount), 0) FROM wells_purchase_orders
        WHERE supplier_id = NEW.supplier_id AND status NOT IN ('draft', 'cancelled')
      ),
      updated_at = NOW()
    WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vendor_metrics_on_po ON wells_purchase_orders;
CREATE TRIGGER update_vendor_metrics_on_po
  AFTER INSERT OR UPDATE ON wells_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_vendor_metrics();

-- Auto-mark invoices as overdue
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE wells_invoices
  SET status = 'overdue'
  WHERE status NOT IN ('paid', 'cancelled', 'overdue', 'disputed')
    AND due_date < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Accounts Payable View
CREATE OR REPLACE VIEW wells_accounts_payable AS
SELECT
  user_id,
  SUM(amount_due) as total_due,
  SUM(CASE WHEN due_date <= NOW() + INTERVAL '7 days' THEN amount_due ELSE 0 END) as due_this_week,
  SUM(CASE WHEN due_date <= (DATE_TRUNC('month', NOW()) + INTERVAL '1 month - 1 day') THEN amount_due ELSE 0 END) as due_this_month,
  SUM(CASE WHEN due_date < NOW() THEN amount_due ELSE 0 END) as overdue,
  COUNT(CASE WHEN due_date < NOW() THEN 1 END) as overdue_count
FROM wells_invoices
WHERE status NOT IN ('paid', 'cancelled')
GROUP BY user_id;

-- Pending Deliveries View
CREATE OR REPLACE VIEW wells_pending_deliveries AS
SELECT
  user_id,
  COUNT(*) as pending_count,
  SUM(total_amount) as pending_value,
  MIN(expected_delivery_date) as next_delivery,
  COUNT(CASE WHEN expected_delivery_date < NOW() THEN 1 END) as overdue_count
FROM wells_purchase_orders
WHERE status IN ('sent', 'acknowledged', 'in_production', 'shipped', 'partial_received')
GROUP BY user_id;

-- Monthly Spend Summary View
CREATE OR REPLACE VIEW wells_monthly_spend AS
SELECT
  user_id,
  DATE_TRUNC('month', order_date) as month,
  COUNT(*) as order_count,
  SUM(total_amount) as total_spend,
  SUM(wells_fee) as wells_fees,
  AVG(total_amount) as avg_order_value
FROM wells_purchase_orders
WHERE status NOT IN ('draft', 'cancelled')
GROUP BY user_id, DATE_TRUNC('month', order_date)
ORDER BY month DESC;

-- Vendor Performance View
CREATE OR REPLACE VIEW wells_vendor_performance AS
SELECT
  id as vendor_id,
  user_id,
  name as vendor_name,
  vendor_type,
  status,
  total_orders,
  total_spend,
  average_order_value,
  (performance_score->>'overall')::numeric as overall_score,
  (performance_score->>'delivery')::numeric as delivery_score,
  (performance_score->>'quality')::numeric as quality_score,
  jsonb_array_length(ratings) as rating_count,
  last_order_date
FROM wells_vendors
ORDER BY total_spend DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE wells_vendors IS 'AI-managed vendor/supplier registry for WellsAI ERP';
COMMENT ON TABLE wells_invoices IS 'AI-native invoice management';
COMMENT ON TABLE wells_purchase_orders IS 'AI-native purchase order management';
COMMENT ON TABLE wells_transactions IS 'Unified ledger for all financial transactions';
COMMENT ON TABLE wells_financial_periods IS 'Pre-calculated monthly financial summaries';
COMMENT ON TABLE wells_erp_settings IS 'Per-user ERP configuration and preferences';

COMMENT ON COLUMN wells_invoices.wells_fee IS 'Wells AI 1% transaction fee';
COMMENT ON COLUMN wells_purchase_orders.wells_fee IS 'Wells AI 1% transaction fee';
COMMENT ON COLUMN wells_invoices.created_by_ai IS 'True if invoice was created via conversational AI';
COMMENT ON COLUMN wells_purchase_orders.created_by_ai IS 'True if PO was created via conversational AI';

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get user's accounts payable summary
-- SELECT * FROM wells_accounts_payable WHERE user_id = 'user_xxx';

-- Get pending deliveries
-- SELECT * FROM wells_pending_deliveries WHERE user_id = 'user_xxx';

-- Get monthly spend trend
-- SELECT * FROM wells_monthly_spend WHERE user_id = 'user_xxx' LIMIT 12;

-- Get top vendors by spend
-- SELECT * FROM wells_vendor_performance WHERE user_id = 'user_xxx' ORDER BY total_spend DESC LIMIT 10;

-- Get overdue invoices
-- SELECT * FROM wells_invoices WHERE user_id = 'user_xxx' AND status = 'overdue' ORDER BY due_date ASC;

-- Get POs pending delivery
-- SELECT * FROM wells_purchase_orders
-- WHERE user_id = 'user_xxx' AND status IN ('sent', 'shipped', 'partial_received')
-- ORDER BY expected_delivery_date ASC;

-- ============================================================================
-- CONVERSATION HISTORY TABLE
-- Stores chat sessions for multi-turn ERP conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_erp_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Conversation metadata
  title TEXT, -- Auto-generated from first message
  summary TEXT, -- AI-generated summary
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,

  -- Related entities created during conversation
  related_invoices TEXT[] DEFAULT '{}',
  related_pos TEXT[] DEFAULT '{}',
  related_vendors TEXT[] DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wells_conv_user_id ON wells_erp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_conv_last_message ON wells_erp_conversations(user_id, last_message_at DESC);

-- ============================================================================
-- CONVERSATION MESSAGES TABLE
-- Individual messages within a conversation
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_erp_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES wells_erp_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Tool usage tracking
  tools_used TEXT[] DEFAULT '{}',
  tool_results JSONB DEFAULT '[]',

  -- Entities affected
  entities_created JSONB DEFAULT '[]', -- [{ type: 'invoice', id: 'xxx' }]
  entities_modified JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wells_msg_conversation ON wells_erp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wells_msg_created_at ON wells_erp_messages(conversation_id, created_at);

-- Trigger to update conversation metadata on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE wells_erp_conversations
  SET
    last_message_at = NEW.created_at,
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversation_on_new_message ON wells_erp_messages;
CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON wells_erp_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- INVENTORY TABLE
-- Basic inventory tracking for WellsAI ERP
-- ============================================================================
CREATE TABLE IF NOT EXISTS wells_inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Item Details
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,

  -- Quantities
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_value DECIMAL(20, 2) NOT NULL DEFAULT 0,

  -- Stock Management
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 100,
  location TEXT,

  -- Tracking
  last_restock_date TIMESTAMP,
  last_count_date TIMESTAMP,

  -- AI Tracking
  created_by_ai BOOLEAN DEFAULT false,
  ai_conversation_id TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_wells_inventory_user_id ON wells_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_inventory_sku ON wells_inventory(user_id, sku);
CREATE INDEX IF NOT EXISTS idx_wells_inventory_category ON wells_inventory(user_id, category);
CREATE INDEX IF NOT EXISTS idx_wells_inventory_low_stock ON wells_inventory(user_id) WHERE quantity <= reorder_point;

-- Update inventory timestamp trigger
DROP TRIGGER IF EXISTS update_wells_inventory_timestamp ON wells_inventory;
CREATE TRIGGER update_wells_inventory_timestamp
  BEFORE UPDATE ON wells_inventory
  FOR EACH ROW EXECUTE FUNCTION update_wells_erp_timestamp();

COMMENT ON TABLE wells_inventory IS 'Basic inventory tracking for WellsAI ERP users';

-- ============================================================================
-- SCHEDULED JOBS (to be run via cron or pg_cron)
-- ============================================================================

-- Mark overdue invoices daily:
-- SELECT cron.schedule('mark-overdue-invoices', '0 0 * * *', 'SELECT mark_overdue_invoices()');

-- Recalculate monthly financial periods:
-- Run at month end to calculate period summaries
