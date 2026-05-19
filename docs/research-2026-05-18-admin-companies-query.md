# 調査報告: /admin/companies データ取得の事実確認

作成: 2026-05-18  
目的: 修正なし。事実のみ確認・記録。  
対象: commit `040340d` 時点の実装 + DB 現状（MCP SELECT 確認）

---

## 1. ページ実体ファイル

```
find src/app/admin -path "*companies*" の結果:

src/app/admin/companies/page.tsx          ← 一覧ページ（本調査の対象）
src/app/admin/companies/[id]/page.tsx     ← 詳細/編集ページ
src/app/admin/companies/[id]/CompanyDetailClient.tsx
```

`/admin/companies/new` 相当は**存在しない**（前回調査で確定済み）。

---

## 2. SELECT クエリの実装（実コード）

`src/app/admin/companies/page.tsx` L20–28:

```typescript
const loadCompanies = useCallback(async () => {
  const supabase = createClient();            // ← browser client（anon key）
  const { data } = await supabase
    .from("ow_companies")
    .select("*, ow_jobs(id)")
    .order("created_at", { ascending: false });
  setCompanies(data || []);
  setLoading(false);
}, []);
```

### WHERE 句の有無

| 条件 | コードにあるか |
|------|--------------|
| `is_published` による絞り込み | **なし** |
| `status` による絞り込み | **なし** |
| `source` による絞り込み | **なし** |

**DB への SELECT 自体には WHERE 条件が一切ない。**

### クライアントサイドフィルター

```typescript
const filtered = companies.filter((c) => {
  if (activeTab === "all") return true;
  return c.status === activeTab;             // "pending" / "active" / "rejected"
});
```

タブ切り替えによるフィルターは**取得後の JS フィルター**。
DB 側には影響しない（全件取得して JS で絞っている）。

### 使用クライアント

```typescript
import { createClient } from "@/lib/supabase/client";
```

`src/lib/supabase/client.ts` の **browser client（anon key）**。
`src/lib/supabase/admin.ts` の service role client ではない。

→ **RLS が適用される**。

---

## 3. ow_companies の RLS ポリシー（SELECT、MCP で確認）

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ow_companies'
ORDER BY cmd, policyname;
```

| ポリシー名 | cmd | qual（行が見える条件） |
|-----------|-----|----------------------|
| `ow_companies_own_select` | SELECT | `auth.uid() = user_id` |
| `ow_companies_public_read` | SELECT | `status = 'active'` |
| `ow_companies_published_read` | SELECT | `is_published = true OR status = 'active'` |

RLS は **OR 結合**（いずれか1つを満たせば SELECT 可）。

---

## 4. Salesforce 行が見えない理由（事実確定）

### Salesforce 行の現状（MCP SELECT 確認）

```
id:           c3664ef1-5571-4645-b30f-1474e7961c17
status:       'pending'
is_published: false
source:       'admin_seed'
user_id:      NULL（INSERT 時に指定しなかったため）
```

### RLS 3ポリシーとの照合

| ポリシー | 条件 | Salesforce 行での評価 |
|---------|------|----------------------|
| `ow_companies_own_select` | `auth.uid() = user_id` | `auth.uid() = NULL` → NULL（false 扱い）❌ |
| `ow_companies_public_read` | `status = 'active'` | `'pending' = 'active'` → false ❌ |
| `ow_companies_published_read` | `is_published = true OR status = 'active'` | `false OR false` → false ❌ |

**3ポリシーすべてで false → RLS が行を除外 → DB から返却されない。**

### 結論

Salesforce 行が `/admin/companies` に表示されない理由は：

1. **直接原因**: admin ページが `createClient()`（anon key）を使用しているため RLS が適用される
2. **RLS 側の原因**: Salesforce 行は `status='pending'` かつ `is_published=false` かつ `user_id=NULL` であり、既存 SELECT ポリシーをいずれも満たさない
3. **`is_published=false` の影響**: `is_published=false` だけなら `ow_companies_public_read`（`status='active'`）が通りうるが、`status='pending'` もあるため両方で NG

`is_published` 単体が原因ではなく、**`status='pending'` + `user_id=NULL` の組み合わせによる RLS の完全不一致**が真因。

---

## 5. 他の "見えているはずなのに見えない" 行の可能性

MCP SELECT 結果（最新 10 件）より：

| name | status | is_published | user_id | 表示されるか |
|------|--------|-------------|---------|------------|
| 株式会社セールスフォース・ジャパン | pending | false | NULL | ❌ RLS で除外 |
| 株式会社Third Box（2） | active | true | - | ✅ 2ポリシー適合 |
| 株式会社Third Box | draft | false | - | ⚠️ 要確認（`status='draft'` は既存3ポリシー不一致、user_id 次第） |
| 株式会社Opinio | active | false | - | ✅ `status='active'` ポリシー適合 |
| テスト商事_20260513_1 | active | false | - | ✅ `status='active'` ポリシー適合 |

`status='draft'` の行（`100e46fe`）も user_id が NULL なら RLS で除外される。

---

## まとめ

| 問い | 事実 |
|------|------|
| SELECT に WHERE はあるか | **なし**（is_published/status/source いずれも条件なし） |
| フィルターはどこで行われるか | **RLS（DB層）**で行われている。JS 側フィルターはタブ表示の絞り込みのみ |
| Salesforce が見えない理由 | RLS の3 SELECT ポリシーをすべて満たさないため。`is_published` だけでなく `status='pending'` + `user_id=NULL` の複合 |
| 修正の方向性（事実のみ、実装はしない） | (A) admin ページを service role client に変更し RLS をバイパスする、または (B) `admin_seed` 行向けの SELECT ポリシーを追加する（例: `auth_is_admin()` が true なら全件見える） |

---

## 関連ファイル（今回読んだもの）

- `src/app/admin/companies/page.tsx` — 全文確認済み
- `src/lib/supabase/client.ts` — import 参照確認
- DB: `pg_policies` WHERE `tablename = 'ow_companies'` — MCP で確認
- DB: `ow_companies` 最新 10 件 — MCP で確認
