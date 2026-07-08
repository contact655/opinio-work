# アプリ内通知（通知ベル）調査レポート（2026-07）

調査日: 2026-07-08  
スコープ: 「自分の投稿へのいいね・コメント」に絞った通知ベル  
変更なし（調査のみ）

---

## 1. 現状調査

### 1-A. 通知インフラの有無

**結論: 通知インフラはゼロから構築が必要。**

| 調査対象 | 結果 |
|---------|------|
| `supabase/migrations/` 内の `ow_notifications` | **なし**（grep確認済み） |
| `src/` 内の "notification" 文字列 | メール通知テンプレート（`lib/notify/templates.ts`）のみ。ベル・バッジ・既読管理は一切なし |
| `JobseekerHeader.tsx` のベルアイコン | **なし**。現状はアバター + ドロップダウンのみ |
| Realtime subscriptions | `ow_post_comments` / `ow_posts` への Realtime 購読なし |

### 1-B. いいね API（`/api/jobseeker/posts/[id]/likes/route.ts`）

```typescript
// POST — いいね追加
supabase.from("ow_post_likes")
  .upsert({ post_id, user_id: owUserId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })

// DELETE — いいね削除
supabase.from("ow_post_likes")
  .delete()
  .eq("post_id", postId)
  .eq("user_id", owUserId)
```

- `resolveOwUserId()` で `auth_id → ow_users.id` を解決
- `checkPostVisibility()` で `visibility !== "private"` を確認
- **通知 INSERT なし**（現状はいいねの永続化のみ）

### 1-C. コメント API（`/api/jobseeker/posts/[id]/comments/route.ts`）

```typescript
// POST — コメント追加
supabase.from("ow_post_comments")
  .insert({ post_id: postId, user_id: owUserId, content })
  .select("id, content, created_at, user:ow_users!user_id(...)")
  .single()
```

- 投稿者の `visibility` チェックあり（private は 403）
- **通知 INSERT なし**（同上）
- コメント後に通知を送るには、INSERT 後にこのルートへ数行追加するだけでよい

### 1-D. `JobseekerHeader.tsx` の現状構造

```
<header>
  ロゴ | NAV_LINKS | [検索オーバーレイ] | auth actions
</header>
```

auth actions（ログイン済み）:
```
<div className="hidden md:flex" gap=10>
  [アバター + シェブロン] → ドロップダウン
</div>
```

モバイルでは `MobileBottomNav` に通知タブを追加するか、
ヘッダーにベルボタンを追加する形になる。

ベルを追加する場合の挿入位置:
```tsx
// アバターボタンの左横（hidden md:flex ブロック内）
[ベルボタン]  [アバター + シェブロン]
```

---

## 2. 設計提案

### 2-A. テーブル設計

```sql
CREATE TABLE ow_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  actor_user_id     UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('like', 'comment')),
  post_id           UUID NOT NULL REFERENCES ow_posts(id) ON DELETE CASCADE,
  comment_id        UUID REFERENCES ow_post_comments(id) ON DELETE SET NULL,
  is_read           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ow_notifications_recipient ON ow_notifications(recipient_user_id, is_read, created_at DESC);
```

**RLS:**
- 受信者は自分宛ての通知のみ SELECT / UPDATE（is_read の更新）
- INSERT は全認証ユーザー（API Route から最終的には adminClient を使う方が安全）
- DELETE は受信者のみ（または CASCADE で親レコード削除時に自動削除）

**除外設計（自分が自分の投稿にいいね/コメントした場合）:**
- INSERT 前に `recipient_user_id = actor_user_id` のチェックを追加し、自己通知はスキップ

### 2-B. API 設計

```
GET  /api/jobseeker/notifications         — 未読通知一覧（最新20件）
PATCH /api/jobseeker/notifications/read   — 全件既読（または指定IDを既読）
```

**GET レスポンス例:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "like",
      "actor": { "id": "uuid", "name": "山田太郎", "avatarUrl": null },
      "post": { "id": "uuid", "contentPreview": "今日のミーティングで..." },
      "isRead": false,
      "createdAt": "2026-07-08T12:34:56Z"
    }
  ],
  "unreadCount": 3
}
```

### 2-C. 通知 INSERT のタイミング

| イベント | ファイル | 追加位置 |
|---------|---------|---------|
| いいね追加 | `likes/route.ts` POST 成功後 | `upsert` の後に INSERT（自己いいね除外） |
| コメント追加 | `comments/route.ts` POST 成功後 | `insert` の後に INSERT（自己コメント除外） |

どちらも **best-effort**（通知 INSERT 失敗がユーザー操作をブロックしないよう `try/catch`）。

### 2-D. ベルアイコン UI

**デスクトップ（`JobseekerHeader.tsx` 内）:**

```tsx
// hidden md:flex ブロック内、アバターの左に追加
{user && (
  <NotificationBell unreadCount={unreadCount} />
)}
[アバター + シェブロン]
```

`NotificationBell` コンポーネント（`"use client"`）:
- ベルアイコン（`lucide-react` の `Bell`）
- 未読数 > 0 のとき赤バッジ（右上に数字 or ●）
- クリックでドロップダウン: 通知リスト最大5件 + 「全て見る →」リンク（`/mypage/notifications`）
- ドロップダウン開閉時に PATCH で既読化

**モバイル:**
- `MobileBottomNav` に通知タブ追加（ベルアイコン + 未読バッジ）、または
- ヘッダーにベルだけ追加（シンプルな実装）

**未読数取得:**
- ヘッダーは `"use client"` 内で `useEffect` → `GET /api/jobseeker/notifications?unread_only=true&limit=1` で件数取得
- Realtime は MVP では不要（ページリロード or ページフォーカス時に再取得で十分）

### 2-E. `/mypage/notifications` ページ（オプション）

通知一覧ページを `/mypage` に追加（タブとして）:
- `type=like`: 「{名前} さんがあなたの投稿にいいねしました」
- `type=comment`: 「{名前} さんがあなたの投稿にコメントしました：{本文30字}」
- 投稿へのリンク付き
- 「全件既読にする」ボタン

---

## 3. 実装分割案

### Migration（柴さん手動適用）
`supabase/migrations/XXX_create_ow_notifications.sql`

### Commit 1: Migration + 通知 INSERT（バックエンド）
- `likes/route.ts`: いいね追加後に `ow_notifications` INSERT（best-effort）
- `comments/route.ts`: コメント追加後に `ow_notifications` INSERT（best-effort）
- 自己通知スキップ: `recipient_user_id !== actor_user_id` チェック
- `GET /api/jobseeker/notifications/route.ts` 新規作成

### Commit 2: 通知ベル UI（フロントエンド）
- `src/components/jobseeker/NotificationBell.tsx` 新規作成
- `JobseekerHeader.tsx`: ログイン済み時にベルを追加
- `globals.css`: バッジスタイル追加

### Commit 3: 既読化 + mypage タブ（オプション）
- `PATCH /api/jobseeker/notifications/read/route.ts` 新規作成
- `/mypage` に通知タブ追加

---

## 4. リスク・制約

| リスク | 影響 | 対策 |
|--------|------|------|
| 通知 INSERT が likes/comments 本体をブロック | 高 | `try/catch` で best-effort |
| 自分が自分にいいねしたとき通知が来る | 低 | `recipient_user_id !== actor_user_id` チェック |
| 未読数がリアルタイムに更新されない | 低 | ページフォーカス時に refetch で十分（MVP） |
| 通知が大量に溜まる（将来） | 低 | 30日以上前の既読通知を cron で削除 |
| コメント削除時に通知が残る | 低 | `ON DELETE SET NULL`（comment_id）で対処済み |

---

## 5. 推奨: 最小実装

Phase 1 として以下の3ファイルで完結できる:

1. **Migration**: `ow_notifications` テーブル + RLS
2. **`likes/route.ts` 修正**: いいね後に INSERT（8行追加）
3. **`comments/route.ts` 修正**: コメント後に INSERT（8行追加）
4. **`GET /api/jobseeker/notifications`**: 未読一覧 API（40行）
5. **`NotificationBell.tsx`**: ベル + バッジ + ドロップダウン（100行）
6. **`JobseekerHeader.tsx` 修正**: ベルを挿入（5行）

Realtime・既読ページ・モバイル対応は後回しにして、まず「いいね/コメントが来たらベルに数字が出る」最小版から始めるのが安全。
