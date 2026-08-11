# 現状調査 — 企業データ × 経歴データの掛け合わせ（2026-08-12）

調査のみ。コード変更・migration・データ変更は一切していない（本ファイルの新規作成が唯一の書き込み）。

## 調査方法

| 何を | どう測ったか |
|---|---|
| DB | Supabase MCP（`read_only=true`）で本番 `xtutnecqeamftygufxco` に SELECT のみ。`.env.local` の `NEXT_PUBLIC_SUPABASE_URL` と同一プロジェクトであることを確認済み |
| 公開範囲 | **本番 `https://opinio.jp` へ未ログインの GET**。dev は `is_published` をフィルタしないため使わない（CLAUDE.md「dev / production 環境差異」） |
| コード | リポジトリの静的読解（ファイル名:行番号を併記） |

⚠️ 件数はすべて **2026-08-12 時点**。

⚠️ 「seed 除く実ユーザー」は `ow_users` で `is_test = false` かつ `is_system = false` の行と定義した。`@seed.internal` は 2026-08-03 の migration で削除済みで残存0件。

---

## 要約（先に結論）

中核価値「求人票の建前を在籍者の実データで検証する」は、**掛け合わせる素材が両側とも揃っていない**。

| 検証したい問い | 現状 |
|---|---|
| 「フルリモート可」を在籍者で検証 | ❌ 不可能。企業の `remote_work_status` は **85社中83社が NULL**、`ow_experiences` に**勤務地カラムが存在しない** |
| 「関西で働けて商社出身の人がいるIT企業」 | ❌ 不可能。企業属性と在籍者経歴を**同時に条件にできる検索が存在しない**。加えて勤務地は全社「東京都」、居住地は実ユーザー26人中4人 |
| 「A社を出た人が次にどこへ行ったか」 | 🟡 **個人カード単位でのみ実装済み**（OB/OGカードに現職企業名が出る）。集計・逆方向（出身企業）は未実装。素材は**遷移5組**しかない |

さらに公開範囲の実態として、**未ログインの訪問者が到達できる実在ユーザーの経歴は0件**（全ユーザーが `login_only`）。人数だけは API から匿名で取れる。

---

# A. 公開範囲

## A-1. `ow_users.visibility` の値ごとの件数 — 【実装済み・ただし全員 login_only】

| visibility | 合計 | **実ユーザー** | is_test | is_system |
|---|---|---|---|---|
| `login_only` | 25 | **5** | 20 | 0 |
| `private` | 1 | 0 | 0 | 1 |
| `public` | **0** | **0** | 0 | 0 |
| 計 | 26 | **5** | 20 | 1 |

⚠️ **`public` は0件。** 3値（public / login_only / private）に対応した実装は全経路にあるが、実データ上「未ログインに見せてよい」ユーザーは1人もいない。

`ow_users.visibility` の設定 UI は `/profile/edit` の可視性設定（[ProfileEditClient.tsx:3809](src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx:3809)）と `/admin/candidates`。

## A-2. 未ログインで到達できるページ — 【実装済み】

本番 `https://opinio.jp` に匿名で GET した実測値。

| パス | 実測 | 備考 |
|---|---|---|
| `/companies` | **200** | 一覧は誰でも見える |
| `/companies/asana`（公開企業） | **200** | |
| `/companies/third-box`（非公開） | **404** | |
| `/companies/fujifilm-bi`（非公開） | **404** | |
| `/jobs` | **200** | |
| `/jobs/salesforce-lead-se-tableau-c7e717`（公開求人） | **200** | |
| `/people` | **307** → `/auth?next=/people` | ログイン必須 |
| `/people/role/sales` | **307** → `/auth?next=...` | 子も同様 |
| `/u/{userId}` | **307** → `/auth?next=...` | ログイン必須 |
| `/schools/{id}` | **200** | **ログイン不要**（下記 A-3 参照） |
| `/salary` | 200 | |
| `/feed` | 200 | |
| `/articles` | 200 | |
| `/search` | 307 → `/companies` | 検索語のルーター |

ゲートは [src/middleware.ts](src/middleware.ts) に集約されている（`/u/`・`/people`・`/people/*`・`/companies/*/casual-meeting`・`/jobs/*/apply`・`/biz`・`/admin`・`/agent`）。

⚠️ **`/schools/[id]` は middleware のゲート対象外**だが、ページ側 [schools/[id]/page.tsx:80-81](src/app/(jobseeker)/schools/[id]/page.tsx:80) で `visibility === 'private'` を常に除外し `login_only` を未ログイン時に除外している。実測でも獨協大学（実ユーザー2名が在籍）の匿名アクセスは「この学校の出身者はまだ登録されていません」「出身者 0」と表示された。

## A-3. 企業詳細ページの現役社員・OB欄（未ログイン時） — 【部分的】

**氏名は出ない。人数だけ出る。**

描画は [CompanyEmployeeSections.tsx:917](src/app/(jobseeker)/companies/[id]/CompanyEmployeeSections.tsx:917) がクライアント側から `/api/jobseeker/companies/[id]/employees` を叩く方式。絞り込みは [employees/route.ts:40-42](src/app/api/jobseeker/companies/[id]/employees/route.ts:40) でサーバー側が行い、未ログインには `visibility === 'public'` の社員だけを返す（＝現状0人）。

本番でセールスフォース・ジャパンの当該 API を匿名で叩いた実測：

```json
{"authenticated": false, "current": [], "alumni": [],
 "hiddenCurrentCount": 1, "hiddenAlumniCount": 1,
 "totalCurrentCount": 1, "totalAlumniCount": 1, "relation": {"kind": "anonymous"}}
```

画面では [CompanyEmployeeSections.tsx:851](src/app/(jobseeker)/companies/[id]/CompanyEmployeeSections.tsx:851) が「ログインすると**1名**のプロフィールが見られます」を出す。セクション見出しには `({totalCount}名)` が出る。

⚠️ **人数（`totalCurrentCount` / `totalAlumniCount`）は匿名にそのまま返している。** 氏名は守られているが「この企業に登録者が何人いるか」は未ログインでも分かる。企業一覧側も同様で、[lib/search/companies.ts:178](src/lib/search/companies.ts:178) が `login_only` を含めた在籍者数を admin クライアントで集計している（コメントに明記あり）。

## A-4. 未ログインで到達できる「実在ユーザーの経歴」 — **0件** 【該当なし】

理由は3つとも同時に成立している。

1. `/u/[id]` と `/people` は middleware が 307
2. 企業詳細・学校ページは `login_only` を未ログインに返さない
3. そもそも `visibility='public'` のユーザーが0人

つまり **経歴の中身（会社名・役職・在籍期間）に匿名で到達できる経路は現時点で存在しない**。到達できるのは人数のみ。

---

# B. 経歴データの実態

## B-1. 件数 — 【データ不足】

| | 件数 |
|---|---|
| `ow_experiences` 総件数 | **14** |
| うち実ユーザーの経歴 | **13** |
| 経歴を持つユーザー（全体） | 5人 |
| **経歴を持つ実ユーザー** | **4人** |
| 実ユーザー1人あたり平均 | **3.25件** |

内訳（実ユーザーのみ）:

| ユーザー | 経歴数 | company_id | company_text |
|---|---|---|---|
| 生藤 弘樹 | 5 | 5 | 0 |
| 木村雅樹 | 4 | 3 | 1 |
| 大塚悠貴 | 3 | 3 | 0 |
| 福永陽貴 | 1 | 1 | 0 |
| （テスト三郎 / is_test） | 1 | 1 | 0 |

## B-2. company_id / company_text の内訳 — 【実装済み】

| 種別 | 件数 |
|---|---|
| `company_id` あり（マスタ紐付け） | **13** |
| `company_text` のみ（自由入力） | **1** |
| `company_anonymized` | **0** |

3列は DB の XOR 制約 `experience_company_xor` で排他になっている。

## B-3. `company_text` の全件 — 【実質1件のみ】

```
みずほ証券株式会社   （木村雅樹 / 2017-04 〜 2021-10 / 兵庫県明石店 ウェルスマネジメント課）
```

以上1件がすべて。自由入力はほとんど使われておらず、マスタ紐付けが機能している。

## B-4. 2社以上の経歴を持つユーザー — 【データ不足】

| 定義 | 人数 |
|---|---|
| 経歴レコードが2件以上 | **3人**（生藤・木村・大塚。全員実ユーザー） |
| **異なる会社を2社以上**（＝遷移が1本でも作れる） | **2人**（生藤・木村） |

⚠️ 大塚悠貴の3件はすべて同一企業（海光電業）内の部署異動なので、遷移は作れない。

## B-5. 勤務地カラム — **存在しない** 【未実装】

`ow_experiences` の全30列を確認した。勤務地・拠点・都道府県に相当する列は**1つも無い**。

```
id, user_id, company_id, company_text, company_anonymized, role_category_id, role_title,
started_at, ended_at, is_current, description, display_order, created_at, updated_at,
join_reason, employment_type, salary_man, visibility_company, visibility_salary,
visibility_reason, turning_point, exit_reason, rank, visibility_company_profile,
department, salary_base, salary_bonus, salary_stock, learnings, department_id
```

`department` は「第二営業部」「エンタープライズコーポレートセールス本部」のような**組織名**で、勤務地ではない。例外的に「兵庫県明石店 ウェルスマネジメント課」のように地名が混ざっている行が1件あるが、構造化された値ではない。

⚠️ **これが「フルリモート可を在籍者で検証する」の直接の障害。** 在籍者がどこに住んで/どこで働いているかを経歴側から一切引けない。

## B-6. 入社理由 / 退職理由 — 【列はある・ほぼ空】

| 列 | 意味 | 入力件数（14件中） |
|---|---|---|
| `join_reason` | 入社理由 | **4** |
| `exit_reason` | 退職理由 | **0** |
| `turning_point` | 転機 | **0** |
| `learnings` | 学び | **0** |

`visibility_reason`（boolean, NOT NULL）が参照している本体カラムは **`join_reason`**。

⚠️ **`exit_reason` に対応する visibility フラグは存在しない。** `visibility_reason` は1本しかなく、入社理由用。退職理由を公開する場合の可視性制御は未実装。

⚠️ `join_reason` は 2026-08-06 に anon から列単位 GRANT を剥がした列（CLAUDE.md 参照）。

---

# C. 遷移（A社 → B社）を出せるか

## C-1. 前職→次職の組 — 【素材が5組しかない】

`started_at` 昇順で同一ユーザー内の隣接ペアを取った実測。

| 区分 | 組数 |
|---|---|
| 隣接ペア（全部） | **9** |
| うち**会社が変わっている**組 | **5** |
| うち同一社内の異動 | 4 |

内訳（すべて実ユーザー）:

| # | from | to | 時期 |
|---|---|---|---|
| 1 | 富士フイルムビジネスイノベーションジャパン | セールスフォース・ジャパン | 2022-07 |
| 2 | セールスフォース・ジャパン | フライル | 2024-02 |
| 3 | フライル | セールスフォース・ジャパン | 2026-07（出戻り） |
| 4 | みずほ証券（`company_text`） | セールスフォース・ジャパン | 2021-11 |
| 5 | セールスフォース・ジャパン | 伊藤忠テクノソリューションズ | 2025-08 |

## C-2. from・to の両方が `company_id` で解決できる組 — **4組**

上表の #4 のみ from が `company_text`（みずほ証券がマスタに無い）のため脱落。残り4組はマスタ同士で結べる。

## C-3. 「出身企業」「行き先」を出すコード — 【部分的：行き先のみ・個人単位】

| 機能 | 状態 |
|---|---|
| 「この会社に**来た**人の出身企業」 | ❌ **存在しない**。コード上どこにも無い |
| 「この会社を**出た**人の行き先」（集計） | ❌ **存在しない** |
| 「この会社を出た人の行き先」（**OB個人カードに1件ずつ**） | ✅ **実装済み** |

実装は [queries.ts:1429-1462](src/lib/supabase/queries.ts:1429)。OB/OG に該当するユーザーの `is_current = true` の経歴を引き、`currentCompanyName` / `currentCompanyBrandName` / `currentRoleTitle` に載せる。描画は [CompanyEmployeeSections.tsx:644-663](src/app/(jobseeker)/companies/[id]/CompanyEmployeeSections.tsx:644)。

⚠️ **これは1人1行の表示であって集計ではない。** 「A社を出た人の行き先トップ3」のような集約・可視化は無い。

⚠️ `/career-trajectories`（キャリア軌跡の公開ページ）は**現在リポジトリに存在しない**。`ow_career_profiles` テーブルは残っており1件（`is_published = true`）、`ow_experience_stories` は0件。

## C-4. AlumniSection / CurrentEmployeesSection が取得している項目 — 【実装済み】

両者とも [queries.ts:1306 `getCompanyEmployees()`](src/lib/supabase/queries.ts:1306) の戻り値 `CompanyEmployee` を使う。

| 項目 | 出どころ | Current | Alumni |
|---|---|---|---|
| `userId` / `name` / `avatarInitial` / `avatarGradient` / `avatarUrl` | `ow_users` | ✓ | ✓ |
| `birthYear`（`birth_date` の年） | `ow_users` | ✓ | ✓ |
| `catchphrase` | `ow_users` | ✓ | ✓ |
| `canCasualMeeting` | `ow_users` | ✓ | ✓ |
| `visibility` | `ow_users` | ✓ | ✓ |
| `roleTitle` | `ow_experiences` | ✓ | ✓ |
| `startedAt` / `endedAt`（YYYY-MM） | `ow_experiences` | 開始のみ | ✓ 両方 |
| `roleCategoryId` / `roleCategoryName` / `roleParentId` / `roleParentName` | `ow_roles` | ✓ | ✓ |
| `currentRoleTitle` / `currentCompanyName` / `currentCompanyBrandName` | 退職後の現職 | — | ✓ **Alumni のみ** |

取得していない（＝掛け合わせに使えない）もの: **勤務地**（列が無い）、**入社理由 / 退職理由**、**年収**、**部署**（`department` は SELECT していない）。

除外ロジック:
- `visibility_company = 'hidden'` を除外（本人の非公開希望を優先）
- `ow_company_hidden_experiences`（企業側が伏せた行）を除外
- `is_test = true` / `visibility = 'private'` を除外
- ユーザー単位で重複排除。現役に居る人は OB から外す

---

# D. 企業マスタ

## D-1. 総数と内訳 — 【実装済み】

| | 件数 |
|---|---|
| `ow_companies` 総数 | **85** |
| `is_published = true` | **76** |
| `is_published = false` | **9** |
| `is_approved = true` | 77 |
| `is_approved = false` | 8 |

CHECK 制約 `check_published_requires_approval`（`is_published = false OR is_approved = true`）があるため、公開76社はすべて `is_approved = true`。

`status`（別軸・既定 `'pending'`）: pending 80 / active 3 / draft 2。
`listing_status`（enum）: 全85件 `listed`。

## D-2. `industry`（text）の全値 — 【綴りゆれ 実質なし・粒度ゆれあり】

| industry | 社数 |
|---|---|
| AI・データ | 12 |
| クラウドインフラ | 12 |
| CRM・営業支援 | 10 |
| コラボレーション | 8 |
| セキュリティ | 8 |
| HR・人材 | 7 |
| ハードウェア・半導体 | 7 |
| 経理・財務 | 7 |
| マーケティング | 4 |
| **IT / SaaS** | **2** |
| マーケットプレイス | 2 |
| 開発者ツール | 2 |
| コマース・EC | 1 |
| ヘルスケア | 1 |
| 金融 | 1 |
| **電設資材・卸売業** | **1** |

計16値・NULL 0件。**綴りゆれ（表記違いの重複）は無い。** ただし粒度が揃っていない：`IT / SaaS`(2社) は他の全カテゴリの上位概念で、`電設資材・卸売業`(1社・海光電業) は IT/SaaS 業界ですらない。

⚠️ 別に `industry_id`（FK → `ow_industries`）と `saas_category_id`（FK → `ow_saas_categories`）の**構造化列も存在する**が、検索は text の `industry` を見ている（[companies.ts:104-112](src/lib/search/companies.ts:104)）。`lib/search/industryGroups.ts` の `resolveIndustryFilter()` が UI のグループキー → text 値の配列に変換している。

## D-3. `location` の全値 / 都道府県の構造化 — 【未実装（構造化なし）】

| location | 社数 |
|---|---|
| **東京都** | **76** |
| (NULL) | 3 |
| 東京都渋谷区 | 2 |
| 大阪府 | 1 |
| 東京都中央区 | 1 |
| 東京都文京区 | 1 |
| 東京都港区 | 1 |

**都道府県を構造化して持つカラムは無い。** `location` は自由記述の text で、「東京都」と「東京都渋谷区」が混在している。

関連する列:

| 列 | 型 | 状態 |
|---|---|---|
| `location` | text | 上表 |
| `headquarters_address` | text | **0/85 件**（CLAUDE.md の充填表と一致） |
| `branch_locations` | text[] | 28/85件（機械投入。検索は `PREF_TO_BRANCH_KEYS` 経由でここも見る） |
| `nearest_station` | text | — |

検索側は [companies.ts:88-102](src/lib/search/companies.ts:88) で `location ILIKE '%東京都%'` + `branch_locations` の配列包含という文字列マッチで代用している。

⚠️ **実質すべて「東京都」なので、勤務地での絞り込みは現状ほぼ機能しない。**

## D-4. `remote_work_status` の件数 — 【ほぼ空・検証不能】

| 値 | 社数 |
|---|---|
| **(NULL)** | **83** |
| `full_remote` | 2 |
| `hybrid` | 0 |
| `on_site` | 0 |

CHECK 制約は `full_remote / hybrid / on_site / other` の4値。

⚠️ CLAUDE.md の記録どおり、2026-07-27 に `archive/156` が一括投入した `hybrid`（74社）を出典なしとして除去した結果がこれ。**「フルリモート可」と名乗っている企業は2社しかなく、残り83社は不明。** 検証以前に主張が存在しない。

## D-5. 求人側の勤務地 — 【企業単位・求人単位の両方にある】

`ow_jobs` に `location`（text）・`work_style`（text）・`remote_work_status`（text）の3列がある。**企業単位と求人単位の両方で持っている。**

実データ（全20件）:

| status | location | work_style | remote_work_status | is_test | 件数 |
|---|---|---|---|---|---|
| published | 東京都 | hybrid | hybrid | false | **5** |
| draft | 東京都 | hybrid | (null) | false | 13 |
| draft | (null) | (null) | (null) | true | 2 |

⚠️ **公開求人は5件しかない**（CLAUDE.md の「公開求人18件」は古い。13件が draft に落ちている）。そして**勤務地は全件「東京都」・勤務形態は全件 hybrid** で、値の分散がゼロ。絞り込み軸として機能していない。

## D-6. 求職者が企業を作成できる経路 — 【存在する（API のみ／UI は biz 側）】

| 経路 | 状態 |
|---|---|
| `POST /api/biz/companies` | ✅ **ログインさえしていれば誰でも作成できる**。ロール判定なし（[route.ts:25-37](src/app/api/biz/companies/route.ts:25) は `auth.getUser()` の有無だけ見る） |
| UI | `/biz/auth/signup` 経由の企業登録フォーム。**`/biz/auth` と `/biz/auth/signup` は middleware の公開パス**なので求職者アカウントでも到達できる |
| 求職者側の経歴入力から | ❌ **できない**。オンボーディングと `/profile/edit` はマスタ検索にヒットしなければ `company_text`（自由入力）として保存するだけ（[OnboardingClient.tsx:179-182](src/app/onboarding/OnboardingClient.tsx:179)）。`POST /api/jobseeker/experiences` は `ow_companies` に INSERT しない |
| 管理者 | `/admin/companies` |

作成される行は `status: 'draft'` / `is_published: false` / `plan: 'free'` / **`slug` なし**。

## D-7. name / normalized_name / ドメインの UNIQUE 制約 — 【未実装】

`pg_constraint` と `pg_indexes` の実測。

| 対象 | UNIQUE |
|---|---|
| `name` | ❌ **無い** |
| `normalized_name` | ❌ **列そのものが存在しない** |
| ドメイン（`url`） | ❌ 無い |
| `slug` | ✅ `ow_companies_slug_idx`（`UNIQUE ... WHERE slug IS NOT NULL` の部分インデックス） |
| `id` | ✅ PK |

アプリ側にのみ重複チェックがある（[route.ts:76-81](src/app/api/biz/companies/route.ts:76)）:

```js
.from("ow_companies").select("id, name").eq("name", name).maybeSingle()
```

⚠️ **完全一致のみ**で、正規化（法人格・全半角・スペース）をしていない。「株式会社Ａ」と「A株式会社」は別物として通る。
⚠️ **`force_create: true` を送ると重複チェックごとスキップされる。**
⚠️ `.maybeSingle()` なので、既に同名2件が存在すると**この検査自体がエラーになる**。

## D-8. 統合用の列（`canonical_company_id` 相当） — 【未実装】

`ow_companies` の全144列を確認した。`canonical_company_id` / `merged_into_id` / `duplicate_of` に相当する列は**存在しない**。重複が発生した場合に統合する仕組みは無い。

⚠️ 参考：職種マスタ `ow_roles` には `merged_into_id` があり、実際に「セールスエンジニア」等5件が統合済み。**同じ設計が企業マスタには無い。**

## D-9. `slug` は NULL 可か / 自動生成 — 【自動生成は未実装】

| | |
|---|---|
| NULL 可 | ✅ 可（`is_nullable: YES`、既定値なし） |
| 実データ | 85件中 **1件が NULL**（株式会社データプール、2026-07-23 作成） |
| DB トリガー | ❌ `pg_trigger` に**非内部トリガーは0件** |
| アプリ側の生成 | ❌ 無い。`POST /api/biz/companies` の INSERT に `slug` が含まれていない。`slugify` 相当のヘルパーもリポジトリに存在しない |

⚠️ **API 経由で作った企業は slug が付かない。** 既存84件に slug があるのは migration で個別に入れたため。今後 API で作られる企業は UUID URL のままになる。

## D-10. 非公開企業の詳細ページ / 経歴の会社名リンク — 【実装済み】

**404 になる。** 本番実測：

```
/companies/third-box    → 404
/companies/fujifilm-bi  → 404
```

判定は [queries.ts:670 `getCompanyBySlugOrId()`](src/lib/supabase/queries.ts:670)（`NODE_ENV !== 'development'` のとき `is_published` で絞る）。

経歴タイムラインの会社名は、[timeline.ts:161](src/lib/utils/timeline.ts:161) が

```js
const resolvedCompanyId = (r.company_id && companyInfo && companyInfo.isPublished !== false) ? r.company_id : null;
```

で `is_published = false` の企業を **`company_id: null` に落とし、リンクではなくテキスト表示**にする。

⚠️ **これは実務上とても効いている。** 経歴に出てくる6社のうち **4社が `is_published = false`**（海光電業・伊藤忠テクノソリューションズ・フライル・富士フイルムBI）。つまり**経歴に出る会社の3分の2はページが存在せず、テキスト表示のまま行き止まり**になっている。

| 経歴に出る企業 | is_published | 経歴数 | 人数 |
|---|---|---|---|
| セールスフォース・ジャパン | ✅ true | 6 | 3 |
| 海光電業 | ❌ false | 3 | 1 |
| 伊藤忠テクノソリューションズ | ❌ false | 1 | 1 |
| フライル | ❌ false | 1 | 1 |
| 富士フイルムビジネスイノベーションジャパン | ❌ false | 1 | 1 |
| 日本ヒューレット・パッカード | ✅ true | 1 | 1 |

---

# E. 職種マスタの穴

`ow_roles` は2階層。トップレベル **17件**、子 **126件**（うち `merged_into_id` 付きの統合済みが6件）。

## E-1. 非IT大分類7件の配下職種（全件） — 【実装済み・1件だけ空】

| 大分類 | 子 | 配下職種 |
|---|---|---|
| **医療・介護・福祉** (`healthcare`) | 6 | 医師 / 看護師 / 薬剤師 / 介護福祉士 / 理学療法士・作業療法士 / その他医療・介護・福祉 |
| **建設・不動産** (`construction`) | 5 | 施工管理 / 建築設計 / 土木設計 / 不動産営業 / その他建設・不動産 |
| **製造・技術** (`manufacturing`) | 5 | 研究・開発 / 生産技術 / 生産管理 / 品質管理 / その他製造・技術 |
| **教育・研究** (`education`) | 4 | 教員 / 講師・トレーナー / 研究員 / その他教育・研究 |
| **販売・サービス** (`retail-service`) | 4 | 販売スタッフ / 店長 / 店舗管理 / その他販売・サービス |
| **金融・保険** (`finance`) | 4 | 個人営業・FP / アナリスト / 金融事務 / その他金融・保険 |
| **公務・その他** (`other`) | **0** | ⚠️ **子が1件も無い** |

非IT配下の合計は **28件**。

⚠️ **`公務・その他` は「その他◯◯」すら持たない空のカテゴリ。** トップレベルとしては選べるが、その下に何も無い。他の16カテゴリはすべて「その他◯◯」を持っているので、ここだけ形が違う。

## E-2. 「美容師」「調理・飲食」「ドライバー・配送」「警備・清掃」— **4つとも存在しない** 【未実装】

143件の職種名を全件確認した。該当する職種も、それを含む語（美容 / 理容 / 調理 / 飲食 / 運転 / ドライバー / 配送 / 物流 / 警備 / 清掃）も**1件もヒットしない**。

### 追加先の提案（※実装はしていない）

| 職種 | 提案する大分類 | 理由 |
|---|---|---|
| **美容師**（＋理容師・エステ・ネイル） | `販売・サービス` に追加 | 対面の個人向けサービス業で、既存の「販売スタッフ / 店長 / 店舗管理」と同じ店舗型の働き方。新カテゴリを作るほどの量ではない |
| **調理・飲食**（調理師・ホール・店舗運営） | `販売・サービス` に追加 | 同上。店長・店舗管理は飲食でもそのまま流用できる |
| **ドライバー・配送**（＋倉庫・在庫管理） | **新規トップレベル「物流・運輸」** を作る | `販売・サービス` にも `製造・技術` にも収まらない。倉庫・輸送・配送は隣接職種が多く、1つの分類にまとまる量がある。`公務・その他` に押し込むと「その他」がゴミ箱化する |
| **警備・清掃**（＋設備管理・ビルメンテナンス） | **新規トップレベル「警備・清掃・設備」** か、量が読めないうちは `販売・サービス` に暫定追加 | 施設運営という括りでは `建設・不動産` に近いが、あちらは設計・施工・売買の職種で運営職が無い |

⚠️ 追加するなら以下も同時に決めること。
- **`公務・その他` に子を1つも作らない現状を先に直す**か、逆にこのカテゴリを畳むか。分類を増やす前に空カテゴリの扱いを決めないと、また同じ形が増える
- 新トップレベルを足すと**オンボーディングの選択肢（現在17件）が増える**。CLAUDE.md「オンボーディングの現状」の「トップレベルのみを出す」設計にそのまま影響する
- CLAUDE.md「UI / API / DB の CHECK を3つ揃える」の対象。`ow_roles` は CHECK ではなくテーブルなので migration 1本だが、`getVisibleRoles()` の business / non-business の振り分け（[JobsClient.tsx:536](src/app/(jobseeker)/jobs/(list)/JobsClient.tsx:536)）と `/people` の職種フィルタ定数も同時に見ること

---

# F. 希望条件

## F-1. `ow_profiles` の全カラムと入力率 — 【希望勤務地は未実装】

全25列（`ow_profiles` 総数 **39件**）:

| カラム | 型 | 入力件数 | 備考 |
|---|---|---|---|
| `id` / `user_id` | uuid | 39 | `user_id` は **auth 空間** |
| `name` / `name_kana` | text | — | |
| **`location`** | text | **0** | ⚠️ 下記参照 |
| `job_type` | text | 6 | 日本語文字列 |
| `experience_years` | text | — | |
| `desired_salary_min` / `_max` | integer | 3 | |
| `desired_work_style` | text | 2 | remote/hybrid/onsite の**働き方**。勤務地ではない |
| `desired_work_styles` | text[] | 2 | 上の配列版 |
| `desired_phase` | text[] | 3 | |
| `transfer_timing` | text | 2 | |
| `transfer_timing_updated_at` | timestamptz | — | |
| `skills` / `tools` | text[] | — | |
| `bio` / `photo_url` | text | — | |
| `worry` | text | — | |
| `onboarding_completed` | boolean | — | |
| `scout_enabled` | boolean | — | 39人中 true は3人（CLAUDE.md 記載） |
| `email_weekly_enabled` / `email_scout_enabled` | boolean | NOT NULL default true | |
| `created_at` / `updated_at` | timestamptz | — | |

**希望勤務地に相当するカラムは存在しない。**

⚠️ **`ow_profiles.location` は列としては存在するが、実データ0件・書き込むコードも無い。** `/profile/edit` の「所在地」欄が保存するのは `ow_users.location` のほう（[ProfileEditClient.tsx:2825](src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx:2825) → `PUT /api/jobseeker/profile` → [profile/route.ts:58-60](src/app/api/jobseeker/profile/route.ts:58) が `ow_users` を更新）。**`ow_profiles.location` は事実上の死蔵列**で、CLAUDE.md の「`profile_setup_at` は書くコードがどこにも無い」と同じ形。

⚠️ `ow_profile_desired_roles`（希望職種の多対多、6件）も確認したが `user_id / role_id / is_primary` のみで、勤務地は無い。

## F-2. `ow_users` 側の居住地／勤務地 — 【居住地のみ実装済み・入力率 低】

| カラム | 型 | 入力件数 |
|---|---|---|
| `ow_users.location` | text | 全体 **5/26**、**実ユーザー 4/5** |

UI は `/profile/edit`「基本情報」の **「所在地」**（hint: 「現在お住まいの都道府県を選択してください。」[ProfileEditClient.tsx:3052](src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx:3052)）。プロフィール完成度の判定項目 `hasLocation` にも入っている。

実データ:

| 氏名 | location |
|---|---|
| 大塚悠貴 | 埼玉県 |
| 柴 久人 | 東京都 |
| 生藤 弘樹 | **京都府京都市** |
| 福永陽貴 | 東京都 |
| （柴 久人 / is_test） | 東京都 |

⚠️ hint は「都道府県を選択」と言っているが「京都府京都市」が入っている。**都道府県として正規化されていない自由テキスト**。企業側 `location` と同じ問題（D-3）。

⚠️ 勤務地（今どこで働いているか）に相当する列は `ow_users` にも無い。

## F-3. 居住地・現職勤務地・希望勤務地のうち持っているもの — 【1/3 のみ】

| 概念 | 保持しているか | 実体 | 入力率 |
|---|---|---|---|
| **居住地** | 🟡 **ある（自由テキスト）** | `ow_users.location` | 実ユーザー 4/5 |
| **現職の勤務地** | ❌ **無い** | — | — |
| **希望勤務地** | ❌ **無い** | — | — |

⚠️ 「関西で働けて、商社出身の人がいるIT企業」を出すには **3つとも必要**（関西で働ける＝求人/企業の勤務地 + 本人の居住地または希望勤務地、商社出身＝経歴の会社属性）。現状は居住地1つだけで、しかも構造化されていない。

---

# G. 検索の現状

## G-1. 実際に見ているカラム — 【実装済み・企業属性のみ】

### `/companies`（[src/lib/search/companies.ts](src/lib/search/companies.ts)、サーバー側 PostgREST）

| 条件 | 見ているカラム |
|---|---|
| フリーワード `q` | `name` / `description` / `industry` / `tagline` を **ILIKE OR**。スペース区切りで AND（[:74-84](src/lib/search/companies.ts:74)） |
| `phase` | `phase`（`PHASE_FILTER_MAP` 経由で `.in()`） |
| `workStyle` | `remote_work_status` |
| `location` | `location` ILIKE ＋ `branch_locations` 配列包含 |
| `industry` | `industry`（`resolveIndustryFilter()` で `.in()`、未知値は ILIKE） |
| `hiring` | `ow_jobs.status = 'published' AND is_test = false` の存在 |
| `foreign` | アプリ側判定 |
| `salaryMin` | 求人給与の中央値からアプリ側で算出 |
| `sort` | `updated_at` / `employee_count` / 求人数 / 給与 / 開示充実 |

### `/jobs`（[JobsClient.tsx:800-1005](src/app/(jobseeker)/jobs/(list)/JobsClient.tsx:800)、**クライアント側**でフィルタ）

| 条件 | 見ているカラム |
|---|---|
| フリーワード `q` | 求人 `title` / 企業 `name` / `brand_name` / `slug` / 求人 `catch_copy`。加えて `ow_role_aliases` の辞書で職種 ID にも当てる |
| 職種 | `ow_jobs.role_category_id`（祖先展開済みの `roleIds`） |
| 勤務形態 | `work_style` |
| 年収 | `salary_max` |
| 業種 | 企業の `industry` |
| 都道府県 | `ow_jobs.location` から `extractPrefecture()` |
| 雇用形態 | `employment_type` |
| 企業ステージ | 企業の `phase` |

⚠️ **どちらにも「在籍者の経歴」を条件にする項目は無い。**

### `/people`（[lib/people/directory.ts](src/lib/people/directory.ts) + [PeopleListClient.tsx](src/app/(jobseeker)/people/PeopleListClient.tsx)）

フィルタは **職種（トップレベル）・年齢・キーワード・ソート** のみ。企業属性でも勤務地でも絞れない。

## G-2. フリーワードを条件に変換する仕組み（LLM 等） — 【未実装（ルールベースのみ）】

**LLM 呼び出しは存在しない。** `openai` / `@anthropic-ai` / `embedding` / `pgvector` / `gpt-` / `claude-` を `src` と `package.json` に対して grep して0件。

代わりにルールベースの解決層が2つある。

| 仕組み | 場所 | 内容 |
|---|---|---|
| 検索語のルーティング | [search/page.tsx](src/app/(jobseeker)/search/page.tsx) | ① `ow_roles` 名 + `ow_role_aliases` に当たれば `/jobs?q=` ② 企業名・ブランド名・slug に当たれば企業へ ③ どちらでもなければ `/companies` |
| 職種の言い換え辞書 | `ow_role_aliases` | 「法人営業」→ 営業系 role_id など |
| 解釈できない語の扱い | [JobsClient.tsx:872-881](src/app/(jobseeker)/jobs/(list)/JobsClient.tsx:872) | どの求人にも当たらない語は絞り込みから外し、`ignoredTerms` として画面に「絞り込みに使わなかった語」と出す。全語が外れたときだけ0件 |

⚠️ `companies.ts` の冒頭コメントに「Phase 4: LLM によるクエリ解釈」が将来案として書かれているが未着手。

## G-3. 企業の属性と在籍者の経歴を同時に条件にできる検索 — **存在しない** 【未実装】

これが本調査の中心的な欠落。

| 面 | 企業属性で絞れるか | 在籍者の経歴で絞れるか |
|---|---|---|
| `/companies` | ✅ フェーズ・業種・勤務形態・勤務地・年収・募集有無 | ❌ |
| `/jobs` | ✅ 職種・年収・勤務形態・都道府県・雇用形態・ステージ・業種 | ❌ |
| `/people` | ❌ | 🟡 **職種のみ**（年齢・キーワードも可） |

在籍者データが企業側に流れているのは**表示のための集計値2つだけ**（[companies.ts:160-209](src/lib/search/companies.ts:160)）:

- `liveCurrentCountMap` … 現役の人数
- `liveObogCountMap` … OB/OG の人数

**この2つは絞り込み条件にも並び替えにも使われていない**（カードに数字を出すだけ）。

⚠️ 「A社出身者が在籍する企業」「関西在住の在籍者がいる企業」のような**逆引き（人 → 企業）の経路が1本も無い**。

## G-4. 0件のときの挙動 — 【部分的】

| 画面 | 空状態 | 条件の緩和提案 |
|---|---|---|
| `/companies` | ✅ 「条件に合う企業が見つかりませんでした / 検索キーワードを変えるか、絞り込み条件を減らしてみてください」＋「すべての企業を見る →」「面談受付中の企業を見る」（本番で `?q=zzzzqqqnothing` を実測） | ❌ 一般的な文言のみ |
| `/jobs` | ✅ 「条件に合う募集が見つかりませんでした / 条件を緩めるか、企業から探してみてください」＋「すべてリセット」「企業一覧へ」（[JobsClient.tsx:1595-1625](src/app/(jobseeker)/jobs/(list)/JobsClient.tsx:1595)） | ❌ 同上 |
| `/jobs` の語の無視 | ✅ **これだけは具体的**。解釈できなかった語を `ignoredTerms` として画面に明示する | 🟡 部分的（無視した語は分かるが、どの条件を外せば何件になるかは出ない） |

⚠️ **「この条件を外すと N 件」のような動的な緩和提案は無い。** どちらもリセットボタンと別ページへの誘導だけ。

---

# H. 面談まわり

## H-1. `can_casual_meeting = true` の実ユーザー数 — **1人** 【データ不足】

| | 人数 |
|---|---|
| `ow_users.can_casual_meeting = true`（全体） | 2 |
| **うち実ユーザー** | **1** |
| うち is_test | 1 |

⚠️ **切り替えは運営のみ。** [admin/candidates/CanCasualMeetingToggle.tsx](src/app/admin/candidates/CanCasualMeetingToggle.tsx) が唯一の更新経路で、本人が `/profile/edit` から設定する UI は無い。

参考（関連フラグ）: `can_talk_to_candidates` = **0人**、`can_talk_to_hr` = **0人**。

企業側の受付フラグ:

| | 社数 |
|---|---|
| `accepting_casual_meetings = true` | 5 |
| **うち `is_published = true`**（＝実際に導線が出る） | **2** |

## H-2. 枠数・期限・一時停止 — 【一時停止のみ実装済み。枠数・期限は未実装】

| 概念 | 実体 | 状態 |
|---|---|---|
| **一時停止** | `ow_companies.accepting_casual_meetings`（boolean） | ✅ 企業単位の on/off。`/biz/company` から切替 |
| **一時停止（個人）** | `ow_users.can_casual_meeting`（boolean） | 🟡 あるが**運営しか切り替えられない** |
| **枠数（月N件まで等）** | — | ❌ **存在しない** |
| **期限（申込期限・有効期限）** | — | ❌ **存在しない** |
| 対応可能な曜日・時間帯 | `availability_days` / `availability_times` / `availability_notes` | 🟡 列と `/biz/company` の入力欄はある（[lib/business/company.ts:45-47](src/lib/business/company.ts:45)）が、**入力済み 0/85社**。予約枠ではなく自由記述のヒント |

⚠️ **スカウトには枠の仕組みがある**（`ow_scout_quotas.used_this_month` を `trg_guard_scout` が加算）が、**面談には同等のものが無い**。非対称。

## H-3. `ow_company_members` の招待経路 — 【ほぼ未使用】

| | 件数 |
|---|---|
| 総行数 | **6** |
| `invited_by` あり | **1** |
| `invited_at` あり | **1** |
| `invite_token` あり | 6（既定で採番される） |
| `display_consent = true` | 4 |
| `is_public = true` | 4 |

⚠️ **企業の招待フローを通ったのは6件中1件だけ。** 残り5件は運営が直接作った行。[lib/people/directory.ts:38-42](src/lib/people/directory.ts:38) にも「公開中の4件はすべて `invited_at` / `invited_by` が空＝運営が直接作った行」「この kind を根拠に『確認済み』と表示しないこと」と明記されている。

⚠️ したがって `Affiliation.kind = "verified"` は**企業が在籍を確認した意味ではない**。この命名のまま UI に「確認済み」を出さないこと。

---

# 未実装のもの 一覧

「実装されていない／実質機能していない」ものだけを、実装規模と他への影響とともに並べる。

## 中核価値に直結するもの

| # | 未実装のもの | 規模 | 他への影響 |
|---|---|---|---|
| 1 | **`ow_experiences` の勤務地カラム** — 在籍者がどこで働いているかを持っていない | **小**（列追加 + 入力UI + 表示）| 「フルリモート可の検証」「関西で働ける」の**前提**。`/profile/edit` の職歴エディタ・`POST /api/jobseeker/experiences`・`CompanyEmployee` 型・タイムライン表示に波及。**可視性フラグ（`visibility_location` 相当）を同時に設計しないと、居住地の露出になる** |
| 2 | **企業属性 × 在籍者経歴の同時検索** — 人 → 企業の逆引き経路が1本も無い | **大** | 新しい検索層。`/companies` はサーバー側 PostgREST、`/jobs` はクライアント側フィルタと**実装方式が割れている**ので、まずどちらに寄せるかの判断が要る。RLS を跨ぐため `createAdminClient` で集計する設計になり、**公開範囲の再設計とセットになる**（G-3 / A-1） |
| 3 | **希望勤務地** — `ow_profiles` に列が無い | **小** | 週次マッチメール（`lib/matching/scoreJob.ts`）・`/biz/candidates` の絞り込み・`/jobs` のおすすめに波及。`ow_profiles.location`（死蔵列）を使うか新設するかを先に決めること |
| 4 | **現職の勤務地** — どこにも無い | 小 | 1 と同じ列で兼ねられる（`is_current = true` の行の勤務地） |
| 5 | **遷移の集計・可視化**（出身企業 / 行き先ランキング） | **中** | 個人単位の「行き先」は実装済み（C-3）なので、その集計版。ただし**素材が5組しかない**ので、作っても現時点では表示できない。`visibility_company = 'hidden'` と `ow_company_hidden_experiences` の除外をここでも通すこと |
| 6 | **「この会社に来た人の出身企業」** — 逆方向が存在しない | 中 | 5 と同じ基盤。人数が少ないと個人が特定されるため、**最小表示件数のしきい値**を決めないと出せない |

## データ品質・マスタ整備

| # | 未実装のもの | 規模 | 他への影響 |
|---|---|---|---|
| 7 | **都道府県の構造化** — 企業も求人もユーザーも自由テキスト（「東京都」「東京都渋谷区」「京都府京都市」が混在） | **中** | `/companies` の location フィルタ・`/jobs` の `extractPrefecture()`・`branch_locations` の `PREF_TO_BRANCH_KEYS` が全部この上に乗っている。CLAUDE.md「UI / API / DB の CHECK を3つ揃える」の典型例。**移行時に既存値のパースが要る** |
| 8 | **`remote_work_status` の充填** — 85社中83社が NULL | 中（調査作業） | 出典を伴う調査が要る（CLAUDE.md「推測値を投入しない」）。`/companies` の勤務形態フィルタが**現状ほぼ機能していない**のはこれが原因 |
| 9 | **企業名の正規化 / UNIQUE / 統合列** — `normalized_name` も `canonical_company_id` も無く、`name` に UNIQUE も無い | **中** | いま重複が無いのは作成経路が運営に限られているから。**D-6 のとおり求職者アカウントでも `POST /api/biz/companies` で企業を作れる**ので、招待を広げた瞬間に重複が入る。`ow_roles` の `merged_into_id` と同じ設計を持ち込むのが自然 |
| 10 | **企業 slug の自動生成** — API 経由で作ると NULL のまま | **小** | 現在1社が該当。SEO・URL の一貫性。`ow_companies_slug_idx` は部分 UNIQUE なので衝突時のサフィックス採番が要る |
| 11 | **`industry` の粒度統一** — `IT / SaaS`(2社) と `電設資材・卸売業`(1社) が他と同じ階層にいる | 小 | `industryGroups.ts` の8グループへの写像。構造化列（`industry_id` / `saas_category_id`）が既にあるのに text を見ている二重持ちの解消も同時に検討 |
| 12 | **職種マスタの生活サービス系** — 美容師・調理飲食・ドライバー配送・警備清掃が全部無い | 小（分類の判断は要る） | E-2 の提案参照。新トップレベルを足すとオンボーディングの選択肢（現17件）に直接出る |
| 13 | **`公務・その他` の配下が0件** — 17カテゴリ中ここだけ子が無い | **小** | 12 を入れる前にこれを決めないと「その他」がゴミ箱化する |
| 14 | **`exit_reason` の可視性フラグ** — `visibility_reason` は `join_reason` 専用で1本しかない | 小 | 退職理由を公開する機能を作るとき必須。入力自体も0件 |
| 15 | **`ow_profiles.location` が死蔵列** — 列はあるが書くコードが無い（0/39） | 小 | 3 と同時に決める。CLAUDE.md「書かれない列に依存させない」（`profile_setup_at` の前例）と同じ形 |

## 面談・その他

| # | 未実装のもの | 規模 | 他への影響 |
|---|---|---|---|
| 16 | **面談の枠数・期限** — スカウトには `ow_scout_quotas` があるが面談には無い | 中 | 対応可能人数が増えるまでは実害なし（現状 `can_casual_meeting` の実ユーザーは1人）。ただし公開すると**1人に集中する**構造 |
| 17 | **本人が `can_casual_meeting` を切り替える UI** — 運営の `/admin/candidates` からしか変えられない | 小 | 「受け付けをやめたい」を本人が実行できない。CLAUDE.md「設定の意味を後から拡大しないこと」に関わる |
| 18 | **`availability_days` / `_times`** — 列と入力欄はあるが 0/85社、予約枠ではなく自由記述 | 小 | 16 と同時に設計するなら、この列を枠に格上げするか捨てるかを決める |
| 19 | **企業の招待フロー** — `ow_company_members` 6件中 `invited_by` が入っているのは1件 | 中 | 経路自体は存在する（`/api/biz/ambassador/invite`）が通っていない。CLAUDE.md「0件を読むときは、起きなかった0か起こせなかった0かを分ける」の**未検証の0**に該当。動くかどうかを実際に踏んで確かめていない |
| 20 | **検索の動的な条件緩和提案** — 0件時はリセットボタンと別ページ誘導のみ | 小 | `/jobs` の `ignoredTerms`（解釈できなかった語の明示）は既に良い形なので、その延長として「この条件を外すと N 件」を出せる |
| 21 | **フリーワードの意味解釈（LLM / embedding）** — 完全にルールベース | 大 | `companies.ts` 冒頭に Phase 4 として構想あり。ただし **2 より優先度は低い**。条件そのものが持てていない段階で解釈層を足しても出せる答えが増えない |

---

## 補足：この調査で見つかった、指示項目の外にある事実

| 事実 | 根拠 |
|---|---|
| **公開求人が18件 → 5件に減っている** | `ow_jobs`: published 5 / draft 13 / draft(is_test) 2。CLAUDE.md の「公開求人18件」は古い |
| **経歴に出る企業6社のうち4社が非公開** = 経歴のリンクの3分の2が行き止まり | D-10 |
| **`ow_users.location` に同姓同名の重複**（柴 久人が is_test / 非 is_test で2行、どちらも「東京都」） | F-2 の実データ |
| **在籍者数だけは匿名に露出している** | A-3 / `/api/jobseeker/companies/[id]/employees` の実測 |
| **`ow_companies.listing_status` は全85件が `listed`** で、enum を持つ意味が現状ゼロ | D-1 |
| `ow_experience_roles`（6件）は依然として未配線 | CLAUDE.md の記載どおり。今回も `src` から読み書きは見つからず |
