-- Grain & Vault Waitlist Table
-- Enterprise-focused viral waitlist for CFOs and procurement teams

CREATE TABLE IF NOT EXISTS grain_waitlist (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  company VARCHAR(255),
  role VARCHAR(100),
  monthly_volume VARCHAR(50),
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  referred_by VARCHAR(20),
  referral_count INTEGER DEFAULT 0,
  priority_score INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, invited, converted
  invited_at TIMESTAMP,
  converted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON grain_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON grain_waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON grain_waitlist(referred_by);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON grain_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON grain_waitlist(created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_priority ON grain_waitlist(priority_score DESC);

-- Function to update priority score based on referrals
CREATE OR REPLACE FUNCTION update_waitlist_priority()
RETURNS TRIGGER AS $$
BEGIN
  -- Priority = base_position - (referral_count * 10)
  -- More referrals = higher priority (lower position number)
  NEW.priority_score := NEW.referral_count * 10;

  -- Bonus for high-value prospects (enterprise roles)
  IF NEW.role IN ('cfo', 'treasurer', 'controller') THEN
    NEW.priority_score := NEW.priority_score + 50;
  END IF;

  -- Bonus for high volume
  IF NEW.monthly_volume IN ('5m-10m', '10m-plus') THEN
    NEW.priority_score := NEW.priority_score + 100;
  ELSIF NEW.monthly_volume IN ('1m-5m') THEN
    NEW.priority_score := NEW.priority_score + 50;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update priority
DROP TRIGGER IF EXISTS trigger_update_waitlist_priority ON grain_waitlist;
CREATE TRIGGER trigger_update_waitlist_priority
  BEFORE INSERT OR UPDATE ON grain_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_priority();

-- Comments
COMMENT ON TABLE grain_waitlist IS 'Viral waitlist for Grain & Vault early access';
COMMENT ON COLUMN grain_waitlist.priority_score IS 'Higher score = earlier access (referrals + enterprise tier)';
COMMENT ON COLUMN grain_waitlist.referral_count IS 'Number of successful referrals by this user';
