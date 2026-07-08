# フィード リンクプレビュー（OGPカード）調査レポート（2026-07）

調査日: 2026-07-08  
変更なし（調査のみ）

---

## 1. 既存のOGP取得の仕組み（最重要）

### 結論: **OGPインフラは既に完備。再利用できる。**

| 資産 | パス | 用途 |
|------|------|------|
| `fetchOgp()` Server Action | `src/lib/og/fetchOgp.ts` | Server Action として `open-graph-scraper` を呼ぶ共通関数。`OgpResult` 型付き |
| `POST /api/jobseeker/ogp-fetch` | `src/app/api/jobseeker/ogp-fetch/route.ts` | SSRF 対策付きの API Route 版。**認証必須**。プライベートIPブロック済み |
| `GET /api/jobseeker/content-links/ogp` | `src/app/api/jobseeker/content-links/ogp/route.ts` | 発信コンテンツ登録時の簡易版（自前 regex パース） |
| `open-graph-scraper@^6.12.0` | `package.json` | **既にインストール済み** |

### `POST /api/jobseeker/ogp-fetch` の SSRF 対策（実装済み）

```typescript
// 既存の isUrlSafe() 関数
- https:// / http:// のみ許可
- localhost / 127.0.0.1 / 0.0.0.0 / [::1] を拒否
- 192.168.x.x / 10.x.x.x / 172.16-31.x.x（プライベートIP）を拒否
- *.local / *.internal を拒否
- 画像URLにも同じ検査を通す（og:image が javascript: 等でない確認）
- 認証必須（未認証からのスクレイピング悪用を防止）
```

→ **セキュリティ対策は既に本番品質**。フィードでも `POST /api/jobseeker/ogp-fetch` をそのまま使える。

### `fetchOgp()` の返り値（`OgpResult` 型）

```typescript
// 成功
{ success: true, url, title, description?, thumbnailUrl?, siteName?, publishedAt? }

// 失敗（エラーコード分類あり）
{ success: false, errorCode: "INVALID_URL"|"TIMEOUT"|"NOT_FOUND"|"NO_TITLE"|"NETWORK_ERROR"|"UNKNOWN", message }
```

---

## 2. ow_posts テーブルの現状

`supabase/migrations/161_add_posts.sql` で定義:

```sql
CREATE TABLE IF NOT EXISTS ow_posts (
  id          UUID,
  user_id     UUID,
  content     TEXT CHECK (char_length(content) BETWEEN 1 AND 1000),
  image_url   TEXT,       -- 既存: 手動アップロード画像
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
);
```

**`link_url` / `link_title` / `link_image` カラムはなし**。OGPプレビューを保存するにはカラム追加が必要。

---

## 3. 取得方式の推奨

### 推奨: **方式A（投稿時に取得してDBに保存）**

| | 方式A: 投稿時保存（推奨） | 方式B: 表示時都度取得 |
|--|-----|-----|
| **速度** | 表示が速い（キャッシュ済み） | 毎回fetch → 遅い・ラグ |
| **DB変更** | カラム追加が必要（migration 1本） | 不要 |
| **外部依存** | 投稿時1回のみ | 全フィード表示のたびに外部fetch |
| **URL変化** | OG画像URLが変わっても追従しない | 常に最新 |
| **既存パターン** | ow_experience_stories の link_url/og_title/og_image_url と同一パターン | – |
| **スケール** | 投稿数が増えても表示時のfetchが増えない | 投稿数×表示回数だけfetch |

**既存の `ow_experience_stories`（Migration 089）が全く同じパターンを採用**:

```sql
link_url        text,
link_title      text,
link_image_url  text,
link_description text,
```

投稿時に `POST /api/jobseeker/ogp-fetch` を呼び、結果を `ow_posts` に保存するのが自然な流れ。

---

## 4. 必要なDB変更

### Migration（新規1本）

```sql
ALTER TABLE ow_posts
  ADD COLUMN IF NOT EXISTS link_url         TEXT,
  ADD COLUMN IF NOT EXISTS link_title       TEXT,
  ADD COLUMN IF NOT EXISTS link_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS link_description TEXT,
  ADD COLUMN IF NOT EXISTS link_domain      TEXT;
```

`link_domain` は `new URL(link_url).hostname` をサーバー側で算出してINSERT。
（表示時に毎回算出できるが、DBに持つとクエリが単純になる）

**既存データへの影響**: `ADD COLUMN IF NOT EXISTS` で既存行は全 NULL → 問題なし。

---

## 5. 実装フロー（投稿時保存）

```
[ユーザー]
  ↓ 本文にURLを含めて投稿
[FeedClient.tsx — PostComposer]
  ↓ 本文からURLを regex 抽出（最初の1つ）
  ↓ URLが見つかったら POST /api/jobseeker/ogp-fetch を先に呼ぶ
  ↓ 結果（title/image/description/domain）を持って
[POST /api/jobseeker/posts]
  ↓ content + image_url + link_url + link_title + link_image_url + link_description + link_domain を INSERT
[FeedClient.tsx — PostCard]
  ↓ post.link_url があれば LinkPreviewCard を本文下に表示
```

### URL抽出ロジック（最初の1つだけ）

```typescript
const URL_RE = /https?:\/\/[^\s　、。！？」）\]>）」』"'>]+/;
function extractFirstUrl(text: string): string | null {
  return URL_RE.exec(text)?.[0] ?? null;
}
```

日本語の句読点・括弧類を URL に含めない（`。」）` 等をストップ文字として扱う）。

### 投稿前OGP取得のUX

- URL が本文に含まれていたら「リンク情報を取得中…」スピナーを出す（PostComposer 内）
- 取得失敗・タイムアウトでもプレビューなしで投稿を続行（best-effort）
- 取得成功したら投稿フォーム内にプレビューを小さく表示し「削除」ボタンでキャンセル可能

---

## 6. セキュリティ・堅牢性

すべて **既存 `POST /api/jobseeker/ogp-fetch` に実装済み**:

| リスク | 対応 |
|--------|------|
| SSRF（内部IPへのリクエスト） | `isUrlSafe()` でプライベートIP・localhost を弾く ✅ |
| 未認証の乱用 | 認証必須（401 を返す） ✅ |
| タイムアウト | 5秒でタイムアウト、エラーは null で返す ✅ |
| 危険な og:image URL | 画像 URL にも `isUrlSafe()` を通す ✅ |
| OGP取得失敗で投稿が止まる | best-effort（失敗してもそのまま投稿） |
| 画像が取得できないURL | `link_image_url` が null → フォールバック表示（ドメインのみ） |

---

## 7. UIデザイン案

### LinkPreviewCard（本文の下・画像の上）

```
┌──────────────────────────────────────────────────┐
│ [サムネイル 120px]  note.com                     │
│                     タイトル（2行まで）           │
│                     説明文（2行まで、あれば）     │
└──────────────────────────────────────────────────┘
```

- ボーダー: `1px solid var(--line)`、角丸: `10px`
- サムネイル: 左に 120×80px の `object-fit: cover`。なければドメインの頭文字アイコン
- タイトル: 13px / fontWeight 700 / `var(--ink)` / 2行クランプ
- 説明: 12px / `var(--ink-soft)` / 2行クランプ（あれば）
- ドメイン: 11px / `var(--ink-mute)` / ファビコン（`https://www.google.com/s2/favicons?domain=...`）
- クリックで `target="_blank" rel="noopener noreferrer"` で外部タブ
- モバイル: 横並びのまま（120px サムネイル左固定 or 上部フル幅サムネイル）

### 画像なし（フォールバック）

```
┌──────────────────────────────────────────────────┐
│ 🔗  note.com — タイトル（1行）                   │
│     説明文（あれば）                              │
└──────────────────────────────────────────────────┘
```

### パーマリンクページ（/feed/[postId]）

同一の `LinkPreviewCard` コンポーネントを使い回す。`post.link_url` があれば表示するだけで追加実装なし。

---

## 8. 実装分割案

### Migration（手動適用必要）

`supabase/migrations/XXX_add_link_preview_to_posts.sql`

```sql
ALTER TABLE ow_posts
  ADD COLUMN IF NOT EXISTS link_url         TEXT,
  ADD COLUMN IF NOT EXISTS link_title       TEXT,
  ADD COLUMN IF NOT EXISTS link_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS link_description TEXT,
  ADD COLUMN IF NOT EXISTS link_domain      TEXT;
```

### Commit 1: DB + API（バックエンド）

- Migration: `ow_posts` に5カラム追加
- `POST /api/jobseeker/posts`: `link_url / link_title / link_image_url / link_description / link_domain` を受け取って INSERT（既存 `image_url` と同様のバリデーション）
- `GET /api/jobseeker/posts`: レスポンスに link 系フィールドを追加
- `GET /api/jobseeker/posts/[id]/route.ts`: 同上

### Commit 2: PostComposer に OGP取得UI を追加

- `FeedClient.tsx` の PostComposer: URL検出 → `POST /api/jobseeker/ogp-fetch` 呼び出し → プレビュー表示
- 投稿時に link 系フィールドを `POST /api/jobseeker/posts` に追加送信

### Commit 3: PostCard に LinkPreviewCard を追加

- `src/components/feed/LinkPreviewCard.tsx` 新規作成
- `FeedClient.tsx` の PostCard: `post.link_url` があれば本文の下に `<LinkPreviewCard>` 表示
- `/feed/[postId]` パーマリンクページにも表示（同コンポーネント使い回し）

---

## 9. リスク一覧

| リスク | 影響 | 対策 |
|--------|------|------|
| 投稿前の OGP 取得に時間がかかる（note/Zenn の返答が遅い） | 中 | スピナー + 5秒タイムアウト（既存）。失敗ならリンクなしで投稿続行 |
| 既存投稿（link_url=NULL）はプレビューなし | 低 | `post.link_url` が null のときはカードを出さないだけ |
| og:image が外部CDNのため `<img src>` が CSP に引っかかる | 低 | フィードは CSP ヘッダーを設定していないため現状は問題なし |
| URL を本文に含まない投稿にプレビューが出る | なし | URL抽出 regex が null なら link 系は全 NULL のまま |
| note/Zenn が Bot UA をブロックする | 低 | 既存 `User-Agent: OPINIOBot/1.0` + `open-graph-scraper` のヘッダー偽装で大半のサイトは取得可能 |
| ow_posts の SELECT 一覧クエリで link 系カラムが増える | 低 | TEXT × 5 カラムの増加は許容範囲。インデックスも不要 |
