import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=')
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

// freee company details
const updates = [
  {
    name: 'フリー株式会社',
    prev_career_note: '大手SIer・事業会社バックオフィス出身が多い',
    autonomy_level: '中程度（チーム方針の範囲で裁量あり）',
    english_frequency: 'ほぼ不要（一部資料が英語）',
    avg_age: 32,
  },
]

for (const u of updates) {
  const { data: company } = await supabase
    .from('ow_companies')
    .select('id, name')
    .eq('name', u.name)
    .single()

  if (!company) {
    console.log(`⚠ Company not found: ${u.name}`)
    continue
  }

  const { error } = await supabase
    .from('ow_companies')
    .update({
      prev_career_note: u.prev_career_note,
      autonomy_level: u.autonomy_level,
      english_frequency: u.english_frequency,
      avg_age: u.avg_age,
    })
    .eq('id', company.id)

  if (error) {
    console.log(`❌ Error: ${error.message}`)
  } else {
    console.log(`✅ Updated: ${company.name}`)
  }
}
