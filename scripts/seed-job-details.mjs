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

const jobDetails = [
  {
    company: 'Ubie株式会社',
    title: 'フィールドセールス',
    description: `AI問診エンジン「ユビー」を医療機関・製薬企業に提案するフィールドセールスポジションです。

主な業務内容:
・病院・クリニックへの新規開拓営業（週3〜4件の訪問）
・製薬企業との大型アライアンス交渉
・導入後のオンボーディング支援（CSチームと連携）
・プロダクトフィードバックの社内共有`,
    requirements: `・法人向け営業経験3年以上（業界不問）
・医療・ヘルスケアへの興味・関心
・自律的に動ける方（KPIは自分で設定）
・スタートアップのスピード感に適応できる方
・歓迎: SaaS営業経験、医療業界経験`,
    agent_comment: '今最も採用意欲が高いポジション。カジュアル面談から始められ、選考は2回で完結します。'
  },
  {
    company: 'Salesforce Japan株式会社',
    title: 'カスタマーサクセスマネージャー',
    description: `Fortune 500企業を中心としたエンタープライズ顧客のCRM活用を支援するCSMポジションです。

主な業務内容:
・担当顧客（10〜15社）のオンボーディングから活用推進まで一貫担当
・QBR（四半期レビュー）の実施と更新・拡大提案
・プロフェッショナルサービスチームとの連携
・社内のベストプラクティス共有・ナレッジ構築`,
    requirements: `・BtoB SaaSのCS/営業経験2年以上
・エンタープライズ企業との折衝経験
・英語力（TOEIC 700点以上推奨、日常会話レベル）
・CRM/SFAツールの実務経験
・歓迎: Salesforce製品の知識・資格`,
    agent_comment: 'Salesforce CSMは転職市場で最も評価される経歴のひとつ。年収800万〜スタートが現実的です。'
  },
  {
    company: '株式会社LayerX',
    title: 'フィールドセールス',
    description: `経費精算・請求書処理SaaS「バクラク」シリーズを中堅・大企業に提案するフィールドセールスです。

主な業務内容:
・インバウンドリードへの商談対応（月30〜40件）
・エンタープライズ企業への新規開拓
・提案書・契約書作成から受注まで一気通貫
・CSチームへの引き継ぎ・連携`,
    requirements: `・法人向けSaaS営業経験2年以上
・エンタープライズ〜SMBの幅広い顧客対応経験
・数字へのこだわりと達成意欲
・リモート環境でも自律的に動ける方
・歓迎: FinTech・バックオフィス領域の知識`,
    agent_comment: 'バクラクは今最も勢いのあるSaaSのひとつ。成長フェーズで早期にリーダーポジションを狙えます。'
  },
  {
    company: 'HubSpot Japan株式会社',
    title: 'インバウンドセールス',
    description: `インバウンドマーケティングSaaS「HubSpot」の日本市場向けセールスポジションです。

主な業務内容:
・ウェブサイト経由のインバウンドリードへの対応
・SMB〜Mid-Market企業への初回商談・デモ実施
・Marketing Hub / Sales Hub / Service Hubの提案
・CRM活用コンサルティング`,
    requirements: `・法人営業経験2年以上
・SaaS / IT製品の営業経験（歓迎）
・英語力（社内コミュニケーション）
・CRM / MA ツールへの理解
・歓迎: HubSpot認定資格`,
    agent_comment: 'HubSpotの日本チームは急拡大中。外資SaaSの中でもワークライフバランスが良いと評判です。'
  },
  {
    company: 'freee株式会社',
    title: 'カスタマーサクセス',
    description: `クラウド会計ソフト「freee」の中堅・上場企業向けカスタマーサクセスポジションです。

主な業務内容:
・Mid-Market〜Enterprise顧客のオンボーディング
・会計・人事労務領域のプロダクト活用推進
・解約防止のためのヘルススコア管理
・プロダクトチームへのフィードバック`,
    requirements: `・カスタマーサクセス / コンサルティング経験2年以上
・会計・バックオフィス業務への理解
・顧客課題を構造化し、解決策を提案できる力
・歓迎: freee製品の利用経験、簿記資格`,
    agent_comment: 'freeeは日本SaaSの代表格。CS経験を積むなら最適な環境です。福利厚生も充実。'
  },
  {
    company: 'SmartHR株式会社',
    title: 'フィールドセールス',
    description: `人事労務SaaS「SmartHR」のフィールドセールスポジションです。

主な業務内容:
・中堅〜大企業への新規開拓営業
・商談の実施（オンライン / 訪問）
・提案資料作成・プレゼンテーション
・ISチームからのリード引き継ぎ対応`,
    requirements: `・法人営業経験3年以上
・SaaS / IT業界での営業経験（歓迎）
・大企業への提案・折衝経験
・チームでの協業を大切にできる方
・歓迎: HR Tech領域の知識`,
    agent_comment: 'SmartHRは評価制度が明確で、成果を出せば年収1,000万超も現実的。カルチャーも非常にオープン。'
  },
]

console.log('🌱 Seeding job details...\n')

let updated = 0
let skipped = 0

for (const job of jobDetails) {
  // Find company
  const { data: company } = await supabase
    .from('ow_companies')
    .select('id, name')
    .eq('name', job.company)
    .single()

  if (!company) {
    console.log(`  ⚠ Company not found: ${job.company}`)
    skipped++
    continue
  }

  // Find and update job
  const { data: existingJobs } = await supabase
    .from('ow_jobs')
    .select('id, title')
    .eq('company_id', company.id)
    .ilike('title', `%${job.title}%`)

  if (!existingJobs || existingJobs.length === 0) {
    console.log(`  ⚠ Job not found: ${job.company} - ${job.title}`)
    skipped++
    continue
  }

  for (const ej of existingJobs) {
    const { error } = await supabase
      .from('ow_jobs')
      .update({
        description: job.description,
        requirements: job.requirements,
      })
      .eq('id', ej.id)

    if (error) {
      console.log(`  ❌ Error updating ${ej.title}: ${error.message}`)
    } else {
      console.log(`  ✅ Updated: ${company.name} - ${ej.title}`)
      updated++
    }
  }
}

console.log(`\n✅ Done! Updated: ${updated}, Skipped: ${skipped}`)
