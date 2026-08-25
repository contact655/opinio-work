# 業種分類の作り直し — フェーズ0 調査

**調査日**: 2026-08-25
**調査範囲**: 現状把握のみ。**DBへの書き込みは一切していない**（すべて SELECT / grep）。
**調査方法**: 断りのない限り、DB は Supabase MCP 経由の SELECT（本番）、コードは `grep -rn`。

⚠️ **件数はすべて 2026-08-25 時点の実測値。** 変動するので日付なしで引用しないこと。

---

## 0. 要約（先に結論だけ）

| # | 分かったこと |
|---|---|
| ① | 画面の13件は **`src/lib/search/industryGroups.ts:22-42` の `INDUSTRY_GROUPS` が唯一の出どころ**。DB の distinct は引いていない |
| ② | 「業種特化」と「ITサービス・受託」は**グループのラベルとしてのみ存在**。`ow_companies.industry` に同名の値は無い |
| ③ | **「ITサービス・受託」に該当する企業は 0 社**（`受託開発・SI` / `ITコンサルティング` とも実データ0件）。選択肢は出るが常に0件 |
| ④ | ⚠️ **企業が `/biz/company` で編集しているのは `industry` ではない。** 実際に編集されるのは `industry_id` / `saas_category_id` で、**求職者側はその2列を一切読んでいない**（詳細は §3-B） |
| ⑤ | `ow_company_genres` は**複数選択の器としてほぼそのまま使える**が、**`is_primary` も表示順も無い**（詳細は §2-4） |
| ⑥ | `industry` を扱う箇所は **38**（型定義のみ7を除くと **31**）。**うち複数値化で壊れるのは 26**。既知調査の「14分類・11箇所」からは増えている |
| ⑦ | 4系統すべてが NULL の企業は **0社**（`industry` は87社全部に入っている） |
| ⑧ | IT/SaaS でない企業は **2社**（アサヒビール / 海光電業）。どちらも `listing_status='draft'` |

---

## 1. 調査1: 画面に出ている13件の出どころ

### 1-1. どこから来ているか（grep）

**[src/lib/search/industryGroups.ts:22-42](../src/lib/search/industryGroups.ts) の `INDUSTRY_GROUPS` 配列がすべて。**
DB の distinct でも、別のハードコードでもない。ファイル冒頭 4-6 行目に
「これがフィルタ選択肢の唯一の出どころ。DB の distinct は引いていない」と明記されている。

13件という数は `INDUSTRY_GROUPS` の要素数そのもの（13エントリ）。
`/companies` のドロップダウンは **全件を無条件に出す**ので、該当0社のグループも表示される。

```
src/components/companies/CompanySearchBar.tsx:484
  options={INDUSTRY_GROUPS.map((g) => ({ value: g.key, label: g.label }))}
```

### 1-2. `INDUSTRY_GROUPS` の全件（industryGroups.ts:22-42 のまま）

| # | 行 | key | label | category | values |
|---|---|---|---|---|---|
| 1 | :23 | `ai` | AI・データ | product | `AI・データ` |
| 2 | :24 | `infra` | クラウドインフラ | product | `クラウドインフラ`, `通信・ネットワーク` |
| 3 | :25 | `devtools` | 開発者ツール | product | `開発者ツール` |
| 4 | :26 | `security` | セキュリティ | product | `セキュリティ` |
| 5 | :27 | `crm` | CRM・営業支援 | product | `CRM・営業支援`, `カスタマーサポート` |
| 6 | :28 | `collab` | コラボレーション | product | `コラボレーション` |
| 7 | :29 | `finance` | 経理・財務 | product | `経理・財務` |
| 8 | :30 | `hr` | HR・人材 | product | `HR・人材` |
| 9 | :31 | `marketing` | マーケティング | product | `マーケティング`, `広告・アドテク` |
| 10 | :32 | `hardware` | ハードウェア・半導体 | other | `ハードウェア・半導体` |
| 11 | :35 | `marketplace` | マーケットプレイス | product | `マーケットプレイス`, `EC・コマース`, `コマース・EC` |
| 12 | :38 | `vertical` | 業種特化 | vertical | `ヘルスケア`, `金融`, `教育`, `不動産・建設`, `物流・サプライチェーン`, `製造・産業`, `リーガル`, `公共・自治体`, `飲食・小売` |
| 13 | :41 | `services` | ITサービス・受託 | other | `受託開発・SI`, `ITコンサルティング` |

付随する定義:

| 定義 | 行 | 内容 |
|---|---|---|
| `LEGACY_KEYS` | :53-57 | `fintech→finance` / `ec→marketplace` / `healthcare→vertical`（旧URL救済） |
| `LEGACY_INDUSTRY_VALUES` | :84-88 | `コマース・EC` / `IT / SaaS` / `電設資材・卸売業`（選択肢には出さないが保存は通す） |
| `INDUSTRY_SELECT_GROUPS` | :99-107 | `<optgroup>` 用。`values` から導出し `LEGACY_INDUSTRY_VALUES` を除く |
| `INDUSTRY_OPTIONS` | :110 | 平坦なリスト |
| `isValidIndustry()` | :114-116 | API の保存検証 |

### 1-3. `values` が2要素以上のグループ

**4つある。**

| key | 束ねている値 | DB 実件数（全社） |
|---|---|---|
| `infra` | `クラウドインフラ` + `通信・ネットワーク` | 12 + **0** |
| `crm` | `CRM・営業支援` + `カスタマーサポート` | 10 + **0** |
| `marketing` | `マーケティング` + `広告・アドテク` | 4 + **0** |
| `marketplace` | `マーケットプレイス` + `EC・コマース` + `コマース・EC` | 2 + **0** + 1 |
| `vertical` | 9値 | `ヘルスケア` 1 + `金融` 1 + **他7値すべて0** |
| `services` | `受託開発・SI` + `ITコンサルティング` | **0 + 0** |

⚠️ **束ねている値の大半が実データ0件。** 束ねる仕組みは動いているが、
現状は「1グループ＝1値」がほとんどで、多対1の恩恵は `marketplace`（コマース・EC 1社）だけが受けている。

### 1-4. 「業種特化」「ITサービス・受託」は DB に実在するか

**どちらもグループのラベルとしてのみ存在。`ow_companies.industry` に同名の文字列は無い。**

- **業種特化** … `values` の9値のうち DB にあるのは `ヘルスケア`(1社) と `金融`(1社) だけ。
  ⚠️ **カードには DB の値がそのまま出る**ので、画面には「ヘルスケア」「金融」と表示され、
  「業種特化」という文字列はフィルタUI にしか出ない（industryGroups.ts:13-15 の設計判断どおり）。
- **ITサービス・受託** … `受託開発・SI` / `ITコンサルティング` とも **0社**。
  つまり**このグループは選んでも必ず0件**。2026-08-14 に「受託・SI企業の置き場が無い」ために
  追加されたが、**その後1社も入っていない**。

### 1-5. 「業種」ラベルとフィルタUIの所在

| 画面 | ファイル:行 | ラベル | パラメータ |
|---|---|---|---|
| `/companies` | [CompanySearchBar.tsx:482](../src/components/companies/CompanySearchBar.tsx#L482) | `label="業種"` | `?industry=<key>` |
| `/companies`（選択中チップ） | [CompanySearchBar.tsx:352-356](../src/components/companies/CompanySearchBar.tsx#L352) | グループ label | 同上 |
| `/companies`（0件時の他業種リンク） | [CompanySearchResults.tsx:150-153](../src/components/companies/CompanySearchResults.tsx#L150) | グループ label | 同上 |
| `/jobs` | [JobsClient.tsx:1280](<../src/app/(jobseeker)/jobs/(list)/JobsClient.tsx#L1280>) | `"業種"`（未選択時） | `?industry=<key>` |
| `/jobs`（ピルの一覧） | [JobsClient.tsx:2055-2060](<../src/app/(jobseeker)/jobs/(list)/JobsClient.tsx#L2055>) | グループ label | 同上 |
| LP（`/`） | [LandingPage.tsx:345](<../src/app/(jobseeker)/LandingPage.tsx#L345>) | `業種から探す` | `/companies?industry=<key>` |
| フッター（全ページ） | [JobseekerFooter.tsx:110-114](../src/components/jobseeker/JobseekerFooter.tsx#L110) | `業種から探す` | 同上 |

⚠️ **`/companies` と `/jobs` は同じ `?industry=` を使い、同じ `resolveIndustryFilter()` を通る。**
片方だけ変えると URL 互換が割れる。

⚠️ **語彙が「業種」と「業界」で割れている**（下表）。作り直しの際は先に決めること。

| 「業種」と呼んでいる | 「業界」と呼んでいる |
|---|---|
| `/companies` フィルタ、`/jobs` フィルタ、LP、フッター、`/biz/company`、`/biz/auth`、`/jobs/[id]:1500` | `/companies/[id]:2299`（サイドバー）、`/admin/companies`（列見出し・編集ラベル）、`/admin/jobs/[id]:525`、`/biz/companies/add/new:820` |

---

## 2. 調査2: 分類テーブル4系統の実態

### 2-0. 全体像（SELECT / 2026-08-25）

| 系統 | 実体 | マスタ行数 | 値が入っている企業 | NULL の企業 |
|---|---|---|---|---|
| (1) `ow_companies.industry` (text) | 自由入力 | — | **87 / 87** | **0** |
| (2) `industry_id` → `ow_industries` | FK | **110** | **82 / 87** | 5 |
| (3) `saas_category_id` → `ow_saas_categories` | FK | **13** | **65 / 87** | 22 |
| (4) `ow_company_genres` → `ow_genres` | 多対多 | **21** | **3 / 87**（行は4件） | 84 |

母数: `ow_companies` **87社**（`is_published` **84** / `listing_status='listed'` **79** / `is_test` **1**）。

⚠️ **(2)(3) は「使われていない」わけではない。82社・65社に値が入っている。**
にもかかわらず**求職者側は一度も読んでいない**（§3-B）。

### 2-1. `ow_companies.industry` (text)

```
industry  text  NULL可  default なし  CHECK なし  UNIQUE なし
COMMENT: 【非推奨】旧・業種テキスト。industry_id と saas_category_id に移行中。
```

⚠️ **DB 側の CHECK は無い。** 値の妥当性はアプリの `isValidIndustry()` だけが見ており、
しかも**それを通らない書き込み経路が2本ある**（§3-E）。

#### distinct と件数（全16値）

| industry | 全社 | is_published | listing_status='listed' |
|---|---|---|---|
| AI・データ | 13 | 12 | 12 |
| クラウドインフラ | 12 | 12 | 12 |
| CRM・営業支援 | 10 | 10 | 10 |
| コラボレーション | 8 | 8 | 8 |
| セキュリティ | 8 | 8 | 8 |
| HR・人材 | 7 | 7 | 6 |
| ハードウェア・半導体 | 7 | 7 | 7 |
| 経理・財務 | 7 | 7 | 7 |
| マーケティング | 4 | 4 | 3 |
| **IT / SaaS** | 3 | 1 | **0** |
| マーケットプレイス | 2 | 2 | 2 |
| 開発者ツール | 2 | 2 | 2 |
| **コマース・EC** | 1 | 1 | **0** |
| ヘルスケア | 1 | 1 | 1 |
| 金融 | 1 | 1 | 1 |
| **電設資材・卸売業** | 1 | 1 | **0** |
| （NULL） | **0** | — | — |

#### グループ単位のファセット件数（LP / `listing_status='listed'` の79社）

| key | label | 件数 |
|---|---|---|
| ai | AI・データ | 12 |
| infra | クラウドインフラ | 12 |
| crm | CRM・営業支援 | 10 |
| security | セキュリティ | 8 |
| collab | コラボレーション | 8 |
| finance | 経理・財務 | 7 |
| hardware | ハードウェア・半導体 | 7 |
| hr | HR・人材 | 6 |
| marketing | マーケティング | 3 |
| devtools | 開発者ツール | 2 |
| marketplace | マーケットプレイス | 2 |
| vertical | 業種特化 | 2 |
| **services** | **ITサービス・受託** | **0** |

⚠️ LP は 0件でもラベルを出す実装（[page.tsx:118-119](<../src/app/(jobseeker)/page.tsx#L118>) にコメントあり）。
**「ITサービス・受託 0件」がずっと出ている。**

### 2-2. `ow_industries`（110行 / 2階層）

```
id           uuid  NOT NULL  default gen_random_uuid()   PK
parent_id    uuid  NULL      FK → ow_industries(id) ON DELETE RESTRICT
name         text  NOT NULL
slug         text  NOT NULL  UNIQUE
display_order integer NOT NULL default 0
is_active    boolean NOT NULL default true
created_at   timestamptz NOT NULL default now()
```

FK: `ow_companies.industry_id → ow_industries(id) ON DELETE SET NULL`
RLS: 有効。`industries_public_read`（SELECT / PUBLIC / `is_active = true`）、
`industries_admin_write`（ALL / authenticated / `ow_user_roles.role='admin'`）
GRANT: anon=SELECT のみ / authenticated=SELECT,INSERT,UPDATE,DELETE

大分類 **12件**（IT・インターネット / 金融・保険 / コンサルティング・士業 / メーカー・商社 /
建設・不動産 / 流通・小売・サービス / メディカル / マスコミ・メディア / エンターテインメント /
運輸・物流 / エネルギー / その他）、中分類 **98件**。**孫は無い。**

⚠️ **実際に使われているのは 5件だけ**（すべて「IT・インターネット」の子）。

| 中分類 | 使用企業数 |
|---|---|
| SaaS | **66** |
| ハードウェア | 8 |
| SIer・システム開発 | 6 |
| その他（IT） | 2 |
| （残り105件） | **0** |

⚠️ **`ow_industries` は「一般的な業種マスタ」で、`INDUSTRY_GROUPS` の13件とは
まったく別の分類体系。** 語彙も粒度も重ならない。

### 2-3. `ow_saas_categories`（13行 / フラット）

```
id           uuid NOT NULL default gen_random_uuid()  PK
name         text NOT NULL
slug         text NOT NULL UNIQUE
description  text NULL
display_order integer NOT NULL default 0
is_active    boolean NOT NULL default true
created_at   timestamptz NOT NULL default now()
```

FK: `ow_companies.saas_category_id → ow_saas_categories(id) ON DELETE SET NULL`
RLS / GRANT: `ow_industries` と同型（public read + admin write）

| name | 使用企業数 |
|---|---|
| AI・データ | 11 |
| CRM・営業支援 | 10 |
| セキュリティ | 9 |
| コラボレーション | 8 |
| HR Tech | 7 |
| FinTech | 7 |
| クラウドインフラ | 7 |
| マーケティング | 5 |
| 業種特化SaaS | 1 |
| カスタマーサポート | **0** |
| ERP・基幹系 | **0** |
| 開発者ツール | **0** |
| その他（SaaS） | **0** |

⚠️ **この13件は `INDUSTRY_GROUPS` の13件と「ほぼ同じだが微妙に違う」。**
`HR Tech`↔`HR・人材`、`FinTech`↔`経理・財務`、`業種特化SaaS`↔`業種特化`、
`ERP・基幹系` は `INDUSTRY_GROUPS` に無く、`ハードウェア・半導体` / `マーケットプレイス` は
`ow_saas_categories` に無い。**名寄せの対応表は存在しない。**

### 2-4. `ow_company_genres`（重点確認）

```
company_id        uuid          NOT NULL   FK → ow_companies(id) ON DELETE CASCADE
genre_id          uuid          NOT NULL   FK → ow_genres(id)    ON DELETE CASCADE
ai_confidence     numeric(3,2)  NULL
is_ai_suggested   boolean       NOT NULL  default false
is_human_approved boolean       NOT NULL  default false
approved_by       uuid          NULL       FK → ow_users(id)   ※ON DELETE 指定なし＝NO ACTION
approved_at       timestamptz   NULL
created_at        timestamptz   NOT NULL  default now()

PRIMARY KEY (company_id, genre_id)
```

#### 質問への回答

| 問い | 答え |
|---|---|
| **`is_primary` に相当する列** | **無い。** 主従を表せない |
| **表示順の列** | **無い。** 並び順は `ow_genres.display_order`（マスタ側）だけ。**企業ごとの順序は持てない** |
| **AI提案フラグ** | `is_ai_suggested`（boolean）＋ `ai_confidence`（numeric(3,2)） |
| **人間承認フラグ** | `is_human_approved`（boolean）＋ `approved_by` / `approved_at` |
| **UNIQUE 制約** | **PK が `(company_id, genre_id)` の複合主キー。** 別途の UNIQUE は無い |
| **`id` 列** | **無い**（`lib/supabase/mutate.ts:51` にも注記あり） |

#### RLS ポリシー（全文）

RLS: **有効**。ポリシーは3本。

| polname | cmd | roles | USING | WITH CHECK |
|---|---|---|---|---|
| `Anyone can read approved company genres` | SELECT | PUBLIC | `(is_human_approved = true)` | — |
| `ow_company_genres_company_admin_insert` | INSERT | PUBLIC | — | `auth_is_company_admin(company_id)` |
| `ow_company_genres_company_admin_delete` | DELETE | PUBLIC | `auth_is_company_admin(company_id)` | — |

⚠️ **UPDATE のポリシーは1本も無い**（テーブルレベルの GRANT はあるので、
authenticated から UPDATE すると**ポリシー不在で常に0行**になる）。
現状のアプリは全置換（DELETE→INSERT）なので踏んでいないが、
**`is_primary` のような「後から更新する列」を足すなら UPDATE ポリシーが要る。**

⚠️ **運営（admin）用のポリシーも無い。** `/admin` の追加・削除は
`createAdminClient()`（service_role で RLS バイパス）で通している
（[genres/route.ts:7](<../src/app/api/admin/companies/[id]/genres/route.ts#L7>) にその旨のコメントあり）。

GRANT: anon=SELECT / authenticated=SELECT,INSERT,UPDATE,DELETE / service_role=全部。**列単位ではない。**

#### `ow_genres`（21行）

```
id, slug (UNIQUE), name, description, display_order (NOT NULL default 0),
is_active (NOT NULL default true), created_at, updated_at
```
RLS: `Anyone can read active genres`（SELECT / PUBLIC / `is_active = true`）。**書き込みポリシー無し。**

⚠️ **`display_order` に重複がある**（`2` が スタートアップ と ホリゾンタルSaaS、
`4` が メガベンチャー と 上場企業）。並び順が不定になる。

| name | slug | display_order | 使用企業数 |
|---|---|---|---|
| 外資系 | foreign-capital | 1 | **1** |
| スタートアップ | startup | 2 | 0 |
| ホリゾンタルSaaS | horizontal-saas | 2 | 0 |
| バーティカルSaaS | vertical-saas | 3 | 0 |
| メガベンチャー | mega-venture | 4 | 0 |
| 上場企業 | public-company | 4 | 0 |
| シード〜シリーズA | early-stage | 5 | **1** |
| AI・LLM特化 | ai-llm | 6 | **1** |
| DX/コンサル | dx-consulting | 7 | 0 |
| IPO準備中 | ipo-ready | 8 | **1** |
| HRTech・採用 | hrtech | 9 | 0 |
| FinTech・金融 | fintech | 10 | 0 |
| EdTech・学習 | edtech | 11 | 0 |
| M&A・投資 | ma-investment | 12 | 0 |
| HealthTech | healthtech | 215 | 0 |
| MarTech | martech | 216 | 0 |
| PropTech | proptech | 217 | 0 |
| LegalTech | legaltech | 218 | 0 |
| データ分析 | data-analytics | 219 | 0 |
| EC・流通 | ec-distribution | 220 | 0 |
| 業務DX | business-dx | 221 | 0 |

#### 実データ（4行 / 3社）

| 企業 | is_published | genre | is_ai_suggested | is_human_approved | ai_confidence | approved_by | approved_at |
|---|---|---|---|---|---|---|---|
| 株式会社Opinio | ✓ | AI・LLM特化 | false | **true** | NULL | NULL | NULL |
| 株式会社Third Box | ✗ | シード〜シリーズA | false | **true** | NULL | NULL | NULL |
| 株式会社Third Box | ✗ | IPO準備中 | false | **true** | NULL | NULL | NULL |
| 株式会社データプール | ✓ | 外資系 | false | **true** | NULL | NULL | NULL |

⚠️ **`is_ai_suggested` が true の行は0件、`ai_confidence` はすべて NULL。**
AI提案の経路は**一度も使われていない**（書き込むコードも src に無い）。

#### 読み書きしているコード（**参照0件ではない。生きている**）

| ファイル:行 | 何をしているか |
|---|---|
| [queries.ts:654-668](../src/lib/supabase/queries.ts#L654) | **読み**。`getCompanyBySlugOrId` で `is_human_approved=true` のみ取得し `display_order` 順に並べる |
| [companies/[id]/page.tsx:318-322](<../src/app/(jobseeker)/companies/[id]/page.tsx#L318>) | **表示**。Hero のバッジ行 |
| [companies/[id]/page.tsx:2263-2279](<../src/app/(jobseeker)/companies/[id]/page.tsx#L2263>) | **表示**。サイドバーのジャンル欄 |
| [api/biz/company/route.ts:203-252](../src/app/api/biz/company/route.ts#L203) | **書き**。全置換（DELETE→INSERT）。`is_human_approved: true` / `is_ai_suggested: false` を固定で入れる |
| [api/biz/companies/route.ts:270-310](../src/app/api/biz/companies/route.ts#L270) | **書き**。新規作成時。同上（service_role） |
| [api/admin/companies/[id]/genres/route.ts:58-66, 101-107](<../src/app/api/admin/companies/[id]/genres/route.ts#L58>) | **書き**。運営の追加/削除。`upsert(onConflict: 'company_id,genre_id')` で `approved_by`/`approved_at` も入れる（service_role） |
| [biz/company/page.tsx:36-45, 79-87](../src/app/biz/company/page.tsx#L36) | **読み**。編集フォームの初期値 |
| [biz/company/CompanyEditClient.tsx:782-790](../src/app/biz/company/CompanyEditClient.tsx#L782) | **編集UI**。`GenreChipSelector`（複数選択のチップ） |
| [admin/companies/[id]/page.tsx:32-45](<../src/app/admin/companies/[id]/page.tsx#L32>) + `CompanyDetailClient.tsx:317-331, 857` | **編集UI**。運営の「ジャンル」タブ |
| [lib/business/company.ts:87-100, 163](../src/lib/business/company.ts#L87) | 下書き（`draft_data.genres`）と公開値の突き合わせ |

⚠️ **ジャンルでの絞り込み機能は存在しない。** `/companies` にも `/jobs` にも
`?genre=` のパラメータは無く、**現状は詳細ページの表示専用**。

#### 複数選択の器として再利用できるか（判断材料）

**再利用は可能。** 以下は「使えない理由」ではなく「足りないもの」。

| 論点 | 現状 | 足りないもの |
|---|---|---|
| 複数選択の構造 | ✅ 複合PK の多対多。既に `GenreChipSelector` で複数選べる | — |
| 主従（主分類） | ❌ **`is_primary` 相当が無い** | 列の追加。カード1行表示・meta description・OGP は「1つだけ」を要求する（§3-A） |
| 企業ごとの表示順 | ❌ **無い**。マスタの `display_order` のみ | 列の追加、または `is_primary` で代替 |
| 絞り込み | ❌ 一覧・検索が genre を見ていない | `resolveIndustryFilter` 相当の実装、URL 設計 |
| 承認フロー | ⚠️ `is_human_approved` はあるが**全経路が固定で true**。実質使われていない | 使うなら運用設計。使わないなら列の扱いを決める |
| AI提案 | ⚠️ 列はあるが**書き込む主体が存在しない** | 同上 |
| RLS の UPDATE | ❌ **ポリシー0本** | `is_primary` を後から更新する設計にするなら必須 |
| マスタの語彙 | ⚠️ `ow_genres` 21件は**「外資系」「IPO準備中」など資本・ステージ軸が混在**。`INDUSTRY_GROUPS` の事業領域軸とは別物 | 2軸のどちらに何を入れるかの決定 |

⚠️ **`ow_genres` をそのまま業種の器にすると、「外資系」「上場企業」「IPO準備中」が
業種の選択肢に混ざる。** マスタを分けるか、`ow_genres` に軸を表す列を足すかの判断が要る。

---

## 3. 調査3: 単一値前提になっている箇所の棚卸し

**方法**: `grep -rn "industry" src --include='*.ts' --include='*.tsx'` → 54ファイル / 258出現。
そこから型定義・コメントのみを除き、実際に値を扱う箇所を1つずつ読んだ。

用途の記号: **A**=画面表示 / **B**=検索・フィルタ / **C**=メタデータ / **D**=集計 / **E**=編集フォーム / **F**=型のみ

### 3-A. 一覧

| ファイル:行 | 用途 | 単一値前提か | 複数値にしたときの壊れ方 |
|---|---|---|---|
| [lib/search/companies.ts:92](../src/lib/search/companies.ts#L92) | B | **はい** | フリーワード検索の `industry.ilike.%q%`。text[] には `ilike` が使えず **PostgREST 400**（`?? []` で受けるので**検索結果が丸ごと0件**に化ける） |
| [lib/search/companies.ts:118-125](../src/lib/search/companies.ts#L118) | B | **はい** | `.in("industry", values)` / `.ilike(...)`。配列列には `.in()` が効かない（`.overlaps()` が要る）。**全業種フィルタが0件** |
| [lib/search/companies.ts:139](../src/lib/search/companies.ts#L139) | F | はい | SELECT 列リスト。型が `string` 前提 |
| [components/companies/CompanyCardList.tsx:250-258](../src/components/companies/CompanyCardList.tsx#L250) | A | **はい** | 一覧カードのメタ行タグ。`whiteSpace: nowrap` の1行1タグ。**複数入れると横幅が破綻するか、`[object Object]` になる** |
| [components/companies/CompanySearchBar.tsx:319, 352-356, 484](../src/components/companies/CompanySearchBar.tsx#L319) | B/A | **はい** | `?industry=` が単一 key 前提。選択中チップも1つ。**複数選択のUIが無い** |
| [components/companies/CompanySearchResults.tsx:17-29, 150-153](../src/components/companies/CompanySearchResults.tsx#L17) | B/A | はい | `industry?: string` を素通し。0件時の「他の業種」リンクは影響なし |
| [companies/(list)/page.tsx:47, 115-118, 212](<../src/app/(jobseeker)/companies/(list)/page.tsx#L47>) | B | **はい** | `searchParams.industry` が `string`。複数指定を受ける形が無い |
| [companies/[id]/page.tsx:154](<../src/app/(jobseeker)/companies/[id]/page.tsx#L154>) | **C** | **はい** | meta description に `${company.industry}` を直接埋める。**配列だと `AI・データ,クラウドインフラ` と出るか `[object Object]`** |
| [companies/[id]/page.tsx:157](<../src/app/(jobseeker)/companies/[id]/page.tsx#L157>) | **C** | **はい** | OGP 画像の `badge=` パラメータ。**バッジは1語しか入らない** |
| [companies/[id]/page.tsx:165](<../src/app/(jobseeker)/companies/[id]/page.tsx#L165>) | **C** | はい | `keywords` 配列。**ここは配列を spread すれば壊れない**（唯一の例外） |
| [companies/[id]/page.tsx:273](<../src/app/(jobseeker)/companies/[id]/page.tsx#L273>) | A | **はい** | Hero 上部の大文字ラベル1行 |
| [companies/[id]/page.tsx:2299](<../src/app/(jobseeker)/companies/[id]/page.tsx#L2299>) | A | **はい** | サイドバー「業界」行。`{ key, value, icon }` の value が単一文字列前提 |
| [jobs/(list)/JobsClient.tsx:683, 989-1002](<../src/app/(jobseeker)/jobs/(list)/JobsClient.tsx#L989>) | B | **はい** | クライアント側の `values.includes(c.industry)` / `c.industry === industry`。**配列だと常に false → 全業種0件** |
| [jobs/(list)/JobsClient.tsx:1272-1280, 2055-2060](<../src/app/(jobseeker)/jobs/(list)/JobsClient.tsx#L1272>) | B/A | **はい** | ピルの選択が単一 key |
| [jobs/[id]/page.tsx:676](<../src/app/(jobseeker)/jobs/[id]/page.tsx#L676>) | A | **はい** | `{company.industry} · {従業員数}` の連結 |
| [jobs/[id]/page.tsx:1500](<../src/app/(jobseeker)/jobs/[id]/page.tsx#L1500>) | A | **はい** | 「業種 **値**」の1行 |
| [page.tsx:65-68, 120-126](<../src/app/(jobseeker)/page.tsx#L120>) | **D** | **はい** | LP ファセット。`g.values.includes(r.industry)` で**社数を数えている**。配列にすると**全ファセットが0件**。⚠️ さらに**複数値だと1社が複数ファセットに数えられる**ので「合計＝企業数」が成立しなくなる |
| [LandingPage.tsx:89, 397](<../src/app/(jobseeker)/LandingPage.tsx#L397>) | A | **はい** | `[c.industry, phaseText(c.phase)].filter(Boolean).join(" ／ ")` |
| [lib/utils/timeline.ts:60, 89-96](../src/lib/utils/timeline.ts#L89) | **A** | **はい** | **職歴の masked 表示**。`${industry}（${phase}・${size}名規模）` を組む。配列だと**匿名ラベルが壊れる**。⚠️ これは**在籍企業を伏せた人の代替表示**なので、壊れ方が利用者の同意に関わる |
| [lib/lp/pickCompanies.ts:44, 53](../src/lib/lp/pickCompanies.ts#L44) | F | はい | 型と SELECT 列 |
| [components/jobseeker/JobseekerHeader.tsx:20, 537](../src/components/jobseeker/JobseekerHeader.tsx#L537) | A | **はい** | 検索サジェストの副題1行 |
| [feed/(list)/FeedClient.tsx:1452-1454, 1958](<../src/app/(jobseeker)/feed/(list)/FeedClient.tsx#L1452>) | A | **はい** | 企業カードのタグ。`co.industry?.trim()` |
| [feed/(list)/page.tsx:23, 104, 361](<../src/app/(jobseeker)/feed/(list)/page.tsx#L361>) | F | はい | 型と SELECT |
| [api/jobseeker/posts/route.ts:23, 159](../src/app/api/jobseeker/posts/route.ts#L159) | F | はい | 同上 |
| [mypage/bookmarks/page.tsx:49, 58-59](<../src/app/(jobseeker)/mypage/bookmarks/page.tsx#L58>) | A | **はい** | `meta` の join と `badge_label`（バッジは1語） |
| [mypage/follows/page.tsx:49](<../src/app/(jobseeker)/mypage/follows/page.tsx#L49>) + `FollowsClient.tsx:9, 83` | A | **はい** | 1行表示 |
| [mypage/page.tsx:232-240](<../src/app/(jobseeker)/mypage/page.tsx#L232>) | A | **はい** | `timeline.ts` の masked 表示に渡す |
| [mypage/details/[section]/page.tsx:122-132](<../src/app/(jobseeker)/mypage/details/[section]/page.tsx#L122>) | A | **はい** | 同上 |
| [u/[id]/page.tsx:380-389](<../src/app/(jobseeker)/u/[id]/page.tsx#L380>) | A | **はい** | 同上 |
| [onboarding/OnboardingClient.tsx:37, 1015-1016, 1104-1106](../src/app/onboarding/OnboardingClient.tsx#L1015) | A | **はい** | 企業選択カードの副題 |
| [components/profile/CareerHistoryEditor.tsx:480, 619-621, 695-697](../src/components/profile/CareerHistoryEditor.tsx#L619) | A | **はい** | 企業ピッカーの副題 |
| [api/companies/search/route.ts:37, 121](../src/app/api/companies/search/route.ts#L37) | A | はい | 企業ピッカー用 API の返却値 |
| [api/onboarding/companies/search/route.ts:34, 52](../src/app/api/onboarding/companies/search/route.ts#L34) | A | はい | 同上 |
| [api/search/suggest/route.ts:74](../src/app/api/search/suggest/route.ts#L74) | A | はい | ヘッダーサジェスト |
| [api/companies/batch/route.ts:50, 110](../src/app/api/companies/batch/route.ts#L50) | F | はい | 素通し |
| [components/business/CompanyCard.tsx:10, 20, 62](../src/components/business/CompanyCard.tsx#L62) | A | はい | 企業側カード |
| [lib/supabase/queries.ts:55, 82-83, 398, 426, 507, 553](../src/lib/supabase/queries.ts#L55) | F | **はい** | `Company.industry: string`（`?? ""` で埋める）。**型を配列にすると波及が最も広い** |
| [types/genre.ts:23](../src/types/genre.ts#L23) | F | はい | `CompanyForCarousel.industry: string \| null` |

**集計（上表を数えた実数）:**

| | 件数 |
|---|---|
| 表に挙げた箇所（合計） | **38** |
| うち型定義・SELECT列リストのみ（用途 F） | 7 |
| **実際に値を扱う箇所** | **31** |
| **複数値化で壊れる箇所**（上表で「単一値前提か」が太字） | **26**（うち1つは型定義の `queries.ts`） |

⚠️ **2026-08-11 時点の「14分類・11箇所」より増えている。**
とくに `timeline.ts` 経由の masked 表示（4画面）と LP ファセット（D）は
以前の棚卸しに入っていなかった可能性がある。

⚠️ **JSON-LD には `industry` は入っていない**（[page.tsx:2518-2532](<../src/app/(jobseeker)/companies/[id]/page.tsx#L2518>) を実読。
`name` / `description`(tagline) / `url` / `numberOfEmployees` のみ）。
既知候補にあった「JSON-LD keywords」は**存在しない**。`keywords` は Next の `metadata` 側（:165）。

### 3-B. ⚠️ 編集フォームは `industry` を編集していない（最重要）

**企業側（`/biz/company`）の「業種」欄が書いているのは `industry_id` / `saas_category_id` で、
`industry`（text）ではない。**

[CompanyEditClient.tsx:709-775](../src/app/biz/company/CompanyEditClient.tsx#L709) が分岐している:

```
{industries.length > 0 ? (
   … 業種（大分類）select → industryId
     業種（中分類）select → industryId
     SaaSカテゴリ select  → saasCategoryId
) : (
   … 業種 select → industry （INDUSTRY_OPTIONS）    ← フォールバック
)}
```

`industries` は [biz/company/page.tsx:48-52](../src/app/biz/company/page.tsx#L48) が
`ow_industries` から取得する。**110行あり RLS の public read も通るので、実質必ず `> 0`。**
つまり **`industry`（text）の select 欄は本番では一度も描画されていない。**

**結果として起きていること:**

| | |
|---|---|
| 企業が自分で編集できるのは | `industry_id` / `saas_category_id` |
| 求職者側が読んでいるのは | **`industry`（text）だけ** |
| `industry_id` / `saas_category_id` を読んでいるのは | **`/biz/company` の編集フォーム自身だけ** |

`industry_id` / `saas_category_id` の全参照（grep 実測。`supabase/types.ts` を除く）:

| ファイル:行 | 何をしているか |
|---|---|
| [biz/company/page.tsx:48-53, 95, 112](../src/app/biz/company/page.tsx#L48) | マスタ取得 → フォームへ |
| [biz/company/CompanyEditClient.tsx:48-51, 378, 391-401, 715-767](../src/app/biz/company/CompanyEditClient.tsx#L391) | 編集UI |
| [lib/business/company.ts:14-15, 57, 98-99, 161-162](../src/lib/business/company.ts#L98) | 読み出しと保存ペイロード |
| [api/biz/company/route.ts:172-173](../src/app/api/biz/company/route.ts#L172) | **UPDATE** |
| [lib/supabase/queries.ts:82-83, 553](../src/lib/supabase/queries.ts#L82) | `Company` 型に載せるが**描画は0件** |
| [jobs/(list)/JobsClient.tsx:684-689](<../src/app/(jobseeker)/jobs/(list)/JobsClient.tsx#L684>) | コメントのみ（2026-08-06 に `?industry_id=` フィルタを削除した経緯） |
| `app/companies/mockCompanies.ts:48-49`, `lib/business/mockCompany.ts:19-20` | 型のみ |

**→ 求職者向けの表示・検索・SEO で `industry_id` / `saas_category_id` を読む箇所は 0 件。**

⚠️ **これは「入力させたのに保存しない」ではなく「保存したのに誰も読まない」形。**
82社・65社ぶんの入力が、求職者からは見えていない。

### 3-C. `industry`（text）を書ける経路

| 経路 | 検証 | 備考 |
|---|---|---|
| `PATCH /api/biz/company` [:139](../src/app/api/biz/company/route.ts#L139) | ✅ `isValidIndustry()` | ただし**フォーム側が送っていない**（§3-B）ので実質使われない |
| `POST /api/biz/companies` [:155](../src/app/api/biz/companies/route.ts#L155) | ✅ `isValidIndustry()` | 新規作成。`/biz/auth` と `/biz/companies/add/new` から |
| **`PUT /api/admin/companies/[id]`** [:34, :70](<../src/app/api/admin/companies/[id]/route.ts#L34>) | ❌ **ホワイトリストに入っているだけ。値の検証は 100字の長さ制限のみ** | 運営画面 [CompanyDetailClient.tsx:504-510](<../src/app/admin/companies/[id]/CompanyDetailClient.tsx#L504>) は **`<input type="text">` の自由入力** |
| migration | ❌ | DB に CHECK が無い |

⚠️ **運営が `/admin/companies/[id]` の「業界」欄に何を打っても保存される。**
`INDUSTRY_GROUPS` の `values` に無い文字列を入れると、
**その企業は業種フィルタから丸ごと消える**（LP のファセットにも数えられない）。
現に `IT / SaaS`(3社) / `電設資材・卸売業`(1社) / `コマース・EC`(1社) がこの状態にあり、
`LEGACY_INDUSTRY_VALUES` で後追い救済されている。

### 3-D. `industry` の COMMENT（全文）

```
【非推奨】旧・業種テキスト。industry_id と saas_category_id に移行中。
```

⚠️ **この COMMENT は実態と逆。** 「非推奨」と書かれている `industry` が
**求職者側の唯一の分類軸**で、「移行先」の2列は**誰も読んでいない**（§3-B）。
移行は 2026-05-16 の設計判断（`docs/decision-2026-05-16-genre-as-first-class.md`）以来、
**一度も完了していない。**

---

## 4. 調査4: 2軸に分けるための素材

⚠️ **振り分けはしていない。** 以下は判断材料の一覧。

### 4-1. 全87社

**列の省略について:**
- `tagline` … 先頭60字まで（それ以上は切っている）
- `description` … **先頭80字まで**（指示どおり。以降は切っている）
- `main_products` … **全件そのまま**（`/` 区切り）
- `|` は `/` に置換、改行は空白に置換している

並び: 公開企業（`is_published = true`）を先、非公開を後ろ。各ブロック内は社名の五十音順。

| slug | 正式社名 | 公開 | 掲載 | industry(text) | ow_industries名 | ow_saas_categories名 | genres | tagline | description 先頭80字 | main_products |
|---|---|---|---|---|---|---|---|---|---|---|
| asana | Asana Japan株式会社 | ✓ | listed | コラボレーション | SaaS | コラボレーション | — | チームの作業を割り当て、進捗を追う | Facebookの共同創業者が設立したワークマネジメントSaaSの日本法人。タスク・プロジェクト・目標管理（OKR）を一元化し、チームのワーク可視化と自動化を実 | — |
| box | Box Japan株式会社 | ✓ | listed | コラボレーション | SaaS | コラボレーション | — | 企業のファイルをクラウドで共有・管理する | 企業向けコンテンツマネジメントクラウド「Box」の日本法人。契約書・設計書・映像など非構造化データの管理・コラボレーション・セキュリティを統合。医療・金融・製造 | — |
| crowdstrike | CrowdStrike株式会社 | ✓ | listed | セキュリティ | SaaS | セキュリティ | — | PCやサーバーへの侵入を検知し、止める | AIネイティブのエンドポイント・クラウドセキュリティプラットフォーム「Falcon」を提供する日本法人。世界300TB/日以上の脅威データをAIで分析し、リアル | — |
| databricks | Databricks Japan株式会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | データ分析とAI開発を1つの基盤で行う | Apache SparkとApache Deltaを生み出した研究者チームが創業した、データ・AIプラットフォームの日本法人。データエンジニアリング・機械学習・ | Data Intelligence Platform（統合データ基盤） / Mosaic AI（生成AI開発） |
| datadog | Datadog Japan株式会社 | ✓ | listed | クラウドインフラ | SaaS | クラウドインフラ | — | サーバーやアプリの稼働状況を可視化する | クラウドアプリケーションのモニタリング・セキュリティ・分析を統合するプラットフォームの日本法人。AWS・Azure・GCPなどマルチクラウド環境の稼働状況を一元 | Infrastructure Monitoring（インフラ監視） / APM（アプリケーション性能監視） / Log Management（ログ管理） / Security Monitoring（セキュリティ監視） / Synthetic Monitoring（外形監視） / RUM（ユーザー体験計測） |
| docusign | DocuSign Japan株式会社 | ✓ | listed | 経理・財務 | SaaS | FinTech | — | 契約書の締結と管理を電子化する | 電子署名のグローバルリーダー「DocuSign」の日本法人。電子署名から契約管理・CLM（Contract Lifecycle Management）まで幅広い | — |
| dropbox | Dropbox Japan株式会社 | ✓ | listed | コラボレーション | SaaS | コラボレーション | — | チームの作業効率を高めるスマートワークスペース | クラウドストレージ・コラボレーションツール「Dropbox」の日本法人。個人ユーザーからチーム・企業向けまでシームレスなファイル共有・同期環境を提供。近年は「D | — |
| hubspot | HubSpot Japan株式会社 | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | 集客から顧客管理までを1つにまとめる | Marketing Hub・Sales Hub・Service Hubなどを1つのCRM基盤上で提供し、集客から商談・顧客対応までを同じ顧客データで扱う。マーケ | Marketing Hub（マーケティング） / Sales Hub（営業支援 / CRM） / Service Hub（カスタマーサービス） / Content Hub（CMS・コンテンツ） / Operations Hub（データ連携） / Smart CRM（統合顧客基盤） |
| indeed | Indeed Japan株式会社 | ✓ | listed | HR・人材 | SaaS | HR Tech | — | 求人情報を集約し、仕事探しを支える | 世界最大の求人検索エンジン「Indeed」の日本法人。月間2億8,000万人以上が利用するグローバルプラットフォームを日本市場向けに展開。パフォーマンス課金モデ | — |
| meta | Meta日本法人 | ✓ | listed | マーケティング | SaaS | マーケティング | — | Facebook・Instagram・WhatsAppを運営 | Facebook・Instagram・WhatsAppを運営し、世界30億人以上が利用するソーシャルメディアプラットフォームの日本法人。日本では広告事業が中心で | — |
| mongodb | MongoDB Japan合同会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | アプリ開発者向けのドキュメント型データベース | ドキュメント型NoSQLデータベース「MongoDB」の日本法人。開発者体験に優れたデータプラットフォームとして世界47,000社以上が採用。クラウドサービス「 | — |
| new-relic | New Relic株式会社 | ✓ | listed | クラウドインフラ | SaaS | クラウドインフラ | — | すべてのエンジニアに、オブザーバビリティを。 | オブザーバビリティ（可観測性）プラットフォームのグローバルリーダー。システムのパフォーマンス・エラー・ログをリアルタイムで可視化し、エンジニアリング組織の意思決 | — |
| notion | Notion Labs Japan合同会社 | ✓ | listed | コラボレーション | SaaS | コラボレーション | — | メモ・文書・タスクを1つの場所にまとめる | メモ・ドキュメント・データベース・プロジェクト管理をオールインワンで提供するワークスペースSaaSの日本法人。「Notion AI」を統合し、個人から大企業まで | Notion（ドキュメント・データベース） / Notion Calendar（カレンダー） / Notion Mail（メール） |
| openai | OpenAI Japan合同会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | AGI（汎用人工知能）を通じ、全人類に利益をもたらすことを目指す | ChatGPTやAPIを通じて生成AIを提供するOpenAIの日本法人。日本語対応の強化と、国内の大企業・政府機関へのChatGPT Enterprise展開を | ChatGPT（対話型AIアシスタント） / OpenAI API（開発者向けAPI） / Sora（動画生成） |
| sansan | Sansan株式会社 | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | 「出会いからイノベーションを生み出す」 | 「出会いからイノベーションを生み出す」をミッションに、営業向けのビジネスデータベース「Sansan」、経理領域の「Bill One」、取引管理の「Contrac | Sansan（営業向けビジネスデータベース） / Bill One（インボイス管理） / Contract One（契約・取引管理） / Eight（名刺アプリ） / Sansan Data Intelligence（企業データ整備） |
| sap | SAPジャパン株式会社 | ✓ | listed | 経理・財務 | SIer・システム開発 | — | — | ERPクラウドで、企業のDXを加速させる | 世界シェアNo.1のERP「SAP S/4HANA」を中心に、製造・流通・金融など各産業向けクラウドソリューションを展開。日本での大企業DXプロジェクトを多数支 | — |
| servicenow | ServiceNow Japan合同会社 | ✓ | listed | クラウドインフラ | SaaS | コラボレーション | — | ワークフロー自動化で、企業の仕事の流れを変革する | ITサービス管理（ITSM）から始まり、HR・カスタマーサービス・セキュリティ業務まで横断するワークフロー自動化プラットフォーム「Now Platform」を提 | — |
| slack | Slack Japan株式会社 | ✓ | listed | コラボレーション | SaaS | コラボレーション | — | チャットで社内のやりとりをまとめる | ビジネスチャット・コラボレーションツール「Slack」の日本法人。2021年にSalesforceに買収後もSlackブランドとして独自展開を継続。「Slack | — |
| snowflake | Snowflake Japan株式会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | データクラウドで、あらゆるデータを価値に変える | マルチクラウドに対応したデータクラウドプラットフォームの日本法人。データウェアハウス・データレイク・データシェアリングを統合し、組織を超えたデータ活用を実現。史 | — |
| twilio | Twilio Japan合同会社 | ✓ | listed | 開発者ツール | SaaS | マーケティング | — | SMSや音声通話をアプリに組み込めるようにする | 音声・SMS・メール・WhatsAppなどあらゆる通信チャネルをAPI経由で統合するCPaaS（Communications Platform as a Ser | — |
| ubie | Ubie株式会社 | ✓ | listed | ヘルスケア | SaaS | 業種特化SaaS | — | 「テクノロジーで人々を適切な医療に案内する」 | 「テクノロジーで人々を適切な医療に案内する」をミッションに掲げるヘルステック企業。生活者向けのAI症状検索エンジン「ユビー」、医療機関向けの問診・業務支援サービ | ユビー（AI症状検索エンジン） / ユビーメディカルナビ（医療機関向け） / ユビー for Pharma（製薬企業向け） |
| zendesk | Zendesk株式会社 | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | 顧客からの問い合わせ対応を一元管理する | カスタマーサービス・CRM分野に特化したクラウドSaaSの日本法人。チケット管理からAIチャットボット・CRM分析まで一気通貫のカスタマーサポートプラットフォー | — |
| akamai | アカマイ・テクノロジーズ合同会社 | ✓ | listed | セキュリティ | SaaS | セキュリティ | — | Webサイトや動画を高速に届け、攻撃から守る | 世界最大のCDN（コンテンツデリバリーネットワーク）運用企業の日本法人。4,200箇所以上のPoP（接続拠点）を持つエッジプラットフォームを活用し、Webパフォ | — |
| asahi-beer | アサヒビール株式会社 | ✓ | draft | コマース・EC | その他（IT） | — | — | おいしさと楽しさを、世界へ。 | アサヒグループホールディングス傘下の国内最大手ビールメーカー。スーパードライをはじめとするビール・RTD・ノンアル等の製造・販売から、酒販店・飲食店向けの営業ま | — |
| apple | アップルジャパン合同会社 | ✓ | listed | ハードウェア・半導体 | ハードウェア | — | — | iPhone・Macと関連サービスを開発する | iPhone・Mac・iPad・Apple Watchなどのプロダクトと、App Store・Apple Music・iCloudなどのサービスを展開するグロー | — |
| adobe | アドビ株式会社 | ✓ | listed | マーケティング | SaaS | マーケティング | — | Photoshop・Acrobatと顧客体験基盤を手がける | Photoshop・Illustrator・Premiere ProなどクリエイティブソフトとAdobe Experience Cloud（デジタルマーケティン | — |
| atlassian | アトラシアン株式会社 | ✓ | listed | コラボレーション | SaaS | コラボレーション | — | Jira・Confluenceで開発の課題と文書を管理する | Jira・Confluence・Trelloなど、開発チームとビジネスチームのコラボレーション・プロジェクト管理ツールを提供するオーストラリア発SaaS。エンジ | — |
| aptio | アプティオ株式会社 | ✓ | listed | 経理・財務 | SaaS | FinTech | — | IT投資のコストを可視化し、経営判断につなげる | ITコスト管理・IT財務管理（ITFM）のリーダー「Apptio」（現IBMグループ）の日本法人。TBM（Technology Business Managem | — |
| aws | アマゾン ウェブ サービス ジャパン合同会社 | ✓ | listed | クラウドインフラ | SaaS | クラウドインフラ | — | クラウドで、世界のインフラを動かす | 世界最大のクラウドプロバイダーAWSの日本法人。EC2・S3・Lambdaをはじめ200以上のサービスを展開し、世界190カ国以上の企業・政府機関を支援。東京リ | — |
| arista | アリスタネットワークス合同会社 | ✓ | listed | クラウドインフラ | SaaS | クラウドインフラ | — | データセンター向けのネットワーク機器を開発する | クラウドスケールのデータセンター・キャンパスネットワーキングプラットフォームを提供するNYSE上場企業の日本法人。CiscoのエンジニアがスピンオフしたEOSオ | — |
| anthropic | アンソロピックジャパン合同会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | 安全性を軸にAIアシスタントClaudeを開発する | AIの安全性研究に特化した研究企業「Anthropic」の日本法人。AIアシスタント「Claude」を開発・提供し、安全で有益なAIの構築を使命とする。Open | — |
| intel | インテル株式会社 | ✓ | listed | ハードウェア・半導体 | ハードウェア | — | — | PCやサーバー向けのCPUを設計・製造する | CPUを中心とした半導体プロセッサのグローバルリーダーの日本法人。Core・Xeonプロセッサのほか、AI向けGaudi・FPGA・ネットワーク半導体まで幅広い | — |
| vmware | ヴイエムウェア株式会社 | ✓ | listed | クラウドインフラ | SaaS | クラウドインフラ | — | サーバーを仮想化し、複数クラウドを束ねる | 仮想化技術のパイオニアの日本法人。データセンター仮想化からマルチクラウド管理（VMware Cloud）・ネットワーク仮想化（NSX）・エンドユーザーコンピュー | — |
| uber | ウーバー・ジャパン株式会社 | ✓ | listed | マーケットプレイス | その他（IT） | — | — | 配車と料理配達のアプリを運営する | ライドシェアリング・フードデリバリー（Uber Eats）・貨物輸送を展開するプラットフォーム企業の日本法人。日本ではUber Taxiとして配車事業、Uber | — |
| walkme | ウォークミー株式会社 | ✓ | listed | コラボレーション | SaaS | コラボレーション | — | 画面上の案内で、社内システムの定着を支える | DAP（デジタル・アダプション・プラットフォーム）のパイオニア「WalkMe」（現SAPグループ）の日本法人。ソフトウェア操作ガイド・アナリティクスをシステム上 | — |
| ncino | エヌシーノ合同会社 | ✓ | listed | 金融 | SaaS | FinTech | — | 銀行の融資業務をクラウドで一元化する | Salesforceプラットフォーム上に構築した金融機関特化のクラウド型統合銀行業務システム「nCino Bank Operating System」の日本法人 | — |
| nvidia | エヌビディア合同会社 | ✓ | listed | ハードウェア・半導体 | ハードウェア | — | — | AI計算を担うGPUを設計する | GPUアーキテクチャでAI・生成AI・高性能コンピューティングの基盤を提供するグローバルテック企業の日本法人。データセンター向けH100/B100 GPU・CU | — |
| elastic | エラスティック株式会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | 大量データを高速に検索し、分析できるようにする | オープンソースの全文検索エンジン「Elasticsearch」を中心に、Elastic Stack（ELK）ベースのオブザーバビリティ・セキュリティ・エンタープ | — |
| okta | オクタ・ジャパン株式会社 | ✓ | listed | セキュリティ | SaaS | セキュリティ | — | 社員のIDとログインを一元管理する | アイデンティティ・アクセス管理（IAM）のグローバルリーダーの日本法人。シングルサインオン・多要素認証・ライフサイクル管理を統合した「Okta Identity | — |
| kyriba | キリバ株式会社 | ✓ | listed | 経理・財務 | SaaS | FinTech | — | 企業の資金と流動性を可視化し、最適に動かす | CFO・財務部門向けの財務・流動性管理（TMS）クラウドプラットフォームのグローバルリーダー「Kyriba」の日本法人。キャッシュマネジメント・リスク管理・支払 | — |
| qualcomm | クアルコムジャパン合同会社 | ✓ | listed | ハードウェア・半導体 | ハードウェア | — | — | スマホや車向けのチップを設計する | スマートフォン向けSnapdragonプロセッサで世界シェアを誇る半導体設計企業の日本法人。5G基地局向けチップ・IoT・車載（Snapdragon Ride） | — |
| google | グーグル合同会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | 世界中の情報を整理し、誰もがアクセスできる有益なものにする | 検索エンジン・Google Cloud・YouTube・Androidなど世界規模のプロダクトを展開するグローバルテック企業の日本法人。渋谷スクランブルスクエア | — |
| coupa | クーパ・ソフトウェア株式会社 | ✓ | listed | 経理・財務 | SaaS | FinTech | — | 企業の購買と支出を一元管理する | AI活用の支出管理（Spend Management）プラットフォームを提供するSaaS企業の日本法人。購買・調達・費用精算・契約管理を統合し、企業の「BSM（ | — |
| cloudflare | クラウドフレア・ジャパン株式会社 | ✓ | listed | セキュリティ | SaaS | セキュリティ | — | Webサイトを高速化し、攻撃から守る | 世界中のインターネットトラフィックを保護・高速化するグローバルネットワークサービスの日本法人。CDN・DDoS対策・ゼロトラストセキュリティ（SASE）・Wor | — |
| clickhouse | クリックハウス株式会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | 大量データの集計に特化したデータベース | オープンソース発の超高速OLAP（オンライン分析処理）データベース「ClickHouse」を提供するユニコーン企業の日本法人。1秒間に数十億行を処理できる圧倒的 | — |
| gainsight | ゲインサイト・ジャパン株式会社 | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | カスタマーサクセスの実践を支えるプラットフォーム | カスタマーサクセス管理（CSM）プラットフォームのパイオニア「Gainsight」の日本法人。SaaS企業のチャーン防止・アップセル・ヘルスモニタリングを自動化 | — |
| concur | コンカー株式会社 | ✓ | listed | 経理・財務 | SaaS | FinTech | — | 出張と経費の精算をクラウドで自動化する | 出張管理・経費精算クラウドのグローバルリーダー「SAP Concur」の日本法人。従業員の出張申請から経費精算・精算書承認までをシームレスに自動化。日本では大手 | — |
| kong | コング・ジャパン株式会社 | ✓ | listed | 開発者ツール | SaaS | クラウドインフラ | — | APIの接続と管理を担う基盤ソフトウェア | APIゲートウェイ・サービスメッシュのリーディングプラットフォーム「Kong」の日本法人。マイクロサービス間のトラフィック管理・認証・レート制限を行うオープンソ | — |
| confluent | コンフルエント合同会社 | ✓ | listed | AI・データ | SaaS | AI・データ | — | Kafkaでシステム間のデータをリアルタイムに流す | Apache Kafkaを生み出したエンジニアが創業したデータストリーミングプラットフォームの日本法人。リアルタイムデータパイプライン・イベント駆動アーキテクチ | — |
| zactory | ザクトリー株式会社 | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | 営業インセンティブの設計と支払いを自動化する | 営業インセンティブ・コミッション管理（ICM）のパイオニア「Xactly」の日本法人。営業報酬設計・支払い管理・パフォーマンス分析をクラウドで一元管理し、営業組 | — |
| cisco | シスコシステムズ合同会社 | ✓ | listed | クラウドインフラ | SaaS | セキュリティ | — | 企業のネットワーク機器と通信基盤を手がける | ネットワーク機器・セキュリティ・コラボレーション（Webex）・クラウド管理を幅広く提供するIT基盤企業の日本法人。ルーター・スイッチ分野で世界シェアNo.1を | — |
| smartcamp | スマートキャンプ株式会社 | ✓ | draft | マーケティング | SaaS | マーケティング | — | テクノロジーを広げ社会の生産性を飛躍させる | SaaS・AI企業のセールス／マーケティングを、戦略から実行まで横断して支援するBtoBプラットフォーム事業。法人向けSaaS比較サイト「BOXIL」を中核に、 | BOXIL（法人向けSaaS比較サイト） / BOXIL EXPO（職種特化型オンライン展示会） / SMARTCAMP EVENTS（経営層向けカンファレンス） / BALES（インサイドセールス代行・コンサルティング） / ADXL（BtoB・SaaS特化デジタルエージェンシー） / BizHint（子会社運営・クラウド活用の専門サイト） |
| zscaler | ゼットスケーラー株式会社 | ✓ | listed | セキュリティ | SaaS | セキュリティ | — | 社内システムへの接続を、VPNなしで安全にする | ゼロトラストネットワークアクセス（ZTNA）のパイオニアの日本法人。従来のVPN・ファイアウォールを置き換えるクラウドネイティブのセキュリティプラットフォームで | — |
| dell | デル・テクノロジーズ株式会社 | ✓ | listed | ハードウェア・半導体 | ハードウェア | — | — | ITインフラとクラウド基盤を企業に届ける | PC・サーバー・ストレージ・ネットワーク機器から、クラウドソリューションまで幅広く提供するITインフラ企業の日本法人。企業向けにITインフラ全体をワンストップで | — |
| nobefore | ノービフォー株式会社 | ✓ | listed | セキュリティ | SaaS | セキュリティ | — | 従業員向けの訓練で、フィッシング被害を防ぐ | セキュリティ意識向上トレーニング（SAT）のグローバルリーダー「KnowBe4」の日本法人。フィッシング攻撃シミュレーションと教育コンテンツで、従業員のサイバー | — |
| palantir | パランティア・テクノロジーズ | ✓ | listed | AI・データ | SaaS | AI・データ | — | 散在するデータを統合し、意思決定に使える | 大量データの統合・分析に特化したエンタープライズAIプラットフォームを提供する米国企業の日本法人。元々CIA等の情報機関向けに開発し、現在は製造・金融・防衛など | — |
| palo-alto-networks | パロアルトネットワークス株式会社 | ✓ | listed | セキュリティ | SaaS | セキュリティ | — | ゼロトラストとAIでサイバーセキュリティを変革する | ゼロトラストセキュリティのグローバルリーダーの日本法人。次世代ファイアウォール・SASE・クラウドセキュリティ（Prisma Cloud）・SOCオートメーショ | — |
| fortinet | フォーティネット株式会社 | ✓ | listed | セキュリティ | SaaS | セキュリティ | — | ファイアウォールを軸に企業ネットワークを守る | ネットワークセキュリティのグローバルリーダーの日本法人。FortiGateを中核に、ファイアウォール・SD-WAN・EDR・クラウドセキュリティを統合した「Fo | — |
| blackline | ブラックライン株式会社 | ✓ | listed | 経理・財務 | SaaS | FinTech | — | 決算・照合など経理業務を自動化する | 経理・財務部門の業務自動化クラウド「BlackLine」の日本法人。決算・財務クローズ処理の自動化・コントロールで、世界4,400社以上の経理DXを支援。CFO | — |
| braze | ブレイズ株式会社 | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | アプリやメールで顧客メッセージ配信を自動化する | リアルタイム顧客エンゲージメントプラットフォーム「Braze」の日本法人。プッシュ通知・メール・SMS・アプリ内メッセージを一元管理し、AIを活用したパーソナラ | — |
| pagerduty | ページャーデューティー株式会社 | ✓ | listed | クラウドインフラ | SaaS | クラウドインフラ | — | システム障害を検知し、担当者を呼び出す | インシデント管理・AIOpsプラットフォームのリーダー「PagerDuty」の日本法人。DevOps・SRE組織のオンコール管理・アラート集約・インシデント対応 | — |
| marketo | マルケト株式会社 | ✓ | listed | マーケティング | SaaS | マーケティング | — | 見込み客の育成と商談化を自動で進める | マーケティングオートメーション（MA）のパイオニア「Adobe Marketo Engage」（旧Marketo）の日本法人。リードナーチャリング・スコアリング | — |
| miracle | ミラクル株式会社 | ✓ | listed | マーケットプレイス | SIer・システム開発 | — | — | 企業のマーケットプレイス開設と拡大を支える | エンタープライズ向けオンラインマーケットプレイスプラットフォーム「Mirakl」の日本法人。企業が自社ECサイトをAmazon・楽天型のマーケットプレイスに変革 | — |
| lenovo | レノボ・ジャパン合同会社 | ✓ | listed | ハードウェア・半導体 | ハードウェア | — | — | PCからサーバーまでを開発・製造する | 世界PCシェアNo.1（ThinkPad・IdeaPad）を誇る中国発グローバルIT企業の日本法人。PCに加えて、サーバー（ThinkSystem）・ストレージ | — |
| ctc | 伊藤忠テクノソリューションズ株式会社 | ✓ | listed | クラウドインフラ | — | — | — | — | クラウド・AI・データ分析・サイバーセキュリティをはじめとするシステム販売・構築サービス。コンサルティングから運用・保守までのITライフサイクル全体にわたるサポ | — |
| kaikou-dengyou | 海光電業株式会社 | ✓ | draft | 電設資材・卸売業 | — | — | — | — | 電線・ケーブルを中心とした電設資材の専門商社。1949年創業、東京都渋谷区恵比寿に本社を置く。電線・受変電設備・照明器具等の電設資材販売に加え、再生可能エネルギ | — |
| irodas | 株式会社irodas | ✓ | listed | HR・人材 | SaaS | HR Tech | — | 1億色のキャリアを、新卒から育てる | 新卒採用支援に特化したHR Techスタートアップ。学生のキャリアコミュニティ「irodas SALON」、新卒エージェント、スカウトサービス「イロシル」を提供 | irodas SALON（学生キャリアコミュニティ） / 新卒エージェント / イロシル（スカウトサービス） |
| opinio | 株式会社Opinio | ✓ | listed | HR・人材 | SaaS | HR Tech | AI・LLM特化 | IT/SaaS業界の、信頼できるキャリアプラットフォーム | IT・SaaS業界に特化したキャリアプラットフォーム「OPINIO」を運営。求職者と企業の双方にとって信頼できる情報をもとに、納得感ある就職・採用を支援する。ス | OPINIOキャリアプラットフォーム |
| pksha | 株式会社PKSHA Technology | ✓ | listed | AI・データ | SaaS | AI・データ | — | 「Advancing Humanity」 | 自然言語処理・画像認識・機械学習のアルゴリズムを研究開発し、個別のソリューションとAI SaaSの両面で提供する。社内問い合わせ対応の「PKSHA AIヘルプデ | PKSHA AIヘルプデスク（社内問い合わせ対応） / PKSHA FAQ（FAQシステム） / PKSHA ChatAgent（AI対話） / PKSHA Voicebot（音声対話） / PKSHA Speech Insight（通話解析） |
| smarthr | 株式会社SmartHR | ✓ | listed | HR・人材 | SaaS | HR Tech | — | 「労働にまつわる社会課題をなくしていく」 | クラウド人事労務ソフト「SmartHR」を開発・提供する。入退社手続きや年末調整といった労務手続きのペーパーレス化から始まり、蓄積した従業員データを活用するタレ | SmartHR（クラウド人事労務ソフト） / SmartHR Plus（連携アプリストア） |
| translead | 株式会社Translead | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | 営業現場の入力負担ゼロへ、Sales Tech SaaS | 営業DX領域に特化したSaaS企業。顧客管理・営業支援ツール「Translead CRM」を開発・提供。画面遷移とクリック数を最小限に抑えたUI設計で、営業現場 | Translead CRM（営業支援SFAプラットフォーム） |
| agent-inc | 株式会社エージェント | ✓ | draft | HR・人材 | SaaS | HR Tech | — | — | — | — |
| shinka | 株式会社シンカ | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | 電話・SMS・メール、顧客接点をひとつに | 顧客接点クラウドサービス「カイクラ」を開発・販売。電話・SMS・メール等の顧客コミュニケーションを一元管理するAIコミュニケーション統合プラットフォーム。202 | カイクラ（顧客接点クラウドサービス） |
| salesforce | 株式会社セールスフォース・ジャパン | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | 世界No.1 CRMで、ビジネスの未来を変える | 世界No.1のCRMプラットフォーム「Salesforce」を日本で展開。営業・マーケティング・カスタマーサービス領域のクラウドサービスをエンタープライズから中 | Sales Cloud（営業支援 / SFA） / Service Cloud（カスタマーサービス） / Marketing Cloud（マーケティングオートメーション） / Commerce Cloud（EC・コマース） / Agentforce（自律型 AI エージェント） / Data Cloud（統合 CDP） / Tableau（データ分析・BI） / Slack（コラボレーション） / MuleSoft（API 統合・インテグレーション） / Financial Services Cloud（金融業界向け） |
| timee | 株式会社タイミー | ✓ | listed | HR・人材 | SaaS | HR Tech | — | 「はたらく」を通じて人生の可能性を広げるインフラへ | 働きたい時間にすぐ働けるスキマバイトアプリ「タイミー」を運営。登録から最短1時間で働き始められる即時マッチング型の人材サービスで、2024年東証グロース上場。長 | タイミー（スキマバイトアプリ） / タイミーキャリアプラス（長期就業支援） / BPO事業 |
| (なし) | 株式会社データプール | ✓ | draft | IT / SaaS | — | — | 外資系 | — | — | — |
| flyle | 株式会社フライル | ✓ | listed | CRM・営業支援 | SaaS | CRM・営業支援 | — | AIで顧客の声を経営に届ける。 | AIカスタマーニーズプラットフォーム「Flyle」を開発・提供。顧客フィードバックをAIで自動整理し、プロダクト・CS・営業の意思決定を支援するSaaS。資本金 | — |
| workday | 株式会社ワークデイ | ✓ | listed | HR・人材 | SaaS | HR Tech | — | 人事・財務クラウドで、スマートワークを実現する | 人事管理（HCM）と財務管理に特化したエンタープライズクラウドSaaS。大企業・グローバル企業の人事・経理システムの基盤として採用されており、Airbnb・Am | — |
| hp-jp | 株式会社日本HP | ✓ | listed | ハードウェア・半導体 | ハードウェア | — | — | 法人・個人向けにPCとプリンターを届ける | PC・プリンター・周辺機器のグローバルリーダーHPの日本法人。個人・中小企業・大企業向けのPC、業務用プリンター、3Dプリンターなどを展開。「HP Work F | — |
| ibm | 日本IBM株式会社 | ✓ | listed | クラウドインフラ | SIer・システム開発 | — | — | テクノロジーで、ビジネスと社会の変革に貢献する | コンサルティング・クラウド・AI（watsonx）・ハイブリッドクラウド基盤を提供するITレガシーの雄。金融・製造・政府機関向け大型プロジェクトに強く、約10, | — |
| oracle | 日本オラクル株式会社 | ✓ | listed | AI・データ | SIer・システム開発 | — | — | データドリブンな変革を、クラウドで実現する | データベース・ERPクラウド・Java開発基盤など、企業の根幹を支えるITインフラを提供するグローバル企業の日本法人。Oracle Databaseは世界シェア | — |
| hp | 日本ヒューレット・パッカード合同会社 | ✓ | listed | クラウドインフラ | ハードウェア | — | — | 企業向けサーバーとストレージを手がける | エッジ・コア・クラウドにまたがるハイブリッドITインフラを提供するHPEの日本法人。サーバー「HPE ProLiant」、ストレージ「HPE Alletra」、 | HPE ProLiant（x86サーバー） / HPE Alletra（ストレージ） / HPE Aruba Networking（ネットワーク機器） / HPE GreenLake（従量課金型のITインフラ） / HPE Private Cloud AI（オンプレミス型のAI基盤） / HPE Cray（スーパーコンピューター・HPC） / HPE Ezmeral（データ分析・コンテナ基盤ソフトウェア） / HPE Tech Care Service（保守・サポート） |
| microsoft | 日本マイクロソフト株式会社 | ✓ | listed | クラウドインフラ | SIer・システム開発 | — | — | すべての人と組織が、より多くのことを達成できるようにする | Windows・Azure・Microsoft 365・Copilotを中核に、企業のDXを支援するグローバルIT企業の日本法人。約2,800名が在籍し、Inc | — |
| fujifilm-bi | 富士フイルムビジネスイノベーションジャパン株式会社 | ✓ | listed | コラボレーション | SIer・システム開発 | — | — | オフィスのDXを、ドキュメントから変える。 | 富士フイルムグループのドキュメント・クラウドサービス事業会社。CRM（kintone・Salesforce）、グループウェア（Microsoft 365・Gar | — |
| third-box | 株式会社Third Box |  | draft | IT / SaaS | SaaS | — | シード〜シリーズA / IPO準備中 | — | — | — |
| tyu | 株式会社TYU |  | draft | IT / SaaS | — | — | — | — | — | — |
| (なし) | 株式会社ゼクイース |  | draft | AI・データ | — | — | — | — | — | — |

### 4-2. `industry` の値ごとの企業数

| industry | 全社（87） | 公開のみ（84） |
|---|---|---|
| AI・データ | 13 | 12 |
| クラウドインフラ | 12 | 12 |
| CRM・営業支援 | 10 | 10 |
| コラボレーション | 8 | 8 |
| セキュリティ | 8 | 8 |
| HR・人材 | 7 | 7 |
| ハードウェア・半導体 | 7 | 7 |
| 経理・財務 | 7 | 7 |
| マーケティング | 4 | 4 |
| IT / SaaS | 3 | 1 |
| マーケットプレイス | 2 | 2 |
| 開発者ツール | 2 | 2 |
| コマース・EC | 1 | 1 |
| ヘルスケア | 1 | 1 |
| 金融 | 1 | 1 |
| 電設資材・卸売業 | 1 | 1 |
| **合計** | **87** | **84** |

### 4-3. 1〜2社しかないカテゴリ

| industry | 全社 | 該当企業 |
|---|---|---|
| マーケットプレイス | 2 | ウーバー・ジャパン株式会社 / ミラクル株式会社 |
| 開発者ツール | 2 | Twilio Japan合同会社 / コング・ジャパン株式会社 |
| コマース・EC | 1 | アサヒビール株式会社 |
| ヘルスケア | 1 | Ubie株式会社 |
| 金融 | 1 | エヌシーノ合同会社 |
| 電設資材・卸売業 | 1 | 海光電業株式会社 |

⚠️ **`INDUSTRY_GROUPS` にあるのに 0社のグループ**（選択肢に出るが必ず0件）:
`ITサービス・受託`（`受託開発・SI` / `ITコンサルティング`）。
また `通信・ネットワーク` `カスタマーサポート` `広告・アドテク` `EC・コマース` と、
`業種特化` の9値のうち `教育` `不動産・建設` `物流・サプライチェーン` `製造・産業`
`リーガル` `公共・自治体` `飲食・小売` の7値も**実データ0件**。

### 4-4. 4系統すべてが NULL の企業

**0社。** `industry`（text）は **87社すべてに値が入っている**（NULL も空文字も無い）。

参考として、系統ごとの欠落:

| 条件 | 社数 |
|---|---|
| `industry` が NULL | **0** |
| `industry_id` が NULL | 5 |
| `saas_category_id` が NULL | 22 |
| `industry_id` と `saas_category_id` の両方が NULL | 5 |
| ジャンルが1件も無い | 84 |
| **4系統すべて NULL** | **0** |

`industry_id` が NULL の5社:

| slug | 社名 | 公開 | 掲載 | industry(text) | source |
|---|---|---|---|---|---|
| ctc | 伊藤忠テクノソリューションズ株式会社 | ✓ | listed | クラウドインフラ | manual |
| (なし) | 株式会社データプール | ✓ | draft | IT / SaaS | (null) |
| kaikou-dengyou | 海光電業株式会社 | ✓ | draft | 電設資材・卸売業 | manual |
| tyu | 株式会社TYU | ✗ | draft | IT / SaaS | biz_self |
| (なし) | 株式会社ゼクイース | ✗ | draft | AI・データ | biz_self |

### 4-5. 参考: 企業データの出どころ（`source`）

分類を作り直すときに「誰が入れた値か」で扱いを変えられるので、併せて記録する。

| source | 社数 | 公開 | 備考 |
|---|---|---|---|
| `migration` | 69 | 69 | 外資系日本法人が中心。運営が投入 |
| （NULL） | 8 | 7 | Opinio / Third Box / Translead / シンカ / タイミー / エージェント / irodas / データプール |
| `manual` | 7 | 7 | New Relic / アサヒビール / スマートキャンプ / CTC / 富士フイルムBI / フライル / 海光電業 |
| `biz_self` | 2 | 0 | **企業が自分で登録した**（TYU / ゼクイース）。どちらも `IT / SaaS` か `AI・データ` |
| `admin_seed` | 1 | 1 | セールスフォース・ジャパン |

---

## 5. 調査5: 分類が付けられない企業

### 5-1. IT/SaaS でない企業

**2社。どちらも `listing_status = 'draft'`（ディレクトリには出ていない）。**

| slug | 社名 | industry(text) | 公開 | 掲載 | source | 実態 |
|---|---|---|---|---|---|---|
| `asahi-beer` | アサヒビール株式会社 | **コマース・EC** | ✓ | draft | manual | ビールメーカー（アサヒグループHD傘下） |
| `kaikou-dengyou` | 海光電業株式会社 | **電設資材・卸売業** | ✓ | draft | manual | 電線・ケーブル等の電設資材の専門商社（1949年創業） |

⚠️ **アサヒビールの `コマース・EC` は明らかに合っていない。**
`INDUSTRY_GROUPS` の `marketplace` グループに束ねられているので、
**`/companies?industry=marketplace` を選ぶと（掲載されれば）ビールメーカーが出る**。
`ow_industries` 側も `その他（IT）` になっている。
現在ディレクトリ非掲載なので実害は出ていないが、**掲載に切り替えた瞬間に出る。**

⚠️ **海光電業の `電設資材・卸売業` は `LEGACY_INDUSTRY_VALUES` 入り**（industryGroups.ts:87、
「経歴から作られた1社」と注記）。**どの `INDUSTRY_GROUPS` の `values` にも属さない**ので、
業種フィルタのどれを選んでも出てこない。**逃げ場が無い状態がそのまま残っている。**

### 5-2. 分類が粗すぎて実質「未分類」の企業

| slug | 社名 | industry(text) | 公開 | 掲載 | source |
|---|---|---|---|---|---|
| (なし) | 株式会社データプール | `IT / SaaS` | ✓ | draft | (null) |
| `third-box` | 株式会社Third Box | `IT / SaaS` | ✗ | draft | (null) ※`is_test`|
| `tyu` | 株式会社TYU | `IT / SaaS` | ✗ | draft | biz_self |

`IT / SaaS` も `LEGACY_INDUSTRY_VALUES` 入り（旧 `/biz/auth` の選択肢）。
**どのグループにも属さないので業種フィルタから消える。**

### 5-3. 判断材料としての整理

| 現象 | 件数 | 現状の扱い |
|---|---|---|
| IT/SaaS でない実業の企業 | 2 | `LEGACY_INDUSTRY_VALUES` か、無理筋のグループ（`コマース・EC`）に押し込んでいる |
| 粒度が粗すぎて分類にならない値 | 3 | `LEGACY_INDUSTRY_VALUES` |
| **合計「逃げ場が無い」企業** | **5** | **すべて業種フィルタから消えている**（`listing_status='draft'` なので現状は表面化していない） |

⚠️ **これは「経歴から企業が増える」構造の必然。** [src/lib/companies/visibility.ts:7](../src/lib/companies/visibility.ts#L7)
にも「ユーザーが経歴を入れれば非IT企業も入ってくるので、この分離が要る」と書かれている。
**IT/SaaS 以外が今後も増える前提で、逃げ場（『その他』『未分類』）の設計が要る。**

---

## 6. 未確認 / 調べ方が分からなかったこと

正直に列挙する。**以下は「確認していない」であって「無い」ではない。**

| # | 未確認の事項 | なぜ |
|---|---|---|
| ① | **画面を実際に開いて13件を目視していない。** `INDUSTRY_GROUPS` が13件でありコードが全件を map していることから導いた | dev サーバーを起動すると本番 Supabase を叩くため、並行セッションへの影響を避けた（CLAUDE.md の指示） |
| ② | **`is_human_approved = false` の行が過去に存在したかどうか** | 現在4行すべて true。履歴を残す列が無いので確認できない |
| ③ | **`ow_industries` の110件・`ow_saas_categories` の13件を誰がいつ入れたか** | migration を全文検索していない。`supabase/migrations/archive/` は299本あり、今回のスコープ外と判断 |
| ④ | **`ow_genres` の `display_order` 重複（2 と 4）が画面でどう出ているか** | 該当ジャンルを持つ企業が0社なので再現できない |
| ⑤ | **`market_industry_focus`（text[] / `CHECK (<@ ARRAY[it_tech, finance, manufacturing, retail, healthcare, public, media, real_estate, other])`）を今後どう扱うか** | 実データ **0件**、**src からの参照も0件**（grep 実測）。ただし**「顧客がどの業界か」を表す既存の器**で、2軸化の一方の候補になりうる。なぜ0件のままなのかは未調査 |
| ⑥ | **`biz_model_types`（text[]）を今後どう扱うか** | 実データ 1件（CLAUDE.md 記載）。src の参照は [queries.ts:338-339, 589](../src/lib/supabase/queries.ts#L338) で `CompanyDetail` に載せているのみ。**`companies/[id]/page.tsx` からの参照は0件**（＝画面に出ていない）。「業態」軸の候補 |
| ⑦ | **`ow_company_genres` の `approved_by` FK に ON DELETE 指定が無い**（＝NO ACTION）ことの影響 | `ow_users` の削除時に DELETE がブロックされうるが、現在 `approved_by` は全行 NULL なので発現しない |
| ⑧ | ~~サイトマップが業種別ページを持っているか~~ → **確認済み。`src/app/sitemap.ts` に `industry` の出現は0件**（業種別ページは無い） | — |
| ⑨ | **`/admin/companies/coverage` が `industry` を列に持っているか** | 未読（CLAUDE.md の列一覧には無い） |

---

## 7. 複数選択化を実装するときに、先に決めておかないと詰む論点

**解決策は書かない。決めないと進めない点だけ挙げる。**

### 7-A. データモデル

1. **`industry`（text）を残すのか捨てるのか。**
   捨てるなら §3-A の **31箇所**（うち破壊的 20箇所）を同時に直す必要がある。
   残すなら「主分類のキャッシュ列」として使うのか、二重管理になるのかを決める。

2. **`industry_id` / `saas_category_id` をどうするのか。**
   82社・65社に値が入っているが**誰も読んでいない**（§3-B）。
   - 使う → 求職者側の読み出しを実装し、`industry`(text) との突き合わせ規則が要る
   - 捨てる → 82社ぶんの入力を捨てる判断と、`/biz/company` の編集UI 差し替えが要る
   - **どちらとも決めずに新しい軸を足すと、分類テーブルが5系統になる。**

3. **`ow_company_genres` を再利用するのか、新しい中間テーブルを作るのか。**
   再利用するなら **`is_primary` と表示順の列追加** が要り、
   `ow_genres` に混ざっている資本・ステージ軸（外資系 / 上場企業 / IPO準備中）を
   どう分離するかも同時に決まる必要がある。

4. **2軸の「軸」を何と何にするか。** 現存する候補が既に多い:
   `INDUSTRY_GROUPS`(13) / `ow_industries`(110) / `ow_saas_categories`(13) /
   `ow_genres`(21) / `market_industry_focus`(CHECK 9値・データ0) / `biz_model_types`。
   **どれを2軸に昇格させ、どれを廃止するかを先に決めないと、また1系統増える。**

### 7-B. 単一値しか受けられない出力先

5. **meta description / OGP バッジ / 一覧カードのタグは構造的に「1つ」しか置けない。**
   （[companies/[id]/page.tsx:154, 157](<../src/app/(jobseeker)/companies/[id]/page.tsx#L154>) /
   [CompanyCardList.tsx:250-258](../src/components/companies/CompanyCardList.tsx#L250)）
   **主分類を決める仕組みが無いと、複数値化した瞬間にここが決まらなくなる。**

6. **職歴の masked 表示**（[timeline.ts:89-96](../src/lib/utils/timeline.ts#L89)）。
   在籍企業を伏せた人の代替ラベルを `${industry}（${phase}・${size}名規模）` で組んでいる。
   **複数業種を並べると企業が特定されやすくなる**ので、匿名性の観点から
   「masked では何個まで出すか」を決める必要がある。

### 7-C. 絞り込みとURL

7. **`?industry=` の複数指定をどう表すか。** `/companies` と `/jobs` で同じ形式を使い、
   `LEGACY_KEYS`（旧URL救済）も生きている。**形式を変えると被リンクが切れる。**

8. **AND か OR か。** 複数選択したとき「全部に該当」か「どれかに該当」か。
   DB 側は `.in()` → `.overlaps()`（OR）/ `.contains()`（AND）で実装が変わる。

9. **LP ファセットの「件数」の意味が変わる。**
   （[page.tsx:120-126](<../src/app/(jobseeker)/page.tsx#L120>)）
   1社が複数業種を持つと**ファセット件数の合計が企業数を超える**。
   「79社」と「ファセット合計」が一致しなくなることを許容するか決める。

### 7-D. 入力と検証

10. **⚠️ `/admin/companies/[id]` の自由入力テキストをどうするか**（§3-C）。
    ここが開いている限り、**どんな分類体系を作っても壊せる。**
    DB に CHECK が無いことと合わせて、CLAUDE.md の
    「UI / API / DB の CHECK を3つ揃える」に**現状は違反している**。

11. **`LEGACY_INDUSTRY_VALUES`（3値・5社）の行き先。**
    新体系でも「どのグループにも属さない値」を許すのか、
    移行時に全社を振り直すのかを決める。

12. **「その他 / 未分類」を作るか**（§5-3）。
    IT/SaaS 以外は経歴経由で今後も増える。逃げ場を作らないと、
    **業種フィルタから静かに消える企業が増え続ける。**

### 7-E. 運用

13. **既存87社の振り直しを誰がやるか。**
    複数選択にした時点で、既存の単一値は「主分類1つだけ」の状態になる。
    2軸目を埋めるのは**取材ではなく公開情報で足りるのか**を先に見積もる必要がある。

14. **`is_human_approved` / `is_ai_suggested` / `ai_confidence` を使うのか捨てるのか。**
    現状はすべての書き込み経路が `is_human_approved: true` / `is_ai_suggested: false` を
    固定で入れており、**承認フローは存在しない**。
    使わないなら列を残す理由を、使うなら運用（誰がいつ承認するか）を決める。

15. **語彙の統一**（§1-5）。「業種」と「業界」が画面ごとに割れている。
    2軸にするなら**軸そのものの呼び名**（例: 事業領域 / 提供業界）も同時に決まる必要がある。

---

## 付録: 実行したクエリ・コマンド

すべて **SELECT / grep のみ**。書き込みは一切していない。

| 調査 | 方法 |
|---|---|
| §1 | `grep -rn "INDUSTRY_GROUPS\|resolveIndustryFilter\|..." src` + `industryGroups.ts` の全文読み |
| §2-0〜2-4 | `pg_attribute` / `pg_constraint` / `pg_policy` / `has_table_privilege` / 各テーブルの SELECT |
| §3 | `grep -rn "industry" src --include='*.ts' --include='*.tsx'`（54ファイル・258出現）→ 該当箇所を1つずつ読む |
| §4-1 | `@supabase/supabase-js`（service_role）で `ow_companies` を SELECT し markdown に整形（一時スクリプトは実行後に削除） |
| §4-2〜4-5, §5 | `ow_companies` の GROUP BY / WHERE |

⚠️ `information_schema.role_table_grants` は**空を返した**（grantor の可視性のため）。
GRANT の確認は **`has_table_privilege()` を使うこと。**
