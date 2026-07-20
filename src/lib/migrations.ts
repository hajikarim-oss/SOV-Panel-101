import { readFileSync } from 'fs'
import { join } from 'path'
import { supabase } from './supabase'

export interface Migration {
  id: string
  name: string
  sql: string
  applied_at?: string
}

export async function ensureMigrationTable(): Promise<void> {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sql TEXT NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  })

  if (error) {
    console.error('Failed to create migrations table:', error)
    throw error
  }
}

export async function getAppliedMigrations(): Promise<string[]> {
  const { data, error } = await supabase
    .from('_migrations')
    .select('id')
    .order('applied_at', { ascending: true })

  if (error) throw error
  return data?.map(m => m.id) || []
}

export async function runMigration(migration: Migration): Promise<void> {
  console.log(`Running migration: ${migration.name}`)

  const { error } = await supabase.rpc('exec_sql', {
    sql: migration.sql,
  })

  if (error) {
    console.error(`Migration ${migration.name} failed:`, error)
    throw error
  }

  await supabase.from('_migrations').insert({
    id: migration.id,
    name: migration.name,
    sql: migration.sql,
  })

  console.log(`Migration ${migration.name} applied successfully`)
}

export async function runAllMigrations(): Promise<{ applied: number; skipped: number }> {
  await ensureMigrationTable()
  const applied = await getAppliedMigrations()

  const migrations = getMigrationFiles()
  let appliedCount = 0
  let skippedCount = 0

  for (const migration of migrations) {
    if (applied.includes(migration.id)) {
      console.log(`Skipping already applied: ${migration.name}`)
      skippedCount++
      continue
    }

    try {
      await runMigration(migration)
      appliedCount++
    } catch (err) {
      console.error(`Failed to run migration ${migration.name}:`, err)
      throw err
    }
  }

  return { applied: appliedCount, skipped: skippedCount }
}

function getMigrationFiles(): Migration[] {
  const migrations: Migration[] = []

  const baseSchema = readSchemaFile('001_base_extensions.sql')
  migrations.push({
    id: '001_base',
    name: '001_base_extensions',
    sql: baseSchema,
  })

  const newTables = readSchemaFile('002_new_tables_and_timescale.sql')
  migrations.push({
    id: '002_new_tables',
    name: '002_new_tables_and_timescale',
    sql: newTables,
  })

  const indexes = readSchemaFile('003_indexes_and_materialized_views.sql')
  migrations.push({
    id: '003_indexes',
    name: '003_indexes_and_materialized_views',
    sql: indexes,
  })

  // Fix scripts: add missing columns and fix exec_sql return type
  const fixSchema = readSchemaFile('VERIFY_AND_FIX_SCHEMA.sql')
  migrations.push({
    id: '004_fix_schema',
    name: '004_verify_and_fix_schema',
    sql: fixSchema,
  })

  return migrations
}

function readSchemaFile(filename: string): string {
  const schemaDir = join(process.cwd(), 'schema')
  const filePath = join(schemaDir, filename)
  return readFileSync(filePath, 'utf-8')
}

export async function execSql(sql: string): Promise<void> {
  const { error } = await supabase.rpc('exec_sql', { sql })
  if (error) throw error
}

export async function refreshMaterializedViews(): Promise<void> {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      REFRESH MATERIALIZED VIEW CONCURRENTLY brand_sov_mv;
      REFRESH MATERIALIZED VIEW CONCURRENTLY brand_freq_sov_mv;
      REFRESH MATERIALIZED VIEW CONCURRENTLY channel_rank_mv;
    `,
  })

  if (error) {
    console.error('Failed to refresh materialized views:', error)
    throw error
  }
}

export async function resetDailyQuotas(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase
    .from('api_keys')
    .update({
      units_used: 0,
      reset_date: today,
    })
    .lt('reset_date', today)
    .eq('is_active', true)

  if (error) throw error
}

export async function getSystemMetadata(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('system_metadata')
    .select('value')
    .eq('key', key)
    .single()

  if (error) return null
  return data?.value ?? null
}

export async function setSystemMetadata(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('system_metadata')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) throw error
}
