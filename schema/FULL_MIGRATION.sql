-- ============================================================
-- SOV Dashboard — COMPLETE DATABASE MIGRATION
-- Run this SINGLE file in Supabase SQL Editor
-- ============================================================
-- This file combines all migrations into one script.
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- ============================================================
-- STEP 1: Extensions
-- ============================================================

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 2: Core Tables
-- ============================================================

-- campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT '',
  sub_category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- campaign_brands
CREATE TABLE IF NOT EXISTS campaign_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  type TEXT DEFAULT 'competitor' CHECK(type IN ('own','competitor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, name)
);

-- keywords
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  category TEXT DEFAULT 'generic' CHECK(category IN ('generic','branded','comparison')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','paused')),
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, text)
);

-- videos
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT DEFAULT '',
  channel_name TEXT,
  channel_id TEXT,
  published_at TIMESTAMPTZ,
  duration TEXT,
  duration_sec INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- api_keys (for YouTube API rotation)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  bucket INTEGER DEFAULT 1 CHECK(bucket IN (1,2)),
  units_used INTEGER DEFAULT 0,
  units_limit INTEGER DEFAULT 10000,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 3: Ranking Tables
-- ============================================================

-- keyword_videos (long-form)
CREATE TABLE IF NOT EXISTS keyword_videos (
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  rank INTEGER,
  search_appearance_count INTEGER DEFAULT 1,
  keywords_appeared TEXT[] DEFAULT '{}',
  cross_keyword_ranks INTEGER[] DEFAULT '{}',
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_our_video BOOLEAN DEFAULT FALSE,
  keyword_count INTEGER GENERATED ALWAYS AS (array_length(keywords_appeared, 1)) STORED,
  region_code TEXT,
  PRIMARY KEY (keyword_id, video_id)
);

-- keyword_shorts (short-form)
CREATE TABLE IF NOT EXISTS keyword_shorts (
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  rank INTEGER,
  search_appearance_count INTEGER DEFAULT 1,
  keywords_appeared TEXT[] DEFAULT '{}',
  cross_keyword_ranks INTEGER[] DEFAULT '{}',
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_our_video BOOLEAN DEFAULT FALSE,
  keyword_count INTEGER GENERATED ALWAYS AS (array_length(keywords_appeared, 1)) STORED,
  region_code TEXT,
  PRIMARY KEY (keyword_id, video_id)
);

-- campaign_videos (pool of all search results)
CREATE TABLE IF NOT EXISTS campaign_videos (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(campaign_id, video_id)
);

-- keyword_rank_history (for dropped detection)
CREATE TABLE IF NOT EXISTS keyword_rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  form_type TEXT NOT NULL CHECK(form_type IN ('long','short')),
  week_start TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(keyword_id, video_id, form_type, week_start)
);

-- ============================================================
-- STEP 4: Analytics Tables
-- ============================================================

-- view_snapshots (daily view counts)
CREATE TABLE IF NOT EXISTS view_snapshots (
  id UUID DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count BIGINT,
  comment_count BIGINT,
  daily_delta BIGINT DEFAULT 0,
  growth_percent NUMERIC(10,4) DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (video_id, campaign_id, snapshot_date)
);

-- tracked_videos (manually added)
CREATE TABLE IF NOT EXISTS tracked_videos (
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (video_id, campaign_id)
);

-- brand_tags
CREATE TABLE IF NOT EXISTS brand_tags (
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  PRIMARY KEY(video_id, brand_name, campaign_id)
);

-- ============================================================
-- STEP 5: AI & Transcript Tables
-- ============================================================

-- video_transcripts
CREATE TABLE IF NOT EXISTS video_transcripts (
  video_id UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  youtube_id TEXT,
  transcript_text TEXT,
  language TEXT DEFAULT 'en',
  fetch_status TEXT DEFAULT 'pending' CHECK (fetch_status IN ('pending', 'success', 'no_captions', 'failed')),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- brand_analysis (AI-detected brand mentions)
CREATE TABLE IF NOT EXISTS brand_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  confidence REAL DEFAULT 0,
  mention_type TEXT DEFAULT 'mentioned',
  context_quotes TEXT[] DEFAULT '{}',
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- video_phrase_summary (for multi-keyword word cloud)
CREATE TABLE IF NOT EXISTS video_phrase_summary (
  video_id UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  extracted_phrases TEXT[] DEFAULT '{}',
  keyword_count INTEGER DEFAULT 0,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 6: System & Auth Tables
-- ============================================================

-- system_metadata (global timestamps)
CREATE TABLE IF NOT EXISTS system_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default metadata
INSERT INTO system_metadata (key, value) VALUES
  ('last_views_refresh', NULL),
  ('last_ranking_refresh', NULL),
  ('last_weekly_refresh', NULL),
  ('last_brand_analysis', NULL)
ON CONFLICT (key) DO NOTHING;

-- users (auth system)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'brand' CHECK(role IN ('admin','brand')),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  brand_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 7: SOV & Insights Tables
-- ============================================================

-- sov_snapshots (powers trend graph)
CREATE TABLE IF NOT EXISTS sov_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  sov_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  brand_views BIGINT DEFAULT 0,
  metric_type TEXT DEFAULT 'views' CHECK(metric_type IN ('views', 'frequency')),
  UNIQUE(campaign_id, brand_name, snapshot_date, metric_type)
);

-- share_links (public snapshots)
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  created_by TEXT,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- insight_snapshots (AI weekly summaries)
CREATE TABLE IF NOT EXISTS insight_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  week_ending DATE NOT NULL,
  summary_text TEXT NOT NULL,
  key_metrics JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, week_ending)
);

-- alert_rules (competitor threshold alerts)
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  metric TEXT CHECK(metric IN ('sov_percent', 'view_growth', 'frequency_growth')),
  threshold NUMERIC NOT NULL,
  direction TEXT CHECK(direction IN ('above', 'below')),
  webhook_url TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- scrape_jobs (job queue)
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id TEXT PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  keyword_text TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
  results_count INTEGER DEFAULT 0,
  error_msg TEXT,
  api_key_used TEXT,
  quota_used INTEGER DEFAULT 0,
  job_type TEXT DEFAULT 'keyword_scrape',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 8: Indexes for Performance
-- ============================================================

-- view_snapshots indexes
CREATE INDEX IF NOT EXISTS idx_vs_video_date ON view_snapshots (video_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_vs_date_views ON view_snapshots (snapshot_date DESC) INCLUDE (video_id, view_count);

-- keyword_videos indexes
CREATE INDEX IF NOT EXISTS idx_kv_campaign ON keyword_videos (campaign_id);
CREATE INDEX IF NOT EXISTS idx_kv_last_seen ON keyword_videos (campaign_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_kv_keyword_count ON keyword_videos (campaign_id, keyword_count DESC);

-- keyword_shorts indexes
CREATE INDEX IF NOT EXISTS idx_ks_campaign ON keyword_shorts (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ks_last_seen ON keyword_shorts (campaign_id, last_seen_at DESC);

-- videos indexes
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos (channel_name, channel_id);

-- brand_tags indexes
CREATE INDEX IF NOT EXISTS idx_bt_campaign ON brand_tags (campaign_id);
CREATE INDEX IF NOT EXISTS idx_bt_brand ON brand_tags (brand_name);

-- scrape_jobs indexes
CREATE INDEX IF NOT EXISTS idx_scrape_status ON scrape_jobs (campaign_id, status, created_at DESC);

-- sov_snapshots indexes
CREATE INDEX IF NOT EXISTS idx_sovs_campaign_brand ON sov_snapshots (campaign_id, brand_name, snapshot_date DESC);

-- brand_analysis indexes
CREATE INDEX IF NOT EXISTS idx_ba_brand ON brand_analysis (brand_name, confidence DESC);

-- ============================================================
-- STEP 9: Materialized Views
-- ============================================================

-- Brand SOV by views
CREATE MATERIALIZED VIEW IF NOT EXISTS brand_sov_mv AS
WITH latest_snapshots AS (
  SELECT DISTINCT ON (video_id)
    video_id, view_count, snapshot_date
  FROM view_snapshots
  ORDER BY video_id, snapshot_date DESC
),
video_brand_views AS (
  SELECT
    kv.campaign_id,
    unnest(v.tags) AS brand_name,
    ls.view_count
  FROM keyword_videos kv
  JOIN videos v ON v.id = kv.video_id
  JOIN latest_snapshots ls ON ls.video_id = kv.video_id
  WHERE v.tags IS NOT NULL AND array_length(v.tags, 1) > 0
  AND v.is_deleted = FALSE

  UNION ALL

  SELECT
    tv.campaign_id,
    unnest(v.tags) AS brand_name,
    ls.view_count
  FROM tracked_videos tv
  JOIN videos v ON v.id = tv.video_id
  JOIN latest_snapshots ls ON ls.video_id = tv.video_id
  WHERE v.tags IS NOT NULL AND array_length(v.tags, 1) > 0
  AND v.is_deleted = FALSE
)
SELECT
  campaign_id,
  brand_name,
  SUM(view_count) AS brand_total_views,
  SUM(SUM(view_count)) OVER (PARTITION BY campaign_id) AS campaign_total_views,
  ROUND(
    100.0 * SUM(view_count) /
    NULLIF(SUM(SUM(view_count)) OVER (PARTITION BY campaign_id), 0),
    2
  ) AS sov_percent,
  COUNT(*) AS video_count,
  NOW() AS computed_at
FROM video_brand_views
GROUP BY campaign_id, brand_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_sov_mv ON brand_sov_mv (campaign_id, brand_name);

-- Brand SOV by frequency
CREATE MATERIALIZED VIEW IF NOT EXISTS brand_freq_sov_mv AS
WITH video_brand_freq AS (
  SELECT
    kv.campaign_id,
    unnest(v.tags) AS brand_name,
    kv.search_appearance_count
  FROM keyword_videos kv
  JOIN videos v ON v.id = kv.video_id
  WHERE v.tags IS NOT NULL AND array_length(v.tags, 1) > 0
  AND v.is_deleted = FALSE
)
SELECT
  campaign_id,
  brand_name,
  SUM(search_appearance_count) AS brand_total_freq,
  SUM(SUM(search_appearance_count)) OVER (PARTITION BY campaign_id) AS campaign_total_freq,
  ROUND(
    100.0 * SUM(search_appearance_count) /
    NULLIF(SUM(SUM(search_appearance_count)) OVER (PARTITION BY campaign_id), 0),
    2
  ) AS freq_sov_percent,
  COUNT(*) AS video_count,
  NOW() AS computed_at
FROM video_brand_freq
GROUP BY campaign_id, brand_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_freq_sov_mv ON brand_freq_sov_mv (campaign_id, brand_name);

-- Channel ranking leaderboard
CREATE MATERIALIZED VIEW IF NOT EXISTS channel_rank_mv AS
SELECT
  v.campaign_id,
  vid.channel_name,
  vid.channel_id,
  COUNT(DISTINCT vid.id) AS video_count,
  SUM(v.search_appearance_count) AS total_frequency,
  MAX(ls.view_count) AS max_video_views,
  SUM(ls.view_count) AS total_views,
  NOW() AS computed_at
FROM (
  SELECT campaign_id, video_id, search_appearance_count FROM keyword_videos
  UNION ALL
  SELECT campaign_id, video_id, search_appearance_count FROM keyword_shorts
) v
JOIN videos vid ON vid.id = v.video_id
LEFT JOIN LATERAL (
  SELECT view_count FROM view_snapshots
  WHERE video_id = v.video_id
  ORDER BY snapshot_date DESC LIMIT 1
) ls ON TRUE
WHERE vid.is_deleted = FALSE
GROUP BY v.campaign_id, vid.channel_name, vid.channel_id;

CREATE INDEX IF NOT EXISTS idx_channel_rank_mv ON channel_rank_mv (campaign_id, total_frequency DESC);

-- ============================================================
-- STEP 10: Helper Functions
-- ============================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_sov_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_freq_sov_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY channel_rank_mv;

  UPDATE system_metadata
  SET value = NOW()::TEXT, updated_at = NOW()
  WHERE key = 'last_views_refresh';
END;
$$;

-- Function to execute arbitrary SQL (for migrations)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Function to increment quota usage
CREATE OR REPLACE FUNCTION increment_quota_usage(p_units INTEGER, p_account TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE api_keys
  SET units_used = units_used + p_units,
      last_used_at = NOW()
  WHERE label = p_account AND is_active = TRUE;
END;
$$;

-- Function to get video stats
CREATE OR REPLACE FUNCTION get_video_stats(p_campaign_id UUID)
RETURNS TABLE(
  total_videos BIGINT,
  total_views BIGINT,
  unique_videos BIGINT,
  unique_views BIGINT,
  unique_channels BIGINT,
  transcript_coverage NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_videos AS (
    SELECT kv.video_id, kv.campaign_id
    FROM keyword_videos kv
    WHERE kv.campaign_id = p_campaign_id
    UNION
    SELECT ks.video_id, ks.campaign_id
    FROM keyword_shorts ks
    WHERE ks.campaign_id = p_campaign_id
  ),
  video_stats AS (
    SELECT
      COUNT(*) as total_videos,
      SUM(v.view_count) as total_views,
      COUNT(DISTINCT v.youtube_id) as unique_videos,
      SUM(DISTINCT v.view_count) as unique_views,
      COUNT(DISTINCT v.channel_name) as unique_channels
    FROM ranked_videos rv
    JOIN videos v ON v.id = rv.video_id
    WHERE v.is_deleted = FALSE
  ),
  transcript_stats AS (
    SELECT
      COUNT(DISTINCT vt.video_id) as with_transcripts
    FROM video_transcripts vt
    JOIN ranked_videos rv ON rv.video_id = vt.video_id
    WHERE vt.fetch_status = 'success'
  )
  SELECT
    vs.total_videos,
    vs.total_views,
    vs.unique_videos,
    vs.unique_views,
    vs.unique_channels,
    CASE
      WHEN vs.unique_videos > 0
      THEN ROUND(100.0 * ts.with_transcripts / vs.unique_videos, 1)
      ELSE 0
    END as transcript_coverage
  FROM video_stats vs, transcript_stats ts;
END;
$$;

-- Function to get growth rates
CREATE OR REPLACE FUNCTION get_growth_rates(p_campaign_id UUID)
RETURNS TABLE(
  h24 NUMERIC,
  d7 NUMERIC,
  d30 NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  today_views BIGINT;
  yesterday_views BIGINT;
  week_ago_views BIGINT;
  month_ago_views BIGINT;
BEGIN
  -- Get today's views
  SELECT COALESCE(SUM(view_count), 0) INTO today_views
  FROM view_snapshots
  WHERE campaign_id = p_campaign_id
  AND snapshot_date = CURRENT_DATE;

  -- Get yesterday's views
  SELECT COALESCE(SUM(view_count), 0) INTO yesterday_views
  FROM view_snapshots
  WHERE campaign_id = p_campaign_id
  AND snapshot_date = CURRENT_DATE - INTERVAL '1 day';

  -- Get week ago views
  SELECT COALESCE(SUM(view_count), 0) INTO week_ago_views
  FROM view_snapshots
  WHERE campaign_id = p_campaign_id
  AND snapshot_date = CURRENT_DATE - INTERVAL '7 days';

  -- Get month ago views
  SELECT COALESCE(SUM(view_count), 0) INTO month_ago_views
  FROM view_snapshots
  WHERE campaign_id = p_campaign_id
  AND snapshot_date = CURRENT_DATE - INTERVAL '30 days';

  -- Calculate growth rates
  h24 := CASE
    WHEN yesterday_views > 0
    THEN ROUND(((today_views - yesterday_views)::NUMERIC / yesterday_views) * 100, 1)
    ELSE 0
  END;

  d7 := CASE
    WHEN week_ago_views > 0
    THEN ROUND(((today_views - week_ago_views)::NUMERIC / week_ago_views) * 100, 1)
    ELSE 0
  END;

  d30 := CASE
    WHEN month_ago_views > 0
    THEN ROUND(((today_views - month_ago_views)::NUMERIC / month_ago_views) * 100, 1)
    ELSE 0
  END;

  RETURN NEXT;
END;
$$;

-- Function to get brand growth
CREATE OR REPLACE FUNCTION get_brand_growth(
  p_campaign_id UUID,
  p_metric TEXT,
  p_period TEXT
)
RETURNS TABLE(
  brand_name TEXT,
  current_value NUMERIC,
  previous_value NUMERIC,
  growth_percent NUMERIC,
  rank_movement INTEGER,
  sparkline_data NUMERIC[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH period_dates AS (
    SELECT
      CURRENT_DATE as end_date,
      CASE p_period
        WHEN '24h' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN '7d' THEN CURRENT_DATE - INTERVAL '7 days'
        WHEN '30d' THEN CURRENT_DATE - INTERVAL '30 days'
      END as start_date
  ),
  current_stats AS (
    SELECT
      bt.brand_name,
      SUM(CASE WHEN p_metric = 'views' THEN v.view_count ELSE kv.search_appearance_count END) as value
    FROM brand_tags bt
    JOIN videos v ON v.id = bt.video_id
    LEFT JOIN keyword_videos kv ON kv.video_id = bt.video_id
    WHERE bt.campaign_id = p_campaign_id
    AND v.is_deleted = FALSE
    GROUP BY bt.brand_name
  ),
  previous_stats AS (
    SELECT
      bt.brand_name,
      SUM(CASE WHEN p_metric = 'views' THEN vs.view_count ELSE kv.search_appearance_count END) as value
    FROM brand_tags bt
    JOIN videos v ON v.id = bt.video_id
    LEFT JOIN keyword_videos kv ON kv.video_id = bt.video_id
    LEFT JOIN view_snapshots vs ON vs.video_id = bt.video_id
    WHERE bt.campaign_id = p_campaign_id
    AND v.is_deleted = FALSE
    AND vs.snapshot_date = (SELECT start_date FROM period_dates)
    GROUP BY bt.brand_name
  )
  SELECT
    cs.brand_name,
    cs.value as current_value,
    COALESCE(ps.value, 0) as previous_value,
    CASE
      WHEN COALESCE(ps.value, 0) > 0
      THEN ROUND(((cs.value - ps.value)::NUMERIC / ps.value) * 100, 1)
      ELSE 0
    END as growth_percent,
    0 as rank_movement,
    ARRAY[]::NUMERIC[] as sparkline_data
  FROM current_stats cs
  LEFT JOIN previous_stats ps ON ps.brand_name = cs.brand_name
  ORDER BY cs.value DESC;
END;
$$;

-- ============================================================
-- STEP 11: Initial Admin User (Optional)
-- ============================================================

-- Create initial admin user (password: admin123)
-- IMPORTANT: Change this password in production!
INSERT INTO users (email, password_hash, role)
VALUES (
  'admin@sovpanel.com',
  -- This is a placeholder hash. Use the app to create proper users.
  'placeholder:change-this-in-production',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- DONE! Database is ready.
-- ============================================================
-- Next steps:
-- 1. Set up .env.local with your Supabase credentials
-- 2. Run: curl http://localhost:3000/api/init?secret=your-cron-secret
-- 3. Start scraping!
-- ============================================================
