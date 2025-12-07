-- Grain & Vault Personal Lending System Schema
-- Supports mortgages, auto loans, and personal loans

-- Loan product definitions
CREATE TABLE IF NOT EXISTS loan_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code VARCHAR(50) UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(50) NOT NULL, -- 'mortgage', 'auto', 'personal'
  term_months INTEGER NOT NULL,
  min_amount DECIMAL(12,2) NOT NULL,
  max_amount DECIMAL(12,2) NOT NULL,
  base_rate DECIMAL(5,4) NOT NULL, -- Base APR as decimal (0.0650 = 6.5%)
  is_secured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  features JSONB, -- Product-specific features
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit tier rate adjustments
CREATE TABLE IF NOT EXISTS loan_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES loan_products(id),
  credit_tier VARCHAR(50) NOT NULL, -- 'excellent', 'good', 'fair', 'subprime'
  min_credit_score INTEGER NOT NULL,
  max_credit_score INTEGER NOT NULL,
  rate_adjustment DECIMAL(5,4) NOT NULL, -- Added to base rate (-0.0050 = -0.5%)
  max_ltv DECIMAL(5,2), -- Maximum LTV for this tier
  max_dti DECIMAL(5,2), -- Maximum DTI for this tier
  min_down_payment DECIMAL(5,2), -- Minimum down payment percentage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Borrower profiles
CREATE TABLE IF NOT EXISTS borrower_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) UNIQUE, -- Link to auth system
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  ssn_encrypted TEXT, -- Encrypted SSN
  date_of_birth DATE,
  phone VARCHAR(20),

  -- Address
  street_address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),

  -- Employment
  employer_name VARCHAR(255),
  job_title VARCHAR(255),
  employment_type VARCHAR(50), -- 'full_time', 'part_time', 'self_employed', 'retired'
  employment_start_date DATE,
  annual_income DECIMAL(12,2),
  additional_income DECIMAL(12,2),

  -- Credit info (updated periodically)
  credit_score INTEGER,
  credit_report_date DATE,
  credit_bureau VARCHAR(50),

  -- Financial snapshot
  total_assets DECIMAL(12,2),
  total_liabilities DECIMAL(12,2),
  monthly_housing_payment DECIMAL(10,2),
  monthly_debt_payments DECIMAL(10,2),

  -- GRAIN holdings
  grain_balance DECIMAL(18,2) DEFAULT 0,
  grain_staked DECIMAL(18,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loan applications
CREATE TABLE IF NOT EXISTS loan_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_number VARCHAR(50) UNIQUE NOT NULL,
  borrower_id UUID REFERENCES borrower_profiles(id),
  product_id UUID REFERENCES loan_products(id),

  -- Loan details
  requested_amount DECIMAL(12,2) NOT NULL,
  loan_purpose VARCHAR(100), -- 'purchase', 'refinance', 'debt_consolidation', etc.

  -- Property/Collateral (for secured loans)
  collateral_type VARCHAR(50), -- 'real_estate', 'vehicle', 'grain', null
  property_address VARCHAR(255),
  property_city VARCHAR(100),
  property_state VARCHAR(2),
  property_zip VARCHAR(10),
  property_value DECIMAL(12,2),
  property_use VARCHAR(50), -- 'primary_residence', 'investment', 'vacation'

  -- Vehicle details (for auto loans)
  vehicle_year INTEGER,
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_vin VARCHAR(17),
  vehicle_mileage INTEGER,
  vehicle_value DECIMAL(12,2),
  vehicle_condition VARCHAR(50), -- 'new', 'used', 'certified_pre_owned'

  -- Loan structure
  down_payment DECIMAL(12,2),
  loan_to_value DECIMAL(5,2), -- LTV ratio

  -- Co-borrower info
  has_co_borrower BOOLEAN DEFAULT false,
  co_borrower_data JSONB,

  -- Application status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'under_review', 'approved', 'declined', 'funded'
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  decision_at TIMESTAMPTZ,

  -- Workflow
  current_step INTEGER DEFAULT 1,
  completed_steps JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Underwriting decisions
CREATE TABLE IF NOT EXISTS loan_underwriting_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES loan_applications(id),

  -- Decision
  decision VARCHAR(50) NOT NULL, -- 'approved', 'declined', 'conditional', 'manual_review'
  decision_date TIMESTAMPTZ DEFAULT NOW(),
  underwriter VARCHAR(255), -- 'AUTOMATED' or underwriter name

  -- Approved terms
  approved_amount DECIMAL(12,2),
  approved_rate DECIMAL(5,4),
  approved_term_months INTEGER,
  monthly_payment DECIMAL(10,2),
  apr DECIMAL(5,4),

  -- Rate breakdown
  base_rate DECIMAL(5,4),
  credit_adjustment DECIMAL(5,4),
  grain_discount DECIMAL(5,4),
  points_paid DECIMAL(5,2),

  -- Underwriting factors
  credit_score INTEGER,
  dti_ratio DECIMAL(5,2),
  ltv_ratio DECIMAL(5,2),
  debt_to_income_details JSONB,

  -- Conditions
  conditions JSONB, -- Array of conditions that must be met
  stipulations JSONB, -- Required documents/actions

  -- Decline reasons
  decline_reasons JSONB,
  adverse_action_notice TEXT,

  -- Risk assessment
  risk_grade VARCHAR(10), -- 'A', 'B', 'C', 'D'
  risk_score DECIMAL(5,2),
  risk_factors JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document management
CREATE TABLE IF NOT EXISTS loan_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES loan_applications(id),
  loan_id UUID, -- References loans table (created later)

  document_type VARCHAR(100) NOT NULL, -- 'pay_stub', 'w2', 'tax_return', 'bank_statement', 'id', etc.
  document_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),

  -- Document metadata
  tax_year INTEGER, -- For tax returns
  statement_date DATE, -- For bank statements
  employer VARCHAR(255), -- For pay stubs

  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,

  -- OCR/extraction
  extracted_data JSONB,

  uploaded_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active loans
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_number VARCHAR(50) UNIQUE NOT NULL,
  application_id UUID REFERENCES loan_applications(id),
  borrower_id UUID REFERENCES borrower_profiles(id),
  product_id UUID REFERENCES loan_products(id),

  -- Loan terms
  original_amount DECIMAL(12,2) NOT NULL,
  current_balance DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,4) NOT NULL,
  apr DECIMAL(5,4) NOT NULL,
  term_months INTEGER NOT NULL,
  remaining_months INTEGER NOT NULL,

  -- Payment info
  monthly_payment DECIMAL(10,2) NOT NULL,
  next_payment_date DATE NOT NULL,
  last_payment_date DATE,
  payment_day_of_month INTEGER DEFAULT 1,

  -- Dates
  origination_date DATE NOT NULL,
  first_payment_date DATE NOT NULL,
  maturity_date DATE NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'paid_off', 'charged_off', 'default', 'in_forbearance'
  days_delinquent INTEGER DEFAULT 0,

  -- Collateral reference
  collateral_id UUID, -- References loan_collateral

  -- Servicing
  servicer VARCHAR(255) DEFAULT 'Grain & Vault',
  payment_method VARCHAR(50), -- 'ach', 'card', 'check'
  autopay_enabled BOOLEAN DEFAULT false,

  -- Totals
  total_interest_paid DECIMAL(12,2) DEFAULT 0,
  total_principal_paid DECIMAL(12,2) DEFAULT 0,
  total_fees_paid DECIMAL(12,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collateral tracking
CREATE TABLE IF NOT EXISTS loan_collateral (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(id),
  collateral_type VARCHAR(50) NOT NULL, -- 'real_estate', 'vehicle', 'grain'

  -- Real estate
  property_address VARCHAR(255),
  property_city VARCHAR(100),
  property_state VARCHAR(2),
  property_zip VARCHAR(10),
  property_type VARCHAR(50), -- 'single_family', 'condo', 'multi_family'
  original_value DECIMAL(12,2),
  current_value DECIMAL(12,2),
  appraisal_date DATE,
  appraisal_company VARCHAR(255),

  -- Vehicle
  vehicle_year INTEGER,
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_vin VARCHAR(17),
  vehicle_mileage INTEGER,
  vehicle_value DECIMAL(12,2),
  valuation_source VARCHAR(100), -- 'KBB', 'NADA', 'Edmunds'

  -- GRAIN
  grain_amount DECIMAL(18,2),
  grain_lock_date TIMESTAMPTZ,
  grain_unlock_date TIMESTAMPTZ,
  grain_wallet_address VARCHAR(255),

  -- Lien/Title
  lien_holder VARCHAR(255) DEFAULT 'Grain & Vault',
  lien_date DATE,
  lien_release_date DATE,
  title_status VARCHAR(50), -- 'clear', 'lienholder', 'salvage'

  -- Insurance
  insurance_required BOOLEAN DEFAULT true,
  insurance_company VARCHAR(255),
  insurance_policy_number VARCHAR(100),
  insurance_expiration DATE,
  insurance_verified BOOLEAN DEFAULT false,

  -- Valuation updates
  last_valuation_date DATE,
  last_valuation_amount DECIMAL(12,2),
  valuation_history JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment schedule and history
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(id),
  payment_number INTEGER NOT NULL,

  -- Scheduled payment
  due_date DATE NOT NULL,
  scheduled_amount DECIMAL(10,2) NOT NULL,
  scheduled_principal DECIMAL(10,2) NOT NULL,
  scheduled_interest DECIMAL(10,2) NOT NULL,

  -- Actual payment
  payment_date DATE,
  amount_paid DECIMAL(10,2),
  principal_paid DECIMAL(10,2),
  interest_paid DECIMAL(10,2),
  fees_paid DECIMAL(10,2),
  escrow_paid DECIMAL(10,2),

  -- Late fees
  late_fee DECIMAL(10,2) DEFAULT 0,
  late_fee_waived BOOLEAN DEFAULT false,

  -- Balance tracking
  principal_balance_before DECIMAL(12,2),
  principal_balance_after DECIMAL(12,2),

  -- Payment method
  payment_method VARCHAR(50), -- 'ach', 'card', 'check', 'wire', 'grain'
  payment_reference VARCHAR(255),
  transaction_id VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'paid', 'partial', 'late', 'missed', 'deferred'
  is_extra_payment BOOLEAN DEFAULT false,

  -- Processing
  processed_by VARCHAR(255),
  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(loan_id, payment_number)
);

-- Escrow accounts (for mortgages)
CREATE TABLE IF NOT EXISTS loan_escrow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(id) UNIQUE,

  -- Account info
  escrow_balance DECIMAL(10,2) DEFAULT 0,
  monthly_escrow_payment DECIMAL(10,2) NOT NULL,

  -- Property tax
  annual_property_tax DECIMAL(10,2) NOT NULL,
  property_tax_due_dates JSONB, -- Array of due dates
  last_tax_payment_date DATE,
  last_tax_payment_amount DECIMAL(10,2),

  -- Homeowners insurance
  annual_insurance_premium DECIMAL(10,2) NOT NULL,
  insurance_due_date DATE,
  last_insurance_payment_date DATE,
  last_insurance_payment_amount DECIMAL(10,2),

  -- PMI (if applicable)
  pmi_required BOOLEAN DEFAULT false,
  monthly_pmi DECIMAL(10,2),
  pmi_removal_ltv DECIMAL(5,2) DEFAULT 0.80,

  -- HOA (if applicable)
  hoa_required BOOLEAN DEFAULT false,
  monthly_hoa DECIMAL(10,2),

  -- Analysis
  last_analysis_date DATE,
  next_analysis_date DATE,
  shortage_amount DECIMAL(10,2) DEFAULT 0,
  surplus_amount DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escrow transaction history
CREATE TABLE IF NOT EXISTS loan_escrow_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id UUID REFERENCES loan_escrow(id),
  loan_id UUID REFERENCES loans(id),

  transaction_type VARCHAR(50) NOT NULL, -- 'deposit', 'withdrawal', 'interest', 'adjustment'
  category VARCHAR(50), -- 'property_tax', 'insurance', 'pmi', 'hoa'
  amount DECIMAL(10,2) NOT NULL,
  transaction_date DATE NOT NULL,

  balance_before DECIMAL(10,2),
  balance_after DECIMAL(10,2),

  description TEXT,
  reference_number VARCHAR(255),
  payee VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate lock tracking
CREATE TABLE IF NOT EXISTS loan_rate_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES loan_applications(id),

  locked_rate DECIMAL(5,4) NOT NULL,
  lock_date TIMESTAMPTZ NOT NULL,
  lock_expiration TIMESTAMPTZ NOT NULL,
  lock_period_days INTEGER NOT NULL, -- 30, 45, 60 days

  lock_fee DECIMAL(10,2) DEFAULT 0,
  is_extended BOOLEAN DEFAULT false,
  extension_fee DECIMAL(10,2),

  status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'converted', 'cancelled'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loan modifications/workouts
CREATE TABLE IF NOT EXISTS loan_modifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(id),

  modification_type VARCHAR(50) NOT NULL, -- 'rate_reduction', 'term_extension', 'forbearance', 'principal_reduction'
  reason VARCHAR(255),

  -- Original terms
  original_rate DECIMAL(5,4),
  original_payment DECIMAL(10,2),
  original_term_months INTEGER,
  original_balance DECIMAL(12,2),

  -- Modified terms
  new_rate DECIMAL(5,4),
  new_payment DECIMAL(10,2),
  new_term_months INTEGER,
  new_balance DECIMAL(12,2),

  -- Dates
  effective_date DATE NOT NULL,
  end_date DATE,

  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'active', 'completed', 'denied'
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_loan_applications_borrower ON loan_applications(borrower_id);
CREATE INDEX idx_loan_applications_status ON loan_applications(status);
CREATE INDEX idx_loans_borrower ON loans(borrower_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_due_date ON loan_payments(due_date);
CREATE INDEX idx_loan_payments_status ON loan_payments(status);
CREATE INDEX idx_borrower_profiles_email ON borrower_profiles(email);
CREATE INDEX idx_loan_documents_application ON loan_documents(application_id);
CREATE INDEX idx_loan_documents_loan ON loan_documents(loan_id);
CREATE INDEX idx_loan_collateral_loan ON loan_collateral(loan_id);

-- Insert default loan products
INSERT INTO loan_products (product_code, product_name, product_type, term_months, min_amount, max_amount, base_rate, is_secured, description, features) VALUES
-- Mortgages
('MORTGAGE_30YR_FIXED', '30-Year Fixed Rate Mortgage', 'mortgage', 360, 50000, 2000000, 0.0675, true, 'Traditional 30-year fixed rate mortgage with predictable payments', '{"conventional": true, "conforming": true}'),
('MORTGAGE_15YR_FIXED', '15-Year Fixed Rate Mortgage', 'mortgage', 180, 50000, 2000000, 0.0600, true, 'Build equity faster with a 15-year fixed rate mortgage', '{"conventional": true, "conforming": true}'),
('MORTGAGE_ARM_5_1', '5/1 Adjustable Rate Mortgage', 'mortgage', 360, 50000, 2000000, 0.0575, true, 'Fixed for 5 years, then adjusts annually', '{"arm": true, "initial_fixed_years": 5}'),
('MORTGAGE_FHA_30YR', 'FHA 30-Year Fixed', 'mortgage', 360, 50000, 726525, 0.0650, true, 'FHA-backed mortgage with low down payment', '{"fha": true, "min_down_payment": 0.035}'),
('MORTGAGE_JUMBO_30YR', 'Jumbo 30-Year Fixed', 'mortgage', 360, 726526, 5000000, 0.0725, true, 'For loan amounts exceeding conforming limits', '{"jumbo": true, "min_credit_score": 700}'),

-- Auto Loans
('AUTO_NEW_60MO', 'New Auto 60-Month', 'auto', 60, 10000, 150000, 0.0699, true, 'Finance your new vehicle with competitive rates', '{"vehicle_age": "new", "max_vehicle_age": 0}'),
('AUTO_NEW_72MO', 'New Auto 72-Month', 'auto', 72, 10000, 150000, 0.0749, true, 'Extended term for lower monthly payments on new vehicles', '{"vehicle_age": "new", "max_vehicle_age": 0}'),
('AUTO_USED_48MO', 'Used Auto 48-Month', 'auto', 48, 5000, 100000, 0.0849, true, 'Competitive rates on quality used vehicles', '{"vehicle_age": "used", "max_vehicle_age": 7}'),
('AUTO_USED_60MO', 'Used Auto 60-Month', 'auto', 60, 5000, 100000, 0.0899, true, 'Finance used vehicles up to 7 years old', '{"vehicle_age": "used", "max_vehicle_age": 7}'),

-- Personal Loans
('PERSONAL_UNSECURED_36MO', 'Personal Loan 36-Month', 'personal', 36, 1000, 50000, 0.1199, false, 'Unsecured personal loan for any purpose', '{"unsecured": true, "max_dti": 0.43}'),
('PERSONAL_UNSECURED_60MO', 'Personal Loan 60-Month', 'personal', 60, 5000, 50000, 0.1399, false, 'Extended term unsecured personal loan', '{"unsecured": true, "max_dti": 0.43}'),
('PERSONAL_SECURED_48MO', 'Secured Personal Loan 48-Month', 'personal', 48, 5000, 100000, 0.0899, true, 'Lower rates with collateral', '{"secured": true}'),
('PERSONAL_DEBT_CONSOLIDATION', 'Debt Consolidation Loan', 'personal', 60, 5000, 75000, 0.1099, false, 'Consolidate high-interest debt into one payment', '{"purpose": "debt_consolidation"}'),

-- GRAIN-Backed Products
('GRAIN_BACKED_INSTANT', 'GRAIN-Backed Instant Loan', 'personal', 12, 1000, 500000, 0.0000, true, 'Instant approval using GRAIN as collateral - 0% APR', '{"grain_backed": true, "instant_approval": true, "max_ltv": 0.50}'),
('GRAIN_DISCOUNT_MORTGAGE', 'GRAIN Holder Mortgage', 'mortgage', 360, 50000, 2000000, 0.0625, true, 'Exclusive mortgage rates for GRAIN holders', '{"grain_exclusive": true, "base_discount": 0.0050}');

-- Insert credit tier rate adjustments
INSERT INTO loan_rates (product_id, credit_tier, min_credit_score, max_credit_score, rate_adjustment, max_ltv, max_dti, min_down_payment)
SELECT id, 'excellent', 750, 850, -0.0050, 0.97, 0.45, 0.03 FROM loan_products WHERE product_type = 'mortgage'
UNION ALL
SELECT id, 'good', 700, 749, 0.0000, 0.95, 0.43, 0.05 FROM loan_products WHERE product_type = 'mortgage'
UNION ALL
SELECT id, 'fair', 650, 699, 0.0075, 0.90, 0.41, 0.10 FROM loan_products WHERE product_type = 'mortgage'
UNION ALL
SELECT id, 'subprime', 580, 649, 0.0200, 0.85, 0.38, 0.15 FROM loan_products WHERE product_type = 'mortgage'
UNION ALL
SELECT id, 'excellent', 750, 850, -0.0100, 1.00, 0.45, 0.10 FROM loan_products WHERE product_type = 'auto'
UNION ALL
SELECT id, 'good', 700, 749, 0.0000, 1.00, 0.43, 0.10 FROM loan_products WHERE product_type = 'auto'
UNION ALL
SELECT id, 'fair', 650, 699, 0.0150, 0.95, 0.41, 0.15 FROM loan_products WHERE product_type = 'auto'
UNION ALL
SELECT id, 'subprime', 580, 649, 0.0400, 0.90, 0.38, 0.20 FROM loan_products WHERE product_type = 'auto'
UNION ALL
SELECT id, 'excellent', 750, 850, -0.0200, NULL, 0.40, NULL FROM loan_products WHERE product_type = 'personal' AND is_secured = false
UNION ALL
SELECT id, 'good', 700, 749, 0.0000, NULL, 0.40, NULL FROM loan_products WHERE product_type = 'personal' AND is_secured = false
UNION ALL
SELECT id, 'fair', 650, 699, 0.0300, NULL, 0.38, NULL FROM loan_products WHERE product_type = 'personal' AND is_secured = false
UNION ALL
SELECT id, 'subprime', 580, 649, 0.0800, NULL, 0.35, NULL FROM loan_products WHERE product_type = 'personal' AND is_secured = false;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_loan_products_updated_at BEFORE UPDATE ON loan_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loan_rates_updated_at BEFORE UPDATE ON loan_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_borrower_profiles_updated_at BEFORE UPDATE ON borrower_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loan_applications_updated_at BEFORE UPDATE ON loan_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loan_collateral_updated_at BEFORE UPDATE ON loan_collateral FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loan_escrow_updated_at BEFORE UPDATE ON loan_escrow FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
