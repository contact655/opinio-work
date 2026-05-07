# migration 073 適用前のスナップショット

取得日時: 2026-05-08  
目的: migration 073 適用前の ow_conversation_messages トリガー状態を記録

---

## ow_conversation_messages トリガー（適用前）

```
取得結果: [] (0件)
```

`trg_update_last_message_at` は **未設置** であることを確認。

---

## ow_conversations.last_message_at（適用前）

| id | last_message_at |
|----|----------------|
| `0e668917-2a48-4f9a-845d-8f62e10aabd6` | `2026-05-06 15:35:40.390055+00` |
| `7afca1de-38a7-4971-b853-2449688b410b` | `2026-05-05 03:35:40.390055+00` |

※ `0e668917-...` は段階 2 動作確認で送信したメッセージ（sent_at: `2026-05-07 16:36:00`）が
last_message_at に反映されていないことを示している（UPDATE RLS サイレントブロック）。

---

## schema_migrations 状態（073 適用前）

| version | name |
|---------|------|
| 068 | fix_ow_conversation_messages_rls |
| 069 | add_last_read_at_and_fix_update_rls |
| 070 | phase_nu_4_company_admin_rls |
| 071 | fix_ow_conversations_select_recursion |
| 072 | fix_ow_conversations_update_rls |

073 は **未適用** であることを確認。
