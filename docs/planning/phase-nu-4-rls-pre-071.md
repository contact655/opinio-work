# migration 071 適用前のスナップショット

取得日時: 2026-05-08  
目的: migration 071 適用前の ow_conversations_select ポリシーを記録

---

## ow_conversations_select（適用前）

```sql
(
  EXISTS (
    SELECT 1
    FROM ow_conversation_participants p
    WHERE (p.conversation_id = ow_conversations.id)
      AND (p.user_id IN (
        SELECT ow_users.id FROM ow_users WHERE (ow_users.auth_id = auth.uid())
      ))
  )
  OR (
    (company_id IS NOT NULL)
    AND EXISTS (
      SELECT 1
      FROM (ow_company_admins ca JOIN ow_users u ON (u.id = ca.user_id))
      WHERE (ca.company_id = ow_conversations.company_id)
        AND (u.auth_id = auth.uid())
        AND (ca.is_active = true)
    )
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE (ow_user_roles.user_id = auth.uid())
      AND (ow_user_roles.role = 'admin'::text)
  )
)
```

### 問題箇所（無限再帰の根）

`Condition A` の `EXISTS (SELECT 1 FROM ow_conversation_participants p ...)`  
→ `ow_conversation_participants_select` の Condition B が `JOIN ow_conversations` を参照  
→ `ow_conversations_select` が再び評価される → 無限ループ

---

## schema_migrations 状態（071 適用前）

| version | name |
|---------|------|
| 068 | fix_ow_conversation_messages_rls |
| 069 | add_last_read_at_and_fix_update_rls |
| 070 | phase_nu_4_company_admin_rls |

071 は **未適用** であることを確認。
