import { createClient } from '@supabase/supabase-js'

// Load env from .env.local
const fs = require('fs')
const path = require('path')
const envPath = path.resolve(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const [key, ...vals] = line.split('=')
  if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

async function main() {
  for (const company of fitData) {
    // Find company by exact name
    const { data: found } = await supabase
      .from('ow_companies')
      .select('id, name')
      .eq('name', company.name)
      .maybeSingle()

    if (!found) {
      // Try partial match
      const keyword = company.name.replace('株式会社', '').trim()
      const { data: partial } = await supabase
        .from('ow_companies')
        .select('id, name')
        .ilike('name', `%${keyword}%`)
        .limit(1)
        .maybeSingle()

      if (!partial) {
        console.error(`Could not find: ${company.name}`)
        continue
      }

      const { error } = await supabase
        .from('ow_companies')
        .update({
          fit_positives: company.fit_positives,
          fit_negatives: company.fit_negatives
        })
        .eq('id', partial.id)

      if (error) console.error(`Error updating ${partial.name}:`, error)
      else console.log(`Updated: ${partial.name} (${partial.id})`)
    } else {
      const { error } = await supabase
        .from('ow_companies')
        .update({
          fit_positives: company.fit_positives,
          fit_negatives: company.fit_negatives
        })
        .eq('id', found.id)

      if (error) console.error(`Error updating ${found.name}:`, error)
      else console.log(`Updated: ${found.name} (${found.id})`)
    }
  }
}

main()
