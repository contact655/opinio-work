import pg from 'pg'
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

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

// Read SQL file
const sqlFile = process.argv[2] || 'scripts/sql/003-favorites-consultations.sql'
const fullSql = readFileSync(resolve(__dirname, '..', sqlFile), 'utf-8')

// Connect via Supabase direct connection using service role JWT as password
// Supabase accepts the service_role JWT as the password for the postgres user via Supavisor
const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: serviceKey,
  ssl: { rejectUnauthorized: false }
})

try {
  console.log('Connecting to database...')
  await client.connect()
  console.log('Connected!\n')

  console.log('Executing migration SQL...')
  await client.query(fullSql)
  console.log('\n✅ Migration executed successfully!')
} catch (err) {
  console.error('❌ Error:', err.message)

  // If direct connection fails, try pooler connection
  console.log('\nTrying pooler connection...')
  const poolerClient = new pg.Client({
    host: `aws-0-ap-northeast-1.pooler.supabase.com`,
    port: 5432,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password: serviceKey,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await poolerClient.connect()
    console.log('Connected via pooler!\n')
    await poolerClient.query(fullSql)
    console.log('\n✅ Migration executed successfully via pooler!')
    await poolerClient.end()
  } catch (err2) {
    console.error('❌ Pooler also failed:', err2.message)
    console.log('\n=== Manual execution required ===')
    console.log(`Please run the SQL in Supabase Dashboard SQL Editor:`)
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`)
  }
} finally {
  try { await client.end() } catch {}
}
