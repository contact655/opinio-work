# migration 074 適用前のスナップショット

取得日時: 2026-05-08  
目的: migration 074 適用前の ow_conversation_participants_insert ポリシーを記録

---

## ow_conversation_participants_insert WITH CHECK（適用前）

```sql
(
  -- 条件 1: 自己参照（← 無限再帰の原因、074 で削除）
  EXISTS (
    SELECT 1
    FROM ow_conversation_participants existing
    JOIN ow_users u ON (u.id = existing.user_id)
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND existing.left_at IS NULL
  )
  -- 条件 2: 会社管理者
  OR EXISTS (
    SELECT 1
    FROM ow_company_admins ca
    JOIN ow_users u ON (u.id = ca.user_id)
    JOIN ow_conversations c ON (c.company_id = ca.company_id)
    WHERE c.id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  )
  -- 条件 3: admin
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
)
```

### 問題箇所

条件 1 の `FROM ow_conversation_participants existing` が、
INSERT ポリシー評価中に同テーブルを再 SELECT しようとするため、
PostgreSQL のポリシー評価スタックが「無限再帰」を検出してエラーになる。

---

## schema_migrations 状態（074 適用前）

| version | name |
|---------|------|
| 068 | fix_ow_conversation_messages_rls |
| 069 | add_last_read_at_and_fix_update_rls |
| 070 | phase_nu_4_company_admin_rls |
| 071 | fix_ow_conversations_select_recursion |
| 072 | fix_ow_conversations_update_rls |
| 073 | auto_update_last_message_at |

074 は **未適用** であることを確認。
