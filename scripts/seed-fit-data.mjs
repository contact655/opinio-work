import { createClient } from '@supabase/supabase-js'
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const fitData = [
  {
    name: '株式会社LayerX',
    fit_positives: [
      '営業・CS経験者がエンタープライズ領域で即戦力になれる',
      'バクラクの市場拡大フェーズで成果が出やすく年収アップしやすい',
      'フルリモート×フラットな組織で自律的に動きたい人に合う'
    ],
    fit_negatives: [
      'スタートアップのため業務プロセスが整備途上、自分で作る姿勢が必要',
      '社員数100名以下でマネージャー職のポストがまだ少ない',
      '英語ドキュメントを読む機会があり、英語アレルギーがあると辛い'
    ]
  },
  {
    name: 'Salesforce Japan株式会社',
    fit_positives: [
      '外資SaaS最高峰のセールス・CS手法を体系的に学べる',
      '年収水準が高く800〜1400万レンジでオファーが出やすい',
      'Salesforce出身というブランドがその後のキャリアに一生使える'
    ],
    fit_negatives: [
      'クォーター制の数字管理が厳しくプレッシャーに弱い人には辛い',
      '大企業のため意思決定が遅くスピード感を求める人には合わない',
      '英語必須（グローバルMTG・資料）で一定の英語力が求められる'
    ]
  }
]

for (const company of fitData) {
  // Find company
  let { data: found } = await supabase
    .from('ow_companies')
    .select('id, name')
    .eq('name', company.name)
    .maybeSingle()

  if (!found) {
    const keyword = company.name.replace('株式会社', '').trim()
    const { data: partial } = await supabase
      .from('ow_companies')
      .select('id, name')
      .ilike('name', `%${keyword}%`)
      .limit(1)
      .maybeSingle()
    found = partial
  }

  if (!found) {
    console.error(`Not found: ${company.name}`)
    continue
  }

  console.log(`Found: ${found.name} (${found.id})`)

  const { error } = await supabase
    .from('ow_companies')
    .update({
      fit_positives: company.fit_positives,
      fit_negatives: company.fit_negatives
    })
    .eq('id', found.id)

  if (error) console.error(`Error updating ${found.name}:`, error)
  else console.log(`Updated: ${found.name}`)
}
