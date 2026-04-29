# 求職者側プロダクト設計書

**作成日**: 2026-04-28
**更新日**: 2026-04-29（Commit D: articles system 完了後に同期）
**対象 commit**: A〜F + サービス化セット B/F/C + D（求職者側公開ページ群 + 認証・プロフィール + 記事システム）
**ステータス**: 🟡 12ページ実装完了、5ページ残存

---

## 1. 概要

### 1-1. プロダクトの位置づけ

Opinio Work の求職者向け公開ページ群（`opinio.work`）。

IT/SaaS 業界に特化したキャリアプラットフォームの「ユーザー接点」側。  
企業情報・求人・メンター・記事の閲覧から、カジュアル面談申込・メンター予約・プロフィール管理まで、キャリアを考え続ける個人が使うすべての画面を担う。

biz 側（`business.opinio.co.jp`）と対になる「双子の地図」の片方:
- **`biz-members-multitenant.md`**: 企業側（採用担当者向け、M-4 設計）
- **`jobseeker-product.md`**: 求職者側（本ドキュメント、commits A〜F + 今後）

### 1-2. ターゲットユーザー

| 状態 | 説明 |
|------|------|
| 未認証 | 企業・求人・メンター・記事の閲覧のみ可能 |
| 認証済み（求職者） | カジュアル面談申込、メンター予約、プロフィール管理、マイページ |
| 認証済み（メンター） | 上記 + メンター管理セクション（`is_mentor=true` フラグで動的発動） |

### 1-3. 全体スコープ

仕様書（`/Users/hisato/Desktop/opinio-mock-package/OPINIO_IMPLEMENTATION_SPEC.md`）の **17 ページ**が対象。

| 状態 | 件数 |
|------|------|
| ✅ 実装済み（commits A〜F + サービス化セット + D） | 12 ページ |
| 🔲 未実装 | 5 ページ |
| **合計** | **17 ページ** |

---

## 2. 実装済みページ（commits A〜F）

### 2-0. 共通基盤（commit A）

**実装日**: 2026-04-28  
**commit**: `058d457`

| 項目 | 内容 |
|------|------|
| `(jobseeker)` route group | `src/app/(jobseeker)/layout.tsx` — URL に影響しない layout 分離 |
| `JobseekerHeader` | sticky blur ヘッダー。nav: 企業を見る / 求人を探す / メンター / 記事 / ログイン / 無料登録 |
| `JobseekerFooter` | 4 カラムフッター（求職者の方 / 企業の方 / 運営 + コピーライト） |
| `CompanyLogo` | `logo_url` 優先 → フォールバックグラデーション（`logo_gradient` + `logo_letter`） |
| migration 044 | 求職者側に必要な DB 変更（詳細は migration ファイル参照） |

### 2-1. トップページ（commit B）

**実装日**: 2026-04-28 / **commit**: `5a3d2f5`

| 項目 | 内容 |
|------|------|
| パス | `/` |
| ファイル | `src/app/(jobseeker)/page.tsx` |
| 移動元 | `src/app/page.tsx`（925 行、約 90% 仕様書準拠） |
| データソース | `getCompanies()`, `getJobs()`（Supabase） |
| 主な機能 | Hero タイプライターアニメーション追加、企業・求人プレビュー |
| スコープ外 | ArticlesPreview セクション（仕様書にないが暫定保持） |

### 2-2. 企業一覧（commit C）

**実装日**: 2026-04-28 / **commit**: `33c497a`

| 項目 | 内容 |
|------|------|
| パス | `/companies` |
| ファイル | `src/app/(jobseeker)/companies/page.tsx`（Server）+ `CompanyExplorer.tsx`（Client） |
| データソース | `getCompanies()` → `ow_companies`（全件、dev は `is_published` フィルターなし） |
| 主な機能 | キーワード検索（ローカル）、業界 / フェーズ / 働き方フィルター（URL クエリ）、12 件/ページ、新着順 / 社員数順 |
| スコープ外 | ブックマーク機能本格実装（UI のみ、`useState` トグル） |

### 2-3. 企業詳細（commit D）

**実装日**: 2026-04-28 / **commit**: `0d9f65e`

| 項目 | 内容 |
|------|------|
| パス | `/companies/[id]` |
| ファイル | `src/app/(jobseeker)/companies/[id]/page.tsx`（Server）+ `CompanyDetailClient.tsx`（Client: ブックマークボタンのみ） |
| データソース | `getCompanyById()` → `ow_companies` + `ow_jobs`（その企業の求人）、`getCompanyPhotos()` → `ow_company_office_photos`、`getCompanyRecruiters()` → `ow_company_admins` JOIN `ow_users` |
| 主な機能 | Breadcrumb、Hero（ブックマーク UI）、sticky TabsBar（アンカーリンク）、写真ギャラリー（最大 6 枚）、OpinionSection（データなし時 null）、WorkStyleSection、JobsSection、RecruitersSection（0 人時非表示）、Sidebar（sticky CTA） |
| スコープ外 | ブックマーク API 未接続（UI のみ）、Opinio 見解セクション（`fit_positives` / `fit_negatives` は表示ロジック実装済み、データ待ち） |

**技術メモ**: `ow_company_admins` は RLS により未認証では SELECT 不可 → `getCompanyRecruiters()` は anon 時に `[]` を返し、RecruitersSection は graceful hide。

### 2-4. 求人一覧（commit E）

**実装日**: 2026-04-28 / **commit**: `c184faf`

| 項目 | 内容 |
|------|------|
| パス | `/jobs` |
| ファイル | `src/app/(jobseeker)/jobs/page.tsx`（Server）+ `JobsClient.tsx`（Client） |
| データソース | `getJobs()` → `ow_jobs` JOIN `ow_companies` |
| 主な機能 | キーワード検索（ローカル）、職種 / 働き方 / 年収 / 業界フィルター（URL クエリ）、9 件/ページ、新着順 / 年収順 |
| 特記 | 職種オプションは `ow_jobs.job_category` から動的導出（mockJobData の固定値は不使用）、年収フィルターで `salary_max=0` の求人を除外（option A） |
| スコープ外 | お気に入り機能 |

### 2-5. 求人詳細（commit F）

**実装日**: 2026-04-28 / **commit**: `65e1888`

| 項目 | 内容 |
|------|------|
| パス | `/jobs/[id]` |
| ファイル | `src/app/(jobseeker)/jobs/[id]/page.tsx`（移動元: `src/app/jobs/[id]/page.tsx`） |
| データソース | `getJobById()` → `ow_jobs` + `ow_companies` |
| 主な機能 | ポジション概要、要件、会社情報サイドバー、関連求人（現状 `[]`）、`generateMetadata` |
| 修正内容 | Header/Footer 削除（layout が担う）、相対 import を絶対 import に変更 |
| 削除ファイル | `src/app/jobs/[id]/JobDetailClient.tsx`（794 行、未参照の孤立ファイル） |

---

## 3. 残タスク（12 ページ）

| # | カテゴリ | ページ | パス | データ要件 | 規模 |
|---|---------|------|------|----------|------|
| 1 | ✅ 認証 | サインアップ / ログイン | `/auth` | `ow_users` 既存、Supabase Auth | 中 |
| 2 | ✅ ユーザー | プロフィール編集 | `/profile/edit` | `ow_users` 基本フィールド（認証ガード） | 大 |
| 3 | ✅ ユーザー | マイページ | `/mypage` | `ow_users` 基本フィールド（職歴・ブックマーク等は mock） | 大 |
| 4 | ✅ ユーザー | ユーザープロフィール（公開） | `/u/[id]` ※ | `ow_users` 既存（RLS 委譲） | 中 |
| 5 | ✅ メンター | メンター一覧 + 詳細 | `/mentors`, `/mentors/[id]` | ✅ **Commit M-1** (`6e1fd79`) — `mentors` テーブル DB 接続済み（Server Component、フィルター、詳細ページ新設） | — |
| 6 | ✅ メンター | メンター予約 + 履歴 | `/mentors/[id]/reserve`, `/mypage` | ✅ **Commit M-2** (`2b84f6b`) — `ow_mentor_reservations` 接続済み（migration 045 で `mentor_id` 追加）、`/mypage` 相談履歴 DB 接続 | — |
| 7 | ✅ 記事 | 記事一覧 | `/articles` | ✅ **Commit D** (`178433d`) — `ow_articles` テーブル (migration 046) + `getArticles()` DB 接続 | — |
| 8 | ✅ 記事 | 記事詳細（社員）| `/articles/[slug]` | ✅ **Commit D** — type='employee' 対応済み（Q&A + MentorCTA 条件分岐） | — |
| 9 | ✅ 記事 | 記事詳細（メンター）| `/articles/[slug]` | ✅ **Commit D** — type='mentor' 対応済み（ThemesSection + MentorCTA） | — |
| 10 | ✅ 記事 | 記事詳細（CEO）| `/articles/[slug]` | ✅ **Commit D** — type='ceo' 対応済み（CompanyCTA） | — |
| 11 | ✅ 記事 | 記事詳細（取材レポート）| `/articles/[slug]` | ✅ **Commit D** — type='report' 対応済み（ChaptersSection + ContributorsSection） | — |
| 12 | アクション | カジュアル面談申込 | `/companies/[id]/casual-meeting` | `ow_casual_meetings` or 新規 | 中 |

**※** 仕様書では `/users/[id]` だったが `/u/[id]` に変更（§10-8 参照）

**注**: `/articles/[id]` は 4 タイプで URL 構造は同じだが、レイアウト・コンポーネントが異なるため規模大。記事タイプは `ow_articles.article_type` で分岐実装。

**ページ外機能タスク（ow_bookmarks）**:

| # | 機能 | 状態 | データ要件 |
|---|------|------|-----------|
| F-1 | ブックマーク（`target_type='company'`） | ✅ **Commit I** (`9c99ad3`) — 企業ブックマーク DB 接続完了。楽観的 UI + 認証ガード | `ow_bookmarks` 接続済み |
| F-2 | ブックマーク（`target_type='article' / 'mentor' / 'job'`） | 🔲 未実装 — `ow_articles` / `ow_mentors` テーブル未作成。求人ブックマーク UI も未実装 | 各テーブル新規作成後 |

---

## 4. データモデル

### 4-1. 既存テーブル（求職者側で利用中）

| テーブル | 用途 | 主要カラム |
|---------|------|----------|
| `ow_companies` | 企業一覧・詳細 | `id`, `name`, `tagline`, `industry`, `phase`, `logo_gradient`, `logo_letter`, `logo_url`, `is_published`, `fit_positives`, `fit_negatives` |
| `ow_jobs` | 求人一覧・詳細 | `id`, `company_id`, `title`, `job_category`, `employment_type`, `work_style`, `salary_min`, `salary_max`, `catch_copy`, `status`, `published_at` |
| `ow_company_office_photos` | 企業写真ギャラリー | `id`, `company_id`, `photo_url`, `category`, `display_order` |
| `ow_company_admins` | 採用担当者表示 | `id`, `user_id`, `company_id`, `department`, `role_title`, `permission`, `is_active` |
| `ow_users` | ユーザー情報（求職者・メンター兼用） | `id`, `name`, `avatar_color`, `auth_id`, `is_mentor` |
| `ow_roles` | 職種マスタ | `id`, `name`, `parent_id`（2 階層、8 カテゴリ） |
| `mentors` | メンター情報（`ow_` なし、既存テーブル） | `id`, `name`, `avatar_initial`, `avatar_color`, `question_tags`, `is_available` |

### 4-2. 新規必要なテーブル（今後の実装で追加）

| テーブル | 用途 | 状況 |
|---------|------|------|
| `ow_articles` | 記事（4 タイプ: employee / mentor / ceo / report） | ✅ **作成済み**（migration 046、10 件シード、RLS + 3 インデックス） |
| `ow_mentor_reservations` | メンター予約申請 | ✅ **既存・接続済み**（migration 045 で `mentor_id UUID REFERENCES mentors(id)` 追加、`mentor_user_id` nullable 化。`/api/mentor-reservations` POST + `/mypage` 相談履歴で利用中。`mentor_user_id` は NULL、`mentor_id` が有効パス） |
| `ow_bookmarks` | ブックマーク（企業・求人・メンター） | ✅ 既存・接続済み（`target_type='company'` のみ。記事・メンター・求人は §3 F-2 参照） |
| `ow_casual_meeting_requests` | カジュアル面談申込 | 未確認（`ow_casual_meetings` と重複の可能性あり） |

### 4-3. ow_companies のカラム注意点

```sql
-- is_published は現状全件 false（dev 環境では無効化）
-- fit_positives, fit_negatives は TEXT 型（JSON or 改行区切り要確認）
-- logo_url は NULL の企業が多い → CompanyLogo の gradient/letter フォールバック必須
```

---

## 5. 設計判断の記録

### 5-1. (jobseeker) route group パターン

Next.js App Router の route group を使用。`src/app/(jobseeker)/` 配下のファイルは、URL に `(jobseeker)` が含まれない（例: `src/app/(jobseeker)/companies/page.tsx` → `/companies`）。

**メリット**: `(jobseeker)/layout.tsx` で JobseekerHeader/Footer を一括適用。biz 側 layout と完全分離。

**旧ファイルとの conflict**: `src/app/companies/page.tsx`（旧）と `src/app/(jobseeker)/companies/page.tsx`（新）は URL が同じになり conflict するため、新ファイル作成後に旧ファイルを `git rm` するパターンが確立（commits C / D / E / F すべてで適用）。

### 5-2. Server Component + Client Component 分割

```
page.tsx（Server Component）: データ取得（async/await）
*Client.tsx（Client Component）: フィルター・ソート・ページネーション・アニメーション
```

- Server Component は `getXxx()` で初期データを取得し、props で Client Component に渡す
- `useSearchParams()` を使う Client Component は `<Suspense>` でラップ必須（Next.js 14 要件）
- `useParams()` のみ使う場合は Suspense 不要

### 5-3. フィルタリング設計

**クライアントサイドフィルタリング**（サーバーではなく）を採用。

理由: 求人・企業数が現状少ない（25 件・13 社程度）ため、全件取得してクライアントでフィルタリングする方がシンプル。データが 1000 件超えたらサーバーサイドフィルタリングへの移行を検討。

フィルター状態は URL クエリパラメータで管理（`?dept=エンジニア&work_style=フルリモート&page=2`）。  
→ シェア可能な URL、ブラウザバック対応。

### 5-4. dev 環境での is_published フィルター無効化

```typescript
// src/lib/supabase/queries.ts
const isDev = process.env.NODE_ENV === "development";
// isDev の場合は .eq("is_published", true) を適用しない
```

理由: 現状の DB は全企業 `is_published=false` のため、フィルターを掛けると一覧が空になる。dev では全件表示してテストを可能にする。

### 5-5. 共通コンポーネント

| コンポーネント | ファイル | 用途 |
|-------------|---------|------|
| `JobseekerHeader` | `src/app/(jobseeker)/layout.tsx` 内 | 求職者向けナビゲーション |
| `JobseekerFooter` | `src/app/(jobseeker)/layout.tsx` 内 | フッター |
| `CompanyLogo` | `src/app/(jobseeker)/layout.tsx` 内 or 共通 | logo_url → gradient/letter フォールバック |

### 5-6. ページネーション

9 件/ページ（企業一覧は 12 件/ページ）、URL クエリ `?page=N`。  
`Math.ceil(filtered.length / PER_PAGE)` でページ数計算。`safePage = Math.min(page, totalPages)` でオーバーフロー対応。

---

## 6. 既知の課題と技術的負債

### 6-1. mockJobData `JOB_DEPTS` と DB の不整合

**発見**: commit E 実装中

| | 値 |
|---|---|
| `mockJobData.ts` の `JOB_DEPTS` | `PdM / PM`, `エンジニア`, `営業`, `マーケティング`, `デザイナー`, `経営 / CxO`, `コーポレート` |
| 実 DB `ow_jobs.job_category` | `PdM`, `エンジニア`, `カスタマーサクセス`, `営業`, `フィールドセールス` |

**暫定対処**: `JobsClient.tsx` で `depts` を `allJobs.map(j => j.dept)` から動的導出（DB の実値を使用）。

> ✅ **更新 (2026-04-29, P2)**: P2 調査で `JOB_DEPTS` が完全な dead code（どこからも import なし）であることを確認。削除完了。  
> Commit E の動的 dept 導出が唯一の正規パス。表記ゆれの根本問題は §6-9 に記録。

### 6-2. `src/app/jobs/mockJobData.ts` への依存

`src/app/(jobseeker)/jobs/[id]/page.tsx`（commit F で移動済み）が型定義（`Job`, `PositionMember`）を `@/app/jobs/mockJobData` で参照している。

`mockJobData.ts` 自体は削除不可（型定義が含まれるため）。将来的には型定義を `src/types/job.ts` 等に分離するのが望ましい。

### 6-3. `ow_companies` 全件 `is_published=false`

現状の DB は全企業が `is_published=false`。dev では [5-4](#5-4-dev-環境での-is_published-フィルター無効化) の方針でフィルター無効化。

本番運用前に「公開する企業」を明示的に切り替える運用ルールが必要。企業側 `/biz/company` の「公開する」ボタン（PATCH エンドポイント実装済み）を使って個別に切り替える。

### 6-4. RLS による表示除外

`ow_companies` の RLS で `status='active'` 以外は除外。HubSpot Japan (`status=pending`)、Third Box (`status=inactive`) は表示されない。設計通り（意図的）。

### 6-5. `mentors` テーブル名（`ow_` プレフィックスなし）

仕様書は `ow_mentors` を想定していたが、実際の DB テーブル名は `mentors`（`ow_` なし）。  
`getMentors()` / `getMentorById()` を `queries.ts` に追加する際は `.from("mentors")` を使う。

> ✅ **更新 (2026-04-30, Commit M-1)**: `getMentors()` / `getMentorById()` を `queries.ts` に実装済み（`.from("mentors")`）。  
> 命名規約の問題は §6-X+2 に詳細記録。

### 6-X+2. `mentors` テーブルと `ow_users` の未連携（Commit M-2 で発見）

**発見**: Commit M-2 実装中（2026-04-30）

**問題**:
- `mentors` テーブル（migration 008）は `ow_users` と独立しており、`user_id` カラムが存在しない
- 仕様書設計時の `ow_mentor_reservations.mentor_user_id NOT NULL REFERENCES ow_users(id)` が INSERT 不可能な状態だった（設計矛盾）

**対処（migration 045）**:
- `ow_mentor_reservations` に `mentor_id UUID REFERENCES mentors(id)` カラムを追加
- `mentor_user_id` を nullable 化
- INSERT 時は `mentor_id = mentors.id`、`mentor_user_id = NULL` で記録

**現状の動作**:
- 求職者は予約 INSERT 可能（`user_id = ow_users.id`、`mentor_id = mentors.id`）
- メンター本人による自分宛予約の閲覧は**未対応**（RLS の `mentor_read` ポリシーが `mentor_user_id` ベースのため、NULL では機能しない）
- `mentor_user_id` は NULL のまま、将来連携時に埋める設計

**将来の課題（M-5 候補）**:
- `mentors` テーブルと `ow_users` の統合または明示的な連携（`mentors.user_id UUID REFERENCES ow_users(id)` 追加）
- メンター本人による予約閲覧 + 承認フロー
- メンター登録フロー（現状は手動で `mentors` テーブル直接操作、編集部が個別声がけ方針）

### 6-X+3. `mentors` テーブルの命名規約逸脱

**発見**: Commit M-1 実装中（2026-04-30）

`mentors` テーブルは migration 008 で作成された時点で `ow_` プレフィックスがついていない。  
他のすべてのアプリテーブルは `ow_` プレフィックスで統一（`ow_users`, `ow_companies`, `ow_jobs` 等）。

**考えられる理由**:
- マスタデータ的な扱い（公開プロフィールカタログ、Opinio 編集部が手動管理）
- `ow_users` と未紐付けの独立データ（意図的な分離設計）
- migration 008 が初期 prototype 段階に作成されたため命名規約が未確立だった可能性

**将来の対応（M-5 候補）**:
- `ow_mentors` にリネームする migration（命名規約統一）
- `ow_users` と紐付けた場合は `user_id` カラム追加も同時実施
- `mentors` → `ow_mentors` のリネーム時は `queries.ts`, migration 045 FK も更新が必要

### 6-6. `ow_company_admins` が anon では SELECT 不可

RLS により未認証ユーザーは `ow_company_admins` を読めない。  
→ `getCompanyRecruiters()` は anon 時にエラーを catch して `[]` を返す（best-effort）。  
→ 企業詳細ページの RecruitersSection は `recruiters.length > 0` の条件で graceful hide。

将来的に採用担当者を公開情報として扱う場合は、RLS ポリシーの変更が必要。

### 6-7. `(jobseeker)/page.tsx` の既存コンパイルエラー

`src/app/(jobseeker)/page.tsx:635` にコンパイルエラーが存在（`Unexpected token 'section'`）。commit B 以前からの問題。  
ページの動作には影響しない（HMR が部分的にスキップする）が、根本原因の調査が必要。

### 6-9. `ow_roles` マスタ vs `ow_jobs.job_category` の表記ゆれ（P2 調査で発見）

**発見**: P2 タスク（JOB_DEPTS 整合性解消）の調査中

| `ow_roles` 親カテゴリ | DB 実値（`ow_jobs.job_category`）| ステータス |
|----------------------|--------------------------------|-----------|
| 営業 | `営業` | ✅ 一致 |
| PdM / PM | `PdM` | ⚠ 表記ゆれ（スラッシュなし） |
| カスタマーサクセス | `カスタマーサクセス` | ✅ 一致 |
| エンジニア | `エンジニア` | ✅ 一致 |
| マーケティング | （求人なし） | — |
| 経営・CxO | （求人なし） | — |
| その他 | （求人なし） | — |
| — | `フィールドセールス` | ⚠ 子カテゴリが直接格納（`ow_roles` では「営業」の子） |

**根本問題**:
- `ow_jobs.job_category` が `TEXT`（free text）、ENUM / FK 制約なし
- 求人作成 UI（`JobEditForm.tsx`）は独自の `JOB_CATEGORIES` 定数でバリデーション、`ow_roles` テーブルとは非連動
- 結果として `ow_roles` と乖離した値が DB に格納される可能性がある

**現在の影響範囲**:
- 求職者側フィルター（`JobsClient.tsx`）は動的導出なので実害なし
- biz 側フィルター（`JobsClient.tsx:79`）も `jobCategory` 文字列で動作中
- `lib/utils/jobCategoryStyle.ts` は部分一致判定のため表記ゆれに耐性あり

**将来の解決方向**（M-5 候補、§9 参照）:
- `ow_jobs.job_category` を `ow_roles.id` への FK に変更（migration）
- 既存データのマイグレーション（`PdM` → `PdM / PM` に対応する id 等）
- 求人作成 UI を `ow_roles` マスタから動的生成するよう変更

### 6-X. E2E 実機検証履歴（2026-04-29）

P3 で導入した `scripts/get_session_cookie.mjs` + curl を使い、Claude Code 駆動で実機 E2E 検証を実施。

**検証方法**: `node scripts/get_session_cookie.mjs hshiba@opinio.co.jp` で Cookie を取得 → curl で API 叩く → service_role client で DB 状態を直接確認。クリーンアップ込み。

| Commit | ハッシュ | 検証内容 | 結果 | 備考 |
|--------|---------|---------|------|------|
| B (サービス化) | `54575d4` | `GET /api/roles` → `["candidate","company"]`、`ow_user_roles` に role='candidate' 存在確認 | ✅ | `ow_user_roles.user_id` = `auth_id`（`ow_users.id` ではない）。初回 DB クエリは ID 混同で空に見えたが正常 |
| F (サービス化) | `c5af352` | `PUT /api/jobseeker/profile` → `about_me` 更新 → DB 反映確認 → cleanup (null に戻す) | ✅ | 許可フィールドのみ更新される whitelist 設計が正常動作 |
| I | `9c99ad3` | `POST /api/bookmarks` → 1行追加、重複 POST → 1行のまま (UPSERT)、`DELETE` → 0行 | ✅ | べき等性・クリーンアップ全 PASS |
| G | `d0bebfe` | `POST /api/casual-meetings` → `{id, status:"pending"}` 返却、DB 行確認（intent/contact_email 正常）、cleanup (DELETE) | ✅ | `accepting_casual_meetings=true` の企業 (SmartHR) で確認 |
| J | `95d8bf7` | `GET/POST/PUT/DELETE /api/jobseeker/experiences`。3パターン XOR（company_id/company_text/company_anonymized）、XOR 違反 → 400、slug→UUID ロール変換（エンジニア）、GET での UUID→slug 逆引き（"engineer" 返却）、cleanup | ✅ | RLS テストは他ユーザーの experiences 0件のためスキップ。started_at "YYYY-MM" → DB DATE "YYYY-MM-01" 変換 PASS |
| L | `baad773` | 求人応募 API: 未認証 → 401、job_id 欠落 → 400、正常応募 → 201 + DB 行確認、重複応募 → 409、apply ページ認証リダイレクト確認 | ✅ | cleanup (DELETE) 済み。UNIQUE制約は未追加 (設計書 §6 M-5 に記録) |
| Commit U | (pending) | UNIQUE 制約 (migration 047) + API 23505→409。S-T-1: 制約確認（23505 + constraint name 正確）。S-T-2: アプリ層 1回目→201、2回目→409。S-T-3: service_role 直接 INSERT → 409 + 23505 エラー（race condition 対応証明）。S-T-4: 既存ページ影響なし。S-T-5: cleanup 0件確認 | ✅ | S-T-1〜5 全 PASS |
| K (検証) | — | `/jobs/[id]` DB 接続済み確認 (S-P-1〜8)。200/404、apply ボタン、カジュアル面談リンク、一覧→詳細遷移、既存ページ影響なし | ✅ | 新規コードなし。mockJobData は型のみ参照（実データなし）を確認 |
| M-1 + M-2 | `6e1fd79` + `2b84f6b` | メンター一覧/詳細/予約/履歴 DB 接続実機検証 (Phase S-Q, S-R)。未認証リダイレクト 307、認証済みページ 200、POST → 201 + DB 行確認（mentor_id, themes, status=pending_review 正常）、重複予約挙動確認、既存ページ影響なし、mock 参照ゼロ確認、E2E データクリーンアップ | ✅ | S-Q-1〜8 + S-R-1〜8 全 PASS。`mentors` テーブル / `ow_users` 未連携問題を発見 → migration 045 で解決 |
| Commit D | `178433d` | 記事システム実機検証 (Phase E2E-D)。S-D-1: 10件 seed 確認（employee×2 / mentor×4 / ceo×2 / report×2、全 is_published=true）。S-D-2: /articles 200。S-D-3: 4タイプ詳細ページ全 200（layerx-suzuki/layerx-nakamura/smarthr-ceo/hubspot-report）。S-D-4: 存在しない slug → 404。S-D-5: type フィルター全 type 200、記事数が DB と整合（employee:2/mentor:4/ceo:2/report:2）。S-D-6: anon 読み取り可（content-range: 0-9/10）。S-D-7: 既存ページ影響なし (/, /companies, /jobs, /mentors → 200; /mypage, /biz/dashboard → 307) | ✅ | S-D-1〜7 全 PASS。新規コード追加なし |

**検証対象外**（ブラウザ UI 操作、フォーム入力等）: 柴さん本人が任意のタイミングで実施可能。

### 6-X+1. /jobs/[id] の mockJobData 依存状況（Commit K 調査結果）

**判明した実態（2026-04-29）**:
- `src/app/(jobseeker)/jobs/[id]/page.tsx` は `getJobById()` (queries.ts) で ow_jobs に**接続済み**
- `mockJobData` は `type Job` / `type PositionMember` の **型参照のみ**、実データはゼロ
- Commit K = 「DB 接続化」ではなく「接続済みを確認」として close

**残存する空フィールド（データ品質課題）**:

| フィールド | mapJob での対応 | DB 実値 | 表示への影響 |
|---|---|---|---|
| `overview` | `description` カラム | `""` (空) | 概要セクションが空 |
| `main_tasks` | 常に `[]` | 対応カラムなし | メイン業務リスト空 |
| `required_skills` | `requirements` / `required_skills` | `null` | 必須スキル空 |
| `preferred_skills` | `preferred_skills` | `null` | 歓迎スキル空 |
| `benefits` | 常に `[]` | `benefits` は `null` | 待遇セクション空 |
| `selection_flow` | `selection_process` | `[]` | 選考フロー空 |
| `position_members` | 常に `[]` | DB にテーブルなし | 経験者セクション空 |

コード側は空配列・null を考慮した実装済み。データ補充は M-5 で対応。

**将来の改善候補（M-5）**:
- `type Job` / `type PositionMember` を `src/types/job.ts` 等の独立ファイルに移動 → `mockJobData.ts` 完全削除可能にする
- 空フィールドのセクションを非表示にする条件分岐（現状は空セクションが描画される）

### 6-8. `DashboardView` クロージャーバグ（発見 + 修正: サービス化セット F）

**症状**: `MypageClient.tsx` の `DashboardView` サブコンポーネントが、親スコープの変数（`userCover`, `userAvatar`, `userInitial`, `userName`）を参照しようとして `ReferenceError`。

**原因**: `DashboardView` は `MypageClient` 内で定義された独立関数だが、変数は `MypageClient` の関数スコープにのみ存在し、クロージャーでは共有されない（コンポーネントを別関数として定義するパターンでは親スコープは見えない）。

**修正**: `DashboardView` の関数シグネチャに明示的な props を追加し、呼び出し元から渡すパターンに変更:
```typescript
function DashboardView({
  isMentor, onNavigate, userName, userInitial, userAvatar, userCover,
}: {
  isMentor: boolean; onNavigate: (v: ActiveView) => void;
  userName: string; userInitial: string; userAvatar: string; userCover: string;
})
```

**教訓**: Next.js / React では、ファイル内で定義した「サブコンポーネント関数」は親コンポーネントのスコープを共有しない。変数が必要なら必ず props で渡す。ネストされた関数（return 内で直接定義）であれば共有できるが、可読性・再利用性の観点から推奨しない。

---

## 7. UX 統一の取り組み

### 7-1. 一覧 → 詳細の Header/Footer 一貫性（commit F）

**課題**: commit E で `/jobs`（求職者 layout）から求人カードをクリックすると `/jobs/[id]`（旧 default layout）に遷移し、ヘッダーがハンバーガーメニューに変わる UX 違和感が発生。

**解決**: commit F で `src/app/jobs/[id]/page.tsx` を `src/app/(jobseeker)/jobs/[id]/page.tsx` に移動。  
移動コスト: 相対 import 修正 1 箇所（`../mockJobData` → `@/app/jobs/mockJobData`）+ Header/Footer 削除 4 行のみ。  
孤立ファイル `JobDetailClient.tsx`（794 行、`page.tsx` から未参照）も同時削除。

### 7-2. 今後の UX 統一課題

| ページ | 課題 | 対処方針 |
|--------|------|---------|
| `/companies/[id]/casual-meeting` | 旧実装が mock データ + 独自 Header を使用（Phase 4c の実装） | ✅ **解消済み**（Commit G — (jobseeker) 配下に移動 + Supabase 接続、旧 mock page 削除） |
| `/mentors/[id]/reserve` | 旧実装が mock データ + 独自 Header を使用（Phase 4d の実装） | ✅ **解消済み**（Commit M-2 — `(jobseeker)` 配下に移動 + Server ラッパー/Client Form 分離 + Supabase 接続、旧 mock page 削除） |
| `/profile/edit` | 旧実装が mock データ + 独自 Header を使用（Phase 4a の実装） | ✅ **解消済み**（サービス化セット F — (jobseeker) 配下に移動 + Supabase 基本接続） |
| `/mypage` | 旧実装が mock データ + 独自 Header を使用（Phase 4b の実装） | ✅ **解消済み**（サービス化セット F — (jobseeker) 配下に移動 + Supabase 基本接続） |

### 7-3. メンターシステム実装（Commit M-1 + M-2）

| 項目 | 詳細 |
|------|------|
| `/mentors` 一覧 | 旧 `src/app/mentors/` から `(jobseeker)/mentors/` に移動 + `getMentors()` DB 接続（Commit M-1） |
| `/mentors/[id]` 詳細 | 新規実装（Commit M-1）。`catchphrase`, `bio`, `concerns[]` 等の DB フィールドを活用 |
| `/mentors/[id]/reserve` | Server ラッパー + Client Form パターンで Supabase 接続（Commit M-2）。Commit G カジュアル面談と同一パターン |
| `/mypage` 相談履歴 | `MOCK_MENTOR_RESERVATIONS` → `ow_mentor_reservations` JOIN `mentors` DB 接続（Commit M-2） |
| CTA 動線変更 | 一覧カード → 直接 reserve から、**一覧 → 詳細 → reserve** の 3 ステップに変更。メンターを十分理解した上で申し込む設計 |
| migration 045 | `ow_mentor_reservations.mentor_id` 追加 + `mentor_user_id` nullable 化（`mentors` / `ow_users` 未連携への対処） |

---

## 8. Implementation History

| Phase | Commit | ハッシュ | 内容 |
|-------|--------|---------|------|
| 共通基盤 | A | `058d457` | (jobseeker) route group + JobseekerHeader/Footer + CompanyLogo + migration 044 |
| ページ移動 | B | `5a3d2f5` | `/`（トップページ）を (jobseeker) 配下に移動 + Hero タイプライターアニメーション追加 |
| 企業一覧 | C | `33c497a` | `/companies` + キーワード/業界/フェーズ/働き方フィルター + 12 件/ページ |
| 企業詳細 | D | `0d9f65e` | `/companies/[id]` + 写真ギャラリー（最大 6 枚）+ 採用担当者（anon は graceful hide） |
| 求人一覧 | E | `c184faf` | `/jobs` + 動的 dept 導出（DB 実値）+ 年収フィルター（salary_max=0 除外） |
| 求人詳細移動 | F | `65e1888` | `/jobs/[id]` を (jobseeker) 配下に移動。Header/Footer 統一。孤立 JobDetailClient 削除 |
| サービス化セット | B（サービス化） | `54575d4` | `/auth` 求職者用（サインアップ・ログイン）Supabase Auth 接続 |
| サービス化セット | F（サービス化） | `c5af352` | `/mypage` + `/profile/edit` を (jobseeker) 配下に移動 + Supabase 接続（§10-9 参照） |
| サービス化セット | C（サービス化） | `e53daf0` | `/u/[id]` 公開プロフィール（Server Component、RLS 委譲、URL 変更は §10-8 参照） |
| 機能拡充 | I | `9c99ad3` | ブックマーク機能本格実装（`ow_bookmarks` 接続、楽観的 UI、認証ガード、`target_type='company'` のみ、§10-10 参照） |
| 機能拡充 | G | `d0bebfe` | カジュアル面談申込フロー（`POST /api/casual-meetings`、Server Component auth guard、accepting_casual_meetings チェック、mypage CasualView 実データ接続） |
| ツール整備 | P3 | `2268515` | `scripts/get_session_cookie.mjs` 正式化（Magic Link 方式、email 引数汎用化）+ `scripts/README.md` |
| E2E 検証 | Phase E2E | — | Commit B/F/I/G の実機 API 検証（§6-X 参照）。全 PASS、DB 汚染なし |
| 職歴 CRUD | J | `95d8bf7` | `GET/POST/PUT/DELETE /api/jobseeker/experiences`、slug↔UUID 変換、profile/edit CareerModal DB 接続、/u/[id] 職歴セクション実データ化 |
| E2E 検証 | Phase E2E-J | — | Commit J の実機 API 検証（§6-X 参照）。全 PASS、DB 汚染なし |
| 応募機能 | L | `baad773` | `POST /api/applications`、`/jobs/[id]/apply` ページ・フォーム、求人詳細「正式に応募する」ボタン、`/mypage/applications` テーブル/カラム名バグ修正 |
| 検証 | K (検証) | — | `/jobs/[id]` DB 接続済みを S-P-1〜8 で実機確認。mockJobData 型参照のみを文書化（§6-X+1 参照） |
| メンターシステム | M-1 | `6e1fd79` | `/mentors` 一覧 + `/mentors/[id]` 詳細 新規実装（DB 接続、`(jobseeker)` route group 移行） |
| メンターシステム | M-2 | `2b84f6b` | `/mentors/[id]/reserve` 予約フォーム + `/mypage` 相談履歴 DB 接続（migration 045、`mentor_id` 追加）|
| 記事システム | D | `178433d` | migration 046 (`ow_articles` 10 件シード) + `queries.ts` 3 関数 + `(jobseeker)/articles/` list/detail DB 接続（SSR）、旧 mock ファイル削除 |

---

## 9. 次のマイルストーン候補（M-5）

優先度順。各タスク着手前に方針確定（設計議論）が必要。

| 優先度 | タスク | 理由 | 規模 | 依存 |
|--------|--------|------|------|------|
| ✅ 完了 | `/auth` 求職者用認証フロー | サービス化セット B (`54575d4`) で実装済み | — | — |
| ✅ 完了 | `/profile/edit` + `/mypage` Supabase 接続 | サービス化セット F (`c5af352`) で実装済み（基本フィールドのみ） | — | — |
| ✅ 完了 | `/u/[id]` 公開プロフィール | サービス化セット C (`e53daf0`) で実装済み | — | — |
| ✅ 完了 | `/companies/[id]/casual-meeting` 申込フロー本格実装 | Commit G (`d0bebfe`) で実装済み。auth guard + accepting チェック + DB 永続化 | — | — |
| ✅ 完了 | `ow_articles` 新規テーブル + `/articles` 系 | Commit D (`178433d`) で実装済み。migration 046 + 10 件シード + 全 4 タイプ対応 | — | — |
| ✅ 完了 | `/mentors` 系 Supabase 接続 | Commit M-1 (`6e1fd79`) + M-2 (`2b84f6b`) で実装済み。一覧・詳細・予約・マイページ履歴すべて DB 接続 | — | — |
| — | `mentors` と `ow_users` の連携設計 + メンター本人の予約閲覧 + 承認フロー | `mentors` テーブルは `ow_users` と未連携のため、メンター本人ログイン → 受信予約管理が未実装。§6-X+2 参照 | 大 | 設計議論必要 |
| — | `mentors` テーブルを `ow_mentors` にリネームする migration | 命名規約（`ow_` prefix）統一のため。`§6-X+3` 参照。現在は `mentors`（`ow_` なし）のまま運用中 | 小 | — |
| ✅ 完了 | `ow_bookmarks` 企業ブックマーク DB 接続 | Commit I (`9c99ad3`) で実装済み。`target_type='company'` のみ | — | — |
| — | 記事 / メンター / 求人ブックマーク（`target_type='article' / 'mentor' / 'job'`） | Commit I は `company` のみ。記事・メンターはテーブル未作成。求人ブックマーク UI も未実装 | 中 | `ow_articles` / `ow_mentors` テーブル新規作成後 |
| ✅ 完了 | `ow_job_applications` UNIQUE(user_id, job_id) 制約追加 | Commit U + migration 047 で完了。race condition を DB 層で完全防止。API 23505→409 対応済み | — | — |
| — | `ow_jobs.job_category` FK 化 + UI 変更 | `TEXT` free text のため表記ゆれが発生（§6-9 参照）。`ow_roles.id` への FK 化 + 既存データ migration + 求人作成 UI の `ow_roles` 連動が必要 | 大 | — |

### M-5 着手前に確認すべき事項

```sql
-- ow_casual_meetings テーブルの現状確認（biz 側でも使用中）
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE '%casual%' OR table_name LIKE '%meeting%';

-- mentors テーブルの現状カラム確認
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'mentors' ORDER BY ordinal_position;
```

---

## 10. Design Decisions Made During Implementation

設計中に未確定だった項目、または実装時に変更した事項:

| # | 項目 | 当初想定 | 確定値 | Commit |
|---|------|---------|--------|--------|
| 1 | 職種フィルターのオプション | `mockJobData.ts` の `JOB_DEPTS` 固定値 | DB `ow_jobs.job_category` から動的導出 | E |
| 2 | 年収フィルターで salary_max=0 の扱い | 要検討（option A/B） | **option A: 除外**（salary フィルター適用時のみ除外） | E |
| 3 | 採用担当者セクション（anon 時） | 表示試みてエラー | **graceful hide**（anon は `[]` → section 非表示） | D |
| 4 | CompanyDetailClient.tsx の扱い | 旧 (jobseeker)/companies/[id]/ に同名ファイルが存在 | ブックマークボタンのみの新実装に置き換え | D |
| 5 | jobs/[id] の Header | 旧 default layout のハンバーガーメニュー | **(jobseeker) layout に移動**（commit F で解消） | F |
| 6 | 孤立 JobDetailClient.tsx（794 行） | 移動も削除も未決定 | **削除**（page.tsx から未参照、安全に削除可能） | F |
| 7 | 業界フィルターのオプション | 固定値 | DB `ow_companies.industry` から動的導出 | C |
| 8 | 求職者公開プロフィールの URL | `/users/[id]`（仕様書） | **`/u/[id]`** — `src/app/users/[id]/page.tsx` が `ow_company_members` 用として既存。route conflict のため変更。詳細: 同ファイルは企業側メンバープロフィール（career_history, photo_url, article_content 等）を提供しており削除不可 | サービス化セット C |
| 9 | `/profile/edit` + `/mypage` Supabase 接続のスコープ | A: `ow_users` 基本フィールドのみ / B: `ow_experiences` CRUD も接続 / C: `ow_experiences` READ のみ | **スコープ A 採用** — `ow_experiences` テーブルの整備（マイグレーション・RLS）が別タスクとして残存するため、基本フィールド（name, about_me, age_range, location, social_links, visibility, avatar_color, cover_color）のみを本実装の対象とした。職歴 CRUD は mock のまま据え置き | サービス化セット F |
| 10 | ブックマーク機能のスコープ（`target_type`） | `ow_bookmarks` テーブルは 4 種類（`article / company / job / mentor`）をサポート | **`target_type='company'` のみ DB 接続** — `ow_articles` / `ow_mentors` テーブル未作成のため記事・メンターは不可。求人ブックマーク UI も未実装。API（`/api/bookmarks`）は `target_type` を受け付ける汎用設計のため、各テーブル追加時に UI を足すだけで拡張可能 | I |
