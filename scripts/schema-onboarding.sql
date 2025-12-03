-- ============================================================================
-- WELLS AI ONBOARDING SCHEMA
-- Run: psql $POSTGRES_URL < scripts/schema-onboarding.sql
-- ============================================================================

-- ONBOARDING STATE
CREATE TABLE IF NOT EXISTS onboarding_state (
  user_id TEXT PRIMARY KEY,
  current_step TEXT NOT NULL DEFAULT 'welcome',
  completed_steps JSONB DEFAULT '[]',
  selected_journey TEXT,
  progress INTEGER DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboarding_state_progress ON onboarding_state(progress);

-- USER PROFILES
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,

  -- Basic Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,

  -- Extended Profile
  journey TEXT, -- 'founder', 'buyer', 'seller', 'jobs'
  company TEXT,
  role TEXT,
  industry TEXT,
  location TEXT,
  timezone TEXT,

  -- Journey-Specific Profiles (JSONB)
  founder_profile JSONB,
  buyer_profile JSONB,
  seller_profile JSONB,
  jobs_profile JSONB,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_journey ON user_profiles(journey);

-- INTEGRATIONS
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'google-calendar', 'slack', 'linkedin', etc.
  status TEXT NOT NULL DEFAULT 'connected',

  -- OAuth Data (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,

  -- Provider-Specific
  provider_user_id TEXT,
  provider_email TEXT,
  scopes TEXT[],

  -- Metadata
  connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMP,

  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_user ON user_integrations(user_id);

-- TREASURY WALLETS
CREATE TABLE IF NOT EXISTS treasury_wallets (
  user_id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL UNIQUE,
  balance DECIMAL(20, 2) DEFAULT 0,
  currency TEXT DEFAULT 'GRAIN',
  chain TEXT DEFAULT 'BASE',

  -- Status
  status TEXT DEFAULT 'active',
  kyc_status TEXT DEFAULT 'not-started',

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PAYMENT METHODS
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'bank-account', 'debit-card', 'credit-card'
  last4 TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',

  -- Provider Data
  provider_id TEXT,
  provider_data JSONB,

  added_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
