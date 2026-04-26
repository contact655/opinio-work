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

// ─── 企業フィット感データ ───────────────────────────────
const companyFitData = [
  {
    name: '株式会社LayerX',
    opinio_comment: 'バクラクで急成長中のFinTechスタートアップ。営業・CS職を積極採用中。',
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
    opinio_comment: '外資SaaSキャリアのゴールとして人気No.1。年収・ブランド・成長環境が揃う。',
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
  },
  {
    name: '株式会社SmartHR',
    opinio_comment: 'HR領域のユニコーン。デザイン・開発文化が成熟しており働きやすさで定評あり。',
    fit_positives: [
      'HRという身近な領域でプロダクトへの共感を持って働ける',
      'デザイン・開発文化が成熟しており働き方の自由度が高い',
      'ユニコーン企業でストックオプションのアップサイドがある'
    ],
    fit_negatives: [
      '競合が増えており以前ほど「売れば売れる」状況ではなくなってきた',
      '上場準備フェーズで社内プロセスが増加、スピード感が落ちてきている',
      'HR領域に興味がないと長期モチベーション維持が難しい'
    ]
  },
  {
    name: 'フリー株式会社',
    opinio_comment: '中小企業DXの旗手。会計・労務SaaSのリーダーとして安定した採用を継続中。',
    fit_positives: [
      '中小企業DXという社会的意義が大きくミッションに共感しやすい',
      'freee出身というブランドが会計・バックオフィスSaaS領域で強い',
      '上場済みで安定感があり福利厚生も整っている'
    ],
    fit_negatives: [
      '競合（マネーフォワード等）との価格競争が激しくなってきている',
      '会計・労務という専門領域のため知識習得に時間がかかる',
      '組織が大きくなり意思決定に時間がかかるケースが増えている'
    ]
  },
  {
    name: 'Sansan株式会社',
    opinio_comment: '名刺管理SaaSで上場済み。Eight事業も拡大中でキャリアパスの選択肢が多い。',
    fit_positives: [
      '名刺管理という明確なプロダクトで営業しやすく成果が出やすい',
      '上場企業で安定感があり年収・福利厚生のバランスが良い',
      'Eight（個人向け）とSansan（法人向け）で多様なキャリアパスがある'
    ],
    fit_negatives: [
      'プロダクトが成熟期に入りつつあり新規開拓の難易度が上がっている',
      '名刺管理というニッチ領域のため市場規模に限界感がある',
      '競合（HubSpot等）との差別化説明に工夫が必要'
    ]
  },
  {
    name: 'Google Japan合同会社',
    opinio_comment: '国内最高峰の待遇と環境。選考難易度は高いが挑戦する価値は最大級。',
    fit_positives: [
      '世界最高峰のブランドで転職後のキャリアオプションが格段に広がる',
      '年収水準が国内最高クラスで900〜1500万が現実的なレンジ',
      '優秀な同僚から学べる環境として国内随一'
    ],
    fit_negatives: [
      '選考難易度が極めて高く複数回の面接と課題をクリアする必要がある',
      '英語が実質必須で日常業務・資料・評価すべてが英語ベース',
      '大組織のため個人の裁量より会社のルールに従う場面が多い'
    ]
  },
  {
    name: 'Amazon Japan合同会社',
    opinio_comment: 'LP文化で人材育成に定評あり。AWS・ECなど多様な事業で社内転職も活発。',
    fit_positives: [
      'LP（リーダーシッププリンシプル）という明確な行動指針で成長できる',
      'AWS・EC・広告など多様な事業があり社内転職のオプションが広い',
      'Amazon出身は転職市場で高く評価される'
    ],
    fit_negatives: [
      '成果主義・PIPs（業績改善計画）文化があり常にパフォーマンスが求められる',
      'ドキュメント文化（6ページメモ）への適応に時間がかかる',
      '英語必須でグローバルチームとの調整業務が多い'
    ]
  },
  {
    name: '日本マイクロソフト株式会社',
    opinio_comment: 'Azure・Copilotで追い風の中。外資の中では文化が穏やかで副業OKも魅力。',
    fit_positives: [
      'Azure・M365・Copilotと時代の中心にいるプロダクトを扱える',
      '副業OKで働き方の自由度が外資の中でも高い',
      '国内外資SaaSの中でも組織文化が比較的穏やか'
    ],
    fit_negatives: [
      '製品ポートフォリオが広すぎて専門性を絞りにくい',
      '親会社の方針変更（レイオフ等）の影響を受けることがある',
      'パートナー経由の営業が多くエンドユーザーとの距離感がある'
    ]
  },
  {
    name: '株式会社マネーフォワード',
    opinio_comment: '個人・法人両軸のSaaS。技術ブログ・OSS文化が強くエンジニアに人気。',
    fit_positives: [
      '個人・法人の両軸でプロダクトを持ち異動の選択肢が多い',
      '技術ブログ・OSS文化が強くエンジニアとしての市場価値が上がる',
      'freeeとの競争環境があり営業として鍛えられる'
    ],
    fit_negatives: [
      '上場済みでスタートアップ感が薄れストックオプションの旨みは少ない',
      '会計・労務領域の専門知識習得が必要で学習コストがかかる',
      '組織拡大フェーズで部門間連携の複雑さが増している'
    ]
  },
  {
    name: 'Ubie株式会社',
    opinio_comment: 'AI×医療で社会インパクト大。IPO視野のシリーズCでストックオプションあり。',
    fit_positives: [
      'ヘルステック×AIという社会インパクトの大きい領域で働ける',
      'シリーズCフェーズでIPOを視野に入れたストックオプションがある',
      'スタートアップの中では組織文化・制度が整ってきている'
    ],
    fit_negatives: [
      '医療業界特有の規制・保守性があり営業サイクルが長い',
      '社員200名以下でまだ組織が発展途上、役割が曖昧な部分がある',
      'ヘルステックへの強い興味がないと長期的なモチベ維持が難しい'
    ]
  },
  {
    name: '株式会社PKSHA Technology',
    opinio_comment: '東大発AIベンチャー。自然言語処理・画像認識の最前線で働ける稀有な環境。',
    fit_positives: [
      '東大発AIベンチャーとして技術力・ブランド力が国内トップクラス',
      'AI・自然言語処理という市場成長領域に身を置ける',
      '上場済みで研究開発への投資が継続的に行われている'
    ],
    fit_negatives: [
      'エンジニア・研究者文化が強くビジネス職の存在感が薄い場合がある',
      'BtoB向けAI SaaSは導入期間が長く短期での成果が見えにくい',
      '専門性が高い領域のためAIへの興味・学習意欲が必須'
    ]
  },
  {
    name: '株式会社kubell',
    opinio_comment: 'Chatworkを運営。関西勤務可能な数少ないSaaS企業として関西人材に人気。',
    fit_positives: [
      'Chatworkという知名度の高いプロダクトで中小企業への提案がしやすい',
      '大阪本社のため関西在住者にとって数少ない外資系でない選択肢',
      '上場済みで安定感があり副業・リモートも認められている'
    ],
    fit_negatives: [
      'Slack・Teamsとの競合が激しく差別化の説明に工夫が必要',
      '中小企業メインのためエンタープライズ営業経験が積みにくい',
      'チャットツール市場が成熟しつつあり新機能での差別化が難しい'
    ]
  }
]

// ─── 求人フィット感データ ───────────────────────────────
const jobFitData = [
  {
    company_name: 'Ubie株式会社',
    title: 'フィールドセールス',
    fit_positives: [
      'ヘルステックという社会課題解決の実感を持ちながら営業できる',
      'シリーズCフェーズで組織拡大中、早期にリーダーポジションを狙える',
      'フルリモートで成果さえ出せば働く場所・時間の自由度が高い'
    ],
    fit_negatives: [
      '医療機関への営業のため意思決定者が多く商談サイクルが長い',
      'ヘルステック特有の規制・専門用語の習得に時間がかかる',
      'スタートアップのため営業ツール・プロセスを自分で整備する姿勢が必要'
    ]
  },
  {
    company_name: 'Salesforce Japan株式会社',
    title: 'カスタマーサクセスマネージャー',
    fit_positives: [
      '世界No.1 CRMのCSとして最高峰の顧客成功手法を身につけられる',
      'エンタープライズ顧客担当で大型案件の経験が積める',
      'Salesforce CSM出身は転職市場で非常に高く評価される'
    ],
    fit_negatives: [
      'クォーター制のKPI管理が厳しくネガティブなフィードバックを受ける機会が多い',
      '英語でのグローバルチームとの連携が週複数回あり英語力が必須',
      '大企業のため社内調整・承認プロセスが多く動きにくさを感じる場合がある'
    ]
  },
  {
    company_name: '株式会社LayerX',
    title: 'フィールドセールス',
    fit_positives: [
      'バクラクの急成長フェーズで営業として数字を作る面白さがある',
      'フルリモート×高い裁量で自分のスタイルで営業できる',
      'FinTech×SaaSという成長領域の経験が市場価値を高める'
    ],
    fit_negatives: [
      'スタートアップのため営業プロセス・ツールがまだ発展途上',
      '100名以下の組織でサポート体制が大企業より手薄な部分がある',
      '競合も増えており以前より提案難易度が上がっている'
    ]
  },
  {
    company_name: '株式会社SmartHR',
    title: 'フロントエンドエンジニア（React/TypeScript）',
    fit_positives: [
      'デザインシステムが整備されており高品質なコードベースで働ける',
      'React・TypeScriptという市場価値の高いスキルを実務で深められる',
      'フルリモートで働き方の自由度が国内SaaS企業でも高水準'
    ],
    fit_negatives: [
      'HR領域のドメイン知識習得が必要で法律・制度の理解が求められる',
      '上場準備フェーズで品質・セキュリティ要件が厳格化している',
      '組織拡大中でコミュニケーションコストが増加傾向にある'
    ]
  },
  {
    company_name: 'Google Japan合同会社',
    title: 'フィールドセールス',
    fit_positives: [
      'Google Cloudという追い風のある製品を扱えクロージング率が高い',
      '国内最高水準の年収で900万〜が現実的なスタートライン',
      'GoogleのブランドによりCxOレベルへのアクセスが取りやすい'
    ],
    fit_negatives: [
      '選考が非常に厳しく複数ラウンドの面接・ケーススタディがある',
      '英語でのグローバル連携が日常的に発生し英語力が実質必須',
      '大組織のため個人の提案が通るまで時間がかかることが多い'
    ]
  }
]

// ─── 実行関数 ────────────────────────────────────────────
async function seedCompanyFitData() {
  console.log('企業フィット感データを投入中...')
  for (const company of companyFitData) {
    // まず正確な名前で検索
    let { data: found } = await supabase
      .from('ow_companies')
      .select('id, name')
      .eq('name', company.name)
      .maybeSingle()

    // 見つからなければ部分一致
    if (!found) {
      const keyword = company.name.replace('株式会社', '').replace('合同会社', '').trim()
      const { data: partial } = await supabase
        .from('ow_companies')
        .select('id, name')
        .ilike('name', `%${keyword}%`)
        .limit(1)
        .maybeSingle()
      found = partial
    }

    if (!found) {
      console.error(`  Not found: ${company.name}`)
      continue
    }

    const { error } = await supabase
      .from('ow_companies')
      .update({
        fit_positives: company.fit_positives,
        fit_negatives: company.fit_negatives,
        opinio_comment: company.opinio_comment
      })
      .eq('id', found.id)

    if (error) {
      console.error(`  Error: ${found.name}`, error.message)
    } else {
      console.log(`  Updated: ${found.name} (${found.id})`)
    }
  }
}

async function seedJobFitData() {
  console.log('\n求人フィット感データを投入中...')
  for (const job of jobFitData) {
    // まず企業IDを取得
    let { data: company } = await supabase
      .from('ow_companies')
      .select('id, name')
      .eq('name', job.company_name)
      .maybeSingle()

    if (!company) {
      const keyword = job.company_name.replace('株式会社', '').replace('合同会社', '').trim()
      const { data: partial } = await supabase
        .from('ow_companies')
        .select('id, name')
        .ilike('name', `%${keyword}%`)
        .limit(1)
        .maybeSingle()
      company = partial
    }

    if (!company) {
      console.error(`  Company not found: ${job.company_name}`)
      continue
    }

    // タイトルで求人を検索（部分一致も試す）
    let { data: jobRecord } = await supabase
      .from('ow_jobs')
      .select('id, title')
      .eq('company_id', company.id)
      .eq('title', job.title)
      .maybeSingle()

    if (!jobRecord) {
      const { data: partial } = await supabase
        .from('ow_jobs')
        .select('id, title')
        .eq('company_id', company.id)
        .ilike('title', `%${job.title}%`)
        .limit(1)
        .maybeSingle()
      jobRecord = partial
    }

    if (!jobRecord) {
      console.error(`  Job not found: ${job.company_name} / ${job.title}`)
      continue
    }

    const { error } = await supabase
      .from('ow_jobs')
      .update({
        fit_positives: job.fit_positives,
        fit_negatives: job.fit_negatives
      })
      .eq('id', jobRecord.id)

    if (error) {
      console.error(`  Error: ${company.name} / ${jobRecord.title}`, error.message)
    } else {
      console.log(`  Updated: ${company.name} / ${jobRecord.title} (${jobRecord.id})`)
    }
  }
}

async function main() {
  await seedCompanyFitData()
  await seedJobFitData()
  console.log('\n全データ投入完了!')
}

main()
