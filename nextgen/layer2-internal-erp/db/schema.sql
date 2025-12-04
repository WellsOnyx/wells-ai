-- ============================================================================
-- Layer 2: Grain & Vault Internal ERP (Side-car ERP) - Database Schema
-- ============================================================================
-- A complete, modular ERP subsystem that can act as system of record
-- and integrates with conversational UI (WellsAI)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CHART OF ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code VARCHAR(50) NOT NULL UNIQUE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN (
        'asset', 'liability', 'equity', 'revenue', 'expense',
        'contra_asset', 'contra_liability', 'contra_equity'
    )),
    account_subtype VARCHAR(30) CHECK (account_subtype IN (
        'cash', 'accounts_receivable', 'inventory', 'prepaid', 'fixed_asset',
        'accounts_payable', 'accrued_liability', 'long_term_debt',
        'retained_earnings', 'common_stock', 'service_revenue', 'product_revenue',
        'cost_of_goods', 'operating_expense', 'grain_treasury', 'float_balance',
        'yield_accrual', 'escrow_holding'
    )),
    parent_account_id UUID REFERENCES gv_chart_of_accounts(id) ON DELETE SET NULL,
    description TEXT,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_account BOOLEAN NOT NULL DEFAULT false,
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    is_treasury_account BOOLEAN DEFAULT false,
    grain_linked BOOLEAN DEFAULT false,
    opening_balance DECIMAL(20, 4) DEFAULT 0,
    current_balance DECIMAL(20, 4) DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_gv_coa_type ON gv_chart_of_accounts(account_type);
CREATE INDEX idx_gv_coa_parent ON gv_chart_of_accounts(parent_account_id);
CREATE INDEX idx_gv_coa_active ON gv_chart_of_accounts(is_active);
CREATE INDEX idx_gv_coa_treasury ON gv_chart_of_accounts(is_treasury_account);

-- ============================================================================
-- VENDORS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_code VARCHAR(50) NOT NULL UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    dba VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_verification' CHECK (status IN (
        'pending_verification', 'active', 'suspended', 'blocked', 'archived'
    )),

    -- Tax & Legal
    tax_id VARCHAR(50),
    tax_id_type VARCHAR(10) CHECK (tax_id_type IN ('ein', 'ssn', 'vat', 'gst', 'other')),
    tax_id_verified BOOLEAN DEFAULT false,
    w9_on_file BOOLEAN DEFAULT false,
    w8_on_file BOOLEAN DEFAULT false,

    -- Primary Contact
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),

    -- Billing Address
    billing_street1 VARCHAR(255),
    billing_street2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(50),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(2) DEFAULT 'US',

    -- Payment Configuration
    payment_preference VARCHAR(20) NOT NULL DEFAULT 'ach' CHECK (payment_preference IN (
        'grain', 'ach', 'wire', 'check', 'card'
    )),
    payment_terms VARCHAR(50) NOT NULL DEFAULT 'Net30',
    default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- GRAIN Wallet
    grain_wallet_address VARCHAR(100),
    grain_wallet_verified BOOLEAN DEFAULT false,

    -- Bank Account (encrypted at application level)
    bank_name VARCHAR(255),
    bank_account_number TEXT,
    bank_routing_number TEXT,
    bank_account_type VARCHAR(10) CHECK (bank_account_type IN ('checking', 'savings')),
    bank_account_verified BOOLEAN DEFAULT false,

    -- Classification
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',

    -- Credit & Risk
    credit_limit DECIMAL(20, 4),
    credit_used DECIMAL(20, 4) DEFAULT 0,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    payment_rating INTEGER CHECK (payment_rating >= 0 AND payment_rating <= 100),

    -- Integration
    external_erp_id VARCHAR(255),
    external_erp_system VARCHAR(50),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ
);

CREATE INDEX idx_gv_vendors_status ON gv_vendors(status);
CREATE INDEX idx_gv_vendors_payment_pref ON gv_vendors(payment_preference);
CREATE INDEX idx_gv_vendors_grain_wallet ON gv_vendors(grain_wallet_address) WHERE grain_wallet_address IS NOT NULL;
CREATE INDEX idx_gv_vendors_categories ON gv_vendors USING gin(categories);
CREATE INDEX idx_gv_vendors_external ON gv_vendors(external_erp_id, external_erp_system);

-- ============================================================================
-- PURCHASE ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(50) NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES gv_vendors(id),
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_approval', 'approved', 'sent_to_vendor', 'acknowledged',
        'partially_fulfilled', 'fulfilled', 'invoiced', 'closed', 'cancelled'
    )),

    -- References
    requisition_id VARCHAR(100),
    contract_id VARCHAR(100),
    external_erp_id VARCHAR(255),

    -- Header Info
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    shipping_method VARCHAR(100),

    -- Ship To Address
    ship_to_street1 VARCHAR(255),
    ship_to_street2 VARCHAR(255),
    ship_to_city VARCHAR(100),
    ship_to_state VARCHAR(50),
    ship_to_postal_code VARCHAR(20),
    ship_to_country VARCHAR(2),

    -- Amounts
    subtotal DECIMAL(20, 4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(20, 4) NOT NULL DEFAULT 0,
    shipping_amount DECIMAL(20, 4) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(20, 4) NOT NULL DEFAULT 0,
    total_amount DECIMAL(20, 4) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- Payment Terms
    payment_terms VARCHAR(50),
    payment_due_date DATE,

    -- Tracking
    cost_center VARCHAR(50),
    department VARCHAR(100),
    project VARCHAR(100),
    budget_code VARCHAR(50),

    -- Approval
    requested_by VARCHAR(255),
    approved_by VARCHAR(255),
    approval_date TIMESTAMPTZ,
    approval_notes TEXT,

    -- Notes
    internal_notes TEXT,
    vendor_notes TEXT,
    attachment_ids TEXT[],

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_gv_po_vendor ON gv_purchase_orders(vendor_id);
CREATE INDEX idx_gv_po_status ON gv_purchase_orders(status);
CREATE INDEX idx_gv_po_date ON gv_purchase_orders(order_date);
CREATE INDEX idx_gv_po_cost_center ON gv_purchase_orders(cost_center);
CREATE INDEX idx_gv_po_department ON gv_purchase_orders(department);

-- PO Line Items
CREATE TABLE IF NOT EXISTS gv_po_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES gv_purchase_orders(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_code VARCHAR(100),
    description TEXT NOT NULL,
    quantity DECIMAL(20, 4) NOT NULL,
    quantity_received DECIMAL(20, 4) DEFAULT 0,
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'EA',
    unit_price DECIMAL(20, 4) NOT NULL,
    discount DECIMAL(20, 4) DEFAULT 0,
    tax_rate DECIMAL(6, 4) DEFAULT 0,
    line_total DECIMAL(20, 4) NOT NULL,
    account_code VARCHAR(50),
    cost_center VARCHAR(50),
    project VARCHAR(100),
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(purchase_order_id, line_number)
);

CREATE INDEX idx_gv_po_line_po ON gv_po_line_items(purchase_order_id);

-- ============================================================================
-- INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES gv_vendors(id),
    vendor_invoice_number VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'received' CHECK (status IN (
        'received', 'pending_review', 'pending_approval', 'approved', 'disputed',
        'scheduled', 'partially_paid', 'paid', 'overdue', 'cancelled', 'written_off'
    )),

    -- References
    purchase_order_id UUID REFERENCES gv_purchase_orders(id),
    purchase_order_number VARCHAR(50),
    receipt_id VARCHAR(100),
    external_erp_id VARCHAR(255),

    -- Dates
    invoice_date DATE NOT NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_date TIMESTAMPTZ,

    -- Amounts
    subtotal DECIMAL(20, 4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(20, 4) NOT NULL DEFAULT 0,
    shipping_amount DECIMAL(20, 4) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(20, 4) NOT NULL DEFAULT 0,
    total_amount DECIMAL(20, 4) NOT NULL,
    amount_paid DECIMAL(20, 4) NOT NULL DEFAULT 0,
    amount_due DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- Payment
    payment_terms VARCHAR(50),
    payment_method VARCHAR(20) CHECK (payment_method IN ('grain', 'ach', 'wire', 'check', 'virtual_card')),
    payment_id UUID,

    -- Three-Way Match
    po_matched BOOLEAN DEFAULT false,
    receipt_matched BOOLEAN DEFAULT false,
    price_variance DECIMAL(20, 4),
    quantity_variance DECIMAL(20, 4),
    match_exceptions TEXT[],

    -- Approval
    approved_by VARCHAR(255),
    approval_date TIMESTAMPTZ,
    approval_notes TEXT,

    -- Disputes
    is_disputed BOOLEAN DEFAULT false,
    dispute_reason TEXT,
    dispute_resolution TEXT,

    -- Notes
    notes TEXT,
    attachment_ids TEXT[],

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gv_inv_vendor ON gv_invoices(vendor_id);
CREATE INDEX idx_gv_inv_status ON gv_invoices(status);
CREATE INDEX idx_gv_inv_po ON gv_invoices(purchase_order_id);
CREATE INDEX idx_gv_inv_due_date ON gv_invoices(due_date);
CREATE INDEX idx_gv_inv_disputed ON gv_invoices(is_disputed) WHERE is_disputed = true;

-- Invoice Line Items
CREATE TABLE IF NOT EXISTS gv_invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES gv_invoices(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    po_line_number INTEGER,
    item_code VARCHAR(100),
    description TEXT NOT NULL,
    quantity DECIMAL(20, 4) NOT NULL,
    unit_price DECIMAL(20, 4) NOT NULL,
    discount DECIMAL(20, 4) DEFAULT 0,
    tax_rate DECIMAL(6, 4) DEFAULT 0,
    tax_amount DECIMAL(20, 4) DEFAULT 0,
    line_total DECIMAL(20, 4) NOT NULL,
    account_code VARCHAR(50),
    cost_center VARCHAR(50),
    project VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(invoice_id, line_number)
);

CREATE INDEX idx_gv_inv_line_invoice ON gv_invoice_line_items(invoice_id);

-- ============================================================================
-- GENERAL LEDGER ENTRIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_gl_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id VARCHAR(50) NOT NULL,
    journal_number VARCHAR(50) NOT NULL,
    entry_number INTEGER NOT NULL,
    ledger_type VARCHAR(20) NOT NULL DEFAULT 'operating' CHECK (ledger_type IN (
        'operating', 'float', 'yield', 'escrow'
    )),

    -- Date
    entry_date DATE NOT NULL,
    posting_date DATE NOT NULL,
    period VARCHAR(7) NOT NULL, -- YYYY-MM
    fiscal_year INTEGER NOT NULL,

    -- Account
    account_id UUID NOT NULL REFERENCES gv_chart_of_accounts(id),
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255),

    -- Amounts
    debit DECIMAL(20, 4) NOT NULL DEFAULT 0,
    credit DECIMAL(20, 4) NOT NULL DEFAULT 0,
    amount DECIMAL(20, 4) NOT NULL, -- Signed
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(12, 6) DEFAULT 1,
    base_currency_amount DECIMAL(20, 4),

    -- Description
    description TEXT NOT NULL,
    memo TEXT,

    -- Reference
    reference_type VARCHAR(30) CHECK (reference_type IN (
        'invoice', 'payment', 'receipt', 'adjustment', 'transfer', 'yield', 'escrow'
    )),
    reference_id VARCHAR(100),
    reference_number VARCHAR(100),

    -- Tracking
    cost_center VARCHAR(50),
    department VARCHAR(100),
    project VARCHAR(100),
    location VARCHAR(100),

    -- Status
    is_posted BOOLEAN DEFAULT true,
    is_reversed BOOLEAN DEFAULT false,
    reversed_by VARCHAR(100),
    reversal_date DATE,

    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_date DATE,
    reconciled_by VARCHAR(255),
    bank_statement_ref VARCHAR(100),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,

    CHECK (debit >= 0 AND credit >= 0),
    CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0) OR (debit = 0 AND credit = 0))
);

CREATE INDEX idx_gv_gl_journal ON gv_gl_entries(journal_id);
CREATE INDEX idx_gv_gl_account ON gv_gl_entries(account_id);
CREATE INDEX idx_gv_gl_date ON gv_gl_entries(entry_date);
CREATE INDEX idx_gv_gl_period ON gv_gl_entries(period);
CREATE INDEX idx_gv_gl_ledger_type ON gv_gl_entries(ledger_type);
CREATE INDEX idx_gv_gl_reference ON gv_gl_entries(reference_type, reference_id);
CREATE INDEX idx_gv_gl_reconciled ON gv_gl_entries(is_reconciled);

-- ============================================================================
-- PAYMENT INSTRUCTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_payment_instructions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_authorization', 'authorized', 'processing',
        'completed', 'failed', 'reversed', 'cancelled'
    )),

    -- Payee
    vendor_id UUID NOT NULL REFERENCES gv_vendors(id),
    vendor_name VARCHAR(255),

    -- Payment Details
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN (
        'grain', 'ach', 'wire', 'check', 'virtual_card'
    )),
    amount DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- GRAIN Payment Details
    grain_wallet_from VARCHAR(100),
    grain_wallet_to VARCHAR(100),
    grain_tx_hash VARCHAR(100),
    grain_block_number BIGINT,

    -- Bank Payment Details
    bank_account_from VARCHAR(100),
    bank_account_to VARCHAR(100),
    bank_reference VARCHAR(100),

    -- Virtual Card
    card_number_last4 VARCHAR(4),
    card_expiry_date DATE,

    -- Scheduling
    requested_date DATE NOT NULL,
    scheduled_date DATE,
    executed_date TIMESTAMPTZ,
    settled_date TIMESTAMPTZ,

    -- Invoice References
    invoice_ids UUID[] NOT NULL,
    invoice_numbers TEXT[],
    total_invoice_amount DECIMAL(20, 4),

    -- Discount
    early_payment_discount DECIMAL(20, 4),
    discount_taken DECIMAL(20, 4),

    -- Authorization
    created_by VARCHAR(255) NOT NULL,
    authorized_by VARCHAR(255),
    authorized_at TIMESTAMPTZ,
    authorization_method VARCHAR(20) CHECK (authorization_method IN (
        'manual', 'rule_based', 'conversational'
    )),

    -- Notes
    memo TEXT,
    vendor_memo TEXT,
    internal_notes TEXT,

    -- GL Reference
    journal_id VARCHAR(50),

    -- Error Handling
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gv_payment_vendor ON gv_payment_instructions(vendor_id);
CREATE INDEX idx_gv_payment_status ON gv_payment_instructions(status);
CREATE INDEX idx_gv_payment_method ON gv_payment_instructions(payment_method);
CREATE INDEX idx_gv_payment_scheduled ON gv_payment_instructions(scheduled_date);
CREATE INDEX idx_gv_payment_grain_tx ON gv_payment_instructions(grain_tx_hash) WHERE grain_tx_hash IS NOT NULL;

-- ============================================================================
-- RECONCILIATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_type VARCHAR(30) NOT NULL CHECK (reconciliation_type IN (
        'bank', 'credit_card', 'grain_wallet', 'intercompany'
    )),
    account_id UUID NOT NULL REFERENCES gv_chart_of_accounts(id),
    account_code VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'matched', 'unmatched', 'exception', 'completed'
    )),

    -- Period
    statement_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Balances
    statement_beginning_balance DECIMAL(20, 4) NOT NULL,
    statement_ending_balance DECIMAL(20, 4) NOT NULL,
    book_beginning_balance DECIMAL(20, 4) NOT NULL,
    book_ending_balance DECIMAL(20, 4) NOT NULL,
    reconciled_balance DECIMAL(20, 4),
    unreconciled_difference DECIMAL(20, 4),

    -- Statistics
    total_deposits DECIMAL(20, 4) DEFAULT 0,
    total_withdrawals DECIMAL(20, 4) DEFAULT 0,
    cleared_items INTEGER DEFAULT 0,
    outstanding_items INTEGER DEFAULT 0,

    -- Completion
    completed_by VARCHAR(255),
    completed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gv_recon_account ON gv_reconciliations(account_id);
CREATE INDEX idx_gv_recon_status ON gv_reconciliations(status);
CREATE INDEX idx_gv_recon_date ON gv_reconciliations(statement_date);

-- Reconciliation Items
CREATE TABLE IF NOT EXISTS gv_reconciliation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id UUID NOT NULL REFERENCES gv_reconciliations(id) ON DELETE CASCADE,
    gl_entry_id UUID REFERENCES gv_gl_entries(id),
    bank_statement_ref VARCHAR(100),

    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(20, 4) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal')),

    is_matched BOOLEAN DEFAULT false,
    is_cleared BOOLEAN DEFAULT false,
    is_exception BOOLEAN DEFAULT false,
    exception_reason TEXT,

    matched_at TIMESTAMPTZ,
    matched_by VARCHAR(255),
    match_confidence DECIMAL(5, 2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gv_recon_item_recon ON gv_reconciliation_items(reconciliation_id);
CREATE INDEX idx_gv_recon_item_gl ON gv_reconciliation_items(gl_entry_id);
CREATE INDEX idx_gv_recon_item_matched ON gv_reconciliation_items(is_matched);

-- ============================================================================
-- FLOAT LEDGER (Treasury Float Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_float_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(100) NOT NULL, -- Grain & Vault account
    entry_date DATE NOT NULL,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'deposit', 'withdrawal', 'payment_in_flight', 'settlement', 'interest'
    )),

    amount DECIMAL(20, 4) NOT NULL,
    running_balance DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    source_type VARCHAR(30) CHECK (source_type IN (
        'grain_deposit', 'fiat_deposit', 'payment_received', 'yield_allocation'
    )),
    destination_type VARCHAR(30) CHECK (destination_type IN (
        'payment_sent', 'withdrawal', 'escrow_lock'
    )),

    reference_type VARCHAR(50),
    reference_id VARCHAR(100),

    expected_settlement_date DATE,
    actual_settlement_date DATE,
    is_settled BOOLEAN DEFAULT false,

    description TEXT NOT NULL,
    memo TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_gv_float_account ON gv_float_ledger(account_id);
CREATE INDEX idx_gv_float_date ON gv_float_ledger(entry_date);
CREATE INDEX idx_gv_float_type ON gv_float_ledger(transaction_type);
CREATE INDEX idx_gv_float_settled ON gv_float_ledger(is_settled);

-- ============================================================================
-- YIELD LEDGER (GRAIN Appreciation Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_yield_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(100) NOT NULL,
    entry_date DATE NOT NULL,
    yield_type VARCHAR(30) NOT NULL CHECK (yield_type IN (
        'interest', 'appreciation', 'rebate', 'reward', 'fee_credit'
    )),

    principal_amount DECIMAL(20, 4) NOT NULL,
    yield_amount DECIMAL(20, 4) NOT NULL,
    yield_rate DECIMAL(10, 6) NOT NULL, -- APY as decimal
    running_yield_balance DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    days_in_period INTEGER NOT NULL,

    source_program VARCHAR(100),
    source_account_code VARCHAR(50),

    is_posted BOOLEAN DEFAULT false,
    is_withdrawn BOOLEAN DEFAULT false,
    withdrawn_at TIMESTAMPTZ,
    withdrawal_payment_id UUID,

    journal_id VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_gv_yield_account ON gv_yield_ledger(account_id);
CREATE INDEX idx_gv_yield_date ON gv_yield_ledger(entry_date);
CREATE INDEX idx_gv_yield_type ON gv_yield_ledger(yield_type);
CREATE INDEX idx_gv_yield_posted ON gv_yield_ledger(is_posted);

-- ============================================================================
-- ESCROW ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gv_escrow_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_code VARCHAR(50) NOT NULL UNIQUE,
    escrow_type VARCHAR(30) NOT NULL CHECK (escrow_type IN (
        'trade_escrow', 'milestone_escrow', 'dispute_hold', 'compliance_hold', 'reserve'
    )),
    account_id VARCHAR(100) NOT NULL, -- Parent G&V account
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'released', 'cancelled', 'disputed'
    )),

    -- Parties
    depositor_id VARCHAR(100),
    depositor_name VARCHAR(255),
    beneficiary_id VARCHAR(100),
    beneficiary_name VARCHAR(255),

    -- Amounts
    total_deposited DECIMAL(20, 4) NOT NULL DEFAULT 0,
    total_released DECIMAL(20, 4) NOT NULL DEFAULT 0,
    total_refunded DECIMAL(20, 4) NOT NULL DEFAULT 0,
    current_balance DECIMAL(20, 4) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- Terms
    release_conditions TEXT,
    expiration_date DATE,
    auto_release_date DATE,

    -- Associated Objects
    deal_id VARCHAR(100),
    purchase_order_id UUID REFERENCES gv_purchase_orders(id),
    invoice_id UUID REFERENCES gv_invoices(id),
    contract_id VARCHAR(100),

    -- Release Info
    released_at TIMESTAMPTZ,
    released_by VARCHAR(255),
    release_reason TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_gv_escrow_account ON gv_escrow_accounts(account_id);
CREATE INDEX idx_gv_escrow_type ON gv_escrow_accounts(escrow_type);
CREATE INDEX idx_gv_escrow_status ON gv_escrow_accounts(status);
CREATE INDEX idx_gv_escrow_deal ON gv_escrow_accounts(deal_id);

-- Escrow Transactions
CREATE TABLE IF NOT EXISTS gv_escrow_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_account_id UUID NOT NULL REFERENCES gv_escrow_accounts(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'deposit', 'release', 'refund', 'fee', 'interest'
    )),
    amount DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    running_balance DECIMAL(20, 4) NOT NULL,

    from_party VARCHAR(255),
    to_party VARCHAR(255),

    payment_instruction_id UUID REFERENCES gv_payment_instructions(id),
    grain_tx_hash VARCHAR(100),

    authorized_by VARCHAR(255),
    authorized_at TIMESTAMPTZ,
    authorization_notes TEXT,

    description TEXT NOT NULL,
    memo TEXT,

    journal_id VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_gv_escrow_tx_account ON gv_escrow_transactions(escrow_account_id);
CREATE INDEX idx_gv_escrow_tx_type ON gv_escrow_transactions(transaction_type);
CREATE INDEX idx_gv_escrow_tx_grain ON gv_escrow_transactions(grain_tx_hash) WHERE grain_tx_hash IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER update_gv_coa_updated_at BEFORE UPDATE ON gv_chart_of_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gv_vendors_updated_at BEFORE UPDATE ON gv_vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gv_po_updated_at BEFORE UPDATE ON gv_purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gv_inv_updated_at BEFORE UPDATE ON gv_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gv_payment_updated_at BEFORE UPDATE ON gv_payment_instructions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gv_recon_updated_at BEFORE UPDATE ON gv_reconciliations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gv_escrow_updated_at BEFORE UPDATE ON gv_escrow_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Default Chart of Accounts
-- ============================================================================

INSERT INTO gv_chart_of_accounts (account_code, account_name, account_type, account_subtype, normal_balance, is_system_account, is_treasury_account, grain_linked) VALUES
-- Assets
('1000', 'Cash and Cash Equivalents', 'asset', 'cash', 'debit', true, false, false),
('1010', 'Operating Cash', 'asset', 'cash', 'debit', true, false, false),
('1020', 'GRAIN Treasury', 'asset', 'grain_treasury', 'debit', true, true, true),
('1030', 'Float Pool', 'asset', 'float_balance', 'debit', true, true, false),
('1100', 'Accounts Receivable', 'asset', 'accounts_receivable', 'debit', true, false, false),
('1200', 'Inventory', 'asset', 'inventory', 'debit', false, false, false),
('1300', 'Prepaid Expenses', 'asset', 'prepaid', 'debit', false, false, false),
('1500', 'Fixed Assets', 'asset', 'fixed_asset', 'debit', false, false, false),

-- Liabilities
('2000', 'Accounts Payable', 'liability', 'accounts_payable', 'credit', true, false, false),
('2010', 'GRAIN Liabilities', 'liability', 'accounts_payable', 'credit', true, true, true),
('2100', 'Accrued Expenses', 'liability', 'accrued_liability', 'credit', false, false, false),
('2200', 'Escrow Liabilities', 'liability', 'escrow_holding', 'credit', true, true, false),
('2300', 'Yield Payable', 'liability', 'yield_accrual', 'credit', true, true, false),

-- Equity
('3000', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true, false, false),
('3100', 'Common Stock', 'equity', 'common_stock', 'credit', true, false, false),

-- Revenue
('4000', 'Service Revenue', 'revenue', 'service_revenue', 'credit', true, false, false),
('4010', 'Transaction Fee Revenue', 'revenue', 'service_revenue', 'credit', true, false, false),
('4020', 'GRAIN Processing Revenue', 'revenue', 'service_revenue', 'credit', true, true, true),
('4100', 'Float Interest Income', 'revenue', 'service_revenue', 'credit', true, true, false),

-- Expenses
('5000', 'Cost of Services', 'expense', 'cost_of_goods', 'debit', true, false, false),
('5100', 'Payment Processing Costs', 'expense', 'cost_of_goods', 'debit', true, false, false),
('6000', 'Operating Expenses', 'expense', 'operating_expense', 'debit', false, false, false),
('6100', 'Yield Expense', 'expense', 'operating_expense', 'debit', true, true, false)

ON CONFLICT (account_code) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Outstanding Invoices
CREATE OR REPLACE VIEW gv_v_outstanding_invoices AS
SELECT
    i.id,
    i.invoice_number,
    i.vendor_invoice_number,
    v.vendor_code,
    v.company_name as vendor_name,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    i.amount_paid,
    i.amount_due,
    i.currency,
    i.status,
    i.is_disputed,
    CASE
        WHEN i.due_date < CURRENT_DATE AND i.status NOT IN ('paid', 'cancelled', 'written_off')
        THEN CURRENT_DATE - i.due_date
        ELSE 0
    END as days_overdue
FROM gv_invoices i
JOIN gv_vendors v ON i.vendor_id = v.id
WHERE i.status NOT IN ('paid', 'cancelled', 'written_off')
ORDER BY i.due_date;

-- View: Vendor Payment Summary
CREATE OR REPLACE VIEW gv_v_vendor_payment_summary AS
SELECT
    v.id as vendor_id,
    v.vendor_code,
    v.company_name,
    v.payment_preference,
    v.grain_wallet_address,
    COUNT(DISTINCT i.id) as total_invoices,
    COUNT(DISTINCT CASE WHEN i.status NOT IN ('paid', 'cancelled') THEN i.id END) as open_invoices,
    SUM(CASE WHEN i.status NOT IN ('paid', 'cancelled') THEN i.amount_due ELSE 0 END) as total_outstanding,
    COUNT(DISTINCT p.id) as total_payments,
    SUM(p.amount) as total_paid,
    MAX(p.executed_date) as last_payment_date
FROM gv_vendors v
LEFT JOIN gv_invoices i ON v.id = i.vendor_id
LEFT JOIN gv_payment_instructions p ON v.id = p.vendor_id AND p.status = 'completed'
GROUP BY v.id, v.vendor_code, v.company_name, v.payment_preference, v.grain_wallet_address;

-- View: Trial Balance
CREATE OR REPLACE VIEW gv_v_trial_balance AS
SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    a.normal_balance,
    COALESCE(SUM(g.debit), 0) as total_debits,
    COALESCE(SUM(g.credit), 0) as total_credits,
    CASE
        WHEN a.normal_balance = 'debit'
        THEN COALESCE(SUM(g.debit), 0) - COALESCE(SUM(g.credit), 0)
        ELSE COALESCE(SUM(g.credit), 0) - COALESCE(SUM(g.debit), 0)
    END as balance
FROM gv_chart_of_accounts a
LEFT JOIN gv_gl_entries g ON a.id = g.account_id AND g.is_posted = true
WHERE a.is_active = true
GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
ORDER BY a.account_code;
