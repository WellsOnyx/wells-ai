-- ============================================
-- Phase 4: Conversational ERP - Database Schema
-- ============================================
-- Creates all tables needed for conversational procurement and finance

-- ============================================
-- PROCUREMENT MODULE
-- ============================================

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id UUID,
  buyer_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  -- Status: draft, pending_approval, approved, sent, received, completed, cancelled, rejected
  total_amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  due_date DATE,
  requested_by VARCHAR(255) NOT NULL,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_buyer ON purchase_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders(created_at);

-- PO Line Items
CREATE TABLE IF NOT EXISTS po_line_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_name VARCHAR(500) NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL,
  unit VARCHAR(50) DEFAULT 'units',
  unit_price DECIMAL(15, 2) NOT NULL,
  total_price DECIMAL(15, 2) NOT NULL,
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_line_items_po ON po_line_items(po_id);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  description TEXT,
  category VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'units',
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  location VARCHAR(255),
  warehouse VARCHAR(100),
  unit_cost DECIMAL(15, 2),
  last_restock_date DATE,
  preferred_supplier_id UUID,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items(product_name);
CREATE INDEX IF NOT EXISTS idx_inventory_reorder ON inventory_items(quantity, reorder_point);

-- Inventory Transactions (Audit Log)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  -- Type: receipt, issue, adjustment, count, transfer, return
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reference_type VARCHAR(50),
  -- Reference: po, sales_order, manual, etc.
  reference_id VARCHAR(100),
  performed_by VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_item ON inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_date ON inventory_transactions(created_at);

-- Reorder Alerts
CREATE TABLE IF NOT EXISTS reorder_alerts (
  id SERIAL PRIMARY KEY,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
  product_name VARCHAR(500) NOT NULL,
  current_quantity INTEGER NOT NULL,
  reorder_quantity INTEGER NOT NULL,
  supplier_id UUID,
  status VARCHAR(50) DEFAULT 'pending',
  -- Status: pending, po_created, ordered, cancelled
  po_id INTEGER REFERENCES purchase_orders(id),
  triggered_by VARCHAR(255),
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reorder_status ON reorder_alerts(status);
CREATE INDEX IF NOT EXISTS idx_reorder_item ON reorder_alerts(inventory_item_id);

-- Supplier Performance Metrics
CREATE TABLE IF NOT EXISTS supplier_metrics (
  id SERIAL PRIMARY KEY,
  supplier_id UUID,
  po_id INTEGER REFERENCES purchase_orders(id),
  metric_period VARCHAR(50),
  -- Period: daily, weekly, monthly, quarterly, yearly
  delivered_on_time BOOLEAN DEFAULT false,
  delivery_days INTEGER,
  quality_rating DECIMAL(3, 2),
  -- 1.00 to 5.00
  response_time_hours INTEGER,
  total_amount DECIMAL(15, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_metrics_supplier ON supplier_metrics(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_metrics_period ON supplier_metrics(metric_period, created_at);

-- Supplier Issues/Incidents
CREATE TABLE IF NOT EXISTS supplier_issues (
  id SERIAL PRIMARY KEY,
  supplier_id UUID,
  po_id INTEGER REFERENCES purchase_orders(id),
  issue_type VARCHAR(100) NOT NULL,
  -- Type: late_delivery, quality_issue, pricing_error, communication, contract_breach
  severity VARCHAR(50) NOT NULL,
  -- Severity: low, medium, high, critical
  description TEXT NOT NULL,
  resolution TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'open',
  -- Status: open, in_progress, resolved, closed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_issues_supplier ON supplier_issues(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_issues_status ON supplier_issues(status);

-- Approval Workflows
CREATE TABLE IF NOT EXISTS approval_workflows (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  -- Type: purchase_order, invoice, payment, contract
  entity_id INTEGER NOT NULL,
  approval_level INTEGER NOT NULL DEFAULT 1,
  approver_id VARCHAR(255) NOT NULL,
  approver_name VARCHAR(255),
  approver_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  -- Status: pending, approved, rejected, escalated
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_entity ON approval_workflows(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_approver ON approval_workflows(approver_id, status);

-- Conversation Contexts (For multi-turn conversations)
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  -- Platform: web, slack, teams, discord, google_chat, widget
  current_intent VARCHAR(100),
  context_data JSONB,
  -- Stores: entities, history, metadata
  last_activity TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_user ON conversation_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_expires ON conversation_contexts(expires_at);

-- ============================================
-- FINANCE MODULE
-- ============================================

-- Budget Plans
CREATE TABLE IF NOT EXISTS budget_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  category VARCHAR(100),
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER,
  planned_amount DECIMAL(15, 2) NOT NULL,
  actual_amount DECIMAL(15, 2) DEFAULT 0,
  variance DECIMAL(15, 2) DEFAULT 0,
  variance_percent DECIMAL(5, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  -- Status: draft, active, completed, cancelled
  owner_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_year ON budget_plans(fiscal_year, fiscal_quarter);
CREATE INDEX IF NOT EXISTS idx_budget_category ON budget_plans(category);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_type VARCHAR(50) NOT NULL,
  -- Type: receivable (we bill), payable (we pay)
  customer_id VARCHAR(255),
  -- For receivables
  supplier_id UUID,
  -- For payables
  po_id INTEGER REFERENCES purchase_orders(id),
  -- Link to PO if applicable
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'draft',
  -- Status: draft, sent, pending, overdue, paid, cancelled
  payment_terms VARCHAR(100),
  -- Terms: Net 30, Net 60, Due on Receipt, etc.
  notes TEXT,
  generated_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_supplier ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoice_dates ON invoices(invoice_date, due_date);

-- Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  line_total DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  product_sku VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_line_items(invoice_id);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_number VARCHAR(100) UNIQUE NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  -- Type: received (we get), sent (we pay)
  payment_method VARCHAR(50) NOT NULL,
  -- Method: check, wire, ach, credit_card, cash
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_date DATE NOT NULL,
  reference_number VARCHAR(255),
  -- Check number, transaction ID, etc.
  customer_id VARCHAR(255),
  -- For received payments
  supplier_id UUID,
  -- For sent payments
  bank_account VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  -- Status: pending, cleared, bounced, cancelled
  notes TEXT,
  processed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_supplier ON payments(supplier_id);

-- Payment Allocations (Links payments to invoices)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(15, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_invoice ON payment_allocations(invoice_id);

-- Financial Transactions (General Ledger Entries)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id SERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  -- Type: sale, purchase, payment, receipt, adjustment, fee
  reference_type VARCHAR(50),
  -- Reference: invoice, payment, po, etc.
  reference_id INTEGER,
  account_code VARCHAR(50) NOT NULL,
  -- Chart of accounts code
  debit_amount DECIMAL(15, 2) DEFAULT 0,
  credit_amount DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT,
  posted_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_fin_tx_account ON financial_transactions(account_code);
CREATE INDEX IF NOT EXISTS idx_fin_tx_type ON financial_transactions(transaction_type);

-- Saved Reports (For caching complex financial reports)
CREATE TABLE IF NOT EXISTS saved_reports (
  id SERIAL PRIMARY KEY,
  report_type VARCHAR(100) NOT NULL,
  -- Type: p_and_l, balance_sheet, cash_flow, ar_aging, ap_aging
  report_period VARCHAR(50) NOT NULL,
  -- Period: monthly, quarterly, yearly, custom
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  report_data JSONB NOT NULL,
  generated_by VARCHAR(255),
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON saved_reports(report_type, report_period);
CREATE INDEX IF NOT EXISTS idx_saved_reports_dates ON saved_reports(start_date, end_date);

-- Analytics Cache (For frequently-accessed metrics)
CREATE TABLE IF NOT EXISTS analytics_cache (
  id SERIAL PRIMARY KEY,
  metric_key VARCHAR(255) UNIQUE NOT NULL,
  metric_value JSONB NOT NULL,
  cache_period VARCHAR(50),
  -- Period: hourly, daily, weekly
  last_updated TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_analytics_key ON analytics_cache(metric_key);
CREATE INDEX IF NOT EXISTS idx_analytics_expires ON analytics_cache(expires_at);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'purchase_orders', 'inventory_items', 'supplier_issues',
      'budget_plans', 'invoices', 'payments'
    )
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    ', table_name, table_name, table_name, table_name);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Auto-update budget variance when actual amount changes
CREATE OR REPLACE FUNCTION update_budget_variance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.variance = NEW.actual_amount - NEW.planned_amount;
  NEW.variance_percent = CASE
    WHEN NEW.planned_amount > 0 THEN (NEW.variance / NEW.planned_amount) * 100
    ELSE 0
  END;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_budget_variance ON budget_plans;
CREATE TRIGGER trigger_update_budget_variance
BEFORE INSERT OR UPDATE ON budget_plans
FOR EACH ROW
EXECUTE FUNCTION update_budget_variance();

-- Auto-create reorder alert when inventory drops below reorder point
CREATE OR REPLACE FUNCTION check_inventory_reorder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <= NEW.reorder_point AND (OLD.quantity IS NULL OR OLD.quantity > OLD.reorder_point) THEN
    INSERT INTO reorder_alerts (
      inventory_item_id,
      product_name,
      current_quantity,
      reorder_quantity,
      supplier_id,
      status
    ) VALUES (
      NEW.id,
      NEW.product_name,
      NEW.quantity,
      NEW.reorder_quantity,
      NEW.preferred_supplier_id,
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_check_inventory_reorder ON inventory_items;
CREATE TRIGGER trigger_check_inventory_reorder
AFTER UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION check_inventory_reorder();

-- Update invoice status when fully paid
CREATE OR REPLACE FUNCTION update_invoice_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  total_allocated DECIMAL(15, 2);
  invoice_total DECIMAL(15, 2);
BEGIN
  SELECT COALESCE(SUM(allocated_amount), 0) INTO total_allocated
  FROM payment_allocations
  WHERE invoice_id = NEW.invoice_id;

  SELECT total_amount INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;

  IF total_allocated >= invoice_total THEN
    UPDATE invoices
    SET status = 'paid', updated_at = NOW()
    WHERE id = NEW.invoice_id;
  ELSIF total_allocated > 0 AND total_allocated < invoice_total THEN
    UPDATE invoices
    SET status = 'partial', updated_at = NOW()
    WHERE id = NEW.invoice_id;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_invoice_status ON payment_allocations;
CREATE TRIGGER trigger_update_invoice_status
AFTER INSERT OR UPDATE ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION update_invoice_status_on_payment();

-- Clean up expired conversation contexts (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_contexts WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Clean up expired saved reports
CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS void AS $$
BEGIN
  DELETE FROM saved_reports WHERE expires_at < NOW();
  DELETE FROM analytics_cache WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample inventory items
INSERT INTO inventory_items (product_name, sku, quantity, unit, reorder_point, reorder_quantity, location, unit_cost)
VALUES
  ('Office Chair', 'CHAIR-001', 25, 'units', 10, 50, 'Warehouse A', 149.99),
  ('Laptop Dell XPS 15', 'LAPTOP-XPS15', 8, 'units', 5, 20, 'Warehouse B', 1299.00),
  ('Printer Paper (Ream)', 'PAPER-8.5X11', 200, 'reams', 50, 200, 'Warehouse A', 4.99)
ON CONFLICT (sku) DO NOTHING;

-- Insert sample budget plan
INSERT INTO budget_plans (name, department, category, fiscal_year, fiscal_quarter, planned_amount, owner_id)
VALUES
  ('Q1 2025 Procurement', 'Operations', 'Office Supplies', 2025, 1, 50000.00, 'admin'),
  ('Q1 2025 IT Equipment', 'IT', 'Technology', 2025, 1, 150000.00, 'admin')
ON CONFLICT DO NOTHING;

-- ============================================
-- COMPLETION
-- ============================================

-- Add foreign key constraints if suppliers table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
    -- Purchase orders supplier FK
    ALTER TABLE purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_supplier_id_fkey;
    ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

    -- Inventory items preferred supplier FK
    ALTER TABLE inventory_items
    DROP CONSTRAINT IF EXISTS inventory_items_preferred_supplier_id_fkey;
    ALTER TABLE inventory_items
    ADD CONSTRAINT inventory_items_preferred_supplier_id_fkey
    FOREIGN KEY (preferred_supplier_id) REFERENCES suppliers(id);

    -- Reorder alerts supplier FK
    ALTER TABLE reorder_alerts
    DROP CONSTRAINT IF EXISTS reorder_alerts_supplier_id_fkey;
    ALTER TABLE reorder_alerts
    ADD CONSTRAINT reorder_alerts_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

    -- Supplier metrics supplier FK
    ALTER TABLE supplier_metrics
    DROP CONSTRAINT IF EXISTS supplier_metrics_supplier_id_fkey;
    ALTER TABLE supplier_metrics
    ADD CONSTRAINT supplier_metrics_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

    -- Supplier issues supplier FK
    ALTER TABLE supplier_issues
    DROP CONSTRAINT IF EXISTS supplier_issues_supplier_id_fkey;
    ALTER TABLE supplier_issues
    ADD CONSTRAINT supplier_issues_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

    -- Invoices supplier FK
    ALTER TABLE invoices
    DROP CONSTRAINT IF EXISTS invoices_supplier_id_fkey;
    ALTER TABLE invoices
    ADD CONSTRAINT invoices_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

    -- Payments supplier FK
    ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_supplier_id_fkey;
    ALTER TABLE payments
    ADD CONSTRAINT payments_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Verify all tables created
DO $$
DECLARE
  tables_created INTEGER;
BEGIN
  SELECT COUNT(*) INTO tables_created
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'purchase_orders', 'po_line_items', 'inventory_items', 'inventory_transactions',
    'reorder_alerts', 'supplier_metrics', 'supplier_issues', 'approval_workflows',
    'conversation_contexts', 'budget_plans', 'invoices', 'invoice_line_items',
    'payments', 'payment_allocations', 'financial_transactions', 'saved_reports',
    'analytics_cache'
  );

  RAISE NOTICE 'Phase 4 schema migration complete. Created/verified % tables.', tables_created;
END;
$$ LANGUAGE plpgsql;
