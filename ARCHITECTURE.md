# SOV Dashboard - Production Architecture

## Overview

This document describes the production-ready architecture for the SOV Dashboard with PostgreSQL, BullMQ background workers, and YouTube OAuth 2.0.

## Architecture Components

### 1. Database Layer (Supabase PostgreSQL)

**Why PostgreSQL:**
- TimescaleDB for time-series data (view_snapshots, sov_snapshots)
- Materialized views for pre-computed analytics
- Full ACID compliance for concurrent users
- Built-in auth and realtime subscriptions

**Key Tables:**
- `campaigns` - Campaign container
- `keywords` - Tracked search terms
- `videos` - YouTube video metadata
- `keyword_videos` / `keyword_shorts` - Rankings
- `view_snapshots` - Daily view counts (TimescaleDB hypertable)
- `brand_tags` - Brand associations
- `scrape_jobs` - Job queue
- `api_keys` - YouTube API key rotation

### 2. Job Queue (BullMQ + Redis)

**Why BullMQ:**
- Reliable background job processing
- Job retries with exponential backoff
- Rate limiting and concurrency control
- Job progress tracking
- Delayed and scheduled jobs

**Job Types:**
1. `keyword-scrape` - Individual keyword scraping
2. `daily-views` - Daily view count refresh
3. `weekly-refresh` - Weekly keyword re-scraping
4. `brand-analysis` - AI brand detection
5. `transcript-fetch` - Transcript download

**Worker Configuration:**
- Concurrency: 2 scrape workers, 1 for each other type
- Rate limiting: 100 jobs/minute for scraping
- Retries: 3 attempts with exponential backoff

### 3. YouTube OAuth 2.0

**Why OAuth over API Keys:**
- Single authentication for all requests
- Quota increase eligibility (up to 1M units/day)
- Automatic token refresh
- Better security (no static keys in code)

**Flow:**
1. User authenticates at `/api/auth/youtube`
2. Redirect to Google consent screen
3. Callback exchanges code for tokens
4. Tokens stored in `system_metadata`
5. Automatic refresh before expiry

**Quota Management:**
- OAuth quota: 10,000 units/day (default)
- Request increase to 1M units/day via Google Cloud Console
- Monitoring via `/api/quota`

## Environment Setup

### Prerequisites
1. Supabase project (free tier works)
2. Redis instance (Upstash free tier or local)
3. YouTube API credentials (OAuth 2.0)
4. Node.js 18+

### Environment Variables

```bash
# Required
API_KEY_ENCRYPTION_SECRET=your-32-char-secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key

# Redis
REDIS_URL=redis://localhost:6379

# YouTube OAuth
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

# Cron Protection
CRON_SECRET=your-cron-secret
```

## API Endpoints

### Authentication
- `GET /api/auth/youtube` - Get OAuth URL
- `GET /api/auth/youtube/callback` - OAuth callback
- `POST /api/auth/youtube` - Initiate OAuth flow

### Scraping
- `POST /api/scrape` - Queue keyword scraping
- `GET /api/scrape` - Get job status

### Quota Management
- `GET /api/quota` - Get quota status
- `POST /api/quota` - Manage keys/request increase

### Data Endpoints
- `GET /api/overview` - Dashboard KPIs
- `GET /api/keywords` - Keyword list
- `GET /api/videos/leaderboard` - Video rankings
- `GET /api/brand-growth` - Brand growth metrics
- `GET /api/sov-trend` - SOV trend data

### Cron Jobs
- `POST /api/cron?job=daily_views` - Queue daily views
- `POST /api/cron?job=weekly_refresh` - Queue weekly refresh
- `POST /api/init` - Initialize app (workers + migrations)

## Deployment

### Local Development
```bash
# Start Redis
docker run -d -p 6379:6379 redis

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Run migrations
npm run dev
# Visit /api/init?secret=your-cron-secret

# Start worker (separate terminal)
npm run worker
```

### Production (Vercel + Upstash)
1. Deploy to Vercel
2. Set up Upstash Redis
3. Configure environment variables
4. Run `/api/init` endpoint once
5. Set up cron jobs in Vercel or external scheduler

### Worker Deployment
The worker runs as a separate process:
```bash
npm run worker:prod
```

For production, consider:
- Docker container on AWS ECS/Fargate
- Kubernetes deployment
- Railway.app worker

## Quota Increase Request

### Step 1: Prepare Justification
```
Project ID: [YOUR_PROJECT_ID]
Current Quota: 10,000 units/day
Requested Quota: 1,000,000 units/day

Justification:
We are building a competitive intelligence dashboard for the Indian market
that tracks YouTube video performance across multiple brands and keywords.
Our system needs to monitor search rankings for 50+ keywords, track daily
view counts for 500+ videos, and analyze brand mentions in transcripts.
```

### Step 2: Submit via Google Cloud Console
1. Go to https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
2. Click "Increase Quotas"
3. Fill form with justification
4. Submit and wait 24-48 hours

### Step 3: Monitor Usage
```bash
# Check quota status
curl /api/quota?action=status

# Get alerts
curl /api/quota?action=alerts

# Export report
curl /api/quota?action=report
```

## Monitoring

### Health Checks
- `/api/quota?action=status` - Key utilization
- `/api/scrape` - Job queue status
- `/api/init` - System initialization

### Alerts
The system automatically alerts when:
- Any key reaches 80% quota
- Overall utilization exceeds 90%
- Estimated exhaustion within 2 days

### Logs
Worker logs include:
- Job start/completion
- Errors and retries
- Quota consumption
- API rate limits

## Migration from SQLite

### Step 1: Set Up Supabase
1. Create Supabase project
2. Run schema migrations via SQL Editor
3. Get connection credentials

### Step 2: Migrate Data
```bash
# Export from SQLite
sqlite3 data/sov.db .dump > dump.sql

# Transform for PostgreSQL
# (Need to convert SQLite syntax to PostgreSQL)

# Import to Supabase
psql $DATABASE_URL < dump.sql
```

### Step 3: Update Environment
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Step 4: Remove SQLite Dependencies
```bash
npm uninstall better-sqlite3 @types/better-sqlite3
rm -rf src/lib/db.ts data/sov.db
```

## Best Practices

### API Key Management
1. Rotate keys monthly
2. Monitor quota usage daily
3. Keep at least 5 active keys
4. Request quota increase proactively

### Job Queue
1. Set appropriate concurrency limits
2. Monitor failed jobs daily
3. Clean old jobs weekly
4. Use priority for critical jobs

### Database
1. Refresh materialized views hourly
2. Monitor query performance
3. Archive old data (90-day retention)
4. Use indexes for common queries

### Security
1. Never commit secrets
2. Use encrypted API keys
3. Validate all inputs
4. Rate limit API endpoints
