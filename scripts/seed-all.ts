import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getTableName(candidates: string[]): Promise<string> {
  for (const name of candidates) {
    const { error } = await supabase.from(name).select('id').limit(1)
    if (!error) { console.log(`✅ Using table: ${name}`); return name }
  }
  throw new Error('No valid table found: ' + candidates.join(', '))
}

async function main() {
  console.log('🚀 Starting full seed...')

  const companyTable = await getTableName(['ow_companies', 'companies'])
  const mentorTable = await getTableName(['mentors', 'ow_mentors'])

  // ===== STEP A: 企業データ更新 =====
  const companies = [
    { name: '株式会社kubell',           brand_color: '#7C3AED', founded_year: 2011, avg_salary: '600万〜900万',   remote_rate: 100, avg_overtime: 15, paid_leave_rate: 80, avg_age: 32, phase: '上場企業' },
    { name: '株式会社LayerX',           brand_color: '#6B4FBB', founded_year: 2018, avg_salary: '600万〜950万',   remote_rate: 100, avg_overtime: 20, paid_leave_rate: 75, avg_age: 29, phase: 'シリーズB', funding_total: '32億円' },
    { name: 'Ubie株式会社',             brand_color: '#1D9E75', founded_year: 2017, avg_salary: '500万〜800万',   remote_rate: 100, avg_overtime: 18, paid_leave_rate: 80, avg_age: 30, phase: 'シリーズC', funding_total: '43億円' },
    { name: '株式会社PKSHA Technology', brand_color: '#7C3AED', founded_year: 2012, avg_salary: '600万〜1000万',  remote_rate:  60, avg_overtime: 20, paid_leave_rate: 85, avg_age: 33, phase: '上場企業' },
    { name: 'Sansan株式会社',           brand_color: '#0066CC', founded_year: 2007, avg_salary: '650万〜950万',   remote_rate:  80, avg_overtime: 20, paid_leave_rate: 85, avg_age: 33, phase: '上場企業' },
    { name: 'フリー株式会社',           brand_color: '#FF4B00', founded_year: 2012, avg_salary: '600万〜900万',   remote_rate:  80, avg_overtime: 18, paid_leave_rate: 90, avg_age: 32, phase: '上場企業' },
    { name: 'Google Japan合同会社',     brand_color: '#EA4335', founded_year: 2001, avg_salary: '900万〜1500万',  remote_rate:  60, avg_overtime: 20, paid_leave_rate: 90, avg_age: 35, phase: '上場企業' },
    { name: 'Amazon Japan合同会社',     brand_color: '#FF9900', founded_year: 2000, avg_salary: '700万〜1200万',  remote_rate:  50, avg_overtime: 25, paid_leave_rate: 80, avg_age: 36, phase: '上場企業' },
    { name: '日本マイクロソフト株式会社', brand_color: '#00A4EF', founded_year: 1986, avg_salary: '800万〜1300万', remote_rate:  70, avg_overtime: 18, paid_leave_rate: 90, avg_age: 38, phase: '上場企業' },
    { name: 'Salesforce Japan株式会社', brand_color: '#00A1E0', founded_year: 2000, avg_salary: '800万〜1400万',  remote_rate:  70, avg_overtime: 20, paid_leave_rate: 90, avg_age: 36, phase: '上場企業' },
    { name: '株式会社マネーフォワード', brand_color: '#003B87', founded_year: 2012, avg_salary: '650万〜1000万',  remote_rate:  75, avg_overtime: 20, paid_leave_rate: 85, avg_age: 33, phase: '上場企業' },
    { name: '株式会社SmartHR',          brand_color: '#00C4CC', founded_year: 2013, avg_salary: '600万〜900万',   remote_rate:  80, avg_overtime: 18, paid_leave_rate: 85, avg_age: 31, phase: '上場企業',  funding_total: '156億円' },
    { name: 'Opinio株式会社',           brand_color: '#1D9E75', founded_year: 2023, avg_salary: '500万〜800万',   remote_rate:  80, avg_overtime: 15, paid_leave_rate: 80, avg_age: 32, phase: 'シード' },
    { name: '株式会社Third Box',        brand_color: '#7C3AED', founded_year: 2021, avg_salary: '500万〜750万',   remote_rate:  60, avg_overtime: 20, paid_leave_rate: 75, avg_age: 30, phase: 'シリーズA' },
  ]

  console.log('\n📊 Updating company data...')
  for (const { name, ...data } of companies) {
    const { error } = await supabase
      .from(companyTable)
      .update(data)
      .eq('name', name)
    if (error) console.error(`❌ ${name}: ${error.message}`)
    else console.log(`✅ ${name}`)
  }

  // NEWバッジリセット
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const threeDaysAgo  = new Date(Date.now() -  3 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from(companyTable).update({ created_at: thirtyDaysAgo }).neq('name', 'Opinio株式会社')
  await supabase.from(companyTable).update({ created_at: threeDaysAgo }).eq('name', 'Opinio株式会社')
  console.log('✅ Badge reset done')

  // ===== STEP B: メンターデータ =====
  console.log('\n👥 Upserting mentor data...')
  const mentors = [
    { name: '田中 美咲', avatar_initial: '田', avatar_color: '#1D9E75', current_company: 'Salesforce Japan', "current_role": 'エンタープライズ営業', previous_career: '大手メーカー営業', current_career: '外資SaaS営業', roles: ['営業'], worries: ['転職タイミング','年収交渉','外資転職'], bio: '外資SaaSへの転職で年収300万円アップを経験。エンタープライズ営業歴5年。', concerns: ['外資SaaSへの転職の進め方','年収交渉で失敗したくない','転職のタイミングがわからない'], calendly_url: 'https://calendly.com/dummy/30min', is_available: true, display_order: 1 },
    { name: '佐藤 健',   avatar_initial: '佐', avatar_color: '#00A1E0', current_company: 'HubSpot Japan', "current_role": 'カスタマーサクセス', previous_career: 'SIer営業', current_career: 'SaaS CS', roles: ['CS'], worries: ['キャリアチェンジ','転職タイミング','スタートアップ'], bio: 'SIer営業からSaaS CSへキャリアチェンジ。CSとして3年、チームリード。', concerns: ['営業からCSに転身できるの？','CSのキャリアパスが知りたい','SaaS CSの実際の仕事内容'], calendly_url: 'https://calendly.com/dummy/30min', is_available: true, display_order: 2 },
    { name: '鈴木 陽子', avatar_initial: '鈴', avatar_color: '#FF7A59', current_company: 'Zoho Japan', "current_role": 'インサイドセールス', previous_career: '人材業界IS', current_career: 'SaaS IS', roles: ['営業'], worries: ['転職タイミング','スタートアップ','年収交渉'], bio: '人材業界ISからSaaS ISに転職。BDRチームリード。', concerns: ['IS経験でSaaSに転職できる？','ベンチャーと大手どっちがいい？','年収を維持しながら転職したい'], calendly_url: 'https://calendly.com/dummy/30min', is_available: true, display_order: 3 },
    { name: '山本 大輔', avatar_initial: '山', avatar_color: '#6B4FBB', current_company: 'Gong Japan', "current_role": 'Revenue Operations', previous_career: 'コンサル', current_career: 'RevOps', roles: ['事業開発'], worries: ['キャリアチェンジ','外資転職','年収交渉'], bio: 'コンサルからRevOpsへ転職。年収1000万超えのリアルも話せます。', concerns: ['RevOpsって何をする仕事？','コンサルからSaaSへの転職方法','英語力はどれくらい必要？'], calendly_url: 'https://calendly.com/dummy/30min', is_available: false, display_order: 4 },
    { name: '伊藤 さやか', avatar_initial: '伊', avatar_color: '#E42527', current_company: 'Sansan', "current_role": 'マーケティング', previous_career: '広告代理店', current_career: 'SaaSマーケ', roles: ['マーケ'], worries: ['キャリアチェンジ','転職タイミング'], bio: '広告代理店のデジタルマーケ経験をSaaSマーケに転換。', concerns: ['BtoBマーケへの転換方法','代理店経験はSaaSで活きる？','マーケ職の年収レンジが知りたい'], calendly_url: 'https://calendly.com/dummy/30min', is_available: true, display_order: 5 },
    { name: '中村 拓也', avatar_initial: '中', avatar_color: '#003B87', current_company: 'MoneyForward', "current_role": 'フィールドセールス', previous_career: 'Recruit', current_career: 'SaaS営業', roles: ['営業'], worries: ['転職タイミング','年収交渉','スタートアップ'], bio: 'Recruit出身でSaaS営業に転職。', concerns: ['Recruit出身はSaaSで評価される？','FinTech系SaaSの実態','年収を維持しながら転職したい'], calendly_url: 'https://calendly.com/dummy/30min', is_available: true, display_order: 6 },
    { name: '小林 恵',   avatar_initial: '小', avatar_color: '#FF4B00', current_company: 'Freee', "current_role": 'カスタマーサクセス', previous_career: '公認会計士', current_career: 'SaaS CS', roles: ['CS'], worries: ['キャリアチェンジ','転職タイミング'], bio: '公認会計士からSaaS CSへの異色キャリアチェンジ。', concerns: ['専門職からSaaSに行けるの？','会計系SaaSの内部事情','CSとして市場価値を上げるには？'], calendly_url: 'https://calendly.com/dummy/30min', is_available: true, display_order: 7 },
    { name: '加藤 翔',   avatar_initial: '加', avatar_color: '#0066CC', current_company: 'Salesforce', "current_role": 'Solution Engineer', previous_career: 'SIer SE', current_career: '外資SaaS SE', roles: ['事業開発'], worries: ['外資転職','年収交渉','キャリアチェンジ'], bio: 'SIer SEから外資SaaS SEへ転職。テクニカルセールスの実態を話せます。', concerns: ['SEからSEになるには？','外資でのキャリアアップ','テクニカルセールスとは？'], calendly_url: 'https://calendly.com/dummy/30min', is_available: true, display_order: 8 },
    { name: '渡辺 あい', avatar_initial: '渡', avatar_color: '#9B59B6', current_company: 'HubSpot', "current_role": 'マーケティング', previous_career: '事業会社マーケ', current_career: 'SaaSマーケ', roles: ['マーケ'], worries: ['転職タイミング','スタートアップ','キャリアチェンジ'], bio: '事業会社マーケからSaaSマーケに転職。インバウンド・PLGの実務経験あり。', concerns: ['SaaSマーケのインバウンドとは？','グローバルSaaSで働く実態','マーケ職のキャリアパス'], calendly_url: 'https://calendly.com/dummy/30min', is_available: true, display_order: 9 },
    { name: '柴 久人',   avatar_initial: '柴', avatar_color: '#1D9E75', current_company: 'Opinio株式会社', "current_role": 'CEO / キャリアコンサルタント', previous_career: 'Recruit · Salesforce', current_career: '起業', roles: ['営業','CS','事業開発'], worries: ['転職タイミング','年収交渉','外資転職','キャリアチェンジ','スタートアップ'], bio: 'Recruit4年・Salesforce 6年を経て独立。国家資格キャリアコンサルタント・ICFコーチ。', concerns: ['転職すべきか迷っている','どの会社が自分に合うか','年収を大幅に上げたい'], calendly_url: 'https://calendly.com/hshiba-opinio/30min', is_available: true, display_order: 10 },
  ]

  // 既存メンターを全削除して再挿入（name にユニーク制約がないため）
  const { error: delErr } = await supabase.from(mentorTable).delete().neq('name', '')
  if (delErr) console.error(`❌ Delete mentors: ${delErr.message}`)
  else console.log('✅ Cleared existing mentors')

  for (const mentor of mentors) {
    const { error } = await supabase
      .from(mentorTable)
      .insert(mentor)
    if (error) console.error(`❌ ${mentor.name}: ${error.message}`)
    else console.log(`✅ ${mentor.name}`)
  }

  // ===== STEP C: 求人ポジティブ・ネガティブ =====
  console.log('\n💡 Updating job positives/negatives...')

  const jobTable = await getTableName(['ow_jobs', 'jobs'])

  const jobPosNeg: Record<string, { positives: string[]; negatives: string[] }> = {
    'カスタマーサクセスマネージャー': {
      positives: ['世界No.1 CRMブランドで市場価値が上がる', 'フルリモート可・フルフレックスで自由度高い', '年収800万〜1,400万と業界トップクラス'],
      negatives: ['グローバル基準の高い目標設定と成果主義', '英語でのレポーティングが必要な場合あり', '四半期ごとの厳格なパフォーマンス評価'],
    },
    'フィールドセールス': {
      positives: ['医療×AIという社会的インパクトが大きい領域', 'シリーズCで成長フェーズ・ストックオプションあり', 'フルリモート・平均残業18時間以下で働きやすい'],
      negatives: ['医療業界の知識習得に時間がかかる場合あり', '営業サイクルが長い案件が多い', 'スタートアップのため制度整備が途上の部分も'],
    },
    'インサイドセールス': {
      positives: ['急成長SaaSでキャリアアップのチャンスが豊富', 'データドリブンな営業手法を習得できる', 'フレックス・リモート対応で柔軟な働き方'],
      negatives: ['高い架電・商談目標が設定される', 'プロダクトの変化スピードについていく必要あり', '成果主義のためプレッシャーが強い場合も'],
    },
    'エンタープライズ営業': {
      positives: ['大手企業との折衝で高い営業スキルが身につく', '上場企業の安定基盤とストックオプション', '年収650万〜950万と安定した報酬水準'],
      negatives: ['長期の商談サイクル（6〜12ヶ月）', '複雑な社内承認プロセスへの対応が必要', '出張が多い場合がある'],
    },
    'プロダクトマネージャー': {
      positives: ['AI×SaaSの最前線でプロダクト開発を牽引', '経営陣との距離が近く意思決定に関与できる', 'グローバル展開を見据えた経験が積める'],
      negatives: ['エンジニアリングの深い理解が求められる', 'ステークホルダーが多く調整コストが高い', '急成長フェーズで業務範囲が広くなりがち'],
    },
    'マーケティングマネージャー': {
      positives: ['BtoB SaaSマーケの実践経験が積める', 'デジタル・イベント・コンテンツと幅広い施策', '上場企業の安定基盤で挑戦できる'],
      negatives: ['ROI証明へのプレッシャーが強い', 'セールスとの連携で板挟みになることも', 'マーケ予算の変動が業績に左右される'],
    },
    'カスタマーサクセス': {
      positives: ['急成長SaaSでCS組織の立ち上げに関われる', 'リモートワーク中心で働きやすい環境', 'ストックオプション付きで将来のリターンも'],
      negatives: ['チャーン防止のプレッシャーが常にある', 'プロダクト改善要望の板挟みになりやすい', 'スタートアップのため仕組みは自分で作る必要あり'],
    },
    'ソリューションエンジニア': {
      positives: ['技術×営業のハイブリッドキャリアが築ける', '外資SaaSで年収800万〜1,300万の高水準', 'グローバルチームとの協業で視野が広がる'],
      negatives: ['顧客対応と技術検証の両立が求められる', '英語でのコミュニケーションが必須', '出張やデモ対応で時間の自由度が下がることも'],
    },
    '事業開発マネージャー': {
      positives: ['新規事業の立ち上げから成長まで一貫して関われる', '経営視点でのビジネス構築スキルが身につく', 'フルリモート・フレックスで自律的に働ける'],
      negatives: ['成果が出るまでに時間がかかる場合がある', '不確実性の高い環境での意思決定が求められる', '幅広い業務を少人数でカバーする必要あり'],
    },
  }

  const { data: allJobs } = await supabase.from(jobTable).select('id, title')
  for (const job of allJobs ?? []) {
    const pn = jobPosNeg[job.title]
    if (pn) {
      const { error } = await supabase.from(jobTable).update(pn).eq('id', job.id)
      if (error) console.error(`❌ pos/neg ${job.title}: ${error.message}`)
      else console.log(`✅ pos/neg: ${job.title}`)
    }
  }

  console.log('\n🎉 All seed complete!')
}

main().catch(console.error)
