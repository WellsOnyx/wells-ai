-- Wells AI Database Schema
-- Postgres database for production scale
-- Migrated from Notion for better performance

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  categories TEXT[] NOT NULL DEFAULT '{}',
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT[] NOT NULL DEFAULT '{}',
  rating DECIMAL(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
  completed_deals INTEGER DEFAULT 0,
  notion_id VARCHAR(255) UNIQUE, -- For syncing with Notion
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for suppliers
CREATE INDEX idx_suppliers_categories ON suppliers USING GIN(categories);
CREATE INDEX idx_suppliers_rating ON suppliers(rating DESC);
CREATE INDEX idx_suppliers_email ON suppliers(email);
CREATE INDEX idx_suppliers_notion_id ON suppliers(notion_id);

-- RFQs table
CREATE TABLE IF NOT EXISTS rfqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id VARCHAR(255) NOT NULL,
  buyer_email VARCHAR(255) NOT NULL,
  requirements TEXT NOT NULL,
  categories TEXT[] NOT NULL,
  quantity INTEGER,
  budget DECIMAL(12,2),
  deadline DATE,
  status VARCHAR(50) DEFAULT 'open',
  notion_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rfqs_buyer ON rfqs(buyer_id);
CREATE INDEX idx_rfqs_status ON rfqs(status);
CREATE INDEX idx_rfqs_created ON rfqs(created_at DESC);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  delivery_time VARCHAR(100),
  terms TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  notion_id VARCHAR(255) UNIQUE,
  submitted_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP
);

CREATE INDEX idx_quotes_supplier ON quotes(supplier_id);
CREATE INDEX idx_quotes_rfq ON quotes(rfq_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_price ON quotes(price ASC);

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id),
  buyer_id VARCHAR(255) NOT NULL,
  quote_id UUID REFERENCES quotes(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  wells_fee DECIMAL(12,2) NOT NULL CHECK (wells_fee >= 0),
  status VARCHAR(50) DEFAULT 'pending',
  payment_intent_id VARCHAR(255),
  notion_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_deals_supplier ON deals(supplier_id);
CREATE INDEX idx_deals_buyer ON deals(buyer_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_created ON deals(created_at DESC);

-- Conversations table (for AI chat)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255),
  session_id VARCHAR(255) NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  user_id VARCHAR(255),
  session_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_session ON analytics_events(session_id);

-- GTM Prospects table
CREATE TABLE IF NOT EXISTS gtm_prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_group VARCHAR(100) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_title VARCHAR(255),
  contact_email VARCHAR(255),
  contact_linkedin VARCHAR(500),
  company_size VARCHAR(50),
  industry VARCHAR(100),
  signals JSONB DEFAULT '[]',
  icp_score DECIMAL(5,2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'discovered',
  notion_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prospects_practice_group ON gtm_prospects(practice_group);
CREATE INDEX idx_prospects_status ON gtm_prospects(status);
CREATE INDEX idx_prospects_score ON gtm_prospects(icp_score DESC);
CREATE INDEX idx_prospects_email ON gtm_prospects(contact_email);

-- GTM Outreach table
CREATE TABLE IF NOT EXISTS gtm_outreach (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID REFERENCES gtm_prospects(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL, -- email, linkedin, twitter, etc
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, sent, replied
  sent_at TIMESTAMP,
  replied_at TIMESTAMP,
  notion_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_outreach_prospect ON gtm_outreach(prospect_id);
CREATE INDEX idx_outreach_status ON gtm_outreach(status);
CREATE INDEX idx_outreach_channel ON gtm_outreach(channel);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type VARCHAR(100) NOT NULL, -- api_response, db_query, ai_operation, etc
  operation_name VARCHAR(255) NOT NULL,
  duration_ms INTEGER NOT NULL,
  success BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_type ON performance_metrics(metric_type);
CREATE INDEX idx_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX idx_metrics_duration ON performance_metrics(duration_ms DESC);

-- Create materialized view for analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_metrics AS
SELECT
  DATE(timestamp) as date,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users
FROM analytics_events
GROUP BY DATE(timestamp)
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_daily_metrics_date ON daily_metrics(date);

-- Create view for supplier performance
CREATE OR REPLACE VIEW supplier_performance AS
SELECT
  s.id,
  s.name,
  s.email,
  s.rating,
  COUNT(DISTINCT d.id) as total_deals,
  SUM(d.amount) as total_revenue,
  AVG(d.amount) as avg_deal_size,
  COUNT(DISTINCT q.id) as total_quotes,
  ROUND(COUNT(DISTINCT d.id)::numeric / NULLIF(COUNT(DISTINCT q.id), 0) * 100, 2) as quote_to_deal_ratio
FROM suppliers s
LEFT JOIN quotes q ON s.id = q.supplier_id
LEFT JOIN deals d ON s.id = d.supplier_id AND d.status = 'completed'
GROUP BY s.id, s.name, s.email, s.rating;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rfqs_updated_at BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON gtm_prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_daily_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your Vercel Postgres setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
