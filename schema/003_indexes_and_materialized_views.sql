-- ============================================================
-- SOV Dashboard — Migration 004: Indexes & Materialized Views
-- Run AFTER migrations 001–003
-- ============================================================

-- ============================================================
-- CRITICAL INDEXES
-- ============================================================

-- view_snapshots: most queried table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vs_video_date
  ON view_snapshots (video_id, snapshot_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vs_date_views
  ON view_snapshots (snapshot_date DESC)
  INCLUDE (video_id, view_count, daily_delta);

-- keyword_videos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kv_campaign_count
  ON keyword_videos (campaign_id, search_appearance_count DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kv_last_seen
  ON keyword_videos (campaign_id, last_seen_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kv_keyword_count
  ON keyword_videos (campaign_id, keyword_count DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kv_campaign_video
  ON keyword_videos (campaign_id, video_id);

-- keyword_shorts (mirror)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ks_campaign_count
  ON keyword_shorts (campaign_id, search_appearance_count DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ks_last_seen
  ON keyword_shorts (campaign_id, last_seen_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ks_keyword_count
  ON keyword_shorts (campaign_id, keyword_count DESC);

-- videos: GIN index on tags array for brand lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_tags
  ON videos USING GIN (tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_channel
  ON videos (channel_name, channel_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_published
  ON videos (published_at DESC);

-- brand_mentions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bm_brand_count
  ON brand_mentions (brand_name, mention_count DESC);

-- sov_snapshots
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sovs_campaign_brand_date
  ON sov_snapshots (campaign_id, brand_name, snapshot_date DESC);

-- scrape_jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scrape_status
  ON scrape_jobs (campaign_id, status, created_at DESC);

-- share_links
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_share_token
  ON share_links (token);

-- ============================================================
-- MATERIALIZED VIEWS (Pre-computed analytics)
-- ============================================================

-- Brand SOV by views (refreshed hourly after WF3)
CREATE MATERIALIZED VIEW IF NOT EXISTS brand_sov_mv AS
WITH latest_snapshots AS (
  SELECT DISTINCT ON (video_id)
    video_id,
    view_count,
    snapshot_date
  FROM view_snapshots
  ORDER BY video_id, snapshot_date DESC
),
video_brand_views AS (
  SELECT
    bt.campaign_id,
    bt.brand_name,
    ls.view_count
  FROM brand_tags bt
  JOIN videos v ON v.id = bt.video_id
  JOIN latest_snapshots ls ON ls.video_id = bt.video_id
  WHERE v.is_deleted = FALSE
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_sov_mv
  ON brand_sov_mv (campaign_id, brand_name);

-- Brand SOV by frequency (search appearances)
CREATE MATERIALIZED VIEW IF NOT EXISTS brand_freq_sov_mv AS
WITH video_brand_freq AS (
  SELECT
    kv.campaign_id,
    bt.brand_name,
    kv.search_appearance_count
  FROM keyword_videos kv
  JOIN videos v ON v.id = kv.video_id
  JOIN brand_tags bt ON bt.video_id = kv.video_id AND bt.campaign_id = kv.campaign_id
  WHERE v.is_deleted = FALSE
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_freq_sov_mv
  ON brand_freq_sov_mv (campaign_id, brand_name);

-- Channel ranking leaderboard (powers "Most Ranking Channel" KPI)
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

CREATE INDEX IF NOT EXISTS idx_channel_rank_mv
  ON channel_rank_mv (campaign_id, total_frequency DESC);

-- ============================================================
-- REFRESH FUNCTION (called by n8n after WF3 completes)
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_sov_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_freq_sov_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY channel_rank_mv;

  -- Update metadata timestamp
  UPDATE system_metadata
  SET value = NOW()::TEXT, updated_at = NOW()
  WHERE key = 'last_views_refresh';
END;
$$;
