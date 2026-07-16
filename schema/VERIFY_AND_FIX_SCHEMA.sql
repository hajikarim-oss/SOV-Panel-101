-- VERIFY_AND_FIX_SCHEMA.sql
-- Run this in Supabase SQL Editor to ensure ALL columns exist
-- This is idempotent — safe to run multiple times

-- 1. keywords: ensure 'type' column exists (code uses 'type', base schema has 'category')
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'generic';

-- 2. videos: ensure count columns exist
ALTER TABLE videos ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS like_count BIGINT DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS comment_count BIGINT DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration_sec INTEGER DEFAULT 0;

-- 3. Ensure unique constraints
DO $$ BEGIN
  ALTER TABLE brand_tags ADD CONSTRAINT brand_tags_video_brand_campaign_unique UNIQUE (video_id, brand_name, campaign_id);
EXCEPTION WHEN duplicate_table OR undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
EXCEPTION WHEN duplicate_table OR undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE keywords ADD CONSTRAINT keywords_campaign_text_unique UNIQUE (campaign_id, text);
EXCEPTION WHEN duplicate_table OR undefined_object THEN NULL;
END $$;

-- 4. Verify keyword_videos/keyword_shorts have the right columns
-- (they should already have discovered_at and last_seen_at from FULL_MIGRATION)
-- If scraped_at exists, rename it to discovered_at
DO $$ BEGIN
  ALTER TABLE keyword_videos RENAME COLUMN scraped_at TO discovered_at;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE keyword_shorts RENAME COLUMN scraped_at TO discovered_at;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 5. Ensure keyword_videos/keyword_shorts have last_seen_at
ALTER TABLE keyword_videos ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE keyword_shorts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Ensure keyword_videos/keyword_shorts have discovered_at
ALTER TABLE keyword_videos ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE keyword_shorts ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Verify video_transcripts has youtube_id and fetch_status
ALTER TABLE video_transcripts ADD COLUMN IF NOT EXISTS youtube_id TEXT;
ALTER TABLE video_transcripts ADD COLUMN IF NOT EXISTS fetch_status TEXT DEFAULT 'pending';

-- 8. Ensure view_snapshots has all columns
ALTER TABLE view_snapshots ADD COLUMN IF NOT EXISTS like_count BIGINT;
ALTER TABLE view_snapshots ADD COLUMN IF NOT EXISTS comment_count BIGINT;
ALTER TABLE view_snapshots ADD COLUMN IF NOT EXISTS daily_delta BIGINT DEFAULT 0;
ALTER TABLE view_snapshots ADD COLUMN IF NOT EXISTS growth_percent NUMERIC(10,4) DEFAULT 0;

-- 9. Ensure brand_analysis has the right context_quotes type
-- (TEXT[] is correct for PostgreSQL — row_to_json serializes it as JSON array)

-- 10. Verify scrape_jobs has all columns
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'keyword_scrape';
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS quota_used INTEGER DEFAULT 0;

-- 11. Ensure system_metadata exists
CREATE TABLE IF NOT EXISTS system_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Seed system_metadata if empty
INSERT INTO system_metadata (key, value, updated_at) VALUES
  ('last_views_refresh', NULL, NOW()),
  ('last_ranking_refresh', NULL, NOW()),
  ('last_weekly_refresh', NULL, NOW()),
  ('last_brand_analysis', NULL, NOW())
ON CONFLICT (key) DO NOTHING;

-- 13. Verify exec_sql function handles both SELECT and DML
DROP FUNCTION IF EXISTS exec_sql(text);
CREATE FUNCTION exec_sql(sql TEXT) RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trimmed TEXT := UPPER(TRIM(sql));
  result RECORD;
BEGIN
  IF trimmed LIKE 'SELECT %' OR trimmed LIKE 'WITH %' THEN
    FOR result IN EXECUTE sql LOOP
      RETURN NEXT row_to_json(result);
    END LOOP;
  ELSE
    EXECUTE sql;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;

SELECT 'Schema verification and fixes complete!' as status;
