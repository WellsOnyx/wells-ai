-- ERP Connections and Intercepts Schema
-- "The Silent Invasion" - Auto-capture supplier networks through ERP integration

-- ERP Connection Tracking
CREATE TABLE IF NOT EXISTS erp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'quickbooks', 'xero', 'codat', 'netsuite', etc.
  connection_status VARCHAR(50) DEFAULT 'active', -- 'active', 'disconnected', 'error', 'pending'

  -- OAuth Credentials (encrypted)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  realm_id TEXT, -- QuickBooks company ID
  tenant_id TEXT, -- Xero tenant ID
  company_key TEXT, -- Codat company ID

  -- Connection Metadata
  company_name TEXT,
  company_currency VARCHAR(3) DEFAULT 'USD',
  accounting_method VARCHAR(20), -- 'accrual', 'cash'
  fiscal_year_start DATE,

  -- Sync Status
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(50),
  last_sync_error TEXT,
  next_sync_at TIMESTAMPTZ,
  sync_frequency_hours INTEGER DEFAULT 24,

  -- Webhook Configuration
  webhook_id TEXT,
  webhook_secret TEXT,
  webhook_enabled BOOLEAN DEFAULT false,

  -- Feature Flags
  auto_intercept_enabled BOOLEAN DEFAULT true,
  auto_vendor_enrollment BOOLEAN DEFAULT true,
  min_invoice_amount DECIMAL(15,2) DEFAULT 100.00,
  max_invoice_amount DECIMAL(15,2) DEFAULT 50000.00,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, provider)
);

-- Bills/Invoices from ERP Systems
CREATE TABLE IF NOT EXISTS erp_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID REFERENCES erp_connections(id) ON DELETE CASCADE,

  -- External IDs
  external_bill_id TEXT NOT NULL,
  external_vendor_id TEXT,

  -- Bill Details
  bill_number TEXT,
  vendor_name TEXT NOT NULL,
  vendor_email TEXT,
  vendor_phone TEXT,

  -- Financial Details
  total_amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Dates
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms TEXT, -- 'Net 30', 'Net 60', etc.

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'intercepted', 'paid_external', 'cancelled'
  paid_status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
  amount_paid DECIMAL(15,2) DEFAULT 0,

  -- Intercept Opportunity
  intercept_proposed BOOLEAN DEFAULT false,
  intercept_proposed_at TIMESTAMPTZ,
  intercept_accepted BOOLEAN DEFAULT false,
  intercept_accepted_at TIMESTAMPTZ,
  intercept_executed BOOLEAN DEFAULT false,
  intercept_executed_at TIMESTAMPTZ,

  -- Wells Revenue Calculation
  wells_fee_amount DECIMAL(15,2), -- 1% of total
  payment_cost_saved DECIMAL(15,2), -- Wire fee, check processing, etc.
  net_customer_savings DECIMAL(15,2),

  -- Metadata
  line_items JSONB, -- Detailed line items from invoice
  memo TEXT,
  raw_data JSONB, -- Full ERP response

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(erp_connection_id, external_bill_id)
);

-- Vendors/Suppliers from ERP
CREATE TABLE IF NOT EXISTS erp_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID REFERENCES erp_connections(id) ON DELETE CASCADE,

  -- External IDs
  external_vendor_id TEXT NOT NULL,

  -- Vendor Information
  vendor_name TEXT NOT NULL,
  vendor_display_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',

  -- Banking Details (if available)
  bank_account_number TEXT,
  routing_number TEXT,
  payment_method VARCHAR(50), -- 'ach', 'wire', 'check', 'card'

  -- Vendor Metadata
  tax_id TEXT,
  vendor_type TEXT,
  payment_terms TEXT,
  default_currency VARCHAR(3) DEFAULT 'USD',

  -- Silent Enrollment Status
  enrolled_in_wells BOOLEAN DEFAULT false,
  enrollment_date TIMESTAMPTZ,
  enrollment_method VARCHAR(50), -- 'erp_intercept', 'manual', 'widget'
  wells_supplier_id UUID, -- Reference to suppliers table

  -- Statistics
  total_bills_count INTEGER DEFAULT 0,
  total_amount_paid DECIMAL(15,2) DEFAULT 0,
  last_payment_date DATE,
  average_invoice_amount DECIMAL(15,2),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  raw_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(erp_connection_id, external_vendor_id)
);

-- ERP Payment History
CREATE TABLE IF NOT EXISTS erp_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID REFERENCES erp_connections(id) ON DELETE CASCADE,
  erp_bill_id UUID REFERENCES erp_bills(id) ON DELETE SET NULL,

  -- External IDs
  external_payment_id TEXT NOT NULL,
  external_vendor_id TEXT,

  -- Payment Details
  payment_amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50), -- 'ach', 'wire', 'check', 'card', 'wells'
  payment_date DATE NOT NULL,

  -- Wells Intercept
  processed_by_wells BOOLEAN DEFAULT false,
  wells_transaction_id UUID,
  wells_fee_collected DECIMAL(15,2),

  -- Bank Details
  bank_account_id TEXT,
  check_number TEXT,
  reference_number TEXT,

  -- Metadata
  memo TEXT,
  raw_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(erp_connection_id, external_payment_id)
);

-- Intercept Opportunities (The Money Maker)
CREATE TABLE IF NOT EXISTS erp_intercepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_bill_id UUID REFERENCES erp_bills(id) ON DELETE CASCADE,
  erp_connection_id UUID REFERENCES erp_connections(id) ON DELETE CASCADE,

  -- Opportunity Details
  bill_amount DECIMAL(15,2) NOT NULL,
  wells_fee DECIMAL(15,2) NOT NULL, -- 1% we earn
  customer_current_cost DECIMAL(15,2), -- Their wire/check fee
  customer_savings DECIMAL(15,2), -- How much they save

  -- Proposal
  proposed_at TIMESTAMPTZ DEFAULT NOW(),
  proposal_expires_at TIMESTAMPTZ,
  proposal_message TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'proposed', -- 'proposed', 'accepted', 'rejected', 'executed', 'expired'
  responded_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,

  -- Execution Details
  wells_payment_id UUID,
  vendor_enrolled BOOLEAN DEFAULT false,
  vendor_enrollment_id UUID,

  -- Revenue Tracking
  revenue_captured DECIMAL(15,2), -- Actual fee collected

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync Jobs/Logs
CREATE TABLE IF NOT EXISTS erp_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID REFERENCES erp_connections(id) ON DELETE CASCADE,

  sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'bills', 'vendors', 'payments'
  status VARCHAR(50) NOT NULL, -- 'started', 'completed', 'failed'

  -- Metrics
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Results
  bills_found INTEGER DEFAULT 0,
  vendors_found INTEGER DEFAULT 0,
  payments_found INTEGER DEFAULT 0,
  intercepts_created INTEGER DEFAULT 0,

  -- Error Tracking
  error_message TEXT,
  error_stack TEXT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

-- Webhook Events
CREATE TABLE IF NOT EXISTS erp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID REFERENCES erp_connections(id) ON DELETE CASCADE,

  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'invoice.created', 'invoice.updated', 'payment.created'

  -- Event Data
  external_entity_id TEXT,
  entity_type VARCHAR(50), -- 'invoice', 'payment', 'vendor'

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,

  -- Raw Data
  payload JSONB NOT NULL,
  headers JSONB,

  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_erp_connections_company ON erp_connections(company_id);
CREATE INDEX idx_erp_connections_status ON erp_connections(connection_status);
CREATE INDEX idx_erp_connections_next_sync ON erp_connections(next_sync_at) WHERE connection_status = 'active';

CREATE INDEX idx_erp_bills_connection ON erp_bills(erp_connection_id);
CREATE INDEX idx_erp_bills_status ON erp_bills(status);
CREATE INDEX idx_erp_bills_due_date ON erp_bills(due_date);
CREATE INDEX idx_erp_bills_unpaid ON erp_bills(erp_connection_id, status) WHERE status = 'pending';

CREATE INDEX idx_erp_vendors_connection ON erp_vendors(erp_connection_id);
CREATE INDEX idx_erp_vendors_enrolled ON erp_vendors(enrolled_in_wells);
CREATE INDEX idx_erp_vendors_email ON erp_vendors(email);

CREATE INDEX idx_erp_payments_connection ON erp_payments(erp_connection_id);
CREATE INDEX idx_erp_payments_bill ON erp_payments(erp_bill_id);
CREATE INDEX idx_erp_payments_wells ON erp_payments(processed_by_wells);

CREATE INDEX idx_erp_intercepts_status ON erp_intercepts(status);
CREATE INDEX idx_erp_intercepts_proposed ON erp_intercepts(proposed_at);
CREATE INDEX idx_erp_intercepts_bill ON erp_intercepts(erp_bill_id);

CREATE INDEX idx_erp_sync_logs_connection ON erp_sync_logs(erp_connection_id);
CREATE INDEX idx_erp_sync_logs_started ON erp_sync_logs(started_at DESC);

CREATE INDEX idx_erp_webhook_events_unprocessed ON erp_webhook_events(received_at) WHERE processed = false;
CREATE INDEX idx_erp_webhook_events_connection ON erp_webhook_events(erp_connection_id);
