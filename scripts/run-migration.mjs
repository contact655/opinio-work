import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load env
const envContent = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=')
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]

// Read SQL file
const sqlFile = process.argv[2] || 'scripts/sql/003-favorites-consultations.sql'
const fullSql = readFileSync(resolve(__dirname, '..', sqlFile), 'utf-8')

// Split SQL into individual statements (skip empty/comment-only)
const statements = fullSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.split('\n').every(line => line.trim().startsWith('--') || line.trim() === ''))

console.log(`Found ${statements.length} SQL statements to execute.\n`)

// Execute via Supabase SQL API (pg-meta)
let success = 0
let failed = 0

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i]
  const preview = stmt.split('\n').filter(l => !l.trim().startsWith('--'))[0]?.trim().slice(0, 80) || stmt.slice(0, 80)

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({})
    })
    // PostgREST doesn't support raw SQL, use the pg-meta API instead
  } catch {}

  // Use the Supabase Management API query endpoint
  const queryRes = await fetch(`https://${projectRef}.supabase.co/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: stmt + ';' })
  })

  if (queryRes.ok) {
    console.log(`  ✅ [${i + 1}/${statements.length}] ${preview}...`)
    success++
  } else {
    // Fallback: try the SQL API endpoint
    const sqlRes = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: stmt + ';' })
    })

    if (sqlRes.ok) {
      console.log(`  ✅ [${i + 1}/${statements.length}] ${preview}...`)
      success++
    } else {
      const errText = await sqlRes.text().catch(() => queryRes.statusText)
      console.error(`  ❌ [${i + 1}/${statements.length}] ${preview}...`)
      console.error(`     ${errText.slice(0, 200)}`)
      failed++
    }
  }
}

if (failed > 0) {
  console.log(`\n${success} succeeded, ${failed} failed.`)
  console.log('\nFallback: Use the Supabase Dashboard SQL Editor to run the SQL manually:')
  console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`)
  console.log('\nSQL content:')
  console.log(fullSql)
} else {
  console.log(`\n✅ All ${success} statements executed successfully!`)
}
