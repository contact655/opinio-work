# 企業分類の4問化 — ステップ0 調査報告（2026-10-12 実測・読み取りのみ）

本番 DB は SELECT のみ。コード・DB・スキーマは一切変更していない。
「実在」= `ow_companies.is_test is not true`、「検証用」= `is_test = true`。
「掲載中」= `listing_status='listed' かつ is_published=true`。

---

## 0. 先に結論（要点だけ）

1. **業種は既に2階層（`ow_industries.parent_id`）で53行**（有効51・無効2）。新マスタへは「親を作り替え＋子を足す」形で載る。
   ただし**実在113社（業種あり）のうち92社が親（大分類）に直接付いている**。とくに **IT・ソフトウェア（親）に実在80社・掲載中21社**。
   新設計は「小分類まで1つ選ぶ」なので、**この80社は機械的に小分類へ落とせない**（1社ずつ決める必要がある）。
2. **事業領域は16行（有効15）・明細は実在社で約115行**。いまの事業領域は事実上**IT製品カテゴリ専用**で、IT以外の業種で使われているのは
   「ハードウェア・半導体」（メーカー7社）と「コンサルティング」（アクセンチュア1社）だけ。
3. **「最大3件・主はちょうど1件」は既に半分 DB にある**：主は部分 UNIQUE 索引で「最大1件」、「1件以上」は RPC `set_company_business_domains` の中だけ、「最大3件」は API（`MAX_BUSINESS_DOMAINS_PER_COMPANY`）だけ。
   実測では**明細を持つ実在85社すべて主がちょうど1件**（主0件・主2件以上の会社は0社）。
4. **`phase` の CHECK には既に `mega_venture` / `ipo_ready` がある**（0社）。ただし新しい7段の「中堅・中小企業／大企業」に当たる値は**無く**、
   いまの `phase` は**親会社（グループ）の上場状態**の意味（外資系日本法人53社が `listed`）。7段へは**機械変換できない会社が多い**（§3-3）。
5. **資本は列が3つ並存して食い違っている**：`capital_type`（4値）・`is_foreign`（bool）・`parent_company_country`（日本語14値の CHECK）。
   **求職者側の「外資系」絞り込みは `is_foreign` を見ている**。食い違いが実在9社（うち掲載中2社）。
6. **顧客の業界（`ow_company_target_industries`）は vertical 専用の複合FK 構造**で、明細は10行（9社が非掲載・掲載中は自社1社）。
   新設計④「任意・何件でも・10大分類＋個人」には**この構造のままでは載らない**（vertical 縛り・consumer は明細を持てない）。
7. **`?industry=` は事業領域の slug**（sitemap・フッター・LP・`/companies`・`/jobs`）。現行の slug（ai / infra / crm …）を**新しい「事業」でも維持**すれば被リンクは切れない。

---

## 1. 0-1 現状の数字（2026-10-12）

### 1-1. 企業の母数

| 区分 | listing_status | is_published | 社数 | 業種あり |
|---|---|---|---|---|
| 実在 | listed | true | **22** | 22 |
| 実在 | draft | true | 93 | 91 |
| 検証用 | listed | true | 2（サンプルワークス／Third Box） | 2 |
| 検証用 | draft | true | 3 | 3 |
| 検証用 | draft | false | 8 | 8 |
| **合計** | | | 実在 **115** ／ 検証用 **13** | 業種なし＝実在2社（トランス・コスモス／セゾンテクノロジー、どちらも draft） |

※ CLAUDE.md では「2026-09-27 に掲載21社」とあるが、本日の実測は実在の掲載中 **22社**（アクセンチュアが 2026-10-04 に加わった分と整合）。

### 1-2. `ow_industries`（全53行）

列: `id, parent_id, name, slug, display_order, is_active, created_at, requires_business_domain, description`。
`display_order` は**親ごとの相対順**（索引 `ow_industries_parent_idx (parent_id, display_order)`）。

凡例: 実在＝その業種を `industry_id` に持つ実在社数（括弧内は掲載中）／検証＝検証用社数／職歴＝その業種の会社に紐づく `ow_experiences` 件数（全ユーザー）／顧客＝`ow_company_target_industries` での参照数。RBD＝`requires_business_domain`。

| 大分類 | 小分類 | slug | 順 | RBD | 有効 | 実在(掲載) | 検証 | 職歴 | 顧客 |
|---|---|---|---|---|---|---|---|---|---|
| **IT・ソフトウェア** | （親） | it-software | 1 | ✅ | ✅ | **80 (21)** | 8 | 60 | 2 |
| | SaaS・業務システム | it-software-saas | 1 | ✅ | ✅ | 2 (0) | 5 | 6 | 0 |
| | インターネットサービス | it-software-internet | 2 | ✅ | ✅ | 0 | 0 | 0 | 0 |
| | 受託開発・SIer | it-software-sier | 3 | ✅ | ✅ | 2 (0) | 0 | 2 | 0 |
| | デジタルマーケティング | it-software-digital-mkt | 4 | ✅ | ✅ | 0 | 0 | 0 | 0 |
| | ハードウェア・デバイス | it-software-hardware | 5 | ✅ | ✅ | 0 | 0 | 0 | 0 |
| | AI・データ | it-software-ai-data | 6 | ✅ | ✅ | 1 (0) | 0 | 1 | 0 |
| | その他IT | it-software-other | 7 | ✅ | ✅ | 0 | 0 | 0 | 0 |
| **製造業** | （親） | manufacturing | 2 | — | ✅ | 0 | 0 | 0 | 1 |
| | 電子機器・半導体 | electronics-semiconductor | 1 | **✅** | ✅ | 7 (0) | 0 | 0 | 0 |
| | 電機・機械 | machinery | 2 | — | ✅ | 1 (0) | 0 | 1 | 0 |
| | 素材・化学 | materials-chemicals | 3 | — | ✅ | 0 | 0 | 0 | 0 |
| | 食品・飲料 | food-beverage | 4 | — | ✅ | 1 (0) | 0 | 0 | 0 |
| **通信** | | telecom | 3 | — | ✅ | 0 | 0 | 0 | 0 |
| **エネルギー・インフラ** | | energy-infrastructure | 4 | — | ✅ | 0 | 0 | 0 | 0 |
| **飲食・外食** | | food-service | 5 | — | ✅ | 0 | 0 | 0 | 0 |
| **商社・卸売** | | trading-wholesale | 6 | — | ✅ | 1 (0) | 0 | 4 | 0 |
| **小売・流通** | （親） | retail-distribution | 7 | — | ✅ | 1 (0) | 0 | 1 | 1 |
| | EC・ネット通販 | retail-ec | 1 | — | ✅ | 0 | 0 | 0 | 0 |
| | 小売店舗 | retail-store | 2 | — | ✅ | 1 (0) | 0 | 1 | 0 |
| | 卸売・商社機能 | retail-wholesale | 3 | — | ✅ | 0 | 0 | 0 | 0 |
| | その他小売 | retail-other | 4 | — | ✅ | 0 | 0 | 0 | 0 |
| **金融・保険** | （親） | finance-insurance | 8 | — | ✅ | 2 (0) | 0 | 3 | 1 |
| | 銀行・信金 | finance-bank | 1 | — | ✅ | 0 | 0 | 0 | 0 |
| | 証券・投資 | finance-securities | 2 | — | ✅ | 2 (0) | 0 | 2 | 0 |
| | 保険 | finance-insurance-sub | 3 | — | ✅ | 0 | 0 | 0 | 0 |
| | フィンテック | finance-fintech | 4 | — | ✅ | 0 | 0 | 0 | 0 |
| | その他金融 | finance-other | 5 | — | ✅ | 0 | 0 | 0 | 0 |
| **不動産** | | realestate | 9 | — | ✅ | 0 | 0 | 0 | 0 |
| **建設** | | construction | 10 | — | ✅ | 6 (0) | 0 | 0 | **4** |
| **運輸・物流** | | logistics | 11 | — | ✅ | 0 | 0 | 0 | 0 |
| **医療・ヘルスケア** | | healthcare | 12 | — | ✅ | 1 (0) | 0 | 1 | 1 |
| **教育** | | education | 13 | — | ✅ | 0 | 0 | 0 | 0 |
| **人材サービス** | （親） | hr-services | 14 | — | ✅ | 0 | 0 | 0 | 0 |
| | 人材紹介 | hr-agency | 1 | — | ✅ | 1 (0) | 0 | 1 | 0 |
| | 人材派遣 | hr-dispatch | 2 | — | ✅ | 0 | 0 | 0 | 0 |
| | 求人媒体・HRTech | hr-media-tech | 3 | — | ✅ | 1 (0) | 0 | 0 | 0 |
| | その他人材 | hr-other | 4 | — | ✅ | 0 | 0 | 0 | 0 |
| **コンサルティング** | （親） | consulting | 15 | — | ✅ | 0 | 0 | 0 | 0 |
| | 戦略・経営 | consulting-strategy | 1 | — | ✅ | 0 | 0 | 0 | 0 |
| | IT・システム | consulting-it | 2 | — | ✅ | 1 (**1**) | 0 | 1 | 0 |
| | 会計・税務・法務 | consulting-professional | 3 | — | ✅ | 0 | 0 | 0 | 0 |
| | その他コンサル | consulting-other | 4 | — | ✅ | 0 | 0 | 0 | 0 |
| **メディア・広告・エンタメ** | （親） | media-advertising-entertainment | 16 | — | ✅ | 0 | 0 | 0 | 0 |
| | 広告代理店 | media-ad-agency | 1 | — | ✅ | 0 | 0 | 0 | 0 |
| | メディア・出版 | media-publishing | 2 | — | ✅ | 1 (0) | 0 | 0 | 0 |
| | ゲーム | media-game | 3 | — | ✅ | 0 | 0 | 0 | 0 |
| | エンタメ・映像・音楽 | media-entertainment | 4 | — | ✅ | 0 | 0 | 0 | 0 |
| | その他メディア | media-other | 5 | — | ✅ | 0 | 0 | 0 | 0 |
| **公共・団体** | | public-organization | 17 | — | ✅ | 0 | 0 | 0 | 0 |
| **その他サービス** | | other-services | 18 | — | ✅ | 1 (0) | 0 | 1 | 0 |
| インターネット・Webサービス | | internet-web | 98 | ✅ | ❌ | 0 | 0 | 0 | 0 |
| 不動産・建設 | | realestate-construction | 99 | — | ❌ | 0 | 0 | 0 | 0 |

**集計**: 実在で業種を持つ113社のうち **親（大分類）に直付け 92社**（IT 80・建設 6・金融 2・商社 1・小売 1・医療 1・その他サービス 1）、子に付いているのは **21社**。
掲載中22社は **IT・ソフトウェア（親）21社＋コンサル›IT・システム 1社（アクセンチュア）**。
RBD=true は IT 系8行＋「電子機器・半導体」1行（**子にだけ立っていて親の製造業は false**）。判定は会社の `industry_id` の行だけを見て祖先は見ない（`publishable.ts`）。

制約・索引: `UNIQUE (slug)`／`UNIQUE NULLS NOT DISTINCT (name, parent_id)`／`parent_id` FK `ON DELETE RESTRICT`／`ow_companies.industry_id` FK `ON DELETE SET NULL`。
RLS: `industries_public_read`（全ロール・`is_active = true`）／`industries_admin_write`（`ow_user_roles.role='admin'`）。anon は SELECT のみ、authenticated は 4権限（RLS で絞る）。

### 1-3. `ow_business_domains`（全16行）と明細

列: `id, name, slug, description, display_order, is_active, created_at`（**業種への紐付け・種別・別名・状態の列は無い**）。
制約: `UNIQUE(name)`・`UNIQUE(slug)`。RLS 読み取り `is_active = true OR auth_is_admin()`（anon/authenticated）、書き込みは運営のみ。

| 順 | 名前 | slug | 有効 | 実在：明細 | 実在：主 | 実在：掲載中の明細 | 検証用 |
|---|---|---|---|---|---|---|---|
| 1 | AI・データ | ai | ✅ | 15 | 12 | 4 | 3 |
| 2 | クラウドインフラ | infra | ✅ | 19 | 12 | 4 | 0 |
| 3 | 開発者ツール | devtools | ✅ | 5 | 2 | 2 | 0 |
| 4 | セキュリティ | security | ✅ | 11 | 8 | 3 | 0 |
| 5 | CRM・営業支援 | crm | ✅ | 10 | 10 | 4 | 0 |
| 6 | コラボレーション | collab | ✅ | 8 | 6 | 3 | 0 |
| 7 | プロジェクト管理 | project-management | ✅ | 7 | 6 | 3 | 0 |
| 8 | 基幹業務システム | erp | ✅ | 4 | 3 | 0 | 0 |
| 9 | 経理・財務 | finance | ✅ | 7 | 5 | 1 | 0 |
| 10 | 法務・契約 | legal | ✅ | 2 | 1 | 1 | 0 |
| 11 | HR・人材 | hr | ✅ | 6 | 6 | 2 | 1 |
| 12 | マーケティング | marketing | ✅ | 6 | 4 | 2 | 0 |
| 13 | ハードウェア・半導体 | hardware | ✅ | 7 | 7 | 0 | 0 |
| 14 | マーケットプレイス | marketplace | ✅ | 2 | 2 | 0 | 0 |
| 15 | 業種特化 | vertical | ❌ | **0** | 0 | 0 | 0 |
| 16 | コンサルティング | consulting | ✅ | 1 | 1 | 1 | 0 |

（明細の合計＝実在 110 行。業種特化は明細0で行だけ残っている）

**業種 × 主の事業領域（実在）**: IT・ソフトウェア（親）に主のある77社は AI 12／クラウド 12／CRM 10／セキュリティ 8／PM 6／HR 6／コラボ 6／経理 5／マーケ 4／基幹 3／開発者 2／マーケットプレイス 2／法務 1。
製造業›電子機器・半導体 7社＝ハードウェア・半導体。コンサル›IT・システム 1社＝コンサルティング。**それ以外の業種で事業領域を持つ会社は0社。**

**1社あたりの件数分布（`ow_company_business_domains`）**

| | 0件 | 1件 | 2件 | 3件以上 | 主0件（明細あり） | 主2件以上 |
|---|---|---|---|---|---|---|
| 実在・掲載中（22） | 0 | 16 | 4 | 2 | 0 | 0 |
| 実在・非掲載（93） | **30** | 51 | 7 | 5 | 0 | 0 |
| 検証用（13） | 9 | 4 | 0 | 0 | 0 | 0 |

※ 「3件以上」は最大3件（4件以上は0社。API の上限が効いている）。
事業領域0件の実在30社の業種: 建設6／IT（親）3／受託開発・SIer 2／SaaS・業務システム 2／金融（親）2／証券・投資 2／業種なし2／人材紹介1／求人媒体1／医療1／商社1／小売（親）1／小売店舗1／AI・データ1／電機・機械1／食品・飲料1／その他サービス1／メディア・出版1（すべて draft）。

制約・索引: PK `(company_id, domain_id)`／**部分 UNIQUE 索引 `ow_company_business_domains_one_primary (company_id) WHERE is_primary`**（主は最大1件）／`domain_id` FK RESTRICT／`company_id` FK CASCADE。
RLS: anon は「is_published かつ is_test=false の会社」の行だけ読める。authenticated は加えて自社管理者・運営。書き込みは自社管理者・運営。

### 1-4. `ow_company_target_industries`（顧客の業界）と `target_industry_scope`

参照先は **`ow_industries`（業種マスタを共有）**。列: `company_id, industry_id, is_primary, display_order, created_at, target_industry_scope`。

| 構造 | 内容 |
|---|---|
| 複合 FK `ow_cti_company_scope_fkey` | `(company_id, target_industry_scope) → ow_companies(id, target_industry_scope)`（`ow_companies` 側に `UNIQUE(id, target_industry_scope)`） |
| CHECK `ow_cti_scope_is_vertical` | `target_industry_scope = 'vertical'` |
| 部分 UNIQUE 索引 | 主は最大1件 |
| RLS | 読みは ow_company_business_domains と同形、**書きは運営のみ** |
| RPC | `set_company_target_industries(p_company_id, p_scope, p_industry_ids, p_primary_industry_id)`（SECURITY INVOKER） |

明細は**10行・10社・全行が主**: 建設 4（アンドパッド／スパイダープラス／フォトラクション／ダンドリワーク）、医療・ヘルスケア 1（Ubie）、IT・ソフトウェア 2（ゲインサイト／**Opinio＝掲載中の唯一**）、金融・保険 1（nCino）、小売・流通 1（ミラクル）、製造業 1（クアルコム）。**全部が大分類の行**を指している。

`ow_companies.target_industry_scope`: 実在 horizontal **71** ／ vertical **10** ／ consumer **2**（アップル・ウーバー、どちらも draft）／ NULL **32**。検証用は全13社 NULL。
`target_industry_scope` は authenticated に UPDATE を配っていない（運営専用）。

### 1-5. `ow_companies.phase`

CHECK `ow_companies_phase_check`: NULL または `startup, listed, non_listed, seed, series_a, series_b, series_c, series_d, unicorn, mega_venture, ipo_ready, listed_prime, listed_standard, listed_growth, listed_overseas`（**15値・mega_venture と ipo_ready は既にある**）。

| phase | 実在 | うち掲載中 | 検証用 |
|---|---|---|---|
| listed | 58 | 14 | 0 |
| NULL | 29 | 0 | 10 |
| unicorn | 11 | 5 | 0 |
| non_listed | 6 | 2 | 2（うち掲載中1） |
| startup | 5 | 1（Opinio） | 0 |
| listed_growth | 3 | 0 | 0 |
| series_d | 2 | 0 | 0 |
| series_b | 1 | 0 | 0 |
| series_a | 0 | 0 | 1（Third Box・掲載中） |
| seed / series_c / mega_venture / ipo_ready / listed_prime / listed_standard / listed_overseas | 0 | 0 | 0 |

関連する他の列: `business_stage` 実在・検証用とも**全件 NULL**（【廃止】）。`funding_stage` 実在 seed 3 / listed 3 / NULL 109、検証用 series_b 1（**一覧の select で `funding_stage:phase` と別名で読んでおり、この列自体はどこからも読まれていない可能性が高い**＝未確認）。`market_industry_focus` 全件 NULL。

### 1-6. 資本・本社の国まわり

| 列 | CHECK | 実在 | 検証用 |
|---|---|---|---|
| `capital_type` | NULL / foreign_subsidiary / japanese_independent / japanese_group / other | foreign_subsidiary **60** ／ NULL **48** ／ japanese_independent 5 ／ japanese_group 2 | NULL 11 ／ japanese_independent 2 |
| `parent_company_country` | NULL / 米国・日本・ドイツ・英国・フランス・カナダ・韓国・中国・台湾・オーストラリア・スウェーデン・オランダ・スイス・その他（**日本語14値**） | 米国 54 ／ NULL 54 ／ ドイツ 3 ／ 日本 2 ／ 中国 1 ／ オランダ 1 | NULL 13 |
| `is_foreign`（bool） | — | true **65** ／ false 50 | false 13 |
| `parent_company_name` / `capital_notes` / `listed_exchange` | — | （本調査では件数を取っていない） | |

**食い違い（実在9社）**

| 会社 | capital_type | is_foreign | 親会社の国 | 掲載 |
|---|---|---|---|---|
| アクセンチュア | foreign_subsidiary | **false** | **NULL** | **掲載中** |
| アンソロピックジャパン | **NULL** | true | NULL | **掲載中** |
| KnowBe4 Japan | foreign_subsidiary | **false** | 米国 | draft |
| Indeed Japan | **japanese_group** | **true** | 日本 | draft |
| キリバ／クリックハウス／ゲインサイト／コング／ザクトリー | **NULL** | true | NULL | draft |

→ **アクセンチュアは掲載中なのに `/companies` の「外資系」で絞ると出ない**（`is_foreign=false`）。
※ Indeed Japan は親がリクルート（日本）なので `japanese_group` が正で `is_foreign=true` 側が誤りの可能性が高い（未確認）。

`ow_companies` の GRANT: authenticated の UPDATE は列単位。`industry_id / phase / capital_type / parent_company_country / parent_company_name / capital_notes / listed_exchange / business_stage / industry` は**付与済み**、`target_industry_scope` は**未付与**。SELECT は anon にもテーブルレベル。

### 1-7. DB 側の制約・トリガー・関数（分類に関わるもの）

| 種類 | 名前 | 中身 |
|---|---|---|
| RPC | `set_company_business_domains(p_company_id, p_domain_ids, p_primary_domain_id)`（INVOKER） | 有効なマスタだけ許す／**1件以上なら主必須・主は選択内**／全削除→再挿入。**件数上限は見ていない** |
| RPC | `set_company_target_industries(...)`（INVOKER） | scope の3値検証／vertical 以外は明細0件／vertical なら1件以上・主必須／`ow_companies.target_industry_scope` も更新 |
| 関数 | `rebuild_ow_transitions()`（DEFINER） | `industry_change` を **`cf.industry_id <> ct.industry_id` で判定**（親子を見ない）。`from_industry/to_industry` に業種名。現在 changed 10 / unchanged 6 / unknown 4 |
| 関数 | `approach_company_matches_field(p_company_id, p_field, p_values)`（DEFINER） | `industries` 項目：会社の `industry_id` が指定 id か、その**親**が指定 id か（＝求職者は**大分類**を選ぶ前提） |
| 関数 | `approach_range_field_coverage()`（DEFINER） | `industry_id is not null` の社数を数える |
| 設定 | `ow_approach_range_fields.industries` | **enabled = true**（受け取り範囲で業種が使える）。`ow_approach_preferences.industries` に値を入れている行は **0** |
| トリガー | `ow_companies` の3本（`trg_guard_company_approval`／`trg_ow_companies_normalized_name`／`trg_ow_companies_propagate_is_test`） | **分類列には触れない** |
| ビュー | — | 分類列を参照するビューは **0本** |
| ポリシー | `company_business_domains_anon_read` / `_auth_read` | `ow_companies.is_published / is_test` を参照（分類列自体は参照しない） |
| 他テーブル | `ow_profiles.desired_phase`（text[]） | 値は**日本語**（シリーズA／シリーズB／上場）。`phase` の slug とは別語彙 |

---

## 2. 0-2 使用箇所の棚卸し（src/ と DB）

grep は `src/` 全体（`lib/supabase/types.ts` を除く）。用途ごとに束ねた。★＝新設計で必ず触る。

### 2-1. 業種（`industry_id` / `ow_industries`）

| ファイル | 関数・箇所 | 用途 |
|---|---|---|
| ★`lib/companies/companyRequirements.ts` | `COMPANY_REQUIREMENTS` / `missingCompanyRequirements` | 公開に必要な項目（企業名・業種・事業領域〔RBD のときだけ〕・従業員数・本社所在地）。純粋関数。下書きの `business_domains`（`DRAFT_BUSINESS_DOMAINS_KEY`）も読む |
| ★`lib/companies/publishable.ts` | `checkPublishable` / `findPublishBlockers` | 業種行の `requires_business_domain` を引き、主の事業領域（下書き優先）と照合。規約同意は actor=企業のみ |
| `lib/companies/industries.ts` / `industryTree.ts` / `components/companies/IndustrySelectOptions` | `flattenIndustryOptions` / `buildIndustryTree` / `expandIndustryWithAncestors` | 2階層の並び（親→子）と祖先展開（本人側に掛ける） |
| `lib/companies/industryMatch.ts` / `industryMatchText.ts` | `/mypage`「◯◯の経験が活きる会社」 | 職歴の会社の `industry_id`（祖先展開）× 掲載企業の顧客の業界 |
| `lib/business/candidates/touchpoints.ts` | ④a `target_industry`（重み5） | 自社の顧客の業界 × 候補者の職歴の会社の業種（祖先展開） |
| `lib/evidence/fetch.ts` | 提案の根拠 | 会社の業種名（`ow_industries!industry_id(name)`） |
| `lib/people/directory.ts` / `app/(jobseeker)/people/PeopleListClient.tsx` | `/people` | 職歴の会社の業種名（表示・絞り込み補助）。外資は `is_foreign` |
| `lib/approaches/range.ts` / `app/admin/approach-range` | 受け取り範囲 | **大分類（parent_id is null）だけ**を選択肢に出す |
| `app/api/companies/search/route.ts` | `/biz/companies/add/new` の重複チェック | サブテキストに業種名 |
| `app/api/jobseeker/companies/route.ts` / `components/companies/CompanyCreateDialog.tsx` | 求職者が経歴から会社を登録 | 業種必須（`industry_id` を検証） |
| `app/api/biz/companies/route.ts` / `app/biz/companies/add/new/*` | 企業の自己登録 | 業種（任意）を FK で受ける |
| `app/biz/company/page.tsx` / `CompanyEditClient.tsx` / `lib/business/company.ts` / `lib/companies/applyDraft.ts` | `/biz/company` | 業種の選択（下書き→公開で `industry_id` 展開）、RBD に応じて事業領域を必須表示 |
| `app/admin/companies/[id]/page.tsx` / `CompanyDetailClient.tsx` / `app/api/admin/companies/[id]/route.ts` | 運営の企業編集 | 業種・事業領域・対象業界のタブ。RBD を読む |
| `app/(jobseeker)/LandingPage.tsx` / `jobs/(list)/JobsClient.tsx` | 文言のみ | 「業種」は ow_industries の語、という注記（`?industry_id=` は 2026-08-06 に削除済み） |
| `lib/search/companies.ts` / `interpretQuery.ts` | 自然文検索 | **ow_industries は条件に使わない**と明記 |
| `lib/utils/timeline.ts` `generateMaskedCompanyLabel` | 伏せた会社の代替ラベル | ⚠️ **`ow_companies.industry`（廃止 text 列）と `phase` を使う**（CLAUDE.md の「業種のまま」は実装上は text 列）。伏せる設定は 2026-09-15 に畳んだので**描画されない** |
| DB `rebuild_ow_transitions` | `industry_change` | `industry_id` の素の比較 |
| DB `approach_company_matches_field` | 受け取り範囲 | 自身 or 親の id |

### 2-2. 事業領域（`ow_business_domains` / `ow_company_business_domains`）

| ファイル | 用途 |
|---|---|
| ★`lib/companies/businessDomains.ts` | 選択肢取得 `fetchBusinessDomainOptions`・上限 `MAX_BUSINESS_DOMAINS_PER_COMPANY = 3`（**クライアントからも import される。admin クライアントを同居させない**） |
| ★`lib/companies/businessDomainsCached.ts` | `getBusinessDomainOptions`（マスタ全件・`/companies` チップ）／`getBusinessDomainFacets`（掲載中1社以上・`unstable_cache` 300s・tag `business-domains`） |
| ★`lib/companies/setBusinessDomains.ts` | 入れ替えの唯一の入口（RPC 呼び出し・上限検証）。運営 API と `applyDraft` が使う |
| ★`lib/companies/applyDraft.ts` | `/biz/company` の「変更を公開する」で下書きの事業領域を本番へ（**企業側は 2026-10-12 時点で下書き経由**。CLAUDE.md の「即時保存」記述は古い） |
| `app/api/admin/companies/[id]/business-domains/route.ts` | 運営の入れ替え |
| ★`lib/search/companies.ts` `searchCompanies` | `?industry=<slug>` → `resolveIndustryKey` → 明細の company_id で絞る（**主以外も当たる**）。カードの `business_domains` 付与 |
| ★`lib/search/industryGroups.ts` | `LEGACY_KEYS`（fintech→finance / ec→marketplace / healthcare→vertical）と旧 `INDUSTRY_GROUPS`（求職者側では未使用・経緯として残存） |
| `app/(jobseeker)/companies/(list)/page.tsx` | チップ（マスタ全件）と `facetForMetadata`（`?industry=` 単独時の title/canonical） |
| `components/companies/CompanySearchBar.tsx` | 事業領域／顧客の業界／フェーズ／外資のチップ |
| ★`app/sitemap.ts` | `getBusinessDomainFacets()` から `/companies?industry=<slug>` を生成（本日の掲載中で該当する事業領域は12個） |
| ★`components/jobseeker/JobseekerFooter.tsx` | 「事業領域から探す」 |
| ★`app/(jobseeker)/page.tsx` / `LandingPage.tsx` / `lib/lp/pickCompanies.ts` | LP のファセット・企業カード（主の事業領域 ／ phaseLabel） |
| `app/(jobseeker)/jobs/(list)/page.tsx` / `JobsClient.tsx` / `components/jobs/JobDetailView.tsx` / `lib/jobs/listCompany.ts` | `/jobs` の事業領域チップ・求人詳細の表示 |
| `app/(jobseeker)/companies/[id]/CompanyDetailPage.tsx` / `components/companies/CompanyInfoBox.tsx` / `CompanyPane.tsx` / `CompanyCardList.tsx` | 企業詳細のサイドバー（事業領域→顧客の業界）・分割ペイン・カードのタグ |
| `lib/supabase/queries.ts` `fetchBusinessDomainsByCompany` / `mapCompany(…, domains)` | 企業取得時の付与（第4引数の渡し忘れで「—」になる罠あり） |
| `app/(jobseeker)/feed` / `mypage/bookmarks` / `mypage/follows` / `search/page.tsx` / `app/api/search/suggest/route.ts` / `lib/search/runSearch.ts` / `interpretQuery.ts` | 主の事業領域の表示・サジェスト・自然文検索の語彙 |
| `lib/business/candidates/touchpoints.ts` / `model.ts` / `app/biz/candidates/CandidatePreview.tsx` | ④b `business_domain`（重み4）：自社と候補者の前職の事業領域の一致 |
| `lib/evidence/engine.ts` / `fit.ts` / `fetch.ts` | 提案の根拠（`business_domain` / `target_industry`） |
| `lib/profile/autoSkills.ts` / `autoSkillsServer.ts` / `lib/constants/skills.ts` | 職種×年数の自動スキル：主の事業領域名を業界として集計 |
| `types/genre.ts` | `CompanyBusinessDomain` 型・`primaryBusinessDomain()` |
| `app/dev/preview/*` | 固定データ |

### 2-3. 顧客の業界（`target_industry_*`）

`lib/companies/targetIndustries.ts`（3値と上限）／`app/api/admin/companies/[id]/target-industries/route.ts`（運営のみ）／`app/admin/companies/*`（一覧・編集タブ）／`lib/search/companies.ts`（`?target=<industry slug>`）／`lib/search/companyListParams.ts`／`CompanySearchBar.tsx`（チップ「顧客の業界」）／`CompanyInfoBox.tsx`・`CompanyPane.tsx`・`CompanyPaneLoader.tsx`（事業領域の直下に表示）／`queries.ts` `fetchTargetIndustriesByCompany`（2段取得・複合FKのため埋め込み不可）／`lib/companies/industryMatch.ts`（/mypage）／`touchpoints.ts`④a／`lib/evidence/*`／`lib/people/directory.ts`（コメントのみ）。**企業側（/biz）には入力欄が無い**（運営専用）。

### 2-4. `requires_business_domain`

`lib/companies/businessDomains.ts`（注記）／`companyRequirements.ts`／`publishable.ts`（`checkPublishable`・`findPublishBlockers`）／`app/biz/company/page.tsx`・`CompanyEditClient.tsx`（必須表示）／`app/admin/companies/[id]/page.tsx`・`CompanyDetailClient.tsx`。

### 2-5. phase（事業ステージ／フェーズ）

| ファイル | 用途 |
|---|---|
| ★`lib/constants/phase.ts` | 唯一の語彙 `PHASE_OPTIONS`（15値・親子）、`expandPhase` / `PHASE_FILTER_MAP` / `phaseMatches` / `PHASE_SELECT_OPTIONS` / `phaseLabel` / `isPhaseValue` |
| ★`lib/search/companies.ts` | `?phase=` → `q.in("phase", PHASE_FILTER_MAP[...])` |
| ★`components/companies/CompanySearchBar.tsx` | フェーズチップ（13件全件。0社でも出す例外） |
| ★`app/(jobseeker)/jobs/(list)/JobsClient.tsx` | `/jobs` の `?phase=`（カンマ区切り）＋`?foreign=1`、`phaseMatches` |
| ★`lib/utils/stageCfg.ts` `getStageCfg` / `CompanyDetailPage.tsx` | 企業詳細 Hero のバッジ |
| `components/companies/CompanyPane.tsx` / `CompanyCardList.tsx` / `LandingPage.tsx` / `lib/lp/pickCompanies.ts` / `lib/jobs/listCompany.ts` | 表示 |
| ★`lib/business/candidates/touchpoints.ts` | 「同じ事業ステージ」ルール：`COARSE_PHASES = {startup, listed, non_listed}` を**除いた細かい段**が一致したときだけ（重み1・最下位） |
| `lib/matching/scoreJob.ts` / `app/api/jobseeker/recommendations` / `app/api/cron/weekly-match` / `mypage/applications` / `lib/evidence/fetch.ts`（`matchCompanyPreference`） | 求職者の希望フェーズ（`desired_phase`＝日本語）との一致・理由文 |
| `lib/careerAI/masters.ts` / `resolve.ts` | `desired_phase` は日本語で slug ではないと明記 |
| `app/biz/company/CompanyEditClient.tsx` / `lib/business/company.ts`（`row.phase ?? row.business_stage`） / `lib/companies/applyDraft.ts`（`isPhaseValue` 検証） | 企業側の入力 |
| `app/api/admin/companies/[id]/route.ts` | 運営の保存（長さ上限） |
| `lib/utils/timeline.ts` / `mypage/page.tsx` / `UserProfileContent.tsx` | 伏せた会社ラベル用（描画されない） |

※ `proposalPhase` など「提案の段」は別物（grep に当たるが無関係）。

### 2-6. 資本・外資

| ファイル | 列 | 用途 |
|---|---|---|
| `lib/constants/capitalType.ts` | capital_type | 表示ラベル4値（外資系日本法人／日系独立／日系グループ会社／その他） |
| `components/companies/CompanyInfoBox.tsx` / `LocationsCapitalSection.tsx` / `ProductsClientsSection.tsx` / `CompanyCardList.tsx` | capital_type / parent_company_country / capital_notes | 企業詳細の「資本区分」「親会社」行など |
| `app/admin/companies/coverage/columns.ts` | 同上 | 充填状況 |
| `lib/business/bizDisclosure.ts` / `lib/utils/disclosureScore.ts` | capital_type | 開示充実度（5点） |
| ★`lib/search/companies.ts` / `runSearch.ts` / `interpretQuery.ts` | **is_foreign** | 「外資系」絞り込み・自然文検索 |
| `lib/people/directory.ts` / `PeopleListClient.tsx` | **is_foreign** | `/people` の「外資」（職歴に外資系があるか） |
| `lib/supabase/queries.ts` | 全部 | 企業詳細の取得・マッピング |

---

## 3. 0-3 対応表

### 3-1. 業種：現行 → 新 大分類›小分類

| 現行（大›小） | 実在(掲載) | → 新 | 機械的か |
|---|---|---|---|
| IT・ソフトウェア（親） | **80 (21)** | IT・インターネット › **要選択** | ❌ 80社を1社ずつ（下の案） |
| IT›SaaS・業務システム | 2 | IT・インターネット › ソフトウェア・SaaS | ✅ |
| IT›インターネットサービス | 0 | IT・インターネット › インターネットサービス | ✅ |
| IT›受託開発・SIer | 2 | IT・インターネット › SIer・受託開発 | ✅ |
| IT›デジタルマーケティング | 0 | **行き先なし**（広告・メディア›広告代理店 か IT›インターネットサービス） | ❓ 0社なので廃止可 |
| IT›ハードウェア・デバイス | 0 | メーカー › 電機・電子部品 | ✅（0社） |
| IT›AI・データ | 1 | IT・インターネット › ソフトウェア・SaaS（＋事業「AI・データ」） | ✅（Quollio） |
| IT›その他IT | 0 | 行き先なし → 廃止 | ✅（0社） |
| 製造業（親） | 0 | メーカー | ✅ |
| 製造業›電子機器・半導体 | 7 | メーカー › 電機・電子部品 | ✅（アップル／インテル／NVIDIA／クアルコム／デル／レノボ／日本HP。ただし PC・端末メーカーは下の論点） |
| 製造業›電機・機械 | 1 | メーカー › 電機・電子部品（キーエンス） | ⚠ 産業機械寄り。新に「機械」小分類なし |
| 製造業›素材・化学 | 0 | メーカー › 化学・素材 | ✅ |
| 製造業›食品・飲料 | 1 | メーカー › 食品・飲料（アサヒビール） | ✅ |
| 通信 | 0 | IT・インターネット › 通信・ネットワーク | ✅ |
| エネルギー・インフラ | 0 | **行き先なし** | ❓ |
| 飲食・外食 | 0 | **行き先なし**（商社・小売・流通›小売？） | ❓ |
| 商社・卸売 | 1 | 商社・小売・流通 › 専門商社（海光電業） | ⚠ 総合／専門の判断 |
| 小売・流通（親） | 1 | 商社・小売・流通 › 小売（ニトリ） | ✅ |
| 小売›EC・ネット通販 | 0 | 商社・小売・流通 › 小売（＋事業 EC） | ⚠ IT›インターネットサービスとも読める |
| 小売›小売店舗 | 1 | 商社・小売・流通 › 小売（ディオール） | ✅ |
| 小売›卸売・商社機能 | 0 | 商社・小売・流通 › 専門商社 | ✅ |
| 小売›その他小売 | 0 | 商社・小売・流通 › 小売 | ✅ |
| 金融・保険（親） | 2 | 金融 › 保険（プルデンシャル）／証券・投資（みずほ証券） | ⚠ 1社ずつ（判断は自明） |
| 金融›銀行・信金 | 0 | 金融 › 銀行 | ✅ |
| 金融›証券・投資 | 2 | 金融 › 証券・投資 | ✅ |
| 金融›保険 | 0 | 金融 › 保険 | ✅ |
| 金融›フィンテック | 0 | 行き先なし（事業「フィンテック」へ） | ✅（0社） |
| 金融›その他金融 | 0 | 行き先なし → 廃止 | ✅ |
| 不動産 | 0 | 不動産・建設 › 不動産 | ✅ |
| 建設 | 6 | 不動産・建設 › 建設・設計 | ✅（高砂熱学＝設備工事も建設で可） |
| 運輸・物流 | 0 | 商社・小売・流通 › 物流 | ✅ |
| 医療・ヘルスケア | 1 | **大塚製薬は メーカー › 医薬品・医療機器** | ❌ 名前どおりなら 医療・介護 だが実態は製薬 |
| 教育 | 0 | 官公庁・団体・教育 › 学校・教育 | ✅ |
| 人材サービス（親） | 0 | 人材サービス | ✅ |
| 人材›人材紹介 | 1 | 人材サービス › 人材紹介・派遣（パーソルキャリア） | ✅ |
| 人材›人材派遣 | 0 | 人材サービス › 人材紹介・派遣 | ✅ |
| 人材›求人媒体・HRTech | 1 | 人材サービス › 求人メディア・採用プラットフォーム（マイナビ） | ✅（HRTech 系 SaaS は IT 側へ） |
| 人材›その他人材 | 0 | 人材サービス › 採用支援・人事コンサル | ⚠ |
| コンサルティング（親） | 0 | コンサルティング | ✅ |
| コンサル›戦略・経営 | 0 | コンサルティング › 戦略・総合 | ✅ |
| コンサル›IT・システム | 1 (1) | コンサルティング › IT・DX（アクセンチュア） | ✅ |
| コンサル›会計・税務・法務 | 0 | コンサルティング › 会計・財務（法務が落ちる） | ⚠ |
| コンサル›その他コンサル | 0 | 行き先なし → 廃止 | ✅ |
| メディア・広告・エンタメ（親） | 0 | 広告・メディア | ✅ |
| メディア›広告代理店 | 0 | 広告・メディア › 広告代理店 | ✅ |
| メディア›メディア・出版 | 1 | 広告・メディア › Webメディア か 出版・放送（PIVOT＝動画メディア） | ❌ 1社判断 |
| メディア›ゲーム | 0 | IT・インターネット › ゲーム | ✅ |
| メディア›エンタメ・映像・音楽 | 0 | **行き先なし**（出版・放送？） | ❓ |
| メディア›その他メディア | 0 | 廃止 | ✅ |
| 公共・団体 | 0 | 官公庁・団体・教育 › 官公庁・自治体 ／ NPO・団体 | ✅（0社） |
| その他サービス | 1 | **行き先なし**（JTB＝旅行） | ❌ |
| （無効）インターネット・Webサービス／不動産・建設 | 0 | 廃止のまま | ✅ |
| 業種なし | 2 | トランス・コスモス／セゾンテクノロジー | ❌ 決めて入れる |
| 新規のみ | — | 医療・介護›病院・クリニック／介護・福祉、メーカー›自動車・輸送機器、金融›ベンチャーキャピタル、広告・メディア›Webメディア、官公庁›学校・教育 等 | 追加 |

**IT（親）80社の小分類の案**（主の事業領域から推す。最終判断は柴さん）:
ソフトウェア・SaaS ＝ 主が AI／クラウド／CRM／セキュリティ／PM／HR／コラボ／経理／マーケ／基幹／開発者／法務 の74社（＋事業領域なし3社のうち KOSKA・やめるラボ・Archi Village は要確認）。
**例外として個別に決めたい**: 日本ヒューレット・パッカード（クラウドインフラだがハード中心 → メーカー?）、伊藤忠テクノソリューションズ（**SIer・受託開発**）、ウーバー・ジャパン（マーケットプレイス → **インターネットサービス**）、ミラクル（同）、OpenAI／アンソロピック（ソフトウェア・SaaS で可か）。

### 3-2. 事業領域：現行 → 新「事業」

| 現行 | slug | 主(実在) | → 新 事業（業種） | 種別 | 機械的か |
|---|---|---|---|---|---|
| AI・データ | ai | 12 | AI・データ（IT） | main | ✅ slug 維持 |
| クラウドインフラ | infra | 12 | クラウド・インフラ（IT） | main | ✅（表記だけ変わる。旧名は別名へ） |
| 開発者ツール | devtools | 2 | **新 main に無い** | — | ❓ |
| セキュリティ | security | 8 | セキュリティ（IT） | main | ✅ |
| CRM・営業支援 | crm | 10 | CRM・営業支援（IT） | main | ✅（search「SFA」を別名に） |
| コラボレーション | collab | 6 | 業務効率化（IT） | main | ⚠ 統合 |
| プロジェクト管理 | project-management | 6 | 業務効率化（IT） | main | ⚠ 統合 |
| 基幹業務システム | erp | 3 | **業務効率化？**（SAP／オラクル／nCino） | — | ❓ |
| 経理・財務 | finance | 5 | **会計ソフト・経費精算（search）か フィンテック（main）** | — | ❓ |
| 法務・契約 | legal | 1 | 電子契約／リーガルテック（search） | search | ⚠ main から外れる |
| HR・人材 | hr | 6 | HR Tech（IT） | main | ✅（旧名を別名に） |
| マーケティング | marketing | 4 | EC・マーケティング（IT） | main | ⚠ |
| ハードウェア・半導体 | hardware | 7 | 半導体 ／ 電子部品（メーカー） | main | ❌ 分割（インテル・NVIDIA・クアルコム＝半導体／アップル・デル・レノボ・HP＝？） |
| マーケットプレイス | marketplace | 2 | EC（商社・小売・流通）／フードデリバリー・マッチングアプリ（search） | — | ❓ |
| 業種特化（無効） | vertical | 0 | 廃止のまま | — | ✅ |
| コンサルティング | consulting | 1 | DX推進（コンサル） | main | ⚠ 業種がコンサルになったので事業は「DX推進」で足りる |

### 3-3. phase → 新しい7段

| 現行 phase | 実在 | 掲載中 | → 新 | 機械的か |
|---|---|---|---|---|
| seed / series_a | 0 | 0（検証用1） | スタートアップ（創業期） | ✅ |
| series_b / series_c / series_d | 3 | 0 | スタートアップ（成長期） | ✅（フライル／アンドパッド／コング。※アンドパッドは1,023名で「メガベンチャー」とも読める） |
| ipo_ready | 0 | 0 | IPO準備中 | ✅ |
| mega_venture | 0 | 0 | メガベンチャー | ✅ |
| listed_prime / standard / growth / overseas | 3 | 0 | 上場企業 | ✅（定義次第） |
| **listed** | **58** | **14** | 上場企業？ | ❌ **うち外資系日本法人53社**（親会社が上場）。日本法人自体は非上場。新定義が「法人そのもの」なら 大企業／中堅・中小 に振り直し |
| **unicorn** | **11** | **5** | 成長期 か メガベンチャー | ❌（SmartHR 1,497名／Ubie 220名／外資日本法人 Databricks・OpenAI・Notion・アンソロピック 等） |
| **startup** | **5** | 1 | 創業期 か 成長期 | ❌（Opinio〜10名／フォトラクション88名／irodas約270名／Translead約73名／ダンドリワーク不明） |
| **non_listed** | **6** | 2 | 中堅・中小 か 大企業 | ❌（伊藤忠テクノ 6,425名＝大企業、海光電業 259名、外資日本法人4社） |
| **NULL** | **29** | 0 | — | ❌（ゼネコン5社・証券3社・キーエンス・大塚製薬・ニトリ・JTB 等。多くは大企業） |

→ **機械変換できるのは実在 6社（series_b/d 3＋listed_growth 3）だけ**。決めが要るのは listed 58・unicorn 11・startup 5・non_listed 6・NULL 29 ＝ **109社**（掲載中は22社全部が listed/unicorn/startup/non_listed のどれかなので**22社全部に判断が要る**）。
`touchpoints.ts` の事業ステージ一致（細かい段のみ）と `/companies`・`/jobs` のフェーズ絞り込み、`desired_phase`（日本語：シリーズA／シリーズB／上場）との照合（`scoreJob.ts`）も同時に読み替えが要る。

### 3-4. 顧客の業界（④）→ 新 10大分類＋個人

| 現行 | 社数 | → 新 |
|---|---|---|
| 建設 | 4 | 不動産・建設 |
| 医療・ヘルスケア | 1（Ubie） | 医療・介護 |
| IT・ソフトウェア | 2（ゲインサイト／Opinio） | IT・インターネット |
| 金融・保険 | 1（nCino） | 金融 |
| 小売・流通 | 1（ミラクル） | 商社・小売・流通 |
| 製造業 | 1（クアルコム） | メーカー |
| scope=consumer | 2（アップル／ウーバー） | 個人のお客さま（新規の明細） |
| scope=horizontal | 71 | **表す手段が無くなる**（④は「任意・何件でも」なので「業界を問わない」と「未確認」が同じ空欄になる） |

### 3-5. 判断事項（2026-10-12 に柴さんがすべて確定）

| # | 論点 | 決定 |
|---|---|---|
| 1 | 「上場企業」の基準 | **親会社のグループで判断する（今の `phase` の持ち方のまま）。** 外資の日本法人も、親会社が上場していれば「上場企業」。画面の説明文は「自社または親会社が上場している」 |
| 2 | 中堅・中小 と 大企業 の境目 | **従業員1,000名**（1,000名以上＝大企業）。`employee_count` から数字が読み取れる会社だけ候補を出し、読み取れない会社は空欄。確定は運営が一括設定の画面で行う（提案Aの画面にステージも付けられるようにする） |
| 2' | 当てはまるステージが複数あるとき | 上場企業 → メガベンチャー → IPO準備中 → スタートアップ（成長期）→ スタートアップ（創業期）→ 大企業 → 中堅・中小企業 の順で1つ |
| 3 | ユニコーン11社 | 国内未上場で大規模＝メガベンチャー、それ以外＝成長期。外資日本法人は #1 に従う（親会社が上場していれば上場企業） |
| 4 | IT（親）80社の小分類 | 「ソフトウェア・SaaS」を**候補として出すだけ**。保存は人が確かめてから（例外5社程度は個別） |
| 5 | 大塚製薬 | メーカー › 医薬品・医療機器 |
| 6 | JTB ほか | **大分類「生活・サービス」を新設**（小分類: 旅行・観光／飲食／エンタメ・レジャー／その他サービス）。JTB → 旅行・観光。PIVOT・トランス・コスモス・セゾンテクノロジーは案を出して柴さんが確定 |
| 7 | 行き先の無い現行小分類 | 「飲食」「エンタメ」は #6 の小分類へ。デジタルマーケティング・エネルギー・その他◯◯は `is_active=false`（行は残す） |
| 8 | 業種「人材紹介・派遣」と事業「人材紹介」「人材派遣」 | 別の軸として両方残す。統合しない |
| 9 | 業種「SIer・受託開発」と事業 search「受託開発」 | 両方残す |
| 10 | ベンチャーキャピタル | search「ベンチャーキャピタル」は main「スタートアップ投資」の別名に統合 |
| 11 | 保険 | main「保険」に search「生命保険」「損害保険」を紐づけ（search は残す）。業種の小分類とは別軸 |
| 12 | EC | IT 側を「Webマーケティング」にし、EC は商社側1つに寄せる |
| 13 | 不動産管理 | search 側を削除 |
| 14 | 人材紹介・派遣の search | main の下位として残す |
| 15 | 医薬品・医療機器 | search「医薬品」「医療機器」は別名へ。「医薬品卸」は残す |
| 16 | 総合商社 | search 側を削除 |
| 17 | 開発者ツール ほか | main に「開発者ツール」「基幹業務システム」を足す。経理・財務 → 会計ソフト等、法務 → リーガルテック／電子契約 |
| 18 | ハードウェア・半導体 | 半導体（インテル・NVIDIA・クアルコム）／電子部品・家電（アップル・デル・レノボ・HP） |
| 19 | 業界を問わない | ④に「業界を問わない」を明示の選択肢として持つ（空欄＝未確認と区別） |
| 20 | 外資系の判定列 | `capital_type` を正にする。空の6社（アンソロピックジャパン・キリバ・クリックハウス・ゲインサイト・コング・ザクトリー）は**公開情報で確かめて埋めてから**切り替え、出典を一覧で報告 |
| 21 | 本社の国 | ISO コードへ（米国→US 等）。「日本」2社は日系なので不要 |

**提案A・B・C も採用。** A＝大分類だけの会社は大分類のまま公開を続けられ、運営が一括で小分類（とステージ）を付ける画面を作る。求職者側の大分類の絞り込みには大分類だけの会社も出す。B＝新しい公開の条件は既存の公開状態に当てはめない（次に公開・編集するときだけ）。C＝外資系は `capital_type` に一本化。

**進め方**: §5 の段を順に、各段を単独のコミット。実在の会社の分類を書き換える段（業種の付け替え・ステージの初期値・外資の切り替え）は、書き込む前に「会社名・今の値・新しい値」の一覧を出して止まる。どの段でも公開状態・掲載状態の件数が前後で同じことを migration の中で確かめる。

## 4. 0-4 構造案の評価

### 4-1. いまのスキーマと合わない／注意が要る点

| 項目 | 現状 | 影響 |
|---|---|---|
| 業種の2階層 | **既に `parent_id` 方式**・`display_order` は親ごと・`UNIQUE NULLS NOT DISTINCT (name, parent_id)`・`slug` UNIQUE | 別テーブルは不要。既存行の**名前を変えて使い回すか、新規行を足して旧行を無効化するか**の選択だけ |
| 小分類必須 | 実在92社が親に直付け | 公開ゲートに「子であること」を足すと**掲載中21社が即ゲートに掛かる**。ゲートの強化はデータ移行の後 |
| `requires_business_domain` | 子の「電子機器・半導体」だけ true の例外あり | 全業種必須にするなら列は不要（参照7ファイル） |
| 顧客の業界 | 複合FK＋vertical 専用 CHECK＋RPC が scope と明細を同時に書く | ④「任意・何件でも・大分類＋個人」には**複合FKと CHECK を外す**必要がある。「個人」は `ow_industries` に無いので、行を足すか別の表現が要る |
| `?industry=` | 事業 slug（ai/infra/…/consulting）＋旧キー3つ（fintech/ec/healthcare） | 新しい「事業」でも **slug 列を持ち、現行12個（＋旧3キー）を同じ slug で残す**。新規の事業は新 slug |
| 業種の slug | `?target=<industry slug>`（顧客の業界の絞り込み） | 業種の大分類の slug を変えると `?target=` の被リンクが変わる（現状 sitemap には載っていない） |
| 受け取り範囲（approach） | 大分類 id を保存・親で照合 | 保存行0件なので今が変えどき。大分類の **id を変えない**（行を使い回す）と楽 |
| `ow_transitions.industry_change` | 素の `industry_id` 比較 | 小分類化すると「SaaS→SIer」も changed になる。**大分類で比べる**よう関数を直す（CREATE OR REPLACE・service_role で洗い替え） |
| 伏せた会社ラベル | 廃止 text 列 `industry` と `phase` | 描画されないが、残すなら新列に寄せるか削除 |
| ステージ | `phase` は CHECK 15値・語彙は `phase.ts` 1か所・多数の画面が `PHASE_OPTIONS` を見る | 新7段は**意味が変わる**（グループ→法人、規模の段が入る）。同じ列に入れると旧値との混在期間に `phaseMatches` が壊れる |
| 資本 | `capital_type`（4値・UPDATE GRANT 済み）・`is_foreign`・`parent_company_country`（日本語） | 新しい「日系/外資系」は `capital_type` から導ける（foreign_subsidiary＝外資系、他＝日系）。新列を作るより**既存列の再定義**が速い。ただし絞り込みは `is_foreign` を見ているので同時に寄せる |
| GRANT | `ow_companies` の UPDATE は列単位、SELECT は anon にテーブルレベル | 新列は**同じ migration で `grant update (列) to authenticated`**。anon には自動で読める（資本・国・ステージは公開してよい情報なので問題なし）。会社追加の「事業」の申請者（誰が足したか）を `ow_companies` に置くと anon に読める → **事業マスタ側に置く**（そちらは RLS で絞れる） |

### 4-2. 事業マスタ（`ow_business_domains` を広げる案）の評価

| 論点 | 評価・代案 |
|---|---|
| 業種への紐付け | 列 `industry_id`（**大分類**を指す FK）。「main は1業種に属する」ので列で足りる。業種横断の事業（例: EC）が出たら別行で持つ |
| 種別 main/search | 列 `display_kind`（CHECK 2値）。`is_active` とは別軸 |
| 状態 active / pending | 列 `status`（`active` / `pending` / `merged` / `rejected`）。**既存の RLS `is_active = true OR auth_is_admin()` を `status='active'` に揃える**。pending は申請した企業（と運営）にだけ見せる → ポリシーに `added_by_company = 自社` を足す |
| 公開側に出ない担保 | `getBusinessDomainFacets` / `getBusinessDomainOptions` / sitemap / LP / フッター / サジェスト / `interpretQuery` は**マスタの取得を1関数に集約済み**なので、そこに `status='active'` を入れれば足りる。ただし**企業ページのサイドバー**は明細から埋め込みで名前を取る（`queries.ts`）ので、pending の事業を持つ会社のページで**名前が出る**。RLS で pending 行を anon から隠すと埋め込みが null になり静かに消える → 「審査中の事業は表示しない」を仕様にするなら RLS で足りる |
| 別名 | `text[]` 列か別表か。**検索だけに使う・件数が少ない・統合のときに旧名を残す**用途なら `aliases text[]` で十分（`search_aliases` が `ow_companies` で同じ形）。統合時に「旧 slug → 新 id」を残す必要があるなら**別表 `ow_business_domain_redirects(old_slug, domain_id)`** にした方が `?industry=` の救済（`LEGACY_KEYS` のハードコード）を DB に移せる |
| 統合（既存へ寄せる） | `ow_company_business_domains.domain_id` を付け替える必要がある（PK が `(company_id, domain_id)` なので、同じ会社が両方持っていると衝突 → 先に消す）。RPC で1トランザクションに |
| 名前の UNIQUE | 現行 `UNIQUE(name)` のまま広げると、main と search の同名（不動産管理・総合商社 等）が入らない → **同名は作らない方針**で揃える（§3-5 #13・#16） |

### 4-3. 「最大3件・主はちょうど1件」をどこで守るか

| 条件 | 現状 | 提案 |
|---|---|---|
| 主は最大1件 | 部分 UNIQUE 索引（DB） | そのまま |
| 1件以上なら主が1件 | RPC の中だけ | **RPC に寄せたまま**が無難。「ちょうど1件」を制約で書くには遅延制約トリガー（`CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`）が要り、全削除→再挿入の途中状態や会社削除の CASCADE で誤発火しやすい |
| 最大3件 | API だけ（RPC は見ていない） | **RPC に件数チェックを足す**（1行）。CLAUDE.md の「濃度の制約は2層」方針と矛盾しない範囲で、入口が RPC 1本なのでそこで止めるのが確実 |
| 0件を許すか | 公開ゲート（RBD のとき） | 全業種で②必須 → ゲート側で「主が1件」を見る（`companyRequirements.ts` 1か所） |

### 4-4. ステージ：`phase` を置き換えるか、新列か

- **案A（新列 `company_stage`・7値 CHECK）＋旧 `phase` は残して読みを段階的に移す**：混在期間が無く、touchpoints・絞り込み・`desired_phase` 照合を1つずつ移せる。新列は `grant update` 同梱。
- 案B（`phase` の CHECK を7値に入れ替え）：参照箇所（§2-5）が一斉に壊れる。`desired_phase`（日本語：シリーズA／シリーズB／上場）との対応も一度に変わる。
→ **案Aを推す。** 旧 `phase` の細かい段（シリーズB・東証グロース等）は「事業ステージの補足」として残す価値がある（touchpoints の「同じ段」判定が使っている）。

### 4-5. 資本・本社の国

- 「日系/外資系」は**新列を作らず `capital_type` を正**にする案が最小（外資系＝foreign_subsidiary、日系＝japanese_independent / japanese_group、`other` の扱いだけ決める）。新しい2択に寄せたいなら `capital_origin`（`domestic`/`foreign`）を足して `capital_type` を詳細として残す。
- 本社の国は**新列 `hq_country`（ISO 3166-1 alpha-2・CHECK は `^[A-Z]{2}$`＋候補リストは定数）**。既存 `parent_company_country`（日本語）は「親会社の国」で意味が近いが、**本社の国と親会社の国は必ずしも一致しない**ので別列にして移行で初期値を入れる。
- 「外資系なら国必須」は公開ゲートで見る（DB の CHECK `capital_origin <> 'foreign' OR hq_country IS NOT NULL` も張れるが、既存の未入力社が UPDATE のたびに弾かれるので**ゲート側**が安全）。
- 絞り込み（`/companies`・`runSearch`・`/people`）を `is_foreign` から新しい正へ同時に移す。

### 4-6. 顧客の業界（④）

- 複合FK・vertical CHECK・`set_company_target_industries` の scope 連動を外し、**「会社 × 大分類」の単純な多対多**にする（`is_primary` は不要）。
- 「個人のお客さま」は `ow_industries` に入れると業種の選択肢に混ざる → **別フラグ `serves_consumers boolean`** か、④専用の小さなマスタ（10大分類 id ＋ `consumer`）を持つ方が誤用されない。
- 複合FKが外れると PostgREST の埋め込みが使えるようになる（2段取得のままでも動く）。
- 「業界を問わない」を残すか（§3-5 #19）で列を残すか決まる。

---

## 5. 実装の段取り（提案）

| 段 | 何を変えるか | 画面への影響 |
|---|---|---|
| **段1 マスタの器（追加のみ）** | `ow_industries` に新しい大分類・小分類を**追加**（既存行は名前と親を変えずに、使い回す行・無効化する行を決める）。`ow_business_domains` に `industry_id` / `display_kind` / `status` / `added_by_company` / `aliases` を追加（既定値で既存16行は `main`・`active`）。`ow_companies` に `company_stage`（7値 CHECK）・`hq_country`（ISO）（・必要なら `capital_origin`）を追加し **`grant update` を同梱**。RPC に件数上限を追加。`check-definer-grants.sh` | なし（追加のみ・先行適用可） |
| **段2 データ移行** | **必ず先に `./scripts/dump-tables.sh ow_industries ow_business_domains ow_company_business_domains ow_company_target_industries ow_companies` を取る**。①業種の付け替え（§3-1、id を明示列挙）②事業の付け替え・統合（§3-2）③`company_stage` の投入（§3-3 の決定に従う。決まらない会社は NULL のまま）④`hq_country` の投入（親会社の国から）⑤`is_foreign` の食い違い9社の訂正。**`is_published` / `listing_status` は一切変えない**（migration 内で前後の件数を検算し、変わったら中止）。全社一括 UPDATE をしない。推測値を入れない（決まらない会社は空のまま）。データだけの migration でもファイルを commit/push してデプロイを走らせる（キャッシュ） | 表示名が一部変わる |
| **段3 企業側・運営の入力** | `/biz/company` を4問（業種2段・事業検索＋その場追加・資本＋国・ステージ・お客さま）に。運営 `/admin/companies/[id]` も同じ部品。**運営の「追加された事業」審査画面**（そのまま採用／既存へ統合〔別名に残す〕） | 企業側の入力 |
| **段4 公開ゲート** | `companyRequirements.ts` に「小分類」「事業の主1件」「資本（外資なら国）」「ステージ」を追加し、`requires_business_domain` を参照しない形へ（列は残す→後で廃止）。**掲載中の会社で欠けが0になってから**入れる | `/biz` の「公開まであと◯つ」 |
| **段5 求職者側** | 企業ページ（業種／事業〔主を先頭〕／タイプ／お客さま）、`/companies` の絞り込み（業種2段・事業の検索＆選択・外資系・ステージ）、事業の絞り込みは主以外も当たる（現状どおり）。`?industry=` は現行 slug を維持し旧キーの救済を残す。sitemap・フッター・LP は `status='active'` のものだけ。`/jobs` も同様 | 公開面 |
| **段6 周辺の読み替え** | `touchpoints.ts`（ステージ一致の規則・④a/④b）、`rebuild_ow_transitions`（大分類で比較）、受け取り範囲（大分類 id）、`/people`・`runSearch` の外資判定、`scoreJob` の希望フェーズ照合、`lib/utils/timeline.ts` | 内部 |
| **段7 後片付け** | 旧 `phase` の扱い（補足として残す or 廃止）、`requires_business_domain`・`is_foreign`・`parent_company_country`・`target_industry_scope` と複合FK の廃止（DROP 前に関数本文・ポリシー・制約の5種類を数える） | なし |

注意（全段共通）: ローカルの dev も本番 Supabase に繋がる。検証は `/dev/preview` と読み取りで行い、本番の実在データの状態を検証のために変えない。

---

### 付記：確かめられなかったこと

- `funding_stage` 列の読み手（一覧の select で `funding_stage:phase` の別名として `phase` を読んでおり、列そのものの読み手は見つからなかったが断定はしていない）。
- `parent_company_name` / `capital_notes` / `listed_exchange` の件数は取っていない。
- 各社の正しい小分類・ステージは調べていない（§3-5 はすべて判断待ち）。
