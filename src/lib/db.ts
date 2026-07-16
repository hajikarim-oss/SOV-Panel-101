import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// ── Database file stored inside project root/data/ ──────────────────
const DATA_DIR = path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'sov.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  initSchema(_db)
  return _db
}

// ── Schema ─────────────────────────────────────────────────────────
function initSchema(db: Database.Database) {
  db.exec(`
    -- ── Campaigns ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS campaigns (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name        TEXT NOT NULL UNIQUE,
      category    TEXT DEFAULT '',
      sub_category TEXT DEFAULT '',
      description TEXT DEFAULT '',
      status      TEXT DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- ── Campaign Brands ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS campaign_brands (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      type        TEXT DEFAULT 'competitor' CHECK(type IN ('own','competitor')),
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(campaign_id, name)
    );

    -- ── Keywords ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS keywords (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      text            TEXT NOT NULL,
      language        TEXT DEFAULT 'en',
      type            TEXT DEFAULT 'generic' CHECK(type IN ('generic','branded','comparison')),
      status          TEXT DEFAULT 'active' CHECK(status IN ('active','paused')),
      last_scraped_at TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(campaign_id, text)
    );

    -- ── API Keys ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS api_keys (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      label        TEXT NOT NULL,
      api_key      TEXT NOT NULL UNIQUE,
      bucket       INTEGER DEFAULT 1 CHECK(bucket IN (1,2)),
      units_used   INTEGER DEFAULT 0,
      units_limit  INTEGER DEFAULT 10000,
      is_active    BOOLEAN DEFAULT 1,
      last_used_at TEXT,
      reset_date   TEXT DEFAULT (date('now')),
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- ── Videos ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS videos (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      youtube_id   TEXT NOT NULL UNIQUE,
      title        TEXT,
      channel_name TEXT,
      channel_id   TEXT,
      view_count   INTEGER DEFAULT 0,
      published_at TEXT,
      duration     TEXT, -- ISO 8601 duration string (e.g. PT5M12S)
      duration_sec INTEGER DEFAULT 0, -- Duration in seconds
      thumbnail_url TEXT,
      tags         TEXT DEFAULT '[]', -- JSON stringified array of brand tags
      is_deleted   BOOLEAN DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- ── Keyword Videos (Long-Form rank 1-10) ────────────────────────
    CREATE TABLE IF NOT EXISTS keyword_videos (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      keyword_id   TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
      campaign_id  TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      video_id     TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      rank         INTEGER NOT NULL CHECK(rank >= 1 AND rank <= 10),
      scraped_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(keyword_id, video_id, scraped_at),
      UNIQUE(keyword_id, rank, scraped_at)
    );

    -- ── Keyword Shorts (Short-Form/Shorts rank 1-10) ────────────────
    CREATE TABLE IF NOT EXISTS keyword_shorts (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      keyword_id   TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
      campaign_id  TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      video_id     TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      rank         INTEGER NOT NULL CHECK(rank >= 1 AND rank <= 10),
      scraped_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(keyword_id, video_id, scraped_at),
      UNIQUE(keyword_id, rank, scraped_at)
    );

    -- ── Scrape Jobs ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS scrape_jobs (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      campaign_id  TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
      keyword_id   TEXT REFERENCES keywords(id) ON DELETE CASCADE,
      keyword_text TEXT,
      status       TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
      results_count INTEGER DEFAULT 0,
      error_msg    TEXT,
      api_key_used TEXT,
      started_at   TEXT,
      completed_at TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- ── View Snapshots ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS view_snapshots (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      video_id      TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      view_count    INTEGER DEFAULT 0,
      snapshot_date TEXT DEFAULT (date('now')),
      UNIQUE(video_id, campaign_id, snapshot_date)
    );

    -- ── Brand Tags ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS brand_tags (
      video_id    TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      brand_name  TEXT NOT NULL,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      PRIMARY KEY(video_id, brand_name, campaign_id)
    );

    -- ── Campaign Video Pool (all 50 search results per keyword) ──
    CREATE TABLE IF NOT EXISTS campaign_videos (
      campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      video_id      TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      first_seen_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(campaign_id, video_id)
    );

    -- ── Rank history for week-over-week dropped detection ────────
    CREATE TABLE IF NOT EXISTS keyword_rank_history (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      keyword_id  TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      video_id    TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      rank        INTEGER NOT NULL,
      form_type   TEXT NOT NULL CHECK(form_type IN ('long','short')),
      week_start  TEXT NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now')),
      UNIQUE(keyword_id, video_id, form_type, week_start)
    );

    -- ── System metadata (separate refresh timestamps) ────────────
    CREATE TABLE IF NOT EXISTS system_metadata (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ── Video Transcripts (AI analysis) ─────────────────────────
    CREATE TABLE IF NOT EXISTS video_transcripts (
      video_id       TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
      transcript_text TEXT,
      language        TEXT DEFAULT 'en',
      fetched_at      TEXT DEFAULT (datetime('now'))
    );

    -- ── Brand Analysis (AI-detected brand mentions) ─────────────
    CREATE TABLE IF NOT EXISTS brand_analysis (
      id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      video_id       TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      brand_name     TEXT NOT NULL,
      confidence     REAL DEFAULT 0,
      mention_type   TEXT DEFAULT 'mentioned',
      context_quotes TEXT DEFAULT '[]',
      analyzed_at    TEXT DEFAULT (datetime('now'))
    );

    -- ── Users (Auth system) ───────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT DEFAULT 'brand' CHECK(role IN ('admin','brand')),
      campaign_id   TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
      brand_name    TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `)
  const migrations = [
    `ALTER TABLE campaigns ADD COLUMN sub_category TEXT DEFAULT '';`,
    `ALTER TABLE videos ADD COLUMN duration TEXT;`,
    `ALTER TABLE videos ADD COLUMN duration_sec INTEGER DEFAULT 0;`,
    `ALTER TABLE videos ADD COLUMN description TEXT DEFAULT '';`,
    `ALTER TABLE scrape_jobs ADD COLUMN job_type TEXT DEFAULT 'keyword_scrape';`,
    `ALTER TABLE scrape_jobs ADD COLUMN quota_used INTEGER DEFAULT 0;`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column exists */ }
  }
}
