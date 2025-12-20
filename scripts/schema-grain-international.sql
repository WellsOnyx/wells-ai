-- ============================================================================
-- GRAIN & VAULT INTERNATIONAL KYC SCHEMA
-- Multi-country support for US, CA, MX, AR, GB, AE, JP, SG
-- Run: psql $POSTGRES_URL < scripts/schema-grain-international.sql
-- ============================================================================

-- ============================================================================
-- ALTER grain_user_profiles FOR INTERNATIONAL SUPPORT
-- ============================================================================

-- Add country-specific ID fields
ALTER TABLE grain_user_profiles
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS country_of_residence TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS tax_id_type TEXT,
  ADD COLUMN IF NOT EXISTS tax_id_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tax_id_verified BOOLEAN DEFAULT FALSE;

-- Update government_id_type to support international IDs
ALTER TABLE grain_user_profiles
  DROP CONSTRAINT IF EXISTS grain_user_profiles_government_id_type_check;

ALTER TABLE grain_user_profiles
  ADD CONSTRAINT grain_user_profiles_government_id_type_check
  CHECK (government_id_type IN (
    -- United States
    'drivers_license', 'passport', 'state_id', 'military_id', 'real_id', 'us_passport_card',
    -- Canada
    'canadian_passport', 'provincial_drivers_license', 'provincial_id', 'permanent_resident_card',
    -- Mexico
    'ine', 'mexican_passport', 'cedula_profesional', 'fm2_fm3',
    -- Argentina
    'dni', 'argentine_passport', 'residencia',
    -- United Kingdom
    'uk_passport', 'uk_drivers_license', 'biometric_residence_permit',
    -- UAE
    'emirates_id', 'uae_passport', 'uae_residence_visa',
    -- Japan
    'japanese_passport', 'residence_card', 'my_number_card', 'drivers_license_japan',
    -- Singapore
    'nric', 'fin', 'singapore_passport', 'employment_pass', 'work_permit'
  ));

-- Add constraint for tax_id_type
ALTER TABLE grain_user_profiles
  ADD CONSTRAINT grain_user_profiles_tax_id_type_check
  CHECK (tax_id_type IS NULL OR tax_id_type IN (
    'ssn',            -- United States
    'sin',            -- Canada
    'curp',           -- Mexico
    'cuit', 'cuil',   -- Argentina
    'ni_number', 'utr', -- United Kingdom
    'tin_uae',        -- UAE
    'my_number',      -- Japan
    'nric_number', 'fin_number', 'uen'  -- Singapore
  ));

-- Add constraint for country_of_residence
ALTER TABLE grain_user_profiles
  ADD CONSTRAINT grain_user_profiles_country_check
  CHECK (country_of_residence IN ('US', 'CA', 'MX', 'AR', 'GB', 'AE', 'JP', 'SG'));

-- ============================================================================
-- SANCTIONED COUNTRIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_sanctioned_countries (
  country_code CHAR(2) PRIMARY KEY,
  country_name TEXT NOT NULL,
  sanction_type TEXT NOT NULL CHECK (sanction_type IN ('full', 'partial', 'sectoral')),
  sanction_authority TEXT NOT NULL, -- OFAC, EU, UN, etc.
  added_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Insert sanctioned countries
INSERT INTO grain_sanctioned_countries (country_code, country_name, sanction_type, sanction_authority, notes) VALUES
  ('CU', 'Cuba', 'full', 'OFAC', 'Comprehensive sanctions'),
  ('IR', 'Iran', 'full', 'OFAC', 'Comprehensive sanctions'),
  ('KP', 'North Korea', 'full', 'OFAC/UN', 'Comprehensive sanctions'),
  ('SY', 'Syria', 'full', 'OFAC', 'Comprehensive sanctions'),
  ('RU', 'Russia', 'full', 'OFAC', 'Comprehensive sanctions since 2022'),
  ('BY', 'Belarus', 'full', 'OFAC', 'Comprehensive sanctions'),
  ('VE', 'Venezuela', 'partial', 'OFAC', 'Government sector sanctions'),
  ('MM', 'Myanmar', 'partial', 'OFAC', 'Military/government sanctions'),
  ('SD', 'Sudan', 'partial', 'OFAC', 'Partial sanctions remain'),
  ('SS', 'South Sudan', 'partial', 'OFAC', 'Ongoing conflict'),
  ('CF', 'Central African Republic', 'partial', 'UN', 'Arms embargo'),
  ('CD', 'Democratic Republic of Congo', 'partial', 'UN', 'Arms embargo'),
  ('LY', 'Libya', 'partial', 'OFAC/UN', 'Sectoral sanctions'),
  ('SO', 'Somalia', 'partial', 'UN', 'Arms embargo'),
  ('YE', 'Yemen', 'partial', 'UN', 'Arms embargo'),
  ('ZW', 'Zimbabwe', 'partial', 'OFAC', 'Targeted sanctions'),
  ('NI', 'Nicaragua', 'partial', 'OFAC', 'Government sector sanctions')
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================================
-- SUPPORTED COUNTRIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_supported_countries (
  country_code CHAR(2) PRIMARY KEY,
  country_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  requires_national_id BOOLEAN DEFAULT TRUE,
  requires_tax_id BOOLEAN DEFAULT FALSE,
  requires_proof_of_address BOOLEAN DEFAULT TRUE,
  min_age INTEGER DEFAULT 18,
  level1_daily_limit DECIMAL(20, 2) DEFAULT 1000,
  level2_daily_limit DECIMAL(20, 2) DEFAULT 10000,
  level3_daily_limit DECIMAL(20, 2) DEFAULT 100000,
  level4_daily_limit DECIMAL(20, 2) DEFAULT 1000000,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert supported countries
INSERT INTO grain_supported_countries (
  country_code, country_name, currency, enabled,
  requires_national_id, requires_tax_id, requires_proof_of_address, min_age,
  level1_daily_limit, level2_daily_limit, level3_daily_limit, level4_daily_limit
) VALUES
  ('US', 'United States', 'USD', TRUE, TRUE, TRUE, TRUE, 18, 1000, 10000, 100000, 1000000),
  ('CA', 'Canada', 'CAD', TRUE, TRUE, TRUE, TRUE, 18, 1000, 10000, 100000, 1000000),
  ('MX', 'Mexico', 'MXN', TRUE, TRUE, TRUE, TRUE, 18, 1000, 10000, 100000, 1000000),
  ('AR', 'Argentina', 'ARS', TRUE, TRUE, TRUE, TRUE, 18, 500, 5000, 50000, 500000),
  ('GB', 'United Kingdom', 'GBP', TRUE, TRUE, FALSE, TRUE, 18, 1000, 10000, 100000, 1000000),
  ('AE', 'United Arab Emirates', 'AED', TRUE, TRUE, FALSE, TRUE, 21, 5000, 50000, 500000, 5000000),
  ('JP', 'Japan', 'JPY', TRUE, TRUE, TRUE, TRUE, 20, 1000, 10000, 100000, 1000000),
  ('SG', 'Singapore', 'SGD', TRUE, TRUE, FALSE, TRUE, 18, 5000, 50000, 500000, 5000000)
ON CONFLICT (country_code) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  level1_daily_limit = EXCLUDED.level1_daily_limit,
  level2_daily_limit = EXCLUDED.level2_daily_limit,
  level3_daily_limit = EXCLUDED.level3_daily_limit,
  level4_daily_limit = EXCLUDED.level4_daily_limit,
  updated_at = NOW();

-- ============================================================================
-- COUNTRY ID TYPES TABLE
-- Maps valid ID types for each country
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_country_id_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL REFERENCES grain_supported_countries(country_code),
  id_type TEXT NOT NULL,
  id_name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  requires_expiry BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert ID types per country
INSERT INTO grain_country_id_types (country_code, id_type, id_name, is_primary, requires_expiry) VALUES
  -- United States
  ('US', 'drivers_license', 'Driver''s License', TRUE, TRUE),
  ('US', 'passport', 'US Passport', FALSE, TRUE),
  ('US', 'state_id', 'State ID Card', FALSE, TRUE),
  ('US', 'military_id', 'Military ID', FALSE, TRUE),
  ('US', 'real_id', 'REAL ID', FALSE, TRUE),
  ('US', 'us_passport_card', 'US Passport Card', FALSE, TRUE),

  -- Canada
  ('CA', 'canadian_passport', 'Canadian Passport', TRUE, TRUE),
  ('CA', 'provincial_drivers_license', 'Provincial Driver''s License', FALSE, TRUE),
  ('CA', 'provincial_id', 'Provincial ID Card', FALSE, TRUE),
  ('CA', 'permanent_resident_card', 'Permanent Resident Card', FALSE, TRUE),

  -- Mexico
  ('MX', 'ine', 'INE (Credencial para Votar)', TRUE, TRUE),
  ('MX', 'mexican_passport', 'Mexican Passport', FALSE, TRUE),
  ('MX', 'cedula_profesional', 'Cedula Profesional', FALSE, FALSE),
  ('MX', 'fm2_fm3', 'FM2/FM3 Visa', FALSE, TRUE),

  -- Argentina
  ('AR', 'dni', 'DNI (Documento Nacional de Identidad)', TRUE, FALSE),
  ('AR', 'argentine_passport', 'Argentine Passport', FALSE, TRUE),
  ('AR', 'residencia', 'Residencia', FALSE, TRUE),

  -- United Kingdom
  ('GB', 'uk_passport', 'UK Passport', TRUE, TRUE),
  ('GB', 'uk_drivers_license', 'UK Driving Licence', FALSE, TRUE),
  ('GB', 'biometric_residence_permit', 'Biometric Residence Permit', FALSE, TRUE),

  -- UAE
  ('AE', 'emirates_id', 'Emirates ID', TRUE, TRUE),
  ('AE', 'uae_passport', 'UAE Passport', FALSE, TRUE),
  ('AE', 'uae_residence_visa', 'UAE Residence Visa', FALSE, TRUE),

  -- Japan
  ('JP', 'my_number_card', 'My Number Card', TRUE, TRUE),
  ('JP', 'japanese_passport', 'Japanese Passport', FALSE, TRUE),
  ('JP', 'residence_card', 'Residence Card (Zairyu Card)', FALSE, TRUE),
  ('JP', 'drivers_license_japan', 'Japanese Driver''s License', FALSE, TRUE),

  -- Singapore
  ('SG', 'nric', 'NRIC (National Registration Identity Card)', TRUE, FALSE),
  ('SG', 'fin', 'FIN (Foreign Identification Number)', FALSE, TRUE),
  ('SG', 'singapore_passport', 'Singapore Passport', FALSE, TRUE),
  ('SG', 'employment_pass', 'Employment Pass', FALSE, TRUE),
  ('SG', 'work_permit', 'Work Permit', FALSE, TRUE)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_grain_country_id_types_country ON grain_country_id_types(country_code);

-- ============================================================================
-- COUNTRY TAX ID TYPES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_country_tax_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL REFERENCES grain_supported_countries(country_code),
  tax_type TEXT NOT NULL,
  tax_name TEXT NOT NULL,
  format_regex TEXT,
  format_example TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO grain_country_tax_types (country_code, tax_type, tax_name, format_regex, format_example, is_required) VALUES
  ('US', 'ssn', 'Social Security Number (SSN)', '^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$', '123-45-6789', TRUE),
  ('CA', 'sin', 'Social Insurance Number (SIN)', '^[0-9]{3}-?[0-9]{3}-?[0-9]{3}$', '123-456-789', TRUE),
  ('MX', 'curp', 'CURP', '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$', 'GARC850101HDFRRL09', TRUE),
  ('AR', 'cuit', 'CUIT', '^[0-9]{2}-?[0-9]{8}-?[0-9]$', '20-12345678-9', TRUE),
  ('AR', 'cuil', 'CUIL', '^[0-9]{2}-?[0-9]{8}-?[0-9]$', '27-12345678-9', FALSE),
  ('GB', 'ni_number', 'National Insurance Number', '^[A-Z]{2}[0-9]{6}[A-Z]$', 'AB123456C', FALSE),
  ('GB', 'utr', 'Unique Taxpayer Reference', '^[0-9]{10}$', '1234567890', FALSE),
  ('AE', 'tin_uae', 'Tax Identification Number', NULL, NULL, FALSE),
  ('JP', 'my_number', 'My Number', '^[0-9]{12}$', '123456789012', TRUE),
  ('SG', 'nric_number', 'NRIC Number', '^[STFG][0-9]{7}[A-Z]$', 'S1234567D', TRUE),
  ('SG', 'fin_number', 'FIN Number', '^[FG][0-9]{7}[A-Z]$', 'F1234567N', FALSE),
  ('SG', 'uen', 'Unique Entity Number', '^[0-9]{8,9}[A-Z]$', '201234567K', FALSE)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_grain_country_tax_types_country ON grain_country_tax_types(country_code);

-- ============================================================================
-- COUNTRY STATES/PROVINCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grain_country_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL REFERENCES grain_supported_countries(country_code),
  region_code TEXT NOT NULL,
  region_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(country_code, region_code)
);

-- US States
INSERT INTO grain_country_regions (country_code, region_code, region_name) VALUES
  ('US', 'AL', 'Alabama'), ('US', 'AK', 'Alaska'), ('US', 'AZ', 'Arizona'), ('US', 'AR', 'Arkansas'),
  ('US', 'CA', 'California'), ('US', 'CO', 'Colorado'), ('US', 'CT', 'Connecticut'), ('US', 'DE', 'Delaware'),
  ('US', 'FL', 'Florida'), ('US', 'GA', 'Georgia'), ('US', 'HI', 'Hawaii'), ('US', 'ID', 'Idaho'),
  ('US', 'IL', 'Illinois'), ('US', 'IN', 'Indiana'), ('US', 'IA', 'Iowa'), ('US', 'KS', 'Kansas'),
  ('US', 'KY', 'Kentucky'), ('US', 'LA', 'Louisiana'), ('US', 'ME', 'Maine'), ('US', 'MD', 'Maryland'),
  ('US', 'MA', 'Massachusetts'), ('US', 'MI', 'Michigan'), ('US', 'MN', 'Minnesota'), ('US', 'MS', 'Mississippi'),
  ('US', 'MO', 'Missouri'), ('US', 'MT', 'Montana'), ('US', 'NE', 'Nebraska'), ('US', 'NV', 'Nevada'),
  ('US', 'NH', 'New Hampshire'), ('US', 'NJ', 'New Jersey'), ('US', 'NM', 'New Mexico'), ('US', 'NY', 'New York'),
  ('US', 'NC', 'North Carolina'), ('US', 'ND', 'North Dakota'), ('US', 'OH', 'Ohio'), ('US', 'OK', 'Oklahoma'),
  ('US', 'OR', 'Oregon'), ('US', 'PA', 'Pennsylvania'), ('US', 'RI', 'Rhode Island'), ('US', 'SC', 'South Carolina'),
  ('US', 'SD', 'South Dakota'), ('US', 'TN', 'Tennessee'), ('US', 'TX', 'Texas'), ('US', 'UT', 'Utah'),
  ('US', 'VT', 'Vermont'), ('US', 'VA', 'Virginia'), ('US', 'WA', 'Washington'), ('US', 'WV', 'West Virginia'),
  ('US', 'WI', 'Wisconsin'), ('US', 'WY', 'Wyoming'), ('US', 'DC', 'District of Columbia')
ON CONFLICT DO NOTHING;

-- Canadian Provinces
INSERT INTO grain_country_regions (country_code, region_code, region_name) VALUES
  ('CA', 'AB', 'Alberta'), ('CA', 'BC', 'British Columbia'), ('CA', 'MB', 'Manitoba'),
  ('CA', 'NB', 'New Brunswick'), ('CA', 'NL', 'Newfoundland and Labrador'), ('CA', 'NS', 'Nova Scotia'),
  ('CA', 'NT', 'Northwest Territories'), ('CA', 'NU', 'Nunavut'), ('CA', 'ON', 'Ontario'),
  ('CA', 'PE', 'Prince Edward Island'), ('CA', 'QC', 'Quebec'), ('CA', 'SK', 'Saskatchewan'), ('CA', 'YT', 'Yukon')
ON CONFLICT DO NOTHING;

-- Mexican States
INSERT INTO grain_country_regions (country_code, region_code, region_name) VALUES
  ('MX', 'AGS', 'Aguascalientes'), ('MX', 'BC', 'Baja California'), ('MX', 'BCS', 'Baja California Sur'),
  ('MX', 'CAM', 'Campeche'), ('MX', 'CHIS', 'Chiapas'), ('MX', 'CHIH', 'Chihuahua'),
  ('MX', 'CDMX', 'Ciudad de Mexico'), ('MX', 'COAH', 'Coahuila'), ('MX', 'COL', 'Colima'),
  ('MX', 'DGO', 'Durango'), ('MX', 'GTO', 'Guanajuato'), ('MX', 'GRO', 'Guerrero'),
  ('MX', 'HGO', 'Hidalgo'), ('MX', 'JAL', 'Jalisco'), ('MX', 'MEX', 'Estado de Mexico'),
  ('MX', 'MICH', 'Michoacan'), ('MX', 'MOR', 'Morelos'), ('MX', 'NAY', 'Nayarit'),
  ('MX', 'NL', 'Nuevo Leon'), ('MX', 'OAX', 'Oaxaca'), ('MX', 'PUE', 'Puebla'),
  ('MX', 'QRO', 'Queretaro'), ('MX', 'QROO', 'Quintana Roo'), ('MX', 'SLP', 'San Luis Potosi'),
  ('MX', 'SIN', 'Sinaloa'), ('MX', 'SON', 'Sonora'), ('MX', 'TAB', 'Tabasco'),
  ('MX', 'TAM', 'Tamaulipas'), ('MX', 'TLAX', 'Tlaxcala'), ('MX', 'VER', 'Veracruz'),
  ('MX', 'YUC', 'Yucatan'), ('MX', 'ZAC', 'Zacatecas')
ON CONFLICT DO NOTHING;

-- Argentine Provinces
INSERT INTO grain_country_regions (country_code, region_code, region_name) VALUES
  ('AR', 'C', 'Ciudad Autonoma de Buenos Aires'), ('AR', 'B', 'Buenos Aires'),
  ('AR', 'K', 'Catamarca'), ('AR', 'H', 'Chaco'), ('AR', 'U', 'Chubut'),
  ('AR', 'X', 'Cordoba'), ('AR', 'W', 'Corrientes'), ('AR', 'E', 'Entre Rios'),
  ('AR', 'P', 'Formosa'), ('AR', 'Y', 'Jujuy'), ('AR', 'L', 'La Pampa'),
  ('AR', 'F', 'La Rioja'), ('AR', 'M', 'Mendoza'), ('AR', 'N', 'Misiones'),
  ('AR', 'Q', 'Neuquen'), ('AR', 'R', 'Rio Negro'), ('AR', 'A', 'Salta'),
  ('AR', 'J', 'San Juan'), ('AR', 'D', 'San Luis'), ('AR', 'Z', 'Santa Cruz'),
  ('AR', 'S', 'Santa Fe'), ('AR', 'G', 'Santiago del Estero'), ('AR', 'V', 'Tierra del Fuego'),
  ('AR', 'T', 'Tucuman')
ON CONFLICT DO NOTHING;

-- UAE Emirates
INSERT INTO grain_country_regions (country_code, region_code, region_name) VALUES
  ('AE', 'AZ', 'Abu Dhabi'), ('AE', 'DU', 'Dubai'), ('AE', 'SH', 'Sharjah'),
  ('AE', 'AJ', 'Ajman'), ('AE', 'UQ', 'Umm Al Quwain'), ('AE', 'RK', 'Ras Al Khaimah'),
  ('AE', 'FU', 'Fujairah')
ON CONFLICT DO NOTHING;

-- Japan Prefectures
INSERT INTO grain_country_regions (country_code, region_code, region_name) VALUES
  ('JP', '01', 'Hokkaido'), ('JP', '02', 'Aomori'), ('JP', '03', 'Iwate'), ('JP', '04', 'Miyagi'),
  ('JP', '05', 'Akita'), ('JP', '06', 'Yamagata'), ('JP', '07', 'Fukushima'), ('JP', '08', 'Ibaraki'),
  ('JP', '09', 'Tochigi'), ('JP', '10', 'Gunma'), ('JP', '11', 'Saitama'), ('JP', '12', 'Chiba'),
  ('JP', '13', 'Tokyo'), ('JP', '14', 'Kanagawa'), ('JP', '15', 'Niigata'), ('JP', '16', 'Toyama'),
  ('JP', '17', 'Ishikawa'), ('JP', '18', 'Fukui'), ('JP', '19', 'Yamanashi'), ('JP', '20', 'Nagano'),
  ('JP', '21', 'Gifu'), ('JP', '22', 'Shizuoka'), ('JP', '23', 'Aichi'), ('JP', '24', 'Mie'),
  ('JP', '25', 'Shiga'), ('JP', '26', 'Kyoto'), ('JP', '27', 'Osaka'), ('JP', '28', 'Hyogo'),
  ('JP', '29', 'Nara'), ('JP', '30', 'Wakayama'), ('JP', '31', 'Tottori'), ('JP', '32', 'Shimane'),
  ('JP', '33', 'Okayama'), ('JP', '34', 'Hiroshima'), ('JP', '35', 'Yamaguchi'), ('JP', '36', 'Tokushima'),
  ('JP', '37', 'Kagawa'), ('JP', '38', 'Ehime'), ('JP', '39', 'Kochi'), ('JP', '40', 'Fukuoka'),
  ('JP', '41', 'Saga'), ('JP', '42', 'Nagasaki'), ('JP', '43', 'Kumamoto'), ('JP', '44', 'Oita'),
  ('JP', '45', 'Miyazaki'), ('JP', '46', 'Kagoshima'), ('JP', '47', 'Okinawa')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_grain_country_regions_country ON grain_country_regions(country_code);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get country limits based on verification level
CREATE OR REPLACE FUNCTION get_country_limits(p_country_code CHAR(2), p_verification_level INTEGER)
RETURNS DECIMAL AS $$
DECLARE
  result DECIMAL;
BEGIN
  SELECT
    CASE p_verification_level
      WHEN 1 THEN level1_daily_limit
      WHEN 2 THEN level2_daily_limit
      WHEN 3 THEN level3_daily_limit
      WHEN 4 THEN level4_daily_limit
      ELSE level1_daily_limit
    END
  INTO result
  FROM grain_supported_countries
  WHERE country_code = p_country_code;

  RETURN COALESCE(result, 1000);
END;
$$ LANGUAGE plpgsql;

-- Check if country is sanctioned
CREATE OR REPLACE FUNCTION is_country_sanctioned(p_country_code CHAR(2))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM grain_sanctioned_countries WHERE country_code = p_country_code
  );
END;
$$ LANGUAGE plpgsql;

-- Check if country is supported
CREATE OR REPLACE FUNCTION is_country_supported(p_country_code CHAR(2))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM grain_supported_countries WHERE country_code = p_country_code AND enabled = TRUE
  );
END;
$$ LANGUAGE plpgsql;

-- Get valid ID types for a country
CREATE OR REPLACE FUNCTION get_country_id_types(p_country_code CHAR(2))
RETURNS TABLE(id_type TEXT, id_name TEXT, is_primary BOOLEAN, requires_expiry BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT git.id_type, git.id_name, git.is_primary, git.requires_expiry
  FROM grain_country_id_types git
  WHERE git.country_code = p_country_code
  ORDER BY git.is_primary DESC, git.id_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_country ON grain_user_profiles(country_of_residence);
CREATE INDEX IF NOT EXISTS idx_grain_user_profiles_nationality ON grain_user_profiles(nationality);
