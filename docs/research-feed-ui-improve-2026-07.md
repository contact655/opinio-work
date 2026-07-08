# フィード UI 改善 調査レポート（2026-07）

調査日: 2026-07-08  
対象ファイル:
- `src/app/(jobseeker)/feed/FeedClient.tsx`（1199行）
- `src/app/(jobseeker)/feed/page.tsx`
- `src/app/api/jobseeker/posts/route.ts`
- `src/app/api/jobseeker/posts/[id]/route.ts`
- `src/app/(jobseeker)/people/page.tsx`（現職データ取得の参考実装）

---

## 1. 現状の投稿カード構造

### PostItem 型（FeedClient.tsx line 16–24）

```typescript
type PostUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  avatar_url: string | null;
};

type PostItem = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user: PostUser;       // ← name + avatar のみ。role_title / company なし
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};
```

### PostCard の描画要素（line 756〜992）

| 要素 | データ元 | スタイル |
|------|----------|---------|
| アバター（44px） | `post.user.avatar_url` / `avatar_color` | 円形、`/u/[id]` リンク |
| 名前 | `post.user.name` | 15px / weight 700 / `var(--ink)` / `/u/[id]` リンク |
| 時刻 | `post.created_at` → `relativeTime()` | 12px / `var(--ink-mute)` |
| 肩書き・会社 | **なし** | — |
| 本文 | `post.content` | 15px / line-height 1.75 / pre-wrap |
| 画像（任意） | `post.image_url` | 100%幅 / max-height 400px |
| いいねボタン | `post.liked_by_me`, `post.like_count` | 絵文字❤️/🤍 + 数字 |
| コメントボタン | `post.comment_count` | 絵文字💬 + 数字、クリックで展開 |
| 削除（オーナーのみ） | `myUserId === post.user.id` | `···` ボタン → 確認行 |

### カード・全体スタイルの数値

| 箇所 | 現状値 |
|------|--------|
| カード padding | `20px 24px` |
| カード間 marginBottom | `16px` |
| カード border-radius | `14px` |
| カード box-shadow | `0 1px 4px rgba(15,23,42,0.06)` |
| ヘッダー marginBottom | `14px`（アバター〜本文間） |
| 本文 marginBottom | `14px`（本文〜フッター間） |
| フッター paddingTop | `12px` / borderTop あり |
| いいね/コメントボタン padding | `6px 12px` |
| 全体コンテナ maxWidth | `680px` |
| 全体コンテナ padding | `32px 16px 64px` |
| h1「投稿」marginBottom | `24px` |

### PostComposer（投稿フォーム）

- アバター（44px）+ textarea（フォーカスで高さ拡張）
- 画像アップロードボタン（Supabase Storage → `ow-uploads/posts/`）
- 文字数カウンター（1000文字上限）
- 投稿ボタン
- カード padding: `20px 24px`、marginBottom: `16px`

---

## 2. 投稿者の肩書き・会社データ（改善1の肝）

### 現状

`PostUser` は `name` / `avatar_color` / `avatar_url` のみ。`role_title` / `company` は含まれていない。

### データの在処

`ow_experiences` テーブルの `is_current=true` 行に以下がある:
- `role_title TEXT` — 役職名（例: "プロダクトマネージャー"）
- `company_text TEXT` — 実名（例: "株式会社LayerX"）
- `company_anonymized TEXT` — 匿名表示用

**表示優先順位（/people の実装に準拠）:**
```
company_text || company_anonymized || null
```

### 参考実装: `/people/page.tsx` の現職取得（line 114–128）

```typescript
const { data: exps } = await adminSupabase
  .from("ow_experiences")
  .select("user_id, role_title, company_text, company_anonymized")
  .in("user_id", userIds)
  .eq("is_current", true);
```

→ `Map<user_id, { role_title, company }>` を作り、ユーザーカードに差し込むパターン。

### 改修が必要な箇所

| ファイル | 改修内容 |
|----------|---------|
| `src/app/api/jobseeker/posts/route.ts` GET | `ow_posts` SELECT の `user:ow_users!user_id()` に現職を JOIN するか、取得後に `ow_experiences` を `.in("user_id", postUserIds).eq("is_current", true)` で別クエリ。JOIN は Supabase PostgREST だと `ow_experiences!user_id` で 1:N になるため別クエリの方が確実 |
| `src/app/(jobseeker)/feed/page.tsx` | SSR でも同様に `ow_experiences` を別クエリして初期投稿に差し込む |
| `PostUser` 型 | `role_title: string \| null`, `company: string \| null` を追加 |
| `PostCard` | 名前の下に role_title / company を 12px / `var(--ink-soft)` で表示 |
| ページ読み込み後の「もっと見る」 | `/api/jobseeker/posts` GET のレスポンスにも同フィールドを追加 |

**難易度: 低〜中。**  
別クエリを2箇所（API GET + feed/page.tsx SSR）に追加するだけ。既存コードの改修は最小。
新規投稿時の `optimistic update`（PostComposer → handlePostCreated）にも `role_title`/`company` を空で渡しておけばよい（自分の投稿は自分で見るので問題ない）。

---

## 3. パーマリンク `/feed/[postId]`（改善3）

### 現状

- `/feed/[postId]` ルート: **存在しない**（`src/app/(jobseeker)/feed/` には `FeedClient.tsx`, `loading.tsx`, `page.tsx` の3ファイルのみ）
- `GET /api/jobseeker/posts/[id]`: **存在しない**。`[id]/route.ts` は `DELETE` のみ実装

### 実装方針

#### 3-A. API: `GET /api/jobseeker/posts/[id]`
既存の `src/app/api/jobseeker/posts/[id]/route.ts` に GET handler を追加:
```typescript
export async function GET(_req, { params }) {
  // ow_posts.id でシングル取得
  // liked_by_me: ログイン済みなら ow_post_likes チェック
  // 返値: PostItem 形式
}
```

#### 3-B. ルート: `src/app/(jobseeker)/feed/[postId]/page.tsx`
```
Server Component（async）
- params.postId で GET /api or adminSupabase 直呼び
- 取得できない(404) → notFound()
- OGP: title = 投稿者名 + 本文先頭50文字
- PostCard を再利用（ただし PostCard は FeedClient.tsx 内 function → 外部 export に変える必要あり）
```

#### PostCard の再利用について

**現状の問題:** `PostCard` は `FeedClient.tsx` 内のローカル `function`（エクスポートなし）。  
**解決策A:** `src/components/feed/PostCard.tsx` に移動して export、FeedClient と permalink page の両方から import。  
**解決策B:** permalink page 用に別途シンプルな描画を書く（FeedClient の再利用なし）。

解決策Aが保守性高い。B は手軽だが重複。

#### 時刻クリックでパーマリンクへの導線

```tsx
// PostCard のヘッダー時刻部分
<Link href={`/feed/${post.id}`} style={{ color: "var(--ink-mute)", textDecoration: "none" }}>
  {relativeTime(post.created_at)}
</Link>
```

時刻クリック → 個別ページへ（LinkedIn / Twitter の定番パターン）。

**難易度: 中。**  
- `GET /api/jobseeker/posts/[id]` 追加（20行程度）
- `/feed/[postId]/page.tsx` 新規（Server Component、40行程度）
- PostCard のエクスポート or 外部化（FeedClient の1199行を分割する必要）
- 時刻を Link に変更（FeedClient 内1行）

リスク: PostCard 外部化時に FeedClient のローカル state (`showComments`, `liking` 等) との絡みに注意。PostCard は自己完結した state を持つ関数なので外部化しやすい。

---

## 4. 密度・視認性改善（改善2）

### 現状数値の問題点

| 問題 | 現状値 | LinkedIn 感覚 |
|------|--------|-------------|
| カード間隔が広い | `marginBottom: 16px` | 8〜12px |
| カード padding が大きめ | `20px 24px` | `16px 20px` |
| ヘッダー（アバター→本文）が広い | `marginBottom: 14px` | 10〜12px |
| 本文→フッター間が広い | `marginBottom: 14px` | 10〜12px |
| フッター padding が大きい | `paddingTop: 12px` | `paddingTop: 8px` |
| いいね/コメントボタン padding が大きい | `6px 12px` | `4px 10px` |
| アバターサイズ | `44px` | 40px（LinkedIn は 48px だが本文が短い） |
| 全体 maxWidth | `680px` | 適切（LinkedIn は 552px）|

### 具体的な提案数値

```
カード padding: 20px 24px → 16px 20px     （-4px垂直 / -4px水平）
カード marginBottom: 16px → 10px           （-6px）
ヘッダー marginBottom: 14px → 10px         （-4px）
本文 margin: "0 0 14px" → "0 0 10px"       （-4px）
フッター paddingTop: 12px → 8px            （-4px）
いいね/コメント padding: 6px 12px → 4px 10px  （-2px/-2px）
h1 marginBottom: 24px → 16px              （-8px）
全体 padding-top: 32px → 24px             （-8px）
```

→ カード1枚あたり約40pxの高さ削減。1画面（800px）に表示できる投稿数:  
現状: 約2.5件 → 改善後: 約3〜3.5件（本文量に依存）

**難易度: 最低。**  
FeedClient.tsx のスタイル数値を変えるだけ。機能・ロジック変更なし。

---

## 5. コメント展開の現状

**すでに実装済み・動作中。**

- `PostCard` の `useState(showComments)` でトグル
- コメントボタンクリック → `setShowComments(v => !v)` → `CommentSection` をレンダリング
- `CommentSection`（line 420〜699）: コメント一覧取得（GET `/api/jobseeker/posts/[id]/comments`）+ 投稿フォーム + 削除
- 各コメントに `c.user.id` → `/u/${c.user.id}` リンクあり
- コメント投稿者のアバター（32px）・名前・時刻も表示済み

**注意:** コメント投稿者にも現在 `role_title`/`company` はない（PostUser と同じ構造）。改善1を適用するならコメントにも検討するか否かは設計判断。

---

## 6. 難易度・実装範囲・リスクまとめ

| 改善 | 難易度 | 実装範囲 | リスク |
|------|--------|---------|--------|
| **改善2: 密度改善** | ★☆☆ | FeedClient.tsx スタイル数値のみ | ほぼなし |
| **改善1: 肩書き・会社** | ★★☆ | API GET + feed/page.tsx SSR + PostUser 型 + PostCard JSX | 現職0件ユーザーの空表示 |
| **改善3: パーマリンク** | ★★★ | API GET 追加 + 新ルート + PostCard 外部化 + 時刻リンク化 | PostCard 外部化で FeedClient 分割が必要 |

---

## 7. 実装分割案（推奨順序）

### Commit 1: 密度改善（改善2）— 単独・即実装可
`FeedClient.tsx` のみ。スタイル数値8箇所を変更。ビルドリスクなし。

### Commit 2: 肩書き・会社表示（改善1）— 2ファイル改修
1. `PostUser` 型に `role_title` / `company` 追加
2. `GET /api/jobseeker/posts/route.ts` に `ow_experiences` 別クエリ追加
3. `feed/page.tsx` SSR に同クエリ追加（初期20件）
4. `PostCard` のヘッダー部分に肩書き行を追加

### Commit 3: パーマリンク（改善3）— 最も広い
1. `PostCard` を `src/components/feed/PostCard.tsx` に外部化
2. `FeedClient.tsx` を PostCard import に変更
3. `GET /api/jobseeker/posts/[id]/route.ts` に GET handler 追加
4. `src/app/(jobseeker)/feed/[postId]/page.tsx` 新規作成
5. PostCard の時刻部分を `<Link href={/feed/${post.id}}>` に変更

**推奨:** 1→2→3 の順。各コミットが独立して価値を持つ。

---

## 補足: API 変更の影響範囲

`GET /api/jobseeker/posts` のレスポンスに `role_title`/`company` を追加しても、
既存の `FeedClient` の「もっと見る」（line 1038）は同APIを呼ぶ。
型拡張なので後方互換性あり（フロントが新フィールドを無視するだけ）。
