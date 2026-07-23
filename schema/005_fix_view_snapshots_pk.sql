-- Fix view_snapshots primary key to include campaign_id
-- The original 001_base_extensions.sql had PRIMARY KEY (video_id, snapshot_date)
-- which prevents per-campaign snapshots for videos in multiple campaigns.
-- FULL_MIGRATION.sql has the correct: PRIMARY KEY (video_id, campaign_id, snapshot_date)

-- Step 1: Drop the old PK
ALTER TABLE view_snapshots DROP CONSTRAINT IF EXISTS view_snapshots_pkey;

-- Step 2: Drop any TimescaleDB hypertable dependencies first if needed
-- (TimescaleDB requires dropping and recreating the hypertable for PK changes)
-- If using TimescaleDB, run this instead:
--   SELECT detach_hypertable('view_snapshots');
--   ALTER TABLE view_snapshots DROP CONSTRAINT view_snapshots_pkey;
--   SELECT attach_hypertable('view_snapshots', 'snapshot_date');
-- For plain Postgres, the simple ALTER works.

-- Step 3: Add the new PK
ALTER TABLE view_snapshots ADD PRIMARY KEY (video_id, campaign_id, snapshot_date);
