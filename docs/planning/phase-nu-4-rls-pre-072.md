# migration 072 適用前のスナップショット

取得日時: 2026-05-08  
目的: migration 072 適用前の ow_conversations_update ポリシーを記録

---

## ow_conversations_update（適用前）

```sql
(
  EXISTS (
    SELECT 1
    FROM ow_conversation_participants
    WHERE (ow_conversation_participants.conversation_id = ow_conversations.id)
      AND (ow_conversation_participants.user_id = auth.uid())   -- ← UUID 不一致バグ
      AND (ow_conversation_participants.left_at IS NULL)
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE (ow_user_roles.user_id = auth.uid())
      AND (ow_user_roles.role = 'admin'::text)
  )
)
```

### 問題箇所

`ow_conversation_participants.user_id` は `ow_users.id`（アプリ UUID）だが、
`auth.uid()` は `auth.users.id`（Supabase Auth UUID）で UUID 空間が異なる。
→ 一般ユーザーでの UPDATE が常に FALSE。

---

## schema_migrations 状態（072 適用前）

| version | name |
|---------|------|
| 068 | fix_ow_conversation_messages_rls |
| 069 | add_last_read_at_and_fix_update_rls |
| 070 | phase_nu_4_company_admin_rls |
| 071 | fix_ow_conversations_select_recursion |

072 は **未適用** であることを確認。
