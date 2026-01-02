-- =============================================================================
-- GLOBAL PAYROLL & SYSTEM USERS SCHEMA
-- =============================================================================
-- Comprehensive payroll across all Circle-supported countries
-- System users for Wells autonomous operations
-- =============================================================================

-- =============================================================================
-- SYSTEM USERS (Wells, Scheduler, Support, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_users (
  id TEXT PRIMARY KEY,
  type TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  api_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_users_type ON system_users(type);
CREATE INDEX IF NOT EXISTS idx_system_users_status ON system_users(status);
CREATE INDEX IF NOT EXISTS idx_system_users_api_key ON system_users(api_key_hash);

-- System user activity log
CREATE TABLE IF NOT EXISTS system_user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_user_id TEXT NOT NULL REFERENCES system_users(id),
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_activity_user ON system_user_activity(system_user_id);
CREATE INDEX IF NOT EXISTS idx_system_activity_action ON system_user_activity(action);
CREATE INDEX IF NOT EXISTS idx_system_activity_created ON system_user_activity(created_at);

-- =============================================================================
-- GLOBAL PAYROLL TABLES
-- =============================================================================

-- Enhanced payroll batches with global support
ALTER TABLE payroll_batches ADD COLUMN IF NOT EXISTS country_summary JSONB;
ALTER TABLE payroll_batches ADD COLUMN IF NOT EXISTS entries_json JSONB;
ALTER TABLE payroll_batches ADD COLUMN IF NOT EXISTS failures_json JSONB;
ALTER TABLE payroll_batches ADD COLUMN IF NOT EXISTS total_tax_withholding DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE payroll_batches ADD COLUMN IF NOT EXISTS total_employer_contributions DECIMAL(20, 2) DEFAULT 0;

-- Employee payroll profiles
CREATE TABLE IF NOT EXISTS employee_payroll_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,

  -- Personal info
  legal_name TEXT NOT NULL,
  email TEXT NOT NULL,
  country_code TEXT NOT NULL,
  tax_id TEXT,
  social_security_number TEXT, -- Encrypted

  -- Compensation
  base_salary DECIMAL(20, 2) NOT NULL,
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  pay_frequency TEXT NOT NULL DEFAULT 'monthly', -- weekly, bi-weekly, monthly

  -- Benefits & deductions
  benefits JSONB DEFAULT '{}',
  deductions JSONB DEFAULT '{}',
  allowances JSONB DEFAULT '{}',

  -- Tax settings
  tax_withholding_rate DECIMAL(5, 4), -- Override country default
  filing_status TEXT,
  additional_withholding DECIMAL(20, 2) DEFAULT 0,

  -- Payment preferences
  preferred_settlement TEXT DEFAULT 'grain', -- grain, usdc, local_currency
  bank_details JSONB, -- Encrypted
  wallet_address TEXT,
  mobile_money_number TEXT,

  -- Employment details
  start_date DATE NOT NULL,
  end_date DATE,
  department TEXT,
  cost_center TEXT,
  job_title TEXT,

  -- Status
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_user ON employee_payroll_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_company ON employee_payroll_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_country ON employee_payroll_profiles(country_code);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_status ON employee_payroll_profiles(status);

-- Payroll runs (individual payments within a batch)
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL,
  employee_profile_id UUID REFERENCES employee_payroll_profiles(id),
  employee_user_id TEXT NOT NULL,

  -- Pay breakdown
  gross_pay DECIMAL(20, 2) NOT NULL,
  net_pay DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL,

  -- Components
  base_salary DECIMAL(20, 2) NOT NULL,
  bonus DECIMAL(20, 2) DEFAULT 0,
  commission DECIMAL(20, 2) DEFAULT 0,
  allowances_json JSONB DEFAULT '{}',
  deductions_json JSONB DEFAULT '{}',

  -- Tax & compliance
  tax_withholding DECIMAL(20, 2) DEFAULT 0,
  employer_contributions DECIMAL(20, 2) DEFAULT 0,

  -- Settlement
  settlement_rail TEXT NOT NULL, -- grain, usdc, local_bank, mobile_money
  grain_amount DECIMAL(24, 6),
  grain_price_at_execution DECIMAL(20, 10),
  transaction_id TEXT,

  -- Status
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  failure_reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_batch ON payroll_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_employee ON payroll_runs(employee_user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);

-- Tax withholding records (for tax reporting)
CREATE TABLE IF NOT EXISTS tax_withholding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID REFERENCES payroll_runs(id),
  employee_user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  country_code TEXT NOT NULL,

  -- Tax details
  tax_type TEXT NOT NULL, -- federal, state, local, social_security, etc.
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL,
  tax_period_start DATE NOT NULL,
  tax_period_end DATE NOT NULL,

  -- Reporting
  reported_to_authority BOOLEAN DEFAULT FALSE,
  report_reference TEXT,
  reported_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_withholding_employee ON tax_withholding_records(employee_user_id);
CREATE INDEX IF NOT EXISTS idx_tax_withholding_company ON tax_withholding_records(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_withholding_country ON tax_withholding_records(country_code);
CREATE INDEX IF NOT EXISTS idx_tax_withholding_period ON tax_withholding_records(tax_period_start, tax_period_end);

-- =============================================================================
-- TEAM & ORGANIZATION ENHANCEMENTS
-- =============================================================================

-- Add payroll admin flag to organization members
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS can_manage_payroll BOOLEAN DEFAULT FALSE;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS can_approve_payments BOOLEAN DEFAULT FALSE;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS daily_approval_limit DECIMAL(20, 2);

-- Organization payroll settings
CREATE TABLE IF NOT EXISTS organization_payroll_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL UNIQUE,

  -- Default settings
  default_pay_frequency TEXT DEFAULT 'monthly',
  default_currency TEXT DEFAULT 'USD',
  default_settlement_rail TEXT DEFAULT 'grain',

  -- Approval workflow
  require_dual_approval BOOLEAN DEFAULT FALSE,
  approval_threshold DECIMAL(20, 2) DEFAULT 10000,

  -- Notifications
  notify_on_payroll_complete BOOLEAN DEFAULT TRUE,
  notification_emails TEXT[],

  -- Compliance
  tax_registration_numbers JSONB DEFAULT '{}',
  registered_countries TEXT[] DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_payroll_settings_org ON organization_payroll_settings(org_id);

-- =============================================================================
-- AUDIT LOG FOR PAYROLL ACTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Could be human or system user
  action TEXT NOT NULL, -- create_batch, approve_batch, execute_batch, etc.
  resource_type TEXT NOT NULL, -- batch, employee, settings
  resource_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_audit_org ON payroll_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_user ON payroll_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_action ON payroll_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_created ON payroll_audit_log(created_at);

-- =============================================================================
-- GRANT APPROPRIATE PERMISSIONS
-- =============================================================================

-- Views for reporting
CREATE OR REPLACE VIEW payroll_summary_by_country AS
SELECT
  country_code,
  COUNT(DISTINCT company_id) as company_count,
  COUNT(*) as employee_count,
  SUM(base_salary) as total_monthly_payroll,
  AVG(base_salary) as avg_salary,
  MIN(start_date) as earliest_start,
  MAX(start_date) as latest_start
FROM employee_payroll_profiles
WHERE status = 'active'
GROUP BY country_code;

CREATE OR REPLACE VIEW monthly_payroll_totals AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as batch_count,
  SUM(entry_count) as total_payments,
  SUM(total_gross) as total_gross,
  SUM(total_net) as total_net,
  SUM(total_tax_withholding) as total_tax,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count
FROM payroll_batches
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
