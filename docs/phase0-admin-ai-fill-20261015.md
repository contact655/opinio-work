# フェーズ0（ステップ0）: 運営画面で、自分のAIの答えを貼り戻して企業情報を埋める

**実測日: 2026-10-15**（本番 DB・SELECT のみ。コード・migration・データは変更していない）
母数は**掲載21社**（`listing_status='listed'`・公開・`is_test=false`・自社を除く）。

---

## 1. 項目と充填状況（掲載21社のうち空の社数）

| 項目 | 列・表 | 空 |
|---|---|---|
| 事業の説明 | `ow_companies.description` | **0** |
| 一言（タグライン） | `ow_companies.tagline` | 0 |
| 事業領域（主） | `ow_company_business_domains`（`is_primary`） | **0** |
| 事業領域（従） | 同上（`is_primary=false`） | **16** |
| 業種 | `ow_companies.industry_id` | 0 |
| 対象業界の区分 | `ow_companies.target_industry_scope` | 0（21社とも `horizontal`） |
| 対象業界（vertical のみ） | `ow_company_target_industries` | 0（vertical が0社） |
| ★お客さまの業界（2026-10-12 の分類） | `ow_company_customer_industries` ＋ `serves_consumers` / `customer_all_industries` | 0 |
| 会社のフェーズ（旧） | `ow_companies.phase` | 0 |
| ★事業ステージ（2026-10-12 の分類） | `ow_companies.company_stage` | **1** |
| 資本区分 | `ow_companies.capital_type` | 0 |
| 本社の国（外資系のみ） | `ow_companies.hq_country` | 0 |
| **勤務形態（リモート）** | `ow_companies.remote_work_status` | **20** |
| 従業員数 | `ow_companies.employee_count`（自由入力） | 0 |
| 従業員数の帯 | `ow_companies.employee_count_band` | 0 |
| 本社所在地 | `ow_companies.headquarters_address` | 0 |
| 設立年 | `ow_companies.founded_year` | 0 |
| **福利厚生** | `ow_companies.benefits`（jsonb） | **20** |
| 勤務時間制度 | `ow_companies.work_time_system` | **21** |
| 公式サイト | `ow_companies.url` | 2 |

**→ 実際に埋まっていないのは「勤務形態（20社）」「福利厚生（20社）」「勤務時間制度（21社）」「事業領域の従（16社）」の4つ。**
指示にある他の項目はほぼ埋まっている（上書きの対象になる）。

⚠️★**2026-10-12 に別の作業で分類が作り替わっている**（`company_stage`・`hq_country`・お客さまの業界）。
旧来の `phase` / `target_industry_scope` / `ow_company_target_industries` と**新しい分類が並存**している。
質問文にどちらを入れるかは決める必要がある（§5 論点1）。

---

## 2. 型と制約

| 項目 | 型 | 制約 |
|---|---|---|
| `description` | text | 自由入力（運営の PUT で 5000字まで） |
| `tagline` | text | 300字まで |
| 事業領域 | マスタ `ow_business_domains` | **有効 192件**（`status` = active / merged / rejected の階層つき）。主1つ＋従は合計3まで（`MAX_BUSINESS_DOMAINS_PER_COMPANY = 3`） |
| `industry_id` | マスタ `ow_industries` | **有効 50件**（親13＋子）。下に全件 |
| `target_industry_scope` | text | CHECK: `vertical` / `horizontal` / `consumer` / NULL |
| `phase` | text | CHECK: `startup` `listed` `non_listed` `seed` `series_a` `series_b` `series_c` `series_d` `unicorn` `mega_venture` `ipo_ready` `listed_prime` `listed_standard` `listed_growth` `listed_overseas` / NULL |
| `company_stage` | text | CHECK: `startup_early` スタートアップ（創業期）／`startup_growth`（成長期）／`ipo_prep` IPO準備中／`listed` 上場企業／`mega_venture` メガベンチャー／`sme` 中堅・中小企業／`large` 大企業 |
| `capital_type` | text | CHECK: `foreign_subsidiary` `japanese_independent` `japanese_group` `other` / NULL |
| `hq_country` | text | CHECK: 英字2文字（`lib/companies/classification.ts` の国リスト） |
| `remote_work_status` | text | CHECK: `full_remote` フルリモート可／`hybrid` ハイブリッド（週2-3日出社）／`on_site` 原則出社／`other` その他（`lib/constants/workStyle.ts`） |
| `employee_count` | text | 自由入力（「約200名」） |
| `employee_count_band` | text | CHECK: `1-10` `11-50` `51-200` `201-500` `501-1000` `1001-5000` `5001-10000` `10001+` |
| `headquarters_address` | text | 300字まで |
| `founded_year` | integer | — |
| `benefits` | jsonb | `[{"name": "…", "detail"?: "…"}]`（`lib/companies/benefits.ts` が型） |
| `work_time_system` | text | 自由入力 |

### 業種マスタ（有効50件）

IT・インターネット（ソフトウェア・SaaS／インターネットサービス／SIer・受託開発／通信・ネットワーク／ゲーム）／メーカー（電機・電子部品／化学・素材／食品・飲料／自動車・輸送機器／医薬品・医療機器）／商社・小売・流通（小売／専門商社／総合商社／物流）／金融（銀行／証券・投資／保険／ベンチャーキャピタル）／不動産・建設（不動産／建設・設計）／医療・介護（病院・クリニック／介護・福祉）／人材サービス（人材紹介・派遣／求人メディア・採用プラットフォーム／採用支援・人事コンサル）／コンサルティング（戦略・総合／IT・DX／会計・財務／人事・組織）／広告・メディア（広告代理店／出版・放送／Webメディア）／官公庁・団体・教育（官公庁・自治体／学校・教育／NPO・団体）／生活・サービス（旅行・観光／飲食／エンタメ・レジャー／その他サービス）

### 事業領域マスタ（有効192件）

⚠️ **192件を質問文にすべて列挙すると長い**（AI の回答精度も落ちる）。§5 論点2。
主なもの: AI・データ(`ai`)／クラウド・インフラ(`infra`)／開発者ツール(`devtools`)／セキュリティ(`security`)／CRM・営業支援(`crm`)／業務効率化(`collab`)／基幹業務システム(`erp`)／リーガルテック(`legal`)／HR Tech(`hr`)／Webマーケティング(`marketing`)／マーケットプレイス(`marketplace`)／DX推進(`consulting`)／フィンテック／ヘルスケアIT／EdTech／受託開発／システム運用・保守 … ほか（全件は `ow_business_domains` の `is_active` を引けば出る）

---

## 3. 既存の運営の更新経路と revalidate

| 何を | ルート | revalidate |
|---|---|---|
| 説明・一言・業種・従業員数・帯・勤務形態・本社所在地・設立年・URL など | `PUT /api/admin/companies/[id]`（許可列のホワイトリスト。勤務形態は `VALID_COMPANY_REMOTE_WORK_STATUSES` で検証、選択肢外は保存しない） | `revalidateCompanyPages(id)` ＋ `revalidateTag("business-domains")` |
| 事業領域 | `PUT /api/admin/companies/[id]/business-domains` → `setCompanyBusinessDomains()`（`/biz` と共通） | 関数の中で `revalidateCompanyPages` ＋ `revalidateTag("business-domains")` |
| 対象業界（旧） | `PUT /api/admin/companies/[id]/target-industries` | `revalidateCompanyPages` ＋ `revalidateTag("business-domains")` |
| 資本区分・本社の国・事業ステージ・お客さまの業界（新） | `PUT /api/admin/companies/[id]/classification` → `setCompanyCustomerIndustries()` | `revalidateCompanyPages` |
| **福利厚生** | ★**運営の更新経路が無い**（`/biz` の下書き反映 `applyDraft.ts` だけ） | — |
| **`phase`（旧）** | ★運営の PUT の許可列に無い（migration か `/biz` だけ） | — |
| **勤務時間制度** | ★運営の PUT の許可列に無い | — |

- ⚠️ `revalidatePath("/companies/<id>")` を直書きしない。**`revalidateCompanyPages()` を通す**（slug で落とす必要がある。`lib/companies/revalidate.ts`）
- 「既存の更新処理と同じ経路で保存」するには、**福利厚生・勤務時間制度（・phase）は経路を足す**必要がある（PUT の許可列に足すのが最小）

---

## 4. 出典と更新履歴の受け皿

### 既存: `ow_company_data_sources`（96行）

`(company_id, field)` が主キーの**最新の出典だけ**を持つ表（`source_kind` registry / official_site / company_input / unknown、`source_url`、`verified_at`、`note`）。運営専用（RLS 有効・ポリシー0本・GRANT 無し）。いま入っている `field` は `headquarters_address` と `phase` だけ。
→ **「項目ごとの最終更新日と出典」の表示にはこのまま使える**（AI で埋めたら `source_kind='official_site'` と URL を書く）。
→ ただし**旧値・新値・更新者・履歴は持たない**。

### 新設案（履歴）

```
ow_company_field_changes
  id           uuid
  company_id   uuid → ow_companies.id
  field        text           ★項目の key（質問文の [key] と同じ）
  old_value    jsonb          ★配列・マスタ（事業領域は id と名前の配列）もそのまま入る
  new_value    jsonb
  source_url   text null
  via          text  check in ('ai_paste')   ★将来 'manual' などを足す
  changed_by   uuid → ow_users.id（運営）
  changed_at   timestamptz
```

- RLS 有効・ポリシー0本・anon / authenticated に GRANT 無し（`ow_transitions` / `ow_company_data_sources` と同じ。admin クライアントだけが読み書き）
- 貼り付けた文章は持たない（列を作らない）

---

## 5. 判断が要ること

1. **分類は旧（`phase`・対象業界）と新（`company_stage`・お客さまの業界）のどちらを質問文に入れるか。** 2026-10-12 の分類の作業で新しい方が入り、どちらも残っている
2. **事業領域192件を質問文にすべて列挙するか。** 全部入れると長く、AI が近い名前を作りがち（完全一致しないと「要選択」になる）。主な20件程度に絞り、それ以外は「該当なし」で要選択にする案もある
3. **福利厚生・勤務時間制度の運営の更新経路を足してよいか。** いまは企業側（`/biz`）からしか書けない
4. **埋める項目を「空の項目」に絞るか。** 指示の項目の多くは既に埋まっている（上書き候補になる）。初回は勤務形態・福利厚生・勤務時間制度・事業領域（従）だけにすると確認が軽い
5. **検証用の会社。** 株式会社エージェントは `is_test = true`・掲載していない（`listing_status = 'draft'`）。`/companies` の一覧には出ないので、「`/companies` に即時反映」は**企業詳細ページ（`/t/companies/...` を含む）でだけ**確かめることになる

---

## 6. 決まったこと（2026-10-16 追記）

§5 の問いのうち、実装と柴さんの判断で決まったもの。

- **対象は空いていることが多い3項目だけ**：勤務形態・福利厚生・事業領域（従）（§5 の4）
- **福利厚生の運営の更新経路を足した**（§5 の3）。書き込みは専用の API（`/api/admin/companies/[id]/ai-fill`）だけで、運営の PUT の許可列には足していない
- ★**勤務時間制度は対象から外した**（2026-10-16 / 柴さんの判断）。企業ページに表示する場所が無く、「運営がAIで作成した情報です」の印を出せないため。印を出す場所を作るまで戻さない
- ★**企業ページの印の文言は「運営がAIで作成した情報です（企業は未確認）」**（2026-10-16 / 柴さんの指示）。事業領域は「一部は運営がAIで作成した情報です（企業は未確認）」。定数は `src/lib/admin/aiFill/fields.ts` の `OPERATOR_CREATED_NOTE` / `OPERATOR_CREATED_NOTE_PARTIAL`
  - 出る条件：その項目の最新の履歴が AI 経由で、いまの値がそのとき入れた値と同じとき（企業が値を変えると消える）。判定は `src/lib/companies/operatorCreated.ts`
- 出典（`ow_company_data_sources`）の種類を広げる migration（`supabase/pending/20261015150000`）は**保留のまま**。当てなくても壊れない（出典がこの表に書かれないだけ。履歴の表 `ow_company_field_changes` には URL が残る）
