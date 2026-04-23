# Opinio — Claude 作業ログ

## プロジェクト概要

IT/SaaS 業界に特化したキャリアプラットフォーム。求職者側の閲覧体験（Phase 2）が完成済み。

- **リポジトリ**: `/Users/hisato/opinio-work/`
- **ワークツリー**: `/Users/hisato/opinio-work/.claude/worktrees/silly-kowalevski-e4eca2/`
- **プレビューサーバー**: `localhost:3000`（`npm run dev` from worktree）
- **launch.json**: `/Users/hisato/opinio-work/.claude/launch.json`

> **重要**: dev サーバーは **ワークツリー** から起動している。
> ファイルは必ず worktree パスに書くこと。
> `/Users/hisato/opinio-work/src/...` に書いても反映されない。

---

## Phase 2 完成ページ一覧（求職者側 公開ページ）

| ページ | パス | ファイル |
|--------|------|---------|
| 企業一覧 | `/companies` | `src/app/companies/page.tsx` |
| 企業詳細 | `/companies/[id]` | `src/app/companies/[id]/page.tsx` |
| 求人一覧 | `/jobs` | `src/app/jobs/page.tsx` |
| 求人詳細 | `/jobs/[id]` | `src/app/jobs/[id]/page.tsx` |
| メンター一覧 | `/mentors` | `src/app/mentors/page.tsx` |
| 記事一覧 | `/articles` | `src/app/articles/page.tsx` |
| 記事詳細 | `/articles/[slug]` | `src/app/articles/[slug]/page.tsx` |

---

## 主要データモデル

### `src/app/companies/mockCompanies.ts`
```typescript
type Company = {
  id: string; name: string; tagline: string; mission: string;
  industry: string; phase: string; employees: string;
  founded: string; hq: string; gradient: string;
  logo_url?: string; website?: string;
  highlights: string[]; tech_stack: string[];
}
```
- 12社収録: layerx / smarthr / hubspot / salesforce / ubie / freee / sansan / moneyforward / datadog / kubell / notion / pksha
- `MOCK_COMPANIES` export

### `src/app/companies/[id]/mockDetailData.ts`
- 企業詳細専用モックデータ（インタビュー・求人・文化スコアなど）
- `getDetailByCompanyId(id)` helper

### `src/app/jobs/mockJobData.ts`
```typescript
type Job = {
  id: string; company_id: string; role: string; dept: string;
  employment_type: string; location: string; work_style: string;
  salary_min: number; salary_max: number;
  tags: string[]; highlight: string;
  overview: string; main_tasks: string[];
  required_skills: string[]; preferred_skills: string[];
  benefits: BenefitRow[]; selection_flow: SelectionStep[];
  position_members: PositionMember[]; // ← Hisato思想の核心
  related_article_title: string; related_article_excerpt: string;
}

type PositionMember = {
  initial: string; gradient: string; name: string;
  catch: string; period: string; date: string;
  status: "current" | "moved" | "alumni";
  status_label: string; is_mentor: boolean;
}
```
- 15求人収録（12社）
- `MOCK_JOBS`, `filterJobs()`, `getJobById()`, `getJobsByCompany()` export
- `JOB_DEPTS`, `SALARY_PRESETS`, `WORK_STYLES`, `JOB_LOCATIONS` 定数

### `src/app/mentors/mockMentorData.ts`
```typescript
type Mentor = {
  id: string; initial: string; gradient: string;
  name: string; current_company: string; current_role: string;
  career_chain: { label: string; is_current: boolean }[];
  company_logos: { initial: string; gradient: string; name: string }[];
  themes: string[]; dept: string; industry: string;
  related_job_ids: string[]; related_company_ids: string[];
}
```
- 17名収録、mockJobData.ts の `position_members[is_mentor=true]` と完全一致
- `MOCK_MENTORS`, `filterMentors()`, `MENTOR_DEPTS`, `MENTOR_INDUSTRIES`, `MENTOR_THEMES` export

### `src/app/articles/mockArticleData.ts`
```typescript
type ArticleType = "employee" | "mentor" | "ceo" | "report";

type Article = {
  slug: string; type: ArticleType;
  title: string; subtitle: string; date: string; read_min: number;
  company_id: string; company_name: string;
  company_initial: string; company_gradient: string;
  eyecatch_gradient: string;
  subject?: ArticleSubject;      // employee/mentor/ceo
  subjects?: ArticleSubject[];   // report（複数）
  editor_note?: string;
  body?: string[]; quote?: string; qa?: QA[];
  editor_outro?: string;
  themes?: ThemeItem[];          // mentor のみ
  chapters?: Chapter[];          // report のみ
  related_job_ids: string[];
  related_article_slugs: string[];
}
```
- 10記事収録: employee×2 / mentor×4 / ceo×2 / report×2
- `MOCK_ARTICLES`, `getArticleBySlug()`, `filterArticles()` export
- `TYPE_BADGE`, `TYPE_EYECATCH_ICON`, `ARTICLE_TYPES` 定数

---

## ファイル構造

```
src/app/
├── page.tsx                        # トップページ（ArticlesPreview セクション含む）
├── globals.css                     # CSS変数（--royal, --accent, --success, etc.）
├── layout.tsx
├── companies/
│   ├── page.tsx                    # 企業一覧（Server Component + Suspense）
│   ├── CompanyFilterBar.tsx        # "use client" フィルター
│   ├── mockCompanies.ts            # 12社
│   └── [id]/
│       ├── page.tsx                # 企業詳細（2カラム・sidebar）
│       └── mockDetailData.ts
├── jobs/
│   ├── page.tsx                    # 求人一覧
│   ├── JobFilterBar.tsx            # "use client"
│   ├── mockJobData.ts              # 15求人
│   └── [id]/
│       └── page.tsx                # 求人詳細（position_members, 選考フロー）
├── mentors/
│   ├── page.tsx                    # メンター一覧
│   ├── MentorFilterBar.tsx         # "use client"
│   └── mockMentorData.ts           # 17名
├── articles/
│   ├── page.tsx                    # 記事一覧（4タイプ）
│   ├── ArticleFilterBar.tsx        # "use client"
│   ├── mockArticleData.ts          # 10記事
│   └── [slug]/
│       └── page.tsx                # 記事詳細（type別レンダリング）
└── ...（auth, business, dashboard など既存）

src/components/
└── common/
    ├── index.ts
    ├── Header.tsx
    └── Footer.tsx
```

---

## 設計思想（Hisato 思想）

1. **position_members**: 各求人に「この職種を経験した人」を表示。`status: current | moved | alumni` + `is_mentor` フラグで遷移状況を可視化
2. **取材時スナップショット**: 記事の `role_at_interview` + `current_status` で「取材時と現在」を両方見せる
3. **数値マッチスコアなし**: 求職者が自分で判断する設計
4. **データ整合性**: mockJobData ↔ mockMentorData ↔ mockArticleData で同一人物は同一 gradient/initial/name

---

## 技術的注意事項

### ワークツリー使用
- Claude は必ず **ワークツリー** のパスにファイルを書く:
  `/Users/hisato/opinio-work/.claude/worktrees/silly-kowalevski-e4eca2/src/...`
- dev サーバーもワークツリーから起動している（launch.json の `npm run dev`）

### 既知の TypeScript エラー（既存・非クリティカル）
```
src/app/companies/mockCompanies.ts(219,31): error TS2802
  Type 'Set<string>' can only be iterated through when using '--downlevelIteration'
```
- ビルド・動作には影響しない
- 直すなら `Array.from(new Set(...))` に置き換え

### Server Component + "use client" 分離
- ページ本体は Server Component（SEO・初期データ用）
- フィルターバーは `"use client"` + `<Suspense>` でラップ
- Server Component 内で `<style jsx>` は使わない → `<style>{}` タグで代替

### CSS カスタムプロパティ（globals.css）
```css
--royal: #002366; --royal-50: #EFF3FC; --royal-100: #DCE5F7;
--accent: #3B5FD9; --success: #059669; --success-soft: #ECFDF5;
--warm: #F59E0B; --warm-soft: #FEF3C7;
--purple: #7C3AED; --purple-soft: #F3E8FF;
--ink: #0F172A; --ink-soft: #475569; --ink-mute: #94A3B8;
--line: #E2E8F0; --bg-tint: #F8FAFC;
```

### Tailwind JIT 任意値
- 2カラムレイアウト: `className="grid gap-7 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]"`
- モバイル非表示: `className="hidden lg:flex"`

---

## 次に着手すべきタスク

### Phase 3: 企業側管理画面（Recruiter Side）
- `/business/` 配下のダッシュボード
- 求人投稿・編集フォーム
- 取材依頼・掲載管理
- Supabase の `business_*` テーブル連携

### Phase 4: ユーザー認証・マイページ
- `/auth/` ログイン・サインアップ（既存あり、要整理）
- `/mypage/` ブックマーク・応募履歴
- `/onboarding/` 初回登録フロー

### Supabase 接続（Phase 2 → 本番データ）
求職者側の各ページを mock から実データに切り替え:
1. `mockCompanies.ts` → `ow_companies` テーブル
2. `mockJobData.ts` → `ow_jobs` テーブル（現在未作成）
3. `mockMentorData.ts` → `ow_mentors` テーブル（現在未作成）
4. `mockArticleData.ts` → `ow_articles` テーブル（一部既存）

### コンテンツ拡充
- 企業詳細の `mockDetailData.ts` を全12社分作成（現在は一部のみ）
- メンター予約フロー `/mentors/[id]/reserve` の実装
- 求人応募フロー `/jobs/[id]/apply` の実装

---

## 直近コミット履歴（Phase 2 実装時）

```
feat: Phase 2g articles (mock data, list, detail, cross-links)
  - mockArticleData.ts: 10記事 × 4タイプ
  - /articles 一覧 + ArticleFilterBar
  - /articles/[slug] type別レンダリング
  - トップページ ArticlesPreview セクション
  - 求人詳細 → 記事リンク

feat: Phase 2f mentors (mock data, list, filter)
feat: Phase 2d/2e jobs (mock data, list, detail, position_members)
feat: Phase 2b/2c companies (mock data, list, detail)
```
