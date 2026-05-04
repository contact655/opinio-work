/**
 * scripts/seed-sample-data.ts
 *
 * Opinio サンプルデータ一括投入スクリプト
 *
 * 投入データ:
 *   - ow_companies    30 社
 *   - ow_jobs         30 件 (1社1件)
 *   - auth.users      40 件 (biz30 + user10)
 *   - ow_users        130 名 (biz30 + user10 + 現役60 + OB30)
 *   - ow_company_admins 30 件
 *   - ow_user_roles   10 件 (求職者10名 → candidate)
 *   - ow_experiences  90 件 (現役60 + OB30)
 *   - ow_mentors      30 件
 *
 * 実行方法:
 *   # クリアなし (アペンドのみ)
 *   npx ts-node --skip-project scripts/seed-sample-data.ts
 *
 *   # フルクリーン再投入
 *   CLEAN_FIRST=true npx ts-node --skip-project scripts/seed-sample-data.ts
 *
 * 保護対象 (絶対に削除しない):
 *   - auth.users 全体
 *   - ow_users id: fe7dfe9b-... (柴久人 BIZ) / e826e0bd-... (柴久人 個人)
 *   - ow_user_roles user_id: 7f358b59-... (s.hisato1020@gmail.com)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Env loading (.env.local) ─────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=')
  if (eqIdx > 0) {
    const key = line.slice(0, eqIdx).trim()
    const val = line.slice(eqIdx + 1).trim()
    if (key) process.env[key] = val
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY が未設定です')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Constants ────────────────────────────────────────────────────────────────

const PASSWORD = 'OpinioTest2026!'
const CLEAN_FIRST = process.env.CLEAN_FIRST === 'true'
const OUTPUT_FILE = path.resolve(__dirname, '.seed-sample-data-output.txt')

/** クリア時に保護する ow_users.id */
const PROTECTED_OW_USER_IDS = [
  'fe7dfe9b-75d4-4a75-a821-fa1a9599a416', // 柴久人 BIZ (hshiba@opinio.co.jp)
  'e826e0bd-f96b-42ec-acda-d8f482e1417d', // 柴久人 個人 (s.hisato1020@gmail.com)
]

/** クリア時に保護する ow_user_roles.user_id (= auth.users.id) */
const PROTECTED_AUTH_USER_ID = '7f358b59-2269-41fa-9324-4298c3c82cd2' // s.hisato1020@gmail.com

// ow_roles マスタ ID (migration 044 seed 済み、変更されない前提)
const ROLE = {
  // 親カテゴリ
  sales:     '89b056f4-ef14-4e4a-a71c-5fd5e4c4618a',
  pdm:       '15077bd6-0b80-49bf-875c-b5068a615de5',
  cs:        '093cd4bb-e610-464a-90b7-8caae04996c9',
  engineer:  'a905184b-2a26-4be6-8881-fa96e3b0d94a',
  marketing: '9ff6eb0c-4726-4d71-9d84-863b2e674f19',
  exec:      '3b29af59-7601-43ff-8a32-beec3ac5b084',
  other:     'd035e864-320a-4adb-97f0-05526d9be6db',
  // 子カテゴリ - 営業
  field_sales:      '59621df0-1959-4b1e-ad60-646eaf743f78',
  enterprise_sales: '1f0cfb55-cd74-4d5d-8ae5-785cffb6aadd',
  inside_sales:     '3cb22736-0f8e-4577-9ff2-37e01e033a09',
  sdr_bdr:          'd09ba32f-63fe-4bd2-9e1d-5c2b9a321a9a',
  // 子カテゴリ - PdM
  product_manager: 'dc8faead-c0d0-400d-9122-0a37246761ef',
  product_owner:   '2dc4180a-446e-4ad4-aa63-8e5b6a12979e',
  pmm:             '6a4119cc-be3b-445c-94ab-7f3dd72eb2fb',
  // 子カテゴリ - エンジニア
  backend:   '505bfb61-b757-4902-8678-1423f868e1a1',
  frontend:  '28c45e5c-e992-4076-98cb-e09784374a27',
  fullstack: '78d94d45-5a31-4646-8f6a-c8bbe12b7b2a',
  sre:       '40ed73c0-5f43-4256-8a5d-b8f184745ae6',
  mobile:    'b95c33cc-6765-42cf-8e6f-346696fb0ff7',
  // 子カテゴリ - その他
  designer:    '31e921fb-9d39-4ef4-97c0-616f34959a22',
  biz_dev:     '6a90e220-8c27-4c83-b8ed-fdbf9611f724',
  hrbp:        'f0e58e3d-5743-486b-b4d5-0154bb2ffed4',
  corporate:   '5c8057c4-4919-48d2-8f41-f40aa30d7a28',
  data_sci:    '0f281760-0cb1-4ec3-84c2-4c75b7039625',
  // 経営
  ceo: '98d05e86-4483-4f4f-a9da-6ef63af40161',
  cto: '8e4cc5e8-a8bf-4d5e-acbb-47baa833f767',
} as const

// アバターカラー 6色 (インデックスで循環)
const AVATAR_COLORS = [
  '#3B5FD9', // royal blue
  '#059669', // emerald
  '#D97706', // amber
  '#7C3AED', // purple
  '#DC2626', // red
  '#0891B2', // cyan
]

// ロゴグラデーション 6種
const LOGO_GRADIENTS = [
  'linear-gradient(135deg, #002366, #3B5FD9)',
  'linear-gradient(135deg, #064E3B, #059669)',
  'linear-gradient(135deg, #92400E, #D97706)',
  'linear-gradient(135deg, #4C1D95, #7C3AED)',
  'linear-gradient(135deg, #991B1B, #DC2626)',
  'linear-gradient(135deg, #164E63, #0891B2)',
]

// 30社分の industry/phase 定義
const COMPANY_META = [
  { industry: 'SaaS',     phase: 'シリーズA' },
  { industry: 'SaaS',     phase: 'シリーズA' },
  { industry: 'SaaS',     phase: 'シリーズB' },
  { industry: 'SaaS',     phase: 'シリーズB' },
  { industry: 'SaaS',     phase: 'シリーズC' },
  { industry: 'SaaS',     phase: 'シリーズC' },
  { industry: 'SaaS',     phase: '上場' },
  { industry: 'SaaS',     phase: '上場' },
  { industry: 'HRTech',   phase: 'シリーズA' },
  { industry: 'HRTech',   phase: 'シリーズB' },
  { industry: 'HRTech',   phase: 'シリーズC' },
  { industry: 'HRTech',   phase: '上場' },
  { industry: 'HRTech',   phase: '上場' },
  { industry: 'FinTech',  phase: 'シリーズA' },
  { industry: 'FinTech',  phase: 'シリーズB' },
  { industry: 'FinTech',  phase: 'シリーズC' },
  { industry: 'FinTech',  phase: '上場' },
  { industry: 'FinTech',  phase: '上場' },
  { industry: 'MA',       phase: 'シリーズA' },
  { industry: 'MA',       phase: 'シリーズB' },
  { industry: 'MA',       phase: 'シリーズC' },
  { industry: 'MA',       phase: '上場' },
  { industry: 'IT',       phase: 'シリーズA' },
  { industry: 'IT',       phase: 'シリーズB' },
  { industry: 'IT',       phase: 'シリーズC' },
  { industry: 'IT',       phase: '上場' },
  { industry: 'EdTech',   phase: 'シリーズA' },
  { industry: 'EdTech',   phase: 'シリーズB' },
  { industry: 'EdTech',   phase: 'シリーズC' },
  { industry: 'EdTech',   phase: '上場' },
]

// 求人タイトル 10種 (30件に循環適用)
const JOB_TITLES = [
  'バックエンドエンジニア',
  'フィールドセールス',
  'カスタマーサクセスマネージャー',
  'プロダクトマネージャー',
  'フロントエンドエンジニア',
  'インサイドセールス',
  'エンタープライズ営業',
  'SRE / インフラエンジニア',
  'マーケティングマネージャー',
  'データサイエンティスト',
]

const JOB_ROLE_IDS = [
  ROLE.backend,
  ROLE.field_sales,
  ROLE.cs,
  ROLE.product_manager,
  ROLE.frontend,
  ROLE.inside_sales,
  ROLE.enterprise_sales,
  ROLE.sre,
  ROLE.marketing,
  ROLE.data_sci,
]

// 社員の職種 10種ローテーション
const EMPLOYEE_ROLE_IDS = [
  ROLE.backend, ROLE.frontend, ROLE.field_sales, ROLE.cs,
  ROLE.product_manager, ROLE.inside_sales, ROLE.enterprise_sales,
  ROLE.sre, ROLE.marketing, ROLE.fullstack,
]

const EMPLOYEE_ROLE_TITLES = [
  'バックエンドエンジニア',
  'フロントエンドエンジニア',
  'フィールドセールス',
  'カスタマーサクセス',
  'プロダクトマネージャー',
  'インサイドセールス',
  'エンタープライズ営業',
  'SREエンジニア',
  'マーケター',
  'フルスタックエンジニア',
]

// メンターの相談テーマセット (6種ローテーション)
const MENTOR_THEME_SETS = [
  ['転職活動の進め方', 'SaaS営業のキャリア', '年収交渉'],
  ['エンジニアのキャリアパス', 'バックエンド技術選定', 'マネジメント転換'],
  ['CSキャリアの作り方', 'カスタマーサクセス転職', '業界研究'],
  ['プロダクトマネジメント入門', 'PdMへのキャリアチェンジ', 'スタートアップ転職'],
  ['BtoBマーケティング', 'コンテンツマーケ戦略', 'マーケキャリア'],
  ['スタートアップ転職', 'シリーズA-Bの組織実態', '創業メンバー転職'],
]

const MENTOR_DEPTS = [
  '営業', 'エンジニア', 'カスタマーサクセス',
  'PdM / PM', 'マーケティング', '経営・CxO',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** ゼロ埋め */
function pad(n: number, len = 3): string {
  return String(n).padStart(len, '0')
}

/** 循環インデックスで配列から取得 */
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

/** sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** エラーチェック付き Supabase 操作 */
function checkError(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`[${label}] ${error.message}`)
}

// ─── Step 0: Cleanup (CLEAN_FIRST=true 時のみ) ────────────────────────────────

async function cleanup(): Promise<void> {
  console.log('\n⚠️  CLEAN_FIRST=true: 削除対象の件数を確認します...')

  const targets: { table: string; label: string }[] = [
    { table: 'ow_experiences',    label: 'ow_experiences' },
    { table: 'ow_jobs',           label: 'ow_jobs' },
    { table: 'ow_company_admins', label: 'ow_company_admins' },
    { table: 'ow_companies',      label: 'ow_companies' },
    { table: 'ow_mentors',        label: 'ow_mentors' },
  ]

  for (const { table, label } of targets) {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
    console.log(`  ${label}: ${count ?? '?'} 件削除予定`)
  }
  console.log('  ow_user_roles: 保護対象(1件)を除いて削除')
  console.log(`  ow_users: 保護対象(2件)を除いて削除`)
  console.log('\n  ⚠️  auth.users は削除しません (絶対保護)')
  console.log('\n5 秒後に削除を実行します... (Ctrl+C で中断)\n')

  for (let i = 5; i > 0; i--) {
    process.stdout.write(`\r  ${i}秒...`)
    await sleep(1000)
  }
  console.log('\r  実行中...\n')

  // 1. ow_experiences (FK が最も末端)
  const { error: e1 } = await supabase
    .from('ow_experiences')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  checkError('cleanup ow_experiences', e1)
  console.log('  ✅ ow_experiences 削除完了')

  // 2. ow_jobs
  const { error: e2 } = await supabase
    .from('ow_jobs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  checkError('cleanup ow_jobs', e2)
  console.log('  ✅ ow_jobs 削除完了')

  // 3. ow_company_admins
  const { error: e3 } = await supabase
    .from('ow_company_admins')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  checkError('cleanup ow_company_admins', e3)
  console.log('  ✅ ow_company_admins 削除完了')

  // 3b. ow_saved_companies (FK → ow_companies, ON DELETE なし)
  const { error: e3b } = await supabase
    .from('ow_saved_companies')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  checkError('cleanup ow_saved_companies', e3b)
  console.log('  ✅ ow_saved_companies 削除完了')

  // 3c. ow_scouts (FK → ow_companies, ON DELETE なし)
  const { error: e3c } = await supabase
    .from('ow_scouts')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  checkError('cleanup ow_scouts', e3c)
  console.log('  ✅ ow_scouts 削除完了')

  // 4. ow_companies (ow_activities の company_id FK は SET NULL or CASCADE に注意)
  const { error: e4 } = await supabase
    .from('ow_companies')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  checkError('cleanup ow_companies', e4)
  console.log('  ✅ ow_companies 削除完了')

  // 5. ow_mentors
  const { error: e5 } = await supabase
    .from('ow_mentors')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  checkError('cleanup ow_mentors', e5)
  console.log('  ✅ ow_mentors 削除完了')

  // 6. ow_user_roles: 保護対象の auth.users.id を除外
  const { error: e6 } = await supabase
    .from('ow_user_roles')
    .delete()
    .neq('user_id', PROTECTED_AUTH_USER_ID)
  checkError('cleanup ow_user_roles', e6)
  console.log('  ✅ ow_user_roles 削除完了（保護アカウント除外）')

  // 7. ow_users: 保護対象の ow_users.id を除外
  const { error: e7 } = await supabase
    .from('ow_users')
    .delete()
    .not('id', 'in', `(${PROTECTED_OW_USER_IDS.join(',')})`)
  checkError('cleanup ow_users', e7)
  console.log('  ✅ ow_users 削除完了（保護アカウント除外）')

  console.log('\n🗑️  クリーンアップ完了\n')
}

// ─── Step A: auth.users 作成 (40件) ──────────────────────────────────────────

async function createAuthUsers(): Promise<{ bizAuthIds: string[]; userAuthIds: string[] }> {
  console.log('\n📋 Step A: auth.users を作成します (biz×30 + user×10 = 40件)')

  const bizAuthIds: string[] = []
  const userAuthIds: string[] = []

  // --- biz アカウント 30件 ---
  console.log('  biz アカウント作成中...')
  for (let i = 1; i <= 30; i++) {
    const email = `contact+biz${pad(i)}@opinio.co.jp`
    const name = `テスト担当者_${pad(i)}`

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { test_user: true, name },
    })

    if (error) {
      // email already exists → fetch existing UUID
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        console.warn(`  ⚠️  ${email} は既存 → UUID を取得して続行`)
        const listResult = await supabase.auth.admin.listUsers({ perPage: 1000 })
        const existingUser = (listResult.data?.users ?? []).find(
          (u: { email?: string; id: string }) => u.email === email
        )
        if (!existingUser) throw new Error(`${email} が auth.users に見つかりません`)
        bizAuthIds.push(existingUser.id)
      } else {
        throw new Error(`[createUser biz${pad(i)}] ${error.message}`)
      }
    } else {
      bizAuthIds.push(data.user!.id)
    }

    if (i % 10 === 0) console.log(`    ... ${i}/30 完了`)
  }

  // --- user アカウント 10件 ---
  console.log('  求職者アカウント作成中...')
  for (let i = 1; i <= 10; i++) {
    const email = `contact+user${pad(i, 2)}@opinio.co.jp`
    const name = `テストユーザー_${pad(i, 2)}`

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { test_user: true, name },
    })

    if (error) {
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        console.warn(`  ⚠️  ${email} は既存 → UUID を取得して続行`)
        const listResult = await supabase.auth.admin.listUsers({ perPage: 1000 })
        const existingUser = (listResult.data?.users ?? []).find(
          (u: { email?: string; id: string }) => u.email === email
        )
        if (!existingUser) throw new Error(`${email} が auth.users に見つかりません`)
        userAuthIds.push(existingUser.id)
      } else {
        throw new Error(`[createUser user${pad(i, 2)}] ${error.message}`)
      }
    } else {
      userAuthIds.push(data.user!.id)
    }
  }

  console.log(`  ✅ auth.users 作成完了: biz=${bizAuthIds.length}, user=${userAuthIds.length}`)

  // トリガー (on_auth_user_created) が ow_users を自動作成するまで待機
  console.log('  ⏳ DB トリガー (ow_users 自動作成) 待機中 (2秒)...')
  await sleep(2000)

  return { bizAuthIds, userAuthIds }
}

// ─── Step B: ow_companies (30社) ─────────────────────────────────────────────

async function insertCompanies(): Promise<string[]> {
  console.log('\n🏢 Step B: ow_companies を投入します (30社)')

  const rows = Array.from({ length: 30 }, (_, i) => {
    const idx = i + 1
    const meta = COMPANY_META[i]
    return {
      name: `テスト株式会社_${pad(idx)}`,
      industry: meta.industry,
      phase: meta.phase,
      tagline: `${meta.industry}領域で${meta.phase}のスタートアップ`,
      mission: `テスト株式会社_${pad(idx)} のミッション`,
      description: `テスト株式会社_${pad(idx)} の企業説明文です。${meta.industry} 領域で事業を展開しています。`,
      employee_count: [20, 50, 80, 150, 300, 500][i % 6],
      location: ['東京都渋谷区', '東京都港区', '東京都千代田区', '東京都新宿区', '大阪府大阪市'][i % 5],
      remote_work_status: (['full_remote', 'hybrid', 'on_site'] as const)[i % 3],
      logo_gradient: pick(LOGO_GRADIENTS, i),
      logo_letter: 'テ',
      is_published: true,
      accepting_casual_meetings: true,
      status: 'active',
      flex_time: i % 2 === 0,
      side_job_ok: i % 3 === 0,
      avg_age: 28 + (i % 8),
    }
  })

  const { data, error } = await supabase
    .from('ow_companies')
    .insert(rows)
    .select('id')
  checkError('insert ow_companies', error)

  const ids = data!.map((r: { id: string }) => r.id)
  console.log(`  ✅ ow_companies 投入完了: ${ids.length} 件`)
  return ids
}

// ─── Step C: ow_jobs (30件) ───────────────────────────────────────────────────

async function insertJobs(companyIds: string[]): Promise<void> {
  console.log('\n📋 Step C: ow_jobs を投入します (30件, 1社1件)')

  const rows = companyIds.map((companyId, i) => {
    const salaryBase = 400 + (i % 8) * 50
    return {
      company_id: companyId,
      title: pick(JOB_TITLES, i),
      job_category: pick(JOB_TITLES, i),
      role_category_id: pick(JOB_ROLE_IDS, i),
      employment_type: '正社員',
      status: 'active',
      salary_min: salaryBase,
      salary_max: salaryBase + 300 + (i % 4) * 100,
      location: ['東京都渋谷区', '東京都港区', '東京都千代田区', '東京都新宿区', '大阪府大阪市'][i % 5],
      remote_work_status: (['full_remote', 'hybrid', 'on_site'] as const)[i % 3],
      description_markdown: `## 仕事内容\n\nテスト株式会社_${pad(i + 1)} の ${pick(JOB_TITLES, i)} ポジションです。\n\nSaaS プロダクトの開発・運用を担当していただきます。`,
      required_skills: ['コミュニケーション能力', 'チームワーク', '自律的な行動'],
      preferred_skills: ['SaaS 業界経験', 'スタートアップ経験'],
      selection_steps: ['書類選考', '一次面接', '最終面接', 'オファー'],
    }
  })

  const { error } = await supabase.from('ow_jobs').insert(rows)
  checkError('insert ow_jobs', error)
  console.log(`  ✅ ow_jobs 投入完了: ${rows.length} 件`)
}

// ─── Step D: ow_users (130名) ─────────────────────────────────────────────────

async function setupOwUsers(
  bizAuthIds: string[],
  userAuthIds: string[],
): Promise<{
  bizOwUserIds: string[]
  userOwUserIds: string[]
  currentOwUserIds: string[]
  alumniOwUserIds: string[]
}> {
  console.log('\n👤 Step D: ow_users を設定します')

  // --- D-1: auth連携ユーザー (biz30 + user10) のアバター色を更新 ---
  // migration 032 のトリガーが auth.users 作成後に ow_users を自動作成済み。
  // name は user_metadata.name がトリガーで設定されるので、avatar_color のみ更新。
  console.log('  biz/user アカウントの ow_users を更新中...')

  const allAuthIds = [...bizAuthIds, ...userAuthIds]
  const { data: triggeredUsers, error: fetchErr } = await supabase
    .from('ow_users')
    .select('id, auth_id, email')
    .in('auth_id', allAuthIds)
  checkError('fetch triggered ow_users', fetchErr)

  const authToOwId = new Map<string, string>(
    (triggeredUsers ?? []).map((u: { id: string; auth_id: string }) => [u.auth_id, u.id])
  )

  // biz ユーザー: avatar_color を更新 + 不足分は INSERT
  const bizOwUserIds: string[] = []
  for (let i = 0; i < 30; i++) {
    const authId = bizAuthIds[i]
    const existingId = authToOwId.get(authId)

    if (existingId) {
      // トリガーで作成済み → avatar_color のみ更新
      await supabase
        .from('ow_users')
        .update({ avatar_color: pick(AVATAR_COLORS, i) })
        .eq('id', existingId)
      bizOwUserIds.push(existingId)
    } else {
      // トリガー未発火 → INSERT
      console.warn(`  ⚠️  biz${pad(i + 1)} の ow_users が未作成 → INSERT します`)
      const { data: inserted, error: insErr } = await supabase
        .from('ow_users')
        .insert({
          auth_id: authId,
          email: `contact+biz${pad(i + 1)}@opinio.co.jp`,
          name: `テスト担当者_${pad(i + 1)}`,
          avatar_color: pick(AVATAR_COLORS, i),
          visibility: 'public',
        })
        .select('id')
        .single()
      checkError(`insert biz ow_user ${i}`, insErr)
      bizOwUserIds.push(inserted!.id)
    }
  }

  // user ユーザー: 同様に処理
  const userOwUserIds: string[] = []
  for (let i = 0; i < 10; i++) {
    const authId = userAuthIds[i]
    const existingId = authToOwId.get(authId)

    if (existingId) {
      await supabase
        .from('ow_users')
        .update({ avatar_color: pick(AVATAR_COLORS, i + 2) })
        .eq('id', existingId)
      userOwUserIds.push(existingId)
    } else {
      console.warn(`  ⚠️  user${pad(i + 1, 2)} の ow_users が未作成 → INSERT します`)
      const { data: inserted, error: insErr } = await supabase
        .from('ow_users')
        .insert({
          auth_id: authId,
          email: `contact+user${pad(i + 1, 2)}@opinio.co.jp`,
          name: `テストユーザー_${pad(i + 1, 2)}`,
          avatar_color: pick(AVATAR_COLORS, i + 2),
          visibility: 'public',
        })
        .select('id')
        .single()
      checkError(`insert user ow_user ${i}`, insErr)
      userOwUserIds.push(inserted!.id)
    }
  }

  console.log(`  ✅ biz ${bizOwUserIds.length}名 / user ${userOwUserIds.length}名 完了`)

  // --- D-2: 現役社員 60名 (auth_id=null) ---
  console.log('  現役社員 60名を INSERT 中...')
  // 10名のうち is_mentor=true にする (インデックス 0,6,12,...,54 の10名)
  const mentorCurrentIndices = new Set([0, 6, 12, 18, 24, 30, 36, 42, 48, 54])
  const currentRows = Array.from({ length: 60 }, (_, i) => ({
    auth_id: null,
    email: `display-current-${pad(i + 1)}@seed.internal`, // 表示専用の仮メール
    name: `現役社員_${pad(i + 1)}`,
    avatar_color: pick(AVATAR_COLORS, i),
    visibility: 'public' as const,
    is_mentor: mentorCurrentIndices.has(i),
  }))

  const { data: currentData, error: currentErr } = await supabase
    .from('ow_users')
    .insert(currentRows)
    .select('id')
  checkError('insert current employees', currentErr)
  const currentOwUserIds = currentData!.map((r: { id: string }) => r.id)
  console.log(`  ✅ 現役社員 ${currentOwUserIds.length}名 完了`)

  // --- D-3: OB社員 30名 (auth_id=null) ---
  console.log('  OB社員 30名を INSERT 中...')
  const alumniRows = Array.from({ length: 30 }, (_, i) => ({
    auth_id: null,
    email: `display-alumni-${pad(i + 1)}@seed.internal`,
    name: `OB社員_${pad(i + 1)}`,
    avatar_color: pick(AVATAR_COLORS, i + 3),
    visibility: 'public' as const,
    is_mentor: false,
  }))

  const { data: alumniData, error: alumniErr } = await supabase
    .from('ow_users')
    .insert(alumniRows)
    .select('id')
  checkError('insert alumni employees', alumniErr)
  const alumniOwUserIds = alumniData!.map((r: { id: string }) => r.id)
  console.log(`  ✅ OB社員 ${alumniOwUserIds.length}名 完了`)

  return { bizOwUserIds, userOwUserIds, currentOwUserIds, alumniOwUserIds }
}

// ─── Step E: ow_company_admins (30件) ────────────────────────────────────────

async function insertCompanyAdmins(
  bizOwUserIds: string[],
  companyIds: string[],
): Promise<void> {
  console.log('\n🔑 Step E: ow_company_admins を投入します (30件)')

  const rows = companyIds.map((companyId, i) => ({
    user_id: bizOwUserIds[i],
    company_id: companyId,
    permission: 'admin' as const,
    is_active: true,
    role_title: '採用担当者',
  }))

  const { error } = await supabase.from('ow_company_admins').insert(rows)
  checkError('insert ow_company_admins', error)
  console.log(`  ✅ ow_company_admins 投入完了: ${rows.length} 件`)
}

// ─── Step F: ow_user_roles (10件) ────────────────────────────────────────────

async function insertUserRoles(bizAuthIds: string[], userAuthIds: string[]): Promise<void> {
  console.log('\n🎭 Step F: ow_user_roles を投入します')

  // 求職者10名 → candidate
  const candidateRows = userAuthIds.map((authId) => ({
    user_id: authId,     // ow_user_roles.user_id = auth.users.id
    role: 'candidate' as const,
  }))

  const { error: ce } = await supabase.from('ow_user_roles').insert(candidateRows)
  checkError('insert ow_user_roles candidate', ce)
  console.log(`  ✅ candidate role: ${candidateRows.length} 件`)

  // biz担当者30名 → company (biz ログインに必要)
  const companyRows = bizAuthIds.map((authId) => ({
    user_id: authId,
    role: 'company' as const,
  }))

  const { error: coe } = await supabase.from('ow_user_roles').insert(companyRows)
  checkError('insert ow_user_roles company', coe)
  console.log(`  ✅ company role: ${companyRows.length} 件`)
}

// ─── Step G: ow_experiences (90件) ───────────────────────────────────────────

async function insertExperiences(
  companyIds: string[],
  currentOwUserIds: string[],
  alumniOwUserIds: string[],
): Promise<void> {
  console.log('\n🏗️  Step G: ow_experiences を投入します (現役60件 + OB30件 = 90件)')

  // 現役: 各社2名ずつ (current[2*i], current[2*i+1] → company[i])
  const currentRows = companyIds.flatMap((companyId, ci) => [
    {
      user_id: currentOwUserIds[ci * 2],
      company_id: companyId,
      role_category_id: pick(EMPLOYEE_ROLE_IDS, ci * 2),
      role_title: pick(EMPLOYEE_ROLE_TITLES, ci * 2),
      started_at: `${2020 + (ci % 4)}-${String((ci % 12) + 1).padStart(2, '0')}-01`,
      ended_at: null,
      is_current: true,
      display_order: 0,
    },
    {
      user_id: currentOwUserIds[ci * 2 + 1],
      company_id: companyId,
      role_category_id: pick(EMPLOYEE_ROLE_IDS, ci * 2 + 1),
      role_title: pick(EMPLOYEE_ROLE_TITLES, ci * 2 + 1),
      started_at: `${2021 + (ci % 3)}-${String(((ci + 3) % 12) + 1).padStart(2, '0')}-01`,
      ended_at: null,
      is_current: true,
      display_order: 1,
    },
  ])

  // OB: 各社1名ずつ
  const alumniRows = companyIds.map((companyId, ci) => ({
    user_id: alumniOwUserIds[ci],
    company_id: companyId,
    role_category_id: pick(EMPLOYEE_ROLE_IDS, ci + 5),
    role_title: pick(EMPLOYEE_ROLE_TITLES, ci + 5),
    started_at: `${2018 + (ci % 4)}-${String((ci % 12) + 1).padStart(2, '0')}-01`,
    ended_at: `${2022 + (ci % 2)}-${String((ci % 12) + 1).padStart(2, '0')}-15`,
    is_current: false,
    display_order: 0,
  }))

  const allExperiences = [...currentRows, ...alumniRows]
  const { error } = await supabase.from('ow_experiences').insert(allExperiences)
  checkError('insert ow_experiences', error)
  console.log(`  ✅ ow_experiences 投入完了: 現役${currentRows.length}件 + OB${alumniRows.length}件`)
}

// ─── Step H: ow_mentors (30件) ───────────────────────────────────────────────

async function insertMentors(companyNames: string[]): Promise<void> {
  console.log('\n🎓 Step H: ow_mentors を投入します (30件)')

  const rows = Array.from({ length: 30 }, (_, i) => {
    const idx = i + 1
    const deptName = pick(MENTOR_DEPTS, i)
    const themes = pick(MENTOR_THEME_SETS, i)
    const companyName = companyNames[i] // current_company はテキスト参照

    return {
      name: `メンター_${pad(idx)}`,
      avatar_initial: 'メ',
      avatar_color: pick(AVATAR_COLORS, i),
      current_company: companyName,
      current_role: `${deptName}マネージャー`,
      current_career: `${companyName}にて${deptName}として活躍中`,
      previous_career: `前職では別のSaaS企業で${deptName}を経験`,
      roles: [deptName],
      question_tags: themes,
      concerns: themes,
      bio: `SaaS業界での${deptName}経験を活かしたキャリア相談が得意です。`,
      catchphrase: `${deptName}のキャリアを一緒に考えましょう`,
      worries: themes.slice(0, 2),
      is_available: true,
      success_count: 5 + (i % 20),
      total_sessions: 10 + (i % 40),
      display_order: idx,
    }
  })

  const { error } = await supabase.from('ow_mentors').insert(rows)
  checkError('insert ow_mentors', error)
  console.log(`  ✅ ow_mentors 投入完了: ${rows.length} 件`)
}

// ─── Step I: 結果ファイル出力 ─────────────────────────────────────────────────

async function writeOutputFile(bizAuthIds: string[], userAuthIds: string[]): Promise<void> {
  const now = new Date().toISOString()
  const lines: string[] = [
    `# Opinio サンプルデータ投入結果`,
    `# 実行日時: ${now}`,
    ``,
    `## 共通パスワード`,
    `Password: ${PASSWORD}`,
    ``,
    `## biz アカウント (企業担当者, 30件)`,
    ...Array.from({ length: 30 }, (_, i) =>
      `contact+biz${pad(i + 1)}@opinio.co.jp  auth_uuid=${bizAuthIds[i]}`
    ),
    ``,
    `## user アカウント (求職者, 10件)`,
    ...Array.from({ length: 10 }, (_, i) =>
      `contact+user${pad(i + 1, 2)}@opinio.co.jp  auth_uuid=${userAuthIds[i]}`
    ),
    ``,
    `## ログイン手順`,
    `1. https://opinio.jp/biz/auth → biz アカウントでログイン → /biz/dashboard`,
    `2. https://opinio.jp/auth → user アカウントでログイン → /mypage`,
  ]

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8')
  console.log(`\n📄 出力ファイル: ${OUTPUT_FILE}`)
}

// ─── 件数確認 ─────────────────────────────────────────────────────────────────

async function verifyCount(): Promise<void> {
  console.log('\n📊 投入後の件数確認:')
  const tables = [
    'ow_companies', 'ow_jobs', 'ow_users', 'ow_user_roles',
    'ow_company_admins', 'ow_mentors', 'ow_experiences',
  ]
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
    console.log(`  ${table.padEnd(25)} ${count ?? '?'} 件`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=' .repeat(60))
  console.log('🚀 Opinio サンプルデータ投入スクリプト')
  console.log(`   CLEAN_FIRST: ${CLEAN_FIRST}`)
  console.log(`   対象 DB: ${SUPABASE_URL}`)
  console.log('='.repeat(60))

  if (CLEAN_FIRST) {
    await cleanup()
  }

  // Step A: auth.users 作成
  const { bizAuthIds, userAuthIds } = await createAuthUsers()

  // Step B: ow_companies
  const companyIds = await insertCompanies()

  // Step C: ow_jobs
  await insertJobs(companyIds)

  // Step D: ow_users (biz/user は auth_id 連携, 現役/OB は display-only)
  const { bizOwUserIds, userOwUserIds, currentOwUserIds, alumniOwUserIds } =
    await setupOwUsers(bizAuthIds, userAuthIds)

  // Step E: ow_company_admins
  await insertCompanyAdmins(bizOwUserIds, companyIds)

  // Step F: ow_user_roles
  await insertUserRoles(bizAuthIds, userAuthIds)

  // Step G: ow_experiences
  await insertExperiences(companyIds, currentOwUserIds, alumniOwUserIds)

  // Step H: ow_mentors (company名はテキスト参照)
  const companyNames = Array.from({ length: 30 }, (_, i) => `テスト株式会社_${pad(i + 1)}`)
  await insertMentors(companyNames)

  // Step I: 出力ファイル
  await writeOutputFile(bizAuthIds, userAuthIds)

  // 件数確認
  await verifyCount()

  console.log('\n✅ 全ステップ完了！')
  console.log('\n🔗 確認 URL:')
  console.log('   求職者側: https://opinio.jp/companies')
  console.log('   企業詳細: https://opinio.jp/companies/<company_uuid>')
  console.log('   メンター: https://opinio.jp/mentors')
  console.log('   BIZ ログイン: https://opinio.jp/biz/auth')
  console.log('   管理画面: https://opinio.jp/admin')
}

main().catch((err) => {
  console.error('\n❌ エラーが発生しました:', err.message)
  process.exit(1)
})
