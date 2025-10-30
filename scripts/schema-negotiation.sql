-- Wells AI Real-Time Negotiation Schema
-- Extension to main schema for Weeks 7-8

-- Negotiation Rooms table
CREATE TABLE IF NOT EXISTS negotiation_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  buyer_id VARCHAR(255) NOT NULL,
  buyer_email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled, expired
  started_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  deal_id UUID REFERENCES deals(id),
  room_code VARCHAR(50) UNIQUE NOT NULL, -- Short code for sharing
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rooms_rfq ON negotiation_rooms(rfq_id);
CREATE INDEX idx_rooms_buyer ON negotiation_rooms(buyer_id);
CREATE INDEX idx_rooms_status ON negotiation_rooms(status);
CREATE INDEX idx_rooms_code ON negotiation_rooms(room_code);
CREATE INDEX idx_rooms_started ON negotiation_rooms(started_at DESC);

-- Room Participants table
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES negotiation_rooms(id) ON DELETE CASCADE,
  participant_id VARCHAR(255) NOT NULL, -- buyer_id or supplier_id
  participant_type VARCHAR(50) NOT NULL, -- buyer, supplier
  participant_name VARCHAR(255) NOT NULL,
  participant_email VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE, -- NULL for buyers
  joined_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_participants_room ON room_participants(room_id);
CREATE INDEX idx_participants_type ON room_participants(participant_type);
CREATE INDEX idx_participants_supplier ON room_participants(supplier_id);
CREATE UNIQUE INDEX idx_participants_unique ON room_participants(room_id, participant_id);

-- Room Messages table
CREATE TABLE IF NOT EXISTS room_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES negotiation_rooms(id) ON DELETE CASCADE,
  sender_id VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  sender_type VARCHAR(50) NOT NULL, -- buyer, supplier, ai
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- text, offer, counter_offer, acceptance, rejection
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_room ON room_messages(room_id);
CREATE INDEX idx_messages_sender ON room_messages(sender_id);
CREATE INDEX idx_messages_type ON room_messages(message_type);
CREATE INDEX idx_messages_timestamp ON room_messages(timestamp DESC);

-- Counter Offers table
CREATE TABLE IF NOT EXISTS counter_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES negotiation_rooms(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  original_price DECIMAL(12,2),
  offered_price DECIMAL(12,2) NOT NULL CHECK (offered_price >= 0),
  delivery_time VARCHAR(100) NOT NULL,
  terms TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, rejected, expired
  valid_until TIMESTAMP NOT NULL,
  responded_at TIMESTAMP,
  response_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_counter_offers_room ON counter_offers(room_id);
CREATE INDEX idx_counter_offers_supplier ON counter_offers(supplier_id);
CREATE INDEX idx_counter_offers_status ON counter_offers(status);
CREATE INDEX idx_counter_offers_created ON counter_offers(created_at DESC);

-- AI Suggestions table (for negotiation assistant)
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES negotiation_rooms(id) ON DELETE CASCADE,
  suggestion_type VARCHAR(50) NOT NULL, -- pricing, timing, terms, general
  suggestion TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  shown_to VARCHAR(50) NOT NULL, -- buyer, supplier, all
  was_helpful BOOLEAN,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_suggestions_room ON ai_suggestions(room_id);
CREATE INDEX idx_suggestions_type ON ai_suggestions(suggestion_type);
CREATE INDEX idx_suggestions_created ON ai_suggestions(created_at DESC);

-- Deal History table (for tracking negotiation outcomes)
CREATE TABLE IF NOT EXISTS deal_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES negotiation_rooms(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- offer_submitted, counter_offer, accepted, rejected, etc
  event_data JSONB DEFAULT '{}',
  actor_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL, -- buyer, supplier
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_history_room ON deal_history(room_id);
CREATE INDEX idx_deal_history_deal ON deal_history(deal_id);
CREATE INDEX idx_deal_history_event ON deal_history(event_type);
CREATE INDEX idx_deal_history_timestamp ON deal_history(timestamp DESC);

-- Create materialized view for negotiation analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS negotiation_analytics AS
SELECT
  DATE(nr.started_at) as date,
  COUNT(DISTINCT nr.id) as total_negotiations,
  COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'completed') as completed_negotiations,
  COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'active') as active_negotiations,
  AVG(EXTRACT(EPOCH FROM (nr.closed_at - nr.started_at))/3600) FILTER (WHERE nr.closed_at IS NOT NULL) as avg_duration_hours,
  COUNT(DISTINCT rp.supplier_id) as unique_suppliers_participating,
  COUNT(DISTINCT co.id) as total_counter_offers,
  ROUND(
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'completed')::numeric /
    NULLIF(COUNT(DISTINCT nr.id), 0) * 100,
    2
  ) as completion_rate
FROM negotiation_rooms nr
LEFT JOIN room_participants rp ON nr.id = rp.room_id AND rp.participant_type = 'supplier'
LEFT JOIN counter_offers co ON nr.id = co.room_id
GROUP BY DATE(nr.started_at)
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_negotiation_analytics_date ON negotiation_analytics(date);

-- Create view for active negotiations
CREATE OR REPLACE VIEW active_negotiations AS
SELECT
  nr.id as room_id,
  nr.room_code,
  nr.buyer_id,
  nr.buyer_email,
  rfq.requirements,
  COUNT(DISTINCT rp.supplier_id) as supplier_count,
  COUNT(DISTINCT rm.id) as message_count,
  COUNT(DISTINCT co.id) as counter_offer_count,
  MAX(rm.timestamp) as last_activity,
  EXTRACT(EPOCH FROM (NOW() - nr.started_at))/3600 as hours_active
FROM negotiation_rooms nr
JOIN rfqs rfq ON nr.rfq_id = rfq.id
LEFT JOIN room_participants rp ON nr.id = rp.room_id AND rp.participant_type = 'supplier'
LEFT JOIN room_messages rm ON nr.id = rm.room_id
LEFT JOIN counter_offers co ON nr.id = co.room_id
WHERE nr.status = 'active'
GROUP BY nr.id, nr.room_code, nr.buyer_id, nr.buyer_email, rfq.requirements, nr.started_at;

-- Create trigger for updated_at on negotiation_rooms
CREATE TRIGGER update_negotiation_rooms_updated_at BEFORE UPDATE ON negotiation_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-expire old counter offers
CREATE OR REPLACE FUNCTION expire_old_counter_offers()
RETURNS void AS $$
BEGIN
  UPDATE counter_offers
  SET status = 'expired'
  WHERE status = 'pending'
    AND valid_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to close inactive rooms (24 hours of no activity)
CREATE OR REPLACE FUNCTION close_inactive_rooms()
RETURNS void AS $$
BEGIN
  UPDATE negotiation_rooms nr
  SET
    status = 'expired',
    closed_at = NOW()
  WHERE nr.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM room_messages rm
      WHERE rm.room_id = nr.id
        AND rm.timestamp > NOW() - INTERVAL '24 hours'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get room statistics
CREATE OR REPLACE FUNCTION get_room_stats(p_room_id UUID)
RETURNS TABLE(
  supplier_count BIGINT,
  message_count BIGINT,
  counter_offer_count BIGINT,
  avg_response_time_minutes NUMERIC,
  last_activity TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT rp.supplier_id)::BIGINT,
    COUNT(DISTINCT rm.id)::BIGINT,
    COUNT(DISTINCT co.id)::BIGINT,
    AVG(
      EXTRACT(EPOCH FROM (rm.timestamp - LAG(rm.timestamp) OVER (ORDER BY rm.timestamp)))
    ) / 60 as avg_response_time_minutes,
    MAX(rm.timestamp)
  FROM negotiation_rooms nr
  LEFT JOIN room_participants rp ON nr.id = rp.room_id AND rp.participant_type = 'supplier'
  LEFT JOIN room_messages rm ON nr.id = rm.room_id
  LEFT JOIN counter_offers co ON nr.id = co.room_id
  WHERE nr.id = p_room_id
  GROUP BY nr.id;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh negotiation analytics
CREATE OR REPLACE FUNCTION refresh_negotiation_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY negotiation_analytics;
END;
$$ LANGUAGE plpgsql;
