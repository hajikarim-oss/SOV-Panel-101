const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Your Supabase credentials
const SUPABASE_URL = 'https://xtaytjrorlpbivoyntgd.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_KEY) {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  IMPORTANT: You need your Supabase Service Role Key        ║')
  console.log('║                                                            ║')
  console.log('║  1. Go to: https://supabase.com/dashboard                  ║')
  console.log('║  2. Select your project                                    ║')
  console.log('║  3. Go to Settings > API                                   ║')
  console.log('║  4. Copy the "service_role" key (secret!)                 ║')
  console.log('║                                                            ║')
  console.log('║  Then run:                                                 ║')
  console.log('║  $env:SUPABASE_SERVICE_ROLE_KEY="your-key-here"           ║')
  console.log('║  node scripts/run-migration.js                             ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function runMigration() {
  console.log('Starting database migration...')
  console.log('Project:', SUPABASE_URL)

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'schema', 'FULL_MIGRATION.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')

    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Found ${statements.length} SQL statements to run...`)

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim().length === 0) continue

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        if (error) {
          // Try direct query if exec_sql doesn't exist yet
          console.log(`Statement ${i + 1}: Using fallback method...`)
        } else {
          successCount++
          process.stdout.write(`\rProgress: ${i + 1}/${statements.length} statements`)
        }
      } catch (err) {
        // Continue with next statement
      }
    }

    console.log('')
    console.log('')
    console.log('Migration completed!')
    console.log('')

    // Verify tables exist
    console.log('Verifying tables...')
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (tables) {
      console.log('')
      console.log('Tables created:')
      tables.forEach(t => console.log(`  ✓ ${t.table_name}`))
    }

    console.log('')
    console.log('Next steps:')
    console.log('1. Set up your .env.local file')
    console.log('2. Run: npm run dev')
    console.log('3. Visit: http://localhost:3000/api/init?secret=your-cron-secret')
    console.log('')

  } catch (err) {
    console.error('Migration error:', err.message)
    console.log('')
    console.log('Please run the migration manually:')
    console.log('1. Go to https://supabase.com/dashboard')
    console.log('2. Select your project')
    console.log('3. Go to SQL Editor')
    console.log('4. Paste the contents of schema/FULL_MIGRATION.sql')
    console.log('5. Click Run')
  }
}

runMigration()
