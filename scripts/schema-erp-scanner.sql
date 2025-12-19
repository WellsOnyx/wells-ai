-- ERP Scanner Schema
-- Proactive procurement opportunity detection for buyers

-- ERP Connections
CREATE TABLE IF NOT EXISTS erp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  erp_type TEXT NOT NULL, -- 'quickbooks', 'xero', 'netsuite', 'sap', 'coupa', 'oracle'
  connection_status TEXT DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
  last_sync_at TIMESTAMPTZ,
  credentials JSONB, -- Encrypted credentials
  settings JSONB, -- Scanner settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Procurement Opportunities (detected by scanner)
CREATE TABLE IF NOT EXISTS procurement_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  erp_connection_id UUID REFERENCES erp_connections(id),
  type TEXT NOT NULL, -- 'low_inventory', 'contract_expiring', 'recurring_spend', 'price_increase', etc.
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  title TEXT NOT NULL,
  description TEXT,
  estimated_value DECIMAL(20,2),
  estimated_savings DECIMAL(20,2),
  data JSONB, -- Type-specific data
  suggested_action TEXT,
  status TEXT DEFAULT 'new', -- 'new', 'reviewed', 'actioned', 'dismissed'
  rfq_id UUID, -- If RFQ was created from this
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_erp_connections_user ON erp_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_erp_connections_type ON erp_connections(erp_type);
CREATE INDEX IF NOT EXISTS idx_procurement_opportunities_user ON procurement_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_opportunities_status ON procurement_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_procurement_opportunities_priority ON procurement_opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_procurement_opportunities_type ON procurement_opportunities(type);
