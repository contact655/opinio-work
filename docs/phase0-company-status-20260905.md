# フェーズ0調査: `ow_companies.status` の CHECK 欠落

調査日: 2026-09-05 ／ **読み取りのみ。書き込み・migration の作成／適用はしていない。**

---

## 0. 要約

| 値 | 社数 | 何なのか |
|---|---|---|
| `pending` | **91** | **DB の DEFAULT。** 明示的に書いているコードは存在しない |
| `draft` | 5 | 企業作成 API が明示的に書く値（`biz_self` 3社 ＋ 検証用2社） |
| `active` | 4 | **2026-05 以前の遺物。** 書き込むコードは src に0件 |

**この列を読んでいるのはアプリではなく RLS。** アプリ側の分岐は**0件**で、
**`status = 'active'` が `is_published` を迂回する第2の公開ゲートとして
RLS に残っている。**

⚠️ **いま漏れてはいない**（実測: anon が読めるのは 90社 ＝ `is_published = true` の90社ちょうど。
`is_published = false` の10社は0件）。`active` の4社が**たまたま全部 `is_published = true`** なので、
`status = 'active'` の節は現時点で冗長なだけ。**「is_published を false にした瞬間に効き始める」形。**

---

## 1. 実データ（2026-09-05 / 100社）

### 1-1. 交差表

| status | listing_status | is_published | is_test | source | 社数 |
|---|---|---|---|---|---|
| `pending` | listed | true | false | migration | **72** |
| `pending` | draft | false | false | migration | 6 |
| `pending` | draft | **true** | false | manual | 4 |
| `pending` | listed | true | false | manual | 4 |
| `pending` | listed | true | false | (NULL) | 4 |
| `pending` | listed | true | false | admin_seed | 1 |
| `draft` | draft | false | false | biz_self | 3 |
| `draft` | draft | false | **true** | (NULL) | 1 |
| `draft` | draft | **true** | **true** | (NULL) | 1 |
| `active` | listed | true | false | (NULL) | 1 |
| `active` | listed | true | false | migration | 1 |
| `active` | draft | true | false | (NULL) | 1 |
| `active` | listed | true | **true** | (NULL) | 1 |

**`pending` が91社。掲載中の72社もすべて `pending`。**
→ **`pending` は「審査待ち」を意味していない。単に既定値のまま誰も触っていない。**

### 1-2. `pending` 以外の9社（全部）

| status | 会社 | listing | published | approved | source | 作成日 |
|---|---|---|---|---|---|---|
| `active` | 株式会社Opinio | listed | true | true | (NULL) | 2026-05-13 |
| `active` | 株式会社エージェント | **draft** | **true** | false | (NULL) | 2026-05-19 |
| `active` | HubSpot Japan株式会社 | listed | true | true | migration | 2026-06-03 |
| `active` | 【テスト】株式会社サンプルワークス | listed | true | true | (NULL) | 2026-09-01 |
| `draft` | 株式会社Third Box | draft | false | false | (NULL) | 2026-06-25 |
| `draft` | 株式会社データプール | draft | **true** | false | (NULL) | 2026-07-23 |
| `draft` | 株式会社TYU | draft | false | false | biz_self | 2026-08-14 |
| `draft` | 株式会社ゼクイース | draft | false | false | biz_self | 2026-08-14 |
| `draft` | 合同会社やめるラボ | draft | false | false | biz_self | 2026-08-29 |

⚠️ **`active` は 2026-05〜06 に集中している**（テスト企業を除く）。
`draft` は `/api/biz/companies` を作った 2026-08 以降に集中。**時期で分かれている。**

⚠️ 【テスト】サンプルワークス（2026-09-01・`active`）を作った migration は見つからなかった。
   **`status='active'` を書く migration も src も存在しない**ので、
   **SQL Editor か MCP から直接 INSERT されたと考えられる**（未確認）。

### 1-3. 列定義

```
status          text          NULL可   DEFAULT 'pending'   COMMENT なし   CHECK なし
listing_status  listing_status_enum  NOT NULL  DEFAULT 'listed'  COMMENT あり  （enum 型が語彙を担保）
is_published    boolean       NOT NULL  DEFAULT true        COMMENT あり
is_approved     boolean       NOT NULL  DEFAULT false       COMMENT あり
```

⚠️ **`status` だけ COMMENT が無い。** 他の3つには「何を意味するか」が書いてある。

---

## 2. 読んでいる箇所 —— ★アプリの分岐は0件。効いているのは RLS だけ

### 2-1. RLS（**ここだけが実際に効いている**）

`ow_companies` の SELECT ポリシーは4本。うち**2本が `status` を参照**している。

| ポリシー | cmd | roles | USING |
|---|---|---|---|
| `ow_companies_public_read` | SELECT | **PUBLIC（anon 含む）** | **`status = 'active'`** |
| `ow_companies_published_read` | SELECT | **PUBLIC（anon 含む）** | **`is_published = true OR status = 'active'`** |
| `ow_companies_own_select` | SELECT | PUBLIC | `auth.uid() = user_id` |
| `ow_companies_member_select` | SELECT | PUBLIC | `auth_is_company_member(id)` |
| `ow_companies_admin_read` | SELECT | authenticated | `auth_is_admin()` |

⚠️★**`ow_companies_public_read` は完全に冗長。** 条件が
`ow_companies_published_read` の OR 節に丸ごと含まれている。**2本を1本にしても意味は変わらない。**

⚠️★**`status = 'active'` は `is_published` を迂回する第2の公開ゲート。**
運営が「ページを取り下げる」つもりで `is_published = false` にしても、
その企業の `status` が `active` なら **anon から PostgREST 経由で読めたままになる。**
`is_published` の COMMENT は「詳細ページが見えるか（404ゲート）」と書いてあるが、
**RLS はそれと違うことを言っている。**

⚠️ ただし**アプリの画面からは漏れない**。求職者側は `filterVisibleCompanies` /
`filterListedCompanies` を通すので、`is_published` で落ちる。
**危ないのは PostgREST を直接叩く経路**（CLAUDE.md「画面は正しく作られていても、
PostgREST を直接叩く経路だけが漏れているのが過去に見つかった穴の共通形」）。

#### 実測（2026-09-05 / anon キーで PostgREST を直接）

```
anon が読める企業 …… 90 社（DB 全体は 100 社）
うち is_published = false …… 0 件
```

**90 = `is_published = true` の90社ちょうど。** つまり
**`status = 'active'` の節は現時点で1行も追加していない**（`active` の4社は全部 published）。
**いま漏れてはいない。**

⚠️ **これを「安全である」と読まないこと。** 該当する状態
（`status='active'` かつ `is_published=false`）の行が**たまたま0件なだけ**で、
運営が 株式会社エージェント（`active` / `listing=draft` / `published=true`）を
取り下げた瞬間に**その1社だけが anon に開いたまま残る。**

### 2-2. src（**分岐は0件**）

`ow_companies` を触っている箇所は 96 か所。そのうち `status` を SELECT しているのは **1 か所だけ**:

```
src/app/api/biz/companies/route.ts:189
  .select("id, name, slug, source, status, created_at, industry_id, url, logo_url")
```

しかも**取った値は応答 JSON にそのまま入れているだけ**で、
呼び出し側（`CreateCompanyClient`）は**その値を一度も読んでいない**。

**`ow_companies.status` で分岐しているコードは src に存在しない。**

⚠️★**この結論を出すまでに検出器を2回直した**（ルール⑱）。
   ① 「次の `const`/`return` まで」で切る正規表現 → `insert` チェーンの末尾にある
      `.select(...)` を取りこぼし、**既知の `source` すら0件**になった
   ② 窓を1500字にしたら、コメントの多い `/api/biz/companies` を**まだ取りこぼした**
   → **既知の当たり（`source`）が出ることを確かめてから `status` の0件を読む。**

### 2-3. migration / scripts

- `20260727000000_baseline.sql` に上記2ポリシーの定義（`archive/001` 由来）
- `scripts/seed-*.mjs` の `.select("id, status, ...")` は **`work_histories` テーブル**で、
  `ow_companies(name)` は埋め込み。**`ow_companies.status` ではない**（偽陽性）

---

## 3. 書いている箇所

| 場所 | 値 | 備考 |
|---|---|---|
| DB の DEFAULT | `'pending'` | **91社はこれ**。誰も明示していない |
| `POST /api/biz/companies` | `'draft'` | 明示 |
| `POST /api/jobseeker/companies` | `'draft'` | 明示（2026-09-05 追加） |
| **`'active'` を書くコード** | — | **src に0件 / migration に0件** |

**遷移させているコードは1つも無い。** 作成時に1回書かれるだけで、その後は誰も変えない。

⚠️★**2026-08-05 に既に書き込み経路が閉じられていた。**
`PUT /api/admin/companies/[id]` の許可リストに残っているコメント:

> `⚠️ 'status' は受け付けない（2026-08-05 に削除）。`
> `ow_companies.status は is_approved / is_published と無関係で、掲載の可否を`
> `何もゲートしていない。唯一の編集UI（企業詳細の公開設定タブ）を撤去したので、`
> `ここも閉じて書き込み経路を無くした。承認は is_approved（企業審査の一覧）。`

**「掲載の可否を何もゲートしていない」はアプリについては正しい。**
⚠️ **ただし RLS の2本は見ていなかった。** そこでは今もゲートしている。

---

## 4. `status` と `listing_status` の関係

**役割は重なっていない。並んでいるのは「片方が死んでいる」から。**

| | `status` | `listing_status` |
|---|---|---|
| 型 | `text`（CHECK なし） | **`listing_status_enum`**（型が語彙を担保） |
| NULL | 可 | **NOT NULL** |
| 既定 | `'pending'` | `'listed'` |
| COMMENT | **無い** | あり |
| src の参照 | **1（応答に詰めるだけ）** | **65** |
| RLS の参照 | **2本** | 0本 |
| 運営の操作UI | **無い**（2026-08-05 に撤去） | **ある**（一覧のトグル） |
| 遷移させるコード | **無い** | ある |

**掲載の3軸は `is_published`（詳細ページ）/ `listing_status`（ディレクトリ）/
`is_approved`（運営の確認）で完結している**（CLAUDE.md「企業ページは作られた時点で見える」）。
**`status` はその3軸のどれとも対応していない。**

→ **不要なのは `status` のほう。** ただし**そのまま DROP はできない**（下記）。

---

## 5. `pending` はいつ・何のために作られたか

**最初のスキーマ（`archive/001_create_tables.sql`）から存在する。**

```sql
CREATE TABLE IF NOT EXISTS ow_companies (
  ...
  status TEXT DEFAULT 'pending',
  plan   TEXT DEFAULT 'free',
  ...
);
CREATE POLICY "ow_companies_public_read" ON ow_companies FOR SELECT USING (status = 'active');
```

**当時の設計は明らか**: 企業は `pending`（＝運営の承認待ち）で生まれ、
運営が `active` にすると公開される。**`status` が唯一の公開ゲートだった。**

その後 `is_published` / `is_approved` / `listing_status` が別々に足され、
**`status` を `active` にする経路は作られないまま**、ポリシーだけが残った。
`archive/031` にも「（既存ポリシー "ow_companies_public_read" は status = 'active' を使用）」
というコメントが残っている。

⚠️ `archive/001` のファイル自体の git 追加日は 2026-07-28（299本を archive/ に移した日）なので、
   **git log からは元の作成日が分からない。** ⚠️ **`draft` は 001 に無い** ——
   `/api/biz/companies` が 2026-08 に書き始めた値。

---

## 6. `ow_jobs.status` の CHECK と、企業側に当てられるか

```sql
CHECK (status IS NULL OR status = ANY (ARRAY['draft','pending_review','published','rejected','private']))
```

**同じ形（NULL 許容＋列挙）は技術的に当てられる。** ただし**当ててはいけない。**

| | `ow_jobs.status` | `ow_companies.status` |
|---|---|---|
| 5値の意味 | **CLAUDE.md に表で書いてある** | **どこにも書かれていない** |
| 遷移させるコード | ある（承認・差し戻し・非公開・再公開） | **無い** |
| 表示側の分岐 | ある（`StatusPill` ほか） | **無い** |

**`ow_jobs` は「意味が決まっている語彙」に CHECK を当てた。
`ow_companies` はまだ意味が決まっていない。** ここに CHECK を当てると、
**根拠の無い3値を正として DB に固定する**ことになる。

---

## 7. ★DROP するときの順序（今回はやらない）

`status` 列に依存しているオブジェクト（`pg_depend` 実測）:

```
policy: ow_companies_public_read
policy: ow_companies_published_read
```

**ポリシーは pg_depend で追跡されている**ので、`ALTER TABLE ... DROP COLUMN status` は
そのままでは通らない（CASCADE を付けるとポリシーごと消える）。

⚠️★**CASCADE で消してはいけない。** `ow_companies_published_read` は
**`is_published = true` の節も持っており、これが anon の唯一の読み取り経路**。
消すと **anon から企業が1社も読めなくなる**（`/companies` の一覧・sitemap・LP が全滅する）。

**正しい順序:**

1. `ow_companies_published_read` を **`USING (is_published = true)`** に書き換える
2. `ow_companies_public_read` を **DROP**（条件が①に含まれるので冗長）
3. anon / 非admin / admin の3者で実測する（**anon が読める社数が 90 のまま変わらないこと**）
4. そのうえで列を落とすか、残すなら **COMMENT で「未使用」と明記**する

⚠️ ②を先にやっても意味は変わらないが、**①を飛ばして列を落とすと anon が全滅する。**

---

## 8. 結論

1. **3値の意味**
   - `pending`（91社） … **意味は無い。DB の DEFAULT のまま誰も触っていない。**
     設計当初（`archive/001`）は「運営の承認待ち」だったが、**その運用は一度も実装されなかった**
   - `active`（4社） … **設計当初の「公開」。** 2026-05〜06 の遺物で、**書き込むコードは0件**
   - `draft`（5社） … `/api/biz/companies` が作成時に書く値。**その後変わらないので、
     「下書き」というより「この API から作られた」の印になっている**
   - ⚠️ **3値とも「いま何を意味するか」を説明した記述はどこにも無い。**
     上は**実データと git / migration の履歴から言えること**で、
     **現在の運用上の意味は「不明」**（そもそも運用されていない）

2. **どちらが不要か → `status` が不要。**
   `listing_status` は enum・NOT NULL・COMMENT あり・src 65箇所・運営のトグルあり。
   `status` は CHECK なし・COMMENT なし・**src の分岐0件**・書き込み経路も2026-08-05 に閉鎖済み。
   **役割は重なっておらず、片方が死んでいるだけ。**
   ⚠️ ただし**そのまま消せない** —— RLS 2本が参照しており、
   うち1本は anon の唯一の読み取り経路を兼ねている（§7）。

3. **CHECK を入れるとしたら何を許すか → ★いま入れない。**
   実データに合わせるなら `NULL / 'pending' / 'active' / 'draft'` だが、
   **それは「意味の分からない3値」を正として固定することになる。**

   **先に決めるべきはこの2つ:**
   - **① `status = 'active'` を RLS から外すか。** 外さない限り、
     この列は「is_published を迂回する公開ゲート」であり続ける。
     **外すのが先で、CHECK はその後**（外せば列は完全に無参照になり、
     そのときは CHECK ではなく **DROP か「未使用」の COMMENT** が答えになる）
   - **② 「運営の承認待ち」という状態を今後使うのか。** 使うなら
     `is_approved`（既に存在し、`check_listed_requires_approval` で効いている）と
     どう違うのかを決める。**使わないなら列ごと不要。**

   ⚠️ **どちらの答えでも「CHECK を張って現状維持」にはならない。**
   この列は「語彙を整える」対象ではなく、**残すか消すかを決める対象**。

---

## 9. ✅ 第2ゲートを塞いだ（2026-09-05 / `20260905080000`）

**やったのは「`status` の節を取り除く」だけ。列は残した。**

| | 変更前 | 変更後 |
|---|---|---|
| `ow_companies_public_read` | `USING (status = 'active')` | **DROP** |
| `ow_companies_published_read` | `USING (is_published = true OR status = 'active')` | **`USING (is_published = true)`** |
| SELECT ポリシー本数 | 5 | **4** |
| `status` を参照するポリシー | 2 | **0** |
| `pg_depend` の `status` 依存 | 2 | **0** |

⚠️★**順序を守った**: ①`published_read` を狭める → ②`public_read` を DROP。
逆順にすると、そのあいだ anon の読み取りが一瞬狭まる。
⚠️★**CASCADE は使っていない。** `published_read` は anon の唯一の読み取り経路。
⚠️★**`listing_status = 'listed'` は足していない。** 足すと anon の可視範囲が
90社 → 83社に狭まる。**影響が別の話**なので独立したタスクにする。

### 9-1. ★塞げたことの実測 —— 検証企業を作って確かめた

現状は該当行が0件なので、**作らないと「塞げた」ことを示せない。**
`is_test` の企業を1社作り、適用の前後で同じ行を測った。

```
【検証】status第2ゲート確認用
  status='active' / is_published=false / listing_status='draft' / is_test=true
```

| | anon が読める企業 | この検証企業を名指しで | `is_published=false` の行 |
|---|---|---|---|
| **適用前** | **91 社** | **読めた**（name / status / is_published が返る） | **1 件** |
| **適用後** | **90 社** | **`[]`** | **0 件** |

掲載中の企業は今までどおり読める（Salesforce を名指しで確認）。

### 9-2. 3者で実測（適用後）

| | 読める企業 | 検証企業 |
|---|---|---|
| anon | **90 社** | `[]` |
| 非admin（`contact+08`） | **90 社** | `[]` |
| admin（`hshiba`） | **101 社**（全件） | 読める（`auth_is_admin()` ポリシー。正しい） |

### 9-3. 画面が変わっていないこと（本番）

| | 変更前 | 変更後 |
|---|---|---|
| `/companies` | 329,175字 / 企業リンク40 | **同一** |
| `/sitemap.xml` | 18,182字 / `<loc>` 110 | **同一** |
| `/`（LP） | 120,219字 / 企業リンク12 | **同一** |
| `/companies/salesforce` | 277,078字 | **同一** |

⚠️ `/companies` は `x-vercel-cache: MISS`（毎回サーバーで作る）なので**生の比較**。
   `/sitemap.xml` と `/` は **HIT**（ISR）だったので、**キャッシュ越しの比較**であることに注意。
   ただしどちらも admin クライアントで引いており、RLS の影響を受けない。

### 9-4. 後片付け

検証企業を削除し、`ow_companies` 100行 ／ anon 90社 ／
`status` の内訳 `pending 91 / draft 5 / active 4` が**作業前と一致**することを確認した。

### 9-5. 残したもの

`status` 列は**残した**。COMMENT に「未使用」と明記してある。
**DROP の可否は [docs/todo.md](todo.md) で別途判断する。**
