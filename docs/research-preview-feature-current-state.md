# Preview Feature - Current State Research

作成日: 2026-05-15  
調査者: Claude Code  
制約: コード変更なし、調査のみ

---

## 1. Executive Summary

プレビュー機能は **プロジェクト全体で実質ゼロ実装**。「プレビュー」ボタンが UI に存在する箇所は複数あるが、すべて `alert("プレビュー（実装予定）")` または `alert("プレビュー機能は後日実装予定です。")` で止まっている。

`draft_data` による下書き保存フローは `/biz/company`（企業情報編集）のみ確立しており、他の編集画面には存在しない。求人（ow_jobs）はステータスカラム（`draft` / `pending_review` / `published`）で管理するが、draft_data パターンを採用していない。プロフィール編集は「保存即反映」型で下書き概念そのものがない。

「プレビュー実装」の横展開対象として最も整備されているのは `/biz/company` のみであり、他画面は設計レベルから決定が必要。

既存調査ファイル `docs/investigation-2026-05-15-preview-feature.md` が `/biz/company` 限定のより詳細な調査を含む。本レポートはプロジェクト全体を対象に横断的にまとめる。

---

## 2. 既存実装の棚卸し

### 2-1. 全編集画面とプレビュー・下書き対応マトリクス

| 編集画面 | URL / ファイル | プレビュー機能 | 下書き保存（draft_data） | 公開フロー |
|----------|---------------|--------------|------------------------|-----------|
| 企業情報編集（biz） | `/biz/company`<br>`src/app/biz/company/CompanyEditClient.tsx` | ボタンあり（**alert のまま、未実装**） | ✅ `ow_companies.draft_data` に PUT | 「変更を公開する」PATCH → 本番カラムへ展開 |
| 求人編集（biz） | `/biz/jobs/[id]/edit`<br>`src/components/business/JobEditForm.tsx` | ボタンあり（**alert のまま、未実装**） | ❌ なし（`status` カラムで管理） | `status: "pending_review"` → 審査 → `published` |
| 求人リスト（biz） | `/biz/jobs`<br>`src/components/business/JobListCard.tsx` | pending_review 状態のカードに「プレビュー」ボタンあり（**alert のまま、未実装**） | ❌ なし | 同上 |
| 企業情報編集（admin） | `/admin/companies/[id]`<br>`src/app/admin/companies/[id]/CompanyDetailClient.tsx` | ❌ なし（ロゴ画像の視覚確認表示のみ） | ❌ なし（直接本番カラムに保存） | 管理者が直接 PATCH |
| 投稿編集（biz） | `/biz/posts`<br>`src/app/biz/posts/PostsClient.tsx` | サムネイル画像プレビュー（インライン表示）のみ | ❌ なし | `published_at` カラムで日付指定公開 |
| 投稿編集（admin） | `/admin/posts`<br>`src/app/admin/posts/PostsAdminClient.tsx` | サムネイル画像プレビュー（インライン表示）のみ | ❌ なし | `published_at` カラムで日付指定公開 |
| プロフィール編集（求職者） | `/profile/edit`<br>`src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` | アバター文字プレビュー（インライン表示のみ）| ❌ なし（各フィールドごと即時 API 保存） | 概念なし（保存即公開） |
| スクール申請承認（admin） | `src/components/admin/ApproveSchoolRequestModal.tsx` | ロゴのリアルタイムプレビュー（✅ **動作する**） | ❌ なし | 承認ボタン → DB UPDATE |

### 2-2. 「プレビュー」という言葉の実態分類

プロジェクト内の "プレビュー" / "preview" は 3 つの意味で混在している:

| 分類 | 意味 | 実例 |
|------|------|------|
| **A: 未実装のプレビューページ** | 別画面で公開前の内容を確認する機能 | CompanyEditClient, JobEditForm, JobListCard |
| **B: インラインビジュアル確認** | 入力中のリアルタイム表示（モーダルや別画面ではない） | アバター・ロゴ・サムネイルの表示領域 |
| **C: UI コンポーネント名・変数名** | React state `preview`（画像プレビュー URL の保持用） | `ImageUpload.tsx`、`MypageClient.tsx` の `preview_text` |

本レポートが対象とする「プレビュー機能実装」は **分類 A** のみ。

---

## 3. データモデル

### 3-1. draft_data カラム

| テーブル | draft_data の有無 | 型 | 定義箇所 |
|---------|------------------|----|---------|
| `ow_companies` | ✅ あり | `JSONB` | `supabase/migrations/031_opinio_phase1_core_schema.sql:781` |
| `ow_jobs` | ❌ なし | — | — |
| `ow_users` | ❌ なし | — | — |
| その他全テーブル | ❌ なし | — | — |

**結論**: `draft_data` は `ow_companies` **専用**。他テーブルへの展開は migration + 型定義の追加が必要。

### 3-2. ow_companies.draft_data のスキーマ

`draft_data` の中身は `transformFormToDb(BizCompany)` の出力（スネークケース DB 形式の JSONB）。主なキー:

```json
{
  "name": "...", "tagline": "...", "mission": "...",
  "why_join": "...", "company_features": [...], "industry": "...",
  "logo_gradient": "...", "logo_letter": "...", "logo_url": "...",
  "about_markdown": "...", "employee_count": "...",
  "genres": ["slug1", "slug2"],   ← ow_company_genres 用（PATCH 時に別処理）
  "remote_work_status": "...", "work_time_system": "...",
  "avg_overtime_hours": "...", "benefits": [...],
  ...（BizCompany 型の全フィールド）
}
```

`draft_data` の有無（`!= null && Object.keys().length > 0`）が `hasDraftChanges` の判定ロジック。

### 3-3. draft_data の保存フロー（/biz/company のみ）

```
フォーム操作
    ↓ (700ms debounce)
PUT /api/biz/company
    ↓ transformFormToDb()
ow_companies.draft_data = { ...record }
本番カラム変更なし

    ↓ 「変更を公開する」クリック
PATCH /api/biz/company { isPublished: true }
    ↓ draft_data を取得 → 本番カラムに展開
ow_companies.{ name, tagline, ... } = draft_data.*
ow_companies.draft_data = null
ow_company_genres = [...genres]（全置換）
```

詳細: `src/app/api/biz/company/route.ts`

### 3-4. ow_jobs のステータス管理（draft_data を使わない設計）

求人は `status` カラム（`"draft" | "pending_review" | "published" | "rejected" | "private"`）で管理。Opinio 編集部の審査フローがある（draft → pending_review → published）。公開判断は企業ではなく運営側が行う設計のため、draft_data パターンは採用されていない。

---

## 4. UI パターン分析

### 4-1. 現状のプレビュー UI パターン

| 対象 | 現状パターン | 将来の実装候補 |
|------|------------|-------------|
| `/biz/company` | **パターンE: そもそもプレビューがない**（ボタンは alert） | パターン C（新タブ・別URL）が最有力 |
| `/biz/jobs/[id]/edit` | **パターンE: そもそもプレビューがない**（ボタンは alert） | パターン C（`/jobs/[id]` を新タブ表示） |
| `/admin/posts` | サムネイルプレビューのみ（インライン） | — |
| `/admin/companies/[id]` | ロゴ・アバタープレビューのみ（インライン） | — |
| `ApproveSchoolRequestModal` | ✅ **パターンB相当（モーダル内インライン）**、動作中 | 横展開不要 |

### 4-2. 公開後ページとの差分

`/biz/company` のプレビューを `/companies/[id]` で実現した場合の差分:

| 差分ポイント | 現状 | プレビュー時に必要な対応 |
|------------|------|----------------------|
| `is_published` フィルター | 本番: `is_published=true` 必須 | フィルター解除 or 権限付き bypass |
| `draft_data` の読込 | `getCompanyById()` は draft_data を SELECT しない | `draft_data` を追加 SELECT してマージ |
| `ow_company_genres` | 公開済み genres のみ取得 | draft_data.genres で上書き表示 |
| SEO | — | `<meta name="robots" content="noindex">` 必要 |
| URL 流出リスク | — | 認証チェック必須（BIZ ユーザーのみアクセス可） |
| `published_at` などのメタ | 本番の値を表示 | draft では表示不要か検討 |

求人（`/jobs/[id]`）は `draft_data` がない。プレビューは「編集中の内容をそのまま渡す」形（クライアント side の state を新タブに渡す手段が必要）かつ `status != published` のジョブをアクセス可能にするフィルター解除が必要。

---

## 5. 横展開時の論点

### 論点 1: プレビューの情報源設計（最重要）

各編集画面でプレビューが「何を表示するか」が異なる:

| 編集画面 | データの現在地 | プレビュー用データ取得手段 |
|---------|--------------|--------------------------|
| `/biz/company` | `ow_companies.draft_data` に保存済み | DB から draft_data を取得してマージ |
| `/biz/jobs/[id]/edit` | `ow_jobs.*` の各カラム（draft_data なし） | 現在の DB カラムをそのまま読む（特別な処理不要） |
| `/profile/edit` | 各 API が即時保存（draft なし） | 現在の DB カラムをそのまま読む |

→ **求人・プロフィールはシンプル**（status フィルター解除だけで動く可能性が高い）。**企業情報が最も複雑**（draft_data のマージが必要）。

### 論点 2: 認証・アクセス制御の方式

| 方式 | メリット | デメリット |
|------|---------|-----------|
| `?preview=1` クエリパラメータ + セッション認証確認 | URL がシンプル | Server Component でのセッション確認が必要 |
| `/biz/preview/companies/[id]` 専用ルート | BIZ の認証ミドルウェアに乗れる | URL が長い。公開ページとコード重複 |
| `?token=xxx` 秘密トークン方式 | 未ログインでも共有可能 | トークン流出リスク |

推奨: **セッション確認付きの `?preview=1`** が最もバランスが良い。`lib/supabase/queries.ts` の `getCompanyById()` を拡張して `preview=true` 時に `draft_data` をマージする設計。

### 論点 3: 求人プレビューの特殊性（審査フロー）

求人のプレビューは「draft_data」ではなく「status フィルター解除」の問題。`/jobs/[id]` ページが `status = 'published'` 以外を弾いているかを確認要。弾いていない場合はプレビューは即実装可能。

`pending_review` 状態のカードに「プレビュー」ボタンがある（`JobListCard.tsx:126`）ため、求職者目線での最終確認 UI として期待されている。

### 論点 4: 保存中（saving）状態とのタイミング競合

`/biz/company` は 700ms debounce autosave。プレビューボタンをクリックした時点で `saveState === "saving"` の場合、`draft_data` がまだ古い。保存完了を待ってから遷移する UX が必要か要検討。

### 論点 5: サブルート（/posts 等）の扱い

`/companies/[id]/posts` にもプレビューを展開するかは範囲外として扱ってよい。`ow_posts` テーブル（投稿リンク集）は `/biz/posts` で `published_at` 日付管理しており draft_data は不要。

### 論点 6: プロフィール公開ページとの整合

求職者プロフィール（`/u/[id]`）は「保存 = 即公開」設計。「プレビュー」ボタンは意味が薄い（`/u/自分のID` を開くのと同じ）。実装優先度は低い。

---

## 6. 想定外の発見・技術的負債

### 発見 1: draft_data を読み込む逆変換（transformDbToForm）が未接続

`src/lib/business/company.ts` の `transformDbToForm()` は存在するが、**draft_data を読み込んで BizCompany に変換するフローでは使われていない**。現在は初回ロード時に本番カラムを BizCompany 型に変換するためだけに使用。

→ プレビュー実装では「draft_data の JSONB をそのまま公開ページコンポーネントに渡す」（DB 形式のまま）方が変換コストを省ける。公開ページは DB カラム形式（スネークケース）で受け取る設計のため。

### 発見 2: JobListCard のプレビューボタンに onClick がない

`src/components/business/JobListCard.tsx:126`:

```tsx
<ActionBtn label="プレビュー" />
```

`onClick` prop が渡されていない。`ActionBtn` のデフォルト動作は `alert("「プレビュー」は今後実装予定です。")` になる（`onClick` が未定義の場合は alert にフォールバックする設計）。

→ 視覚的にボタンがあるが、ハンドラーが一切接続されていない状態。

### 発見 3: 管理者の企業編集は draft_data を経由しない

`/admin/companies/[id]` は直接本番カラムに保存する（draft_data を経由しない）。管理者は「草稿 → 審査 → 公開」フローを飛ばして即時変更できる設計。

→ 管理者側のプレビューは意味が薄い（保存イコール公開のため）。実装対象外として明示しておくべき。

### 発見 4: ow_articles テーブルが存在しない

CLAUDE.md 記載の通りだが、`/admin/articles` ページは `ow_articles` テーブルを参照している。実際には `is_published` / `published_at` カラムがあり、記事公開フローが存在するが、プレビュー機能の設計から外れた独自テーブル構造になっている可能性がある（要調査）。

### 発見 5: プロフィール編集の「プレビュー」ラベルが誤解を招く

`/profile/edit/ProfileEditClient.tsx:2775` の "プレビュー" は、**アバター画像の生成プレビュー**（文字アバターのインライン表示）に過ぎない。ボタンや別画面ではなく、フォームの一部。ユーザーが「プレビュー」を期待する機能とは無関係。

### 発見 6: 「公開ページを見る」ボタンが pending_review 求人でも使える可能性

`JobListCard.tsx:116` にある「公開ページを見る」ボタンは `status === "published"` のときのみ表示されているが、`/jobs/[id]` 側でステータスフィルターがかかっているかは未確認。published 以外のジョブが `/jobs/[id]` でアクセス可能なら、そのまま「プレビュー」として機能させられる。

---

## 7. 次のステップ提案

### Phase 1: /biz/company プレビュー（最優先、最も要望が明確）

**スコープ**: 企業情報編集画面のプレビューボタンを動作させる。

**実装概要**:
1. `getCompanyById()` に `includePreview?: boolean` オプションを追加し、`draft_data` を SELECT に含める
2. `/companies/[id]?preview=1` で `draft_data` を公開ページの表示データにマージ
3. BIZ ユーザーセッションの確認（Supabase Server Component のセッション検証）
4. `<meta name="robots" content="noindex">` 付与
5. `CompanyEditClient.tsx` の `onClick={() => alert(...)}` を `router.push()` に変更

**難点**: 認証チェック（`/companies/[id]` は公開ページのため、Server Component で BIZ セッションを確認する処理が必要）。

**工数見積もり**: 3〜4 時間

---

### Phase 2: /biz/jobs プレビュー（審査中求人の確認）

**スコープ**: `pending_review` 状態の求人を `/jobs/[id]` で確認できるようにする。

**実装概要**:
1. `/jobs/[id]` 側のステータスフィルターを確認し、BIZ ユーザーであれば `pending_review` でもアクセス可能に
2. `JobListCard` の「プレビュー」ボタンに `onClick` を接続（`/jobs/job.id` を新タブで開く）
3. `JobEditForm` のプレビューボタンも同様

**難点**: `draft_data` がない分シンプル。ただし求人の公開ページが認証なしでアクセス可能になってしまう点をどう扱うか（?preview=1 でフィルター解除 + BIZ 認証ガードを付ける方式が安全）。

**工数見積もり**: 2〜3 時間

---

### Phase 3: プロフィール公開ページへのリンク

**スコープ**: `/profile/edit` から自分の `/u/[userId]` を新タブで開くボタンを追加。

**実装概要**: プロフィール編集画面のヘッダーに「公開ページを確認する」リンクを追加するだけ。draft_data の概念は不要。

**工数見積もり**: 30 分

---

## 関連ファイル一覧

| ファイル | 内容 |
|---------|------|
| `src/app/biz/company/CompanyEditClient.tsx:898` | プレビューボタン（alert のまま） |
| `src/components/business/JobEditForm.tsx:716` | 求人プレビューボタン（alert のまま） |
| `src/components/business/JobListCard.tsx:126` | 審査中求人のプレビューボタン（onClick なし） |
| `src/app/api/biz/company/route.ts` | PUT（draft_data 保存）/ PATCH（公開） |
| `src/lib/business/company.ts:115` | hasDraftChanges の判定ロジック |
| `src/lib/supabase/queries.ts:390` | getCompanyById の is_published フィルター |
| `src/app/(jobseeker)/companies/[id]/page.tsx` | 公開ページ（プレビュー対象） |
| `src/app/(jobseeker)/u/[id]/page.tsx` | 公開プロフィールページ |
| `src/components/admin/ApproveSchoolRequestModal.tsx:305` | 動作しているプレビュー（スクール申請） |
| `supabase/migrations/031_opinio_phase1_core_schema.sql:781` | draft_data カラム定義 |
| `docs/investigation-2026-05-15-preview-feature.md` | /biz/company 限定の詳細調査（別ドキュメント） |
