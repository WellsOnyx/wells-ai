-- ============================================================================
-- Layer 1: External ERP Connector Network - Database Schema
-- ============================================================================
-- This schema supports the unified integration layer for 200+ ERP systems
-- through external connector providers (Merge, Workato, etc.)
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- INTEGRATION PROVIDERS
-- Stores configuration for external integration providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS nextgen_integration_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('merge', 'workato', 'tray', 'celigo', 'boomi', 'direct')),
    api_base_url VARCHAR(500) NOT NULL,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('oauth2', 'api_key', 'basic')),
    supported_erps TEXT[] NOT NULL, -- Array of ERP system names
    supported_objects TEXT[] NOT NULL, -- Array of object types
    webhooks_enabled BOOLEAN DEFAULT false,
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    is_active BOOLEAN DEFAULT true,
    config JSONB, -- Additional provider-specific configuration
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_providers_provider ON nextgen_integration_providers(provider);
CREATE INDEX idx_integration_providers_active ON nextgen_integration_providers(is_active);

-- ============================================================================
-- INTEGRATION CONNECTIONS
-- Stores individual customer connections to ERP systems
-- ============================================================================

CREATE TABLE IF NOT EXISTS nextgen_integration_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(255) NOT NULL, -- Grain & Vault account ID
    provider_id UUID NOT NULL REFERENCES nextgen_integration_providers(id) ON DELETE CASCADE,
    erp_system VARCHAR(50) NOT NULL CHECK (erp_system IN (
        'sap', 'netsuite', 'oracle', 'dynamics', 'workday', 'sage',
        'quickbooks', 'xero', 'zoho', 'odoo', 'coupa', 'ivalua', 'ariba', 'other'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'connected', 'disconnected', 'error', 'pending', 'expired'
    )),

    -- Authentication (encrypted in application layer)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    api_key TEXT,
    credentials JSONB, -- Encrypted username/password for basic auth

    -- Sync Configuration
    sync_direction VARCHAR(20) DEFAULT 'bidirectional' CHECK (sync_direction IN (
        'inbound', 'outbound', 'bidirectional'
    )),
    sync_frequency VARCHAR(20) DEFAULT 'hourly' CHECK (sync_frequency IN (
        'realtime', 'hourly', 'daily', 'weekly', 'manual'
    )),
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('success', 'partial', 'failed')),
    last_sync_error TEXT,

    -- Field Mappings (custom overrides)
    field_mappings JSONB,

    -- ERP Metadata
    erp_company_id VARCHAR(255),
    erp_company_name VARCHAR(255),
    erp_metadata JSONB, -- Additional ERP-specific metadata

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id, erp_system)
);

CREATE INDEX idx_integration_connections_account ON nextgen_integration_connections(account_id);
CREATE INDEX idx_integration_connections_provider ON nextgen_integration_connections(provider_id);
CREATE INDEX idx_integration_connections_status ON nextgen_integration_connections(status);
CREATE INDEX idx_integration_connections_erp ON nextgen_integration_connections(erp_system);

-- ============================================================================
-- ERP OBJECT STORE
-- Unified storage for normalized ERP objects with raw data preservation
-- ============================================================================

CREATE TABLE IF NOT EXISTS nextgen_erp_object_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES nextgen_integration_connections(id) ON DELETE CASCADE,
    object_type VARCHAR(30) NOT NULL CHECK (object_type IN (
        'purchase_order', 'invoice', 'vendor', 'ledger_entry'
    )),
    external_id VARCHAR(255) NOT NULL,

    -- Normalized data (follows our standard schemas)
    normalized_data JSONB NOT NULL,

    -- Raw data from source system (for debugging and re-mapping)
    raw_data JSONB NOT NULL,

    -- Hash for change detection (MD5 of raw_data)
    data_hash VARCHAR(64) NOT NULL,

    -- Denormalized fields for common queries
    status VARCHAR(50),
    vendor_id VARCHAR(255),
    total_amount DECIMAL(20, 4),
    currency VARCHAR(3),
    document_date DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(connection_id, object_type, external_id)
);

CREATE INDEX idx_erp_object_store_connection ON nextgen_erp_object_store(connection_id);
CREATE INDEX idx_erp_object_store_type ON nextgen_erp_object_store(object_type);
CREATE INDEX idx_erp_object_store_external ON nextgen_erp_object_store(external_id);
CREATE INDEX idx_erp_object_store_status ON nextgen_erp_object_store(status);
CREATE INDEX idx_erp_object_store_vendor ON nextgen_erp_object_store(vendor_id);
CREATE INDEX idx_erp_object_store_date ON nextgen_erp_object_store(document_date);
CREATE INDEX idx_erp_object_store_synced ON nextgen_erp_object_store(synced_at);
CREATE INDEX idx_erp_object_store_normalized ON nextgen_erp_object_store USING gin(normalized_data);

-- ============================================================================
-- SYNC LOGS
-- Detailed logging for all sync operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS nextgen_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES nextgen_integration_connections(id) ON DELETE CASCADE,
    object_type VARCHAR(30) NOT NULL CHECK (object_type IN (
        'purchase_order', 'invoice', 'vendor', 'ledger_entry'
    )),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed')),

    -- Statistics
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,

    -- Error details
    errors JSONB, -- Array of { recordId, error } objects

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER, -- Duration in milliseconds

    -- Trigger info
    triggered_by VARCHAR(50), -- 'schedule', 'webhook', 'manual', 'api'
    triggered_by_user VARCHAR(255)
);

CREATE INDEX idx_sync_logs_connection ON nextgen_sync_logs(connection_id);
CREATE INDEX idx_sync_logs_status ON nextgen_sync_logs(status);
CREATE INDEX idx_sync_logs_started ON nextgen_sync_logs(started_at);
CREATE INDEX idx_sync_logs_object_type ON nextgen_sync_logs(object_type);

-- ============================================================================
-- OBJECT MAPPINGS
-- Custom field mappings per ERP system and object type
-- ============================================================================

CREATE TABLE IF NOT EXISTS nextgen_object_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    erp_system VARCHAR(50) NOT NULL,
    object_type VARCHAR(30) NOT NULL CHECK (object_type IN (
        'purchase_order', 'invoice', 'vendor', 'ledger_entry'
    )),
    provider_id UUID REFERENCES nextgen_integration_providers(id) ON DELETE SET NULL,

    -- Mapping configuration
    field_mappings JSONB NOT NULL, -- Array of { sourceField, targetField, transform, defaultValue }
    status_mapping JSONB, -- Map of source status → normalized status

    -- Version control
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(erp_system, object_type, version)
);

CREATE INDEX idx_object_mappings_erp ON nextgen_object_mappings(erp_system);
CREATE INDEX idx_object_mappings_type ON nextgen_object_mappings(object_type);
CREATE INDEX idx_object_mappings_active ON nextgen_object_mappings(is_active);

-- ============================================================================
-- WEBHOOK EVENTS
-- Queue for incoming webhook events from integration providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS nextgen_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    connection_id UUID REFERENCES nextgen_integration_connections(id) ON DELETE SET NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('create', 'update', 'delete')),
    object_type VARCHAR(30) NOT NULL,
    external_id VARCHAR(255),

    -- Payload
    payload JSONB NOT NULL,

    -- Processing status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    processed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER DEFAULT 0,

    received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_status ON nextgen_webhook_events(status);
CREATE INDEX idx_webhook_events_received ON nextgen_webhook_events(received_at);
CREATE INDEX idx_webhook_events_connection ON nextgen_webhook_events(connection_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_integration_providers_updated_at
    BEFORE UPDATE ON nextgen_integration_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_connections_updated_at
    BEFORE UPDATE ON nextgen_integration_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_erp_object_store_updated_at
    BEFORE UPDATE ON nextgen_erp_object_store
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_object_mappings_updated_at
    BEFORE UPDATE ON nextgen_object_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Default Object Mappings for Common ERPs
-- ============================================================================

-- SAP Purchase Order Mapping
INSERT INTO nextgen_object_mappings (erp_system, object_type, field_mappings, status_mapping) VALUES
('sap', 'purchase_order', '{
    "fieldMappings": [
        {"sourceField": "EBELN", "targetField": "poNumber"},
        {"sourceField": "LIFNR", "targetField": "vendorId"},
        {"sourceField": "NAME1", "targetField": "vendorName"},
        {"sourceField": "NETWR", "targetField": "totalAmount", "transform": "number"},
        {"sourceField": "WAERS", "targetField": "currency"},
        {"sourceField": "AEDAT", "targetField": "createdAt", "transform": "date"},
        {"sourceField": "BANFN", "targetField": "customFields.requisitionNumber"},
        {"sourceField": "BUKRS", "targetField": "customFields.companyCode"},
        {"sourceField": "EKORG", "targetField": "customFields.purchasingOrg"}
    ]
}'::jsonb, '{
    "": "draft",
    "01": "pending_approval",
    "02": "approved",
    "03": "sent",
    "05": "received",
    "09": "closed"
}'::jsonb)
ON CONFLICT (erp_system, object_type, version) DO NOTHING;

-- NetSuite Purchase Order Mapping
INSERT INTO nextgen_object_mappings (erp_system, object_type, field_mappings, status_mapping) VALUES
('netsuite', 'purchase_order', '{
    "fieldMappings": [
        {"sourceField": "tranid", "targetField": "poNumber"},
        {"sourceField": "entity.id", "targetField": "vendorId"},
        {"sourceField": "entity.name", "targetField": "vendorName"},
        {"sourceField": "total", "targetField": "totalAmount", "transform": "number"},
        {"sourceField": "currency.symbol", "targetField": "currency"},
        {"sourceField": "trandate", "targetField": "createdAt", "transform": "date"},
        {"sourceField": "subsidiary.name", "targetField": "customFields.subsidiary"},
        {"sourceField": "department.name", "targetField": "department"},
        {"sourceField": "location.name", "targetField": "customFields.location"}
    ]
}'::jsonb, '{
    "pendingApproval": "pending_approval",
    "pendingSupervisorApproval": "pending_approval",
    "approved": "approved",
    "partiallyReceived": "partially_received",
    "pendingReceipt": "sent",
    "pendingBilling": "invoiced",
    "fullyBilled": "closed",
    "closed": "closed"
}'::jsonb)
ON CONFLICT (erp_system, object_type, version) DO NOTHING;

-- QuickBooks Invoice Mapping
INSERT INTO nextgen_object_mappings (erp_system, object_type, field_mappings, status_mapping) VALUES
('quickbooks', 'invoice', '{
    "fieldMappings": [
        {"sourceField": "DocNumber", "targetField": "invoiceNumber"},
        {"sourceField": "VendorRef.value", "targetField": "vendorId"},
        {"sourceField": "VendorRef.name", "targetField": "vendorName"},
        {"sourceField": "TotalAmt", "targetField": "totalAmount", "transform": "number"},
        {"sourceField": "CurrencyRef.value", "targetField": "currency"},
        {"sourceField": "TxnDate", "targetField": "invoiceDate", "transform": "date"},
        {"sourceField": "DueDate", "targetField": "dueDate", "transform": "date"},
        {"sourceField": "Balance", "targetField": "amountDue", "transform": "number"}
    ]
}'::jsonb, '{
    "Draft": "draft",
    "Pending": "pending_approval",
    "Overdue": "overdue",
    "Paid": "paid",
    "Voided": "cancelled"
}'::jsonb)
ON CONFLICT (erp_system, object_type, version) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Active connections with provider info
CREATE OR REPLACE VIEW nextgen_v_active_connections AS
SELECT
    c.id,
    c.account_id,
    c.erp_system,
    c.status,
    c.sync_direction,
    c.sync_frequency,
    c.last_sync_at,
    c.last_sync_status,
    c.erp_company_name,
    p.name as provider_name,
    p.provider as provider_type,
    p.webhooks_enabled
FROM nextgen_integration_connections c
JOIN nextgen_integration_providers p ON c.provider_id = p.id
WHERE c.status = 'connected' AND p.is_active = true;

-- View: Sync summary by connection
CREATE OR REPLACE VIEW nextgen_v_sync_summary AS
SELECT
    c.id as connection_id,
    c.account_id,
    c.erp_system,
    COUNT(l.id) as total_syncs,
    SUM(CASE WHEN l.status = 'completed' THEN 1 ELSE 0 END) as successful_syncs,
    SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
    SUM(l.records_processed) as total_records_processed,
    SUM(l.records_created) as total_records_created,
    SUM(l.records_updated) as total_records_updated,
    MAX(l.started_at) as last_sync_attempt,
    AVG(l.duration_ms) as avg_sync_duration_ms
FROM nextgen_integration_connections c
LEFT JOIN nextgen_sync_logs l ON c.id = l.connection_id
GROUP BY c.id, c.account_id, c.erp_system;

-- View: Object counts by type and connection
CREATE OR REPLACE VIEW nextgen_v_object_counts AS
SELECT
    connection_id,
    object_type,
    COUNT(*) as total_objects,
    COUNT(CASE WHEN synced_at > NOW() - INTERVAL '24 hours' THEN 1 END) as synced_last_24h,
    MIN(synced_at) as oldest_sync,
    MAX(synced_at) as newest_sync
FROM nextgen_erp_object_store
GROUP BY connection_id, object_type;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE nextgen_integration_providers IS 'External integration providers (Merge, Workato, etc.) configuration';
COMMENT ON TABLE nextgen_integration_connections IS 'Individual customer connections to ERP systems';
COMMENT ON TABLE nextgen_erp_object_store IS 'Unified storage for normalized ERP objects from all sources';
COMMENT ON TABLE nextgen_sync_logs IS 'Detailed audit logs for all sync operations';
COMMENT ON TABLE nextgen_object_mappings IS 'Field mapping configurations per ERP and object type';
COMMENT ON TABLE nextgen_webhook_events IS 'Queue for incoming webhook events from providers';
