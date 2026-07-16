import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  db: { schema: 'public' },
})

// ── RPC-based SQL execution via Supabase REST API ──
// Executes raw SQL using the exec_sql stored procedure (must be created in Supabase)
// Parameters are inlined with proper escaping for security

function escapeParam(val: any): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (val instanceof Date) return `'${val.toISOString()}'`
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

function inlineParams(sql: string, params: any[]): string {
  let result = sql
  params.forEach((val, i) => {
    const placeholder = `$${i + 1}`
    if (Array.isArray(val)) {
      // For arrays, use ARRAY[] syntax
      const arrItems = val.map(v => {
        if (v === null || v === undefined) return 'NULL'
        if (typeof v === 'number') return String(v)
        return `'${String(v).replace(/'/g, "''")}'`
      })
      result = result.replace(new RegExp(`\\$${i + 1}\\b`, 'g'), `ARRAY[${arrItems.join(',')}]`)
    } else {
      result = result.replace(new RegExp(`\\$${i + 1}\\b`, 'g'), escapeParam(val))
    }
  })
  return result
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const inlined = inlineParams(sql, params)
  const trimmed = inlined.trim().toUpperCase()
  const isQuery = trimmed.startsWith('SELECT')

  if (isQuery) {
    const isCte = trimmed.startsWith('WITH')

    let wrapped: string
    if (isCte) {
      // CTEs can't be nested in subqueries. Wrap the final SELECT only.
      // Find the main SELECT after all CTE definitions (after last closing paren of CTE)
      let depth = 0
      let lastCteEnd = -1
      for (let i = 0; i < inlined.length; i++) {
        if (inlined[i] === '(') depth++
        if (inlined[i] === ')') { depth--; if (depth === 0) lastCteEnd = i }
      }
      const mainSelect = inlined.substring(lastCteEnd + 1).trim()
      const withPart = inlined.substring(0, lastCteEnd + 1)
      wrapped = `${withPart} SELECT json_agg(row_to_json(t)) FROM (${mainSelect}) t`
    } else {
      wrapped = `SELECT json_agg(row_to_json(t)) FROM (${inlined}) t`
    }

    const { data, error } = await supabase.rpc('exec_sql', { sql: wrapped })
    if (error) throw new Error(`SQL error: ${error.message}`)
    if (!data) return []
    let rows: any[]
    if (Array.isArray(data)) {
      if (data.length === 0) return []
      const first = data[0]
      // json_agg returns null for empty result sets
      if (first?.json_agg === null || first?.json_agg === undefined) return []
      if (first?.json_agg) rows = Array.isArray(first.json_agg) ? first.json_agg : [first.json_agg]
      else if (Array.isArray(first)) rows = first
      else rows = [first]
    } else if (data?.json_agg === null || data?.json_agg === undefined) {
      return []
    } else if (data?.json_agg) {
      rows = Array.isArray(data.json_agg) ? data.json_agg : [data.json_agg]
    } else if (Array.isArray(data)) {
      rows = data
    } else {
      rows = [data]
    }
    return Array.isArray(rows) ? rows.filter(Boolean) : [rows].filter(Boolean)
  }

  // DML statements (INSERT/UPDATE/DELETE): execute directly, handle RETURNING
  if (trimmed.includes('RETURNING')) {
    // Use CTE: WITH dml AS (DML... RETURNING cols) SELECT ... FROM dml
    const returningIdx = inlined.toUpperCase().lastIndexOf('RETURNING')
    const selectCols = inlined.substring(returningIdx + 9).trim()
    const baseSql = inlined.substring(0, returningIdx).trim()
    const wrapped = `WITH dml AS (${baseSql} RETURNING ${selectCols}) SELECT json_agg(row_to_json(t)) FROM dml t`
    const { data, error } = await supabase.rpc('exec_sql', { sql: wrapped })
    if (error) throw new Error(`SQL error: ${error.message}`)
    if (!data) return []
    let rows: any[]
    if (Array.isArray(data)) {
      const first = data[0]
      if (first?.json_agg) rows = first.json_agg
      else rows = data
    } else if (data?.json_agg) {
      rows = data.json_agg
    } else {
      rows = [data]
    }
    return Array.isArray(rows) ? rows.filter(Boolean) : [rows].filter(Boolean)
  }

  // DML without RETURNING: just execute
  const { error } = await supabase.rpc('exec_sql', { sql: inlined })
  if (error) throw new Error(`SQL error: ${error.message}`)
  return []
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params)
  return rows[0] ?? null
}

// ── Batch Helpers for Bulk Operations ──────────────────────────────
// These build single SQL statements for multiple rows, reducing HTTP roundtrips

function escapeVal(val: any): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (val instanceof Date) return `'${val.toISOString()}'`
  if (Array.isArray(val)) return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

/**
 * Batch UPSERT: Insert multiple rows in a single SQL statement
 * @param table - Table name
 * @param rows - Array of objects to insert
 * @param onConflict - Columns for ON CONFLICT clause (e.g., 'col1,col2')
 * @param updateColumns - Columns to update on conflict (if null, updates all except conflict cols)
 */
export async function batchUpsert(
  table: string,
  rows: Record<string, any>[],
  onConflict?: string,
  updateColumns?: string[]
): Promise<void> {
  if (rows.length === 0) return

  const cols = Object.keys(rows[0])
  const colList = cols.join(', ')

  const valueRows = rows.map(row => {
    const vals = cols.map(c => escapeVal(row[c]))
    return `(${vals.join(', ')})`
  })

  let sql = `INSERT INTO ${table} (${colList}) VALUES ${valueRows.join(', ')}`

  if (onConflict) {
    const updateCols = updateColumns || cols.filter(c => !onConflict.split(',').map(s => s.trim()).includes(c))
    if (updateCols.length > 0) {
      sql += ` ON CONFLICT (${onConflict}) DO UPDATE SET `
      sql += updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')
    } else {
      sql += ` ON CONFLICT (${onConflict}) DO NOTHING`
    }
  } else {
    sql += ' ON CONFLICT DO NOTHING'
  }

  await queryAll(sql)
}

/**
 * Batch UPSERT with composite key returning affected rows
 */
export async function batchUpsertReturning(
  table: string,
  rows: Record<string, any>[],
  onConflict: string,
  returnCols: string = '*'
): Promise<any[]> {
  if (rows.length === 0) return []

  const cols = Object.keys(rows[0])
  const colList = cols.join(', ')

  const valueRows = rows.map(row => {
    const vals = cols.map(c => escapeVal(row[c]))
    return `(${vals.join(', ')})`
  })

  const updateCols = cols.filter(c => !onConflict.split(',').map(s => s.trim()).includes(c))
  const sql = `INSERT INTO ${table} (${colList}) VALUES ${valueRows.join(', ')} ON CONFLICT (${onConflict}) DO UPDATE SET ${updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')} RETURNING ${returnCols}`

  return await queryAll(sql)
}

/**
 * Batch UPDATE: Update multiple rows with different values using a CASE expression
 * @param table - Table name
 * @param keyColumn - Column to match on (e.g., 'youtube_id')
 * @param keys - Array of key values
 * @param updateColumn - Column to update
 * @param values - Map of key → new value
 */
export async function batchUpdate(
  table: string,
  keyColumn: string,
  keys: string[],
  updateColumn: string,
  values: Map<string, any>
): Promise<void> {
  if (keys.length === 0) return

  const cases = keys
    .filter(k => values.has(k))
    .map(k => `WHEN ${keyColumn} = ${escapeVal(k)} THEN ${escapeVal(values.get(k))}`)
    .join(' ')

  if (!cases) return

  const sql = `UPDATE ${table} SET ${updateColumn} = CASE ${cases} ELSE ${updateColumn} END WHERE ${keyColumn} = ANY(${escapeVal(keys)})`
  await queryAll(sql)
}

/**
 * Batch INSERT with array unnesting (fastest for large datasets)
 * Builds a single INSERT ... SELECT from arrays
 */
export async function batchInsertFromArray(
  table: string,
  columns: string[],
  arrays: any[][]
): Promise<void> {
  if (arrays.length === 0) return

  const colList = columns.join(', ')
  const rows = arrays.map(arr => `(${arr.map(v => escapeVal(v)).join(', ')})`)
  const sql = `INSERT INTO ${table} (${colList}) VALUES ${rows.join(', ')} ON CONFLICT DO NOTHING`
  await queryAll(sql)
}

export async function getSupabase(): Promise<SupabaseClient> {
  return supabase
}

export function getSupabaseAdmin(): SupabaseClient {
  return supabase
}

export type Database = {
  public: {
    Tables: {
      campaigns: {
        Row: {
          id: string
          name: string
          category: string | null
          sub_category: string | null
          description: string | null
          status: 'active' | 'paused' | 'archived'
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          sub_category?: string | null
          description?: string | null
          status?: 'active' | 'paused' | 'archived'
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          sub_category?: string | null
          description?: string | null
          status?: 'active' | 'paused' | 'archived'
          created_at?: string
        }
      }
      campaign_brands: {
        Row: {
          id: string
          campaign_id: string
          name: string
          type: 'own' | 'competitor'
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          type?: 'own' | 'competitor'
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          type?: 'own' | 'competitor'
          created_at?: string
        }
      }
      keywords: {
        Row: {
          id: string
          campaign_id: string
          text: string
          language: string | null
          category: 'generic' | 'branded' | 'comparison'
          status: 'active' | 'paused'
          last_scraped_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          text: string
          language?: string | null
          category?: 'generic' | 'branded' | 'comparison'
          status?: 'active' | 'paused'
          last_scraped_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          text?: string
          language?: string | null
          category?: 'generic' | 'branded' | 'comparison'
          status?: 'active' | 'paused'
          last_scraped_at?: string | null
          created_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          youtube_id: string
          title: string | null
          description: string | null
          channel_name: string | null
          channel_id: string | null
          published_at: string | null
          duration: string | null
          duration_sec: number
          thumbnail_url: string | null
          tags: string[]
          is_deleted: boolean
          created_at: string
        }
        Insert: {
          id?: string
          youtube_id: string
          title?: string | null
          description?: string | null
          channel_name?: string | null
          channel_id?: string | null
          published_at?: string | null
          duration?: string | null
          duration_sec?: number
          thumbnail_url?: string | null
          tags?: string[]
          is_deleted?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          youtube_id?: string
          title?: string | null
          description?: string | null
          channel_name?: string | null
          channel_id?: string | null
          published_at?: string | null
          duration?: string | null
          duration_sec?: number
          thumbnail_url?: string | null
          tags?: string[]
          is_deleted?: boolean
          created_at?: string
        }
      }
      keyword_videos: {
        Row: {
          id: string
          keyword_id: string
          campaign_id: string
          video_id: string
          rank: number
          search_appearance_count: number
          keywords_appeared: string[]
          cross_keyword_ranks: number[]
          discovered_at: string
          last_seen_at: string
          is_our_video: boolean
          keyword_count: number
          region_code: string | null
        }
        Insert: {
          id?: string
          keyword_id: string
          campaign_id: string
          video_id: string
          rank: number
          search_appearance_count?: number
          keywords_appeared?: string[]
          cross_keyword_ranks?: number[]
          discovered_at?: string
          last_seen_at?: string
          is_our_video?: boolean
          keyword_count?: number
          region_code?: string | null
        }
        Update: {
          id?: string
          keyword_id?: string
          campaign_id?: string
          video_id?: string
          rank?: number
          search_appearance_count?: number
          keywords_appeared?: string[]
          cross_keyword_ranks?: number[]
          discovered_at?: string
          last_seen_at?: string
          is_our_video?: boolean
          keyword_count?: number
          region_code?: string | null
        }
      }
      keyword_shorts: {
        Row: {
          id: string
          keyword_id: string
          campaign_id: string
          video_id: string
          rank: number
          search_appearance_count: number
          keywords_appeared: string[]
          cross_keyword_ranks: number[]
          discovered_at: string
          last_seen_at: string
          is_our_video: boolean
          keyword_count: number
          region_code: string | null
        }
        Insert: {
          id?: string
          keyword_id: string
          campaign_id: string
          video_id: string
          rank: number
          search_appearance_count?: number
          keywords_appeared?: string[]
          cross_keyword_ranks?: number[]
          discovered_at?: string
          last_seen_at?: string
          is_our_video?: boolean
          keyword_count?: number
          region_code?: string | null
        }
        Update: {
          id?: string
          keyword_id?: string
          campaign_id?: string
          video_id?: string
          rank?: number
          search_appearance_count?: number
          keywords_appeared?: string[]
          cross_keyword_ranks?: number[]
          discovered_at?: string
          last_seen_at?: string
          is_our_video?: boolean
          keyword_count?: number
          region_code?: string | null
        }
      }
      campaign_videos: {
        Row: {
          campaign_id: string
          video_id: string
          first_seen_at: string
        }
        Insert: {
          campaign_id: string
          video_id: string
          first_seen_at?: string
        }
        Update: {
          campaign_id?: string
          video_id?: string
          first_seen_at?: string
        }
      }
      view_snapshots: {
        Row: {
          id: string
          video_id: string
          campaign_id: string
          view_count: number
          like_count: number | null
          comment_count: number | null
          daily_delta: number
          growth_percent: number
          snapshot_date: string
        }
        Insert: {
          id?: string
          video_id: string
          campaign_id: string
          view_count?: number
          like_count?: number | null
          comment_count?: number | null
          daily_delta?: number
          growth_percent?: number
          snapshot_date?: string
        }
        Update: {
          id?: string
          video_id?: string
          campaign_id?: string
          view_count?: number
          like_count?: number | null
          comment_count?: number | null
          daily_delta?: number
          growth_percent?: number
          snapshot_date?: string
        }
      }
      brand_tags: {
        Row: {
          video_id: string
          brand_name: string
          campaign_id: string
        }
        Insert: {
          video_id: string
          brand_name: string
          campaign_id: string
        }
        Update: {
          video_id?: string
          brand_name?: string
          campaign_id?: string
        }
      }
      scrape_jobs: {
        Row: {
          id: string
          campaign_id: string | null
          keyword_id: string | null
          keyword_text: string | null
          status: 'pending' | 'running' | 'completed' | 'failed'
          results_count: number
          error_msg: string | null
          api_key_used: string | null
          quota_used: number
          job_type: string
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id?: string | null
          keyword_id?: string | null
          keyword_text?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed'
          results_count?: number
          error_msg?: string | null
          api_key_used?: string | null
          quota_used?: number
          job_type?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string | null
          keyword_id?: string | null
          keyword_text?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed'
          results_count?: number
          error_msg?: string | null
          api_key_used?: string | null
          quota_used?: number
          job_type?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          label: string
          api_key: string
          bucket: number
          units_used: number
          units_limit: number
          is_active: boolean
          last_used_at: string | null
          reset_date: string
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          api_key: string
          bucket?: number
          units_used?: number
          units_limit?: number
          is_active?: boolean
          last_used_at?: string | null
          reset_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          api_key?: string
          bucket?: number
          units_used?: number
          units_limit?: number
          is_active?: boolean
          last_used_at?: string | null
          reset_date?: string
          created_at?: string
        }
      }
      system_metadata: {
        Row: {
          key: string
          value: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string | null
          updated_at?: string
        }
      }
      video_transcripts: {
        Row: {
          video_id: string
          youtube_id: string
          transcript_text: string | null
          language: string | null
          fetch_status: 'pending' | 'success' | 'no_captions' | 'failed'
          fetched_at: string
        }
        Insert: {
          video_id: string
          youtube_id: string
          transcript_text?: string | null
          language?: string | null
          fetch_status?: 'pending' | 'success' | 'no_captions' | 'failed'
          fetched_at?: string
        }
        Update: {
          video_id?: string
          youtube_id?: string
          transcript_text?: string | null
          language?: string | null
          fetch_status?: 'pending' | 'success' | 'no_captions' | 'failed'
          fetched_at?: string
        }
      }
      brand_analysis: {
        Row: {
          id: string
          video_id: string
          brand_name: string
          confidence: number
          mention_type: string
          context_quotes: string[]
          analyzed_at: string
        }
        Insert: {
          id?: string
          video_id: string
          brand_name: string
          confidence: number
          mention_type?: string
          context_quotes?: string[]
          analyzed_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          brand_name?: string
          confidence?: number
          mention_type?: string
          context_quotes?: string[]
          analyzed_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          role: 'admin' | 'brand'
          campaign_id: string | null
          brand_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          role?: 'admin' | 'brand'
          campaign_id?: string | null
          brand_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          role?: 'admin' | 'brand'
          campaign_id?: string | null
          brand_name?: string | null
          created_at?: string
        }
      }
      keyword_rank_history: {
        Row: {
          id: string
          keyword_id: string
          campaign_id: string
          video_id: string
          rank: number
          form_type: 'long' | 'short'
          week_start: string
          recorded_at: string
        }
        Insert: {
          id?: string
          keyword_id: string
          campaign_id: string
          video_id: string
          rank: number
          form_type: 'long' | 'short'
          week_start: string
          recorded_at?: string
        }
        Update: {
          id?: string
          keyword_id?: string
          campaign_id?: string
          video_id?: string
          rank?: number
          form_type?: 'long' | 'short'
          week_start?: string
          recorded_at?: string
        }
      }
      sov_snapshots: {
        Row: {
          id: string
          campaign_id: string
          brand_name: string
          snapshot_date: string
          sov_percent: number
          total_views: number
          brand_views: number
          metric_type: 'views' | 'frequency'
        }
        Insert: {
          id?: string
          campaign_id: string
          brand_name: string
          snapshot_date: string
          sov_percent: number
          total_views?: number
          brand_views?: number
          metric_type?: 'views' | 'frequency'
        }
        Update: {
          id?: string
          campaign_id?: string
          brand_name?: string
          snapshot_date?: string
          sov_percent?: number
          total_views?: number
          brand_views?: number
          metric_type?: 'views' | 'frequency'
        }
      }
      share_links: {
        Row: {
          id: string
          token: string
          campaign_id: string
          snapshot_data: Record<string, unknown>
          created_by: string | null
          expires_at: string | null
          view_count: number
          created_at: string
        }
        Insert: {
          id?: string
          token?: string
          campaign_id: string
          snapshot_data: Record<string, unknown>
          created_by?: string | null
          expires_at?: string | null
          view_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          token?: string
          campaign_id?: string
          snapshot_data?: Record<string, unknown>
          created_by?: string | null
          expires_at?: string | null
          view_count?: number
          created_at?: string
        }
      }
      insight_snapshots: {
        Row: {
          id: string
          campaign_id: string
          week_ending: string
          summary_text: string
          key_metrics: Record<string, unknown>
          generated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          week_ending: string
          summary_text: string
          key_metrics?: Record<string, unknown>
          generated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          week_ending?: string
          summary_text?: string
          key_metrics?: Record<string, unknown>
          generated_at?: string
        }
      }
      alert_rules: {
        Row: {
          id: string
          campaign_id: string
          brand_name: string
          metric: 'sov_percent' | 'view_growth' | 'frequency_growth'
          threshold: number
          direction: 'above' | 'below'
          webhook_url: string | null
          email: string | null
          is_active: boolean
          last_triggered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          brand_name: string
          metric: 'sov_percent' | 'view_growth' | 'frequency_growth'
          threshold: number
          direction: 'above' | 'below'
          webhook_url?: string | null
          email?: string | null
          is_active?: boolean
          last_triggered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          brand_name?: string
          metric?: 'sov_percent' | 'view_growth' | 'frequency_growth'
          threshold?: number
          direction?: 'above' | 'below'
          webhook_url?: string | null
          email?: string | null
          is_active?: boolean
          last_triggered_at?: string | null
          created_at?: string
        }
      }
      video_phrase_summary: {
        Row: {
          video_id: string
          extracted_phrases: string[]
          keyword_count: number
          analyzed_at: string
        }
        Insert: {
          video_id: string
          extracted_phrases?: string[]
          keyword_count?: number
          analyzed_at?: string
        }
        Update: {
          video_id?: string
          extracted_phrases?: string[]
          keyword_count?: number
          analyzed_at?: string
        }
      }
      tracked_videos: {
        Row: {
          video_id: string
          campaign_id: string
          added_at: string
        }
        Insert: {
          video_id: string
          campaign_id: string
          added_at?: string
        }
        Update: {
          video_id?: string
          campaign_id?: string
          added_at?: string
        }
      }
    }
  }
}