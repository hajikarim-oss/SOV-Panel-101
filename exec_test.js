const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1 as val' });
  console.log("Raw RPC response:");
  console.log("Data:", data);
  console.log("Error:", error);
}

main().catch(console.error);
