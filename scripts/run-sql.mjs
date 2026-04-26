import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=')
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

// Read SQL
const sqlFile = process.argv[2] || 'scripts/sql/003-favorites-consultations.sql'
const fullSql = readFileSync(resolve(__dirname, '..', sqlFile), 'utf-8')

// Step 1: Create exec_sql function via PostgREST (using a trick with pg_catalog)
// This won't work. Instead, try the Supabase HTTP SQL endpoint that some versions support.

// Try multiple endpoints that Supabase may expose
const endpoints = [
  // pg-meta SQL endpoint (available on some Supabase versions)
  { url: `${SUPABASE_URL}/pg/query`, body: { query: fullSql } },
  // Alternative pg-meta endpoint
  { url: `${SUPABASE_URL}/pg/sql`, body: { query: fullSql } },
  // Database Functions endpoint
  { url: `${SUPABASE_URL}/rest/v1/rpc/exec_sql`, body: { sql: fullSql } },
  { url: `${SUPABASE_URL}/rest/v1/rpc/exec_sql`, body: { query: fullSql } },
]

let success = false

for (const ep of endpoints) {
  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'X-Connection-Encrypted': '1',
      },
      body: JSON.stringify(ep.body),
    })

    if (res.ok) {
      const data = await res.text()
      console.log(`✅ Success via ${ep.url}`)
      console.log(data.slice(0, 200))
      success = true
      break
    } else {
      const errText = await res.text()
      console.log(`❌ ${ep.url}: ${res.status} ${errText.slice(0, 100)}`)
    }
  } catch (err) {
    console.log(`❌ ${ep.url}: ${err.message}`)
  }
}

if (!success) {
  console.log('\n--- All API endpoints failed. Trying individual DDL via workaround... ---\n')

  // Workaround: Use the Supabase client to create tables by inserting/selecting
  // This won't work for DDL. Let's try using pg module with connection pooler

  // Try connection via Supabase's built-in pg-bouncer with service role JWT
  const pg = await import('pg').then(m => m.default).catch(() => null)

  if (!pg) {
    console.log('pg module not available')
    process.exit(1)
  }

  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]

  // Connection attempts with different configurations
  const configs = [
    {
      label: 'Direct (port 5432)',
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password: SERVICE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
    {
      label: 'Pooler session mode (port 5432)',
      host: `aws-0-ap-northeast-1.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${projectRef}`,
      password: SERVICE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
    {
      label: 'Pooler transaction mode (port 6543)',
      host: `aws-0-ap-northeast-1.pooler.supabase.com`,
      port: 6543,
      user: `postgres.${projectRef}`,
      password: SERVICE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
    {
      label: 'Direct IPv4 (port 5432)',
      host: `${projectRef}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password: SERVICE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
  ]

  for (const config of configs) {
    console.log(`Trying: ${config.label}...`)
    const client = new pg.Client(config)
    try {
      await client.connect()
      console.log(`  Connected! Executing SQL...`)
      await client.query(fullSql)
      console.log(`  ✅ Migration executed successfully!`)
      await client.end()
      success = true
      break
    } catch (err) {
      console.log(`  ❌ ${err.message.slice(0, 120)}`)
      try { await client.end() } catch {}
    }
  }
}

if (!success) {
  console.log('\n=== All methods failed ===')
  console.log('Please run the SQL manually in Supabase Dashboard:')
  console.log('https://supabase.com/dashboard/project/xtutnecqeamftygufxco/sql/new')
  console.log('\nSQL to execute:')
  console.log(fullSql)
}
