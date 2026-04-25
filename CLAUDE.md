# Opinio — Claude 作業ログ

## プロジェクト概要

IT/SaaS 業界に特化したキャリアプラットフォーム。
**求職者側プロダクト（Phase 2 + Phase 4）が 2026-04-24 に 100% 完成。**
**Phase 5 Stage 1（Supabase 接続 - 読み取り専用）が 2026-04-25 に完成。**

- **リポジトリ**: `/Users/hisato/opinio-work/`
- **ワークツリー**: `/Users/hisato/opinio-work/.claude/worktrees/silly-kowalevski-e4eca2/`
- **プレビューサーバー**: `localhost:3000`（`npm run dev` from worktree）
- **launch.json**: `/Users/hisato/opinio-work/.claude/launch.json`
- **モックHTML + 仕様書**: `/Users/hisato/opinio-mock/`
- **仕様書**: `/Users/hisato/opinio-mock/OPINIO_IMPLEMENTATION_SPEC.md`

> **重要**: dev サーバーは **ワークツリー** から起動している。
> ファイルは必ず worktree パスに書くこと。
> `/Users/hisato/opinio-work/src/...` に書いても反映されない。

---

## 🚀 次のセッションで最初にやること

```
Phase 5 Stage 1 完了済み（2026-04-25）本番マージ済み
次は Phase 5 Stage 2: 認証フロー（/auth サインアップ → ow_users 自動作成）
または Phase 3: 企業側プロダクト（/biz/*）
```

---

## 実装済みページ全一覧（2026-04-24 時点）

### Phase 2 — 求職者側 公開ページ（閲覧）

| ページ | パス | ファイル |
|--------|------|---------|
| トップ | `/` | `src/app/page.tsx` |
| 企業一覧 | `/companies` | `src/app/companies/page.tsx` |
| 企業詳細 | `/companies/[id]` | `src/app/companies/[id]/page.tsx` |
| 求人一覧 | `/jobs` | `src/app/jobs/page.tsx` |
| 求人詳細 | `/jobs/[id]` | `src/app/jobs/[id]/page.tsx` |
| メンター一覧 | `/mentors` | `src/app/mentors/page.tsx` |
| 記事一覧 | `/articles` | `src/app/articles/page.tsx` |
| 記事詳細 | `/articles/[slug]` | `src/app/articles/[slug]/page.tsx` |

### Phase 4 — 求職者側 対話アクションページ（2026-04-24 完成）

| ページ | パス | ファイル |
|--------|------|---------|
| プロフィール編集 | `/profile/edit` | `src/app/profile/edit/page.tsx` |
| マイページ | `/mypage` | `src/app/mypage/page.tsx` |
| カジュアル面談申込 | `/companies/[id]/casual-meeting` | `src/app/companies/[id]/casual-meeting/page.tsx` |
| メンター相談予約 | `/mentors/[id]/reserve` | `src/app/mentors/[id]/reserve/page.tsx` |

---

## Phase 4 実装サマリー（2026-04-24 完成）

### 実装規模

| フェーズ | ページ | 行数 |
|---------|--------|------|
| Phase 4a | `/profile/edit` | +11,368行 |
| Phase 4b | `/mypage` | +12,858行 |
| Phase 4c | `/companies/[id]/casual-meeting` | +13,634行 |
| Phase 4d | `/mentors/[id]/reserve` | +14,409行 |
| **Phase 4 合計** | | **+52,269行** |
| **プロジェクト累計** | | **約88,000行超** |

### Phase 4a: `/profile/edit`
- Notion スタイルサイドバー（基本情報 / キャリア / SNS / アカウント設定）
- 自動保存 700ms デバウンス（idle → saving → saved 3状態 UX）
- 会社名3パターン: master（MOCK_COMPANIES から検索）/ 自由入力 / 匿名表示
- 職種マスター: 2階層ドロップダウン（7カテゴリ × サブロール）
- キャリア CRUD: 追加・編集・削除・現職フラグ
- プロフィール完成度プログレスバー（6項目で計算）

### Phase 4b: `/mypage`
- 6ビュー切替（ダッシュボード / カジュアル面談 / メンター相談 / ブックマーク / 受けた相談 / スケジュール）
- `isMentor` トグル → サイドバーに「メンター管理」セクションを動的表示
- ステータスピル 6状態: pending(amber) / company_contacted(royal) / scheduled(purple) / completed(gray) / declined(error) / approved(success)

### Phase 4c: `/companies/[id]/casual-meeting`
- **在籍企業制約**（Hisato 思想）: `MOCK_PROFILE.experiences[isCurrent=true]` と企業 ID を照合し、在籍中なら申込不可表示
- 求人 ID 引き継ぎ: `?job_id=xxx` で宛先カードに求人情報表示、`× 紐づけを外す` で解除
- **warm orange グラデーション** CTA + 3ステップ成功モーダル

### Phase 4d: `/mentors/[id]/reserve`
- `mentor.themes` から相談テーマを動的生成（メンターごとに異なる）
- 5ステップフロー可視化（申請→編集部確認→メンター承認→日程調整→対話）
- 希望曜日7択 + 時間帯6択（`Set<string>`）
- **royal グラデーション** CTA + 無料バッジ（MVP期間配慮）+ 5ステップ成功モーダル

---

## デザインシステム

### CSS カスタムプロパティ（globals.css）
```css
--royal: #002366; --royal-50: #EFF3FC; --royal-100: #DCE5F7;
--accent: #3B5FD9; --success: #059669; --success-soft: #ECFDF5;
--warm: #F59E0B; --warm-soft: #FEF3C7;
--purple: #7C3AED; --purple-soft: #F3E8FF;
--error: #DC2626; --error-soft: #FEE2E2;
--ink: #0F172A; --ink-soft: #475569; --ink-mute: #94A3B8;
--line: #E2E8F0; --line-soft: #F1F5F9; --bg-tint: #F8FAFC;
```

### フォント・CTA
- フォント: `"Noto Serif JP"` 見出し / `"Noto Sans JP"` 本文 / `Inter` 数字・ラベル
- ステータスピル: pending(amber) / royal(pending_review) / purple(scheduled) / gray(completed) / error(declined) / success(approved)
- CTA 色: warm orange（カジュアル面談）/ royal blue（メンター予約・企業詳細）

---

## Hisato 思想（実装済み）

1. **キャリアを考え続ける人**: 「転職活動中」フラグなし。情報収集中でも使える
2. **Users 統合設計**: `is_mentor` フラグ1つで求職者↔メンター動的発動（マイページで実証済み）
3. **スカウトしない、採用を**: 企業→求職者へのスカウト機能なし。対話から始まる設計
4. **運営の丁寧な介在**: メンター登録は個別声がけ、相談は編集部が精査してから転送
5. **モニター期配慮**: 料金表示なし、無料バッジ（MVP期間中は無料）のみ
6. **在籍企業制約**: 現在在籍中の企業へのカジュアル面談申込を UI でブロック
7. **数値データ撤廃**: マッチ度%・星評価なし。求職者が自分で判断する
8. **position_members**: 各求人に「この職種を経験した人」を表示。snapshot思想
9. **取材時スナップショット**: 記事の `role_at_interview` + `current_status` で時制を両方表示

---

## モックデータ — 田中翔太さん（統一ペルソナ）

Phase 4 全体で使用している架空ユーザー。**変更した場合は全ファイルを整合させること。**

```typescript
// src/app/profile/edit/mockProfileData.ts
name: "田中 翔太"
email: "tanaka@example.com"
avatarColor: "linear-gradient(135deg, #002366, #3B5FD9)"

experiences: [
  {
    id: "exp-1",
    companyType: "master",
    companyId: "layerx",          // ← 在籍企業制約のデモキー
    displayCompanyName: "株式会社LayerX",
    roleCategoryId: "product_manager",
    roleTitle: "プロダクトマネージャー（Bakuraku事業）",
    startedAt: "2024-04",
    isCurrent: true,              // ← /companies/layerx/casual-meeting が blocked
  },
  { displayCompanyName: "株式会社タイミー", isCurrent: false },
  { displayCompanyName: "株式会社リクルート", isCurrent: false },
]
```

> **デモポイント**: `/companies/layerx/casual-meeting` → 「現在ご在籍中の企業です」表示

---

## 主要データモデル（mock）

### `src/app/companies/mockCompanies.ts`
- 12社収録: layerx / smarthr / hubspot / salesforce / ubie / freee / sansan / moneyforward / datadog / kubell / notion / pksha
- `MOCK_COMPANIES` export（`Company` 型）

### `src/app/jobs/mockJobData.ts`
- 15求人収録（12社）、`getJobById()`, `filterJobs()`, `getJobsByCompany()` export
- `PositionMember.is_mentor: true` で `/mentors` と紐づく

### `src/app/mentors/mockMentorData.ts`
- 17名収録、`MOCK_MENTORS`, `filterMentors()` export
- `id` は kebab-case（例: `watanabe-miho`）→ `/mentors/[id]/reserve` の URL

### `src/app/articles/mockArticleData.ts`
- 10記事収録: employee×2 / mentor×4 / ceo×2 / report×2

---

## ════════════════════════════════════════

## Phase 5: Supabase 接続

### ✅ Stage 1 完了（2026-04-24）

**対象ページ**: `/companies`, `/companies/[id]`, `/jobs`, `/jobs/[id]`

**新規ファイル**: `src/lib/supabase/queries.ts`
- `getCompanies()` — ow_companies 一覧
- `getCompanyById(id)` — ow_companies 詳細 + ow_jobs（そのカンパニーの求人）
- `getJobs()` — ow_jobs 一覧 + ow_companies（会社情報）
- `getJobById(id)` — ow_jobs 詳細 + ow_companies（会社情報）

**変更ファイル**:
- `companies/page.tsx` — `MOCK_COMPANIES` → `getCompanies()`（async Server Component）
- `companies/[id]/page.tsx` — `getCompanyDetail` → `getCompanyById()`
- `jobs/page.tsx` — `MOCK_JOBS` → `getJobs()`、`JobCard` に `companies` prop 追加
- `jobs/[id]/page.tsx` — `getJobById`(mock) → `fetchJobById`(Supabase)、`relatedJobs = []`

**継続 mock**: `/mentors`, `/articles`, Phase 4 ページ（profile/edit, mypage, casual-meeting, reserve）は mock のまま

---

## Phase 5 Stage 2 以降（未実装）

### Supabase 現状確認（2026-04-24 確認済み）

#### 環境・パッケージ（すべて準備完了）

| 項目 | 状態 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ 設定済み（.env.local） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ 設定済み |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ 設定済み |
| `@supabase/supabase-js` | ✅ v2.101.1 |
| `@supabase/ssr` | ✅ v0.10.0 |
| `src/lib/supabase/client.ts` | ✅ createBrowserClient 実装済み |
| `src/lib/supabase/server.ts` | ✅ createServerClient + cookies 実装済み |
| `src/lib/supabase/admin.ts` | ✅ service role client 実装済み |
| `src/lib/supabase/middleware.ts` | ✅ 実装済み |

#### テーブル確認結果（2026-04-24 時点）

| テーブル名 | 行数 | ID形式 | 状態 |
|-----------|------|--------|------|
| `ow_companies` | 13行 | UUID | ✅ データあり（全件 `is_published: false`） |
| `ow_jobs` | 25行 | UUID | ✅ データあり（全件 `status: "active"`） |
| `mentors` | 10行 | UUID | ✅ データあり（`ow_mentors` ではなく `mentors`） |
| `ow_users` | 23行 | UUID | ✅ データあり（auth.users連携済み） |
| `ow_roles` | 29行 | UUID | ✅ データあり |
| `ow_articles` | ❌ なし | — | 記事テーブルは存在しない |

#### mock vs Supabase 重要差分

| 差分 | mock データ | Supabase | 対応方針 |
|------|------------|----------|---------|
| **Company ID形式** | スラッグ（`"layerx"`） | UUID | URL を UUID ベースに変更 |
| **テーブル名** | ow_mentors 想定 | `mentors`（ow_ なし） | クエリで `mentors` を使う |
| **company.gradient** | `gradient` フィールド | `logo_gradient` | マッピング層で変換 |
| **company.is_published** | N/A | 全件 false | dev環境ではフィルター無効化 |
| **job_count** | 数値あり | 別途 COUNT 必要 | ow_jobs を JOIN or 0固定 |
| **mentor.initial** | `initial` フィールド | `avatar_initial` | マッピング層で変換 |
| **mentor.gradient** | `gradient` フィールド | `avatar_color` | マッピング層で変換 |
| **mentor.themes** | `themes: string[]` | `question_tags: string[]` | マッピング層で変換 |
| **career_chain** | 構造化配列 | テキスト（`current_career`, `previous_career`） | 簡略化 or パース |
| **position_members** | 構造化配列 | Supabase にない | 空配列でフォールバック |
| **記事** | mock 10件あり | テーブルなし | `/articles` は mock 継続 |

#### ow_companies 主要カラム（95カラム中、Stage 1 で使うもの）
```
id, name, tagline, mission, industry, phase,
employee_count, logo_gradient, logo_letter, logo_url,
location, url, remote_work_status, flex_time, side_job_ok,
accepting_casual_meetings, is_published, updated_at,
fit_positives, fit_negatives, why_join, description,
founded_year, avg_salary, avg_age, female_ratio
```

#### ow_jobs 主要カラム（50カラム中、Stage 1 で使うもの）
```
id, company_id, title, job_category, employment_type,
work_style, location, salary_min, salary_max,
description, requirements, preferred_skills, catch_copy,
one_liner, selection_process, status, published_at, updated_at,
remote_work_status
```

#### mentors 主要カラム（21カラム）
```
id, name, avatar_initial, avatar_color, bio, catchphrase,
current_company, current_role, current_career, previous_career,
roles, question_tags, worries, concerns,
is_available, success_count, total_sessions, display_order
```

---

### Phase 5 段階的実装ロードマップ

| 段階 | 内容 | 認証要否 | 状態 |
|------|------|---------|------|
| **Stage 1** | 読み取り専用ページ（/companies, /jobs） | 不要 | **✅ 完了（2026-04-25 本番マージ）** |
| Stage 2 | 認証フロー（/auth サインアップ → ow_users 自動作成） | 必要 | 未着手 |
| Stage 3 | プロフィール編集（/profile/edit 認証ガード + 自分のデータ） | 必要 | 未着手 |
| Stage 4 | マイページ（/mypage 認証ガード + 関連データ集約） | 必要 | 未着手 |
| Stage 5 | アクションページ（カジュアル面談・メンター予約の永続化） | 必要 | 未着手 |

---

### Stage 1 実装計画（詳細）

#### 作業ファイル一覧

**新規作成:**
```
src/lib/supabase/queries.ts   ← 型付きクエリ関数 + Supabase→mock型マッピング
```

**修正（list pages → Supabase fetch に切り替え）:**
```
src/app/companies/page.tsx    ← getCompanies() 呼び出し
src/app/jobs/page.tsx         ← getJobs() 呼び出し
src/app/mentors/page.tsx      ← getMentors() 呼び出し
```

**修正（detail pages → UUID で Supabase fetch）:**
```
src/app/companies/[id]/page.tsx          ← getCompanyById(uuid)
src/app/jobs/[id]/page.tsx               ← getJobById(uuid) + company JOIN
src/app/mentors/[id]/reserve/page.tsx    ← getMentorById(uuid)
```

**変更なし（mock 継続）:**
```
src/app/articles/page.tsx         ← ow_articles テーブルなし
src/app/articles/[slug]/page.tsx  ← mock 継続
src/app/companies/[id]/casual-meeting/page.tsx  ← Phase 5 Stage 5 で対応
```

#### queries.ts に実装する関数

```typescript
// src/lib/supabase/queries.ts

// ── Companies ──────────────────────────────────────────────────────
getCompanies(filter?: CompanyFilter): Promise<Company[]>
getCompanyById(id: string): Promise<Company | null>

// ── Jobs ───────────────────────────────────────────────────────────
getJobs(filter?: JobFilter): Promise<Job[]>     // ow_jobs JOIN ow_companies
getJobById(id: string): Promise<Job | null>     // company 情報込み

// ── Mentors ────────────────────────────────────────────────────────
getMentors(filter?: MentorFilter): Promise<Mentor[]>
getMentorById(id: string): Promise<Mentor | null>
```

#### カラムマッピング仕様

```
// Company型マッピング
ow_companies.id             → Company.id         (UUID そのまま使用)
ow_companies.name           → Company.name        (株式会社プレフィックス含む)
ow_companies.tagline        → Company.tagline
ow_companies.industry       → Company.industry
ow_companies.phase          → Company.phase
ow_companies.employee_count → Company.employee_count
ow_companies.logo_gradient  → Company.gradient    (null なら royal fallback)
ow_companies.logo_letter    → Company.initial     (null なら name[0])
ow_companies.accepting_casual_meetings → Company.accepting_casual_meetings
ow_companies.updated_at     → Company.updated_days_ago (daysSince 計算)
ow_companies.is_published   → Company.is_dimmed   (!is_published)
// work_styles: remote_work_status + flex_time + side_job_ok から推定

// Mentor型マッピング
mentors.id              → Mentor.id
mentors.avatar_initial  → Mentor.initial
mentors.avatar_color    → Mentor.gradient
mentors.name            → Mentor.name
mentors.current_company → Mentor.current_company
mentors.current_role    → Mentor.current_role
mentors.question_tags   → Mentor.themes
mentors.roles[0]        → Mentor.dept
mentors.is_available    → (フィルター用)
// career_chain: current_career + previous_career テキストから1-2ステップ生成

// Job型マッピング
ow_jobs.id              → Job.id
ow_jobs.company_id      → Job.company_id          (UUID)
ow_jobs.title           → Job.role
ow_jobs.job_category    → Job.dept
ow_jobs.employment_type → Job.employment_type
ow_jobs.location        → Job.location
ow_jobs.work_style      → Job.work_style
ow_jobs.salary_min      → Job.salary_min
ow_jobs.salary_max      → Job.salary_max
ow_jobs.catch_copy      → Job.highlight
ow_jobs.published_at    → Job.is_new (7日以内)
ow_jobs.updated_at      → Job.updated_days_ago
// position_members: [] (Supabase にないため空配列)
```

#### URL変更による影響

- `/companies/layerx` → `/companies/{uuid}` （**URL構造が変わる**）
- `/jobs/smarthr-csm` → `/jobs/{uuid}`
- `/mentors/watanabe-miho` → `/mentors/{uuid}`
- `casual-meeting/reserve` の内部リンクも UUID に更新が必要

> **注意**: Phase 4 で実装した `casual-meeting` ページの在籍企業制約は、
> Phase 5 Stage 5 で `ow_users.experiences` が整備されるまで mock 継続。

---

## 技術的注意事項

### ワークツリー使用
- Claude は必ず **ワークツリー** のパスにファイルを書く:
  `/Users/hisato/opinio-work/.claude/worktrees/silly-kowalevski-e4eca2/src/...`
- dev サーバーもワークツリーから起動している（launch.json の `npm run dev`）

### "use client" + Suspense パターン
- `useSearchParams()` を使う場合は Suspense でラップ必須（Next.js 14 要件）
- `useParams()` のみなら Suspense 不要
- Phase 4c（casual-meeting）は Suspense あり、Phase 4d（reserve）は Suspense なし
- **Phase 5 Stage 1**: list/detail pages は Server Component（`async`）にする

### Supabase Server Component パターン
```typescript
// Server Component（async）でのデータ取得
import { getCompanies } from "@/lib/supabase/queries";

export default async function CompaniesPage() {
  const companies = await getCompanies();
  return <CompanyList companies={companies} />;
}
```

### nativeInputValueSetter パターン（React state 更新）
- preview_fill や DOM 直接書き換えでは React state が更新されない
- eval で `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set` を使い、`new Event('input', { bubbles: true })` で発火

### 既知の TypeScript エラー（既存・非クリティカル）
```
src/app/companies/mockCompanies.ts(219,31): error TS2802
  Type 'Set<string>' can only be iterated through when using '--downlevelIteration'
```
- ビルド・動作には影響しない

---

## Phase 3: 企業側プロダクト（Phase 5 の後に着手）

- `/biz/auth` — 企業側ログイン
- `/biz/dashboard` — ダッシュボード（面談申込件数、求人一覧）
- `/biz/meetings` — カジュアル面談管理（pending → company_contacted → scheduled）
- `/biz/jobs` — 求人管理（CRUD）
- `/biz/company` — 企業情報編集
- `/biz/analytics` — 分析

---

## コミット履歴（直近）

```
feat: Phase 5 Stage 1 - switch 4 pages to Supabase live data (2026-04-25)
  - /companies: 13 companies from ow_companies
  - /companies/[id]: company detail with UUID-based URL
  - /jobs: 25 jobs from ow_jobs with filters
  - /jobs/[id]: job detail with ow_companies JOIN
  - Fix: lazy-init Supabase client in cron route
  - Fix: ESLint/TypeScript build errors (14 files)
  - Fix: /auth Suspense wrapper for useSearchParams

feat: Phase 4 complete + Phase 5 preparation (2026-04-24)
  - Phase 4a: /profile/edit (+11,368行)
  - Phase 4b: /mypage (+12,858行)
  - Phase 4c: /companies/[id]/casual-meeting (+13,634行)
  - Phase 4d: /mentors/[id]/reserve (+14,409行)
  - Phase 5 Stage 1 実装計画を CLAUDE.md に記載
  - Supabase 現状確認完了（テーブル・スキーマ・差分）

feat: Phase 4 complete - user-side product 100% done (2026-04-24)
feat: Phase 4b mypage — 6-view dashboard, is_mentor toggle, status pills
feat: Phase 4a profile/edit — auto-save, career CRUD, company 3-pattern
feat: Phase 2g articles (mock data, list, detail, cross-links)
```
