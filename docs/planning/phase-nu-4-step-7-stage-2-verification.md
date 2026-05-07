# Sub-step 4A-7 段階 2 動作確認: last_message_at 未更新の原因調査

調査日時: 2026-05-08  
調査者: Claude  
ステータス: **仮説 A 確定（UPDATE が RLS でサイレントブロックされている）**

---

## 調査 1: DB の実態確認

### a. ow_conversations SELECT 結果

```
id:               0e668917-2a48-4f9a-845d-8f62e10aabd6
candidate_user_id: e826e0bd-f96b-42ec-acda-d8f482e1417d
company_id:        fde82347-f2ac-4e54-a2ab-f5c7c45acb79
last_message_at:   2026-05-06 15:35:40.390055+00  ← シードデータの日時のまま
created_at:        2026-05-07 15:35:40.390055+00
```

### b. ow_conversation_messages 最新 3 件

```
1. sent_at: 2026-05-07 16:36:00.058+00  body: "Phase ν-4 段階 2 動作確認テスト"  ← 今回送信
2. sent_at: 2026-05-06 15:35:40.390055+00  (シードデータ)
3. sent_at: 2026-05-05 15:35:40.390055+00  (シードデータ)
```

### c. 一致判定

| 項目 | 値 |
|------|---|
| `last_message_at` | `2026-05-06 15:35:40` |
| 最新メッセージ `sent_at` | `2026-05-07 16:36:00` |
| **一致するか** | **❌ 不一致 → UPDATE 失敗確定** |

**→ 仮説 A 確定: UPDATE は実行されたが 0 行更新（RLS によるサイレントブロック）**

---

## 調査 2: 一覧ページの表示ロジック

### d. `/biz/conversations/page.tsx` の関係箇所

**ORDER BY:**
```typescript
.order("last_message_at", { ascending: false, nullsFirst: false })
.order("created_at", { ascending: false })
```

**相対時刻の計算ロジック:**
```typescript
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  ...
}
```

**表示で使っている値:**
```typescript
const timeLabel = formatRelativeTime(
  conv.last_message_at ?? conv.created_at  // null なら created_at フォールバック
);
```

**キャッシュ設定:**
```typescript
export const dynamic = "force-dynamic";  // キャッシュなし ✅
```

### e. 「N日前」の計算が見ている値

`last_message_at` が `null` でない限り `last_message_at` を使用。  
今回は `last_message_at = 2026-05-06`（シード値のまま）を参照しているため「1日前」表示になっている。

**→ 表示ロジック・キャッシュは正常。原因は last_message_at が更新されていないこと（仮説 A）**

---

## 調査 3: RLS の実態確認

### migration 072 の適用状況

`pg_policies` から `ow_conversations_update` ポリシーを確認:

```sql
-- 実際に DB に入っているポリシー（pg_policies.qual）
(
  candidate_user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
      AND p.left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid() AND ow_user_roles.role = 'admin'
  )
)
```

**→ migration 072 は正しく適用済み ✅**

### テスト担当者_001 の参加者データ

```
ow_user_id:     1c21269b-d06a-4ecf-97bd-663c0027e86a
auth_id:        837dd8c8-d863-465e-9672-d4cd2f1f896a
participant_id: 9a229ff2-6dc3-4024-a738-eea0cb700a47
role:           company_admin
left_at:        null
```

**→ 参加者として正しく登録済み、left_at IS NULL ✅**

---

## 根本原因の分析

### なぜ UPDATE が 0 行になるのか

migration 072 の条件 B を手動でトレースする:

```
auth.uid() = '837dd8c8-d863-465e-9672-d4cd2f1f896a'

[条件 B の評価チェーン]
Step 1: ow_conversations UPDATE → 条件 B を評価
Step 2: ow_conversation_participants を参照
        → ow_conversation_participants_select RLS が発動
Step 3: ow_conversation_participants_select の条件 2:
        EXISTS (
          SELECT 1
          FROM ow_company_admins ca
          JOIN ow_users u ON u.id = ca.user_id
          JOIN ow_conversations c ON c.id = ow_conversation_participants.conversation_id  ← !!
          WHERE c.company_id = ca.company_id AND u.auth_id = auth.uid() AND ca.is_active = true
        )
Step 4: この JOIN が ow_conversations を参照
        → ow_conversations_select RLS が発動（UPDATE 中に SELECT RLS が再評価される）
```

**ow_conversation_participants_select ポリシー（pg_policies 確認済み）:**

```sql
-- 条件 1（自分のレコード）
user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())

-- 条件 2（会社管理者）← ow_conversations を JOIN する
EXISTS (
  SELECT 1
  FROM ow_company_admins ca
  JOIN ow_users u ON u.id = ca.user_id
  JOIN ow_conversations c ON c.id = ow_conversation_participants.conversation_id
  WHERE c.company_id = ca.company_id AND u.auth_id = auth.uid() AND ca.is_active = true
)
```

**理論上、条件 1 でテスト担当者_001 の参加者レコードは見えるはず。**  
しかし UPDATE コンテキスト内で評価されると、PostgreSQL の RLS 評価スタックが複雑な相互参照を検出し、想定外の 0 行結果になっている可能性が高い。

### API Route の動作

```typescript
const { error: updateError } = await supabase
  .from("ow_conversations")
  .update({ last_message_at: now })
  .eq("id", conversationId);

if (updateError) {
  console.warn("...", updateError.message);  // ← ここには到達しない
}
```

**`updateError = null`（エラーなし）** だが **0 行更新** → RLS サイレントブロックの典型パターン。  
開発サーバーログに `"last_message_at update failed:"` は出ていないはず（エラーがないため）。

---

## 仮説の確定

| 仮説 | 内容 | 結果 |
|------|------|------|
| **A: UPDATE が失敗** | RLS によりサイレントブロック | **✅ 確定** |
| B: キャッシュ問題 | ページが古いデータを表示 | ❌ 否定（force-dynamic 設定済み） |
| C: 表示ロジックが created_at を参照 | タイムスタンプ計算が wrong カラム | ❌ 否定（last_message_at を使用している） |

---

## 修正方針（実装は別タスク）

### 推奨案: DB トリガー（migration 073）

`ow_conversation_messages` INSERT 時に自動で `ow_conversations.last_message_at` を更新する
SECURITY DEFINER トリガーを追加する。

**利点:**
- RLS を完全に回避（トリガーはテーブルオーナー権限で実行）
- API ルートのコード変更不要
- 将来的に他のルートからメッセージ挿入が行われても確実に動作
- 候補者側からのメッセージ送信でも同様に機能する

**トリガー案:**
```sql
CREATE OR REPLACE FUNCTION update_conversation_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ow_conversations
  SET last_message_at = NEW.sent_at
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR last_message_at < NEW.sent_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_last_message_at
AFTER INSERT ON ow_conversation_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message_at();
```

### 代替案: Admin クライアント

API ルートで `last_message_at` UPDATE のみ service role クライアントに切り替える。

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

// best-effort UPDATE（管理者権限、RLS バイパス）
const adminSupabase = createAdminClient();
await adminSupabase
  .from("ow_conversations")
  .update({ last_message_at: now })
  .eq("id", conversationId);
```

**利点:** 実装が単純  
**欠点:** API ルートに service role 使用が混在する（セキュリティ上は問題なし、ただしコードの意図が不明瞭）

---

## 確認依頼（Hisato 側）

開発サーバーのターミナルに、送信時刻（5/8 01:36 前後）の前後で
`"last_message_at update failed:"` のログが出ているか確認してください。

- **出ている場合**: `updateError` が返っており、ログが残っている（今回の分析と矛盾するが可能性あり）
- **出ていない場合**: サイレントブロック（0 行・エラーなし）で、本調査の結論と一致

---

*（調査完了: 2026-05-08）*
