# 横断検索 `/search` 事前調査（Phase 0）

- 調査日: **2026-08-26**
- 対象: 本番 Supabase（実測）＋ `main` の作業ツリー
- **この調査でコード・migration・DB への書き込みは一切行っていない。** SQL は SELECT のみ。
- 数値はすべて実測。確認できなかったものは「未確認」と明記した。

> ⚠️ **`/search` は既に存在する。** ただし結果ページではなく **リダイレクタ**（下記 1-2）。
> 新設ではなく「置き換え」になる。

---

## 1. 既存の検索経路の棚卸し

### 1-1. 検索の入口（UI）と遷移先

| # | 入口 | 実体 | 遷移先 | クエリパラメータ |
|---|---|---|---|---|
| ① | **LPトップの検索窓** | [HeroSearch.tsx:44](src/app/(jobseeker)/HeroSearch.tsx#L44) | **`/search?q=`**（空送信は `/companies`） | `q` |
| ② | **ヘッダーの検索アイコン**（フォーム送信） | [JobseekerHeader.tsx:451](src/components/jobseeker/JobseekerHeader.tsx#L451) | **`/companies?q=`** | `q` |
| ③ | ヘッダー「よく検索されるキーワード」 | JobseekerHeader.tsx:500 | `/companies?q=` | `q` |
| ④ | ヘッダーのサジェスト（企業） | JobseekerHeader.tsx:530 | `/companies/{slug ?? id}` へ**直リンク** | — |
| ⑤ | ヘッダーのサジェスト（求人） | JobseekerHeader.tsx:549 | `/jobs/{id}` へ**直リンク** | — |
| ⑥ | ヘッダー「全件検索」/「結果なし」リンク | JobseekerHeader.tsx:569, 582 | `/companies?q=` | `q` |
| ⑦ | **`/companies` の検索窓** | [CompanySearchBar.tsx:291](src/components/companies/CompanySearchBar.tsx#L291)（300ms デバウンス → `router.push("?…")`） | 同一ページ | `q` `phase` `workStyle` `hiring` `location` `industry` `foreign` `view` `sort` `page` |
| ⑧ | **`/jobs` の検索窓** | [JobsClient.tsx:1197](src/app/(jobseeker)/jobs/(list)/JobsClient.tsx#L1197) | 同一ページ | **URL に書かない**（初期値だけ `?q=` から読む・:743） |
| ⑨ | **`/people` の検索窓** | [PeopleListClient.tsx:832](src/app/(jobseeker)/people/PeopleListClient.tsx#L832) | 同一ページ | **URL に出ない**（純粋な state） |
| ⑩ | 企業ピッカー（職歴エディタ・企業作成・プライバシー設定） | `/api/companies/search` | — | `q` / `domain` / `limit` |
| ⑪ | 企業ピッカー（オンボーディング） | `/api/onboarding/companies/search`（**認証必須・未公開企業も返す**） | — | `q` |

**★ヘッダーの検索アイコンは `/search` に行かない。`/companies?q=` に直行する。**
grep で `/search?q=` を参照しているのは **①の1箇所だけ**。

⚠️ ⑧⑨は **URL にクエリを残さない**ので、検索結果を共有・ブックマークできない。
   ⑧は `?q=` を**読む**が**書かない**という非対称な状態（`setParam()` は `q` を扱わない）。

### 1-2. `/search` の現状（既存・リダイレクタ）

[src/app/(jobseeker)/search/page.tsx](src/app/(jobseeker)/search/page.tsx)（85行・`export const dynamic = "force-dynamic"`）

`resolveDestination(raw)` が入力語から行き先を決めて `redirect()` するだけで、**自身は何も描画しない**。

1. 正規化（全角英数→半角・空白の正規化・小文字化）
2. **職種語に当たるか** — `getRoleTree()` の全職種名 ＋ `getRoleAliases()` の別名（2文字以上）に部分一致 → **`/jobs?q=`**
3. **社名に当たるか** — 掲載中企業の `name` / `brand_name` / `slug` に ilike → **`/companies?q=`**
4. どちらでもない → **`/companies?q=`**

⚠️ ファイル冒頭のコメントに「**言い換えの解決層を後から差し込むときに触る場所がここだけで済む**」と
   既に書いてある。今回の解釈レイヤーはここに入る想定で作られている。

### 1-3. 検索の実装本体

#### `searchCompanies` — [src/lib/search/companies.ts:57](src/lib/search/companies.ts#L57)

```ts
searchCompanies(params: CompanySearchParams): Promise<CompanySearchResult>

type CompanySearchParams = {
  q?: string; phase?: string; workStyle?: "on_site"|"hybrid"|"full_remote";
  hiring?: boolean; location?: string; industry?: string; foreign?: boolean;
  sort?: string; limit?: number; offset?: number;
};
type CompanySearchResult = {
  companies: CompanyForCarousel[];   // src/types/genre.ts:41
  totalCount: number;
  appliedFilters: CompanySearchParams;
};
```

- `q` は**空白区切りの AND**。1語につき **8列の OR ilike**
  （`name` / `name_en` / `brand_name` / `slug` / `search_aliases` / `description` / `industry` / `tagline`）。
- `industry` は **事業領域の slug**（`ai` `crm` …）。`ow_company_business_domains` を先に引いて
  `company_id` の配列にし、`.in("id", …)` として **DB 側の条件**にしている。
  ⚠️ **業種（`ow_industries`）で絞る口は無い。**
- 呼び出し元は2つ：`/companies` ページ本体（フィルタ無しのグリッド用・`limit`/`offset` 付き）と、
  [CompanySearchResults.tsx](src/components/companies/CompanySearchResults.tsx)（Server Component・フィルタ適用時）。
  ⚠️ 後者は `limit` を渡していないので **検索結果はページネーションされない**（全件返す）。

#### `/jobs` のキーワード検索

- サーバー側の `getJobs()` は **公開求人を丸ごと返すだけ**（絞り込みゼロ）。
  `unstable_cache(["jobs-list"], { revalidate: 300 })`。
- 絞り込みは全部 **`JobsClient.tsx:876-1082` の `useMemo`＝ブラウザ側 JS**。
- キーワードは語ごとに「**本文一致 ∪ 辞書一致**」を取り、語をまたいで AND：
  - 本文一致 `matchesText`（:906）… `role` / 企業 `name` / `brand_name` / `slug` / `highlight` の `includes`
  - 辞書一致 `matchByAlias`（:933）… `roleAliases` の alias に部分一致 → `roleIds` → 求人の `roleIds`（**祖先展開済み**）に含まれるか
- **どの求人にも当たらなかった語は絞り込みから外し**、`ignoredTerms` として画面に出す（:1392）。
  全語が当たらないときだけ 0件。
  ★**この「落とした語を黙って捨てず画面に出す」設計は、そのまま解釈レイヤーに持ち込むべき。**

#### `/people` の検索

- サーバー側の `getDirectoryPeople(isLoggedIn)` が **全員返す**
  （`unstable_cache(["directory-people"], { revalidate: 1800, tags: ["directory-people"] })`）。
- 絞り込みは **`PeopleListClient.tsx:578` の `useMemo`＝ブラウザ側 JS**。
- 検索対象は **4つだけ**：`name` / 所属企業名（学歴の人は学校名）/ 所属の役職名 / `roleName`。
  ⚠️ **職種辞書（`ow_role_aliases`）を使っていない。** 「セールス」で 営業 の人は引けない。
     `/jobs` と `/search` は辞書を使うので、**同じ語で挙動が割れている。**

#### `/api/search/suggest` — [route.ts](src/app/api/search/suggest/route.ts)

`force-dynamic`。`q`（最大100字）。返す形：

```json
{ "companies": [{ "id","slug","name","logo_letter","logo_gradient","industry" }],   // 最大4件
  "jobs":      [{ "id","title","job_category","roleLabel" }] }                       // 最大4件
```

- `industry` は **主の事業領域名**（`ow_business_domains.name`）。列 `ow_companies.industry` ではない。
- 企業は `name/name_en/brand_name/slug/search_aliases` の5列 ilike ＋ `filterListedCompanies`。
- 求人は `title` ilike ＋ 職種辞書一致（`getJobRoleMap()` を全件走査して `expandWithAncestors`）。

### 1-4. 「条件組み立て」と「DB を引く」の分離状況

| 経路 | 分離 | 絞り込みの実行場所 |
|---|---|---|
| `searchCompanies` | 同一関数内だが **条件は PostgREST のクエリに載る** | **サーバー（RSC）** |
| └ 例外 `hiring` / `foreign` / `sort=disclosure` | — | **サーバー上の JS**（この3つが付くと `useDbPagination=false` になり全件取得してから絞る） |
| `/jobs` | **分離なし。** サーバーは全件返すだけ | **ブラウザ JS** |
| `/people` | **分離なし。** サーバーは全件返すだけ | **ブラウザ JS** |
| `/api/search/suggest` | ルート内にベタ書き | サーバー（Route Handler） |
| `/search`（現ルータ） | `resolveDestination()` に分離済み | サーバー（RSC） |

★**構造化条件を受け取れる形になっているのは `searchCompanies` だけ。** 求人・人には受け皿の関数が無い。

---

## 2. 構造化条件の受け皿として使える語彙の実測

すべて **2026-08-26 本番実測**。「掲載79社」＝ `listing_status='listed' AND is_published AND is_test IS NOT TRUE`。

### 2-1. 職種（`ow_roles` / `ow_role_aliases`）

| | 件数 |
|---|---|
| `ow_roles` 全件 | **154** |
| うち有効（`is_active` かつ `merged_into_id IS NULL`） | **148** |
| └ 大分類（`parent_id IS NULL`） | **18** |
| └ 子 | **130**（孫は無い。2階層） |
| `ow_role_aliases` | **260** |
| `getRoleAliases()` が返す辞書語数 | **414**（別名260 ＋ 職種名154） |

⚠️ **CLAUDE.md は「トップレベルは17件（2026-08-10 実測）」と書いているが、実測は 18。**

大分類18件と、その配下の別名数：

| 大分類 | slug | 子 | 配下の別名 |
|---|---|---|---|
| 経営・CxO | exec | 10 | 17 |
| 事業開発 | bizdev | 6 | 12 |
| 営業 | sales | **12** | **42** |
| カスタマーサクセス | cs | 7 | 18 |
| マーケティング | marketing | 8 | 19 |
| プロダクト | product | 8 | 21 |
| デザイナー | design | 6 | 13 |
| データ・AI | data-ai | 8 | 18 |
| エンジニア | engineer | **14** | **38** |
| コーポレート | corporate | 13 | 29 |
| 医療・介護・福祉 | healthcare | 6 | **0** |
| 建設・不動産 | construction | 5 | **0** |
| 製造・技術 | manufacturing | 5 | **0** |
| 教育・研究 | education | 4 | **0** |
| 販売・サービス | retail-service | 11 | 24 |
| 金融・保険 | finance | 4 | **0** |
| 物流・運輸 | logistics-transport | 3 | 9 |
| 公務・その他 | other | 0 | **0** |

⚠️ **非IT系の6ツリー（医療・建設・製造・教育・金融・公務）には別名が1件も無い。**
   職種名そのものは辞書に入る（`getRoleAliases` が `ow_roles.name` を足すため）ので
   「経理」のような正式名では引けるが、「リテール営業」のような言い換えは当たらない。
⚠️ 別名はすべて**子職種**に付いている。大分類を直接指す別名は0件（意図的。`getRoleAliases` の JSDoc 参照）。

### 2-2. 業種（`ow_industries`）と事業領域（`ow_business_domains`）

`ow_industries` = **20件**。掲載79社の内訳（`industry_id` は **79/79 = 100%** 充填。公開ゲートが必須にしているため）：

| 業種 | 掲載企業 |
|---|---|
| IT・ソフトウェア | **70** |
| 電子機器・半導体 | 7 |
| インターネット・Webサービス | 2 |
| **残り17業種** | **各 0**（電機・機械 / 教育 / 素材・化学 / 運輸・物流 / コンサルティング / 通信 / エネルギー・インフラ / 医療・ヘルスケア / 公共・団体 / 商社・卸売 / 不動産・建設 / その他サービス / 小売・流通 / メディア・広告・エンタメ / 人材サービス / 食品・飲料 / 金融・保険） |

⚠️ **「IT企業」を `industry_id` で絞っても 79社中70社が該当するので、絞りとしてほぼ効かない。**

`ow_business_domains` = **12件**。0社のものは無い（複数持てるので合計は79を超える）：

| 事業領域 | slug | 掲載企業 |
|---|---|---|
| AI・データ | ai | 12 |
| クラウドインフラ | infra | 12 |
| CRM・営業支援 | crm | 10 |
| セキュリティ | security | 8 |
| コラボレーション | collab | 8 |
| ハードウェア・半導体 | hardware | 7 |
| 経理・財務 | finance | 7 |
| HR・人材 | hr | 6 |
| マーケティング | marketing | 3 |
| 開発者ツール | devtools | 2 |
| 業種特化 | vertical | 2 |
| マーケットプレイス | marketplace | 2 |

★**分解能があるのは事業領域のほう。** 業種は「IT かどうか」以上の情報をほぼ持たない。

### 2-3. `ow_companies` の条件に使える列（掲載79社）

| 列 | 充填 | 使えるか |
|---|---|---|
| `industry_id` | **79 / 79** | ○（ただし70社が同じ値） |
| `is_foreign` | true **65** / false **14** / null **0** | ○ **100%・分散もある。いちばん使える** |
| `employee_count` | 79 / 79 | **✕ 全件フリーテキスト**（下記） |
| `location` | 79 / 79 | △ 74社が `"東京都"`（＋`東京都◯◯区` 4社）・`"大阪府"` 1社。**分散がほぼ無い** |
| `branch_locations` (text[]) | 28 / 79 | △ |
| `phase` | 74 / 79（listed 56 / unicorn 11 / non_listed 5 / series_b 1 / series_d 1 / null 5） | ○ |
| `founded_year` (int) | 79 / 79 | ○ |
| `remote_work_status` | **2 / 79** | **✕ 事実上使えない** |
| `capital_type` | 65 / 79 | △ |
| `name_en` | 79 / 79 | ○（表記ゆれ吸収に有効） |
| `search_aliases`（読み仮名） | 28 / 79 | △ |
| `biz_model_types` (text[]) | **1 / 79** | **✕**（SaaS 判定に使いたい列だが空） |
| `business_model` (text) | 81 / 87（全社ベース） | △ 自由記述 |

⚠️★**`employee_count` は数値ではない。** `^[0-9]+$` に一致する行は **0件**。実データ：

```
約200名(12) 約100名(12) 約50名(8) 約300名(7) 約1500名(4) …
1,497名（2026年4月末時点） / 2,300名（グローバル） / 約2000名（日本） / 1600名以上
```

→ **「50人以下」「1000人以上」で絞る条件は、今のスキーマでは書けない。**
   `searchCompanies` にも従業員数の絞り込みは無い（`sort=employees` はこの text 列で ORDER BY している）。

⚠️ **`prefecture` という列は存在しない。** 所在地は `location`(text) 1本 ＋ `branch_locations`(text[])。
   `headquarters_address` は別にあるが CLAUDE.md 実測で **0/76 充填**。

### 2-4. `ow_jobs`

| 列 | 公開のみ（5件） | 全件（20件） |
|---|---|---|
| `salary_min` / `salary_max` | 5 / 5 | 18 / 20 |
| `work_style` | 5 / 5 | 18 / 20 |
| `location` | 5 / 5 | 18 / 20 |
| `employment_type` | 5 / 5 | **20 / 20** |
| `role_category_id` | 5 / 5 | 20 / 20 |
| `ow_job_roles` に行がある求人 | — | 19 / 20 |

⚠️★**充填率は高いが、値に分散が無い。**

- 値のある18件は **全件が `location="東京都"` / `work_style="hybrid"` / `employment_type="正社員"`**。
- **公開5件はすべて 株式会社セールスフォース・ジャパン**。年収（万円）は
  700-1100 / 800-1300 / 900-1800 / 1000-1600 / 1400-2200。

→ **勤務地・勤務形態・雇用形態で絞っても、今のデータでは1件も落ちない。**
  条件としては書けるが、意味を持つのは **年収** と **職種** の2つだけ。

### 2-5. `ow_transitions`

**5行。** `role_change` × `industry_change`（どちらも3値）：

| role_change | industry_change | 件数 |
|---|---|---|
| changed | unchanged | **3** |
| unchanged | unchanged | 1 |
| changed | unknown | 1 |
| （changed × changed） | | **0** |

⚠️ 「異業界に転職した人」は **本番に1人もいない**（2026-08-26 に判定を `industry_id` へ移した結果）。

### 2-6. `ow_experiences`

| | 件数 |
|---|---|
| 全行 | **24**（実人数 **12**） |
| `company_id` あり（マスタ紐づけ） | **18 / 24 = 75%** |
| `company_text` あり（自由入力） | **6 / 24** |
| `company_anonymized` あり | **0** |
| `role_category_id` あり | 24 / 24 |
| `started_at` あり | 24 / 24 |
| `ended_at` あり | 11 / 24 |
| `is_current` | 13 |
| `employment_type` あり | **6 / 24** |

職種の内訳（**22/24 が営業ツリー**）：

```
営業(大分類) 8 / フィールドセールス 6 / エンタープライズセールス 3 / インサイドセールス 2
ソリューションエンジニア・プリセールス 1 / アカウントエグゼクティブ 1
── 営業ツリー外 ──
経営・CxO 1 / コーポレート 1 / 事業企画 1
```

⚠️★**非IT大分類（医療・建設・製造・教育・販売・金融・物流・公務）の職種を持つ行は 0件。**
   マスタには44の子職種があるが、**一度も使われていない。**

`company_id` が引けた18行の企業業種：**IT・ソフトウェア 15行 / 7人**、**商社・卸売 3行 / 1人**。

### 2-7. ユーザーの可視性（人を出すなら効く制約）

| | 件数 |
|---|---|
| `ow_users` 全件 | **38** |
| `is_test = true` | **32** |
| 実ユーザー（is_test でも is_system でもない） | **5** |
| システムユーザー | 1 |
| `visibility = 'login_only'` | **37** |
| `visibility = 'private'` | 1 |
| **`visibility = 'public'`** | **0** |

⚠️ **CLAUDE.md の「実ユーザー14人」は古い。実測5人。**
⚠️ **`public` が0**なので、`visibility === "public"` を要求する経路
   （`getJobPositionMembers`）は今どのクエリでも0件を返す。

---

## 3. 「未経験でIT営業やった人」を今のスキーマで引けるか

**★以下の SQL はすべて SELECT のみ。書き込みは行っていない。**

### 3-A. 「未経験でIT営業やった人」→ **引ける（5人 / 表に出せるのは2人）**

#### 「未経験」の定義（この調査で置いたもの）

> その人の職歴を `started_at` 昇順に並べ、**営業ツリー**（`ow_roles.slug='sales'` とその子12件）の職種で
> **かつ企業の業種が IT・ソフトウェア または インターネット・Webサービス** である行のうち、
> **それより前に営業ツリーの職歴が1件も無い**もの。
> ＝ **「営業デビューが IT 企業だった人」**

```sql
with sales as (
  select id from ow_roles where slug='sales'
  union all select r.id from ow_roles r join ow_roles p on p.id=r.parent_id where p.slug='sales'
),
it_co as (
  select c.id from ow_companies c join ow_industries i on i.id=c.industry_id
  where i.slug in ('it-software','internet-web')
),
ordered as (
  select e.*, row_number() over (partition by e.user_id order by e.started_at) as seq
  from ow_experiences e
),
hit as (
  select o.user_id from ordered o
  where o.role_category_id in (select id from sales)
    and o.company_id in (select id from it_co)
    and not exists (
      select 1 from ordered p
      where p.user_id = o.user_id and p.seq < o.seq
        and p.role_category_id in (select id from sales)
    )
)
select count(distinct user_id) from hit;
```

| | 結果 |
|---|---|
| 全ユーザー | **5人** |
| うち `is_test=false` かつ `visibility <> 'private'` | **2人** |

#### 引けるが、以下は原理的に取りこぼす

1. **`company_text`（自由入力）6/24 は業種が引けない。** 実データにも
   `株式会社AAA` / `株式会社HR Tech` / `株式会社アグース` / `株式会社ゼクイース` / `株式会社TYU` が含まれ、
   これらは **IT かどうかを判定できないので必ず落ちる**（推測で埋めない）。
2. **「IT」を `industry_id` で取ると絞りにならない。** 掲載79社の70社が `it-software`。
   実質「営業デビューの人」と同義になる。事業領域で取ると分解能は上がるが、
   `ow_experiences` の企業が事業領域を持っているとは限らない。
3. **「未経験」を表す列は存在しない。** 求人側に「未経験可」フラグは無く、
   本人側にも申告フィールドが無い。**職歴の並びから導出するしかない**（＝職歴1件の人は判定不能）。
4. `ow_transitions` は使えない。5行しかなく、`role_change='changed'` は
   「直前と職種が違う」であって「その職種が未経験」ではない。

### 3-B. 「年収800万以上のSaaS営業（募集）」→ **年収と営業は引ける。SaaS だけ引けない**

| 条件 | 件数 |
|---|---|
| 公開求人 `salary_max >= 800` | **5**（＝公開全件） |
| 公開求人 `salary_min >= 800` | **4** |
| 上記 ＋ 営業ツリー（`ow_job_roles` 経由） | **3** |
| 上記 ＋ 営業ツリー（`role_category_id` 経由） | **3**（一致） |

⚠️ **「800万以上」を下限で読むか上限で読むかで 4件 / 5件 に割れる。** 先に決める必要がある。

**SaaS は語彙が無い：**

| 探した先 | 結果 |
|---|---|
| `ow_business_domains` に "SaaS" | **0件** |
| `ow_industries` に "SaaS" | **0件** |
| `ow_companies.biz_model_types` | 列はあるが **掲載79社中 1社**しか値が無い |
| `ow_companies.business_model` | 81社に値があるが**自由記述**（正規化されていない） |
| `ow_jobs.business_model` | 18/20 だが同じく自由記述 |

→ **今は「SaaS」を条件として受け取る先が無い。**
   公開5件が全部セールスフォースなので結果は偶然一致するが、**条件が効いているわけではない。**

### 3-C. 「関西で商社出身の人がいるIT企業」→ **SQL は書けるが答えは 0件**

```sql
with kansai_pref as (select unnest(array['大阪府','京都府','兵庫県','奈良県','滋賀県','和歌山県']) p),
     kansai_branch as (select unnest(array['大阪','京都','兵庫','奈良','滋賀','和歌山','神戸']) b),
     listed as (select * from ow_companies
                where listing_status='listed' and is_published and coalesce(is_test,false)=false),
     kansai_co as (
       select c.* from listed c
       where exists (select 1 from kansai_pref k where c.location like k.p || '%')
          or exists (select 1 from kansai_branch k where k.b = any(coalesce(c.branch_locations,'{}')))),
     shosha_users as (
       select distinct e.user_id from ow_experiences e
       join ow_companies c2 on c2.id = e.company_id
       join ow_industries i on i.id = c2.industry_id
       where i.slug = 'trading-wholesale')
select count(distinct k.id) from kansai_co k
  join ow_experiences e on e.company_id = k.id and e.is_current
 where e.user_id in (select user_id from shosha_users);
```

| | 結果 |
|---|---|
| 関西に拠点がある掲載企業 | **29社**（うち**本社が関西なのは `株式会社irodas`（大阪府）1社だけ**。残り28社は東京本社＋大阪支社） |
| 商社出身の登録者（`trading-wholesale` の在籍歴あり） | **1人**（`海光電業株式会社`・`is_test=false` / `login_only`） |
| **答え** | **0件** |

引けない理由はスキーマではなく **データ**：関西29社に在籍する登録者がほぼおらず、商社出身が1人しかいない。

#### ⚠️★この過程で見つけた、実害の出る罠

**`'東京都' LIKE '%京都%'` は `true`。**

実測で `location ~ '(大阪|京都|兵庫|奈良|滋賀|和歌山)'` は **掲載79社の全件にマッチした**
（`東京都` が `京都` を含むため）。同じ理由で `branch_locations` 側も 28/28 全件にマッチした。

- 現行の `searchCompanies` は無事。location フィルタは `PREF_TO_BRANCH_KEYS` と
  **正式な都道府県名**（`"京都府"`）でしか引かないため。
- **危ないのは解釈レイヤー。** LLM が「関西」→「京都」のような**短い語**を吐いて
  `ilike '%京都%'` に流すと、**東京の74社が丸ごと「京都の企業」として返る。**
  しかもエラーは出ず、件数が多いだけなので**正常に見える。**

→ **解釈レイヤーの出力は、必ず都道府県の正式名（または列挙型）に正規化してから渡すこと。**
   自由文字列を `ilike` に素通しする経路を作らない。

---

## 4. 解釈レイヤーを挟む位置

### 4-1. 既存関数にそのまま渡せるか

| 対象 | 受け皿 | そのまま渡せるか |
|---|---|---|
| 企業 | `searchCompanies(CompanySearchParams)` | **ほぼ渡せる**（下記4点を除く） |
| 求人 | **無い**。`getJobs()` は全件返すだけ | **✕**（絞り込みは `JobsClient` の `useMemo` の中） |
| 人 | **無い**。`getDirectoryPeople(isLoggedIn)` は全件返すだけ | **✕**（絞り込みは `PeopleListClient` の `useMemo` の中） |

`searchCompanies` に足りないもの（＝シグネチャを変える必要がある点）：

| # | 足りないもの | 直し方 |
|---|---|---|
| ① | **職種で絞れない** | `roleIds?: string[]` を足し、`ow_experiences` / `ow_job_roles` から `company_id` を解決して `.in("id", …)` に載せる（`industry`（事業領域）が既にこの形なので、同じやり方でよい） |
| ② | **業種で絞れない**（`industry` は事業領域 slug） | `industryIds?: string[]` を足す。**`industry` の意味を変えない**（既存の被リンクが `?industry=ai` の形で生きている） |
| ③ | `location` が生文字列 | `prefectures?: string[]`（正式名のみ）に変える。3-C の京都問題の対策 |
| ④ | 従業員数レンジで絞れない | **列がフリーテキストなので、スキーマを変えないと不可能**（2-3 参照） |

⚠️ `hiring` / `foreign` / `sort=disclosure` を渡すと `useDbPagination=false` になり
   **ページネーションが効かなくなる**。横断検索で件数を出すなら、ここは先に直すか避けるかを決める。

### 4-2. 解釈結果の型（案）

```ts
export type SearchIntent = {
  targets: ("company" | "job" | "person")[];
  roleIds?: string[];        // ow_roles.id（祖先展開は呼び出し側）
  industryIds?: string[];    // ow_industries.id
  domainSlugs?: string[];    // ow_business_domains.slug
  prefectures?: string[];    // ★正式な都道府県名に正規化済み。生文字列を入れない
  salaryMin?: number;        // 万円
  isForeign?: boolean;
  phases?: string[];
  hiring?: boolean;
  freeText?: string;         // 語彙に落ちなかったが本文一致には使える語
  unresolved: string[];      // ★語彙に無くて落とした語。画面に必ず出す
};
```

★**`unresolved` を返すのが要点。** `/jobs` の `ignoredTerms` が既にこの設計で、
「解釈できなかった語を黙って無視しない」ことが画面に出ている。同じ約束を横断検索でも守る。

### 4-3. 3つの結果型を1つにまとめられるか

まとめない方がよい。`CompanyForCarousel`（30項目）/ `Job`（`src/app/jobs/mockJobData.ts:28`・40項目超）/
`DirectoryPerson`（15項目）は**共通のフィールドが実質ゼロ**で、1つの型に潰すと全部 optional になり
「値が無い」と「取っていない」が混ざる（CLAUDE.md の `?? ""` と同じ形）。

**判別可能ユニオンにする：**

```ts
type SearchHit =
  | { kind: "company"; item: CompanyForCarousel }
  | { kind: "job";     item: Job }
  | { kind: "person";  item: DirectoryPerson };

type SearchResults = {
  hits: SearchHit[];
  counts: { company: number; job: number; person: number };
  intent: SearchIntent;
};
```

カードは既存の `CompanyCardList` / `JobsClient` の求人カード / `PeopleListClient` のカードを
`kind` で出し分ける。**新しいカードを作らない**（表示ルールが2実装に割れる）。

⚠️★**`person` を混ぜるときの制約（先に決めないと作れない）**
- `/people` は **middleware でログイン必須**（`src/middleware.ts:54`）
- `robots.ts` で **Disallow**、`metadata.robots` も `index:false`
- `ow_users.visibility` は **37/38 が `login_only`**、`public` は **0**
→ **未ログインの `/search` に人を出してはいけない。** 出すなら件数だけか、ログイン誘導にする。

### 4-4. LLM 呼び出しをどこに置くか

**現状の前提（実測）：**
- `package.json` の依存に **`@anthropic-ai/sdk` も `openai` も無い**。
- `src` / `.env*` に **`ANTHROPIC_*` / `OPENAI_*` / `LLM_*` の参照は0件**。
- **SDK の追加から始まる。**
- 使えるもの：`src/lib/rateLimit.ts`（Upstash Redis 併用の IP レートリミッタ。
  資格情報が無ければ**インメモリにフォールバック**する）。

**置き場所の見立て：**

| 案 | 評価 |
|---|---|
| **`/search` の Server Component から `interpretQuery()` を直接 await** | **これが第一候補。** 1往復少なく、解釈→検索→描画がサーバー内で完結する。現行の `/search` が既に `resolveDestination()` を await する形になっているので、そこを差し替えるだけ |
| Route Handler `src/app/api/search/interpret/route.ts` | 「入力中にプレビューを出す」など**ページ描画と別のタイミング**で解釈が要るときに足す。`/api/search/suggest` が既にあり検索系 API はここに集まっている。`rateLimit.ts` も Route Handler 前提 |
| Server Action | **採らない。** POST のたびにページの RSC を巻き込み、キャッシュも効かせにくい |

⚠️ **どちらでもレートリミットは必須。** `/search` は未ログインで叩けて、LLM は呼ぶたびに課金される。
   `src/lib/rateLimit.ts` を通すこと。ただし **Upstash の資格情報が無いとインメモリ＝インスタンスごと**なので、
   本番で効かせるなら環境変数の有無を先に確認すること（未確認）。

⚠️ **解釈結果はキャッシュできる。** 同じクエリ文字列に対して決定的なので `unstable_cache([q])` に載せてよい。
   **ただし中で `createNoStoreAdminClient()` を呼ばないこと**（CLAUDE.md「`unstable_cache` の中で
   no-store のクライアントを使わない」。`getJobs()` が同じ理由で `createAdminClient()` を使っている）。

⚠️ **プロンプトに載せる語彙の取得に追加往復は要らない。**
   `getRoleTree()` / `getRoleAliases()` は `unstable_cache`（revalidate 3600）＋ react `cache()` 済み。

---

## 5. 検索ログの受け皿

### 5-1. 現状：**存在しない**

`information_schema.tables` を `%search%` / `%query%` / `%log%` / `%event%` / `%analytic%` で引いた結果、
出たのは **`ow_contact_logs` の1つだけ**。列は
`id / company_id / actor_user_id / candidate_user_id / job_id / action_type / metadata / created_at` で、
**企業→候補者のアクション記録**であり検索とは無関係。

アプリ側にも無い：`posthog` / `gtag` / `mixpanel` / `plausible` の参照は **src に0件**、依存にも無い。
入っている計測は **Sentry のみ**（エラー用）。

→ **いま「何が検索されたか」を知る手段が一切ない。**
   LLM 解釈は当たり外れがある前提の仕組みなので、**外したことを後から確認できないと直せない。**
   ログは実装と同時に入れるべき。

### 5-2. 列案（`ow_search_logs`）— ★このテーブルは作っていない。設計案のみ

| 列 | 型 | 備考 |
|---|---|---|
| `id` | `uuid` PK | |
| `created_at` | `timestamptz NOT NULL default now()` | |
| `user_id` | `uuid` **NULL 可** → `ow_users(id)` | ⚠️ **`auth.uid()` ではなく `ow_users.id` 空間**。列名で空間を示すか、コメントに明記する |
| `session_id` | `text` NULL | 未ログインの追跡用（匿名 cookie ID） |
| `raw_query` | `text NOT NULL` | 入力そのまま |
| `intent` | `jsonb` NULL | 解釈結果（`SearchIntent`） |
| `unresolved` | `text[]` NULL | **語彙に無くて落とした語。ここが辞書拡充の入力になる** |
| `interpreter` | `text` NULL | モデル名＋プロンプト版。差し替えの前後比較に要る |
| `interpret_ms` | `int` NULL | |
| `result_counts` | `jsonb` NULL | `{"company":n,"job":n,"person":n}` |
| `clicked_kind` | `text` NULL | 別テーブルにしない（クリックは0〜1回が大半） |
| `clicked_id` | `uuid` NULL | |
| `clicked_at` | `timestamptz` NULL | |

### 5-3. 未ログインの扱い

**`user_id` は NULL 可にする。**
`/search` の入口は **LP のヒーロー検索**なので、**未ログインが主**になる。
`NOT NULL` にすると、いちばん見たい層のログが丸ごと落ちる。

⚠️ 権限は `ow_transitions` と同じ形にするのが素直：
**`anon` / `authenticated` に GRANT しない。読むのは admin クライアントだけ。**
書き込みは Route Handler / Server Component から service role で INSERT する。
**anon に INSERT を開けない**（誰でも書き込めるテーブルになる）。

⚠️ `raw_query` には**個人情報が入りうる**（「◯◯社の△△さん」のような入力）。**保持期間を決めること。**

⚠️ クリックは `clicked_*` を後から UPDATE する形にすると、`lib/supabase/mutate.ts` の
`mutateOne`（0行更新をエラーにする）でそのまま書ける。

---

## 6. 既存の制約・注意点

### 6-1. キャッシュの現状（実測）

| 対象 | 設定 |
|---|---|
| `/companies`（一覧） | **`dynamic` の宣言なし。`searchParams` を読むので暗黙に動的** |
| `fetchAvailablePhases` / `fetchDistinctLocations` / `fetchCompanySuggestions` / `fetchCurrentMembersByCompany` | `unstable_cache` **revalidate 300** |
| **`searchCompanies` 本体** | **キャッシュなし**（毎リクエスト DB） |
| `/jobs`（一覧） | **`export const dynamic = "force-dynamic"`** |
| `getJobs()` | `unstable_cache(["jobs-list"], { revalidate: 300 })` |
| `/people` | **`export const dynamic = "force-dynamic"`** |
| `getDirectoryPeople` | `unstable_cache(["directory-people"], { revalidate: 1800, tags: ["directory-people"] })` |
| `/search`（現ルータ） | **`export const dynamic = "force-dynamic"`** |
| `getRoleTree` / `getRoleAliases` / `getAllRoleRows` | `unstable_cache` **revalidate 3600** ＋ react `cache()` |
| `/api/search/suggest` | `force-dynamic` |

**見立て：**

- **`/search` は `force-dynamic` のままにする。** クエリごとに結果が変わるので ISR の余地が無い。
- **キャッシュするのは「解釈」と「語彙」。** `interpretQuery(q)` は決定的なので
  `unstable_cache` に載せて課金を減らせる。語彙は既に 3600 秒でキャッシュ済み。
- ★**`/jobs` の ISR 失敗を繰り返さない。** [jobs/(list)/page.tsx:10-33](src/app/(jobseeker)/jobs/(list)/page.tsx#L10) に
  「`revalidate` を足したら `useSearchParams()` のせいで**実HTMLから求人が全部消えた**
  （73,088字 → 11,526字 / 求人リンク 5件 → 0件）。**ビルドも tsc も lint も通る**」という記録がある。
  `/search` を動的のままにするなら踏まないが、**将来「人気クエリだけ事前生成」をやるなら、
  結果の描画をサーバーコンポーネントに置くこと**（クライアントの `useSearchParams()` の内側に置かない）。

### 6-2. CLAUDE.md の既知の罠に抵触しそうな箇所

| # | 罠 | 検索実装で当たる場所 |
|---|---|---|
| ① | **`unstable_cache` の中で no-store のクライアントを使わない** | `interpretQuery` や `searchJobs` を `unstable_cache` に載せる場合、中から `createNoStoreAdminClient()` を呼ばない。**ビルドは通り、その項目だけ黙って消える。** `getJobs()` が同じ理由で `createAdminClient()` を使っている（[queries.ts:1068](src/lib/supabase/queries.ts#L1068)） |
| ② | **supabase-js の fetch キャッシュ / 閲覧者依存** | `searchPeople` を作るなら、**ログイン有無をキャッシュキーに入れる**。`getDirectoryPeople(isLoggedIn)` は引数がキーに入る形になっている。ここを固定すると `login_only` の人が未ログインに漏れる |
| ③ | **`?? []` で error を握りつぶさない** | 検索は **「0件」が正常な返答**なので、**403 と本当の0件がいちばん区別しにくい画面**。`error` を必ず受けて `console.error` する |
| ④ | **anon の列単位 GRANT** | `ow_users`（23/33列）/ `ow_experiences`（21/35列）/ `ow_career_profiles`（5/9列）は **anon が列単位**。select に許可外の列を1つ足すと **クエリ丸ごと 403 → 静かに0件**。人を出す経路で `birth_date` / `email` などを足さないこと |
| ⑤ | **可視性ヘルパーを通す** | 企業は `filterListedCompanies` / `filterVisibleCompanies`。**`.eq("is_published", true)` を直書きしない** |
| ⑥ | **人の可視性は `getDirectoryPeople` に集約されている** | `private` 除外・`login_only` はログイン時のみ・`is_test`/`is_system` 除外。**新しい取得経路を書かず、この関数を通す** |
| ⑦ | **`mapCompany` の第4引数（事業領域）** | 企業を求職者に出す**新しい経路**を作るときは `domains` まで渡す。省略可能引数なので **tsc も lint も通り、画面が「事業領域 —」になるだけ**（2026-08-26 に実際に踏んでいる） |
| ⑧ | **`?? ""` の後の `??` は発火しない** | 検索結果カードで `industry` / `highlight` にフォールバックを重ねない |
| ⑨ | **PostgREST の `.or()` インジェクション** | 既存3箇所（`searchCompanies` / `suggest` / `companies/search`）はいずれもメタ文字を除去してから埋め込んでいる。**LLM の出力を `.or()` に流すときも同じ処理を通す** |
| ⑩ | **`'東京都' LIKE '%京都%'`** | 3-C 参照。**解釈結果の都道府県は正式名に正規化してから渡す** |

### 6-3. noindex の要否 → **要る**

`/search` に **`export const metadata = { robots: { index: false, follow: false } }` を付けるべき。** 理由：

1. **クエリ文字列ごとに無限に URL が生える**うえ、中身は `/companies` `/jobs` `/people` の再掲。
   **重複コンテンツになる。**
2. **`/people` は既に robots.ts で Disallow ＋ `metadata.robots.index:false` ＋ middleware でログイン必須。**
   横断検索に人を混ぜて `/search` だけ index されると、この方針が破れる。
3. `raw_query` がそのまま URL に出るので、**個人名を含む URL がインデックスされうる**。

**現状：`robots.ts` の disallow に `/search` は入っていない。sitemap にも無い。**
今はリダイレクタなので実害が無いだけ。**結果ページにするなら同時に足す。**

⚠️ **`robots.ts` の Disallow だけでは足りない。** Disallow するとクロールされず、
   **meta の noindex が読まれない**（既にインデックスされた URL が消えない）。
   **`metadata.robots` を先に付ける。** `/people` は両方付いている（`page.tsx` の `metadata` と `robots.ts`）。

---

## 実装フェーズで最初に決めるべき論点（3つ）

### ① `/search` に「人」を出すか。出すなら未ログインでどうするか

`ow_users.visibility` は **37/38 が `login_only`**（`public` は **0**）。`/people` は
**middleware でログイン必須・robots Disallow・`metadata.robots.index:false`**。
一方で `/search` の入口は **LP のヒーロー検索＝未ログインが主**。

この一点で、**結果型・ページのキャッシュ方針・noindex の扱い・ログの `user_id` NULL 許容**が全部決まる。
選択肢は「企業と求人だけにする」「人は件数だけ出してログインに誘導する」「ログイン時のみ人を混ぜる」。

### ② 語彙に無い条件を、落とすのか足すのか

実測で受け皿が無いことが確定したもの：

| 条件 | 状態 |
|---|---|
| **SaaS** | `ow_industries` / `ow_business_domains` に0件。`biz_model_types` は **1/79** |
| **従業員数レンジ**（「50人以下」） | `employee_count` は **79/79 がフリーテキスト**。数値列が存在しない |
| **未経験可** | 求人にも本人にもフラグが無い。職歴の並びから導出するしかない |
| **非IT職種の言い換え** | 医療・建設・製造・教育・金融・公務の6ツリーに **別名0件** |

→ **`unresolved` として画面に返す**（`/jobs` の `ignoredTerms` と同じ設計）なら**今日から作れる**。
   **語彙を足す**なら migration が要る（列追加・データ投入・`ow_role_aliases` の拡充）。
   **両方やる場合でも「まず落とす」を先に実装しないと、語彙を足す優先順位を決めるデータが取れない。**

### ③ `/jobs` と `/people` の絞り込みをサーバーへ移すか、`/search` 用に別実装を作るか

現状、**求人と人には「条件を渡して引く関数」が存在しない。**
どちらもサーバーは全件返し、絞り込みは丸ごと **クライアントの `useMemo`** の中にある。

`/search` から使うには `searchJobs()` / `searchPeople()` を新設することになるが、
**そこで既存画面も乗り換えないと、同じ絞り込みが2実装に割れる。**
実際 `/people` の検索は職種辞書を使っておらず、`/jobs` と**既に挙動が割れている**
（「セールス」で `/jobs` は営業配下の求人が出るが、`/people` は0件）。

⚠️ 移すときは `/jobs` の ISR 失敗（6-1）を必ず読むこと。
   **描画をサーバーコンポーネントに移さないまま `revalidate` を足すと、実HTMLからデータが消える。**

---

## 付録：この調査で気づいた既存の不整合（今回は直していない）

| # | 内容 |
|---|---|
| 1 | **CLAUDE.md「トップレベルは17件」→ 実測 18件** |
| 2 | **CLAUDE.md「実ユーザー14人」→ 実測 5人**（`ow_users` 38人中 `is_test=true` が32人） |
| 3 | `/jobs` は `?q=` を**読むが書かない**（`setParam` が `q` を扱わない）。検索結果を共有できない |
| 4 | `/people` の検索が**職種辞書を使っていない**。`/jobs` `/search` と同じ語で挙動が割れる |
| 5 | `/companies` の**検索結果はページネーションされない**（`CompanySearchResults` が `limit` を渡さない） |
| 6 | `ow_companies.remote_work_status` は **2/79** しか無いのに `searchCompanies` の `workStyle` フィルタが生きている |
| 7 | `'東京都' LIKE '%京都%'` — 現行コードは無事だが、短い地名を `ilike` に流す経路を作ると壊れる |
