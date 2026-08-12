# ⚠️ ow_companies に列を足すときは GRANT が要る（2026-08-12 確立）

**`ow_companies` は `authenticated` の UPDATE が列単位になっている。
列を足したら `GRANT UPDATE (新列) TO authenticated;` を書かないと、
その列を SET する UPDATE が 403 で丸ごと落ちる。**

```sql
GRANT UPDATE (新列名) ON TABLE public.ow_companies TO authenticated;
```

⚠️ **落ちるのは「その列だけ」ではなくクエリ全体。** PostgREST は列単位で
落としてくれないので、`.update({ tagline, 新列 })` のように1列でも権限の無い列が
混ざると、そのリクエストが丸ごと `permission denied for table ow_companies` になる。
症状は「保存ボタンを押したら失敗する」で、原因が RLS の拒否と区別しにくい。

## なぜこうなっているか

`20260812060545_company_master_normalization.sql` で
`normalized_name` と `canonical_company_id` の2列を
**authenticated から書けないようにした**ため。

| 列 | 理由 |
|---|---|
| `normalized_name` | トリガーが `name` から必ず再計算する派生値。アプリが書く必要がない |
| `canonical_company_id` | 重複の統合先。**運営の判断結果**であって、企業や求職者が書き換えてよい値ではない |

### ⚠️ `REVOKE UPDATE (列) FROM authenticated` だけでは効かない

**テーブルレベルの UPDATE を持つロールに対する列単位の REVOKE は no-op になる**
（テーブルレベルの権限が全列を含意するため）。PostgreSQL の仕様で、
警告すら出ないことがある。2026-08-12 に実際に踏み、migration の事後チェックで
検知して1度ロールバックした。

正しい手順は「テーブルレベルを落として、除きたい列以外を付け直す」:

```sql
REVOKE UPDATE ON TABLE public.ow_companies FROM authenticated;
GRANT UPDATE (col1, col2, …) ON TABLE public.ow_companies TO authenticated;  -- 除く列以外の全部
```

migration では列を手で書かず `information_schema.columns` から動的に組み立てている。
手で列挙すると必ず取りこぼす（当時148列）。

**この結果、テーブルレベルの UPDATE が無くなったので、
以降に追加した列は「権限が付いていない状態」で生まれる。**

## 現状（2026-08-12 実測）

| ロール | ow_companies の権限 |
|---|---|
| `anon` | SELECT のみ（テーブルレベル） |
| `authenticated` | SELECT / INSERT / DELETE はテーブルレベル。**UPDATE だけ列単位（148列）** |
| `service_role` | 全権（`rolbypassrls = true`） |

`normalized_name` / `canonical_company_id` を書けるのは **service_role だけ**。
運営の操作（ADMIN 画面）はサーバー側の `createAdminClient()` を通るので問題ない。

## 確認のしかた

列を足したあと、必ず実測すること。**「書いたつもり」で通さない。**

```sql
-- 権限が付いていない列を洗い出す（0件であること）
select column_name
  from information_schema.columns
 where table_schema='public' and table_name='ow_companies'
   and column_name not in ('normalized_name','canonical_company_id')
   and not has_column_privilege('authenticated','public.ow_companies',column_name,'UPDATE');
```

## 関連

- `20260812060545_company_master_normalization.sql` — この状態を作った migration
- `src/lib/experiences/columns.ts` — 同じ「列を足すときに触る箇所」の問題を
  `ow_experiences` 側で扱ったもの。あちらは SELECT が列単位
- CLAUDE.md「列単位 GRANT を剥がすときのチェックリスト」
