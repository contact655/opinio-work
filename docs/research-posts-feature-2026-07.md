# 投稿・フィード機能 調査レポート
作成: 2026-07-08

---

## ❗ 結論を先に

**既存実装がほぼ完成している。新規で作る必要はない。**

- `ow_posts` / `ow_post_likes` / `ow_post_comments` テーブルが migration 131 で定義済み
- `/api/jobseeker/posts` GET/POST API（カーソルページネーション付き）が実装済み
- `/feed/FeedClient.tsx`（1199行）に投稿作成UI・いいね・コメント展開まで実装済み
- `/feed/page.tsx` が `notFound()` を返すだけで**丸ごと封印されている状態**

やるべきことは「封印を解いてナビに追加し、既存実装をレビュー・必要に応じて調整する」だけ。

---

## 1. 既存の発信系機能一覧

| 機能 | テーブル | ページ | 投稿できる人 | 公開方法 |
|------|---------|--------|------------|---------|
| **フィード投稿** | `ow_posts` / `ow_post_likes` / `ow_post_comments` | `/feed`（封印中） | 候補者（ow_users） | 全公開 |
| **記事** | `ow_articles` | `/articles`, `/articles/[slug]` | 管理者のみ（admin UI） | 管理者が公開設定 |
| **Companyストーリー** | `ow_company_posts` | `/biz/posts`（企業側のみ） | 企業担当者 | `/companies/[id]` に反映 |
| **企業外部リンク** | `ow_company_external_links` | `/companies/[id]/posts` | 企業担当者・編集部 | PostCard で表示 |
| **ユーザーコンテンツリンク** | `ow_user_content_links` | `/profile/edit`（自分のプロフのみ） | 候補者 | `/u/[id]` に表示 |

### PostCard コンポーネントについて

`src/components/jobseeker/PostCard.tsx` は**外部リンクカード**（`ow_company_external_links` の1行）を表示するためのものであり、フィード投稿とは別物。混同注意。

---

## 2. 封印されているフィード実装の詳細

### ファイル構成

```
src/app/(jobseeker)/feed/
  page.tsx          ← notFound() のみ（4行）
  FeedClient.tsx    ← 1199行！ほぼフル実装
  loading.tsx       ← スケルトン

src/app/(jobseeker)/posts/
  page.tsx          ← notFound() のみ（別ルート、用途不明）
  PostsFilterBar.tsx
  PostsTimelineFilter.tsx
  categoryMeta.ts
  loading.tsx
```

### FeedClient.tsx の実装内容（1199行）

```typescript
// 実装済み機能一覧:
- PostComposer（投稿作成フォーム）
- PostCard（投稿カード: アバター・名前・本文・いいね数・コメント数）
- いいね API 呼び出し（楽観的更新）
- コメント展開・コメント一覧表示
- コメント投稿フォーム
- load more（カーソルページネーション: before=${oldest.created_at}）
- relativeTime（"5分前" 表示）
- Avatar コンポーネント（avatar_url → gradient+initial フォールバック）
```

### API（実装済み）

**`GET /api/jobseeker/posts`**
- クエリ: `?limit=20&before=<ISO>&user_id=<uuid>`
- 返却: posts + like_count + comment_count + liked_by_me
- カーソルページネーション（`created_at < before`）

**`POST /api/jobseeker/posts`**
- Body: `{ content: string, image_url?: string }`
- レートリミット付き（`checkRateLimit`）
- 認証必須

### DB テーブル（migration 131 + 161 で二重定義）

```
migration 131_posts.sql  ← content: 1〜500文字制限
migration 161_add_posts.sql  ← content: 1〜1000文字制限（上書き？または競合）
```

⚠️ **migration 131 と 161 の両方が `CREATE TABLE IF NOT EXISTS` で同名テーブルを定義している。**
どちらが実際に Supabase に適用されているかは SQL Editor で確認が必要。
（`161` のほうが新しく、文字数制限が緩い 1000文字。おそらく 161 が最終状態）

```sql
-- ow_posts
id          UUID PK
user_id     UUID NOT NULL FK → ow_users(id) ON DELETE CASCADE
content     TEXT NOT NULL (1〜1000文字)
image_url   TEXT nullable
created_at  TIMESTAMPTZ DEFAULT now()
updated_at  TIMESTAMPTZ DEFAULT now()

-- ow_post_likes
id          UUID PK
post_id     UUID NOT NULL FK → ow_posts(id) ON DELETE CASCADE
user_id     UUID NOT NULL FK → ow_users(id) ON DELETE CASCADE
UNIQUE(post_id, user_id)

-- ow_post_comments（131のみ定義、161にはない）
id          UUID PK
post_id     UUID NOT NULL FK → ow_posts(id) ON DELETE CASCADE
user_id     UUID NOT NULL FK → ow_users(id) ON DELETE CASCADE
content     TEXT NOT NULL (1〜300文字)
```

**RLS（ow_posts）:**
```sql
SELECT: anyone (true)
INSERT: authenticated のみ、自分の user_id のみ
DELETE: 自分の user_id のみ
```

---

## 3. 「投稿機能」に既存を使えるか — 判断

### ✅ 既存を活かす（新規不要）

| 判断 | 理由 |
|------|------|
| **ow_posts テーブルは再利用可** | user_id FK・content・image_url と必要なカラムが揃っている |
| **API は再利用可** | GET（カーソルページネーション）・POST（レートリミット付き）が実装済み |
| **FeedClient は再利用可** | 投稿作成・いいね・コメントまで実装済み。レビューして使える |
| **記事（ow_articles）は別物** | 管理者キュレーション型。ユーザー自由投稿の土台には使わない |
| **Companyストーリー（ow_company_posts）は別物** | 企業ブランディング用の長文。フィード投稿と目的が異なる |

### ⚠️ 注意点・調整が必要な箇所

1. **企業投稿者への未対応**: 現状 ow_posts.user_id は `ow_users` FK のみ。企業（ow_companies）が投稿するには対応が必要（後述）
2. **migration 131 vs 161 の競合確認**: Supabase 上の実際のテーブル定義を確認する
3. **ow_post_comments のDB状態確認**: migration 161 では定義されていない（131のみ）
4. **FeedClient のコードレビュー**: 封印時点から変更があった可能性あり。/posts ルートとの関係も整理要
5. **`/posts/` 以下のファイル群**: PostsFilterBar・PostsTimelineFilter・categoryMeta が存在するが、フィード（/feed）とは別系統か混乱している可能性がある

---

## 4. アバター・投稿者表示の共通基盤

### 既存パターン

**ow_users（候補者）**
```typescript
// FeedClient の Avatar コンポーネント（実装済み）
if (user.avatar_url) → <img src={avatar_url} />
else → <div style={{ background: user.avatar_color ?? royalGradient }}>initial</div>
```

**ow_company_admins / ow_companies（企業）**
- /people の AmbassadorCard がロゴ + グラデーション + letter で表示
- CompanyLogoImg コンポーネント（src/components/profile/CompanyLogoImg.tsx）が存在

### 企業投稿者への拡張案

ow_posts に `company_id UUID nullable FK → ow_companies` を追加し、
- `user_id IS NOT NULL` → 候補者の投稿（アバター表示）
- `company_id IS NOT NULL` → 企業の投稿（ロゴ + 会社名表示）

カードの author セクションで2パターンを出し分ける。

---

## 5. フィードの技術的基盤

### カーソルページネーション（実装済み）

```typescript
// GET /api/jobseeker/posts
const before = searchParams.get("before"); // ISO datetime cursor
query.lt("created_at", before).limit(20);

// クライアント（FeedClient.tsx）
const oldest = posts[posts.length - 1];
fetchMore(`/api/jobseeker/posts?before=${oldest.created_at}`);
```

### ページング/無限スクロール

FeedClient の load more ボタン方式（"もっと見る" クリック → APIコール）が実装済み。
無限スクロール（Intersection Observer）への発展も容易な構造。

---

## 6. ナビ導線

### 現在のナビ（5リンク）

```typescript
const NAV_LINKS = [
  { href: "/companies", label: "企業" },
  { href: "/jobs",      label: "求人" },
  { href: "/people",   label: "話せる人" },
  { href: "/career-consultation", label: "相談" },
  { href: "/articles", label: "記事" },
];
```

キャリア軌跡を削除済み（このセッション前に対応済み）なので、**スロット 5 のまま**。
「フィード」を追加する場合は 6 リンクになる。

### 配置案

**案A: 「フィード」を 3番目に挿入**（話せる人の後）
```
企業 / 求人 / 話せる人 / フィード / 相談 / 記事
```

**案B: 「フィード」を 2番目に挿入**（SNS感を前面に出す）
```
企業 / フィード / 求人 / 話せる人 / 相談 / 記事
```

**案C: /mypage または /profile 下のサブ機能として起点**（ナビ増やさない）
- マイページダッシュボードに「投稿する」ボタンだけ置き、フィードは `/feed` URL で共有

推奨は**案A**。企業・求人を見た後、人と繋がる流れに自然につながる。

---

## 7. 実装分割案

既存実装の封印を解くだけで Phase 1 は完成できる。

### フェーズ 1-A: DB 確認 + フィード有効化（1〜2コミット）

1. **Supabase で現状確認**
   - `ow_posts` / `ow_post_likes` / `ow_post_comments` の実際のカラム・制約を確認
   - migration 131 vs 161 の競合解決（必要なら migration を追加）
2. **`/feed/page.tsx` の封印を解く**
   - `notFound()` を削除 → 本来のサーバーコンポーネントに書き換え（初期投稿を SSR でフェッチ）
3. **`JobseekerHeader.tsx` にナビリンク追加**
   - `{ href: "/feed", label: "フィード" }` を NAV_LINKS に挿入
4. **ビルド確認・push**

### フェーズ 1-B: FeedClient レビュー・調整（1コミット）

- FeedClient.tsx 1199行を通読し、現在の他ページと整合性を確認
- `/posts/` 以下（PostsFilterBar 等）との関係を整理（不要なら削除）
- スタイル調整（デザインシステム CSS 変数の整合性）

### フェーズ 1-C: 企業投稿対応（将来オプション）

- `ow_posts` に `company_id UUID nullable FK → ow_companies` カラムを追加（migration）
- `/biz/posts` タブに「フィード投稿」を追加（現在は会社ストーリー + 外部リンクの2タブ）
- FeedClient の著者表示を候補者/企業で分岐

### フェーズ 2: いいね・コメント（既に実装済みのため確認のみ）

- FeedClient にすでにいいね・コメント UI が実装済み
- API の `/api/jobseeker/posts/[id]/likes` や comments エンドポイントが存在するか確認

---

## 8. 想定リスク

| リスク | 度 | 対応 |
|--------|-----|------|
| migration 131/161 のテーブル二重定義 | ⚠️ 高 | Supabase SQL Editor で実際のテーブル定義確認必須 |
| FeedClient が古く現在のコードと整合しない | 中 | 封印解除前に全体レビュー |
| `/posts/` と `/feed/` の役割の混在 | 中 | `/posts/` ルートは削除or /feed にリダイレクト |
| 企業投稿の FK 設計未完 | 低（フェーズ1では不要） | フェーズ1はユーザー投稿のみで開始 |
| フィード投稿数0での空状態 | 低 | FeedClient に空状態UI追加が必要 |

---

## まとめ

| 確認事項 | 結論 |
|---------|------|
| 新規で作るか既存拡張か | **既存を解封する**（FeedClient + API + DB が揃っている） |
| ow_posts テーブル | 既存（migration 131/161）。Supabase 上の実状確認が最優先 |
| 企業投稿への対応 | フェーズ1は候補者のみ。company_id カラム追加は別フェーズ |
| ナビ | 5リンクの3番目（話せる人の後）に「フィード」を追加 |
| フェーズ1の工数 | `/feed/page.tsx` 書き換え + ナビ追加 + FeedClient レビューで完結 |
| 最大リスク | migration 131 と 161 の競合 — 最初に確認 |
