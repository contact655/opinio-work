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

// Use Supabase SQL endpoint (PostgREST doesn't support DDL, but we can use the pg endpoint)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

// Extract project ref from URL
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]

const sql = `
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS fit_positives jsonb,
  ADD COLUMN IF NOT EXISTS fit_negatives jsonb,
  ADD COLUMN IF NOT EXISTS prev_career_note text,
  ADD COLUMN IF NOT EXISTS english_frequency text,
  ADD COLUMN IF NOT EXISTS autonomy_level text,
  ADD COLUMN IF NOT EXISTS casual_interview_url text;
`

// Try via the Supabase Management API v1
const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  },
  body: JSON.stringify({ sql })
})

if (!res.ok) {
  const text = await res.text()
  console.log('exec_sql RPC not available:', text)
  console.log('')
  console.log('Please run the following SQL manually in Supabase Dashboard SQL Editor:')
  console.log('https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
  console.log('')
  console.log(sql)
} else {
  console.log('Columns added successfully!')
}
