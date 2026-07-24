# ow_jobs → ow_roles 4経路 統合方針メモ

作成: 2026-07-24 セッション28（部門・職種マスタ実装後）  
実測日: 2026-07-24

> **件数の変遷（2026-07-24 調査確定）**
>
> | 時点 | 件数 | 主な変化 |
> |------|------|---------|
> | 2026-06-12 | 〜180件 | Migration 166: Salesforce Japan 106件追加後の推定値 |
> | 2026-07-15 | 74件 | Migration 231: Salesforce Japan テスト 106件削除後 |
> | 2026-07-24 | **20件** | Migration 238（medimo 25件削除）・239（Archi Village 18件・freee・LayerX 削除）等による |
>
> **RLS による行制限ではない**（service role 実測でも 20件）。
> soft delete（`deleted_at` カラムなし）でもない。`expires_at` は全件 NULL で除外ゼロ。
>
> 「企業はあるが求人が無い」でもない。企業ごと削除された（Migration 238/239 が会社レコードも DELETE している）。
> Archi Village・medimo は追加後に削除されたため、`add_company_slug` の UPDATE が 0 行に空振りした。

---

## 実測値サマリー（2026-07-24 時点、service role 実行）

```sql
SELECT count(*) FROM ow_jobs WHERE status = 'published';  -- 18件
SELECT count(*) FROM ow_jobs;                             -- 20件（下書き2件含む）
-- expires_at: 全件 NULL（除外ゼロ）
-- deleted_at カラム: 存在しない
```

---

## 4本の経路

### 経路 1: `ow_jobs.job_category` (TEXT フリーテキスト)

**件数（2026-07-24 実測）**

```sql
SELECT
  count(*) FILTER (WHERE job_category IS NOT NULL AND job_category != '') AS set,
  count(*) FILTER (WHERE job_category IS NULL OR job_category = '')      AS unset
FROM ow_jobs WHERE status = 'published';
-- set: 18, unset: 0
```

公開18件中 18件設定済み（100%）。

**概要**

| 項目 | 内容 |
|------|------|
| カラム型 | `TEXT`（フリーテキスト、正規化なし） |
| 追加経緯 | 最初期の設計。ow_roles が整備される前の仮実装 |
| 参照箇所 | `src/app/api/cron/weekly-match/route.ts` の `getDefaultReason()` のみ |
| 使われ方 | `job_category.includes("営業")` のような文字列マッチで送信メールの「マッチ理由」文を切り替える |
| 問題点 | フリーテキストなのでスペルゆれがあり、`getDefaultReason()` の分岐が拾えないケースがある |
| 将来方針 | 新規入力 UI からは除外済み（自然消滅方向）。weekly-match が依存しているため削除不可 |

---

### 経路 2: `ow_jobs.role_category_id` (UUID FK → `ow_roles`)

**件数（2026-07-24 実測）**

```sql
SELECT
  count(*) FILTER (WHERE role_category_id IS NOT NULL) AS set,
  count(*) FILTER (WHERE role_category_id IS NULL)     AS unset
FROM ow_jobs WHERE status = 'published';
-- set: 18, unset: 0
```

公開18件中 18件設定済み（100%）。

**概要**

| 項目 | 内容 |
|------|------|
| カラム型 | `UUID FK REFERENCES ow_roles(id)` |
| 追加経緯 | Phase 5 Stage 1 前後。正規化された職種参照として追加 |
| 参照箇所 | `src/lib/supabase/queries.ts`（`getJobEmployees`, `getJobAlumniMap`, `getParentCatInfo` 等）<br>`src/app/(jobseeker)/jobs/(list)/JobsClient.tsx`（求人一覧の職種フィルタ）<br>`src/app/(jobseeker)/jobs/[id]/page.tsx`（求人詳細の社員ロールマッチ表示）<br>`src/lib/supabase/types.ts`（FK 型定義） |
| 使われ方 | 求人一覧の職種フィルタ・求人詳細の「この職種を経験した社員」表示・アルムナイマッチング |
| 判定根拠 | 参照箇所数が最多（上記4ファイル以外にも queries.ts 内で複数回使用）。かつ公開全件に設定済み。経路 1 は weekly-match 限定・経路 3 は biz/jobs/edit 限定・経路 4 は未使用。複数ページの UI ロジックを担っているのはこの経路のみ |
| 将来方針 | 維持・強化。新規求人登録時に必ず設定するよう JobEditForm でガイドする |

---

### 経路 3: `ow_job_roles` 結合テーブル (join table)

**件数（2026-07-24 実測）**

```sql
SELECT
  count(*)              AS total,
  count(DISTINCT job_id) AS distinct_jobs,
  count(*) FILTER (WHERE is_primary = true)                AS is_primary_true,
  count(*) FILTER (WHERE is_primary = false OR is_primary IS NULL) AS is_primary_false
FROM ow_job_roles;
-- total: 13, distinct_jobs: 13, is_primary_true: 13, is_primary_false: 0
```

**概要**

| 項目 | 内容 |
|------|------|
| テーブル構造 | `job_id UUID FK → ow_jobs`, `role_id UUID FK → ow_roles`, `is_primary BOOL`, 他 |
| 追加経緯 | 1つの求人が複数職種にまたがるケースを表現するために追加 |
| 参照箇所 | `src/lib/business/jobs.ts`（`fetchJobById` で取得）<br>`src/app/biz/jobs/[id]/edit/page.tsx`（`initialJobRoles` として JobEditForm に渡す）|
| 将来方針 | 現状維持。将来 1:N が必要になった場合に活用 |

**`is_primary` について**

スキーマは 1:N を前提とした設計であり、`is_primary` は複数行ある場合に「主担当職種」を1件だけ指定するために存在する。

現在は全13件が `is_primary = true` かつ `distinct_jobs = 13`（行数 = distinct job_id 数）。1:1 状態になっているのは「1つの求人につき1職種を登録した」結果であり、スキーマの制約ではない。

今回の `company_job_role_id` を単数 FK として追加したのは「現在が 1:1 実態である」という観察に基づく判断であって、ow_job_roles の設計意図（1:N）が変わったわけではない。

---

### 経路 4: `ow_jobs.company_job_role_id` (UUID FK → `ow_company_job_roles`)

**件数（2026-07-24 実測）**

```sql
SELECT count(*) FROM ow_jobs WHERE status = 'published' AND company_job_role_id IS NOT NULL;
-- 0件

SELECT count(*) FROM ow_company_job_roles WHERE deleted_at IS NULL;
-- 0件（Migration 270 で新設、まだ企業側の登録なし）
```

**概要**

| 項目 | 内容 |
|------|------|
| カラム型 | `UUID FK REFERENCES ow_company_job_roles(id)` |
| 追加経緯 | 2026-07-24 セッション28（Migration 270）。企業が「自社の呼び方」で職種を管理するため |
| 参照箇所 | `/biz/organization` の JobRolesEditor から登録可能になった段階。求人フォームへの組み込みは未実装 |
| 使われ方 | 企業が「ISR」「AE」「CSM」等の自社用語で職種を管理し、標準職種（ow_roles）に任意でマッピングできる |
| `standard_role_id` | `ow_company_job_roles.standard_role_id REFERENCES ow_roles(id)`（任意）。設定するとマッチング精度が上がる設計 |
| 将来方針 | 求人編集フォームに「自社の職種名を選ぶ」フィールドを追加するフェーズで活用する |

---

## 統合方針

| 経路 | 将来方針 |
|------|---------|
| 1: `job_category` (TEXT) | 残す（消さない）。weekly-match が依存しているため。新規入力からは除外済み。自然消滅方向 |
| 2: `role_category_id` | 維持・強化（根拠: 参照箇所数最多、全公開求人に設定済み、UI ロジックの中心） |
| 3: `ow_job_roles` | 現状維持。1:N が必要になった場合に活用 |
| 4: `company_job_role_id` | 次フェーズで求人編集フォームに組み込む |

### 5本目は足さない

経路の増加はクエリの複雑化・型定義の肥大化・メンテナンスコストの増大を招く。  
今後、求人と職種の新しい関連を表現したい場合：

1. 既存4経路のどれかで表現できないか検討する
2. 既存テーブルへのカラム追加だけで済むなら新テーブルは作らない
3. 新経路が必要なら **廃止する経路を同時に決めてから** 追加する

---

## 別 issue: weekly-match の `.limit(20)` について

`src/app/api/cron/weekly-match/route.ts` は公開求人を最新20件に絞って取得している。

```typescript
.eq("status", "published")
.order("created_at", { ascending: false })
.limit(20)
```

**2026-07-24 時点の実態（実測）**

- 公開求人: 18件（service role 実測）
- 上限: 20件
- 現在の影響: なし（18 < 20 のため全公開求人が対象）

**将来リスク**

公開求人が21件を超えた時点で、新しい20件以外の求人が weekly-match メールから除外される。  
どの求人をメールに含めるかは「作成日が新しい順」で暗黙的に決まっている。

**対応方針（未着手）**

- 上限を引き上げる（例: 100件）か廃止して全件対象にする
- またはユーザーの `role_category_id` とマッチする求人を優先的に選ぶロジックを実装する
- `ow_match_scores` テーブルが0件のため、現状はマッチスコアが存在しても機能しない

この問題は経路の設計とは独立した改善課題として扱う。

---

## 付録: `ow_experiences.role_category_id` との対称性

`ow_experiences`（ユーザー職歴）にも `role_category_id (FK → ow_roles)` がある。  
`ow_jobs.role_category_id` と同じテーブルを参照することで、  
「ある求人のロール」と「ある人の職歴ロール」を突き合わせてアルムナイマッチングが成立する  
（`getJobAlumniMap` の中核ロジック）。

`ow_experiences.role_category_id` は求職者がプロフィール編集時に設定する。  
経路 1〜4 はすべて `ow_jobs` 側の話であり、`ow_experiences` 側は別（1本のみ）。
