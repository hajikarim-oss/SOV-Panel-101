-- ============================================================
-- SOV Dashboard — Migration 002: New Tables for Scale
-- ============================================================

-- ---- SOV Snapshots (powers Page 4 trend graph) ----
CREATE TABLE IF NOT EXISTS sov_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  sov_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  brand_views BIGINT DEFAULT 0,
  metric_type TEXT DEFAULT 'views' CHECK (metric_type IN ('views', 'frequency')),
  UNIQUE (campaign_id, brand_name, snapshot_date, metric_type)
);

-- ---- Video Phrase Summary (powers Page 9 word cloud) ----
CREATE TABLE IF NOT EXISTS video_phrase_summary (
  video_id UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  extracted_phrases TEXT[] DEFAULT '{}',
  keyword_count INTEGER DEFAULT 0,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- System Metadata (last updated timestamps) ----
CREATE TABLE IF NOT EXISTS system_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the two timestamp keys
INSERT INTO system_metadata (key, value) VALUES
  ('last_views_refresh', NULL),
  ('last_ranking_refresh', NULL),
  ('active_campaign_count', '0')
ON CONFLICT (key) DO NOTHING;

-- ---- Share Links (public snapshots) ----
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

-- ---- Insight Snapshots (AI weekly summaries) ----
CREATE TABLE IF NOT EXISTS insight_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  week_ending DATE NOT NULL,
  summary_text TEXT NOT NULL,
  key_metrics JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, week_ending)
);

-- ---- Alert Rules (competitor threshold alerts) ----
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  metric TEXT CHECK (metric IN ('sov_percent', 'view_growth', 'frequency_growth')),
  threshold NUMERIC NOT NULL,
  direction TEXT CHECK (direction IN ('above', 'below')),
  webhook_url TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Migration 003: TimescaleDB Hypertable Conversion
-- ============================================================

-- Convert view_snapshots to TimescaleDB hypertable
-- This dramatically speeds up time-range queries
DO $$
BEGIN
  -- Only convert if not already a hypertable
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables 
    WHERE hypertable_name = 'view_snapshots'
  ) THEN
    PERFORM create_hypertable(
      'view_snapshots',
      'snapshot_date',
      chunk_time_interval => INTERVAL '1 month',
      migrate_data => TRUE
    );
  END IF;
END $$;

-- Enable compression on view_snapshots
ALTER TABLE view_snapshots SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'snapshot_date DESC',
  timescaledb.compress_segmentby = 'video_id'
);

-- Auto-compress chunks older than 7 days
SELECT add_compression_policy('view_snapshots', INTERVAL '7 days', if_not_exists => TRUE);

-- Auto-drop chunks older than 90 days
SELECT add_retention_policy('view_snapshots', INTERVAL '90 days', if_not_exists => TRUE);

-- Convert sov_snapshots to hypertable as well
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables 
    WHERE hypertable_name = 'sov_snapshots'
  ) THEN
    PERFORM create_hypertable(
      'sov_snapshots',
      'snapshot_date',
      chunk_time_interval => INTERVAL '1 month',
      migrate_data => TRUE
    );
  END IF;
END $$;
