-- ============================================================================
-- FILE STORAGE SCHEMA
-- Database schema for file tracking and metadata storage
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- FILES TABLE
-- Main table for storing file metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  url TEXT NOT NULL,
  extracted_text TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_content_type ON files(content_type);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_url ON files(url);

-- Index for metadata queries (JSONB)
CREATE INDEX IF NOT EXISTS idx_files_metadata ON files USING gin(metadata);

-- Index for purpose filtering
CREATE INDEX IF NOT EXISTS idx_files_purpose ON files((metadata->>'purpose'));

-- Index for conversation association
CREATE INDEX IF NOT EXISTS idx_files_conversation ON files((metadata->>'conversationId'));

-- ============================================================================
-- FILE ANALYSIS TABLE
-- Store analysis results for files
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  model_used TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for file analysis queries
CREATE INDEX IF NOT EXISTS idx_file_analyses_file_id ON file_analyses(file_id);
CREATE INDEX IF NOT EXISTS idx_file_analyses_type ON file_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_file_analyses_created_at ON file_analyses(created_at DESC);

-- ============================================================================
-- MESSAGE FILES JUNCTION TABLE
-- Associate files with chat messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, file_id)
);

-- Indexes for junction table
CREATE INDEX IF NOT EXISTS idx_message_files_message_id ON message_files(message_id);
CREATE INDEX IF NOT EXISTS idx_message_files_file_id ON message_files(file_id);

-- ============================================================================
-- FILE USAGE TRACKING
-- Track how files are used (downloads, views, analyses)
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'view', 'download', 'analyze', 'share'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_file_usage_file_id ON file_usage(file_id);
CREATE INDEX IF NOT EXISTS idx_file_usage_user_id ON file_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_file_usage_action ON file_usage(action);
CREATE INDEX IF NOT EXISTS idx_file_usage_created_at ON file_usage(created_at DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for file statistics per user
CREATE OR REPLACE VIEW user_file_stats AS
SELECT
  user_id,
  COUNT(*) as total_files,
  SUM(size) as total_size_bytes,
  COUNT(CASE WHEN content_type LIKE 'image/%' THEN 1 END) as image_count,
  COUNT(CASE WHEN content_type = 'application/pdf' THEN 1 END) as pdf_count,
  COUNT(CASE WHEN content_type LIKE '%document%' OR content_type LIKE '%word%' THEN 1 END) as document_count,
  COUNT(CASE WHEN content_type LIKE '%spreadsheet%' OR content_type LIKE '%excel%' OR content_type = 'text/csv' THEN 1 END) as spreadsheet_count,
  COUNT(CASE WHEN extracted_text IS NOT NULL THEN 1 END) as files_with_text,
  MAX(created_at) as last_upload
FROM files
GROUP BY user_id;

-- View for recent file analyses
CREATE OR REPLACE VIEW recent_file_analyses AS
SELECT
  fa.id,
  fa.file_id,
  f.filename,
  f.content_type,
  fa.analysis_type,
  fa.success,
  fa.model_used,
  fa.tokens_used,
  fa.created_at
FROM file_analyses fa
JOIN files f ON fa.file_id = f.id
ORDER BY fa.created_at DESC
LIMIT 100;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_files_updated_at ON files;
CREATE TRIGGER trigger_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_files_updated_at();

-- Function to get file storage usage for a user
CREATE OR REPLACE FUNCTION get_user_storage_usage(p_user_id TEXT)
RETURNS TABLE(
  total_files BIGINT,
  total_size_bytes BIGINT,
  oldest_file TIMESTAMPTZ,
  newest_file TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(size), 0)::BIGINT,
    MIN(created_at),
    MAX(created_at)
  FROM files
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old files (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_files(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM files
    WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND metadata->>'permanent' IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for testing - remove in production)
-- ============================================================================

-- Uncomment to insert sample data for testing
/*
INSERT INTO files (user_id, filename, content_type, size, url, metadata)
VALUES
  ('user_test123', 'sample-document.pdf', 'application/pdf', 102400, 'https://blob.vercel-storage.com/sample-123.pdf', '{"purpose": "chat", "tags": ["test", "sample"]}'),
  ('user_test123', 'sample-image.jpg', 'image/jpeg', 51200, 'https://blob.vercel-storage.com/sample-456.jpg', '{"purpose": "attachment"}'),
  ('user_test123', 'sample-data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 25600, 'https://blob.vercel-storage.com/sample-789.xlsx', '{"purpose": "analysis"}');
*/

-- ============================================================================
-- GRANTS (adjust based on your database user setup)
-- ============================================================================

-- Grant permissions to your application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON files TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON file_analyses TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON message_files TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON file_usage TO your_app_user;
-- GRANT SELECT ON user_file_stats TO your_app_user;
-- GRANT SELECT ON recent_file_analyses TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
