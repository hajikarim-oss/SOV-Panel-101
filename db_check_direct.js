const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

let databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  console.error("No DATABASE_URL found in .env.local");
  process.exit(1);
}

// Replace IPv6-only hostname with IPv4 pooler hostname
databaseUrl = databaseUrl.replace('db.xtaytjrorlpbivoyntgd.supabase.co', 'aws-0-ap-south-1.pooler.supabase.com');

async function main() {
  console.log("Connecting directly to PostgreSQL (IPv4 Pooler) at:", databaseUrl.split('@')[1]);
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log("Connected successfully!");

  // Helper function to query
  const query = async (sql, params = []) => {
    const res = await client.query(sql, params);
    return res.rows;
  };

  // 1. Check migrations table
  try {
    const migrations = await query("SELECT id, name, applied_at FROM _migrations ORDER BY applied_at ASC");
    console.log("\nApplied Migrations:");
    console.table(migrations);
  } catch (err) {
    console.log("\nFailed to fetch migrations:", err.message);
  }

  // 2. Check table row counts
  try {
    const counts = await query(`
      SELECT 
        (SELECT COUNT(*) FROM campaigns) as campaigns_count,
        (SELECT COUNT(*) FROM keywords) as keywords_count,
        (SELECT COUNT(*) FROM videos) as videos_count,
        (SELECT COUNT(*) FROM campaign_videos) as campaign_videos_count,
        (SELECT COUNT(*) FROM view_snapshots) as view_snapshots_count
    `);
    console.log("\nTable Row Counts:");
    console.table(counts);
  } catch (err) {
    console.log("\nFailed to fetch table counts:", err.message);
  }

  // 3. Check view_snapshots indexes
  try {
    const indexes = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'view_snapshots'
    `);
    console.log("\nview_snapshots Indexes:");
    console.table(indexes);
  } catch (err) {
    console.log("\nFailed to fetch indexes:", err.message);
  }

  // 4. Check if pg_cron extension is installed and get jobs
  try {
    const extensions = await query("SELECT extname FROM pg_extension WHERE extname = 'cron'");
    if (extensions && extensions.length > 0) {
      console.log("\npg_cron extension is installed.");
      try {
        const jobs = await query("SELECT jobid, schedule, command, database, username, active FROM cron.job");
        console.log("Existing pg_cron jobs:");
        console.table(jobs);
      } catch (err) {
        console.log("Failed to query cron.job table (permissions or schema cron doesn't exist):", err.message);
      }
    } else {
      console.log("\npg_cron extension is NOT installed in this database.");
    }
  } catch (err) {
    console.log("\nFailed to check pg_cron extension:", err.message);
  }

  // 5. Check materialized views
  try {
    const matViews = await query(`
      SELECT schemaname, matviewname 
      FROM pg_matviews
    `);
    console.log("\nMaterialized Views:");
    console.table(matViews);
  } catch (err) {
    console.log("\nFailed to check materialized views:", err.message);
  }

  await client.end();
}

main().catch(async (err) => {
  console.error("Connection error:", err.message);
});
