# Phase ν-4: ow_conversation_participants role CHECK 制約違反 — 調査レポート

作成日: 2026-05-08  
発生ステップ: Sub-step 4A-5 (テストデータ投入) の Dashboard 手動実行時

---

## エラー内容

```
ERROR: 23514: new row for relation "ow_conversation_participants"
violates check constraint "ow_conversation_participants_role_check"
DETAIL: Failing row contains (..., hr, 2026-05-07 15:28:30.440214+00, null, null)
```

シードSQL の `ow_conversation_participants` INSERT で `role = 'hr'` を使用したが、
DB の CHECK 制約で拒否された。

---

## 調査 1a: CHECK 制約の実際の定義

```sql
-- 制約名: ow_conversation_participants_role_check
CHECK (role = ANY (ARRAY[
  'candidate'::text,
  'company_admin'::text,
  'mentor'::text,
  'editor'::text,
  'operator'::text
]))
```

**許可値リスト: `candidate` / `company_admin` / `mentor` / `editor` / `operator`**  
**`hr` は許可リストに含まれていない** → 違反の直接原因

---

## 調査 1b: 既存 role 値分布

| role | 件数 |
|------|------|
| `candidate` | 2 |
| その他 | 0 |

`company_admin` / `mentor` 等はまだ1件も使われていない。  
既存データが `candidate` のみだったため、事前調査で CHECK 制約の許可リストを確認しなかったことが見落としの原因。

---

## 調査 1c: ソースコード内の role 値 grep 結果

```
src/app/(jobseeker)/auth/page.tsx:131:     role: "candidate"
src/app/onboarding/page.tsx:98:            role: "candidate"
```

- ソースコード内で `ow_conversation_participants` の `role` に設定されている値は `"candidate"` のみ
- `"company_admin"` / `"hr"` は現時点でソースコードに存在しない
- `mentor_role` や `role_title` の出現はすべて別コンテキスト（UI表示用ラベル）

---

## 調査 2d: SECTION [1] の投入状態

**結果: ロールバック済み（未投入）**

| 確認対象 | 期待 | 実際 |
|---------|------|------|
| 担当者_005 → 会社_001 の company_admins 登録 | 新規行あり | **0 件（ロールバック）** |
| 担当者_006 → 会社_002 の company_admins 登録 | 新規行あり | **0 件（ロールバック）** |

BEGIN/COMMIT の単一トランザクション内で SECTION [2] が失敗したため、
SECTION [1] の INSERT も含めてすべてロールバックされた。  
**本番 DB は投入前の状態と完全に同一**（conversations: 2件, participants: 2件, messages: 0件）。

---

## 根本原因の整理

### 事前調査の見落とし

`phase-nu-4-step-7-pre-investigation.md` では既存 participants の `role` 値を確認したが、
CHECK 制約の**許可リストそのものを参照しなかった**。

| 事前調査で確認したこと | 確認しなかったこと |
|----------------------|-----------------|
| 既存 role 値 = `'candidate'` のみ | CHECK 制約の許可リスト全体 |
| 'hr' という値の命名方針 | 'hr' が制約上許可されているか |

既存データが `'candidate'` のみだったため、他の許可値の存在に気づかなかった。  
実際には `'company_admin'` が許可リストに含まれており、これが HR 担当者用として意図された値と推定される。

---

## 修正方針: 2 案

### 案 1: seed SQL の `'hr'` → `'company_admin'` に置換（推奨）

**変更対象**: `supabase/seed/phase-nu-4-test-data.sql` の SECTION [2] のみ

```sql
-- 修正前
p1_hr AS (
  INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
  SELECT id, '1c21269b-...', 'hr'
  ...
),

-- 修正後
p1_hr AS (
  INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
  SELECT id, '1c21269b-...', 'company_admin'
  ...
),
```

同様に `p2_hr` の `'hr'` → `'company_admin'` も変更。

**波及範囲**:
- `supabase/seed/phase-nu-4-test-data.sql`: 2 箇所修正
- `phase-nu-4-master-plan.md` の lazy registration コード例: `role: 'hr'` → `role: 'company_admin'` に更新
- Sub-step 4A-7 の API Route 実装でも `'company_admin'` を使う必要がある

**メリット**:
- DB 制約変更不要（スコープ最小）
- 即日対応可能（migration 不要）
- 既存スキーマ設計の意図（'company_admin' = 企業側参加者）に従う

**デメリット**:
- マスタープランの `role: 'hr'` 記述と乖離する（要更新）
- `ow_company_admins.permission` の `'admin'/'member'` と
  `ow_conversation_participants.role` の `'company_admin'` が異なる命名体系になる

---

### 案 2: CHECK 制約に `'hr'` を追加する migration 072（非推奨）

```sql
-- migration 072（案）
ALTER TABLE ow_conversation_participants
  DROP CONSTRAINT ow_conversation_participants_role_check,
  ADD CONSTRAINT ow_conversation_participants_role_check
    CHECK (role = ANY (ARRAY[
      'candidate', 'company_admin', 'mentor', 'editor', 'operator', 'hr'
    ]));
```

**メリット**:
- マスタープランの `role: 'hr'` をそのまま使える
- HR（採用担当）と company_admin（管理者）の意味的な区別を明示できる

**デメリット**:
- migration 作成・適用のコストが発生（migration 072 ファイル + rollback + push）
- seed SQL + 4A-7 実装は `'hr'` のまま使えるが、DB スキーマ変更が必要
- `'hr'` は `'company_admin'` より狭義の概念であり、将来 HR 以外の社員が参加する場合に再拡張が必要になりうる

---

## 推奨: 案 1（'hr' → 'company_admin' への置換）

**根拠**:

1. **スキーマ設計の意図に沿う**: `'company_admin'` は元から許可リストに含まれており、
   「企業側が対話に参加する」ユースケースのために用意されていた値と推測される

2. **スコープ最小原則**: migration 072 を追加せず、seed SQL と master plan の修正のみで完結する

3. **ソースコードへの影響が局所的**: 現時点で `'hr'` を使っているコードは存在しない
   （4A-7 未実装のため）。今なら最小コストで変更できる

4. **命名の整合性**: `ow_conversation_participants.role` における `'company_admin'` は
   「この対話において企業側の立場で参加している人」を意味し、採用担当者のユースケースを包含できる

**必要な修正箇所（案 1 採用時）**:

| ファイル | 変更内容 |
|--------|---------|
| `supabase/seed/phase-nu-4-test-data.sql` | `'hr'` × 2 箇所 → `'company_admin'` |
| `docs/planning/phase-nu-4-master-plan.md` | lazy registration の `role: 'hr'` → `role: 'company_admin'` |
| `src/app/api/biz/conversations/[id]/messages/route.ts`（4A-7 未実装） | 実装時に `'company_admin'` を使用 |

---

## ⚠️ 将来注意事項

4A-7 の lazy registration API Route を実装する際、必ず `role: 'company_admin'` を使うこと:

```typescript
// 正しい実装（案 1 採用時）
await supabase.from('ow_conversation_participants').insert({
  conversation_id: conversationId,
  user_id: owUserId,
  role: 'company_admin',  // ← 'hr' は CHECK 制約違反
});
```

---

*（調査完了: 2026-05-08）*
