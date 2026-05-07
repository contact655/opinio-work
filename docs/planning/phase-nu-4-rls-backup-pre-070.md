# Migration 070 適用前 RLS バックアップ

**取得日時**: 2026-05-07  
**取得元**: リモート DB（Supabase MCP 経由、read-only）  
**用途**: migration 070 適用前の状態。ロールバック時に本ファイルの SQL で復元可能。  
**状態**: `migration 070` 未適用の状態のスナップショット  
**対象テーブル**: `ow_conversation_participants`、`ow_conversations`

---

## ow_conversation_participants（3 ポリシー）

### INSERT ポリシー: `ow_conversation_participants_insert`

| 項目 | 値 |
|------|-----|
| schema | public |
| cmd | INSERT |
| permissive | PERMISSIVE |
| roles | {public} |
| qual (USING) | null |

```sql
-- WITH CHECK:
(
  EXISTS (
    SELECT 1 FROM ow_conversation_participants existing
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND existing.user_id = auth.uid()          -- ⚠️ UUID 空間不一致（常に false）
      AND existing.left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid() AND ow_user_roles.role = 'admin'
  )
)
```

> **注**: `existing.user_id = auth.uid()` は `ow_users.id`（ow UUID）と `auth.uid()`（auth UUID）の UUID 空間不一致のため常に false。事実上 admin のみ INSERT 可能な状態。migration 070 で修正対象。

---

### SELECT ポリシー: `ow_conversation_participants_select`

| 項目 | 値 |
|------|-----|
| schema | public |
| cmd | SELECT |
| permissive | PERMISSIVE |
| roles | {public} |
| with_check | null |

```sql
-- USING (qual):
(
  user_id IN (
    SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid() AND ow_user_roles.role = 'admin'
  )
)
```

> migration 070 で company_admin 条件を追加して緩和予定。

---

### UPDATE ポリシー: `ow_conversation_participants_update`

| 項目 | 値 |
|------|-----|
| schema | public |
| cmd | UPDATE |
| permissive | PERMISSIVE |
| roles | {public} |

```sql
-- USING (qual):
(
  user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
-- WITH CHECK (同上):
(
  user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
```

> migration 069 で修正済み。migration 070 では変更しない。

---

## ow_conversations（3 ポリシー）

### INSERT ポリシー: `ow_conversations_insert`

| 項目 | 値 |
|------|-----|
| schema | public |
| cmd | INSERT |
| permissive | PERMISSIVE |
| roles | {public} |
| qual (USING) | null |

```sql
-- WITH CHECK:
(
  candidate_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid() AND ow_user_roles.role = 'admin'
  )
)
```

> migration 070 では変更しない。

---

### SELECT ポリシー: `ow_conversations_select`

| 項目 | 値 |
|------|-----|
| schema | public |
| cmd | SELECT |
| permissive | PERMISSIVE |
| roles | {public} |
| with_check | null |

```sql
-- USING (qual):
(
  EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (
        SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid() AND ow_user_roles.role = 'admin'
  )
)
```

> migration 070 で company_admin 条件を追加して緩和予定。

---

### UPDATE ポリシー: `ow_conversations_update`

| 項目 | 値 |
|------|-----|
| schema | public |
| cmd | UPDATE |
| permissive | PERMISSIVE |
| roles | {public} |
| with_check | null |

```sql
-- USING (qual):
(
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE ow_conversation_participants.conversation_id = ow_conversations.id
      AND ow_conversation_participants.user_id = auth.uid()   -- ⚠️ UUID 不一致残存
      AND ow_conversation_participants.left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid() AND ow_user_roles.role = 'admin'
  )
)
```

> migration 070 では変更しない（対話 stage 変更フローの実装時に別途対処予定）。

---

## ロールバック SQL（手動実行用）

migration 070 を取り消す場合は `supabase/rollbacks/070_rollback.sql` を実行。  
または以下を直接実行:

```sql
BEGIN;

-- ow_conversation_participants INSERT を旧状態に戻す
DROP POLICY IF EXISTS "ow_conversation_participants_insert" ON ow_conversation_participants;
CREATE POLICY "ow_conversation_participants_insert"
ON ow_conversation_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants existing
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND existing.user_id = auth.uid()
      AND existing.left_at IS NULL
  )
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ow_conversations SELECT を旧状態に戻す
DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;
CREATE POLICY "ow_conversations_select"
ON ow_conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ow_conversation_participants SELECT を旧状態に戻す
DROP POLICY IF EXISTS "ow_conversation_participants_select" ON ow_conversation_participants;
CREATE POLICY "ow_conversation_participants_select"
ON ow_conversation_participants FOR SELECT
USING (
  user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '070';

COMMIT;
```
