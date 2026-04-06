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

  // ===== STEP C: 求人詳細データ（description + requirements + preferred + selection_flow + pos/neg） =====
  console.log('\n💼 Updating job details...')

  const jobTable = await getTableName(['ow_jobs', 'jobs'])

  const jobDetails: Record<string, {
    description: string
    requirements: string
    preferred: string
    selection_flow: string[]
    positives: string[]
    negatives: string[]
  }> = {
    'フィールドセールス': {
      description: 'エンタープライズ企業（大手・中堅）へのSaaSプロダクトの導入提案をご担当いただきます。リード獲得から商談・クロージングまでを一気通貫で担当し、顧客の経営課題解決に貢献するポジションです。\n\n• 新規顧客の開拓（アウトバウンド・インバウンド両方）\n• 既存顧客のアップセル・クロスセル提案\n• マーケ・CSチームと連携した顧客成功の推進\n• プロダクトチームへの市場フィードバック',
      requirements: '• 法人営業経験3年以上\n• SaaSプロダクトの営業経験（業種不問）\n• エンタープライズへの新規開拓経験',
      preferred: '• SaaS業界での営業経験\n• 英語でのコミュニケーション経験\n• CRMツール（Salesforce等）の活用経験',
      selection_flow: ['書類選考（3営業日以内に連絡）', 'カジュアル面談（30分・オンライン）', '一次面接（現場マネージャー）', '最終面接（役員・内定まで最短2週間）'],
      positives: ['業界トップクラスの年収レンジで市場価値が上がる', 'フルリモート可・フルフレックスで自由度が高い', '成長市場のSaaS企業で営業スキルを磨ける'],
      negatives: ['高い目標設定と成果主義文化がある', '四半期ごとの厳格なパフォーマンス評価', 'エンタープライズ商談は意思決定に時間がかかることも'],
    },
    'カスタマーサクセスマネージャー': {
      description: '導入済み顧客の活用支援・定着化・アップセルをご担当いただきます。顧客の成功を通じてプロダクトの価値を最大化し、継続率向上に貢献するポジションです。\n\n• オンボーディング支援・活用促進\n• 定期的なビジネスレビュー（QBR）の実施\n• チャーン（解約）リスクの早期検知と対応\n• プロダクト改善のフィードバック収集',
      requirements: '• カスタマーサクセス・カスタマーサポート経験2年以上\n• SaaSプロダクトの顧客対応経験\n• 論理的なコミュニケーション力',
      preferred: '• Salesforce・HubSpot等のCRMツール経験\n• データ分析・ダッシュボード活用経験\n• チームマネジメント経験',
      selection_flow: ['書類選考', 'カジュアル面談（30分）', '一次面接（ケーススタディあり）', '最終面接'],
      positives: ['世界No.1 CRMブランドで市場価値が上がる', 'フルリモート可・フルフレックスで自由度高い', '年収800万〜1,400万と業界トップクラス'],
      negatives: ['グローバル基準の高い目標設定と成果主義', '英語でのレポーティングが必要な場合あり', '四半期ごとの厳格なパフォーマンス評価'],
    },
    'カスタマーサクセス': {
      description: 'SMB（中小企業）向けのカスタマーサクセスをご担当いただきます。多くの顧客を効率よくサポートしながら、プロダクトの活用を最大化するポジションです。\n\n• 新規導入顧客のオンボーディング\n• オンラインでの活用支援・ウェビナー運営\n• ヘルススコアを活用したチャーン防止\n• FAQコンテンツ・マニュアルの整備',
      requirements: '• 顧客対応・サポート業務経験1年以上\n• PCスキル（Excel・Googleスプレッドシート）\n• コミュニケーション力・丁寧な文章力',
      preferred: '• SaaSプロダクトの利用経験\n• データ分析経験\n• 業界知識（担当プロダクトに関連する領域）',
      selection_flow: ['書類選考', 'オンライン面接（30分）', '最終面接'],
      positives: ['急成長SaaSでCS組織の立ち上げに関われる', 'リモートワーク中心で働きやすい環境', 'ストックオプション付きで将来のリターンも'],
      negatives: ['チャーン防止のプレッシャーが常にある', 'プロダクト改善要望の板挟みになりやすい', 'スタートアップのため仕組みは自分で作る必要あり'],
    },
    'プロダクトマネージャー': {
      description: 'SaaSプロダクトのロードマップ策定から機能開発・リリースまでをご担当いただきます。エンジニア・デザイナー・ビジネスサイドと協働しながらプロダクト価値を最大化するポジションです。\n\n• プロダクトビジョン・戦略の策定\n• ユーザーリサーチ・課題定義\n• 機能要件の定義・優先順位付け\n• スプリント計画・リリース管理',
      requirements: '• プロダクトマネジメント経験2年以上\n• エンジニア・デザイナーとの協働経験\n• データを活用した意思決定の経験',
      preferred: '• SaaS業界でのPM経験\n• SQL・BIツールの活用経験\n• アジャイル開発の経験',
      selection_flow: ['書類選考', 'カジュアル面談', '一次面接（ケーススタディ）', '最終面接（プロダクト戦略プレゼン）'],
      positives: ['AI×SaaSの最前線でプロダクト開発を牽引', '経営陣との距離が近く意思決定に関与できる', 'グローバル展開を見据えた経験が積める'],
      negatives: ['エンジニアリングの深い理解が求められる', 'ステークホルダーが多く調整コストが高い', '急成長フェーズで業務範囲が広くなりがち'],
    },
    'ソリューションエンジニア': {
      description: 'プリセールスとして顧客企業の技術的課題を理解し、SaaSプロダクトの技術提案・デモ・PoC支援を行うポジションです。営業チームと連携しながらエンタープライズ顧客の導入を成功に導きます。\n\n• 技術的な要件ヒアリング・提案書作成\n• 製品デモ・PoC（概念実証）の実施\n• API連携・カスタマイズの技術検証\n• 導入後の技術支援・トレーニング',
      requirements: '• ITシステムの設計・開発経験3年以上\n• 顧客折衝・プレゼンテーション経験\n• Web技術（API・クラウド）の基礎知識',
      preferred: '• SaaS製品のプリセールス・SE経験\n• CRM/MA/ERP等のエンタープライズSaaS知識\n• ビジネスレベルの英語力',
      selection_flow: ['書類選考', 'カジュアル面談', '技術面接（デモ実演あり）', '最終面接'],
      positives: ['技術×営業のハイブリッドキャリアが築ける', '外資SaaSで年収800万〜1,300万の高水準', 'グローバルチームとの協業で視野が広がる'],
      negatives: ['顧客対応と技術検証の両立が求められる', '英語でのコミュニケーションが必須', '出張やデモ対応で時間の自由度が下がることも'],
    },
    'インサイドセールス': {
      description: 'マーケティングチームが獲得したリードに対するアプローチから商談化までを担当するポジションです。データドリブンな営業プロセスを通じて効率的にパイプラインを構築します。\n\n• インバウンドリードへの迅速なアプローチ\n• アウトバウンドでの新規リード開拓（電話・メール・SNS）\n• CRMを活用した見込み顧客の管理・ナーチャリング\n• フィールドセールスへの適切な商談トスアップ',
      requirements: '• 法人営業またはインサイドセールス経験1年以上\n• コミュニケーション力と傾聴力\n• PCスキル（CRMツールの操作等）',
      preferred: '• SaaS業界でのIS経験\n• Salesforce・HubSpot等のCRMツール活用経験\n• 人材業界・広告業界での営業経験',
      selection_flow: ['書類選考', 'カジュアル面談', 'ロールプレイ面接', '最終面接'],
      positives: ['急成長SaaSでキャリアアップのチャンスが豊富', 'データドリブンな営業手法を習得できる', 'フレックス・リモート対応で柔軟な働き方'],
      negatives: ['高い架電・商談目標が設定される', 'プロダクトの変化スピードについていく必要あり', '成果主義のためプレッシャーが強い場合も'],
    },
    'エンタープライズ営業': {
      description: '従業員1,000名以上の大手企業に対する戦略営業を担当するポジションです。長期的な関係構築を通じて大型案件のクロージングを目指します。\n\n• 大手企業の経営層・部門長へのアプローチ\n• 複数ステークホルダーを巻き込んだ提案活動\n• 年間戦略アカウントプランの策定・実行\n• 社内リソース（SE・CS・経営）の適切な活用',
      requirements: '• エンタープライズ営業経験3年以上\n• 年間1,000万円以上の案件クロージング実績\n• 複雑な意思決定プロセスの攻略経験',
      preferred: '• SaaS・IT業界でのエンタープライズ営業経験\n• MEDDIC/SPINなどの営業フレームワーク活用経験\n• 英語でのビジネスコミュニケーション経験',
      selection_flow: ['書類選考', 'カジュアル面談', '一次面接（ケーススタディ）', '最終面接（VP・役員）'],
      positives: ['大手企業との折衝で高い営業スキルが身につく', '上場企業の安定基盤とストックオプション', '年収650万〜950万と安定した報酬水準'],
      negatives: ['長期の商談サイクル（6〜12ヶ月）', '複雑な社内承認プロセスへの対応が必要', '出張が多い場合がある'],
    },
    'マーケティングマネージャー': {
      description: 'BtoBマーケティング全体の戦略立案から施策実行までをリードするポジションです。デジタルマーケティング・コンテンツ・イベントなど幅広い施策を通じてリード獲得と売上貢献を担います。\n\n• マーケティング戦略・年間計画の策定\n• デジタル広告運用（Google・LinkedIn・Facebook）\n• コンテンツマーケティング（ブログ・ホワイトペーパー・事例）\n• ウェビナー・カンファレンスの企画・運営',
      requirements: '• BtoBマーケティング経験3年以上\n• デジタル広告運用・コンテンツ制作の実務経験\n• データ分析・効果測定の経験',
      preferred: '• SaaS業界でのマーケティング経験\n• Marketo・HubSpot等のMAツール運用経験\n• チームマネジメント経験',
      selection_flow: ['書類選考', 'カジュアル面談', '課題提出（マーケ施策提案）', '最終面接'],
      positives: ['BtoB SaaSマーケの実践経験が積める', 'デジタル・イベント・コンテンツと幅広い施策', '上場企業の安定基盤で挑戦できる'],
      negatives: ['ROI証明へのプレッシャーが強い', 'セールスとの連携で板挟みになることも', 'マーケ予算の変動が業績に左右される'],
    },
    '事業開発マネージャー': {
      description: '新規事業・新市場の開拓を担当するポジションです。戦略策定からパートナーシップ構築・実行まで、経営視点で事業成長をリードします。\n\n• 新規市場の調査・参入戦略の策定\n• パートナー企業との協業・アライアンス構築\n• 新プロダクト・サービスの立ち上げ支援\n• 事業KPIの設計・モニタリング・改善',
      requirements: '• 事業企画・事業開発経験3年以上\n• 市場調査・戦略策定の経験\n• プロジェクトマネジメント経験',
      preferred: '• SaaS・IT業界での事業開発経験\n• コンサルティングファーム出身\n• 英語でのビジネスコミュニケーション経験',
      selection_flow: ['書類選考', 'カジュアル面談', '一次面接（ケーススタディ）', '最終面接（CEO/COO）'],
      positives: ['新規事業の立ち上げから成長まで一貫して関われる', '経営視点でのビジネス構築スキルが身につく', 'フルリモート・フレックスで自律的に働ける'],
      negatives: ['成果が出るまでに時間がかかる場合がある', '不確実性の高い環境での意思決定が求められる', '幅広い業務を少人数でカバーする必要あり'],
    },
    'マーケティングスペシャリスト': {
      description: 'BtoBマーケティングの企画・実行をご担当いただきます。リード獲得からナーチャリングまで、マーケティングファネル全体を担うポジションです。\n\n• コンテンツマーケティング（ブログ・ホワイトペーパー・事例）\n• デジタル広告運用（Google・LinkedIn等）\n• ウェビナー・イベント企画・運営\n• MA（マーケティングオートメーション）活用',
      requirements: '• BtoBマーケティング経験2年以上\n• コンテンツ制作・デジタル広告の実務経験\n• データ分析・効果測定の経験',
      preferred: '• SaaS業界でのマーケ経験\n• Marketo・HubSpot等のMAツール経験\n• 英語での業務経験',
      selection_flow: ['書類選考', 'カジュアル面談', '課題提出（マーケ施策提案）', '最終面接'],
      positives: ['マーケ全般を幅広く担当でき成長できる', 'データドリブンな文化でスキルが磨ける', 'グローバルチームと協働できる機会あり'],
      negatives: ['KPI達成へのプレッシャーがある', '複数施策を同時進行するため優先順位づけが必要', '英語スキルが求められる場合がある'],
    },
  }

  const { data: allJobs } = await supabase.from(jobTable).select('id, title')
  for (const job of allJobs ?? []) {
    const detail = jobDetails[job.title]
    if (detail) {
      const { error } = await supabase.from(jobTable).update(detail).eq('id', job.id)
      if (error) console.error(`❌ ${job.title}: ${error.message}`)
      else console.log(`✅ ${job.title}`)
    }
  }

  console.log('\n🎉 All seed complete!')
}

main().catch(console.error)
