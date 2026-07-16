import { google, sheets_v4 } from 'googleapis'
import { queryAll } from './supabase'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

function getSheetsClient(): sheets_v4.Sheets {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  })
  return google.sheets({ version: 'v4', auth })
}

export interface SyncResult {
  spreadsheetId: string
  sheetsUpdated: string[]
  rowsWritten: number
  timestamp: string
}

async function ensureSpreadsheet(sheets: sheets_v4.Sheets, title: string): Promise<string> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (spreadsheetId) return spreadsheetId

  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: 'Campaigns' } },
        { properties: { title: 'Keywords' } },
        { properties: { title: 'Videos' } },
        { properties: { title: 'Brand Tags' } },
        { properties: { title: 'SOV Daily' } },
        { properties: { title: 'Rankings' } },
        { properties: { title: 'Brand Analysis' } },
        { properties: { title: 'Quota Usage' } },
        { properties: { title: 'Sync Log' } },
      ],
    },
  })
  return res.data.spreadsheetId!
}

async function clearAndWrite(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null)[][]
): Promise<number> {
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A:ZZ`,
    })
  } catch {
    // Sheet might not exist yet — add it
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    })
  }

  if (rows.length === 0) return 0

  const values = [headers, ...rows]
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  })

  return rows.length
}

export async function syncAllDataToSheets(): Promise<SyncResult> {
  const sheets = getSheetsClient()
  const spreadsheetId = await ensureSpreadsheet(sheets, 'SOV Dashboard Export')
  const sheetsUpdated: string[] = []
  let totalRows = 0

  // 1. Campaigns
  const campaigns = await queryAll<any>(
    `SELECT id, name, category, sub_category, description, status, created_at FROM campaigns ORDER BY created_at DESC`
  )
  totalRows += await clearAndWrite(sheets, spreadsheetId, 'Campaigns',
    ['ID', 'Name', 'Category', 'Sub-Category', 'Description', 'Status', 'Created At'],
    campaigns.map(c => [c.id, c.name, c.category, c.sub_category, c.description, c.status, fmt(c.created_at)])
  )
  sheetsUpdated.push('Campaigns')

  // 2. Keywords
  const keywords = await queryAll<any>(
    `SELECT k.id, k.text, k.language, k.type, k.status, k.last_scraped_at, k.created_at,
            c.name as campaign_name
     FROM keywords k
     LEFT JOIN campaigns c ON c.id = k.campaign_id
     ORDER BY k.created_at DESC`
  )
  totalRows += await clearAndWrite(sheets, spreadsheetId, 'Keywords',
    ['ID', 'Text', 'Language', 'Type', 'Status', 'Last Scraped', 'Created At', 'Campaign'],
    keywords.map(k => [k.id, k.text, k.language, k.type, k.status, fmt(k.last_scraped_at), fmt(k.created_at), k.campaign_name])
  )
  sheetsUpdated.push('Keywords')

  // 3. Videos (top 5000 by view count)
  const videos = await queryAll<any>(
    `SELECT youtube_id, title, channel_name, channel_id, view_count, like_count, comment_count,
            published_at, duration, duration_sec, tags, is_deleted, created_at
     FROM videos
     WHERE is_deleted = FALSE
     ORDER BY view_count DESC
     LIMIT 5000`
  )
  totalRows += await clearAndWrite(sheets, spreadsheetId, 'Videos',
    ['YouTube ID', 'Title', 'Channel', 'Channel ID', 'Views', 'Likes', 'Comments',
     'Published', 'Duration', 'Duration (s)', 'Tags', 'Deleted', 'Created At'],
    videos.map(v => [
      v.youtube_id, v.title, v.channel_name, v.channel_id,
      v.view_count, v.like_count || 0, v.comment_count || 0,
      fmt(v.published_at), v.duration, v.duration_sec,
      Array.isArray(v.tags) ? v.tags.join(', ') : (v.tags || ''),
      v.is_deleted, fmt(v.created_at)
    ])
  )
  sheetsUpdated.push('Videos')

  // 4. Brand Tags
  const brandTags = await queryAll<any>(
    `SELECT bt.brand_name, v.youtube_id, v.title, v.view_count, c.name as campaign_name
     FROM brand_tags bt
     INNER JOIN videos v ON v.id = bt.video_id
     LEFT JOIN campaigns c ON c.id = bt.campaign_id
     ORDER BY v.view_count DESC`
  )
  totalRows += await clearAndWrite(sheets, spreadsheetId, 'Brand Tags',
    ['Brand', 'YouTube ID', 'Title', 'Views', 'Campaign'],
    brandTags.map(bt => [bt.brand_name, bt.youtube_id, bt.title, bt.view_count, bt.campaign_name])
  )
  sheetsUpdated.push('Brand Tags')

  // 5. SOV Daily (last 30 days)
  const sovDaily = await queryAll<any>(
    `SELECT vs.snapshot_date, c.name as campaign_name,
            SUM(vs.view_count) as total_views,
            COUNT(DISTINCT v.id) as video_count
     FROM view_snapshots vs
     INNER JOIN videos v ON v.id = vs.video_id
     LEFT JOIN campaigns c ON c.id = vs.campaign_id
     WHERE vs.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY vs.snapshot_date, c.name
     ORDER BY vs.snapshot_date DESC`
  )
  totalRows += await clearAndWrite(sheets, spreadsheetId, 'SOV Daily',
    ['Date', 'Campaign', 'Total Views', 'Video Count'],
    sovDaily.map(s => [s.snapshot_date, s.campaign_name, s.total_views, s.video_count])
  )
  sheetsUpdated.push('SOV Daily')

  // 6. Rankings (current keyword-video rankings)
  const rankings = await queryAll<any>(
    `SELECT k.text as keyword_text, kv.rank, v.youtube_id, v.title, v.view_count,
            kv.discovered_at, kv.last_seen_at, c.name as campaign_name
     FROM keyword_videos kv
     INNER JOIN keywords k ON k.id = kv.keyword_id
     INNER JOIN videos v ON v.id = kv.video_id
     LEFT JOIN campaigns c ON c.id = kv.campaign_id
     ORDER BY kv.rank ASC
     LIMIT 5000`
  )
  totalRows += await clearAndWrite(sheets, spreadsheetId, 'Rankings',
    ['Keyword', 'Rank', 'YouTube ID', 'Title', 'Views', 'Discovered', 'Last Seen', 'Campaign'],
    rankings.map(r => [r.keyword_text, r.rank, r.youtube_id, r.title, r.view_count, fmt(r.discovered_at), fmt(r.last_seen_at), r.campaign_name])
  )
  sheetsUpdated.push('Rankings')

  // 7. Brand Analysis
  const brandAnalysis = await queryAll<any>(
    `SELECT ba.brand_name, ba.confidence, ba.mention_type, ba.context_quotes,
            v.youtube_id, v.title, v.view_count, ba.analyzed_at
     FROM brand_analysis ba
     INNER JOIN videos v ON v.id = ba.video_id
     ORDER BY ba.confidence DESC`
  )
  totalRows += await clearAndWrite(sheets, spreadsheetId, 'Brand Analysis',
    ['Brand', 'Confidence', 'Mention Type', 'Context Quotes', 'YouTube ID', 'Title', 'Views', 'Analyzed At'],
    brandAnalysis.map(ba => [
      ba.brand_name, ba.confidence, ba.mention_type,
      Array.isArray(ba.context_quotes) ? ba.context_quotes.join(' | ') : (ba.context_quotes || ''),
      ba.youtube_id, ba.title, ba.view_count, fmt(ba.analyzed_at)
    ])
  )
  sheetsUpdated.push('Brand Analysis')

  // 8. Quota Usage
  const quotaData = await queryAll<any>(
    `SELECT label, bucket, units_used, units_limit, is_active, last_used_at, reset_date
     FROM api_keys ORDER BY bucket, label`
  )
  totalRows += await clearAndWrite(sheets, spreadsheetId, 'Quota Usage',
    ['Label', 'Bucket', 'Units Used', 'Units Limit', 'Active', 'Last Used', 'Reset Date'],
    quotaData.map(q => [q.label, q.bucket, q.units_used, q.units_limit, q.is_active ? 'Yes' : 'No', fmt(q.last_used_at), q.reset_date])
  )
  sheetsUpdated.push('Quota Usage')

  // 9. Sync Log entry
  const timestamp = new Date().toISOString()
  const existingLog = await queryAll<any>(
    `SELECT * FROM system_metadata WHERE key = 'sheets_sync_log' ORDER BY updated_at DESC LIMIT 1`
  )
  const logEntry = {
    timestamp,
    sheets: sheetsUpdated.join(', '),
    total_rows: totalRows,
  }
  await queryAll(
    `INSERT INTO system_metadata (key, value, updated_at) VALUES ('sheets_sync_log', $1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(logEntry), timestamp]
  )

  return { spreadsheetId, sheetsUpdated, rowsWritten: totalRows, timestamp }
}

function fmt(val: any): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString()
  return String(val)
}
