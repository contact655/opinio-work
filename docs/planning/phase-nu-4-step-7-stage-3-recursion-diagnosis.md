# Sub-step 4A-7 段階 3: 無限再帰エラー診断

調査日時: 2026-05-08  
調査者: Claude  
エラー: `infinite recursion detected in policy for relation "ow_conversation_participants"`

---

## 現状の RLS ポリシー定義（全文）

### ow_conversation_participants INSERT WITH CHECK

```sql
(
  -- ★ 条件 1: 同一テーブル直接参照（← これが原因）
  EXISTS (
    SELECT 1
    FROM ow_conversation_participants existing   -- ← 同テーブルを直接 SELECT
    JOIN ow_users u ON u.id = existing.user_id
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND existing.left_at IS NULL
  )
  -- 条件 2: 会社管理者（safe）
  OR EXISTS (
    SELECT 1
    FROM ow_company_admins ca
    JOIN ow_users u ON u.id = ca.user_id
    JOIN ow_conversations c ON c.company_id = ca.company_id
    WHERE c.id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  )
  -- 条件 3: admin（safe）
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
)
```

### ow_conversation_participants SELECT USING

```sql
(
  -- 条件 1: 自分のレコード（safe）
  user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
  -- 条件 2: 会社管理者（ow_conversations を JOIN → safe、後述）
  OR EXISTS (
    SELECT 1
    FROM ow_company_admins ca
    JOIN ow_users u ON u.id = ca.user_id
    JOIN ow_conversations c ON c.id = ow_conversation_participants.conversation_id
    WHERE c.company_id = ca.company_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  )
  -- 条件 3: admin（safe）
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
)
```

### ow_conversations SELECT USING（migration 071 適用後）

```sql
(
  -- 条件 1: 候補者本人（ow_conversation_participants を参照しない ✅）
  candidate_user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
  -- 条件 2: 会社管理者（ow_conversation_participants を参照しない ✅）
  OR (company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM ow_company_admins ca JOIN ow_users u ON u.id = ca.user_id
    WHERE ca.company_id = ow_conversations.company_id
      AND u.auth_id = auth.uid() AND ca.is_active = true
  ))
  -- 条件 3: admin
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
```

---

## 無限再帰の経路図

```
INSERT INTO ow_conversation_participants (新規参加者)
  │
  ├─► [INSERT RLS: WITH CHECK を評価]
  │
  ├─► 条件 1 評価:
  │     EXISTS (
  │       SELECT 1
  │       FROM ow_conversation_participants existing   ← !!同一テーブルを SELECT
  │       WHERE ...
  │     )
  │
  ├─► PostgreSQL が ow_conversation_participants を読もうとする
  │
  ├─► [SELECT RLS: ow_conversation_participants_select を評価しようとする]
  │
  └─► STOP: PostgreSQL のポリシー評価スタックが検出
        「ow_conversation_participants のポリシー評価中に
          ow_conversation_participants を再度評価しようとした」
        → ERROR: infinite recursion detected in policy for relation "ow_conversation_participants"
```

**なぜ SELECT RLS 経由でループしないか:**
- `ow_conversation_participants_select` の条件 2 は `ow_conversations` を参照するが…
- `ow_conversations_select`（migration 071 適用済み）は `ow_conversation_participants` を**参照しない** ✅
- よって間接的なループは migration 071 で既に解消されている

**条件 2/3 は safe な理由:**
- 条件 2 は `ow_conversations` を参照 → `ow_conversations_select` は `ow_conversation_participants` 不参照 → safe
- 条件 3 は `ow_user_roles` のみ → safe

---

## エラー発生位置の特定

| 操作 | エラー | 原因 |
|------|--------|------|
| SELECT（一覧・詳細表示） | ❌ 発生しない | SELECT RLS は自己参照なし |
| INSERT（参加ボタン） | ✅ **発生する** | WITH CHECK 条件 1 が自己参照 |
| UPDATE | ❌ 発生しない | UPDATE RLS は自己参照なし |

→ **エラーは JOIN API の INSERT 時のみ発生。SELECT は問題なし。**

---

## 修正方針の推奨

### 案 B: INSERT WITH CHECK から条件 1 を削除（推奨）

**変更内容:**
- `ow_conversation_participants_insert` WITH CHECK から条件 1（自己参照）を削除
- 条件 2（会社管理者）+ 条件 3（admin）のみ残す

**安全性の根拠:**
1. 条件 1 の意図は「既存参加者が新しい参加者を追加できる」だが、現行の join API では
   会社管理者チェック（API コード + 条件 2）で十分に制御されている
2. 条件 1 がなくても、会社の HR 担当者は条件 2 で参加できる
3. 候補者・候補者以外が他者を追加する経路は現行実装に存在しない
4. API ルートのコード修正不要（join/route.ts はそのまま機能する）

**セキュリティ変化:**
- BEFORE: 既存参加者 OR 会社管理者 OR admin が参加者追加可
- AFTER: 会社管理者 OR admin が参加者追加可
- → より制限的になる（後退なし）

### 案 A: SECURITY DEFINER 関数化（複雑）

条件 1 を SECURITY DEFINER 関数に置き換えることで自己参照を回避する。
migration 073 と同様のパターン。案 B より変更範囲が広い。

---

*（調査完了: 2026-05-08）*
