/**
 * ERP Integration Database Schema
 * Tracks Merge.dev connections and ERP syncs for Wells AI deals
 *
 * Supports: SAP, Oracle, NetSuite, Workday, Coupa, Ariba, and 100+ ERPs via Merge.dev
 */

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Merge.dev Account Tokens
-- Stores customer's ERP connection via Merge.dev OAuth
CREATE TABLE IF NOT EXISTS merge_account_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id VARCHAR(255) NOT NULL, -- Wells AI customer ID
  account_token TEXT NOT NULL, -- Merge.dev account token (encrypted in production)
  integration_name VARCHAR(100) NOT NULL, -- e.g., 'netsuite', 'sap', 'workday'
  integration_slug VARCHAR(100),
  organization_name VARCHAR(255),
  end_user_email VARCHAR(255),
  end_user_origin_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  is_test_account BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, integration_name)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_merge_account_tokens_customer ON merge_account_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_merge_account_tokens_active ON merge_account_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_merge_account_tokens_integration ON merge_account_tokens(integration_name);

-- ERP Syncs
-- Tracks all Wells AI deal syncs to customer ERPs
CREATE TABLE IF NOT EXISTS erp_syncs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  customer_id VARCHAR(255) NOT NULL,
  integration_name VARCHAR(100) NOT NULL, -- e.g., 'netsuite', 'sap', 'workday'

  -- Vendor (supplier) info
  erp_vendor_id VARCHAR(255), -- Vendor ID in customer's ERP
  erp_vendor_name VARCHAR(255),

  -- Purchase Order info
  erp_po_id VARCHAR(255), -- PO ID in customer's ERP
  erp_po_number VARCHAR(255),
  erp_po_status VARCHAR(50),

  -- Invoice info (optional)
  erp_invoice_id VARCHAR(255),
  erp_invoice_number VARCHAR(255),

  -- Sync status
  status VARCHAR(50) DEFAULT 'pending', -- pending, syncing, synced, failed
  synced_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Raw data from Merge.dev
  sync_data JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for sync tracking
CREATE INDEX IF NOT EXISTS idx_erp_syncs_deal ON erp_syncs(deal_id);
CREATE INDEX IF NOT EXISTS idx_erp_syncs_customer ON erp_syncs(customer_id);
CREATE INDEX IF NOT EXISTS idx_erp_syncs_status ON erp_syncs(status);
CREATE INDEX IF NOT EXISTS idx_erp_syncs_integration ON erp_syncs(integration_name);
CREATE INDEX IF NOT EXISTS idx_erp_syncs_created ON erp_syncs(created_at DESC);

-- ERP Sync History
-- Tracks all sync attempts (for debugging)
CREATE TABLE IF NOT EXISTS erp_sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  erp_sync_id UUID REFERENCES erp_syncs(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, syncing, synced, failed
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  request_data JSONB,
  response_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_erp_sync_history_sync ON erp_sync_history(erp_sync_id);
CREATE INDEX IF NOT EXISTS idx_erp_sync_history_deal ON erp_sync_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_erp_sync_history_created ON erp_sync_history(created_at DESC);

-- ERP Webhooks
-- Stores webhooks from Merge.dev (PO approved, invoice paid, etc.)
CREATE TABLE IF NOT EXISTS erp_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_token VARCHAR(255),
  event_type VARCHAR(100) NOT NULL, -- e.g., 'purchase_order.updated', 'invoice.paid'
  resource_type VARCHAR(100), -- e.g., 'purchase_order', 'invoice', 'vendor'
  resource_id VARCHAR(255),
  integration_name VARCHAR(100),
  webhook_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for webhook processing
CREATE INDEX IF NOT EXISTS idx_erp_webhooks_processed ON erp_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_erp_webhooks_event_type ON erp_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_erp_webhooks_resource ON erp_webhooks(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_erp_webhooks_created ON erp_webhooks(created_at DESC);

-- Supplier ERP Mapping
-- Maps Wells AI suppliers to vendor IDs in customer ERPs
CREATE TABLE IF NOT EXISTS supplier_erp_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  customer_id VARCHAR(255) NOT NULL,
  integration_name VARCHAR(100) NOT NULL,
  erp_vendor_id VARCHAR(255) NOT NULL,
  erp_vendor_name VARCHAR(255),
  last_synced_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(supplier_id, customer_id, integration_name)
);

-- Index for supplier mappings
CREATE INDEX IF NOT EXISTS idx_supplier_erp_mappings_supplier ON supplier_erp_mappings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_erp_mappings_customer ON supplier_erp_mappings(customer_id);
CREATE INDEX IF NOT EXISTS idx_supplier_erp_mappings_erp_vendor ON supplier_erp_mappings(erp_vendor_id);

-- Add merge_vendor_id to suppliers table (if not exists)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS merge_vendor_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_suppliers_merge_vendor ON suppliers(merge_vendor_id);

-- View: ERP Sync Analytics
CREATE OR REPLACE VIEW erp_sync_analytics AS
SELECT
  mat.integration_name,
  mat.organization_name,
  mat.customer_id,
  COUNT(DISTINCT es.deal_id) as total_syncs,
  COUNT(CASE WHEN es.status = 'synced' THEN 1 END) as successful_syncs,
  COUNT(CASE WHEN es.status = 'failed' THEN 1 END) as failed_syncs,
  COUNT(CASE WHEN es.status = 'pending' THEN 1 END) as pending_syncs,
  SUM(CASE WHEN es.status = 'synced' THEN (es.sync_data->>'amount')::numeric ELSE 0 END) as total_synced_amount,
  MAX(es.synced_at) as last_sync_at,
  mat.is_active as integration_active
FROM merge_account_tokens mat
LEFT JOIN erp_syncs es ON mat.customer_id = es.customer_id AND mat.integration_name = es.integration_name
GROUP BY mat.integration_name, mat.organization_name, mat.customer_id, mat.is_active;

-- View: Failed Syncs for Retry
CREATE OR REPLACE VIEW failed_erp_syncs AS
SELECT
  es.id,
  es.deal_id,
  es.customer_id,
  es.integration_name,
  es.error_message,
  es.retry_count,
  es.updated_at,
  d.amount,
  d.status as deal_status,
  s.name as supplier_name
FROM erp_syncs es
JOIN deals d ON es.deal_id = d.id
JOIN suppliers s ON d.supplier_id = s.id
WHERE es.status = 'failed' AND es.retry_count < 3
ORDER BY es.updated_at DESC;

-- View: Recent ERP Syncs
CREATE OR REPLACE VIEW recent_erp_syncs AS
SELECT
  es.id,
  es.deal_id,
  es.customer_id,
  es.integration_name,
  mat.organization_name,
  es.erp_po_number,
  es.status,
  es.synced_at,
  d.amount,
  d.wells_fee,
  s.name as supplier_name
FROM erp_syncs es
JOIN merge_account_tokens mat ON es.customer_id = mat.customer_id AND es.integration_name = mat.integration_name
JOIN deals d ON es.deal_id = d.id
JOIN suppliers s ON d.supplier_id = s.id
WHERE es.synced_at > NOW() - INTERVAL '30 days'
ORDER BY es.synced_at DESC;

-- Function: Auto-sync deal to ERP
CREATE OR REPLACE FUNCTION auto_sync_deal_to_erp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-sync when deal becomes 'paid' or 'completed'
  IF (NEW.status = 'paid' OR NEW.status = 'completed') AND (OLD.status IS NULL OR (OLD.status != 'paid' AND OLD.status != 'completed')) THEN
    -- Check if customer has active ERP integration
    IF EXISTS (
      SELECT 1 FROM merge_account_tokens
      WHERE customer_id = NEW.buyer_id AND is_active = true
    ) THEN
      -- Create pending sync record
      INSERT INTO erp_syncs (deal_id, customer_id, status)
      SELECT NEW.id, NEW.buyer_id, 'pending'
      ON CONFLICT (deal_id) DO NOTHING;

      -- In production, trigger background job to sync
      -- For now, this creates the record that the API endpoint will process
      PERFORM pg_notify('erp_sync_needed', json_build_object('dealId', NEW.id, 'customerId', NEW.buyer_id)::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-sync deals on status change
DROP TRIGGER IF EXISTS trigger_auto_sync_deal_to_erp ON deals;
CREATE TRIGGER trigger_auto_sync_deal_to_erp
AFTER INSERT OR UPDATE OF status ON deals
FOR EACH ROW
EXECUTE FUNCTION auto_sync_deal_to_erp();

-- Function: Get ERP sync stats for customer
CREATE OR REPLACE FUNCTION get_customer_erp_stats(p_customer_id VARCHAR)
RETURNS TABLE (
  integration_name VARCHAR,
  organization_name VARCHAR,
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  total_amount NUMERIC,
  last_sync_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mat.integration_name,
    mat.organization_name,
    COUNT(es.id) as total_syncs,
    COUNT(CASE WHEN es.status = 'synced' THEN 1 END) as successful_syncs,
    COUNT(CASE WHEN es.status = 'failed' THEN 1 END) as failed_syncs,
    SUM(CASE WHEN es.status = 'synced' THEN (es.sync_data->>'amount')::numeric ELSE 0 END) as total_amount,
    MAX(es.synced_at) as last_sync_at
  FROM merge_account_tokens mat
  LEFT JOIN erp_syncs es ON mat.customer_id = es.customer_id AND mat.integration_name = es.integration_name
  WHERE mat.customer_id = p_customer_id
  GROUP BY mat.integration_name, mat.organization_name;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE merge_account_tokens IS 'Stores customer ERP connections via Merge.dev OAuth';
COMMENT ON TABLE erp_syncs IS 'Tracks Wells AI deal syncs to customer ERPs (SAP, Oracle, NetSuite, etc.)';
COMMENT ON TABLE erp_sync_history IS 'Audit trail of all ERP sync attempts for debugging';
COMMENT ON TABLE erp_webhooks IS 'Stores webhooks from Merge.dev for ERP events';
COMMENT ON TABLE supplier_erp_mappings IS 'Maps Wells AI suppliers to vendor IDs in customer ERPs';
COMMENT ON VIEW erp_sync_analytics IS 'Analytics for ERP sync performance by customer and integration';
COMMENT ON VIEW failed_erp_syncs IS 'Failed syncs that need to be retried';
COMMENT ON VIEW recent_erp_syncs IS 'Recent ERP syncs in last 30 days';
COMMENT ON TRIGGER trigger_auto_sync_deal_to_erp ON deals IS 'Automatically triggers ERP sync when deal is paid/completed';
