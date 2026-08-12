# 求人開拓の対象リスト（2026-08-12 時点）

**下ろした求人 = 開拓の候補。** 2026-08-11 に出典が確認できず掲載を下ろした13件は、
裏を返せば「掲載したい企業と職種が既に分かっている」リストでもある。
消さずにここに残す。

## 経緯

`archive/147_add_sample_jobs.sql` が投入した13件は、そのファイル自身が
「サンプル求人データ追加」と書いており、**求人原文の URL がどこにも記録されていない**。
勤務地は全件「東京都」、勤務形態は全件 `hybrid` で、1件ずつ調べた形跡が無かった。

Opinio は有料職業紹介事業の許可事業者であり、実在しない求人の掲載は的確表示義務に関わる。
値の精度以前の問題として `status` を `draft` に落とした
（[`20260811155028_unpublish_unsourced_sample_jobs.sql`](../supabase/migrations/20260811155028_unpublish_unsourced_sample_jobs.sql)）。
**DELETE はしていない。**

## 対象6社・13件

いずれも外資 SaaS / 国産 SaaS の日本法人で、営業・CS・プリセールスが中心。
OPINIO の想定ユーザー層と重なる。

| 企業 | 件数 | 職種 |
|---|---|---|
| HubSpot Japan株式会社 | 3 | AE（Mid-Market）/ CSM / Solutions Engineer |
| Databricks Japan株式会社 | 2 | Enterprise AE（金融・製造）/ Solutions Architect（Data/AI） |
| Datadog Japan株式会社 | 2 | Enterprise AE / Sales Engineer（Infra/Cloud） |
| Notion Labs Japan合同会社 | 2 | AE（SMB Japan）/ Solutions Engineer |
| OpenAI Japan合同会社 | 2 | Enterprise AE / Solutions Architect |
| Sansan株式会社 | 2 | Rails エンジニア（名刺データ基盤）/ CS（エンタープライズ） |

⚠️ 6社とも `ow_companies` に**公開企業として登録済み**（`is_published = true`）。
企業ページは生きているので、求人だけが欠けている状態。

## 復活させるときの手順

**`source_url` を埋められない求人は公開しない**（CLAUDE.md）。

1. その企業の採用ページで**該当ポジションが現在も募集中か**を確認する
2. 募集中なら求人原文の URL を `ow_jobs.source_url` に入れ、`source_verified_at` を打つ
3. 原文と突き合わせて **`location` / `remote_work_status` / `description` を実際の値に直す**
   （現在の「東京都 / hybrid」は調べた値ではない。`description` は13件すべて空）
4. `status` を `published` に戻す

⚠️ **募集が終わっていたら復活させない。** その企業が別のポジションを募集していれば、
それは新規に作る（この13件を書き換えて流用しない。出所が混ざる）。

## 残タスクの見つけ方

`/admin/jobs` の「**出典なし（公開中）**」タブ。公開中なのに `source_url` が空の求人が出る。
2026-08-12 時点で該当は Salesforce の5件（`archive/152` 由来、URL の記載なし）。
こちらは採用ページとの突合待ちで保留にしてある。

## 現状の求人件数（2026-08-12 実測）

| status | 件数 | 内訳 |
|---|---|---|
| `published` | 5 | Salesforce（出典未確認・保留中） |
| `draft` | 13 | **このファイルの対象** |
| `draft`（`is_test`） | 2 | 自社のテスト求人 |
| 計 | 20 | |
