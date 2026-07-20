-- ============================================================
-- SOV Dashboard — Migration 001: Extensions & Base Setup
-- Run this FIRST in Supabase SQL Editor
-- ============================================================

-- Enable TimescaleDB (Supabase supports this via extensions)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- EXISTING TABLES (already in your Supabase — verify before running)
-- ============================================================

-- campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- campaign_brands
CREATE TABLE IF NOT EXISTS campaign_brands (
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (campaign_id, name)
);

-- keywords
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category TEXT CHECK (category IN ('generic', 'branded', 'language', 'comparison')),
  language TEXT,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  last_scraped_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- videos
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  channel_name TEXT,
  channel_id TEXT,
  published_at TIMESTAMPTZ,
  duration TEXT,
  tags TEXT[] DEFAULT '{}',
  is_deleted BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- view_snapshots (will be converted to hypertable)
CREATE TABLE IF NOT EXISTS view_snapshots (
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count BIGINT,
  comment_count BIGINT,
  daily_delta BIGINT DEFAULT 0,
  growth_percent NUMERIC(10,4) DEFAULT 0,
  PRIMARY KEY (video_id, snapshot_date)
);

-- tracked_videos (manually added)
CREATE TABLE IF NOT EXISTS tracked_videos (
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (video_id, campaign_id)
);

-- video_transcripts
CREATE TABLE IF NOT EXISTS video_transcripts (
  video_id UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  youtube_id TEXT,
  transcript_text TEXT,
  language TEXT,
  fetch_status TEXT DEFAULT 'pending' CHECK (fetch_status IN ('pending', 'success', 'no_captions', 'failed')),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- brand_mentions
CREATE TABLE IF NOT EXISTS brand_mentions (
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  youtube_id TEXT,
  brand_name TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  mention_context TEXT[] DEFAULT '{}',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (video_id, brand_name)
);

-- scrape_jobs
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- quota_usage (API key rotation)
CREATE TABLE IF NOT EXISTS quota_usage (
  account_name TEXT PRIMARY KEY,
  api_key TEXT NOT NULL,
  units_used INTEGER DEFAULT 0,
  units_limit INTEGER DEFAULT 10000,
  reset_at DATE DEFAULT CURRENT_DATE,
  is_blocked BOOLEAN DEFAULT FALSE,
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);
