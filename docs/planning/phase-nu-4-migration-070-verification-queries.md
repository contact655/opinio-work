# Migration 070 動作確認クエリ集

**作成日**: 2026-05-07  
**用途**: migration 070 ローカル適用後の動作確認  
**前提**: Supabase ローカル環境（`npx supabase start` 済み）または MCP 経由リモート実行  

---

## シナリオ 1: ポリシー反映確認

migration 070 適用後、3 つのポリシーが意図通り書き換わっていることを確認する。

```sql
-- 3 ポリシーの現在の定義を取得
SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('ow_conversation_participants', 'ow_conversations')
  AND policyname IN (
    'ow_conversation_participants_insert',
    'ow_conversation_participants_select',
    'ow_conversations_select'
  )
ORDER BY tablename, cmd;
```

**期待値チェックリスト（WITH CHECK / USING に以下のキーワードが含まれているか）:**

| ポリシー | 確認キーワード | 期待 |
|---------|--------------|------|
| `ow_conversation_participants_insert` WITH CHECK | `u.auth_id = auth.uid()` | ✅ ow_users JOIN パターン |
| `ow_conversation_participants_insert` WITH CHECK | `ow_company_admins` | ✅ company_admin 条件 B |
| `ow_conversations_select` USING | `ow_company_admins` | ✅ company_admin 条件 B |
| `ow_conversation_participants_select` USING | `ow_company_admins` | ✅ company_admin 条件 B |

旧パターン（不正）が残っていないことも確認:
```sql
-- 旧パターン残存チェック（結果が 0 行ならOK）
SELECT policyname, with_check
FROM pg_policies
WHERE tablename = 'ow_conversation_participants'
  AND policyname = 'ow_conversation_participants_insert'
  AND with_check LIKE '%existing.user_id = auth.uid()%';
-- 期待: 0 行（旧パターンが消えている）
```

---

## シナリオ 2: create_conversation RPC の動作確認

`create_conversation` は SECURITY DEFINER（RLS バイパス）なので、migration 070 の影響を受けない。
念のため RPC 定義を確認する。

```sql
-- create_conversation の prosecdef フラグ確認
SELECT
  proname,
  prosecdef,
  provolatile,
  prosrc IS NOT NULL AS has_source
FROM pg_proc
WHERE proname = 'create_conversation';
-- 期待: prosecdef = true
```

```sql
-- RPC で実際に ow_conversations + ow_conversation_participants が作成されているか確認
-- （既存データから件数を確認するだけ）
SELECT
  (SELECT COUNT(*) FROM ow_conversations)   AS conversations_total,
  (SELECT COUNT(*) FROM ow_conversation_participants) AS participants_total,
  (SELECT COUNT(*) FROM ow_conversation_participants WHERE left_at IS NULL) AS active_participants;
```

---

### シナリオ 2-B: ブラウザでの実動作確認（必須）

シナリオ 2 の SQL は「定義確認」のみであり、実動作の保証にはならない。
migration 070 適用後に、Sub-step 4A-3 で確認したフローを再実行して
create_conversation RPC が引き続き動作することを確認する:

1. ブラウザでログイン状態にする（Hisato 自身のアカウント可）
2. `/jobs/[任意の求人ID]/apply` にアクセス
3. 申込フォーム送信
4. 「応募が完了しました」モーダル表示を確認
5. `/mypage/applications` で応募が一覧に追加されていることを確認
6. `ow_conversations` と `ow_conversation_participants` に新規行が
   追加されていることを Supabase MCP で SELECT 確認

**期待結果:**
- 応募完了モーダルが表示される
- `ow_conversations` に新規行（`company_id`, `candidate_user_id` 含む）
- `ow_conversation_participants` に candidate の participant 行

**失敗時の意味:**
- `create_conversation` RPC が migration 070 によって壊れた可能性がある
- 即座に「緊急ロールバック手順」を実行すること

---

## シナリオ 3: 同社 HR の対話 SELECT 確認

`テスト株式会社_021`（company_id: `f3d87ca8-7bc2-4945-b741-b696af2b632c`）の HR が
同社の対話を SELECT できる状態になっているかをポリシー定義ベースで確認する。

```sql
-- シナリオ設定確認: テスト会社の対話一覧
SELECT
  c.id            AS conversation_id,
  c.company_id,
  co.name         AS company_name,
  c.status,
  c.created_at
FROM ow_conversations c
JOIN ow_companies co ON co.id = c.company_id
WHERE c.company_id = 'f3d87ca8-7bc2-4945-b741-b696af2b632c'  -- テスト株式会社_021。動的取得した値に置換可能
ORDER BY c.created_at DESC
LIMIT 10;
```

```sql
-- テスト会社_021 に紐づく ow_company_admins の確認
SELECT
  ca.id,
  ca.company_id,
  ca.user_id,
  u.name          AS user_name,
  u.auth_id,
  ca.is_active
FROM ow_company_admins ca
JOIN ow_users u ON u.id = ca.user_id
WHERE ca.company_id = 'f3d87ca8-7bc2-4945-b741-b696af2b632c';  -- テスト株式会社_021。動的取得した値に置換可能
```

```sql
-- SELECT ポリシーの条件 B を手動でシミュレート
-- （特定 auth_id でログインした HR が company_id を通じて対話を見られるか）
-- ※ auth.uid() の代わりに auth_id を直接指定して確認する
-- 現役社員_061 の auth_id が company_admin に登録されていれば対話が取得できる
SELECT
  c.id            AS conversation_id,
  c.status,
  c.created_at
FROM ow_conversations c
WHERE c.company_id IS NOT NULL
  AND c.company_id = (
    SELECT ca.company_id FROM ow_company_admins ca
    JOIN ow_users u ON u.id = ca.user_id
    WHERE u.id = '9dca9561-ebca-4232-9670-0c463a745753'  -- 現役社員_061。動的取得した値に置換可能
      AND ca.is_active = true
    LIMIT 1
  )
LIMIT 10;
-- 期待: テスト株式会社_021 に対応する ow_conversations が存在すれば取得される
--       存在しない場合は 0 行（データ不足。シナリオ 4 で INSERT 後に再実行）
```

```sql
-- ow_conversation_participants SELECT の条件 B シミュレート
-- 同社 HR が対話参加者一覧を閲覧できるか
SELECT
  p.id,
  p.conversation_id,
  p.user_id,
  u.name   AS participant_name,
  p.left_at
FROM ow_conversation_participants p
JOIN ow_users u ON u.id = p.user_id
WHERE p.conversation_id IN (
  SELECT c.id FROM ow_conversations c
  WHERE c.company_id = 'f3d87ca8-7bc2-4945-b741-b696af2b632c'  -- テスト株式会社_021。動的取得した値に置換可能
)
LIMIT 20;
```

---

## シナリオ 4: INSERT RLS の動作確認

`ow_conversation_participants` INSERT ポリシーの修正確認。
旧パターン（`existing.user_id = auth.uid()`、常に false）が新パターン（ow_users JOIN）に
変わったことで、candidates が参加者として登録できるようになるはず。

```sql
-- 現在の ow_conversation_participants に INSERT するテスト（管理コンソールから実行）
-- ※ ローカル環境の場合、supabase db seed か直接 psql から service_role で実行
-- リモート MCP（read_only=true）では INSERT 不可。以下は確認用クエリのみ

-- 既存の参加者パターンを確認（正しい UUID 比較が機能しているか）
SELECT
  p.conversation_id,
  p.user_id,
  u.auth_id,
  u.name,
  p.left_at,
  p.created_at
FROM ow_conversation_participants p
JOIN ow_users u ON u.id = p.user_id
WHERE p.left_at IS NULL
ORDER BY p.created_at DESC
LIMIT 10;
```

```sql
-- INSERT ポリシーの条件 A（既存参加者として追加）の有効性確認
-- ある会話に既存参加者がいる場合、同じ会話に別ユーザーを追加できるか
-- 以下は件数確認のみ（実際の INSERT は service_role か RPC 経由で行う）
SELECT
  conversation_id,
  COUNT(*) AS participant_count
FROM ow_conversation_participants
WHERE left_at IS NULL
GROUP BY conversation_id
ORDER BY participant_count DESC
LIMIT 5;
```

```sql
-- INSERT ポリシーの条件 B（company_admin が自社対話に参加）の前提データ確認
-- テスト株式会社_021 の HR がどの対話に参加できるか（JOIN シミュレート）
SELECT
  c.id           AS conversation_id,
  c.company_id,
  ca.user_id     AS hr_user_id,
  u.name         AS hr_name,
  ca.is_active
FROM ow_conversations c
JOIN ow_company_admins ca ON ca.company_id = c.company_id
JOIN ow_users u ON u.id = ca.user_id
WHERE ca.is_active = true
  AND c.company_id = 'f3d87ca8-7bc2-4945-b741-b696af2b632c'  -- テスト株式会社_021。動的取得した値に置換可能
LIMIT 10;
-- 期待: テスト株式会社_021 の is_active=true な HR と、同社対話が JOIN できる
```

---

## テストデータ参照（動的取得）

⚠️ 以下の UUID は 2026-05-07 時点のスナップショット。Sub-step 4A-5
（テストデータ投入）で更新される可能性があるため、シナリオ 3/4 の SQL では
直接 UUID を埋め込まず、以下の動的取得クエリで取得した値を使用するか、
SELECT 文を直接埋め込む。

### 動的取得クエリ

```sql
-- 現役テスト社員ユーザー
SELECT id, name, auth_id FROM ow_users
WHERE name LIKE '現役社員_%'
ORDER BY name LIMIT 5;
```

```sql
-- テスト企業
SELECT id, name FROM ow_companies
WHERE name LIKE 'テスト株式会社_%'
ORDER BY name LIMIT 5;
```

```sql
-- アクティブな company_admin（シナリオ 3/4 前提確認用）
SELECT ca.id, ca.company_id, ca.user_id, u.name AS user_name, co.name AS company_name
FROM ow_company_admins ca
JOIN ow_users u ON u.id = ca.user_id
JOIN ow_companies co ON co.id = ca.company_id
WHERE ca.is_active = true
ORDER BY co.name LIMIT 5;
```

### 2026-05-07 スナップショット（参考）

シナリオ 3/4 の SQL 例で参照している UUID 値:
- 現役社員_061: `9dca9561-ebca-4232-9670-0c463a745753`
- 現役社員_062: `c156a20e-f551-4a74-bc46-cf3b856937bd`
- テスト株式会社_021: `f3d87ca8-7bc2-4945-b741-b696af2b632c`
- テスト株式会社_023: `321d0959-59c1-48cf-8b4f-09bf3b70395f`
- テスト株式会社_002: `19d43f7b-7288-40d3-a9c0-8427bfe3a42e`

これらが Sub-step 4A-5 後も有効か、上記動的取得クエリで再確認すること。

---

## 緊急ロールバック手順

リモート適用後に問題が発生した場合の対処手順。

### 判断基準（ロールバック要否）

| 症状 | 対応 |
|------|------|
| `/biz/conversations` 一覧が表示されない（HR ユーザーで） | ロールバック候補 |
| `/jobs/[id]/apply` 応募後に対話が作成されない | `create_conversation` RPC の問題 → ロールバック不要（RPC は RLS バイパス） |
| 既存求職者が自分の対話を見られなくなった | 緊急ロールバック実行 |
| admin ユーザーで対話が見えなくなった | 緊急ロールバック実行 |

### ロールバック実行手順

**方法 1（推奨）: Supabase ダッシュボードから手動 SQL 実行**

依存ツール最少・ブラウザ操作のみ。緊急時に最も確実。

1. [Supabase ダッシュボード](https://supabase.com/dashboard) → 対象プロジェクト → SQL Editor を開く
2. 以下の SQL を貼り付けて実行（`supabase/rollbacks/070_rollback.sql` の全文）:

```sql
BEGIN;

-- Section 1: ow_conversation_participants INSERT を旧状態に戻す
DROP POLICY IF EXISTS "ow_conversation_participants_insert" ON ow_conversation_participants;
CREATE POLICY "ow_conversation_participants_insert"
ON ow_conversation_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants existing
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND existing.user_id = auth.uid()   -- 旧: UUID 不一致で常に false だったが元に戻す
      AND existing.left_at IS NULL
  )
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Section 2: ow_conversations SELECT を旧状態に戻す
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

-- Section 3: ow_conversation_participants SELECT を旧状態に戻す
DROP POLICY IF EXISTS "ow_conversation_participants_select" ON ow_conversation_participants;
CREATE POLICY "ow_conversation_participants_select"
ON ow_conversation_participants FOR SELECT
USING (
  user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- schema_migrations からレコード削除
DELETE FROM supabase_migrations.schema_migrations WHERE version = '070';

COMMIT;
```

3. 実行後、`schema_migrations` から `070` が消えていることを確認:

```sql
SELECT * FROM supabase_migrations.schema_migrations WHERE version = '070';
-- 期待: 0 行
```

---

**方法 2: CLI から psql でローカル実行（ローカル環境用）**

ローカル環境で migration 070 を適用してテストした後に取り消す場合に使用。
**リモート DB には影響しない。**

```bash
# ローカル DB にロールバックを適用
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f /Users/hisato/opinio-work/supabase/rollbacks/070_rollback.sql
```

---

**方法 3（非推奨）: Supabase MCP の apply_migration 経由**

動作未確認のため緊急時には方法 1 を優先すること。
将来検証が済んだ時点でこのメモを更新する。

```
# 将来検証用メモ（動作確認後に手順を追記予定）
# Supabase MCP ツール: apply_migration
# 対象ファイル: supabase/rollbacks/070_rollback.sql
```

### ロールバック後の確認クエリ

```sql
-- ロールバック後: INSERT ポリシーに旧パターンが戻っているか
SELECT policyname, with_check
FROM pg_policies
WHERE tablename = 'ow_conversation_participants'
  AND policyname = 'ow_conversation_participants_insert';
-- 期待: existing.user_id = auth.uid() パターンが復活

-- schema_migrations の確認
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version >= '068'
ORDER BY version;
-- 期待: 068, 069 のみ表示（070 なし）
```
