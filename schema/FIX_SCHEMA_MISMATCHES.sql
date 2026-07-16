-- Fix schema mismatches between code and database
-- Run this in Supabase SQL Editor

-- 1. Add 'type' column to keywords (code uses 'type', schema has 'category')
DO $$ BEGIN
  ALTER TABLE keywords ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'generic';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Ensure videos has view_count, like_count, comment_count (may already exist from previous ALTER)
DO $$ BEGIN
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS like_count BIGINT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS comment_count BIGINT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Add unique constraint on brand_tags if not exists
DO $$ BEGIN
  ALTER TABLE brand_tags ADD CONSTRAINT brand_tags_video_brand_campaign_unique UNIQUE (video_id, brand_name, campaign_id);
EXCEPTION WHEN duplicate_table OR undefined_object THEN NULL;
END $$;

-- 4. Ensure users has unique email constraint
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
EXCEPTION WHEN duplicate_table OR undefined_object THEN NULL;
END $$;

-- 5. Add unique constraint on keywords (campaign_id, text) if not exists
DO $$ BEGIN
  ALTER TABLE keywords ADD CONSTRAINT keywords_campaign_text_unique UNIQUE (campaign_id, text);
EXCEPTION WHEN duplicate_table OR undefined_object THEN NULL;
END $$;

-- 6. Verify
SELECT 'Schema fixes applied successfully!' as status;
