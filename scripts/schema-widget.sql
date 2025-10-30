/**
 * Widget Tracking Database Schema
 * Tracks widget installations, usage, and analytics
 */

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Widget Events Table
-- Tracks all widget events (loads, opens, messages, etc.)
CREATE TABLE IF NOT EXISTS widget_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- widget_loaded, widget_opened, message_sent, etc.
  url TEXT NOT NULL, -- Website where widget is installed
  version VARCHAR(50), -- Widget version
  metadata JSONB, -- Additional event data
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_widget_events_api_key ON widget_events(api_key);
CREATE INDEX IF NOT EXISTS idx_widget_events_type ON widget_events(event_type);
CREATE INDEX IF NOT EXISTS idx_widget_events_created ON widget_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_widget_events_url ON widget_events(url);

-- Widget Installations Table
-- Tracks unique website installations
CREATE TABLE IF NOT EXISTS widget_installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  version VARCHAR(50),
  first_installed_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  event_count INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, removed
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(api_key, url)
);

-- Index for installations
CREATE INDEX IF NOT EXISTS idx_widget_installations_api_key ON widget_installations(api_key);
CREATE INDEX IF NOT EXISTS idx_widget_installations_url ON widget_installations(url);
CREATE INDEX IF NOT EXISTS idx_widget_installations_last_seen ON widget_installations(last_seen_at DESC);

-- Widget API Keys Table
-- Manages API keys for widget installations
CREATE TABLE IF NOT EXISTS widget_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key VARCHAR(255) UNIQUE NOT NULL,
  owner_email VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  company_name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
  monthly_message_limit INTEGER DEFAULT 1000,
  monthly_message_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for API keys
CREATE INDEX IF NOT EXISTS idx_widget_api_keys_email ON widget_api_keys(owner_email);
CREATE INDEX IF NOT EXISTS idx_widget_api_keys_status ON widget_api_keys(status);

-- Widget Conversations Table
-- Tracks widget chat conversations
CREATE TABLE IF NOT EXISTS widget_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id VARCHAR(255) UNIQUE NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  first_message_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for conversations
CREATE INDEX IF NOT EXISTS idx_widget_conversations_api_key ON widget_conversations(api_key);
CREATE INDEX IF NOT EXISTS idx_widget_conversations_url ON widget_conversations(url);
CREATE INDEX IF NOT EXISTS idx_widget_conversations_conversation_id ON widget_conversations(conversation_id);

-- Widget Messages Table
-- Stores all widget chat messages for analysis
CREATE TABLE IF NOT EXISTS widget_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  sender_type VARCHAR(50) NOT NULL, -- user, ai
  message_text TEXT NOT NULL,
  url TEXT,
  response_time_ms INTEGER, -- For AI responses, how long it took
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for messages
CREATE INDEX IF NOT EXISTS idx_widget_messages_conversation ON widget_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_widget_messages_api_key ON widget_messages(api_key);
CREATE INDEX IF NOT EXISTS idx_widget_messages_created ON widget_messages(created_at DESC);

-- View: Widget Analytics Dashboard
-- Provides quick stats for widget performance
CREATE OR REPLACE VIEW widget_analytics AS
SELECT
  wi.api_key,
  COUNT(DISTINCT wi.url) as total_installations,
  COUNT(DISTINCT CASE WHEN wi.last_seen_at > NOW() - INTERVAL '24 hours' THEN wi.url END) as active_installations_24h,
  COUNT(DISTINCT CASE WHEN wi.last_seen_at > NOW() - INTERVAL '7 days' THEN wi.url END) as active_installations_7d,
  COUNT(DISTINCT CASE WHEN wi.last_seen_at > NOW() - INTERVAL '30 days' THEN wi.url END) as active_installations_30d,
  SUM(wi.event_count) as total_events,
  COALESCE(wc.total_conversations, 0) as total_conversations,
  COALESCE(wm.total_messages, 0) as total_messages,
  COALESCE(wm.avg_response_time_ms, 0) as avg_response_time_ms
FROM widget_installations wi
LEFT JOIN (
  SELECT api_key, COUNT(*) as total_conversations
  FROM widget_conversations
  GROUP BY api_key
) wc ON wi.api_key = wc.api_key
LEFT JOIN (
  SELECT api_key, COUNT(*) as total_messages, AVG(response_time_ms) as avg_response_time_ms
  FROM widget_messages
  WHERE sender_type = 'ai'
  GROUP BY api_key
) wm ON wi.api_key = wm.api_key
GROUP BY wi.api_key, wc.total_conversations, wm.total_messages, wm.avg_response_time_ms;

-- View: Top Widget Websites
-- Shows most active websites with widget installed
CREATE OR REPLACE VIEW top_widget_websites AS
SELECT
  wi.url,
  wi.api_key,
  wi.event_count,
  wi.last_seen_at,
  COUNT(DISTINCT wc.conversation_id) as conversation_count,
  COUNT(DISTINCT wm.id) as message_count
FROM widget_installations wi
LEFT JOIN widget_conversations wc ON wi.url = wc.url AND wi.api_key = wc.api_key
LEFT JOIN widget_messages wm ON wc.conversation_id = wm.conversation_id
WHERE wi.last_seen_at > NOW() - INTERVAL '30 days'
GROUP BY wi.url, wi.api_key, wi.event_count, wi.last_seen_at
ORDER BY wi.event_count DESC, message_count DESC
LIMIT 100;

-- View: Widget Usage Trends
-- Daily widget usage statistics
CREATE OR REPLACE VIEW widget_usage_trends AS
SELECT
  DATE(we.created_at) as date,
  we.api_key,
  COUNT(DISTINCT CASE WHEN we.event_type = 'widget_loaded' THEN we.url END) as loads,
  COUNT(DISTINCT CASE WHEN we.event_type = 'widget_opened' THEN we.id END) as opens,
  COUNT(DISTINCT CASE WHEN we.event_type = 'message_sent' THEN we.id END) as messages_sent,
  COUNT(DISTINCT we.url) as unique_websites
FROM widget_events we
WHERE we.created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE(we.created_at), we.api_key
ORDER BY date DESC, api_key;

-- Function: Get Widget Stats for API Key
CREATE OR REPLACE FUNCTION get_widget_stats(p_api_key VARCHAR)
RETURNS TABLE (
  total_installations BIGINT,
  active_24h BIGINT,
  active_7d BIGINT,
  active_30d BIGINT,
  total_conversations BIGINT,
  total_messages BIGINT,
  avg_response_time_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT wi.url) as total_installations,
    COUNT(DISTINCT CASE WHEN wi.last_seen_at > NOW() - INTERVAL '24 hours' THEN wi.url END) as active_24h,
    COUNT(DISTINCT CASE WHEN wi.last_seen_at > NOW() - INTERVAL '7 days' THEN wi.url END) as active_7d,
    COUNT(DISTINCT CASE WHEN wi.last_seen_at > NOW() - INTERVAL '30 days' THEN wi.url END) as active_30d,
    COUNT(DISTINCT wc.conversation_id) as total_conversations,
    COUNT(DISTINCT wm.id) as total_messages,
    AVG(wm.response_time_ms) as avg_response_time_ms
  FROM widget_installations wi
  LEFT JOIN widget_conversations wc ON wi.api_key = wc.api_key
  LEFT JOIN widget_messages wm ON wc.conversation_id = wm.conversation_id
  WHERE wi.api_key = p_api_key;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate Widget API Key
CREATE OR REPLACE FUNCTION generate_widget_api_key()
RETURNS VARCHAR AS $$
DECLARE
  new_key VARCHAR;
BEGIN
  -- Generate a random API key in format: wells_widget_XXXXXXXXXXXXXXXXXXXXXXXX
  new_key := 'wells_widget_' || encode(gen_random_bytes(18), 'hex');
  RETURN new_key;
END;
$$ LANGUAGE plpgsql;

-- Sample API Key for Demo/Testing
INSERT INTO widget_api_keys (api_key, owner_email, owner_name, company_name, plan, monthly_message_limit)
VALUES (
  'wells_widget_demo_1234567890abcdef',
  'demo@wellsai.com',
  'Demo User',
  'Wells AI Demo',
  'free',
  1000
)
ON CONFLICT (api_key) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE widget_events IS 'Tracks all widget events including loads, opens, messages, and custom events';
COMMENT ON TABLE widget_installations IS 'Tracks unique website installations of the Wells AI widget';
COMMENT ON TABLE widget_api_keys IS 'Manages API keys for widget authentication and usage tracking';
COMMENT ON TABLE widget_conversations IS 'Tracks individual chat conversations within widgets';
COMMENT ON TABLE widget_messages IS 'Stores all messages sent through widget chat interface';
COMMENT ON VIEW widget_analytics IS 'Aggregated analytics for widget performance by API key';
COMMENT ON VIEW top_widget_websites IS 'Shows most active websites with widget installed in last 30 days';
COMMENT ON VIEW widget_usage_trends IS 'Daily usage trends for widget installations over last 90 days';
