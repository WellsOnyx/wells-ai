-- ============================================================================
-- INDUSTRY CODES DATABASE (NAICS & SIC)
-- ============================================================================
-- Comprehensive industry classification for supplier targeting and invites
-- Enables "sneaky" buyer attraction through seller onboarding
-- ============================================================================

-- NAICS Codes (North American Industry Classification System - 2022)
CREATE TABLE IF NOT EXISTS naics_codes (
  code VARCHAR(6) PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,

  -- Hierarchy levels
  sector_code VARCHAR(2) NOT NULL,          -- 2-digit sector
  sector_name TEXT NOT NULL,
  subsector_code VARCHAR(3),                -- 3-digit subsector
  subsector_name TEXT,
  industry_group_code VARCHAR(4),           -- 4-digit industry group
  industry_group_name TEXT,
  naics_industry_code VARCHAR(5),           -- 5-digit NAICS industry
  naics_industry_name TEXT,
  national_industry_code VARCHAR(6),        -- 6-digit national industry

  -- Cross-reference
  related_sic_codes VARCHAR(4)[],           -- Related SIC codes

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SIC Codes (Standard Industrial Classification - legacy but widely used)
CREATE TABLE IF NOT EXISTS sic_codes (
  code VARCHAR(4) PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,

  -- Hierarchy
  division VARCHAR(1) NOT NULL,             -- A-K division
  division_name TEXT NOT NULL,
  major_group VARCHAR(2),                   -- 2-digit major group
  major_group_name TEXT,
  industry_group VARCHAR(3),                -- 3-digit industry group
  industry_group_name TEXT,

  -- Cross-reference
  related_naics_codes VARCHAR(6)[],         -- Related NAICS codes

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Supplier-Industry junction (many-to-many)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS primary_naics_code VARCHAR(6);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS secondary_naics_codes VARCHAR(6)[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS sic_codes VARCHAR(4)[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS duns_number VARCHAR(9);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cage_code VARCHAR(5);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS sam_uei VARCHAR(12);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ein VARCHAR(10);

-- Supplier diversity & classification
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_small_business BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_minority_owned BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_woman_owned BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_veteran_owned BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_service_disabled_veteran BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_8a_certified BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_hubzone BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_lgbtq_owned BOOLEAN DEFAULT FALSE;

-- Geographic coverage
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS headquarters_city TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS headquarters_state VARCHAR(2);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS headquarters_country VARCHAR(3) DEFAULT 'USA';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS service_regions TEXT[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS can_ship_internationally BOOLEAN DEFAULT FALSE;

-- Business metrics
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS employee_count_range VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS annual_revenue_range VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS years_in_business INTEGER;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS founded_year INTEGER;

-- Outreach tracking
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invite_status VARCHAR(20) DEFAULT 'not_invited';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invite_opened_at TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invite_clicked_at TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invite_registered_at TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Quality scoring
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS profile_completeness INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 50;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- ============================================================================
-- SUPPLIER INVITE CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Campaign basics
  name TEXT NOT NULL,
  description TEXT,

  -- Targeting criteria
  target_naics_codes VARCHAR(6)[],
  target_sic_codes VARCHAR(4)[],
  target_states VARCHAR(2)[],
  target_employee_ranges VARCHAR(20)[],
  target_revenue_ranges VARCHAR(20)[],
  target_certifications TEXT[],
  target_diversities TEXT[],  -- 'minority_owned', 'woman_owned', etc.

  -- Campaign content
  email_subject TEXT,
  email_template TEXT,
  sms_template TEXT,
  linkedin_message TEXT,

  -- Value prop messaging
  headline TEXT,
  benefits TEXT[],
  cta_text TEXT DEFAULT 'Join Wells AI',

  -- Status & scheduling
  status VARCHAR(20) DEFAULT 'draft',
  scheduled_start TIMESTAMP,
  scheduled_end TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Metrics
  total_targeted INTEGER DEFAULT 0,
  total_invited INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_registered INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,

  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Supplier invites (individual invite tracking)
CREATE TABLE IF NOT EXISTS supplier_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES supplier_campaigns(id),

  -- Unique invite
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  invite_url TEXT NOT NULL,

  -- Personalization
  personalized_message TEXT,
  value_prop TEXT,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',
  channel VARCHAR(20) DEFAULT 'email',

  -- Timestamps
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  registered_at TIMESTAMP,
  bounced_at TIMESTAMP,
  unsubscribed_at TIMESTAMP,

  -- Tracking
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  user_agent TEXT,
  ip_address TEXT,

  -- If registered, link to user
  registered_user_id TEXT,

  -- Metadata
  error_message TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Outreach activity log
CREATE TABLE IF NOT EXISTS supplier_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES supplier_campaigns(id),
  invite_id UUID REFERENCES supplier_invites(id),

  -- Activity details
  activity_type VARCHAR(30) NOT NULL,
  channel VARCHAR(20),

  -- Content
  subject TEXT,
  body TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',

  -- Response
  response_text TEXT,
  response_at TIMESTAMP,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SEED NAICS CODES (Major Sectors & Common Industries)
-- ============================================================================

INSERT INTO naics_codes (code, title, sector_code, sector_name, description) VALUES
-- SECTOR 11: Agriculture, Forestry, Fishing and Hunting
('11', 'Agriculture, Forestry, Fishing and Hunting', '11', 'Agriculture, Forestry, Fishing and Hunting', 'Establishments primarily engaged in growing crops, raising animals, harvesting timber, and harvesting fish'),
('111', 'Crop Production', '11', 'Agriculture, Forestry, Fishing and Hunting', 'Establishments primarily engaged in growing crops'),
('1111', 'Oilseed and Grain Farming', '11', 'Agriculture, Forestry, Fishing and Hunting', NULL),
('112', 'Animal Production and Aquaculture', '11', 'Agriculture, Forestry, Fishing and Hunting', NULL),

-- SECTOR 21: Mining, Quarrying, and Oil and Gas Extraction
('21', 'Mining, Quarrying, and Oil and Gas Extraction', '21', 'Mining, Quarrying, and Oil and Gas Extraction', NULL),
('211', 'Oil and Gas Extraction', '21', 'Mining, Quarrying, and Oil and Gas Extraction', NULL),
('212', 'Mining (except Oil and Gas)', '21', 'Mining, Quarrying, and Oil and Gas Extraction', NULL),

-- SECTOR 22: Utilities
('22', 'Utilities', '22', 'Utilities', 'Electric power generation, transmission and distribution'),
('221', 'Utilities', '22', 'Utilities', NULL),
('2211', 'Electric Power Generation, Transmission and Distribution', '22', 'Utilities', NULL),

-- SECTOR 23: Construction
('23', 'Construction', '23', 'Construction', 'Building construction, heavy and civil engineering, specialty trades'),
('236', 'Construction of Buildings', '23', 'Construction', NULL),
('2361', 'Residential Building Construction', '23', 'Construction', NULL),
('2362', 'Nonresidential Building Construction', '23', 'Construction', NULL),
('237', 'Heavy and Civil Engineering Construction', '23', 'Construction', NULL),
('238', 'Specialty Trade Contractors', '23', 'Construction', NULL),
('2381', 'Foundation, Structure, and Building Exterior Contractors', '23', 'Construction', NULL),
('2382', 'Building Equipment Contractors', '23', 'Construction', NULL),

-- SECTOR 31-33: Manufacturing
('31', 'Manufacturing', '31', 'Manufacturing', NULL),
('32', 'Manufacturing', '32', 'Manufacturing', NULL),
('33', 'Manufacturing', '33', 'Manufacturing', NULL),
('311', 'Food Manufacturing', '31', 'Manufacturing', NULL),
('312', 'Beverage and Tobacco Product Manufacturing', '31', 'Manufacturing', NULL),
('313', 'Textile Mills', '31', 'Manufacturing', NULL),
('314', 'Textile Product Mills', '31', 'Manufacturing', NULL),
('315', 'Apparel Manufacturing', '31', 'Manufacturing', NULL),
('316', 'Leather and Allied Product Manufacturing', '31', 'Manufacturing', NULL),
('321', 'Wood Product Manufacturing', '32', 'Manufacturing', NULL),
('322', 'Paper Manufacturing', '32', 'Manufacturing', NULL),
('323', 'Printing and Related Support Activities', '32', 'Manufacturing', NULL),
('324', 'Petroleum and Coal Products Manufacturing', '32', 'Manufacturing', NULL),
('325', 'Chemical Manufacturing', '32', 'Manufacturing', NULL),
('3251', 'Basic Chemical Manufacturing', '32', 'Manufacturing', NULL),
('3252', 'Resin, Rubber, and Artificial Fibers Manufacturing', '32', 'Manufacturing', NULL),
('3253', 'Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing', '32', 'Manufacturing', NULL),
('3254', 'Pharmaceutical and Medicine Manufacturing', '32', 'Manufacturing', NULL),
('326', 'Plastics and Rubber Products Manufacturing', '32', 'Manufacturing', NULL),
('327', 'Nonmetallic Mineral Product Manufacturing', '32', 'Manufacturing', NULL),
('331', 'Primary Metal Manufacturing', '33', 'Manufacturing', NULL),
('332', 'Fabricated Metal Product Manufacturing', '33', 'Manufacturing', NULL),
('3321', 'Forging and Stamping', '33', 'Manufacturing', NULL),
('3322', 'Cutlery and Handtool Manufacturing', '33', 'Manufacturing', NULL),
('3323', 'Architectural and Structural Metals Manufacturing', '33', 'Manufacturing', NULL),
('3324', 'Boiler, Tank, and Shipping Container Manufacturing', '33', 'Manufacturing', NULL),
('3325', 'Hardware Manufacturing', '33', 'Manufacturing', NULL),
('3326', 'Spring and Wire Product Manufacturing', '33', 'Manufacturing', NULL),
('3327', 'Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing', '33', 'Manufacturing', NULL),
('3328', 'Coating, Engraving, Heat Treating, and Allied Activities', '33', 'Manufacturing', NULL),
('3329', 'Other Fabricated Metal Product Manufacturing', '33', 'Manufacturing', NULL),
('333', 'Machinery Manufacturing', '33', 'Manufacturing', NULL),
('3331', 'Agriculture, Construction, and Mining Machinery Manufacturing', '33', 'Manufacturing', NULL),
('3332', 'Industrial Machinery Manufacturing', '33', 'Manufacturing', NULL),
('3333', 'Commercial and Service Industry Machinery Manufacturing', '33', 'Manufacturing', NULL),
('3334', 'Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment', '33', 'Manufacturing', NULL),
('3335', 'Metalworking Machinery Manufacturing', '33', 'Manufacturing', NULL),
('3336', 'Engine, Turbine, and Power Transmission Equipment Manufacturing', '33', 'Manufacturing', NULL),
('3339', 'Other General Purpose Machinery Manufacturing', '33', 'Manufacturing', NULL),
('334', 'Computer and Electronic Product Manufacturing', '33', 'Manufacturing', NULL),
('3341', 'Computer and Peripheral Equipment Manufacturing', '33', 'Manufacturing', NULL),
('3342', 'Communications Equipment Manufacturing', '33', 'Manufacturing', NULL),
('3343', 'Audio and Video Equipment Manufacturing', '33', 'Manufacturing', NULL),
('3344', 'Semiconductor and Other Electronic Component Manufacturing', '33', 'Manufacturing', NULL),
('3345', 'Navigational, Measuring, Electromedical, and Control Instruments', '33', 'Manufacturing', NULL),
('335', 'Electrical Equipment, Appliance, and Component Manufacturing', '33', 'Manufacturing', NULL),
('3351', 'Electric Lighting Equipment Manufacturing', '33', 'Manufacturing', NULL),
('3352', 'Household Appliance Manufacturing', '33', 'Manufacturing', NULL),
('3353', 'Electrical Equipment Manufacturing', '33', 'Manufacturing', NULL),
('3359', 'Other Electrical Equipment and Component Manufacturing', '33', 'Manufacturing', NULL),
('336', 'Transportation Equipment Manufacturing', '33', 'Manufacturing', NULL),
('3361', 'Motor Vehicle Manufacturing', '33', 'Manufacturing', NULL),
('3362', 'Motor Vehicle Body and Trailer Manufacturing', '33', 'Manufacturing', NULL),
('3363', 'Motor Vehicle Parts Manufacturing', '33', 'Manufacturing', NULL),
('3364', 'Aerospace Product and Parts Manufacturing', '33', 'Manufacturing', NULL),
('337', 'Furniture and Related Product Manufacturing', '33', 'Manufacturing', NULL),
('339', 'Miscellaneous Manufacturing', '33', 'Manufacturing', NULL),
('3391', 'Medical Equipment and Supplies Manufacturing', '33', 'Manufacturing', NULL),

-- SECTOR 42: Wholesale Trade
('42', 'Wholesale Trade', '42', 'Wholesale Trade', NULL),
('423', 'Merchant Wholesalers, Durable Goods', '42', 'Wholesale Trade', NULL),
('4231', 'Motor Vehicle and Motor Vehicle Parts and Supplies Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('4232', 'Furniture and Home Furnishing Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('4233', 'Lumber and Other Construction Materials Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('4234', 'Professional and Commercial Equipment and Supplies Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('4235', 'Metal and Mineral Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('4236', 'Household Appliances and Electrical and Electronic Goods Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('4237', 'Hardware, and Plumbing and Heating Equipment and Supplies Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('4238', 'Machinery, Equipment, and Supplies Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('4239', 'Miscellaneous Durable Goods Merchant Wholesalers', '42', 'Wholesale Trade', NULL),
('424', 'Merchant Wholesalers, Nondurable Goods', '42', 'Wholesale Trade', NULL),

-- SECTOR 44-45: Retail Trade
('44', 'Retail Trade', '44', 'Retail Trade', NULL),
('45', 'Retail Trade', '45', 'Retail Trade', NULL),
('441', 'Motor Vehicle and Parts Dealers', '44', 'Retail Trade', NULL),
('442', 'Furniture and Home Furnishings Stores', '44', 'Retail Trade', NULL),
('443', 'Electronics and Appliance Stores', '44', 'Retail Trade', NULL),
('444', 'Building Material and Garden Equipment and Supplies Dealers', '44', 'Retail Trade', NULL),
('445', 'Food and Beverage Stores', '44', 'Retail Trade', NULL),
('446', 'Health and Personal Care Stores', '44', 'Retail Trade', NULL),

-- SECTOR 48-49: Transportation and Warehousing
('48', 'Transportation and Warehousing', '48', 'Transportation and Warehousing', NULL),
('49', 'Transportation and Warehousing', '49', 'Transportation and Warehousing', NULL),
('481', 'Air Transportation', '48', 'Transportation and Warehousing', NULL),
('482', 'Rail Transportation', '48', 'Transportation and Warehousing', NULL),
('483', 'Water Transportation', '48', 'Transportation and Warehousing', NULL),
('484', 'Truck Transportation', '48', 'Transportation and Warehousing', NULL),
('485', 'Transit and Ground Passenger Transportation', '48', 'Transportation and Warehousing', NULL),
('486', 'Pipeline Transportation', '48', 'Transportation and Warehousing', NULL),
('488', 'Support Activities for Transportation', '48', 'Transportation and Warehousing', NULL),
('492', 'Couriers and Messengers', '49', 'Transportation and Warehousing', NULL),
('493', 'Warehousing and Storage', '49', 'Transportation and Warehousing', NULL),

-- SECTOR 51: Information
('51', 'Information', '51', 'Information', NULL),
('511', 'Publishing Industries', '51', 'Information', NULL),
('512', 'Motion Picture and Sound Recording Industries', '51', 'Information', NULL),
('515', 'Broadcasting', '51', 'Information', NULL),
('517', 'Telecommunications', '51', 'Information', NULL),
('518', 'Data Processing, Hosting, and Related Services', '51', 'Information', NULL),
('519', 'Other Information Services', '51', 'Information', NULL),

-- SECTOR 52: Finance and Insurance
('52', 'Finance and Insurance', '52', 'Finance and Insurance', NULL),
('521', 'Monetary Authorities-Central Bank', '52', 'Finance and Insurance', NULL),
('522', 'Credit Intermediation and Related Activities', '52', 'Finance and Insurance', NULL),
('523', 'Securities, Commodity Contracts, and Other Financial Investments', '52', 'Finance and Insurance', NULL),
('524', 'Insurance Carriers and Related Activities', '52', 'Finance and Insurance', NULL),
('525', 'Funds, Trusts, and Other Financial Vehicles', '52', 'Finance and Insurance', NULL),

-- SECTOR 53: Real Estate and Rental and Leasing
('53', 'Real Estate and Rental and Leasing', '53', 'Real Estate and Rental and Leasing', NULL),
('531', 'Real Estate', '53', 'Real Estate and Rental and Leasing', NULL),
('532', 'Rental and Leasing Services', '53', 'Real Estate and Rental and Leasing', NULL),

-- SECTOR 54: Professional, Scientific, and Technical Services
('54', 'Professional, Scientific, and Technical Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('541', 'Professional, Scientific, and Technical Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('5411', 'Legal Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('5412', 'Accounting, Tax Preparation, Bookkeeping, and Payroll Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('5413', 'Architectural, Engineering, and Related Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('5414', 'Specialized Design Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('5415', 'Computer Systems Design and Related Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('5416', 'Management, Scientific, and Technical Consulting Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('5417', 'Scientific Research and Development Services', '54', 'Professional, Scientific, and Technical Services', NULL),
('5418', 'Advertising, Public Relations, and Related Services', '54', 'Professional, Scientific, and Technical Services', NULL),

-- SECTOR 55: Management of Companies and Enterprises
('55', 'Management of Companies and Enterprises', '55', 'Management of Companies and Enterprises', NULL),
('551', 'Management of Companies and Enterprises', '55', 'Management of Companies and Enterprises', NULL),

-- SECTOR 56: Administrative and Support and Waste Management
('56', 'Administrative and Support and Waste Management', '56', 'Administrative and Support and Waste Management', NULL),
('561', 'Administrative and Support Services', '56', 'Administrative and Support and Waste Management', NULL),
('5611', 'Office Administrative Services', '56', 'Administrative and Support and Waste Management', NULL),
('5613', 'Employment Services', '56', 'Administrative and Support and Waste Management', NULL),
('562', 'Waste Management and Remediation Services', '56', 'Administrative and Support and Waste Management', NULL),

-- SECTOR 61: Educational Services
('61', 'Educational Services', '61', 'Educational Services', NULL),
('611', 'Educational Services', '61', 'Educational Services', NULL),

-- SECTOR 62: Health Care and Social Assistance
('62', 'Health Care and Social Assistance', '62', 'Health Care and Social Assistance', NULL),
('621', 'Ambulatory Health Care Services', '62', 'Health Care and Social Assistance', NULL),
('622', 'Hospitals', '62', 'Health Care and Social Assistance', NULL),
('623', 'Nursing and Residential Care Facilities', '62', 'Health Care and Social Assistance', NULL),
('624', 'Social Assistance', '62', 'Health Care and Social Assistance', NULL),

-- SECTOR 71: Arts, Entertainment, and Recreation
('71', 'Arts, Entertainment, and Recreation', '71', 'Arts, Entertainment, and Recreation', NULL),
('711', 'Performing Arts, Spectator Sports, and Related Industries', '71', 'Arts, Entertainment, and Recreation', NULL),
('712', 'Museums, Historical Sites, and Similar Institutions', '71', 'Arts, Entertainment, and Recreation', NULL),
('713', 'Amusement, Gambling, and Recreation Industries', '71', 'Arts, Entertainment, and Recreation', NULL),

-- SECTOR 72: Accommodation and Food Services
('72', 'Accommodation and Food Services', '72', 'Accommodation and Food Services', NULL),
('721', 'Accommodation', '72', 'Accommodation and Food Services', NULL),
('722', 'Food Services and Drinking Places', '72', 'Accommodation and Food Services', NULL),

-- SECTOR 81: Other Services
('81', 'Other Services (except Public Administration)', '81', 'Other Services', NULL),
('811', 'Repair and Maintenance', '81', 'Other Services', NULL),
('812', 'Personal and Laundry Services', '81', 'Other Services', NULL),
('813', 'Religious, Grantmaking, Civic, Professional, and Similar Organizations', '81', 'Other Services', NULL)

ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SEED SIC CODES (Major Divisions)
-- ============================================================================

INSERT INTO sic_codes (code, title, division, division_name) VALUES
-- Division A: Agriculture, Forestry, And Fishing
('01', 'Agricultural Production-Crops', 'A', 'Agriculture, Forestry, And Fishing'),
('02', 'Agricultural Production-Livestock', 'A', 'Agriculture, Forestry, And Fishing'),
('07', 'Agricultural Services', 'A', 'Agriculture, Forestry, And Fishing'),
('08', 'Forestry', 'A', 'Agriculture, Forestry, And Fishing'),
('09', 'Fishing, Hunting, And Trapping', 'A', 'Agriculture, Forestry, And Fishing'),

-- Division B: Mining
('10', 'Metal Mining', 'B', 'Mining'),
('12', 'Coal Mining', 'B', 'Mining'),
('13', 'Oil And Gas Extraction', 'B', 'Mining'),
('14', 'Mining And Quarrying Of Nonmetallic Minerals', 'B', 'Mining'),

-- Division C: Construction
('15', 'Building Construction-General Contractors', 'C', 'Construction'),
('16', 'Heavy Construction-General Contractors', 'C', 'Construction'),
('17', 'Construction-Special Trade Contractors', 'C', 'Construction'),

-- Division D: Manufacturing
('20', 'Food And Kindred Products', 'D', 'Manufacturing'),
('21', 'Tobacco Products', 'D', 'Manufacturing'),
('22', 'Textile Mill Products', 'D', 'Manufacturing'),
('23', 'Apparel And Other Finished Products', 'D', 'Manufacturing'),
('24', 'Lumber And Wood Products', 'D', 'Manufacturing'),
('25', 'Furniture And Fixtures', 'D', 'Manufacturing'),
('26', 'Paper And Allied Products', 'D', 'Manufacturing'),
('27', 'Printing, Publishing, And Allied Industries', 'D', 'Manufacturing'),
('28', 'Chemicals And Allied Products', 'D', 'Manufacturing'),
('29', 'Petroleum Refining And Related Industries', 'D', 'Manufacturing'),
('30', 'Rubber And Miscellaneous Plastics Products', 'D', 'Manufacturing'),
('31', 'Leather And Leather Products', 'D', 'Manufacturing'),
('32', 'Stone, Clay, Glass, And Concrete Products', 'D', 'Manufacturing'),
('33', 'Primary Metal Industries', 'D', 'Manufacturing'),
('34', 'Fabricated Metal Products', 'D', 'Manufacturing'),
('35', 'Industrial And Commercial Machinery', 'D', 'Manufacturing'),
('36', 'Electronic And Other Electrical Equipment', 'D', 'Manufacturing'),
('37', 'Transportation Equipment', 'D', 'Manufacturing'),
('38', 'Measuring, Analyzing, And Controlling Instruments', 'D', 'Manufacturing'),
('39', 'Miscellaneous Manufacturing Industries', 'D', 'Manufacturing'),

-- Division E: Transportation, Communications, Electric, Gas, And Sanitary Services
('40', 'Railroad Transportation', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('41', 'Local And Suburban Transit And Interurban Highway Passenger Transportation', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('42', 'Motor Freight Transportation And Warehousing', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('43', 'United States Postal Service', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('44', 'Water Transportation', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('45', 'Transportation By Air', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('46', 'Pipelines, Except Natural Gas', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('47', 'Transportation Services', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('48', 'Communications', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),
('49', 'Electric, Gas, And Sanitary Services', 'E', 'Transportation, Communications, Electric, Gas, And Sanitary Services'),

-- Division F: Wholesale Trade
('50', 'Wholesale Trade-Durable Goods', 'F', 'Wholesale Trade'),
('51', 'Wholesale Trade-Nondurable Goods', 'F', 'Wholesale Trade'),

-- Division G: Retail Trade
('52', 'Building Materials, Hardware, Garden Supply, And Mobile Home Dealers', 'G', 'Retail Trade'),
('53', 'General Merchandise Stores', 'G', 'Retail Trade'),
('54', 'Food Stores', 'G', 'Retail Trade'),
('55', 'Automotive Dealers And Gasoline Service Stations', 'G', 'Retail Trade'),
('56', 'Apparel And Accessory Stores', 'G', 'Retail Trade'),
('57', 'Home Furniture, Furnishings, And Equipment Stores', 'G', 'Retail Trade'),
('58', 'Eating And Drinking Places', 'G', 'Retail Trade'),
('59', 'Miscellaneous Retail', 'G', 'Retail Trade'),

-- Division H: Finance, Insurance, And Real Estate
('60', 'Depository Institutions', 'H', 'Finance, Insurance, And Real Estate'),
('61', 'Nondepository Credit Institutions', 'H', 'Finance, Insurance, And Real Estate'),
('62', 'Security And Commodity Brokers, Dealers, Exchanges, And Services', 'H', 'Finance, Insurance, And Real Estate'),
('63', 'Insurance Carriers', 'H', 'Finance, Insurance, And Real Estate'),
('64', 'Insurance Agents, Brokers, And Service', 'H', 'Finance, Insurance, And Real Estate'),
('65', 'Real Estate', 'H', 'Finance, Insurance, And Real Estate'),
('67', 'Holding And Other Investment Offices', 'H', 'Finance, Insurance, And Real Estate'),

-- Division I: Services
('70', 'Hotels, Rooming Houses, Camps, And Other Lodging Places', 'I', 'Services'),
('72', 'Personal Services', 'I', 'Services'),
('73', 'Business Services', 'I', 'Services'),
('75', 'Automotive Repair, Services, And Parking', 'I', 'Services'),
('76', 'Miscellaneous Repair Services', 'I', 'Services'),
('78', 'Motion Pictures', 'I', 'Services'),
('79', 'Amusement And Recreation Services', 'I', 'Services'),
('80', 'Health Services', 'I', 'Services'),
('81', 'Legal Services', 'I', 'Services'),
('82', 'Educational Services', 'I', 'Services'),
('83', 'Social Services', 'I', 'Services'),
('84', 'Museums, Art Galleries, And Botanical And Zoological Gardens', 'I', 'Services'),
('86', 'Membership Organizations', 'I', 'Services'),
('87', 'Engineering, Accounting, Research, Management, And Related Services', 'I', 'Services'),
('89', 'Miscellaneous Services', 'I', 'Services'),

-- Division J: Public Administration
('91', 'Executive, Legislative, And General Government', 'J', 'Public Administration'),
('92', 'Justice, Public Order, And Safety', 'J', 'Public Administration'),
('93', 'Public Finance, Taxation, And Monetary Policy', 'J', 'Public Administration'),
('94', 'Administration Of Human Resource Programs', 'J', 'Public Administration'),
('95', 'Administration Of Environmental Quality And Housing Programs', 'J', 'Public Administration'),
('96', 'Administration Of Economic Programs', 'J', 'Public Administration'),
('97', 'National Security And International Affairs', 'J', 'Public Administration')

ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_naics_sector ON naics_codes(sector_code);
CREATE INDEX IF NOT EXISTS idx_naics_title ON naics_codes USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_sic_division ON sic_codes(division);
CREATE INDEX IF NOT EXISTS idx_sic_title ON sic_codes USING GIN(to_tsvector('english', title));

CREATE INDEX IF NOT EXISTS idx_suppliers_naics ON suppliers(primary_naics_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_naics_array ON suppliers USING GIN(secondary_naics_codes);
CREATE INDEX IF NOT EXISTS idx_suppliers_sic_array ON suppliers USING GIN(sic_codes);
CREATE INDEX IF NOT EXISTS idx_suppliers_invite_status ON suppliers(invite_status);
CREATE INDEX IF NOT EXISTS idx_suppliers_state ON suppliers(headquarters_state);
CREATE INDEX IF NOT EXISTS idx_suppliers_source ON suppliers(source);
CREATE INDEX IF NOT EXISTS idx_suppliers_diversity ON suppliers(is_minority_owned, is_woman_owned, is_veteran_owned);

CREATE INDEX IF NOT EXISTS idx_supplier_invites_code ON supplier_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_status ON supplier_invites(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_campaign ON supplier_invites(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON supplier_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_naics ON supplier_campaigns USING GIN(target_naics_codes);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Suppliers by industry overview
CREATE OR REPLACE VIEW supplier_industry_overview AS
SELECT
  s.primary_naics_code,
  n.title as industry_name,
  n.sector_name,
  COUNT(*) as supplier_count,
  COUNT(*) FILTER (WHERE s.invite_status = 'registered') as registered_count,
  COUNT(*) FILTER (WHERE s.invite_status = 'invited') as invited_count,
  COUNT(*) FILTER (WHERE s.is_verified) as verified_count,
  AVG(s.trust_score) as avg_trust_score
FROM suppliers s
LEFT JOIN naics_codes n ON s.primary_naics_code = n.code
WHERE s.primary_naics_code IS NOT NULL
GROUP BY s.primary_naics_code, n.title, n.sector_name
ORDER BY supplier_count DESC;

-- Campaign performance
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.*,
  CASE WHEN c.total_invited > 0
    THEN ROUND((c.total_registered::DECIMAL / c.total_invited) * 100, 2)
    ELSE 0
  END as registration_rate,
  CASE WHEN c.total_invited > 0
    THEN ROUND((c.total_opened::DECIMAL / c.total_invited) * 100, 2)
    ELSE 0
  END as open_rate,
  CASE WHEN c.total_opened > 0
    THEN ROUND((c.total_clicked::DECIMAL / c.total_opened) * 100, 2)
    ELSE 0
  END as click_through_rate
FROM supplier_campaigns c;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE naics_codes IS 'NAICS 2022 industry classification codes';
COMMENT ON TABLE sic_codes IS 'Standard Industrial Classification codes (legacy)';
COMMENT ON TABLE supplier_campaigns IS 'Outreach campaigns targeting suppliers by industry';
COMMENT ON TABLE supplier_invites IS 'Individual supplier invite tracking';
COMMENT ON TABLE supplier_outreach_log IS 'Activity log for all supplier communications';
