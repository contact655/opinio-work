# フィード解封前調査レポート
作成: 2026-07-08

---

## ❗ 結論を先に

**FeedClient は機能として完成している。封印理由はコード品質ではなく「migration の不整合」。**

- FeedClient が呼ぶ API は全件実在（8エンドポイント × 全てファイルあり）
- TODO/FIXME/モックデータは一切なし
- 唯一のブロッカー: migration 161 が `ow_post_comments` テーブルを**削除**しており、
  実際の Supabase に何が適用されているかでコメント機能が動くかどうかが決まる

---

## 1. FeedClient.tsx 完成度評価

### ✅ 実装済み機能（全て動く状態）

| 機能 | 行 | 状態 |
|------|-----|------|
| 投稿作成フォーム（PostComposer） | ~100 | ✅ |
| 投稿フィード表示 | ~200 | ✅ |
| いいね（楽観的更新） | 735 | ✅ |
| コメント展開・一覧表示 | 411–699 | ✅ |
| コメント投稿 | 463 | ✅ |
| コメント削除（自分のみ） | 497 | ✅ |
| 投稿削除（自分のみ） | 749 | ✅ |
| カーソルページネーション（もっと見る） | 1037 | ✅ |
| 画像アップロード（Supabase Storage） | 実装済み | ✅ |
| Avatar コンポーネント（avatar_url → gradient fallback） | 70 | ✅ |
| 投稿時刻の相対表示（"5分前"） | 55 | ✅ |
| 非公開ユーザー除外（visibility チェック） | APIで実装 | ✅ |
| レートリミット（POST） | APIで実装 | ✅ |

**TODO / FIXME:** 0件  
**モックデータ・ハリボテ:** 0件  
**壊れたインポート:** 0件

### 投稿文字数上限

```typescript
// FeedClient.tsx
const MAX_CHARS = 500;  // line 135

// コメント
maxLength={300}  // line 639
```

---

## 2. API エンドポイント 実在マップ

FeedClient が呼ぶ全エンドポイントと対応ファイルの確認結果:

| エンドポイント | メソッド | ファイル | 実在 |
|-------------|--------|---------|------|
| `/api/jobseeker/posts` | GET | `posts/route.ts` | ✅ |
| `/api/jobseeker/posts` | POST | `posts/route.ts` | ✅ |
| `/api/jobseeker/posts/[id]` | DELETE | `posts/[id]/route.ts` | ✅ |
| `/api/jobseeker/posts/[id]/likes` | POST | `posts/[id]/likes/route.ts` | ✅ |
| `/api/jobseeker/posts/[id]/likes` | DELETE | `posts/[id]/likes/route.ts` | ✅ |
| `/api/jobseeker/posts/[id]/comments` | GET | `posts/[id]/comments/route.ts` | ✅ |
| `/api/jobseeker/posts/[id]/comments` | POST | `posts/[id]/comments/route.ts` | ✅ |
| `/api/jobseeker/posts/[id]/comments/[commentId]` | DELETE | `posts/[id]/comments/[commentId]/route.ts` | ✅ |

**8エンドポイント全件実在。「UIはあるがAPIが無い」ものはゼロ。**

---

## 3. migration 131 vs 161 の正確な差分

### 131_posts.sql（古い方）

```sql
ow_posts:      content 1〜500文字
ow_post_likes: PRIMARY KEY (post_id, user_id)  ← 複合主キー
ow_post_comments: ✅ テーブルあり（content 1〜300文字、id UUID PK）
```

### 161_add_posts.sql（新しい方）

```sql
ow_posts:      content 1〜1000文字  ← 上限を倍増
ow_post_likes: PRIMARY KEY id UUID  ← 単独 PK + UNIQUE(post_id, user_id)
ow_post_comments: ❌ テーブルなし（完全に削除された）
```

### 差分まとめ

| 項目 | migration 131 | migration 161 |
|------|--------------|--------------|
| content 文字数上限 | 500 | 1000 |
| ow_post_likes の PK | 複合 (post_id, user_id) | 単独 id UUID |
| ow_post_comments | ✅ あり | ❌ なし |
| RLS ポリシー名 | `anyone_read_posts` | `posts_select_public` |
| RLS `TO authenticated` | なし | あり（より明示的） |

### FeedClient はどちらの前提か?

**FeedClient は migration 131 前提で書かれている。**
- 文字数制限が 500 → 131 の定義と一致
- コメント機能が実装済み → 131 の `ow_post_comments` が必要
- 161 の 1000 文字・コメントなし設計とは噛み合わない

---

## 4. /feed と /posts の関係整理

### 結論: 別系統の独立実装。/posts は未完成の別バージョン

```
/feed/
  FeedClient.tsx    ← 1199行、投稿+いいね+コメント。完成品
  page.tsx          ← notFound() で封印
  loading.tsx       ← スケルトンあり

/posts/
  page.tsx          ← notFound() で封印
  PostsFilterBar.tsx    ← キーワード検索フィルター
  PostsTimelineFilter.tsx ← カテゴリ chip フィルター
  categoryMeta.ts   ← カテゴリ定義（event/hiring/culture/interview/product/other）
  loading.tsx
```

- **FeedClient は PostsFilterBar / PostsTimelineFilter を一切使っていない**
- `categoryMeta.ts` のカテゴリ（event/hiring/culture 等）は `ow_posts` スキーマに存在しない
- `/posts` 系は「カテゴリ付きの高機能版」として着手されたが、DB スキーマが伴わず未完成のまま封印されたと推測

**→ `/posts/` 以下（PostsFilterBar・PostsTimelineFilter・categoryMeta.ts）は削除候補。**  
フィード解封には不要。

---

## 5. 封印理由の推測

git コミットメッセージ「hide /feed /posts」から、**意図的に封印**されたことが確認できる。

推測される理由:

1. **migration 161 で ow_post_comments を削除したタイミング**  
   FeedClient がコメント機能を使っているのに、テーブルを消す migration が追加された。
   壊れた状態でリリースしないよう一時封印した可能性が高い。

2. **または逆に 131 の後でコメント機能を追加し、161 はそれを知らずにテーブルを外した**  
   どちらにせよ migration の不整合が原因。

---

## 6. 解封前に先に直すべきこと

### 必須（ブロッカー）

**① Supabase 上の実テーブル状態を確認する**（下記 SQL を実行）

**② ow_post_comments テーブルの有無を確定させる**

| 状況 | 対処 |
|------|------|
| 131 が適用済み（comments テーブルあり） | そのまま /feed を解封できる |
| 161 が適用済み（comments テーブルなし） | migration 204 を作って comments テーブルを追加し、いいね PK を揃える |

**③ /feed/page.tsx を本来のサーバーコンポーネントに書き換える**（解封本体）

### 推奨（ブロッカーではない）

**④ /posts/ 以下を削除する**  
PostsFilterBar / PostsTimelineFilter / categoryMeta / loading / page = 5ファイル。
使われていないデッドコード。解封後に別コミットで整理。

**⑤ FeedClient の maxLength を確認**  
migration 161 が適用されている場合でも comments を追加するなら、
文字数は 131 の 500 に統一するのが FeedClient との整合性上自然。

---

## 7. Supabase 実テーブル確認 SQL

以下のクエリを Supabase SQL Editor で実行してください。

### 7-1. テーブルの存在確認

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ow_posts', 'ow_post_likes', 'ow_post_comments')
ORDER BY table_name;
```

**期待結果（131 が適用済みの場合）:**
```
ow_post_comments
ow_post_likes
ow_posts
```

**期待結果（161 が適用済みの場合）:**
```
ow_post_likes
ow_posts
```

---

### 7-2. ow_posts のカラム・制約確認

```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ow_posts'
ORDER BY ordinal_position;
```

---

### 7-3. content の文字数制約確認（CHECK 制約）

```sql
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.ow_posts'::regclass
  AND contype = 'c';
```

**131 の場合:** `char_length(content) BETWEEN 1 AND 500`  
**161 の場合:** `char_length(content) BETWEEN 1 AND 1000`

---

### 7-4. ow_post_likes の主キー構造確認

```sql
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.ow_post_likes'::regclass;
```

**131 の場合:** `PRIMARY KEY (post_id, user_id)`（id カラムなし）  
**161 の場合:** `PRIMARY KEY (id)` + `UNIQUE (post_id, user_id)`

---

### 7-5. RLS ポリシー確認

```sql
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('ow_posts', 'ow_post_likes', 'ow_post_comments')
ORDER BY tablename, policyname;
```

---

## 8. 解封ロードマップ（確認結果別）

### パターン A: 131 が適用済み（comments あり）

```
1. SQL で確認 → ow_post_comments あり
2. /feed/page.tsx を書き換え（notFound 削除 → Server Component に）
3. JobseekerHeader に /feed ナビリンク追加
4. ビルド確認・push（1コミット）
5. /posts/ 以下を削除（別コミット）
```

### パターン B: 161 が適用済み（comments なし）

```
1. SQL で確認 → ow_post_comments なし
2. migration 204 を作成:
   - ow_post_comments テーブルを追加（131 の定義から）
   - ow_post_likes に id カラムと UNIQUE 制約を追加（161 の変更を引き継ぐ）
   - RLS ポリシーを揃える
3. Supabase SQL Editor で migration 204 を手動適用
4. 確認後 /feed/page.tsx を書き換え・ナビ追加
5. push（2コミット）
6. /posts/ 以下を削除（別コミット）
```

---

## まとめ

| 確認事項 | 結論 |
|---------|------|
| FeedClient の完成度 | **ほぼ完成**（TODO/モックなし、8 API 全実在） |
| 封印理由 | migration 131 vs 161 の不整合（comments テーブルが消えた） |
| /posts 系の関係 | 別系統の未完成品。FeedClient とは無関係。削除候補 |
| 解封ブロッカー | Supabase 上の実テーブル状態の確認（上記 SQL で判定） |
| 文字数制限 | FeedClient は 500文字 → migration 131 と一致 |
| 解封後の工数 | パターン A なら 1コミット、パターン B なら migration 1本追加で解封可能 |
