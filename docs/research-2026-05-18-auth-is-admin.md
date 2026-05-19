# 調査報告: auth_is_admin() の実体確認

作成: 2026-05-18  
目的: 修正なし。事実のみ確認・記録。  
対象: migration 035/036 + DB 現状（MCP で確認）

---

## 1. 関数定義の場所（grep 結果）

```
grep -rn "auth_is_admin" supabase/migrations/ で確認した定義箇所:

supabase/migrations/035_fix_ow_user_roles_rls_and_backfill_tenant.sql  L18 — 初版 CREATE OR REPLACE
supabase/migrations/036_fix_auth_is_admin_bypass_rls.sql               L11 — 最終版 CREATE OR REPLACE（上書き）
```

**有効な定義は migration 036 の版**（`CREATE OR REPLACE` により 035 を上書き）。

---

## 2. 関数定義の中身（migration 036 実コード）

```sql
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER        -- 関数所有者（postgres）権限で実行
STABLE
SET search_path = public
SET row_security = off  -- 内部クエリで RLS をバイパス（PG15+ 対応）
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_admin() TO authenticated;
```

### 判定ロジック（事実）

| 項目 | 内容 |
|------|------|
| 参照テーブル | `public.ow_user_roles` のみ |
| 条件 | `user_id = auth.uid() AND role = 'admin'` |
| 戻り値 | boolean（EXISTS → true/false） |
| `ADMIN_EMAILS` 環境変数 | **使っていない**（関数内に env 参照なし） |
| 実行権限 | `SECURITY DEFINER`（postgres として実行）+ `SET row_security = off` |

**`ow_user_roles` に `user_id = auth.uid()` かつ `role = 'admin'` の行があれば true、なければ false。それだけ。**

### migration 035 との差分

migration 035 の初版は `SET row_security = off` が**ない**。  
PG15+ では `SECURITY DEFINER` 内でも RLS が適用されるため、`ow_user_roles` の admin ポリシー自身が `auth_is_admin()` を呼ぶ → 無限再帰が発生した。  
migration 036 で `SET row_security = off` を追加して解消。

---

## 3. auth_is_admin() を使っている既存 RLS ポリシー

### migration コード内（grep）

| migration | テーブル | ポリシー名 | cmd |
|-----------|---------|-----------|-----|
| 035 | `ow_user_roles` | `ow_user_roles_admin_read` | SELECT |
| 035 | `ow_profiles` | `ow_profiles_admin_read` | SELECT |
| 050 | `ow_company_external_links` | `company_external_links_editor_manage` | ALL |
| 103 | `ow_company_join_requests` | `Admins can view all join requests` | SELECT |
| 103 | `ow_company_join_requests` | `Admins can update all join requests` | UPDATE |

### DB 現状（MCP pg_policies SELECT）

```sql
SELECT policyname, tablename, cmd, qual
FROM pg_policies
WHERE qual LIKE '%auth_is_admin%'
ORDER BY tablename, cmd;
```

| policyname | tablename | cmd |
|-----------|-----------|-----|
| `company_external_links_editor_manage` | `ow_company_external_links` | ALL |
| `Admins can view all join requests` | `ow_company_join_requests` | SELECT |
| `Admins can update all join requests` | `ow_company_join_requests` | UPDATE |
| `ow_profiles_admin_read` | `ow_profiles` | SELECT |
| `ow_user_roles_admin_read` | `ow_user_roles` | SELECT |

**DB と migration コードは一致。計5ポリシーで auth_is_admin() を使用中。**

### ow_companies への適用状況

ow_companies には **auth_is_admin() を使うポリシーが現時点で存在しない**。  
既存3ポリシー（`ow_companies_own_select` / `ow_companies_public_read` / `ow_companies_published_read`）はいずれも auth_is_admin() を参照しない。  
→ admin ユーザーであっても、ow_companies に対する「全件 SELECT」は現状では付与されていない。

---

## 4. ow_companies に admin 全件 SELECT ポリシーを追加する前提確認

### 前提チェック

| 前提条件 | 確認結果 |
|---------|---------|
| `auth_is_admin()` 関数が DB に存在するか | ✅ migration 036 で定義済み・稼働中 |
| 関数が RLS 再帰問題を回避しているか | ✅ `SET row_security = off` 適用済み（036） |
| 他テーブルで同パターンの実績があるか | ✅ 5テーブルで使用済み（ow_profiles, ow_user_roles 等） |
| `auth.uid()` が admin の ow_user_roles 行から正しく返るか | ✅ s.hisato1020@gmail.com の admin ロールは 2026-05-01 から付与済み（handover 確認済み） |
| GRANT EXECUTE が authenticated に付与されているか | ✅ migration 036 L29 で付与 |

**前提は全て満たされている。**

### 追加ポリシーの概形（migration は書かない・実装しない）

```sql
-- 概念のみ。実装はしない。
CREATE POLICY "ow_companies_admin_all"
  ON ow_companies
  FOR ALL                      -- SELECT / UPDATE 両方を1ポリシーで、または SELECT のみでもよい
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());
```

このポリシーを追加すれば:
- `auth_is_admin() = true`（ow_user_roles に admin 行がある）ユーザーは全件 SELECT 可
- `/admin/companies` ページが `createClient()`（anon key）のままでも Salesforce 行が見える
- 既存3ポリシーとの OR 結合で他ユーザーへの影響なし

### 代替案との比較（記録のみ）

| 案 | 内容 | 影響範囲 |
|----|------|---------|
| **A: ポリシー追加**（上記） | `USING (auth_is_admin())` で全件 SELECT 許可 | migration 1本。既存コードの変更なし |
| **B: service role client** | admin ページを `createAdminClient()` に変更 | コード変更（page.tsx）。migration 不要。ただし admin 全ページに適用が必要 |

どちらが適切かは別途判断（今回は実装しない）。

---

## まとめ

| 問い | 事実 |
|------|------|
| auth_is_admin() の定義場所 | migration 036（035 を上書き）。関数本体は036が有効 |
| 判定ロジック | `ow_user_roles.user_id = auth.uid() AND role = 'admin'`。ADMIN_EMAILS 不使用 |
| RLS 再帰問題への対処 | `SECURITY DEFINER + SET row_security = off`（PG15+ 対応） |
| 既存の使用テーブル数 | 4テーブル、5ポリシー |
| ow_companies への適用 | **現状なし**。admin でも全件 SELECT 不可（これが Salesforce 不可視の根本） |
| ポリシー追加の前提 | **全て満たされている**。migration 1本で追加可能 |
