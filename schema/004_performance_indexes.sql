-- ============================================================
-- SOV Dashboard — Migration 004: Performance Indexes
-- PASTE THIS INTO SUPABASE SQL EDITOR AND RUN IT
-- Fixes full-table-scan bottlenecks causing 20s+ load times
-- ============================================================

-- 1. CRITICAL: campaign_id + snapshot_date composite index on view_snapshots
--    This is the single biggest fix — the dashboard queries view_snapshots by
--    campaign_id + date but there was no index covering this, causing full scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vs_campaign_date
  ON view_snapshots (campaign_id, snapshot_date DESC)
  INCLUDE (video_id, view_count);

-- 2. campaign_id index on brand_tags
--    Enables fast brand SOV computation without full table scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bt_campaign_brand
  ON brand_tags (campaign_id, brand_name)
  INCLUDE (video_id);

-- 3. Composite index for "new videos in last 7 days" query pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cv_campaign_seen
  ON campaign_videos (campaign_id, first_seen_at DESC)
  INCLUDE (video_id);

-- 4. Faster keyword lookups filtered by campaign + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kw_campaign_status
  ON keywords (campaign_id, status)
  INCLUDE (id, text, language, category, type);

-- 5. video_transcripts fetch_status index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vt_status
  ON video_transcripts (fetch_status)
  INCLUDE (video_id);

-- 6. campaign_videos video_id lookup (for JOIN queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cv_video_campaign
  ON campaign_videos (video_id, campaign_id);

-- ============================================================
-- VERIFY: Check all indexes are in place
-- ============================================================
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('view_snapshots', 'brand_tags', 'campaign_videos', 'keywords', 'video_transcripts')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
