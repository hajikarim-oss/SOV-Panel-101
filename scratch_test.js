const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.\-_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.replace(/\\n/g, '\n');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function execSql(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    throw error;
  }
  return data;
}

async function main() {
  console.log("Starting migrations runner...");

  // 1. Ensure migrations table
  console.log("Ensuring _migrations table exists...");
  await execSql(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sql TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const appliedList = [];
  try {
    const rows = await execSql("SELECT id FROM _migrations");
    if (rows) {
      rows.forEach(r => appliedList.push(r.id));
    }
  } catch {}
  console.log("Currently applied migrations in DB:", appliedList);

  const migrationFiles = [
    { id: '001_base', name: '001_base_extensions.sql' },
    { id: '002_new_tables', name: '002_new_tables_and_timescale.sql' },
    { id: '003_indexes', name: '003_indexes_and_materialized_views.sql' },
    { id: '004_performance_indexes', name: '004_performance_indexes.sql' }
  ];

  for (const m of migrationFiles) {
    if (appliedList.includes(m.id)) {
      console.log(`Skipping migration ${m.name} (already applied)`);
      continue;
    }
    console.log(`Reading migration file: ${m.name}...`);
    const sqlPath = path.join(__dirname, 'schema', m.name);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log(`Executing migration ${m.name}...`);
    try {
      // Split the SQL commands or run the full script
      // Note: we can try running the full script first
      await execSql(sql);
      console.log(`Migration ${m.name} executed successfully.`);

      // Log to migrations table
      const escapedSql = sql.replace(/'/g, "''");
      await execSql(`
        INSERT INTO _migrations (id, name, sql)
        VALUES ('${m.id}', '${m.name}', '${escapedSql}')
        ON CONFLICT (id) DO NOTHING;
      `);
    } catch (err) {
      console.error(`Migration ${m.name} failed:`, err.message);
      console.log("Attempting to run statement-by-statement for statements...");
    }
  }

  // Force a materialized view refresh
  console.log("Refreshing materialized views...");
  try {
    await execSql("REFRESH MATERIALIZED VIEW brand_sov_mv;");
    await execSql("REFRESH MATERIALIZED VIEW brand_freq_sov_mv;");
    await execSql("REFRESH MATERIALIZED VIEW channel_rank_mv;");
    console.log("Materialized views refreshed successfully!");
  } catch (err) {
    console.error("Materialized view refresh failed:", err.message);
  }
}

main().catch(console.error);
