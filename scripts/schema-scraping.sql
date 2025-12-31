-- ============================================================================
-- WELLS AI - WEB SCRAPING SUPPLIER DISCOVERY SCHEMA
-- ============================================================================
-- Proactive supplier discovery: scrape → enrich → outreach → convert

-- ============================================================================
-- SCRAPED SUPPLIERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraped_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,                     -- ID from source (Google Place ID, etc.)
  source TEXT NOT NULL,                 -- google_maps, yelp, yellowpages, etc.
  scraped_at TIMESTAMP DEFAULT NOW(),

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  logo_url TEXT,

  -- Contact
  email TEXT,
  phone TEXT,
  contact_name TEXT,
  contact_title TEXT,

  -- Location
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_country TEXT DEFAULT 'USA',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Business Details
  industry TEXT,
  categories TEXT[],
  services TEXT[],
  products TEXT[],

  -- Size/Scale
  employee_count INTEGER,
  employee_range TEXT,
  revenue DECIMAL(20, 2),
  revenue_range TEXT,
  year_founded INTEGER,

  -- Reputation
  rating DECIMAL(3, 2),                 -- 0-5
  review_count INTEGER,
  bbb_rating TEXT,
  verified BOOLEAN DEFAULT FALSE,

  -- Social
  linkedin_url TEXT,
  twitter_url TEXT,
  facebook_url TEXT,

  -- Metadata
  confidence DECIMAL(3, 2) DEFAULT 0.5, -- 0-1 confidence score
  raw_data JSONB,                       -- Original scraped data

  -- Status
  status TEXT DEFAULT 'new',            -- new, contacted, responded, converted, rejected
  converted_supplier_id UUID,           -- Links to supplier_profiles if converted

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scraped_suppliers_source ON scraped_suppliers(source);
CREATE INDEX idx_scraped_suppliers_email ON scraped_suppliers(email);
CREATE INDEX idx_scraped_suppliers_status ON scraped_suppliers(status);
CREATE INDEX idx_scraped_suppliers_location ON scraped_suppliers(address_city, address_state);
CREATE INDEX idx_scraped_suppliers_categories ON scraped_suppliers USING GIN(categories);

-- ============================================================================
-- SCRAPING JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed

  -- Trigger
  triggered_by TEXT NOT NULL,              -- buyer_request, manual, scheduled
  buyer_request_id UUID,                   -- Links to sourcing_requests

  -- Query
  keywords TEXT[] NOT NULL,
  category TEXT,
  subcategory TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  location_radius INTEGER,

  -- Sources
  sources TEXT[] NOT NULL,

  -- Results
  suppliers_found INTEGER DEFAULT 0,
  suppliers_new INTEGER DEFAULT 0,
  suppliers_contacted INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_buyer_request ON scraping_jobs(buyer_request_id);

-- ============================================================================
-- ENRICHMENT RESULTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrichment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_supplier_id UUID NOT NULL REFERENCES scraped_suppliers(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                    -- clearbit, apollo, hunter, manual
  enriched_at TIMESTAMP DEFAULT NOW(),

  -- What was enriched
  fields_enriched TEXT[],

  -- Discovered emails
  emails JSONB,                            -- [{email, type, confidence, name, title}]

  -- Company data
  company_data JSONB,                      -- {description, industry, employeeCount, etc.}

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_enrichment_supplier ON enrichment_results(scraped_supplier_id);

-- ============================================================================
-- SUPPLIER OUTREACH
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_supplier_id UUID NOT NULL REFERENCES scraped_suppliers(id) ON DELETE CASCADE,
  scraping_job_id UUID REFERENCES scraping_jobs(id),
  buyer_request_id UUID,                   -- Links to sourcing_requests

  -- Contact method
  contact_method TEXT NOT NULL,            -- email, linkedin, phone, form
  contact_email TEXT,
  contact_phone TEXT,
  linkedin_url TEXT,

  -- Message
  subject TEXT,
  message TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, opened, clicked, replied, converted, bounced, unsubscribed
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP,
  converted_at TIMESTAMP,

  -- Response
  response TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_outreach_supplier ON supplier_outreach(scraped_supplier_id);
CREATE INDEX idx_outreach_status ON supplier_outreach(status);
CREATE INDEX idx_outreach_buyer_request ON supplier_outreach(buyer_request_id);

-- ============================================================================
-- CONVERSION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_supplier_id UUID NOT NULL REFERENCES scraped_suppliers(id),
  outreach_id UUID REFERENCES supplier_outreach(id),
  buyer_request_id UUID,

  -- What happened
  event TEXT NOT NULL,                     -- profile_created, quote_submitted, deal_closed

  -- Attribution
  revenue DECIMAL(20, 2),                  -- If deal closed
  fee DECIMAL(20, 2),                      -- 1% Wells fee

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversions_supplier ON supplier_conversions(scraped_supplier_id);
CREATE INDEX idx_conversions_request ON supplier_conversions(buyer_request_id);
CREATE INDEX idx_conversions_event ON supplier_conversions(event);

-- ============================================================================
-- IMPORTED CONTACTS (Your 150K)
-- ============================================================================

CREATE TABLE IF NOT EXISTS imported_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  title TEXT,
  industry TEXT,
  location TEXT,
  linkedin_url TEXT,

  -- Source
  source TEXT NOT NULL,                    -- csv, crm, linkedin
  import_batch_id TEXT,                    -- Group imports

  -- Status
  status TEXT DEFAULT 'active',            -- active, unsubscribed, bounced
  last_contacted_at TIMESTAMP,
  contact_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON imported_contacts(email);
CREATE INDEX idx_contacts_industry ON imported_contacts(industry);
CREATE INDEX idx_contacts_location ON imported_contacts(location);
CREATE INDEX idx_contacts_source ON imported_contacts(source);

-- ============================================================================
-- CONTACT MATCHING
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES imported_contacts(id) ON DELETE CASCADE,
  buyer_request_id UUID NOT NULL,          -- Links to sourcing_requests

  -- Match quality
  match_score DECIMAL(5, 4) NOT NULL,      -- 0-1
  match_reasons TEXT[],                    -- [industry_match, location_match, etc.]

  -- Outreach
  outreach_sent BOOLEAN DEFAULT FALSE,
  outreach_id UUID REFERENCES supplier_outreach(id),

  -- Result
  result TEXT,                             -- responded, converted, rejected, no_response

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contact_matches_contact ON contact_matches(contact_id);
CREATE INDEX idx_contact_matches_request ON contact_matches(buyer_request_id);
CREATE INDEX idx_contact_matches_score ON contact_matches(match_score DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Discovery pipeline overview
CREATE OR REPLACE VIEW v_discovery_pipeline AS
SELECT
  DATE(sj.created_at) as date,
  sj.category,
  COUNT(DISTINCT sj.id) as jobs_run,
  SUM(sj.suppliers_found) as suppliers_found,
  SUM(sj.suppliers_contacted) as outreach_sent,
  COUNT(DISTINCT CASE WHEN so.status = 'replied' THEN so.scraped_supplier_id END) as replies,
  COUNT(DISTINCT CASE WHEN sc.event = 'profile_created' THEN sc.scraped_supplier_id END) as profiles_created,
  COUNT(DISTINCT CASE WHEN sc.event = 'deal_closed' THEN sc.scraped_supplier_id END) as deals_closed,
  COALESCE(SUM(sc.fee), 0) as fees_earned
FROM scraping_jobs sj
LEFT JOIN supplier_outreach so ON so.scraping_job_id = sj.id
LEFT JOIN supplier_conversions sc ON sc.scraped_supplier_id = so.scraped_supplier_id
GROUP BY DATE(sj.created_at), sj.category
ORDER BY date DESC, sj.category;

-- Outreach effectiveness
CREATE OR REPLACE VIEW v_outreach_effectiveness AS
SELECT
  contact_method,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE status = 'opened') as opened,
  COUNT(*) FILTER (WHERE status = 'clicked') as clicked,
  COUNT(*) FILTER (WHERE status = 'replied') as replied,
  COUNT(*) FILTER (WHERE status = 'converted') as converted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'opened') / NULLIF(COUNT(*), 0), 2) as open_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'replied') / NULLIF(COUNT(*), 0), 2) as reply_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'converted') / NULLIF(COUNT(*), 0), 2) as conversion_rate
FROM supplier_outreach
WHERE sent_at IS NOT NULL
GROUP BY contact_method;
