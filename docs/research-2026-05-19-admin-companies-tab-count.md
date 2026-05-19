# 調査報告: /admin/companies タブ定義・絞り条件・件数不整合の事実確認

作成: 2026-05-19  
目的: 修正なし。事実のみ確認・記録。SELECT結果と突き合わせるための材料。

---

## 1. STATUS_TABS の定義（実コード）

`src/app/admin/companies/page.tsx` L7–12:

```typescript
const STATUS_TABS = [
  { key: "all",      label: "すべて"   },
  { key: "pending",  label: "審査待ち" },
  { key: "active",   label: "承認済み" },
  { key: "rejected", label: "却下"     },
];
```

**key の実値**: `"all"` / `"pending"` / `"active"` / `"rejected"` の4種。

---

## 2. フィルタ条件のコード（実コード）

`src/app/admin/companies/page.tsx` L47–50:

```typescript
const filtered = companies.filter((c) => {
  if (activeTab === "all") return true;
  return c.status === activeTab;
});
```

| activeTab の値 | 動作 |
|--------------|------|
| `"all"` | `return true` → 全件（条件なし）|
| `"pending"` | `c.status === "pending"` に一致する行のみ |
| `"active"` | `c.status === "active"` に一致する行のみ |
| `"rejected"` | `c.status === "rejected"` に一致する行のみ |

`activeTab` の初期値は `"all"`（L16: `useState("all")`）。  
`setActiveTab` はタブボタンのクリックで更新され、STATUS_TABS の `key` がそのまま入る。  
→ **activeTab に入る値は STATUS_TABS の key と完全一致**。

---

## 3. ow_companies.status カラムの定義（migration）

`supabase/migrations/001_create_tables.sql` L40:

```sql
status TEXT DEFAULT 'pending',
```

- 型: `TEXT`
- デフォルト: `'pending'`
- **CHECK 制約: なし**（他テーブルの status には `CHECK (status IN (...))` がある例あり
  ※ `ow_job_applications` は migration 049 で CHECK 追加済み）
- `ow_companies.status` には CHECK 制約が存在しないため、任意の文字列値が入りうる

### 全 migration で ow_companies.status に関する追加定義

| migration | 内容 |
|-----------|------|
| 001 | `status TEXT DEFAULT 'pending'` — 初期定義 |
| 031 | `remote_work_status TEXT` — 別カラム追加（status 本体は無変更） |
| **それ以外** | ow_companies.status を ALTER / CHECK 追加した migration は**存在しない** |

---

## 4. DB の実際の status 分布（MCP SELECT 確認）

```sql
SELECT status, COUNT(*) AS cnt
FROM ow_companies
GROUP BY status
ORDER BY cnt DESC;
```

| status | cnt |
|--------|-----|
| `'active'` | 33 |
| `'draft'` | 1 |
| `'pending'` | 1 |
| **合計** | **35** |

**`'rejected'` の行はゼロ件。`'draft'` が1件存在。**

---

## 5. タブ件数不整合の構造的説明（事実確定）

### 実機で観測された件数（handover-2026-05-18 追記より）

| タブ | 表示件数 |
|------|---------|
| すべて | 35 |
| 審査待ち | 1 |
| 承認済み | 33 |
| 却下 | 0 |
| **フィルタ合計** | **34** |

**差分: 35 - 34 = 1件**

### 原因（コードと DB 事実から確定）

STATUS_TABS の key は `"all"` / `"pending"` / `"active"` / `"rejected"` の4種。  
DB には `'draft'` という status 値が **1件存在**する。

`'draft'` の行は:
- `filtered`（`activeTab === "all"` → return true）に**含まれる** → 「すべて」の35件に入る
- `c.status === "pending"` → false → 「審査待ち」に**入らない**
- `c.status === "active"` → false → 「承認済み」に**入らない**
- `c.status === "rejected"` → false → 「却下」に**入らない**

→ **`'draft'` の1行がいずれのフィルタタブにも属さない**。これが差分1件の正体。

### 表示バッジとの二重の問題

`src/app/admin/companies/page.tsx` L137–141（ステータス列の表示）:

```typescript
{c.status === "active" ? "承認済" : c.status === "pending" ? "審査中" : "却下"}
```

このロジックは `"active"` でも `"pending"` でもない値を**すべて「却下」と表示**する。  
`status='draft'` の行は「却下」バッジで表示される。

→ **「すべて」タブでは「却下」と表示されているが、「却下」タブでは0件**という見た目上の矛盾が発生。

### 具体行の特定（前回調査との照合）

前回 MCP SELECT（research-2026-05-18-admin-companies-query.md）の結果より:

```
id:      100e46fe-5b4d-45ba-ba4a-9316264555dd
name:    株式会社Third Box
status:  'draft'
is_published: false
```

この行が「却下バッジで表示されるが却下タブに属さない」行。

---

## まとめ

| 問い | 事実 |
|------|------|
| STATUS_TABS の key 一覧 | `"all"` / `"pending"` / `"active"` / `"rejected"` |
| フィルタ方式 | JS 側 `c.status === activeTab`。DB クエリには WHERE なし |
| `"all"` の挙動 | `return true`（全件、条件なし）|
| status の CHECK 制約 | **なし**。任意文字列が入りうる |
| DB の実 status 値 | `active`(33) / `draft`(1) / `pending`(1) = 計35件 |
| 件数不整合の原因 | `status='draft'` の1行がフィルタタブの key（pending/active/rejected）にいずれも一致しない |
| 「却下バッジだが却下タブ0件」の原因 | 表示ロジックが `else → "却下"` のため draft が却下と表示される。しかしフィルタは `=== "rejected"` で厳密一致 |
| 修正の方向性（実装しない） | (A) STATUS_TABS に `{ key: "draft", label: "下書き" }` を追加、または (B) status='draft' の行を DB 上で pending/active/rejected に統一 |
