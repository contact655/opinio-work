# ow_jobs → ow_roles 4経路 統合方針メモ

作成: 2026-07-24 セッション28（部門・職種マスタ実装後）

---

## 背景

`ow_jobs` から職種カテゴリを参照する経路が現在4本存在する。  
今回の部門・職種マスタ実装（Migration 270）で5本目を追加しそうになったが、  
設計判断により既存経路（4本目）を再利用する形に落ち着いた。  
この経緯と統合方針を記録しておく。

---

## 4本の経路一覧

### 経路 1: `ow_jobs.job_category` (TEXT フリーテキスト)

| 項目 | 内容 |
|------|------|
| カラム型 | `TEXT`（フリーテキスト、正規化なし） |
| DB 件数 | 74件中 `NULL` 以外が大半（実測未確認） |
| 追加経緯 | 最初期の設計。ow_roles が整備される前の仮実装 |
| 参照箇所 | `src/app/api/cron/weekly-match/route.ts` の `getDefaultReason()` |
| 具体的な使い方 | `job_category.includes("営業")` のような文字列マッチで送信メールの「マッチ理由」文を切り替える |
| 問題点 | フリーテキストなのでスペルゆれがあり、`getDefaultReason()` の分岐が拾えないケースがある |

### 経路 2: `ow_jobs.role_category_id` (FK → `ow_roles`)

| 項目 | 内容 |
|------|------|
| カラム型 | `UUID FK REFERENCES ow_roles(id)` |
| DB 件数 | 設定済み件数は要確認（`ow_roles` 29件に対応） |
| 追加経緯 | Phase 5 Stage 1 前後。正規化された職種参照の本命として追加 |
| 参照箇所 | `src/lib/supabase/queries.ts`（`getJobEmployees`, `getJobAlumniMap`, `getParentCatInfo` 等）<br>`src/app/(jobseeker)/jobs/(list)/JobsClient.tsx`（求人一覧の職種フィルタ）<br>`src/app/(jobseeker)/jobs/[id]/page.tsx`（求人詳細のロールマッチ社員表示）<br>`src/lib/supabase/types.ts`（FK 型定義） |
| 具体的な使い方 | 求人一覧の職種フィルタ・求人詳細の「この職種を経験した社員」表示・アルムナイマッチング |
| 備考 | ow_experiences.role_category_id とも対応。**現在最も広く使われる主経路** |

### 経路 3: `ow_job_roles` 結合テーブル (join table)

| 項目 | 内容 |
|------|------|
| テーブル構造 | `job_id UUID FK → ow_jobs`, `role_id UUID FK → ow_roles`, `is_primary BOOL`, その他 |
| DB 件数 | 13件（13 distinct job_id、0件が count > 1 ← 2026-07-24 実測） |
| 追加経緯 | 1つの求人が複数職種にまたがるケース（例: 兼任・ハイブリッドロール）を表現するために追加 |
| 参照箇所 | `src/lib/business/jobs.ts`（`fetchJobById` で取得）<br>`src/app/biz/jobs/[id]/edit/page.tsx`（`initialJobRoles` として JobEditForm に渡す）|
| `is_primary` の意味 | 複数行ある場合に「主担当職種」を1件だけ指定するフラグ |
| **重要**: 現在の実態 | **全13件が `is_primary = true`、かつ job_id が全て distinct（1:1 状態）**。<br>スキーマは 1:N を想定した設計だが、現在はたまたま全件が単一ロールでの登録になっている。<br>今回の `company_job_role_id` 単数 FK 採用は「現在の 1:1 実態」に基づく判断であり、<br>スキーマ設計が変わったわけではない（将来 1:N になる可能性は残る）。 |

### 経路 4: `ow_jobs.company_job_role_id` (FK → `ow_company_job_roles`)

| 項目 | 内容 |
|------|------|
| カラム型 | `UUID FK REFERENCES ow_company_job_roles(id)` |
| DB 件数 | Migration 270 で追加。現在 0 件（ow_company_job_roles 自体が 0 件）|
| 追加経緯 | 2026-07-24 セッション28。企業が「自社の呼び方」で職種を管理するための紐づけ |
| 参照箇所 | 現時点では `/biz/organization` の JobRolesEditor から設定できるようになった段階 |
| 具体的な使い方 | 企業が「ISR」「AE」「CSM」のような自社用語で職種を管理し、標準職種（ow_roles）にも任意でマッピングできる |
| `ow_company_job_roles.standard_role_id` | `REFERENCES ow_roles(id)`（任意）。マッピングしておくとマッチング精度が上がる設計 |

---

## weekly-match での実態（2026-07-24 実測）

`src/app/api/cron/weekly-match/route.ts` を読んだ結果：

```typescript
const { data: publishedJobs } = await supabase
  .from("ow_jobs")
  .select("id, title, job_category, ...")
  .eq("status", "published")
  .order("created_at", { ascending: false })
  .limit(20);  // ← 最新20件のみ
```

- **`role_category_id` は weekly-match では一切使われていない**
- 職種参照は `job_category`（TEXT）のみ（`getDefaultReason()` 内の文字列マッチ）
- `.limit(20)` により公開求人 74件中 54件がメール対象外になっている
- これは `role_category_id` の設定有無とは無関係

> **別 issue として記録**: `.limit(20)` の上限を引き上げるか廃止するかは、  
> 週次メールの設計見直し時に検討する（現状は意図的な制限か設定忘れか不明）。

---

## 統合方針

### 最終的な「勝者」は **経路 2 (`role_category_id`)** と **経路 4 (`company_job_role_id`)**

| 経路 | 将来方針 |
|------|---------|
| 1: `job_category` (TEXT) | **残す（消さない）**。既存データが入っており、weekly-match が依存している。<br>新規求人入力では UI から除外済み（セッション27以前）。自然消滅方向。 |
| 2: `role_category_id` | **主経路として維持・強化**。求人一覧フィルタ・社員マッチング・アルムナイ表示の中心。<br>新規求人登録時に必ず設定するよう JobEditForm でガイドする。 |
| 3: `ow_job_roles` join table | **現状維持**。将来 1:N が必要になった場合に活用。<br>現在は 1:1 状態が続いている。`biz/jobs/[id]/edit` で読み込み済み。 |
| 4: `company_job_role_id` | **今後の企業側 UI で活用**。`/biz/organization` で職種マスタを設定したあと、<br>求人編集フォームで「自社の職種名」を選択できるようにする（次フェーズ）。 |

### **5本目は足さない**

経路の増加はクエリの複雑化・型定義の肥大化・メンテナンスコストの増大を招く。  
今後、求人と職種の新しい関連を表現したい場合は以下の方針を取る：

1. **既存 4 経路のどれかで表現できないか検討する（まず考える）**
2. 既存テーブルにカラムを追加するだけで済むなら新テーブルは作らない
3. 新経路が必要な場合は **どの経路を deprecated にするかを同時に決めてから** 追加する

---

## 付録: `ow_experiences.role_category_id` との対称性

`ow_experiences`（ユーザーの職歴）にも同名の `role_category_id (FK → ow_roles)` がある。  
これは `ow_jobs.role_category_id` と対称的な設計で、  
「ある求人のロール」と「ある人の職歴ロール」を同じ ow_roles で突き合わせることで  
アルムナイマッチングが成立する（`getJobAlumniMap` の中核ロジック）。

`ow_experiences.role_category_id` は求職者がプロフィール編集時に設定する。  
経路 1〜4 はすべて `ow_jobs` 側の話であり、`ow_experiences` 側の経路はこれとは別（1本のみ）。
