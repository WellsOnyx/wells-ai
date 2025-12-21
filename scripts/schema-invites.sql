-- Grain & Vault Invite System Schema
-- Enables viral network effect through supplier/customer onboarding

-- Invite codes table (one per user per type)
CREATE TABLE IF NOT EXISTS grain_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  invite_type VARCHAR(20) NOT NULL CHECK (invite_type IN ('supplier', 'customer')),
  target_email TEXT,
  target_company TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  uses_count INTEGER DEFAULT 0,
  max_uses INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Indexes for grain_invites
CREATE INDEX IF NOT EXISTS idx_grain_invites_user_id ON grain_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_grain_invites_code ON grain_invites(code);
CREATE INDEX IF NOT EXISTS idx_grain_invites_type ON grain_invites(invite_type);

-- Connections table (tracks who invited whom)
CREATE TABLE IF NOT EXISTS grain_invite_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID REFERENCES grain_invites(id),
  inviter_id TEXT NOT NULL,
  invitee_id TEXT,
  invitee_email TEXT,
  connection_type VARCHAR(20) NOT NULL CHECK (connection_type IN ('supplier', 'customer')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for grain_invite_connections
CREATE INDEX IF NOT EXISTS idx_grain_invite_connections_inviter ON grain_invite_connections(inviter_id);
CREATE INDEX IF NOT EXISTS idx_grain_invite_connections_invitee ON grain_invite_connections(invitee_id);
CREATE INDEX IF NOT EXISTS idx_grain_invite_connections_type ON grain_invite_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_grain_invite_connections_status ON grain_invite_connections(status);

-- Payments between connected parties
CREATE TABLE IF NOT EXISTS grain_network_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES grain_invite_connections(id),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  grain_amount DECIMAL(18, 6) NOT NULL,
  usd_value DECIMAL(18, 2) NOT NULL,
  grain_price DECIMAL(18, 6) NOT NULL,
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('supplier_payment', 'customer_payment')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_grain_network_payments_sender ON grain_network_payments(sender_id);
CREATE INDEX IF NOT EXISTS idx_grain_network_payments_receiver ON grain_network_payments(receiver_id);
CREATE INDEX IF NOT EXISTS idx_grain_network_payments_connection ON grain_network_payments(connection_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_grain_invite_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS grain_invites_updated_at ON grain_invites;
CREATE TRIGGER grain_invites_updated_at
  BEFORE UPDATE ON grain_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_grain_invite_timestamp();

DROP TRIGGER IF EXISTS grain_invite_connections_updated_at ON grain_invite_connections;
CREATE TRIGGER grain_invite_connections_updated_at
  BEFORE UPDATE ON grain_invite_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_grain_invite_timestamp();

-- Comments for documentation
COMMENT ON TABLE grain_invites IS 'Stores invite codes for supplier/customer onboarding';
COMMENT ON TABLE grain_invite_connections IS 'Tracks connections between inviters and invitees';
COMMENT ON TABLE grain_network_payments IS 'Records payments between connected network members';
