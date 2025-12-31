-- ============================================================================
-- Progressive Profiles Schema
--
-- Profiles that build themselves through conversation.
-- Users never "fill out a profile" - they just talk to Wells.
-- ============================================================================

-- Main progressive profiles table
CREATE TABLE IF NOT EXISTS progressive_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,

    -- Core journey
    journey TEXT CHECK (journey IN ('buyer', 'seller', 'founder', 'jobs')),
    journeys JSONB DEFAULT '[]'::jsonb,

    -- Basic info
    name TEXT,
    email TEXT,
    phone TEXT,

    -- Journey-specific profiles (JSONB for flexibility)
    buyer_profile JSONB,
    seller_profile JSONB,
    founder_profile JSONB,
    jobs_profile JSONB,

    -- Completeness and tracking
    completeness INTEGER DEFAULT 0 CHECK (completeness >= 0 AND completeness <= 100),
    extracted_from JSONB DEFAULT '[]'::jsonb,
    confidence_scores JSONB DEFAULT '{}'::jsonb,
    extraction_history JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_progressive_profiles_user_id
ON progressive_profiles(user_id);

-- Index for journey-based queries
CREATE INDEX IF NOT EXISTS idx_progressive_profiles_journey
ON progressive_profiles(journey);

-- Index for completeness queries (finding incomplete profiles)
CREATE INDEX IF NOT EXISTS idx_progressive_profiles_completeness
ON progressive_profiles(completeness);

-- Index for recent updates
CREATE INDEX IF NOT EXISTS idx_progressive_profiles_updated_at
ON progressive_profiles(updated_at DESC);

-- GIN indexes for JSONB searches
CREATE INDEX IF NOT EXISTS idx_progressive_profiles_buyer_profile
ON progressive_profiles USING GIN (buyer_profile);

CREATE INDEX IF NOT EXISTS idx_progressive_profiles_seller_profile
ON progressive_profiles USING GIN (seller_profile);

CREATE INDEX IF NOT EXISTS idx_progressive_profiles_founder_profile
ON progressive_profiles USING GIN (founder_profile);

CREATE INDEX IF NOT EXISTS idx_progressive_profiles_jobs_profile
ON progressive_profiles USING GIN (jobs_profile);

-- ============================================================================
-- Trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_progressive_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_progressive_profiles_updated_at ON progressive_profiles;

CREATE TRIGGER trigger_progressive_profiles_updated_at
    BEFORE UPDATE ON progressive_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_progressive_profiles_updated_at();

-- ============================================================================
-- Example queries for reference
-- ============================================================================

-- Get all incomplete buyer profiles
-- SELECT * FROM progressive_profiles
-- WHERE journey = 'buyer' AND completeness < 80
-- ORDER BY updated_at DESC;

-- Find sellers with specific certifications
-- SELECT * FROM progressive_profiles
-- WHERE journey = 'seller'
-- AND seller_profile->'certifications' ? 'ISO 9001';

-- Find job seekers with specific skills
-- SELECT * FROM progressive_profiles
-- WHERE journey = 'jobs'
-- AND jobs_profile->'skills' ?| ARRAY['python', 'machine learning'];

-- Get average completeness by journey
-- SELECT journey, AVG(completeness) as avg_completeness
-- FROM progressive_profiles
-- WHERE journey IS NOT NULL
-- GROUP BY journey;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE progressive_profiles IS
'User profiles that build themselves through conversation with Wells AI';

COMMENT ON COLUMN progressive_profiles.journey IS
'Primary user journey: buyer, seller, founder, or jobs';

COMMENT ON COLUMN progressive_profiles.journeys IS
'All journeys the user has expressed interest in';

COMMENT ON COLUMN progressive_profiles.buyer_profile IS
'Buyer-specific data: needs, budget, locations, categories';

COMMENT ON COLUMN progressive_profiles.seller_profile IS
'Seller-specific data: products, certifications, regions, capacity';

COMMENT ON COLUMN progressive_profiles.founder_profile IS
'Founder-specific data: stage, team size, priorities';

COMMENT ON COLUMN progressive_profiles.jobs_profile IS
'Job seeker data: skills, experience, preferences, salary expectations';

COMMENT ON COLUMN progressive_profiles.completeness IS
'Profile completeness score 0-100, calculated based on filled fields';

COMMENT ON COLUMN progressive_profiles.confidence_scores IS
'Confidence scores for extracted fields';

COMMENT ON COLUMN progressive_profiles.extraction_history IS
'History of all data extractions from conversations';
