# Opinio — Claude 作業ログ

## プロジェクト概要

IT/SaaS 業界に特化したキャリアプラットフォーム。
**求職者側プロダクト（Phase 2 + Phase 4）が 2026-04-24 に 100% 完成。**

- **リポジトリ**: `/Users/hisato/opinio-work/`
- **プレビューサーバー**: `localhost:3000`（`npm run dev` from `/Users/hisato/opinio-work/`）
- **launch.json**: `/Users/hisato/opinio-work/.claude/launch.json`
- **モックHTML + 仕様書**: `/Users/hisato/opinio-mock/`
- **仕様書**: `/Users/hisato/opinio-mock/OPINIO_IMPLEMENTATION_SPEC.md`

---

## 開示充実度スコア 取材データの実態（2026-07-28 確認）

87社中、取材由来データの充足状況（スコア計算に影響する項目）：

| 項目 | 区分 | 件数/社数 |
|---|---|---|
| tagline | 企業入力 | 80/87 |
| description（企業説明） | 企業入力 | 77/87 |
| 福利厚生 | 企業入力 | 2/87 |
| 求人あり | 企業入力 | 8社 |
| 企業ストーリー | 企業入力 | 2社 |
| オフィス写真 | 企業入力 | 1社 |
| capital_type | 取材・機械投入 | 59/87（公開情報から機械投入） |
| branch_locations | 取材・機械投入 | 28/87（公開情報から機械投入） |
| culture_description | 取材 | 7/87 |
| biz_model_types | 取材 | 1/87 |
| market_customer_size | 取材 | 1/87 |
| org_teams | 取材 | 1/87 |
| ow_company_tools | 取材 | 1社 |
| ow_salary_reports（3件以上） | 投稿 | 1社 |

**実態: 取材由来のデータは実質 Salesforce Japan 1社分のみ。**
capital_type / branch_locations は公開情報からの機械投入であり、取材データではない。

スコア最高点は75点（Salesforce Japan）。
取材が進めば第2区分（55pt）が伸び、分布が上方にシフトする。

---

## ⚠️ dev / production 環境差異（2026-07-28 確立）

`is_published` は development ではフィルタされない。
非公開企業の挙動を確認する場合、dev の結果は本番と一致しない。

同様に `login_only` など visibility 系のフィルタも
dev と本番で挙動が異なる場合がある。
**「dev で見えた = 本番で同じ挙動」と判断しないこと。**

---

## ⚠️ ルートキャッシュと Supabase クライアントの判別軸

**DBを更新したのに画面に反映されない場合、まずここを疑う。**

キャッシュは3層ある（静的レンダリング / supabase-js の fetch キャッシュ / `unstable_cache`）。
層ごとに切り分け方も対処も違う。**`export const revalidate` を書いても効いているとは限らない。**

- **`(jobseeker)` 配下で `createAdminClient` を使うページは `revalidate` か `dynamic` の宣言が必須。**
- ⚠️★**`sitemap.ts` も同じ**（2026-08-30 に踏んだ）。宣言が無いと**デプロイしたときだけ**
  更新される（実測: `x-vercel-cache: HIT`）。しかも **`revalidatePath("/sitemap.xml")` を
  呼んでいる箇所は0件**で、**migration で状態を変えた場合は `revalidatePath` 自体が走らない。**
  取り下げた求人・非掲載にした企業のURLを検索エンジンに知らせ続けることになる。
  → `export const revalidate = 3600` を入れてある。
- **`unstable_cache` の中で `cache: "no-store"` のクライアントを使わない。**
  ビルドは失敗せず、**その項目だけ黙って消えたページが生成される。**
- **「効いている」と言う前に応答ヘッダで確かめる。** 宣言値では判断しない。

→ 判別手順・実測値・現在の鮮度設定は [.claude/skills/nextjs-caching/SKILL.md](.claude/skills/nextjs-caching/SKILL.md)

## 企業データの充填状況（2026-08-11 実測 / `/admin/companies/coverage`）

**公開情報から機械的に取れる項目を76社100%にするのが当面の作業。** 取材項目は別。

進捗は **`/admin/companies/coverage`** で見る（運営用・スコア化しない）。
列見出しをクリックするとその項目が空の企業だけに絞れる。空のマスから
`/admin/companies/[id]?tab=...` の該当タブへ直接飛べる。

| 列 | 充填（公開76社） |
|---|---|

| `description` / `employee_count` / `founded_year` | **76**（済） |
| `capital_type` / `parent_company_name` / `parent_company_country` | 各58 |
| `branch_locations` | 28 |
| `capital_notes` | 8 |
| `main_products` / `main_customers` | 各6 |
| `customer_cases` / `global_employee_count` | 各1 |
| `headquarters_address` | **0** |

⚠️ **`logo_url` はこの一覧に入れていない。** ~~76社すべてが Clearbit を指しており表示できない~~
→ **2026-08-16 に Storage へ移行済み**（`69a0e656` / `15c9f88e`）。

実測（2026-08-28 / 公開79社）: **Supabase Storage 77 / Clearbit 0 / NULL 2**
（PKSHA Technology・フライル）。77件すべて実ファイルとして取得でき、
PNG 66 / JPEG 9 / WebP 1 / GIF 1。**「表示できない」問題は解消している。**

⚠️ **残っている問題は別のもの。** 77件のうち **22件が縦横比 1.91:1**
   ——1200×628 / 1024×537 / 2400×1260 など、**OGP画像の規格**。ロゴではない。
   **2026-08-28 に12社を公式の正方形アイコンへ差し替え、残り10社。**

⚠️★**「判読できない」は言い過ぎだった**（2026-08-28 に11社を68px枠に並べて目視）。
   実際には**中央にロゴを置いた単色背景**のものが多く、Salesforce の雲・CISCO・
   SAP Concur・braze・okta・workday・シンカの赤い矢印は **68px でも読める**。
   読みづらいのは MongoDB / Translead / クアルコム。
   **残り10社は差し替えなくても使える**。急ぐ作業ではない。
   ⚠️ 本当の問題は**判読性より不揃い**——白背景の正方形アイコンと色付きの横長バナーが
      同じ一覧に混在すること。

⚠️ **枠のサイズ調整では直らない。** 40px 化の提案は 2026-08-28 にこの理由で不採用にした
   （横長ほど小さくなるので、縮めると差が広がる）。

### ✅ /companies 1ページ目の9社を Salesforce と同じ密度にした（2026-08-13 完了）

対象は **HPE / Ubie / OpenAI / Databricks / SmartHR / Sansan / PKSHA / HubSpot / Datadog**。
**公開情報で埋まる項目はほぼ埋め切った。ここから先はデータ投入では進まない。**

| 何を | 前 | 後 |
|---|---|---|
| サイドバー「企業情報」の表示行数 | **4〜8行** | **7〜11行**（Salesforce は10行） |
| `description` | 全社1段落の塊 | **全社2段落**（改行1つで区切る） |
| `main_products` が空の企業 | 1社（HPE） | **0社**（HPE に8件投入） |
| `customer_cases` | Salesforce 1社のみ | **＋HPE 3件・OpenAI 2件** |
| 表示名の組み立て | 3箇所に別実装・ルールが割れていた | **`lib/companies/displayName.ts` に集約** |

`description` からは**評価語**（「世界最高評価ユニコーン企業のひとつ」「年間成長率30%以上を維持」
「史上最速で1億ユーザーを達成」「〜も強化中」）と**時点の無い数値**を除去した。
Datadog の「NYSE上場」は事実誤りだったので NASDAQ に訂正している。

⚠️ **Datadog の `customer_cases` は意図的に空。** `main_customers` 7社を残すため
   （事例を入れるとフォールバックが効かなくなり顧客リストが画面から消える）。

#### 適用した migration（2026-08-13）

| ファイル | 内容 |
|---|---|
| `20260813061500_fill_company_profile_9_companies.sql` | 住所・最寄駅・代表者・従業員数・資本区分・拠点など |
| `20260813064500_fix_sansan_branch_locations.sql` | Sansan の拠点を6件に訂正 |
| `20260813071000_rewrite_company_descriptions_9.sql` | 本文の2段落化と評価語の除去 |
| `20260813074500_fix_pksha_product_names.sql` | PKSHA Chatbot → ChatAgent |
| `20260813081500_hpe_products_and_customer_cases.sql` | HPE の製品8件、HPE/OpenAI の事例 |
| `20260813093000_fill_name_en_5_companies.sql` | `name_en` が空だった5社 |

#### ⚠️ 残っている差は、データ投入では埋まらない

**Salesforce との差はほぼ丸ごと「取材4項目」と「求人」に集約された。**

| 残っているもの | 9社の状況 | Salesforce | 埋め方 |
|---|---|---|---|
| `benefits`（福利厚生） | **全社0** | 10件 | **取材** |
| `org_teams`（組織体制） | **全社0** | 23件 | **取材** |
| `ow_company_tools`（ツール） | **全社0** | 9件 | **取材** |
| `culture_description` | **全社 NULL** | あり | **取材** |
| 公開求人 | **全社0件** | 5件 | 企業から預かるか、出典付きで投入 |

⚠️ **公開情報で埋められる残りは `customer_cases` の6社ぶんだけ。**
   それ以外を埋めようとすると、必ず取材か企業からの入力が要る。
   **「ページが薄い」を理由に取材項目を推測で埋めないこと。**

⚠️ ~~画面のロゴが出ているのは Google favicon フォールバックのおかげ~~
→ **2026-08-16 の Storage 移行で、この経路は使われなくなった**（2026-08-28 実測）。

`components/common/CompanyLogo.tsx` の Clearbit ドメイン抽出と
`https://www.google.com/s2/favicons?...` フォールバックは**現在1社でも発火しない**
（Clearbit の URL が0件のため）。`naturalWidth <= 16` を失敗扱いにする分岐も同様。
**防御として残してあるだけ。** `lib/utils/companyLogo.ts` の `usableLogoUrl`
（Clearbit を null に潰す判定）も同じ。**消さないが、生きていると思わないこと。**

⚠️ NULL の2社（PKSHA・フライル）は letter フォールバックで出ている。

### ⚠️ `main_products` の書式と、説明文が表示されない件（2026-08-12 実測）

**値は `製品名（説明）` の形で統一している**（全角括弧）。既存15社すべてこの形。

✅ ~~括弧内の説明はカードに表示されていない~~ → **2026-08-12 に解消済み**
   （2026-09-02 に実画面で確認。「SampleWorks Monitor / 設備稼働の可視化」と2行で出る）。
   ⚠️★**この記述は 2026-09-02 まで「捨てられている」のまま残っていた。**
      記録が実装より古くなっていた例。**記録を根拠に判断する前に画面で確かめること。**

⚠️ 括弧を外さないこと。**外すと説明文がそのまま製品名として1行に出る**
   （「SmartHR（クラウド人事労務ソフト）」が丸ごと名前になり、幅で切れる）。

⚠️★**分解の規則は [lib/utils/parenSuffix.ts](src/lib/utils/parenSuffix.ts) に集約した**
   （2026-09-02）。**同じ正規表現を各ファイルに書き写さないこと。**
   福利厚生（`BenefitCard`）でも同じ形が必要になった。割れると片方だけ直る形の不具合になる。

⚠️ **製品が2つの企業ではカードの右側が大きく空く。** 1440px でグリッドは
   946px・5列（各183px）なので、2枚だと 374px しか埋まらず**約6割が空白**。
   SmartHR / Databricks が該当。件数による出し分けは実装していない。

### ⚠️ `main_customers` の除去候補（2026-08-12 記録）

株式会社シンカの `main_customers` に **「3,100社以上（継続率99.7%）」** が入っている。
これは顧客ではなく**実績値**。「主な顧客」のピルとして表示され、
見出しの「N 社」のカウントにも含まれている（4社と表示されるが実際の顧客区分は3つ）。

⚠️ 今回は変更していない。`main_customers` を整えるときに一緒に外すこと。

⚠️ そもそも `main_customers` は `customer_cases` があると**表示されない**
   フォールバック構造。Salesforce は `customer_cases` 8件を持つため、
   `main_customers` の「トヨタ自動車 / ソフトバンク / 楽天グループ」は
   **DB にあるが画面に一度も出ていない**。整える順序は customer_cases が先。

⚠️ **顧客リストを残したい企業には事例を入れない**という判断もありうる。
   Datadog は `main_customers` 7社を残すため `customer_cases` を**意図的に空**にしてある
   （裏の取れた事例が2件程度しかなく、7社リストのほうが情報量が多いと判断。2026-08-13）。

### ⚠️★`main_sales_targets`（主な営業先）は `main_customers` と別物（2026-09-03 追加）

**顧客そのものではなく、顧客企業の中の「どの部署に売るか」。** 粒度が違う。**統合しないこと。**

| 列 | 何が入るか | 例 |
|---|---|---|
| `main_customers` | **顧客そのもの**（企業名・顧客区分） | NTTドコモ / コンビニ・小売チェーン |
| **`main_sales_targets`** | **顧客企業の中の部署** | 営業部 / 人事部 / 情報システム部 |

⚠️ **`main_customers` と違い、`customer_cases` があっても隠れない。**
   あちらは事例のフォールバックだが、こちらは**独立した項目**。出し分けを足さないこと。

⚠️ 描画は**主な製品・サービスと同じカード**（`products-grid` / 183px × 72px / 上限5件）。
   ピルにしない。⚠️ アイコンは `salesTargetStyle`（**部署の語彙**で引く）。
   **`productStyle` を流用しない** ——あちらは製品名前提で「情報システム部」が既定に落ちる。

⚠️ **色は neutral 固定。** 部署ごとの色分けをしない（ui-conventions の「色の役割」）。

⚠️★**グリッドの `<style>` は製品ブロックの外に置いてある。** 中に戻すと、
   **営業先だけを持つ企業でグリッドCSSが出ず、カードが縦1列に落ちる。**

実測（2026-09-03 / 本番）: 値を持つのは **株式会社Opinio 1社**（営業部・人事部・情報システム部）。
同社の `main_customers` は**この移行に合わせて空にした**（柴さんの指示）。
**他8社の `main_customers` は触っていない。**

⚠️ **入力UIは無い。migration でしか入らない**（`customer_cases` と同じ）。

⚠️ 上限（5件）・超過・長文は実データで踏めないので **`/dev/preview/products`** で見る。

### ⚠️ `customer_cases` の書き方（2026-08-13 実測で確定）

**1社あたり3件を基本とする。** 以下はすべて 1280px の実ブラウザで測った値。
次に書く人が同じ計測をしなくて済むように残す。

| 項目 | 目安 | 根拠（実測） |
|---|---|---|
| **件数** | **3件** | 初期表示が3件（`INITIAL_CASES = 3`）。**4件目から折りたたみが挟まる** |
| **`usecase`** | **100字以内** | 100字までカード高さは **159px で一定**。超えると1行（約20px）ずつ伸びる |
| **`result`** | **60字以内** | Salesforce 8件の実測は 26〜67字 |
| **`products`** | **3つまで** | 4つ目からヘッダー行に乗らず独立行になり、カードが**約37px 高くなる** |

⚠️ **`products` キーは必須。** 値が空でよければ `[]` を入れる。
   描画は `c.products.map(...)`（`CustomerCasesClient.tsx`）なので、
   **空配列は安全だが、キーごと省くと `undefined.map` で落ちる。**

⚠️ **4件以上入れると「すべての導入事例を見る（残り N 社）」が挟まり、
   フェードで最後のカードが隠れる。** 3件に収めればこの操作なしで全件読める。
   Salesforce の8件は展開後 約1,400px あり、実際に読まれるのは最初の3件が中心。

⚠️ **製品カードは5件、事例カードは3件**で上限が違う。混同しないこと。

⚠️ 崩れの心配はしなくてよい（実測）。テキストにクランプは無いので**長くしても縦に伸びるだけ**、
   `products` は `flexWrap: wrap` ＋ ピル側 `nowrap` なので**12個でも横にはみ出さない**。
   375px 幅でもはみ出し0件。**上限は「読みやすさ」の話であって、レイアウト破綻の話ではない。**

⚠️ 構造は `name` / `industry` / `usecase` / `result` / `products` の5キー。
   入力UIは無く、**migration でしか入らない**。

### ✅ 出典の記録（2026-08-30 に実装。⚠️ 設計メモから形を変えた）

企業データの項目ごとの出典は **`ow_company_data_sources`**（`(company_id, field)` が主キー）。
実体と語彙は [lib/constants/companySources.ts](src/lib/constants/companySources.ts)。

| | |
|---|---|
| 列 | `company_id` / `field` / `source_kind` / `source_url` / `verified_at` / `note` |
| `source_kind` | `registry`（登記・国税庁）／ `official_site` ／ `company_input` ／ `unknown` |
| 権限 | **運営専用**。RLS 有効・ポリシー0本・anon / authenticated に GRANT 無し（`ow_transitions` と同じ形） |
| 読む画面 | **`/admin/companies/coverage`**（本社のマスに 登/公/社/? の印、上部に内訳） |
| 鮮度 | `COMPANY_SOURCE_STALE_AFTER_DAYS = 365` |

**実測（2026-08-30 / `headquarters_address` 73行）: 登記 42 ／ 公式サイト 30 ／ 不明 1。
うち URL が記録されているのは 55（公式サイト30社中13社のみ）。**

#### ⚠️★設計メモの前提が2つとも実態と違った

メモは「`ow_companies` に `source_urls text[]` を1組足す・別テーブルにしない」だったが、
**実際に埋めてみたら根拠が両方とも崩れた**（メモ自身が「実際に数社埋めてから形を決める」と
書いていたので、これは想定どおりの結論）。

| メモの前提 | 実際 |
|---|---|
| 「1社を**一巡してまとめて埋める**ので出典と項目が1対1にならない」 | **項目ごとのバッチ**だった（住所だけを73社に）。企業単位に1組だと、別項目を別の出所で埋めた日に**混ざる** |
| 「1出典が**複数社にまたがる必然が無い**」 | **国税庁の1サイトが42社にまたがった** |

⚠️ **`ow_companies` に `source_urls` 列を足さないこと。** その案は採らなかった。

#### ⚠️ 分かったことを消さない

- **`registry` と `official_site` は意味が違う。** 登記は**本店**所在地、公式サイトは
  **オフィス**所在地で、一致する保証がない。**同じ住所として扱わない。**
- **`source_url` の NULL は「URLが記録されていない」という事実。** 推測で埋めない。
  ⚠️ **公式サイト由来30社のうち17社は、投入時の migration にURLが残っていない。**
- **`unknown` に URL を持たせない**（DB の CHECK で禁止）。集計でも「URL未記録」に**数えない**
  （二重計上になる）。

⚠️ しきい値の定数は `src/lib/constants/` に置き、画面にハードコードしない
   （`DISCLOSURE_MAX` を表示側に直書きして取り残された前例がある）。

⚠️ 鮮度判定は3つある。**混同しないこと。**
   `src/lib/profile/freshness.ts` の `STALE_AFTER_MONTHS = 3`（**求職者プロフィール**）／
   `companySources.ts` の `COMPANY_SOURCE_STALE_AFTER_DAYS = 365`（**企業データの出典**）／
   求人は `ow_jobs.source_verified_at`（**しきい値の定数はまだ無く、`/admin/jobs` の
   「出典なし（公開中）」タブで見る運用**）。

---

## ⚠️ テストデータは status で表さず `is_test` フラグで分類する（2026-08-11 確立）

**「テスト用だから」という理由で status / 公開フラグの語彙を増やさないこと。**

| テーブル | 列 | 件数（2026-08-11） |
|---|---|---|
| `ow_users` | `is_test` | 26人中20人（archive/276 / 277 で導入） |
| `ow_jobs` | `is_test` | 20件中2件（自社の「テスト」求人） |

### なぜ status を使わないか

自社のテスト求人2件を `private` に逃がす案があったが**採らなかった**。
`private` の意味は「一度公開したものを運営が止めた」であって、テストデータ置き場ではない。
**同日に `active` を削除して status を5値に整理したばかりで、
同じ曖昧さを作り直すことになる。**

「下書きである」ことと「テストデータである」ことは**別の軸**。軸が2つあるなら列も2つ持つ。

### 扱い方

| 場所 | 扱い |
|---|---|
| 公開側のクエリ | `.eq("is_test", false)` で除外（22箇所） |
| `/admin/jobs` | 他のタブから外し、**専用の「テスト」タブで必ず見えるようにする** |

⚠️ **完全に隠さないこと。** 見えなくすると「見えていないだけ」を自分で作ることになる。
   2026-08-11 に `/admin/jobs` が20件中13件を表示できていなかったのと同じ形。

⚠️ 公開側の除外は**防御的**。現状の2件は `draft` なので既に出ていないが、
   誰かが誤って公開した瞬間に効く。

---

## ⚠️ 「0件」を読むときは、起きなかった0か起こせなかった0かを分ける（2026-08-11 確立）

**0件を「まだ使われていないだけ」と読むと、壊れている機能を見逃す。**

2026-08-11 に「応募0件」を調べたら、**応募できない状態**だった。
`/jobs/{slug}/apply` が全件404で、加えて公開求人を持つ7社のうち6社は
通知の宛先が0件で、送っても誰にも届かなかった。

### 現時点の分類（2026-08-11 実測）

**❌ 起こせなかった0（経路が壊れている／存在しない）**

| テーブル | 理由 |
|---|---|
| `ow_match_scores` | **書き込むコードが src にも migration にも存在しない。** 完全な死蔵 |
| `ow_job_applications` | apply ページが全件404だった（同日修正）＋宛先0件（同日修正） |
| `ow_casual_meetings` | 76社に導線が出ていたが宛先を持つのは2社だけだった（同日修正） |

**⚠️ 未検証の0（経路はあるが、誰も通っていないだけかもしれない）**

| テーブル | 状況 |
|---|---|
| `ow_company_follows` | `POST /api/jobseeker/companies/[id]/follow` はある。**未検証** |
| `ow_user_follows` | 同上。**未検証** |

⚠️ この2つは企業と登録者が増えれば実際に踏むので、そのときに確定する。
   今わざわざ検証しないのは、これが「根拠のないデータの除去」の作業であって
   未完成機能の棚卸しではないため。

**🗑 未使用テーブル（DROP 候補。今回は消さない）**

| テーブル | 状況 |
|---|---|
| `ow_mentor_reservations` | **メンター機能自体が無い。** `ow_mentors` は migration 132 で作られ 140 で DROP 済み。「話せる人」の実体は `ow_company_members`。**`src` からの参照0件** |
| `ow_messages` | アプリが使うのは `ow_conversation_messages`。名前が似た別テーブルが残っている |

⚠️ **意図的に止めている0はここに入れない。** `ow_scouts` / `ow_scout_quotas` は
   `SCOUT_SENDING_ENABLED` を未設定にして止めているので「起こさなかった0」。

### 判定の手順

1. そのテーブルに **INSERT するコードが存在するか**を grep する（0件ならそこで終わり）
2. 存在するなら、**その経路に到達できるか**を確かめる。
   ⚠️ 認証の内側なら、実際にログインして踏むこと（HTTP status だけ見ない）
3. 到達できるなら、**受け取る先があるか**を確かめる
   （応募・面談は `getCompanyNotificationRecipients` が0件だと届かない）

---

## ⚠️ `/companies`（一覧）の作りで、読む前に間違えやすいこと（2026-08-28 実測）

### ① ISR ではない。動的レンダリング

`export const revalidate` も `dynamic` も `generateStaticParams` も**無い**が、
`searchParams` を読むので App Router の仕様で**動的**になる
（本番の応答は `cache-control: private, no-cache, no-store`）。

⚠️ **`searchCompanies()` 自体は `unstable_cache` に包まれていない。**
   包まれているのは `fetchAvailablePhases` / `fetchDistinctLocations` /
   `fetchCompanySuggestions` / `fetchCurrentMembersByCompany` の4つだけ。

→ したがって **`companyAmbassadorsTag` / `revalidateCompanyAmbassadors` は一覧に無関係。**
   一覧に面談対応者の件数を出すとしても、**新しいタグは要らない**
   （むしろ包むと、あの7経路にタグ追加を忘れる余地を新しく作ることになる）。

⚠️ `/companies/[id]`（詳細）は ISR。**一覧と詳細で前提が違う。** 詳細で必要だった
   「数字だけサーバー、人物はクライアント」（`f9d6d051`）は、一覧では構造上不要。

### ② ★`fetchCurrentMembersByCompany` は常に `{}` を返す（死んでいる）

`createPublicClient()`（anon）で `ow_experiences` を引くが、実ユーザーは全員
`login_only` なので **RLS が全行を落とす**。実測: anon **200 / 0行** ／ admin 13行。
（`401`/`42501` ではないので GRANT ではなく RLS。）

→ `CompanyCardList` のメンバーアバターは **79社すべてで一度も表示されていない。**
   ログイン中でも出ない（閲覧者に関係なく anon で引くため）。

⚠️ **個人情報は漏れていない**（本番HTMLで氏名0件・`/u/` リンク0件）。
   ただしそれは設計の成果ではなく **RLS の副作用**。「起こせなかった0」の一例。

⚠️ **admin クライアントに変えないこと。** 変えると `login_only` の氏名と顔写真が
   未ログインに配られる（`f9d6d051` で詳細ページ側を直したのと同じ事故になる）。

### ③ 並び替え「開示充実順」の実装は**1つに戻した**（2026-08-28）

**実体は [lib/search/companies.ts](src/lib/search/companies.ts) の `disclosureScore` だけ**
（記事3 + 求人1 + 特徴1 + 現役2 + OB1 ＝ 8点）。

⚠️ `companies/(list)/page.tsx` にあった**ページ描画時の再ソート**（`reality_disclosure` の
   有無で並べ替え）は **2026-08-28 に削除した。**
   ⚠️★**`paged`（現在ページの12件）しか並べ替えていなかった。** 2ページ目以降は
      絶対に上がってこない**部分ソート**で、「全体を並べ替えた」ように見えるのが
      一番まずい形だった。**再ソートを足すなら `searchCompanies` 側に足すこと。**

⚠️ `/biz` の `lib/utils/disclosureScore.ts`（95点満点）と `/jobs` の同名ソートは**別物**。

### ⚠️★「社員数順」の結果は、画面から検証できない（2026-08-28）

**カードの従業員数はレンジ表記**（`51-200名` など）なので、
**帯の中の順序の根拠がどこにも出ていない。** 例えば `51-200名` の帯には
**28社**が並ぶが、その28社がなぜその順なのかは画面から読み取れない。

内部の並びはこうなっている:

| | |
|---|---|
| 第1キー | `parseEmployeeCount` が返す**数値の降順**（`約200名` > `約100名`） |
| 同数のとき | **`updated_at DESC`（前段のDB順＝新着順）が残る**。`Array.prototype.sort` が安定なため |
| 第2キー | **意図的に置いていない** |

⚠️ **「並び順がおかしい」と誤読されやすい形。** 帯が同じ2社の上下は、
   カード上の情報だけでは説明できない。**バグとして直しにいく前にここを読むこと。**

⚠️ **第2キーを足して取り繕わないこと。** 実測（2026-08-28 / 公開79社）で
   異なる数値は **33種類しかなく、同数グループが11組（100名に12社・200名に12社）**
   あるが、これは `employee_count` が「約100名」に丸められた自由記述だから。
   **粒度の粗さは並び順では解決しない。** 直すならデータ側（元の値）の話。

### ④ カードの下端が揃う仕組みは `minHeight` ではない

`minHeight: 3.1em` は**既に外してある**（`CompanyCardList` のコメント参照）。
いまの揃え方は **tagline の1行クランプ ＋ CSS Grid の行内 stretch**。

実測（2026-08-28）: 1440px=3列 / 1199px・768px=2列 で**全カード 161px で一致**。
**375px は1列**なので行内に他のカードが無く、**tagline が空の1社だけ 19px 低い**
（124px vs 143px）。tagline は公開79社中 **78社にあり、1社だけ空**。

⚠️ **行を足しても375pxの不揃いは解消しない。** 直すなら tagline 側の話。

---

## ⚠️ 「開示スコア」を名乗る計算が4つある（2026-08-11 整理）

**名前が似ているので、どれの話かをファイルパスと関数名で特定してから触ること。**
2026-08-11 に `avg_salary` の配点を外すとき、どれが対象かの特定に調査が必要だった。

| # | 実体 | 用途 | 満点 | `avg_salary` |
|---|---|---|---|---|
| 1 | [lib/utils/disclosureScore.ts](src/lib/utils/disclosureScore.ts) `calcDisclosureScore` | `/biz/dashboard` `/biz/company` の「開示充実度」 | 95 | **含まない** |
| 2 | [lib/search/companies.ts](src/lib/search/companies.ts) の**ローカル関数** `disclosureScore` | `/companies` の並び替え「開示充実順」 | 8（旧10） | **含んでいた → 2026-08-11 に削除** |
| ~~3~~ | ~~`companies/(list)/page.tsx` の `sort === "disclosure"` 分岐~~ | **2026-08-28 に削除** | — | — |
| 4 | [jobs/(list)/JobsClient.tsx](src/app/(jobseeker)/jobs/(list)/JobsClient.tsx) の `sort === "disclosure"` | `/jobs` の並び替え | 7 | 無関係 |

⚠️ **CLAUDE.md 冒頭の「開示充実度スコア 取材データの実態」表と、
   メモ `project-disclosurescore-redesign`（実質35点満点問題）が指すのは 1 だけ。**

✅ **3 は 2026-08-28 に削除した。** 全社同値の列で並べ替えている無意味な処理だった。

⚠️★**「全社が空だから false になって no-op」は誤り。** 実測すると
   `reality_disclosure` は**掲載79社すべてが `{}`（空の jsonb）で、NULL ではない**。
   **JS では `!!{}` は truthy** なので、全件 true で比較が0になり、
   結果として no-op だっただけ。**この列に値が入り始めた日に、本物の開示スコア（2）を
   上書きするところだった。** 実害が無い理由を取り違えないこと。

⚠️ 削除が真に no-op であることは、**dev と本番の並びが完全一致する**ことで確かめた。
   `disclosureScore.ts` の `reality_disclosure` 40点が全社0点だったのと同じ根。

---

## ⚠️ `published_at` は「最初に公開した日時」（2026-08-12 確立）

**決定ロジックは [src/lib/companies/publishedAt.ts](src/lib/companies/publishedAt.ts) の
`publishedAtPatch` 1箇所に集約している。条件を各所に書き写さないこと。**

| 場面 | 挙動 |
|---|---|
| 初回公開 | `now` を書く |
| 公開中に再保存 | **触らない**（上書きしない） |
| 非公開に戻す | **消さない** |

⚠️ 消さないのは、公開した瞬間に作られるフィード投稿（`company_joined`）が残るため。
   記録を消すと投稿と突き合わせられなくなる。

### `is_published` を true にできる経路は3つある

| 経路 | 2026-08-12 以前の状態 |
|---|---|
| `admin/companies/actions.ts` `updateIsPublished` | 正しい（これが基準だった） |
| `PATCH /api/biz/company` | **`isPublished ? now : null`。再保存で上書きし、非公開化で消していた** |
| `PUT /api/admin/companies/[id]` | 正しい |

⚠️ **新しく `is_published` を true にする経路を足すときは、必ず `publishedAtPatch` を通すこと。**

### ⚠️ migration で `is_published` を true にするときも `published_at` を埋める

**80社が NULL のままになり、「いつ何社公開したか」を再構成できなくなった。**
現在公開されている80社は、`updateIsPublished` を一度も通っていない
（migration か直接 SQL で切り替えられている）。

⚠️ **バックフィルはしない。** `created_at` で埋めると推測値の投入になる。
   「記録が無い」という事実を残す（本日除去した機械投入値と同じ性質になるため）。

---

## ⚠️ DB を変える migration を書く前に、対象テーブルをダンプする（2026-08-20 確立）

```bash
./scripts/dump-tables.sh ow_transitions ow_experiences
```

**スキーマ・権限・データを変える migration を書く前に、必ず先に実行する。**
出力は `.dumps/YYYYMMDD-HHMM-<テーブル名>.sql`（`.gitignore` 済み。**コミットしない**）。

### なぜ「バックアップがあるから大丈夫」ではないか

Supabase の日次バックアップには3つの制約がある（2026-08-20 確認）。

| # | 制約 |
|---|---|
| ① | 戻せるのは**1日単位**（**8日分**保持 / Supabase Pro・PHYSICAL）。最新は各日 15:0x UTC（日本時間の翌0時過ぎ） |
| ② | Restore は**プロジェクト全体の巻き戻し**。**1テーブルだけ戻すことはできない** |
| ③ | **Storage は含まれない**（企業ロゴなどの実ファイルは対象外） |

⚠️ **PITR（Point-in-Time Recovery）は無効**（2026-08-20 確認）。
   **検討したうえで当面は入れないと決めた**（有料アドオン。実ユーザー14人・職歴19件の段階では
   作業前ダンプの習慣のほうが費用対効果が高い）。**再検討の目安は docs/todo.md に書いてある。**

⚠️ 過去時点の中身を**見たいだけ**なら、本番を巻き戻さずに
   **`Restore to new project`（BETA）**でバックアップから別プロジェクトを起こせる。
   「昨日この列はどうなっていたか」を安全に調べるときはこちらを先に使う。

⚠️ **足りないのは頻度ではなく粒度。** ②があるので、1テーブルの事故を直すために
   **他の全テーブルを数時間前に巻き戻す**ことになる。それを避けるための作業前ダンプ。

⚠️ **migration は復旧手段ではない**（docs/todo.md）。通しで流し直しても再現できない
   （実測 OK 54 / FAIL 58）。企業データは `supabase/seeds/`（最新でも 2026-05-28・10社）にあり、
   本番87社とは別物。

### スクリプトの2つのモード（2026-08-22 に作り直した）

| | 使うもの | 出るもの | Docker |
|---|---|---|---|
| `SUPABASE_DB_URL` を設定して実行 | ローカルの `pg_dump -t` | **スキーマ + データ** | 不要 |
| 何も設定せず実行 | **Supabase CLI の一時資格情報を借りて**ローカルの `pg_dump` | **スキーマ + データ** | **不要** |

**どちらのモードでもスキーマが出る。** 列を落とす migration の前にも、
`SUPABASE_DB_URL` を用意できないまま実行してよい。

⚠️ **以前は「何も設定しない」側が `supabase db dump --linked` を直接呼んでおり、
   Docker 必須かつ data-only だった。** Docker Desktop が落ちていると
   **作業前ダンプごと 0バイトで失敗する**（2026-08-22 に2回踏んだ）。
   いまは `--dry-run` で pg_dump 用の資格情報だけを取り出し、
   自前の `pg_dump` に渡している。

⚠️ 接続文字列と資格情報は**リポジトリ内のファイルに書かない**（環境変数だけ）。

⚠️ ローカルの `pg_dump` が**サーバ（17系）より古いと `server version mismatch` で止まる。**
   スクリプトは `postgresql@17` を直接パスで拾う。
   PATH 上の `pg_dump` が 16 でも動く（2026-08-22 実測）。

### ★「エラーが出なかった」を成功にしない

**出力の中身を見ること。** 実測の例（2026-08-22 / `ow_companies` 87行）:

```
出力: .dumps/20260822-0153-ow_companies.sql （182,196 バイト / スキーマ+データ）
  CREATE TABLE 1 / ALTER TABLE 6 / CREATE INDEX 7 / COPY 1
  plan text DEFAULT 'free'::text   ← 落とす予定の列がスキーマに残っている
  ow_companies  87 行
```

⚠️ データは `COPY ... FROM stdin;` の形で入る（`INSERT` ではない）。
   pg_dump の既定で、`psql` でそのまま戻せる。**「INSERT が無い＝データが無い」ではない。**
   スクリプトの行数表示は COPY と INSERT の両方を数える。

## ⚠️ migration を書くときのルール

1. **全社一括の UPDATE を禁止する。** `WHERE is_published = true` のような条件で全社を更新しない。
   **対象を id または name で明示列挙する。**
2. **一括 UPDATE の前に、同じ列を触った直近の migration を確認する。**
   打ち消していないかを確認し、**確認した旨を migration のコメントに書き残す。**
3. **推測値を投入しない。** 企業ごとに調べた値でなければ列に入れない。
   「とりあえず hybrid」「とりあえず東京都」は、後から migration 由来か企業設定かを判別できなくなる。

### ⚠️★保留したい migration を `supabase/migrations/` に置かない（2026-08-26 確立）

**`supabase db push` は保留中のものを全部当てる。**
ファイル冒頭に「適用しないこと」と書いても**ロックにはならない**。

⚠️ **2026-08-26 に実際に踏んだ。** `20260827090000_scout_gate_career_stance.sql` は
   冒頭に「**利用規約 第8条の改定日が決まるまで適用しないこと**」と書かれていたが、
   別セッションが自分の migration を当てるために `db push` した際、
   **保留分としてまとめて適用された。** 打ち消す migration
   （`20260827140000_revert_scout_gate_career_stance.sql`）を別に足して戻している。

- **適用日が決まるまでは [`supabase/pending/`](supabase/pending/) に置く。**
  当てる日に `supabase/migrations/` へ移す。
- **`db push` の前に `supabase migration list` で保留分を必ず確認する。**
  自分のファイル以外が並んでいたら、当てる前に持ち主に確認する。

⚠️ **`db push` は「自分の1本だけ」を選べない。** 保留が複数あるときは、
   **他人のものも一緒に出ていく**前提で判断すること。

→ 実際に踏んだ事例（archive/258 が archive/170 を理由ごと打ち消していた件、
   公開求人18件の出所調査に丸一日かかった件）と採番・baseline の運用は
   [.claude/skills/db-safety/SKILL.md](.claude/skills/db-safety/SKILL.md)

## ⚠️ `/admin` 配下ではブラウザ側の Supabase クライアントを使わない（2026-08-11 確立）

| 何を | どうする |
|---|---|
| 読み取り | **サーバーコンポーネント + `createAdminClient`** |
| 書き込み | **Server Action（`ActionResult` 型で error を画面に出す）** |
| ブラウザ側 `@/lib/supabase/client` | **使わない** |

### なぜ

**ブラウザクライアントは RLS で fails closed するが、黙って0行になるため気づけない。**
運営アカウントでも、そのテーブルに運営ポリシーが無ければ他社の行は見えないし書けない。
supabase-js は失敗しても例外を投げないので、画面は成功したように振る舞う。

⚠️ **運営ポリシー（`auth_is_admin`）を持つのは `ow_companies` だけ**だった（2026-08-11 実測）。
   `ow_jobs` / `ow_company_admins` / `ow_users` / `ow_experiences` には1本も無い。

### 実測（運営アカウントのセッションで PostgREST を直接叩いた結果）

| テーブル | 全件 | 運営に見えた | 差 |
|---|---|---|---|
| **`ow_jobs`** | 20 | **7** | **13**（すべて他社の draft） |
| **`ow_company_admins`** | 10 | **6** | **4**（すべて `is_active` かつ `permission='admin'`） |
| `ow_users` | 26 | 25 | 1（システムユーザー） |
| `ow_companies` | 85 | 85 | 0（運営ポリシーあり） |

### 実際に起きていたこと（4ファイル）

| 画面 | 症状 |
|---|---|
| `/admin/jobs`（一覧） | 他社の draft が**1件も出ない**。「審査待ち0件」が本当に0か見えていないだけか区別できなかった |
| `/admin/jobs/[id]` の承認・差し戻し・非公開・再公開 | ブラウザクライアントで直接 UPDATE。**他社の求人では常に0行更新**。戻り値を捨てていたので成功に見えた |
| `/admin/companies` のロゴURL編集 | `ow_companies_own_update` は `auth.uid() = user_id` を要求。`user_id` があるのは**85社中2社**で、**残り83社で0行更新** |
| `/admin/articles` の紐づけ候補 | `ow_company_admins` 4件が欠け、企業に属する人が候補に出なかった |

### 直したときの原則

- **0行更新を成功として扱わない。** `.select("id")` で戻り行を受け、0件ならエラーにする
- **`.select()` を引数なしで呼ばない。** 全列を返すため、列単位 GRANT を剥がした列があると 403 になる
- **RLS を緩めて解決しない。** ブラウザセッションから他社の下書きが取れる経路が増える

### ★書き方は `lib/supabase/mutate.ts` に決めてある（2026-08-23）

**`update` / `delete` を素で書かない。** 原則だけでは守られなかったので、型を用意した。

```ts
import { mutateOne, mutateMany, mutateAllowNone } from "@/lib/supabase/mutate";

// 1行だけ変わるはず（0行はエラー）
const r = await mutateOne(
  supabase.from("ow_companies").update({ tagline }).eq("id", companyId),
  "company PATCH 本体",
);
if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

// 0行でも正常（入れ替え前の掃除など）。⚠️ これを既定にしない
await mutateAllowNone(
  supabase.from("ow_job_roles").delete().eq("job_id", jobId),
  "job roles 掃除", { returning: "job_id" },
);
```

| 関数 | 使うとき |
|---|---|
| `mutateOne` | ちょうど1行。2行以上なら警告（条件の書き漏れ） |
| `mutateMany` | 1行以上。0行はエラー |
| `mutateAllowNone` | **0行でも正常**。消したいものが元から無くてよい場合だけ |

⚠️ **`.select()` はヘルパーが付ける。呼び出し側で書かない。**
   素で書くと引数なしになりがちで、全列を返して列単位 GRANT に弾かれる。

⚠️ **`id` 列が無い表がある。** 中間テーブルは複合主キーのことが多い。
   `{ returning: "job_id" }` のように実在する列を渡す。
   `ow_job_roles` は `(job_id, role_id)`、`ow_company_genres` は `(company_id, genre_id)`。

⚠️ **`try { } catch { }` は効かない。** supabase-js はエラーを**戻り値**で返すので、
   囲っても素通りする。**実際にこれで1週間気づかなかった**（下の3件目）。

### ★踏んだ3件（すべて画面はエラーを出さなかった）

| いつ | 何が起きたか |
|---|---|
| 2026-08-11 | 企業ロゴURLの一括更新が **83社で0行更新**。RLS が `auth.uid() = user_id` を要求し、その列は85社中2社にしか入っていなかった。入力欄は保存されたように見えていた |
| 2026-08-23 | `PATCH /api/biz/company` が **85社で保存されていない**。同じ根。`.select()` が無く `error` だけを見ていた |
| 2026-08-23 | `ow_job_roles` の入れ替えが **DELETE は黙って0行 / INSERT は 403**。書き込みポリシーが1本も無かった。`try/catch` で囲ってあったが捕まらず、**派生値（`role_category_id`）だけが更新され、職種の正と食い違う**形になっていた |

⚠️ **3件とも原因は「コードの書き方」ではなく「RLS の条件」。**
   アプリを読んでも気づけない。**行数を見る以外に検知する方法が無い。**

⚠️ **入れ替え方式では順序も守ること。** 「消す → 入れる → 派生値を書く」なら、
   **入れ替えの成功を確認してから派生値を書く。** 失敗しても派生値だけ書くと、
   正と派生が食い違ったまま残る（3件目がまさにこれ）。

### ⚠️ 金額・料率を grep するときは、表現ゆれをすべて対象にする（2026-08-23 確立）

**1つの書き方だけで探すと取りこぼす。** `15%` / `15％`（全角）/ `0.15` / `.15` /
`十五` / `10%` / `10％` / `0.1` / `.1` を**まとめて**当てること。

⚠️ **2026-08-23 に実際に取りこぼした。** 成功報酬の残骸を調べたとき
   `0\.15|15%` だけで grep し、**「3か所」と報告した。実際は6か所**あった。
   見落としたのは 10% 側で、**請求額をその場で計算する実装**（`年収 × 0.1`）が
   画面と API の両方に生きていた。

```bash
grep -rnE '15%|15％|0\.15|[^0-9]\.15|十五|10%|10％|0\.1[^0-9]|[^0-9]\.1[^0-9]' src content
```

⚠️ CSS の `0.15s` `.15em` `rgba(...,0.1)` が大量に当たるので、
   **除外は後段の grep -v で行う**（最初から狭めない）。

⚠️ 文言だけ消して**計算式を残さない**。表示を消しても、
   値を作るコードが残っていれば別の画面やメールから出てくる。

### ⚠️ 認可の有無を、共通関数名の出現回数で判定しない（2026-08-21 確立）

**`getTenantContext` / `getCompanyContext` / `requireAdmin` を grep して数えても、
そのルートが無防備かどうかは分からない。同じ判定を直接クエリで書いている実装がある。**

```ts
// これも立派な企業所属チェック。共通関数を grep しても引っかからない
const { data: adminLink } = await supabase
  .from("ow_company_admins")
  .select("id")
  .eq("user_id", meUser.id)
  .eq("company_id", conv.company_id)
  .eq("is_active", true)
  .maybeSingle();
if (!adminLink) return NextResponse.json({ error: "..." }, { status: 403 });
```

⚠️ **2026-08-21 に実際に誤報を出した。** `/api/biz/conversations/[id]/join` と
   `/messages` を「ログイン判定だけ」と報告したが、**どちらも所属を検証していた**
   （join は上のコードで、messages は参加者であることを要求）。
   RLS 側も `ow_conversation_participants_insert` が
   「その会話の企業の有効な管理者であること」を WITH CHECK で要求しており、
   **アプリと RLS の二重で守られていた。**

**ルートごとに中身を読むこと。** 数えてよいのは「読むべきファイルの一覧」を
作るときだけで、**判定の結論に使わない。**

⚠️ 逆向きの誤りもある。関数を呼んでいても、**戻り値を捨てていれば守っていない**
   （「0行更新を成功として扱わない」と同じ形）。

### ⚠️ 認証の内側にあるページは、実際にログインして踏むまで壊れていても分からない

2026-08-11 までに**同じ形の不具合を3件**踏んだ。いずれも未ログインでは
認証リダイレクト（307）が先に出るため、**HTTP を見る限り正常**だった。

| 不具合 | 未ログインで見えた挙動 |
|---|---|
| `/jobs/{slug}/apply` が全件404（`getJobById` は UUID しか受けない） | 307（ログイン誘導） |
| `/companies/{slug}/casual-meeting` が全件404（同じ原因・2026-08-05） | 307 |
| `/admin` の0行更新 | そもそも `/admin` に入れない |

#### 確認手順（メールは飛ばない・新規アカウントも作らない）

⚠️ **セッションを差し替えるときは、先に `sb-` クッキーを全部消す。**
   非チャンク（`sb-<ref>-auth-token`）とチャンク（`.0` / `.1`）が混在すると、
   **`@supabase/ssr` は非チャンク側を優先する**ため古いセッションで認証される。
   2026-08-12 に運営セッションを入れたのに `/admin/companies` が `/onboarding` へ
   リダイレクトされ、**権限が無いように見えた**（実際は前の is_test アカウントの残骸）。


`generateLink` はリンクを返すだけで送信しない。既存の `is_test` アカウント
（求職者側）または運営アカウントを使う。

```js
const admin = createClient(url, SERVICE_ROLE_KEY);
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
const pub = createClient(url, ANON_KEY);
const { data } = await pub.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
// ① fetch で確かめる場合: Cookie ヘッダに入れる
// ② ブラウザで確かめる場合: public/ に一時HTMLを置いて document.cookie を書き、開いたら消す
const value = "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
// ⚠️ base64url。標準 base64 だと @supabase/ssr が Invalid Base64-URL character で 500 になる
// ⚠️ 3180文字を超えるので sb-<ref>-auth-token.0 / .1 に分割する（実測 5,125 文字）
```

⚠️ **確認するのは HTTP status ではなく中身。** 上の3件はどれも 200 か 307 だった。
   「フォームが出ているか」「行が何件出ているか」まで見ること。

⚠️ **ログインが要るページを直したら、必ずログインして踏む。**
   未ログインの curl だけで「直った」と言わない。

### ⚠️ `*ById` は内部専用。ページからは必ず `*BySlugOrId` を呼ぶ

`getJobById` / `getCompanyById` は **UUID しか受けない**。
2026-08-11 に `export` を外し、`queries.ts` の内部関数にした。
import した時点でビルドが落ちるので、次に同じことをしようとした人はその場で気づける。

⚠️ `mockJobData` の同名関数は `getMockJobById` に改名した。
   名前が衝突していると import 補完で mock 側が出る。

⚠️ **同名・類似名の関数が他にもある。** 例: `parseSalary` は
   `api/biz/jobs/route.ts`（リクエストボディの解析）にも別実装がある。
   grep するときは必ずファイルパスまで確認すること。

---

## RLS / GRANT / user_id 空間

- **RLS ポリシーか GRANT を変えたら、最低3者で実測する**：anon / 非admin / admin。
  **admin のセッションで測っても、権限の検証にはならない。**
- **「画面が動いている」は検証にならない。** 画面は正しく作られていても、
  PostgREST を直接叩く経路だけが漏れているのが過去に見つかった穴の共通形。
- **検証を自社だけで完結させない。** 他社を混ぜて「開いてはいけない相手に開いていないか」を数える。
- **`ow_companies.user_id` に依存しない**（**89社中2社**にしか入っていない実質未使用の列。
  2026-08-30 実測。⚠️ 分母は増えるので**割合ではなく実測で書く**）。
  企業の管理者判定は `public.auth_is_company_admin(company_id)`。
- **`auth.uid()` が返すのは `auth.users.id` で、`ow_users.id` とは別物。**
  どちらの空間かはテーブルごとに違う。ポリシーを書く前に
  [docs/user-id-spaces.md](docs/user-id-spaces.md) の表を見ること。
- **`ow_users` に列を足したら `grant select` が要る。**
  `authenticated` の SELECT は**列を列挙する形**で配られているため、
  `ADD COLUMN` した列は**読めない状態で生まれる**。
  ⚠️ **UPDATE はテーブルレベルなので「書けはする」。** だから実測しないと気づけない
  （2026-08-15 に `headline` で実際に踏んだ。適用直後の実測は SELECT=false / UPDATE=true）。

  ```sql
  -- 列を足したあと必ず実測する
  select has_column_privilege('authenticated','public.ow_users','新しい列','SELECT');
  ```

- **SELECT を列単位で配っているテーブルの一覧**（**2026-08-23 実測に更新**）。
  ここに載っているテーブルに列を足したら、**`grant select (列名)` を同じ migration に書く。**

  | テーブル | authenticated | anon |
  |---|---|---|
  | `ow_users` | 30 / 33 | **23 / 33**（2026-08-19〜） |
  | `ow_experiences` | 26 / 35 | **21 / 35** |
  | `ow_career_profiles` | 7 / 9 | **5 / 9**（2026-08-20〜） |
  | **`ow_company_members`** | **12 / 14** | **11 / 14** |

  ⚠️ **2026-08-15 版のこの表には誤りがあった**（2026-08-23 に実測して訂正）。
     `ow_experiences` の anon を「権限なし」と書いていたが、**実際は21列に SELECT がある。**
     `ow_users` の列数も 32 → 33 に増えていた（分母は増えるので、**割合ではなく実測で書く**）。

  ⚠️ **`ow_experiences` の anon から落ちている14列**（＝ここに載っていない列は anon にも見える）:

  ```
  salary_man  salary_base  salary_bonus  salary_stock  rank  department  department_id
  turning_point  exit_reason  learnings  visibility_company_profile
  join_reasons  join_reason_primary  leave_reasons
  ```

  ⚠️ **`join_reason`（単数）は anon にも配られている。** 落ちているのは `join_reasons`（複数）と
     `join_reason_primary` の2列。**名前が似ているので混同しないこと。**

  ```sql
  -- 一覧を作り直すとき（分母も一緒に出す）
  select count(*) total,
         count(*) filter (where has_column_privilege('anon', 'public.ow_experiences', attname, 'SELECT')) anon_select,
         count(*) filter (where has_column_privilege('authenticated','public.ow_experiences', attname,'SELECT')) auth_select
    from pg_attribute
   where attrelid='public.ow_experiences'::regclass and attnum>0 and not attisdropped;
  ```

  ⚠️ **`ow_users` は anon も列単位**（2026-08-19）。**anon から落とした9列**:

  ```
  email  birth_date  statistics_opt_out  auth_linked_at
  profile_setup_at  mentor_registered_at  is_system  created_at  updated_at
  ```

  ⚠️ **anon キーの経路（`createPublicClient` / 未ログインの `createClient`）で
     この9列を select しないこと。** 1列でも入るとクエリが丸ごと403になり、
     **`?? []` で受けている呼び出し側では「0件」として静かに素通りする。**
     必要になったら、**先に「GRANT を足すか」を判断する**（勝手に select を足さない）。
     経緯は `20260819100000_ow_users_anon_column_grants.sql`。

  ⚠️ **`ow_career_profiles` も anon は列単位**（2026-08-20）。**anon から落とした4列**:
     `birth_year` `gender` `created_at` `updated_at`。
     残しているのは `id` `user_id` `headline` `years_of_experience` `is_published` の5列。
     経緯は `20260820090000_career_profiles_anon_column_grants.sql`。

  ⚠️ **これ以外の `ow_*` はテーブルレベル**なので、列を足せばそのまま読める。

- **★列単位で配っているテーブルの一覧（ここに列を足す migration は `grant` を同梱する）**

  ⚠️ **SELECT 側は上の表がすべて**（`ow_users` / `ow_experiences` / `ow_career_profiles`）。
     ここは**それに UPDATE 側と `ow_company_members` を足した全体像**。二重管理にしないこと。

  | テーブル | 列単位なのはどれか | 足したとき書くもの |
  |---|---|---|
  | `ow_companies` | **UPDATE** | `grant update (列名) ... to authenticated` |
  | **`ow_users`** | **SELECT（上の表）＋ UPDATE（authenticated）** | `grant select (列名)` と `grant update (列名)` |
  | **`ow_company_members`** | **SELECT（anon / authenticated）** | `grant select (列名) ... to anon, authenticated` |
  | `ow_experiences` / `ow_career_profiles` | **SELECT のみ**（上の表） | `grant select (列名)` |

  ⚠️ **これらのテーブルに列を追加する migration では、同じ migration に `grant` を書かないと
     `authenticated` から使えない列が生まれる。** 読めない列は「0件」に、
     書けない列は「保存したのに変わらない」に化ける。**どちらもエラーにならない。**

  ⚠️ `ow_users` の UPDATE は 2026-08-22 に列単位へ変えた（`20260822090000`）。
     **`can_casual_meeting` / `auth_id` / `is_test` / `is_system` / `email` の5列は
     意図して配っていない。** 配り直すときにこの5列を混ぜないこと。
     ⚠️ **`can_casual_meeting` は 2026-08-23 に src からの参照が0件になった**（B-1）。
        「話を聞ける人」の判定を `ow_company_members`（本人の申請＋企業または運営の承認）へ
        移し、`/admin/candidates` の運営トグルも撤去した。
        **列も GRANT（SELECT）も残してある。DROP していない。**
        ⚠️ **新しい参照を足さないこと。** 判定は `lib/companyMembers/talkable.ts`。
     ⚠️ `email` は本人向けのメールアドレス変更機能が無いから落としている。
        **作るときは戻すこと**（`/auth/confirm` の `email_change` 対応とセット）。
     ⚠️ **INSERT には触っていない。** `auth_id` / `email` は `lib/auth/linkOwUser.ts` の
        新規作成経路が INSERT するので、INSERT 権限は残してある。
     ⚠️ `ow_company_members` の SELECT からは **`invite_token`** を外してある（同 migration）。

  ⚠️ **配った28列のうち13列はアプリが書いていない**（過剰付与。2026-08-22 に実測）。
     `id` `created_at` `welcome_sent_at` `auth_linked_at` `catchphrase` `username`
     `statistics_opt_out` `is_mentor` `is_active_mentor` `mentor_themes`
     `mentor_registered_at` `can_talk_to_candidates` `can_talk_to_hr`
     **読む経路が無いので実害は無いが、GRANT の棚卸しをする別タスクの対象。**
     `can_talk_to_*` は死列、`is_mentor` / `is_active_mentor` / `mentor_*` は
     **DROP 済みの `ow_mentors` の名残**（CLAUDE.md「メンター機能自体が無い」）。
     ⚠️ **2026-08-23 に `can_casual_meeting` も同じ状態になった**（参照0件）。
        この列は UPDATE を配っていない側なので上の13列には入らないが、
        **棚卸しの対象としては同じ**。列も SELECT の GRANT も残っている。
     ⚠️ `archive/203` が「`can_casual_meeting` を `can_talk_to_hr` に統合する」と
        宣言しているが**実行されていない**。統合先の `can_talk_to_hr` は本番0件。
     ⚠️ **落とすときは編集UIの有無を先に確かめること。** UI が後から付くと
        「保存できない」に化ける。

  ⚠️ `ow_companies` は **UPDATE** が列単位で、`ow_users` は **SELECT と UPDATE の両方**が列単位。
     **テーブルごとにどちら側が列単位かが違うので混同しない。**

- **★`PATCH` が 403 でも、UPDATE が失敗したとは限らない（2026-08-22）。**
  PostgREST に `Prefer: return=representation` を付けると**全列を返そうとする**ため、
  列単位 SELECT の GRANT に弾かれて **403（42501）** になる。UPDATE 自体は通っている。
  **権限の判定は `Prefer: return=minimal` で行う**（成功なら 204）。
  ⚠️ 実際に一度これで「本人は `can_casual_meeting` を書けない」と誤判定した。
     `return=minimal` で叩き直したら **204 で書けていた。**

  ⚠️ **一覧に無いことを根拠にせず、列を足した直後に必ず測る。**
     2026-08-15 に `ow_user_achievements` / `ow_user_awards` へ `experience_id` を足したとき、
     適用**前**に「4権限ともテーブルレベル」と確かめ、適用**後**にも
     `has_column_privilege` で SELECT / INSERT / UPDATE を測って true を確認した
     （`20260815120000_add_experience_id_to_achievements_awards.sql`）。
     `headline` のときは適用前の読みだけで済ませて外している。**測るのは適用後。**

- **★「誰にも読ませない」は GRANT で、「誰に読ませるか」は RLS で書く。**
  両方を GRANT でやると、**ポリシーが死んだまま残って次に読む人を誤らせる。**
  ⚠️ **admin も `authenticated` ロールで来る。** authenticated から GRANT を剥がすと
  **RLS まで到達せず、運営でも読めなくなる**（2026-08-16 に `ow_settings` で実際に踏んだ。
  `20260816090000` で締めすぎ、`20260816091500` で戻した）。
  正しい組み合わせは **anon は revoke / authenticated は grant / RLS で絞る**。
  `ow_user_educations` と `ow_settings` がこの形。

- **新しいテーブルには GRANT を必ず書く。** 既定では anon も authenticated も権限が付かない。
- **列単位 GRANT を剥がすと、剥奪列が select に1つでも入ったクエリが丸ごと 403 になる。**
  ページは HTTP 200 のまま中身だけが静かに空になる。

- **★`migration repair` を使ったら、通し実行で検証するまでが1セット（2026-08-20 確立）。**
  `supabase db push` が**本体は COMMIT したのに台帳への INSERT で落ちた**とき、
  `supabase migration repair --status applied <version>` で台帳を合わせることになる。
  このとき**修正後のファイルは一度も通しで実行されていない**ので、
  **使い捨てDBに当てて通ることを確かめる**こと。

  ⚠️ **ただしこのリポジトリの migration 群は、最初から通しでは走らない**（2026-08-20 実測）。
  使い捨ての Postgres に112本を順に当てたところ **OK 54 / FAIL 58**。
  失敗の大半は**設計どおり**で、データ migration が
  「対象が想定件数と違う → 中止」と自分で止まる（本番の行数を前提にしている）。
  企業データは migration ではなく `supabase/seeds/` から入るため、
  **schema と data が1本の鎖になっていない。**

  → したがって検証は「全部通す」ではなく、**対象のファイルが OK 行に出るか**で見る。

  ```bash
  docker run -d --name pgtest -e POSTGRES_PASSWORD=postgres -p 55432:5432 supabase/postgres:17.4.1.075
  for f in supabase/migrations/*.sql; do
    docker exec -i pgtest psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" \
      && echo "OK   $(basename $f)" || echo "FAIL $(basename $f)"
  done
  docker rm -f pgtest
  ```

  ⚠️ `supabase start` は使えない（`config.toml` が無く、seed も通らない）。
     使うなら `supabase init` した後に消すこと。**リポジトリに残さない。**

- **★ポリシー式は「実行ユーザーの権限」で評価される。**
  ある表から SELECT を剥がすと、**その表を副問い合わせしている RLS ポリシーを持つ
  “無関係な表”が丸ごと 403 になる**（PostgreSQL: CREATE POLICY / Notes
  「users ... must be able to access any tables or functions referenced in the expression
  or they will simply receive a permission denied error」）。

  ⚠️ 2026-08-19 に `ow_users` で実際に踏みかけた。単純な
  `REVOKE SELECT ON ow_users FROM anon` は、**anon が読める15表**
  （`ow_jobs` `ow_career_profiles` ほか）を巻き添えにする。とりわけ `ow_jobs` は
  `/companies` の「募集中 N件」・「募集あり」・sitemap・LP が通る経路。
  **列単位 GRANT に置き換えれば**、ポリシーが参照する列（`id` / `auth_id` / `visibility`）の
  権限が残るのでポリシーは評価でき、機微列だけ返らない。

  **剥がす前に、その表を参照しているポリシーを数えること。**

  ```sql
  select c.relname, p.polname from pg_policy p join pg_class c on c.oid=p.polrelid
   where c.relnamespace='public'::regnamespace and p.polcmd in ('r','*')
     and (p.polroles='{0}'::oid[] or 'anon'::regrole = any(p.polroles))
     and has_table_privilege('anon', c.oid,'SELECT')
     and pg_get_expr(p.polqual,p.polrelid) ~ '\mow_users\M';
  ```

  ⚠️ **★migration の中でロールを切り替えないこと（2026-08-20 訂正）。**
  `SET LOCAL ROLE anon` を書くと、**GRANT は COMMIT されるのに
  CLI の `INSERT INTO supabase_migrations.schema_migrations` が 42501 で落ちる**
  ——つまり「適用されたのに記録が残らない」状態になり、
  `supabase migration repair --status applied <version>` が要る。
  2026-08-19 に1回踏み、「`DO $$` の中で `RESET ROLE` したのが悪い」と考えて
  2026-08-20 に**トップレベルへ移したが、同じように落ちた**
  （`current_user = session_user` のアサートは通っているのに、である）。
  **原因は未特定。分かっているのは「書くと落ちる」ことだけ。**

  代わりに、
  ① migration では `has_column_privilege` / `has_table_privilege` で列ごとにアサートし、
  ② **適用後に anon キーで PostgREST を直接叩いて status を見る**（401 か 200 か）。
  ⚠️ ②を省かない。①は catalog を見ているだけで、実際の応答は確かめていない。

- **★★RLS で弾かれても 403 ではない。`200` ＋ `0件` が返る（2026-08-27 確認）。**
  **したがって、空のテーブルでは実測で遮断を証明できない。**
  「anon で叩いたら0件だった」は、**遮断されたのか、単に空なのか**を区別しない。

  実測の対照: **`ow_schools` は 37 行あるのに anon には 0 件**で返った（status は 200）。
  一方 **GRANT で弾かれた場合だけ `401`（`42501`）**になる。

  | 何で弾かれたか | status | body |
  |---|---|---|
  | **RLS のポリシー** | **200** | **`[]`（0件）** |
  | **GRANT が無い** | **401**（環境により403） | `{"code":"42501"}` |

  → **空の表の可視性は、ポリシーを `polroles` まで含めて読むことで判定する。**

  ```sql
  -- ★USING(true) を「anon に効く形で」配っている表だけを数える
  select c.relname, p.polname
    from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relnamespace='public'::regnamespace and p.polcmd in ('r','*')
     and coalesce(pg_get_expr(p.polqual, p.polrelid),'') = 'true'
     and (p.polroles = '{0}'::oid[] or 'anon'::regrole = any(p.polroles))  -- ★ここを落とさない
     and has_table_privilege('anon', c.oid, 'SELECT');
  ```

  ⚠️ **`polroles` を見ないと誤検出する。** 2026-08-27 に実際に誤った。
     `service_role` にだけ配った `USING(true)` を「anon が読める」と数え、
     **19表と報告したが、正しくは14表**だった（`ow_company_hidden_experiences` ほか5表が誤検出）。

  ⚠️ **行を1行入れて4者で測るのが確実**（anon / 第三者 / 本人 / 運営）。
     `ow_story_sections` を閉じたときはこの形で確かめ、**検証行は直後に消した**。

- **★403 は「0件」として静かに素通りする。** 呼び出し側の大半が `data ?? []` で
  受けているため、権限エラーは**空の一覧**にしか見えない。
  **anon 経路を新しく足して空が返ったら、まず権限を疑うこと**（データが無いと決めつけない）。
  切り分けは PostgREST を直に叩いて status を見る（403/401 は `{"code":"42501"}` を返す）。
- **`ow_companies` に列を足したら、その列の GRANT を migration に必ず書く。**
  このテーブルは**テーブルレベルの UPDATE を落として列単位で配り直している**ので、
  新しい列は**生まれた時点で書き込めない**（`authenticated` から更新すると 403）。
  他のテーブルと違い「足せば使える」ではない。
  実測（**2026-08-23**）: テーブルレベル UPDATE **なし** / 列単位 **146 / 151列**。
  （2026-08-13 は「148列」と書いていたが、分母を書いていなかった。**分母ごと書くこと。**）
  以降に足した `normalized_name` `canonical_company_id` `is_test` は**権限なしのまま**
  （運営しか触らない列なので現状は意図どおり。`listing_status` `source` は付与済み）。
  → 現在の配り方と剥がしたときの経緯は [docs/ow-companies-grants.md](docs/ow-companies-grants.md)

→ 非admin セッションの取り方、GRANT の実測クエリ、剥がすときのチェックリストは
   [.claude/skills/db-safety/SKILL.md](.claude/skills/db-safety/SKILL.md)

## 本番で検証用アカウントを作らない（2026-08-05 確立）

**検証のために本番の auth ユーザーを新規作成しないこと。** 作って消す前提の操作をしない。

### なぜ

**`ow_posts.user_id` の FK は `ON DELETE CASCADE`。**
auth ユーザーを消すと `ow_users` が消え、そこから `ow_posts` の行まで巻き込まれる。
`ow_users` を参照する FK 45列のうち **29列が CASCADE**（`ow_experiences` `ow_company_members`
`ow_conversations` `ow_bookmarks` 等 28テーブル）。エラーは出ない。

migration 238/239 で幽霊投稿60件を作ったのと同じハザード。
あちらは `ON DELETE SET NULL` で「参照が外れる」だったが、`user_id` は「行ごと消える」なので
より危険。

もう1つ、消し忘れたときに気づく仕組みが無い。

### 代わりにどうするか

1. **ローカル / プレビュー環境で検証する**（第一選択）
2. 本番でどうしても必要なら、**既存の `is_test = true` アカウントを使う**
   （2026-08-05 時点で19名）。新規作成しない
3. どちらも不可能なら、**作成前に報告して指示を待つ**

⚠️ ログイン必須ページのスクリーンショットや HTTP ステータスの確認も同じ。
   一時的なセッションが要る場合は `is_test` アカウントのパスワードを使う。

---

## ⚠️ 認証メールのリンクは `/auth/confirm`、OAuth だけ `/auth/callback`（2026-08-14 確立）

**この2つを混ぜないこと。** 混ぜると、スマホでメールを開いた人が全員登録できなくなる。

| 経路 | 着地点 | 仕組み |
|---|---|---|
| **メール**（確認・マジックリンク・パスワード再設定・招待） | **`/auth/confirm`** | `token_hash` を**サーバー側**で `verifyOtp` |
| **OAuth**（Googleログイン） | **`/auth/callback`** | `code` を `exchangeCodeForSession` |

### なぜ分けるか

`@supabase/ssr` は **`flowType: "pkce"` をハードコード**している
（`createBrowserClient.js` / `createServerClient.js` が `...options?.auth` の**展開後**に
上書きしているので、指定しても変えられない）。

PKCE の `code` は**登録したブラウザに保存された code_verifier とペアでないと交換できない**。
スマホのGmailアプリ内ブラウザなど**別ブラウザでリンクを開くと必ず失敗する**。
本番では大半の利用者がこれに該当し、`/auth?error=auth` に飛ばされていた。

`token_hash` は GoTrue の POST `/verify` で検証され code_verifier を要求しない。
`/auth/confirm` はサーバー内で完結するのでブラウザが違っても通る。

⚠️ **新しくメール系の導線を足すときは必ず
   [`confirmRedirectTo()`](src/lib/auth/redirects.ts) を使う。**
   `/auth/callback` を直書きしない。

⚠️ **共通の後処理は [src/lib/auth/postAuth.ts](src/lib/auth/postAuth.ts) にある。**
   ow_users の解決・role 付与・onboarding 判定・ウェルカムメールをコピーしないこと。
   2箇所に割れると、どちらか一方だけ直る形の不具合が生まれる。

### ⚠️ メールテンプレートに `{{ .ConfirmationURL }}` を使わない

**`{{ .SiteURL }}` + リテラルの `?` + `{{ .TokenHash }}` の形にする。**

`{{ .ConfirmationURL }}` は GoTrue の `/verify` を経由し、そこで PKCE の
`code` に変換されてしまう。**テンプレートを1枚でもデフォルトのまま追加すると、
その経路だけ同じ事故が再発する。**

⚠️ **対象は4枚**（`type` が違う）。Supabase ダッシュボード →
   Authentication → Email Templates。

| テンプレート | `type` | `next` |
|---|---|---|
| Confirm signup | `email` | `%2Fcompanies` |
| Magic Link | `magiclink` | `%2Fcompanies` |
| Reset Password | `recovery` | `%2Fauth%2Fupdate-password` |
| Invite user | `invite` | `%2Fcompanies` |

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=%2Fcompanies">メールアドレスを確認する</a>
```

### ⚠️ 最初の `?` は**リテラル**で書く。`{{ .RedirectTo }}` を URL の土台にしない

**これを破ると `/signup` が 500 になり、新規登録が全員止まる。**
2026-08-13 に本番で実際に起こした。

Supabase のテンプレートは Go の `html/template` で、**URL の文脈を静的に解析**している。
`href` の先頭がアクション（`{{ .RedirectTo }}` や `{{ .SiteURL }}`）だと、
その値が `?` を含むかどうか分からないため `urlPart` が確定しない。
確定しないまま次のアクションが来ると**テンプレートのコンパイル自体が失敗する**。

```
html/template:.../templates/confirmation:10:127:
  {{.TokenHash}} appears in an ambiguous context within a URL
```

`urlPart` を確定させるのは**リテラルの `?` か `#` だけ**
（Go `transition.go` の `tURL`: `if bytes.ContainsAny(s, "#?")`）。
`{{ .RedirectTo }}` が持ち込む `?` は**リテラルではないので数えられない。**

```html
✗ href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email"
✗ href="{{ if .RedirectTo }}{{ .RedirectTo }}{{ else }}...{{ end }}&token_hash={{ .TokenHash }}"
✓ href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=%2Fcompanies"
```

⚠️ **エラーはテンプレート保存時ではなく、メール送信時に出る。**
   ダッシュボードは保存を受け付けるので、**登録を1回試すまで壊れたことに気づけない。**
   症状は `POST /signup` が **500 `unexpected_failure`** で、
   `auth.users` に行すら作られない。画面には空のエラーボックスが出る。

⚠️ **テンプレートを変えたら必ず1回登録を通すこと。** 保存できた＝動く、ではない。

⚠️ 上記の結果、**`next` はテンプレートに固定で書く**ことになり、
   `emailRedirectTo`（＝`{{ .RedirectTo }}`）は使っていない。
   利用者ごとに `next` を変えたいなら、リテラルの `?` を保ったまま
   `&next={{ .RedirectTo }}` を**末尾のクエリ値として**渡し、
   `emailRedirectTo` に**最終遷移先そのもの**を入れる形にする
   （`safeNext` を同一オリジンの絶対URLに対応させる改修が要る）。
   **`{{ .RedirectTo }}` を URL の先頭に置く形には二度と戻さない。**

⚠️ **Reauthentication は対象外。** GoTrue の `ReauthenticateMail` は
   `SiteURL` / `Email` / `Token` / `Data` しか渡さず、
   **`ConfirmationURL` も `TokenHash` も存在しない**（6桁コードを本人が入力する方式）。

⚠️ **Redirect URLs（許可リスト）に `/auth/confirm` を入れること。**
   入っていないと GoTrue が `emailRedirectTo` を破棄して Site URL に落とすため、
   `{{ .RedirectTo }}` が空になる。

⚠️ `{{ .TokenHash }}` は **`pkce_` 接頭辞付きで届く**
   （`templatemailer.go` が `user.ConfirmationToken` をそのまま埋めるため）。
   **そのまま `verifyOtp` に渡してよい。剥がさないこと。**
   `verifyTokenHash` は同じDB列に完全一致で引くので接頭辞ごと一致し、
   POST `/verify` 側に PKCE 分岐は無くセッションが発行される。

### `confirmRedirectTo()` の現在の役割

`emailRedirectTo` に渡す値を組み立てる。
**2026-08-13 の時点で、この値はメール本文のリンクには使われていない**
（上のとおりテンプレートは `{{ .SiteURL }}` 起点で `next` を固定で持つ）。

いま効いているのは1点だけ。**GoTrue の Redirect URLs 許可リストの検証を通ること。**
許可リストに無い値を渡すと GoTrue 側で弾かれる。

⚠️ 消さないこと。`{{ .RedirectTo }}` を使う形（利用者ごとの `next`）に移るときに要る。
   移る場合は上の「最初の `?` はリテラルで書く」を必ず読むこと。

### ⚠️ `/auth/confirm` の許容 `type` に `email_change` を足さない

GoTrue の `EmailChangeMail` は secure email change のとき
**旧・新アドレスへ別々の `TokenHash` で2通**送る。
1通目の `verifyOtp` は `verifyPost` の `isSingleConfirmationResponse` 分岐に入り、
**200 OK・セッション無し**（「もう一方のリンクも開いてください」）を返す。

現行ルートは `!data.session` を失敗として扱うので、
**正常な途中経過をエラー画面として見せることになる。**

⚠️ メールアドレス変更機能を作るときは、`ALLOWED_TYPES` に型を足すだけでは足りない。
   **「1通目は成功だがセッションは無い」を独立に扱うこと**（2通目を促す画面が要る）。
   あわせて "Change Email Address" テンプレートも差し替える。
   2026-08-14 時点でメールアドレス変更機能は**存在しない**
   （`updateUser` の呼び出し2箇所はどちらも email を変えていない）。

### プリフェッチでトークンが焼かれる件（観測中・対処は保留）

メールセキュリティ製品がリンクを自動で叩くと、本人がクリックする前に
トークンが消費され、本人は `?error=otp_invalid` に着く。

⚠️ **これは `/auth/confirm` 固有の問題ではない。** GoTrue の `/verify` も GET なので
   従来の `/auth/callback` でも同じことが起きる。**前後で耐性は変わらない。**

判断材料として `/auth/confirm` が `verifyOtp` の**成功・失敗の両方**に
`ua` / `hasSupabaseCookie` / `secFetchMode` / `secFetchDest` を出している。
**非ブラウザUAでの `verifyOtp ok` の件数がプリフェッチ被害の実数。**

⚠️ **この値で分岐しないこと。** UA も `Sec-Fetch-*` も詐称でき、
   誤判定すると本物の利用者の確認を拒む。観測専用。

⚠️ 冪等性は確認済み。ウェルカムメールは `ow_users` 行の存在が冪等キーになっており
   2回目は `existing` で送られない。role 付与も `UNIQUE (user_id, role)` で
   23505 を正常扱いしている。**送信済みフラグの列は不要。**

---

## ⚠️ 企業ページは作られた時点で見える。運営が決めるのは一覧掲載だけ（2026-08-13 確立）

**運営が日常的に押すトグルは `listing_status` **1つだけ**。**

| 列 | 意味 | 既定 |
|---|---|---|
| `listing_status` | **ディレクトリに載るか**（`'listed'` / `'draft'`）。**ここだけが運営の判断** | `'listed'`※ |
| `is_published` | **詳細ページが見えるか**（404 ゲート）。**取り下げ専用** | **`true`** |
| `is_approved` | 運営が内容を確認した。**一覧掲載の前提条件** | `false` |

※ DB既定は `'listed'` だが、`POST /api/biz/companies` は明示的に `'draft'` を入れる。

経歴に出てくる企業はページだけ必要で、ディレクトリには要らない。
実際、経歴に出る6社のうち4社が `is_published = false` で、
**経歴のリンクの3分の2が404の行き止まり**になっていた。

### なぜ「まだ見せない」フェーズを無くしたか

`is_published` が守っていたものが実質**何も無かった**。作成時に企業が入れられるのは
name / description / industry / employee_count / url / logo_url の6項目だけで、
取材データは運営しか入れられない。**空のページは何も主張しない。**
薄いページの SEO は sitemap 側（`filterListedCompanies`）で既に守られていた。

一方で「ページを閉じると経歴のリンクが死ぬ」害だけがあった。

⚠️ **承認の掛け先はページ公開ではなく一覧掲載**（`check_listed_requires_approval`）。
   2026-08-13 に `check_published_requires_approval` から付け替えた。
   審査は「ディレクトリに載せてよいか」に対して行う。

⚠️ **フィードの `company_joined` は `listing_status → 'listed'` で作る。**
   `is_published` では作らない。ページが存在するだけで「参加しました」と流れると、
   経歴から拾っただけの非IT企業まで告知されてしまう。
   取り下げた企業の投稿は `isCompanyPostAlive`（`lib/feed/visibility.ts`）が隠す。

⚠️ **一覧掲載オフのページには `noindex` が付く**（`companies/[id]/page.tsx`）。
   sitemap には元から載らないが、**経歴からリンクされるのでクロールは到達しうる**。
   それまでは `is_published = false` が実質 noindex の代わりをしていた。

⚠️ **`.eq("is_published", true)` を新しく直書きしないこと。**
   1箇所忘れると非掲載企業がディレクトリに漏れる。

| 用途 | 使うヘルパー |
|---|---|
| 一覧・検索・サジェスト・sitemap・LP | `filterListedCompanies` |
| 詳細ページ・詳細ページへのリンク生成 | `filterVisibleCompanies` / `...Strict` |

⚠️ **運営画面（`/admin` 配下）は対象外。** 求職者に何を見せるかの判定であって、
   運営の作業管理は別の軸（非掲載企業こそデータを埋める対象）。

→ 3つのヘルパーの使い分けと dev 例外の有無は
   [src/lib/companies/visibility.ts](src/lib/companies/visibility.ts)

### ⚠️★分類の欠けた企業を公開しない ——「公開ゲート」（2026-08-25 **実装済み**）

**分類が欠けたまま公開される穴は、作成時ではなく公開時に塞ぐ。**

#### なぜ作成時に必須化しないか

企業が自分で登録する入口（`/biz/auth` と `/biz/companies/add/new`）で業種を必須にすると、
**登録の摩擦が増える。** そこは会社名だけで通したい。
一方で新規企業は `is_published = false` / `listing_status = 'draft'` で生まれるので、
**運営が動かすまでは誰にも見えない。** 塞ぐべきはその一手だけ。

⚠️ **したがって業種は作成フォームで任意のままにしてある。** 必須化を作成側へ戻さないこと。

#### ★判定は1つの関数に集約してある

**4経路それぞれに条件を書かない。必ず漏れる。**

実体は [src/lib/companies/publishable.ts](src/lib/companies/publishable.ts)。

```ts
checkPublishable(companyId, actor)  // 満たしていなければ「何が足りないか」を返す
```

⚠️ **取り下げ（非公開にする / draft に戻す）は常に通す。** 塞ぐのは
   「見えるようにする一手」だけ。取り下げまで止めると、条件を満たさない企業を
   下ろせなくなる。

⚠️ **更新を当てる前に呼ぶ。** 当てたあとに弾いても、値は既に書き換わっている。

#### 何を見るか — ⚠️ **誰が公開するかで条件が違う**

| 条件 | 実体 | 企業（`/biz` 経路） | 運営（`/admin` 経路） |
|---|---|---|---|
| **業種** | `ow_companies.industry_id` が非 NULL | **必須** | **必須** |
| **事業領域** | `ow_company_business_domains` に `is_primary` の行が1件 | **必須** | **必須** |
| **掲載規約の同意** | `hasAgreedTerms(user, "listing")` | **必須** | **不要** |

⚠️ **分類（業種・事業領域）は actor に関わらず必須。** 運営が例外的に通せる形にしない。
   分類が欠けたまま掲載されると、業種フィルタ・LPファセット・`/jobs` から静かに消える。

⚠️ **規約同意は企業のときだけ。** 運営が代理で掲載する場面まで止めると運用が回らない。
   同意の記録は `ow_terms_agreements` の1系統だけ（2026-08-25 に統一）。

#### 呼ぶ場所（4経路すべて。1つでも漏らすと意味が無い）

| # | 経路 | 実体 | actor |
|---|---|---|---|
| ① | `/admin` の掲載トグル | `admin/companies/actions.ts` の `updateIsPublished` | 運営 |
| ② | 同上 | `updateListingStatus` | 運営 |
| ③ | 企業情報の保存（運営） | `PUT /api/admin/companies/[id]`（`is_published` / `listing_status` を受ける） | 運営 |
| ④ | 企業情報の保存（企業） | `PATCH /api/biz/company` | 企業 |

⚠️ **④を忘れやすい。** 企業が自分で公開を切り替えられることを見落とさないこと。
   現状ここには**サーバー側の同意チェックが無く**、掲載規約のゲートは
   `CompanyEditSubNav.tsx` の「変更を公開する」ボタンを出し分ける**UI だけ**。
   API を直接叩けば未同意でも公開できる。**④で `checkPublishable` を呼べばここも塞がる。**

⚠️ **軸2（対象業界）を入れる日は、この関数に1行足す形にする。**
   別の場所に条件を書き足さない。

#### ⚠️ 既に公開されている企業は遡って止めない。ただし「下ろすと戻せない」

ゲートが見るのは**公開に切り替える操作**だけなので、条件を満たさないまま
既に公開されている企業（2026-08-25 時点では `株式会社データプール` の1社）は
そのまま残る。**ただし一度でも取り下げると、事業領域を設定するまで戻せない。**

→ 直し方は `/admin/companies/[id]` の**「事業領域」タブ**で主を1つ設定すること。

#### ★その違反は `/admin/companies` の「要対応 N社」で見つける

ゲートだけでは**導入前から公開されている違反を誰も検知できない。**
そこで一覧の上部に件数を、該当行に「⚠️ 要対応」バッジを出している。**0件が正常な状態。**

⚠️ **判定は `findPublishBlockers()`（ゲートと同じ条件関数）を呼ぶ。**
   一覧側で条件を書き直さないこと。食い違うと「直したのに警告が消えない」
   （またはその逆）が起きる。

⚠️ **一覧には掲載規約の同意を出さない。** あれは「誰が操作するか」で変わる条件で、
   企業そのものの状態ではない。一覧に出すのは**運営が直せるもの＝分類**だけ。

⚠️ **検証用の企業（`is_test`）は対象から外している**（2026-08-26）。
   この一覧の意味は「運営が直すべき**公開中**の企業」で、`is_test` の行は
   求職者側から丸ごと除外されるので直す対象ではない。
   外さないと、テスト企業を作るたびに消えない警告が積み上がる。
   ⚠️ **`checkPublishable`（ゲート）側には同じ条件を入れないこと。**
      あちらは「公開に切り替える一手」を塞ぐもので、目的が違うので条件が違ってよい。

⚠️ **取得に失敗したら「0件」と表示しない。** `findPublishBlockers` は失敗時に
   `null` を返し、画面は「判定に失敗しました（0件という意味ではありません）」と出す。
   ここを空配列に倒すと、**壊れているのに正常に見える**（CLAUDE.md
   「403 は『0件』として静かに素通りする」と同じ形）。

#### ✅ 求職者側の読み手を事業領域へ移した（2026-08-26 完了）

**この節にあった「新規企業を `listed` にしないこと」の制約は解消した。**
2026-08-25 に `POST /api/biz/companies` が `industry`(text) を書くのをやめており、
以降に作られる企業はこの列が NULL で生まれる。求職者側がまだこの列を読んでいたため、
**掲載した瞬間に一覧カード・絞り込み・LPファセット・`/jobs` から静かに消える**状態だった。

| 画面 | 前 | 後 |
|---|---|---|
| `/companies` の絞り込み | `industry`(text) を `INDUSTRY_GROUPS.values` と突き合わせ | **`ow_company_business_domains` の slug** |
| `/companies` のカードのタグ | `industry`(text) | **主の事業領域** |
| `/companies/[id]` meta・OGPバッジ・Hero・サイドバー | 同上 | 同上 |
| `/jobs` の絞り込みとピル | 同上 | 同上 |
| `/jobs/[id]` の2箇所 | 同上 | 同上 |
| LP のファセット・企業カード・フッター | 同上 | 同上 |

⚠️ **`?industry=` のキーは変えていない。** 事業領域の slug を現行キーと**12件すべて一致**
   させてあるので、既存の被リンク・ブックマークはそのまま効く。
   それより前の旧キー（`fintech` / `ec` / `healthcare`）は `resolveIndustryKey()` が救済する。

⚠️ **選択肢は「掲載中の企業が1社以上あるもの」だけ**（`getBusinessDomainFacets`）。
   「ITサービス・受託」が該当0社のまま選択肢に出続け、押すと必ず0件だったのを直した。
   ⚠️ 取得に失敗したときは**件数0で全件返す**。空配列に倒すと選択肢が丸ごと消える。

##### ⚠️★`mapCompany` の第4引数を省くと「事業領域 —」になる。型では気づけない

事業領域は `fetchBusinessDomainsByCompany`（`queries.ts`）でまとめて引き、
`mapCompany(row, jobCount, genres, domains)` の**第4引数**で渡す。
**省略可能な引数なので、渡し忘れてもビルドも `tsc` も通り、画面が「—」になるだけ。**

⚠️ 2026-08-26 に実際に踏んだ。`getJobById` だけ渡し忘れており、
   **Salesforce の求人詳細が「事業領域 —」で出ていた**（画面を見るまで気づけなかった）。

⚠️ **企業を求職者に出す経路を新しく作るときは、必ずこの引数まで通すこと。**
   `getCompanies()`（参照0件）は渡していないので、使い始めるならそこも直す。

##### ⚠️ カードの粒度が2社だけ落ちた（承知のうえ）

`industry`(text) は「ヘルスケア」「金融」という**具体的な値**を持っており、
カードにはそれがそのまま出ていた（2026-08-11 の設計判断: フィルタは束ね、カードは具体的に）。
事業領域にはその具体値が無いので、**Ubie と nCino のカードは「業種特化」になる。**

⚠️ **`industry`(text) を読み直して補わないこと。** 廃止する列に戻ることになる。
   具体性は**軸2（対象業界）を入れる日に戻す**。「業種特化」はそのための暫定値で、
   マスタの `description` にもそう書いてある。

##### ✅ 移行は完了した（2026-08-26）

| 場所 | 出すもの |
|---|---|
| `/companies` 一覧・詳細・LP・フッター | **事業領域** |
| `/jobs` 一覧・詳細 | **事業領域** |
| フィード（サイドバー・`company_joined` の情報行） | **事業領域** |
| `mypage/bookmarks` / `mypage/follows` | **事業領域** |
| ヘッダー検索のサジェスト | **事業領域** |
| **企業ピッカー**（職歴エディタ・オンボーディング） | ⚠️ **業種**（下記） |
| **匿名化した職歴の会社ラベル**（`u/[id]` / `mypage` / `mypage/details`） | ⚠️ **業種のまま**（下記） |

⚠️ **企業ピッカーだけ業種にしている。** `/api/companies/search` は掲載中の企業しか
   返さず、**公開ゲートが `industry_id` を必須にしている**ので必ず値がある。
   一方で事業領域は業種によっては任意（`requires_business_domain = false`）。
   見分けが目的の画面なので欠けない側を選んだ。

⚠️ **匿名化ラベルは業種のまま残す。** 「IT・ソフトウェア」のような**粗い区分のほうが
   匿名性が高い**ので、事業領域まで絞ると勤務先が推測されやすくなる。
   **事業領域に置き換えないこと。**

⚠️ **埋め込みで取ったら、渡す前に `industry` へ畳むこと。** 畳まずに渡すと
   受け手は `undefined` になり、**型が optional なので tsc も lint も通ったまま
   その項目だけ黙って消える**（フィードと follows で同じ形を踏んだ）。

⚠️ `companies/[id]/CustomerCasesClient.tsx` の `c.industry` は**導入事例の顧客の業種**で、
   `ow_companies.industry` とは無関係。**移行の対象ではない。**

---

## 企業ページへのリンクは env に関係なく is_published を見る（2026-08-05 確立）

`queries.ts:682` の `getCompanyBySlugOrId` は `NODE_ENV !== "development"` のときだけ
`is_published` で絞る。dev で非公開企業のページを確認できるようにするための分岐で、
**この分岐は変えない**。

ただし**リンクを生成する側は、env に関係なく必ず `is_published` を見ること。**
dev でリンクが出て本番で 404 になると、開発中には気づけない。

- 記事CTA → `resolvePublishedCompanyHref()`（`queries.ts:716`）。dev でも `is_published` を見る
- 経歴タイムライン → `CompanyLogoInfo.isPublished` を渡す。
  `timeline.ts:161` がこれを見て `company_id` を null に落とし、会社名をテキスト表示にする

⚠️ 2026-08-05 時点で `/mypage` だけこの `isPublished` を渡し忘れており、
非公開企業に在籍する人の職歴が本番で 404 に飛ぶリンクになっていた。
新しく企業リンクを作るときは、上のどちらかの経路に乗せること。

---

## ⚠️ 年齢は詳細だけ。一覧に出さず、年齢で絞り込ませない（2026-08-20 確立）

### 決めたこと

| | |
|---|---|
| **生年月日の正** | **`ow_users.birth_date`**（フル日付）。実ユーザー14人中4人が入力済み |
| 年齢を出してよい場所 | **`/u/[id]` の詳細だけ**（本人の `/mypage` のタイムライン年マーカーを除く） |
| 一覧 | **出さない**（`/people` / `/companies/[id]` の社員 / `/biz/candidates` / `/biz/meetings` のカード） |
| 企業側の絞り込み | **年齢ではなく「社会人年数」**（`/biz/candidates`） |

### なぜ絞り込みを年齢にしないか

**労働施策総合推進法9条で、募集・採用時の年齢制限は原則禁止。**
表示だけなら各社もしているが、**年齢で絞り込む機能**は禁止行為を直接手助けする形になる。
Opinio は有料職業紹介事業の許可事業者（13-ユ-316441）なので一段リスクが高い。
「経験年数で絞る」は職務要件なので性質が違う。

⚠️ 撤去前の年齢絞り込みは `if (!c.birthYear) return false` で、
**生年月日が未入力の10人（実ユーザー14人中）を無条件に落としていた。**
法令以前に機能として壊れていた。**社会人年数の絞り込みでは未算出の人を落とさない。**

### ★守り方は「規約」ではなく「型」

⚠️ **一覧用の型から `age` / `birthYear` を落としてある。** 型に無ければ表示も絞り込みも
**書けない**。コメントで「一覧に出すな」と書く方式は過去に守られていない。

| 型 | 状態 |
|---|---|
| `lib/people/directory.ts` の `PeopleCard` | `age` **なし**（`birth_date` も取らない） |
| `lib/supabase/queries.ts` の `CompanyEmployee` | `birthYear` **なし**（select からも外した） |
| `biz/candidates` の `Candidate` | `birthYear` **なし**。代わりに `tenureMonths` |

⚠️ `lib/business/meetings.ts` の `applicantAge` だけは**残している**。
   詳細（`MeetingDetailPanel`）が使うため。**一覧の `MeetingCard` からは外した。**

### 年齢の計算は `lib/age.ts` の `getUserAge()` に一本化する

⚠️ **年を引くだけの実装を書かないこと。** 誕生日前の人が1歳上に出る。
2026-08-20 以前は5つに割れており、`/biz/candidates` の表示は **`2026 - birthYear`**
と**年がハードコード**されていた（2027年になると全員1歳若く出る）。

⚠️ 例外は `MergedTimeline` の `calcAgeAtYear` だけ。あれは「**その年**の年齢」を出すので
   誕生日到来の判定は仕様上不要。

### 社会人年数は都度計算する

`lib/profile/tenure.ts` の `calcTotalExperience`（最も古い `started_at` から算出）。
⚠️ **列にもトリガーにもしない。** 職歴を1件足した瞬間に変わる値なので、保存すると必ず古くなる
（`ow_profiles.experience_years` を自動計算に置き換えた 2026-08-07 と同じ理由）。
⚠️ **職歴0件は `null`（未算出）。「0年」で埋めない**（新卒と未登録が区別できなくなる）。

### `ow_career_profiles.birth_year` は参照しない

**生年は `ow_users.birth_date` の1系統に決めた。**
`ow_career_profiles.birth_year` は表示にも集計にも使わない（anon の GRANT も 2026-08-20 に外した）。

⚠️ **両方に値があり、年が食い違っている実ユーザーが1人いる**（2026-08-19 実測）。
   **データは書き換えていない。** どちらが本人の申告か確認が要る → docs/todo.md

---

## ⚠️ ow_transitions は導出テーブル。直接 INSERT しない（2026-08-20 追加）

「会社が変わった隣接ペア」を WHERE 句で引けるようにするための表。
**バッチで全件洗い替えする導出データ**で、アプリからは書かない。

| | |
|---|---|
| 洗い替え | `select public.rebuild_ow_transitions();`（**冪等**。戻り値は行数） |
| 実行 | **いまは手動のみ。** cron もトリガーも張っていない |
| 権限 | **anon / authenticated に GRANT しない。** 読むのは admin クライアントだけ |
| RLS | 有効。**ポリシーは1本も無い**（誰にも開いていないので書くべきものが無い） |

⚠️ **トリガーにしない。** 遷移は隣接ペアなので職歴を1行足すと前後も作り直しになり、
   `age_at_move` は `birth_date` 依存（職歴と無関係に後から入る）で拾えない。

### ⚠️★`industry_change` は業種マスタ（`industry_id`）で判定する（2026-08-26 に移行）

**以前は `ow_companies.industry`(text) を読んでいた。** あの列は 2026-08-25 に
書き込み経路を閉じた廃止列で、以降に作られる企業では NULL。放置すると
新しい企業が絡む転職が**静かに `unknown` へ落ちる**状態だった。

⚠️ **DROP しても気づけない形だった。** 参照していたのは PL/pgSQL の本体で、
   Postgres は依存として追跡しない（`DROP COLUMN` は成功し、
   **関数を実際に呼ぶまで壊れたことが分からない**）。
   **列を落とす前に関数の本文を検索すること**が実際に効いた例。

⚠️ **判定結果は変わった。** 本番5行のうち**2行が `changed` → `unchanged`**。
   旧 `industry`(text) は名前に反して**業界ではなく製品・業務領域**
   （CRM・営業支援 / クラウドインフラ / コラボレーション）だったので、
   「セールスフォース → 伊藤忠テクノソリューションズ」を異業界転職と数えていた。
   **どちらも IT・ソフトウェアなので、これは訂正であって劣化ではない。**

⚠️ 「領域は変わったが業界は変わっていない」を区別したくなったら、
   **事業領域を使う別の列を足すこと。この列に混ぜない**（名前と意味がまたずれる）。

⚠️ 比較は **id で行う**（名前で比べると表記変更で判定が変わる）。
   `from_industry` / `to_industry` には業種マスタの**名前**を入れる（列型は text のまま）。

実測（2026-08-26 / 本番）: 5行 → `unchanged` 4 / `unknown` 1 / `changed` 0。
2回流して内容ハッシュ一致（冪等）。

⚠️ **`rebuild_ow_transitions()` は service_role でしか実行できない。**
   MCP の SQL 実行や anon では `42501 permission denied`。RPC で叩くこと。

⚠️ **`role_change` / `industry_change` は boolean ではなく3値**
   （`changed` / `unchanged` / `unknown`）。自由入力の企業は業種が引けないので `unknown`。
   **2値に潰すと「異業界に転職した人」が静かに少なく出る。**
   ⚠️ 2026-08-20 に `is_` を外した（実データ5行・参照コード0のうちに）。
      `is_` だと boolean と読まれ、`if (t.is_industry_change)` で
      **`'unchanged'` も truthy** になる。**`=== "changed"` で比べること。**

⚠️ **`age_at_move` で絞る機能を作らない。** 算出できるのは実ユーザー14人中4人だけ。
   主軸は `years_of_experience_at_move`。年齢での絞り込みを企業に出さない方針とも揃える。

⚠️ **洗い替えの `DELETE` に `WHERE true` を必ず書く。** Supabase は `safeupdate` が有効で、
   WHERE の無い DELETE は PostgREST 経由で 21000 になる。
   **SQL で直接呼ぶと通るので、RPC で1回叩くまで気づけない**（2026-08-20 に踏んだ）。

実測（2026-08-20 / 本番）: 隣接ペア9 → **会社が変わる5行**（両側マスタ4 / 自由入力を含む1）。
3値の内訳は changed×changed 2 / changed×unchanged 1 / unchanged×unchanged 1 / changed×unknown 1。
2回流して内容ハッシュ一致。

---

### ⚠️★複合FK のテーブルは PostgREST の埋め込みが使えない（2026-09-04 確立）

**`ow_company_target_industries` は `ow_companies!company_id(...)` で埋め込めない。**

```
Could not find a relationship between 'ow_company_target_industries' and 'ow_companies'
in the schema cache
```

原因は、この表から `ow_companies` への外部キーが**複合FK**だから
（`(company_id, target_industry_scope) → ow_companies(id, target_industry_scope)`。
「明細を持てるのは `vertical` の企業だけ」を構造で担保するために 2026-09-04 に入れた）。
**PostgREST は複合FKを埋め込みの関係として解決できない。**

→ **2段に分けて `.in("id", ...)` で引く。**

```ts
// ✗ 埋め込み（複合FKでは解決できない）
.from("ow_company_target_industries")
.select("industry_id, ow_companies!company_id(id, name)")

// ✓ 2段に分ける
const { data: links } = await db.from("ow_company_target_industries").select("industry_id, company_id");
const ids = Array.from(new Set((links ?? []).map((r) => r.company_id)));
const { data: companies } = await db.from("ow_companies").select("id, name").in("id", ids);
```

⚠️★**`error` を見ていれば気づけるが、`?? []` で受けると「0件」に化ける。**
   PostgREST は 200 で返すので、**画面は「該当なし」として正常に見える。**
   実際に 2026-09-04 に踏み、`console.error` を出していたおかげで即座に分かった
   （下の「`?? ""` を挟んだ後の `?? フォールバック`」と同じ形。**既定値が事実を潰す**）。

⚠️ **この形のテーブルを増やすたびに同じ穴を踏む。** 複合FKで整合を担保する表を作るときは、
   **埋め込みを使わない前提で読み取り側を書くこと。**

---

### ⚠️★`?? ""` を挟んだ後の `?? フォールバック` は**永久に効かない**（2026-08-25 記録・フェーズ2で直す）

```ts
// mapper 側（queries.ts:55）
industry: (row.industry as string) ?? "",      // NULL → 空文字に化ける
// 表示側（companies/[id]/page.tsx:154）
`${company.industry ?? "IT/SaaS"}`             // "" ?? x は "" 。★フォールバックが出ない
```

`??` が拾うのは **null / undefined だけ**。mapper が先に `?? ""` で潰していると、
表示側のフォールバックは**書いてあるのに一度も発火しない。**

⚠️ **`?? false` / `?? 0` も同じ形。** とくに **SELECT していない列**に当たっていると、
   「値が無い」ではなく「取得していない」が既定値に化けて、
   **画面には正常な値として出る**（CLAUDE.md「経歴に列を足すときは4箇所を揃える」と同根）。

**✅ 既知の3件は 2026-08-26 に解消した**（事業領域への移行と同時）。直し方は3件とも同じで、
**フォールバックを足すのではなく、ある項目だけを集めて `join` する**形にした。

| 場所 | 直す前の症状 |
|---|---|
| `companies/[id]/page.tsx` の meta | 「タグライン**｜・**約200名。」になる |
| `jobs/[id]/page.tsx` の会社名の横 | 「** · 約200名**」と先頭に区切りが残る |
| `jobs/[id]/page.tsx` のサイドバー | 「**業種 **」だけ出る（隣の「従業員」には `?? "—"` があった） |

```ts
// ✗ 区切りを先に書く（空のとき区切りだけが残る）
`${a}${b ? ` · ${b}` : ""}`
// ✓ ある項目だけ集めて join する
[a, b].filter(Boolean).join(" · ")
```

⚠️ **★横展開はまだ済んでいない。** 上の3件は「気づいた分」であって、洗い出した結果ではない。
   探すのは「`?? ""` した値に、後段で `??` を重ねている箇所」と
   「COLS 定数に無い列を mapper が `??` で埋めている箇所」。
   **COLS 定数と mapper を突き合わせる**のが確実（型では出ない）。

#### ⚠️★`/biz/company` の「変更を公開する」は、書いていない列を NULL で潰していた（2026-08-26）

企業側の企業情報は **`draft_data`(jsonb) に自動保存 → PATCH で本番列に展開**する2段構え。
その展開が `s(v) = typeof v === "string" ? v : null` だったため、
**`transformFormToDb` が書いていないキーはすべて `null` で上書きされていた。**

| PATCH が読むキー | draft_data にある名前 | 本番の件数 |
|---|---|---|
| `description` | **無い**（`about_markdown` に入る） | **82/87** |
| `founded_year` | `established_at` | **82/87** |
| `female_ratio` | `gender_ratio` | 1/87 |

⚠️ **企業が「変更を公開する」を1回押すだけで、自社の説明文と設立年が消えていた。**
   実害が出ていないのは `draft_data` が**全社 NULL** だからで
   （保存経路自体が 2026-08-23 まで RLS で0行更新だった）、**踏むのは時間の問題だった。**

##### 直し方: **キーが無いなら `undefined` を返して触らない**

`JSON.stringify` は `undefined` の値を持つキーを落とすので、PostgREST にも送られない
（`postgrest-js` の replacer は bigint 変換だけ。実装を読んで確認済み）。

⚠️ **「キーがあって空」と「キーが無い」を区別すること。**
   前者は利用者が消したので `null`、後者はフォームがその項目を持っていないので**触らない。**

##### ⚠️ 入力欄は生きているのに展開されていなかった6項目（同時に追加）

`notification_emails` / `company_features` / `nearest_station` /
`careers_url` / `funding_total` / `work_time_system`

⚠️ とくに **`notification_emails` は `lib/notify/recipients.ts` の第一優先の宛先**で、
   企業が設定しても**応募・面談の通知が届かないまま**だった（本番の設定は0社）。

⚠️ **`ow_companies` は UPDATE が列単位 GRANT。1列でも権限が無いと PATCH 全体が 403 になる。**
   ここに列を足すときは必ず `has_column_privilege` で測ること（6列とも true を確認済み）。

⚠️ **入力欄が撤去済みの項目をここに足さないこと**（評価制度・残業時間・有給取得率・
   働き方の補足・面談可能日時）。`transformFormToDb` は今もキーを吐くので、
   足すと**古い空値で上書きする**ことになる。

##### 残っている名前の食い違い（保留・上書きはされない）

`foundedAt → established_at` vs `founded_year` / `genderRatio → gender_ratio` vs `female_ratio` /
`会社概要 → about_markdown` vs `description`（求職者が読むのは後者）。
**どちらを正とするか決まっていないので展開していない。** 会社概要は markdown 前提の
入力欄なので `description` に素で入れると記号がそのまま出る（求人の
`description_markdown` と同じ問題）。**列の統合とセットで決めること。**

### ✅★列の2組問題は統合して解消した（2026-08-26 / migration 20260826160000）

**正 = データがある側**に寄せた。廃止側は **DROP せず COMMENT で【廃止】と印**を付けてある。

| 統合先（正） | 廃止 | データ移行 |
|---|---|---|
| `ow_jobs.required_skills`(text[]) | `requirements`(text) | **18件を分割して移行** |
| `ow_jobs.preferred_skills`(text[]) | `preferred`(text) | **5件** |
| `ow_jobs.selection_steps` | `selection_process` | 不要（0件） |
| `ow_jobs.description` | `description_markdown` | 不要（0件） |
| `ow_companies.description` | `about_markdown` | 不要（0件） |
| `ow_companies.founded_year`(int) | `established_at`(text) | 不要（既に入っていた） |
| `ow_companies.female_ratio` | `gender_ratio` | 不要（0件） |

⚠️ **`pickFilled()` は削除した。** 読む先が1つになったため。
   **【廃止】列を新しく読み書きしないこと。** 読む先が2つに戻る。

⚠️ **テキスト→配列の分割規則は `mapJob` と一致させること。** ずれると表示が変わる。
   実データ4件で SQL と JS の出力が一致することを確かめてから適用した。
   migration には事前・事後の件数チェックを入れてある（想定と違えば中止）。

#### ✅★markdown は描画側を対応させて解決した（2026-08-26）

**入力欄と描画がずれていた。** 企業側には `MarkdownEditor`（H2/H3 ボタン付き）と
「求人詳細（Markdown）」があるのに、描画は plain text で `##` が記号のまま出る状態だった。

→ **描画を markdown に対応させた**（入力欄はそのまま）。

| | |
|---|---|
| 描画 | [components/common/Markdown.tsx](src/components/common/Markdown.tsx)（`react-markdown` + `remark-gfm`。どちらも既存の依存） |
| 使う場所 | 企業ページの `detail.about` / 求人ページの `job.overview` |

⚠️★**入力欄と描画は必ずセットで変えること。** 片方だけだと
   「書けるのに出ない」か「記号がそのまま出る」のどちらかになる。**両方に注記を置いてある。**

##### ⚠️ 既存データは空行区切りに正規化した（migration 20260826200000）

実測（2026-08-26 / is_test を除く87社）: 説明文あり **82** / 改行を含む **9** /
空行区切り **0** / markdown 記法で始まる **0**。

**改行1つで段落を区切っていた9社は、markdown だと1段落に潰れる。**
そこで `\n` → `\n\n` に直した。⚠️ **見た目は変えていない** ——
以前の描画は改行1つを段落の区切りとして扱っており、markdown で同じ結果になるのが空行区切り。
つまり「今そう表示されているもの」を markdown で書き直しただけ。

⚠️ **`remark-breaks` は入れていない。単一改行を段落として扱う独自処理も入れない。**
   素の markdown として扱う。データ側を正規化したので不要。

##### ⚠️★日本語で `**強調**` が生のまま出る（2026-08-28 に3件踏んだ）

**`**` が約物（`「` `」` `。` `、`）と隣り合うと、CommonMark の強調にならない。**
`react-markdown` に限らず素の markdown の仕様で、**英語では起きない**。

| 形 | 結果 |
|---|---|
| `する**「転職について」…**取扱い` | ❌ **開始側が死ぬ**（`**` の直後が `「`＝約物、直前が文字） |
| `を**マイページの「意思表示」**に` | ❌ **終了側が死ぬ**（`**` の直前が `」`） |
| `変更されます。**内容は` | ❌ 同上（`**` の直前が `。`、直後が文字） |

規則は「開始の `**` は**直後が約物なら直前が空白か約物である必要がある**」
「終了の `**` は**直前が約物なら直後が空白か約物である必要がある**」。

**直し方は囲む範囲をずらすだけ。**

```markdown
✗ 受け取りは、登録直後におたずねする**「転職について」に答えた場合に有効**です。
✓ 受け取りは、**登録直後におたずねする「転職について」に答えた場合に有効**です。
✗ 設定場所を**マイページの「意思表示」**に改めます。
✓ 設定場所を**マイページの「意思表示」に**改めます。
✗ 変更されます。**内容は冒頭を…                （直前が 。）
✓ 変更されます。** 内容は冒頭を…               （直後に空白）
```

⚠️ **`tsc` も lint もビルドも通る。画面に `**` が出るまで気づけない。**
   markdown を書いたら**描画結果に生の `**` が無いこと**を数えて確かめる。

```js
// 実画面で（0 であること）
(document.querySelector('main').innerText.match(/\*\*/g) || []).length
```

⚠️ 対象は `content/legal/*.md`（規約）だけでなく、
   **企業説明・求人本文**（2026-08-26 に markdown 化）も同じ。

⚠️ 求人（`ow_jobs.description`）は**対象外**。本番5件とも改行を含まない。

##### 検証（実画面で確認したこと）

| | |
|---|---|
| 段落構成 | SmartHR / Ubie / Datadog は**2段落**、Salesforce は**1段落**（変換前と同じ） |
| 記号 | `##` などが生で出ていないこと |
| markdown の解釈 | 見出し・太字・リンク・箇条書きが解釈されること（コンポーネント単体で確認） |
| 求人 | 本文が消えていないこと |

#### 検証（実画面で確認したこと）

| | |
|---|---|
| 求職者側 | 公開求人5件で必須・歓迎・選考フロー・本文が**移行前と同一**／企業3社の「企業について」も同一 |
| **企業側** | `/biz/jobs/[id]/edit` に**移行後の必須スキル・歓迎スキル・選考フローが入っている**（統合前は空だった） |

#### ⚠️★求人は列が2組ある。企業が書く列と求職者が読む列が違う（2026-08-26 発覚）

**`/biz` の求人フォームが書く列と、求職者側 `mapJob` が読む列が別名で並存している。**

| 企業が書く（`PUT /api/biz/jobs/[id]`） | 旧データがある | 実データ（2026-08-26 / 20件） |
|---|---|---|
| `required_skills`(text[]) | `requirements`(text) | 0 / **18** |
| `preferred_skills`(text[]) | `preferred`(text) | 0 / **5** |
| `selection_steps`(text[]) | `selection_process`(jsonb) | **7** / 0 |
| `description_markdown`(text) | `description`(text) | 0 / **5** |

⚠️ **実害が出ていた。** `selection_steps` を持つ7件のうち**5件が公開中**で、
   求職者側は `selection_process`(0件) しか読んでいなかったため、
   **公開中の求人5件すべてで「選考フロー」が一度も表示されていなかった**
   （6ステップ入っていた: 書類選考 → 電話スクリーニング → … → 内定）。

##### ★`??` ではなく `pickFilled()` を使う

**`PUT /api/biz/jobs/[id]` は未入力でも空配列を書く**（`Array.isArray(...) ? ... : []`）。
`[] ?? 旧列` は `[]` を返すので、**企業が別の項目を保存しただけで旧データが永久に隠れる。**

⚠️ 2026-08-26 に歓迎スキルの表示を直した直後、**企業が1回保存すればまた消える**と
   分かったのがこの関数を入れた理由。`??` のままだと修正が黙って巻き戻る。

```ts
const prefRaw = pickFilled(row.preferred_skills, row.preferred);  // 空配列も「無い」扱い
```

⚠️ **企業側の列を先に置く。** 企業が編集した内容が旧データに負けてはいけない。

⚠️ ~~**`description_markdown` は `pickFilled` に入れていない。**~~
   ✅ **2026-08-26 に `description` へ統合して解消した**（`20260826160000`）。
   `description_markdown` は**【廃止】列**で、`pickFilled` ごと削除されている。
   **「企業が本文を書いた日に求職者側へ何も出ない」状態はもう無い**（2026-08-30 確認）。
   ⚠️ **【廃止】列を新しく読み書きしないこと。** 読む先が2つに戻る。

##### ⚠️ 本来は列を統合するべき

2組あること自体が事故の原因で、`pickFilled` は対症療法。統合するときは
**マイグレーション＋両側のコード**をまとめて変えること。片側だけ直すと
「保存できるのに出ない」か「出るのに保存できない」のどちらかになる。

#### ★COLS 定数と mapper を突き合わせる（2026-08-26 実施）

**「SELECT していない列を mapper が `??` で埋めている」箇所は、`??` の型検査では見つからない。**
`Record<string, any>` の行なので型は `any` のままで、**取得していない値が既定値に化ける。**

```bash
# COLS 定数 → その行を受ける mapper の `row.X` を突き合わせる
#   ⚠️ COLS は3通りの書き方で他の COLS を参照する。1つでも解決し損ねると
#      基本列（id / name）まで「無い」と出て**誤検出だらけになる**（実際に2回踏んだ）:
#        `[...OTHER_COLS.split(", "), ...]` / `[OTHER_COLS, ...]` / 素の参照
```

⚠️ **LIST 版に詳細専用の列が無いのは設計どおり。** 出た列がそのまま不具合ではない。
   **「その列を一覧の画面が読んでいるか」まで確かめて初めて判定できる。**

##### 実測（2026-08-26 / 6組を突き合わせ）

**2件の実害が見つかった。どちらも画面はエラーを出さない。**

| 何が | 症状 |
|---|---|
| **`preferred`（歓迎スキル）** | `mapJob` は `preferred_skills ?? preferred` で組み立てるが、**どちらの COLS にも `preferred` が無かった。** 実データは `preferred_skills`(配列) が**本番20件すべて空**で、`preferred`(text) に**5件**——つまり**公開中の求人5件すべて**。**求人詳細の「歓迎スキル」が一度も表示されていなかった**（空配列だと節ごと消えるので、欠けていることに気づけない） |
| **`description` / `what_youll_do_intro`** | `JOB_LIST_COLS` に無く、`/jobs` の並び替え「開示充実順」の `j.overview.length > 100`（1点）が**全求人で一律に発火しない**。順位は変わらないので画面では気づけない（「全社同値の列で並べ替えている無意味な処理」と同じ形） |

⚠️ **`required_skills` は同じ形だが本番0件**なので取っていない。実データは `requirements` 側。

⚠️ **`?? ""` だけを探すと足りない。** `?? false` / `?? 0` も同じ形で、
   とくに **SELECT していない列**に当たっていると「値が無い」ではなく
   「**取得していない**」が既定値に化け、**画面には正常な値として出る。**

#### ★★既定値の点検（2026-08-28 に全マッパーを洗った結果）

**`?? ""` より `?? 0` / `?? 5` のほうが危ない。** 空文字は「空である」意味が保たれるが、
数値の既定は**「値が無い」を「測った結果」に化けさせる**。

##### 1. `employee_count ?? 0` — 「0名の会社」（`2ad7eb31` で解消）

`mapCompany` が **`(row.employee_count as number) ?? 0`** で NULL を 0 に倒し、
**未入力の企業の詳細ページに「従業員数 0名」**と出していた（空の企業は5社・うち公開2社）。

⚠️★**根は「型が嘘をついていたこと」。** `Company.employee_count` は mock 由来で `number`
   だが、**DB の `ow_companies.employee_count` は text**（「約200名」）。
   **`as number` のキャストが食い違いを隠していた**ので、tsc も lint も何も言わなかった。

⚠️★**`/jobs` の「社員数順」は、そのせいで動いていなかった。**
   `bE - aE` を**文字列同士で**計算して **NaN** を返しており、
   比較関数が NaN を返すと**並び順は事実上変わらない**。
   **画面を見ても気づけない壊れ方**（順番が変わらないだけ）。
   ⚠️ 数が読めないものは **`-1` で末尾**に置く。**`0` にしない**（「0名」と同義になる）。

##### 2. `read_min ?? 5` — 「5分で読める」（2026-08-28 に解消）

`mapDbArticle` が未入力の記事に **5** を入れ、「**5分で読める**」「**読了5分。**」
（meta description にも）と、**測っていない数字を事実として出していた。**

⚠️★**表示側は正しくガードしていた**（`{article.read_min && …}` が9箇所）。
   **マッパーが潰すので、そのガードが永久に発火しない。**
   ——「`?? ""` を挟んだ後の `??` は効かない」と同じ構図。

⚠️★**DB 側にも `DEFAULT 5` があった**（`20260828160000` で外した）。
   **コードだけ直しても DB が埋める。両方見ること。**

##### 3. ★tsc は「ガード無しの表示」を拾わない

型を nullable にしたとき **tsc が落ちるのは計算に使っている箇所だけ**。
**JSX に直接埋めている箇所やテンプレート文字列は素通りする**
（`` `読了${n}分。` `` は null でも型エラーにならない）。

実測（`read_min` を `number | null` にして計測）:

| | |
|---|---|
| **tsc エラー** | **2件・1ファイル**（降順ソートの `b.read_min - a.read_min` だけ） |
| **tsc が拾わなかった表示** | **4箇所**（meta のテンプレート文字列1・JSX 直埋め3） |

→ **既定値を外すときは、tsc の件数とは別に「その列を表示している箇所」を grep で全部見る。**
⚠️ 区切り文字を残さないこと。「読了**分**。」「** min read**」のように**単位だけ残る**。
   ある項目だけ集めて `join` する形にする（OGP の `industry ?? ""` と同じ罠）。

##### 4. 真偽列の `?? false` は**41箇所すべて発火しない**（2026-08-28 実測）

`accepting_casual_meetings` / `is_published` / `jobs_public` / `show_fit_negatives` /
`is_current` / `visibility_salary` / `visibility_reason` / `is_ambassador` /
`display_consent` / `is_public` / `requires_business_domain` / `is_test` / `is_system`
は**すべて NOT NULL**。**冗長なだけで危険は無い。**
⚠️ nullable なのは **`ow_profiles.scout_enabled`** だけで、**`??` を当てているコードは0件**
   （`can_send_scout()` が NULL を false 扱いにする設計どおり）。

##### 5. ✅ スカウト枠の「30通」は解消した（2026-08-29 / `ab1fba42`）

`quotaRow?.monthly_limit ?? 30` が、行の無い86社すべてに「**30 通**」を
**設定された値であるかのように**出していた件。

⚠️★**ただし「30」は嘘ではなかった。** `ow_scout_quotas.monthly_limit` には
   **`DEFAULT 30`** があり、`can_send_scout()` が最初の送信時に行を作るので、
   **行が無い企業に実際に効く値が 30**。捏造ではない。
   問題は「**運営が決めた 30**」と「**まだ決めていない**」が画面から区別できないこと。

→ [lib/constants/scoutQuota.ts](src/lib/constants/scoutQuota.ts) に
   `SCOUT_MONTHLY_LIMIT_DEFAULT` を置き、表示側は **`configured`（行が実在するか）**を
   別に持って区別する。`usedThisMonth()` も同ファイル。

⚠️ この定数は **DB の `DEFAULT 30` と二重管理**。片方だけ変えると食い違う。
   **migration と定数を同じコミットで動かすこと。**
⚠️ **行を作るコードに `monthly_limit` を書かない**（DB の DEFAULT を通らなくなる）。
   運営が上限を明示して作るとき（`updateMonthlyLimit`）だけ書いてよい。
⚠️★**月次リセットはトリガーでも cron でもない。** `can_send_scout()` の中だけ。
   つまり**次に誰かが送信するまで先月の数字が残る**ので、表示は必ず
   `usedThisMonth()`（`period_start` が今月でなければ 0 に倒す）を通す。

#### ★洗い方は grep ではなく型で（2026-08-26 確立）

**プロパティ名で grep すると誤検出だらけになる**（別の型の `.name` 同士が当たる。
実測で 225 件出て、ほぼ全部が無関係だった）。
**型情報を使えば確定できる** —— `?? ""` を通った後の型は `string` で null にならないので、
**「非 null に `??` を重ねている」は型だけで判定できる。**

```bash
# ⚠️ 一時設定はリポジトリ直下に置く（プラグイン解決のため）。**使ったら即消す**
#    （並行セッションの git add -A に拾われる）
cat > .eslintrc.tsaware.json <<'JSON'
{ "root": true, "parser": "@typescript-eslint/parser",
  "parserOptions": { "project": "./tsconfig.json" },
  "plugins": ["@typescript-eslint"],
  "rules": { "@typescript-eslint/no-unnecessary-condition": "warn" } }
JSON
npx eslint --no-eslintrc -c .eslintrc.tsaware.json --ext .ts,.tsx --format json src
rm -f .eslintrc.tsaware.json
```

##### ⚠️★出た結果を2つに分ける。**片方は誤検出**

| | 形 | 実行時 |
|---|---|---|
| **(A) 誤検出** | `(row.name as string) ?? "—"` | **`??` は正しく発火する。** `as` が嘘をついて型から null を消しているだけ |
| **(B) 本物** | `job.highlight ?? "…"`（`highlight` は mapper が `?? ""` 済み） | **一度も発火しない** |

**(A) を直しにいかないこと。** DB 行（`Record<string, any>`）に `as string` を当てている
箇所はすべて (A) で、**動作は正しい。**
見分け方は **左辺の出どころ**を読むこと —— DB 行なら (A)、mapper を通った型なら (B)。

⚠️ 2026-08-26 に実際に (A) を1件バグと誤判定しかけた
   （`getCompanyRecruiters` の `(user.name as string) ?? "担当者"`。
   `user` は DB 行そのものなので **null になりうる＝正しい**）。

##### 実測（2026-08-26 / src 全体）

`??` の不要条件 **319 件** → うちフォールバックが空文字などでない
「**出るはずだったのに出ない値**」が **82 件** → 読んで (B) と確定したのは **2 件**。

| 直したもの | 症状 |
|---|---|
| `jobs/[id]/page.tsx` の meta | `job.highlight ?? "○○社の△△求人"` が発火せず、キャッチコピーの無い求人の meta が**年収から始まる**。公開5件は全部持っているが**下書き15件中2件が該当** |
| `lib/matching/scoreJob.ts` | `job.salary_max ?? jMin` が発火せず jMax が 0 のまま。**下限だけ書いてある求人が年収の加点から丸ごと外れていた** |

⚠️ **どちらも `??` を `||` に変えて直した。** mapper 側の `?? ""` / `?? 0` を外すと
   型が `string | null` に変わって呼び出し側に波及するため、
   **読む側で「空も無しとして扱う」ほうが安全。**
   ⚠️ ただし `||` は 0 も falsy にする。**0 が意味を持つ値には使わないこと。**

---

## データ表示の原則

「値が無い」ことを、「ある値」に置き換えない。

- 値がある → 値を出す
- 値が無い → 項目ごと非表示にする、または「—」で不明と示す
- ×        → 値が無いのにデフォルト値や推測値を表示する

2026-07-27〜28 に見つかった事例:
- queries.ts が存在しないカラム(birth_year)を参照し、
  エラーを if (error) return [] で握りつぶして「社員0名」と表示していた
- migration が remote_work_status='hybrid' を64社に一括投入し、
  未確認の値を「ハイブリッド」として公開表示していた
- deriveWorkStyles() が NULL のとき ["ハイブリッド"] を
  フォールバックとして生成していた（dead code として削除済み）

flex_time / side_job_ok について（2026-07-28 記録）:
- migration 156 で全64社に flex_time=true / side_job_ok=false が設定されているが、
  現在これらのフィールドは画面に表示されていないため公開影響なし
- 将来 flex_time / side_job_ok を表示する際は必ず三値対応にすること
  （NULL → 項目ごと非表示、true / false → それぞれ表示）

空欄を避けようとする実装が、結果として誤情報を作る。
空欄はそのまま空欄にすること。

---

## エラーと失敗を握りつぶさない原則（2026-07-28 確立）

### 発見された「サイレント失敗」の事例（6件）

1. **birth_year カラム参照エラー**（queries.ts → getCompanyEmployees）
   - 存在しないカラムを SELECT し、`if (error) return []` でエラーを握りつぶして「社員0名」を返していた

2. **remote_work_status migration 一括投入**（migration 156）
   - 64社に未確認値を一括設定し、誤情報として公開表示されていた

3. **deriveWorkStyles() の NULL フォールバック**（queries.ts）
   - NULL のとき `["ハイブリッド"]` を生成するフォールバックが存在し、事実と異なる値を表示していた（削除済み）

4. **OnboardingClient の ow_experiences INSERT**（onboarding/OnboardingClient.tsx）
   - `role_category_id` NOT NULL 制約により毎回 DB エラーが発生していたが、`catch {/* best-effort */}` で握りつぶされていた
   - 会社名は入力させていたが、INSERT が常に失敗するため **どこにも保存されていなかった**
   - ✅ **解消済み（2026-08-02 確認）**: 失敗する INSERT は削除され、理由がコメントに明記されている。
     ただし会社名入力欄自体は残っており、求職者にとっては現在も保存先がない（後述の「オンボーディングの現状」参照）

5. **StrengthsFinder UI**（profile/edit/ProfileEditClient.tsx）
   - 34テーマの選択 UI があり、最大5件選択できたが、`handleSaveBasic` で API に送信していなかった
   - DB カラム `ow_users.strengths_finder` 自体が存在しない
   - **入力させて捨てていた**（UI 削除済み）

6. **オンボーディングの会社名入力**（onboarding/OnboardingClient.tsx）
   - 事例4の ow_experiences INSERT が唯一の保存先だったため、INSERT 失敗後は **会社名がどこにも保存されない**
   - ユーザーには「会社名を入力してください」と促していたが、入力値が消えていた

### 実装原則

- `catch {}` で握りつぶさず、最低限 `console.error` でログを出す
- `data ?? []` や `data ?? null` だけを見てエラーを無視しない（`error` を必ずチェックする）
- 「入力させたのに保存しない」UI を作らない
- 保存経路（API 呼び出し・DB INSERT）が無い入力 UI は実装しない
- UI を先に作る場合は、保存先が未実装であることをコメントに明記する

---

## オンボーディングの現状（2026-08-10 更新・これが正）

**2026-08-02 版の「会社名は保存されない」は解消済み。** 以下が現在の実態。

### 画面構成：1画面のみ

`src/app/onboarding/OnboardingClient.tsx` は**単一画面**。
見出しは「現在お勤めの会社を教えてください」。ステップ分岐は無い。

聞くのは3つ。**会社を選ぶまで職種・入社年月は出さない**（入口の摩擦を増やさないため）。

| 項目 | 備考 |
|---|---|
| 会社 | マスタ検索 or 自由入力。どちらも可 |
| 職種 | **親18件をチップで出し、押すとその親の子だけが開く**（2026-08-29 に変更）。⚠️ **子は任意。親のままでも保存できる。** `merged_into_id is null` かつ `is_active` の除外は維持。実測: 親18 / 子130 |
| 入社年月 | 年 + 月。`started_at` は `YYYY-MM` で送る |

### 保存されるもの

```
ow_profiles.onboarding_completed = true
ow_experiences に1件（3つ揃ったときだけ）
```

⚠️ **3つ揃わなければ経歴は作らない。** 中途半端な行を作らない。
   そのかわり「職種と入社年月を選ぶと経歴として保存されます」と**画面に出す**。
   黙って捨てると、2026-08-02 に指摘された「入力させたのに保存しない」に戻る。

⚠️ 経歴の保存は best-effort。失敗してもオンボーディング自体は完了させるが、
   握り潰さず画面にもログにも出す。

⚠️ **`role_category_id` は親カテゴリの UUID をそのまま入れてよい。**
   求人ページ側の突き合わせは親↔子の両方向に対応済みなので、
   ここで子職種まで選ばせる必要はない
   （上の「求人 ↔ 人の紐付けは職種を介して導出する」を参照）。

### ⚠️★2026-08-29 に子職種も選べるようにした（**トップレベルのみに戻さないこと**）

**理由は「職種 × 年数」の自動計算。** その集計は**子職種だけを見る**ので
（親と子が並ぶと重複に見えるため）、ここが親しか出していないと
**新規登録した人の職種スキルが1件も出ない。**
実測（2026-08-29）: `ow_experiences` 24件のうち **親職種が10件**。

⚠️ **入口の摩擦は増やしていない** —— 親チップ18件は今までどおりで、
   **押したときにその親の子だけが開く**（子は3〜14件）。子を選ばず親のまま進んでよい。
⚠️ **148件をフラットに並べないこと。** 2026-08-06 に職歴エディタで
   「105件を目視で探させるUIが機能していなかった」と分かっている。
⚠️ **親チップに子の名前を出さないこと**（2026-08-29 に一度やって戻した）。
   親チップと子チップが**同じラベルで2つ並び**、どちらを押しているか分からなくなる。
   選ばれた子は**下の行でハイライト**して示す。

⚠️ トップレベルは **18件**（2026-08-28 実測）。2026-08-10 は17件、
   それ以前は「9件」と書いてあった。**数字は増えるので、書くときは必ず日付を添える。**

### 公開範囲

既定は `real`（既存14件中13件が real で、企業ページに出るのが本人の目的に沿うため）。
「会社名は伏せる」チェックで `masked` にできる。

⚠️ **どこに出るかを保存前に画面へ明記すること。**
   「その企業のページに『現役社員』として表示されます」と、
   「見えるのは OPINIO にログインしている人だけ」の両方を出している。
   `ow_users.visibility` が全員 `login_only` なので後者は事実。

### ow_experiences の INSERT 経路

| 経路 | 状態 |
|---|---|
| `POST /api/jobseeker/experiences` | ✅ **唯一の INSERT 経路** |
| `/profile/edit` の `CareerHistoryEditor` | 上の API を呼ぶ |
| オンボーディング | 上の API を呼ぶ（2026-08-10 追加） |

⚠️ 必須は3点だけ: `company_id` **XOR** `company_text` **XOR** `company_anonymized` /
   `role_category_id` / `started_at`（`YYYY-MM`）。
   会社を2つ送ると 400（XOR 制約 `experience_company_xor`）。

---

## ⚠️ 経歴に列を足すときは4箇所を揃える（2026-08-12 確立）

**編集画面は draft をそのまま PUT で送り、PUT は送られなかった列を null に上書きする。**
初期取得の SELECT で1列でも取り忘れると、
**利用者が別の項目を直して保存した瞬間にその列が消える。**

| # | 触る場所 |
|---|---|
| ① | `EXPERIENCE_EDITOR_COLS`（SELECT の列リスト） |
| ② | PUT / POST の update / insert オブジェクト |
| ③ | `Stint` 型（`CareerHistoryEditor.tsx`） |
| ④ | `draftFromStint()` と `StintDraft` / `EMPTY_DRAFT` |

**①だけ足しても draft に載らなければ意味がない。④まで通すこと。**

⚠️ **列リストは [src/lib/experiences/columns.ts](src/lib/experiences/columns.ts) の1箇所に置く。**
   ページや API に直書きしない。`profile/edit/page.tsx` と
   `GET /api/jobseeker/experiences` が同じ定数を見る。

⚠️ **値が取れないのは「取得漏れ」なので、`?? 既定値` に倒さず型で落とす。**
   DB が NOT NULL の列（`visibility_*`）を既定値で埋めると、同じ事故が再発しても
   黙って通る。既定値が要るのは新規作成時だけなので `EMPTY_DRAFT` に置く。

→ 同じ事故を3回起こしている。経緯は columns.ts の冒頭コメント

---

## ⚠️ `.select()` には文字列リテラルを渡す（2026-08-12 確立）

**列リストを配列で持って `.join(", ")` で渡さないこと。**

`join()` の戻り値の型は `string` なので supabase-js が select を型解決できず、
**行の型が `GenericStringError` に化ける**。`tsc` が20件以上のエラーを出す。

```ts
// ✗ 型が落ちる
const COLS = ["id", "name"].join(", ");
// ✓
const COLS = "id, name" as const;
```

見た目より型が通ることを優先する。1本の文字列リテラル + `as const`。

---

## ⚠️ プロフィール登録への導線（2026-08-10 に4本まとめて修正）

**招待した人が最初に通る導線が、まとめて壊れていた。** 同じ形の不具合なので並べて記録する。

| # | 何が壊れていたか | 症状 |
|---|---|---|
| 1 | `/mypage` の公開促進バナーが **`/profile/start`** を指していた | **404**。そのページは存在しない |
| 2 | 同バナーの表示条件が `ow_users.profile_setup_at` | **書くコードがどこにも無い**（API は受け付けるが送るクライアントが無い）。26人中22人に永久表示 |
| 3 | 完成度バーが `/profile/edit#career` の**ハッシュ**を組んでいた | ページは `?tab=` しか見ないので、**どの項目を押しても「基本情報」に着地** |
| 4 | `UserProfileCard` が `?tab=socials` | 実在しないキー（正しくは `socials_content`）。既定の「基本情報」に落ちる |

### 原則

**リンク先が実在するか、そこに本当に着地するかを確かめること。**
1〜4 はいずれも「押せるが、行き先が違う／無い」形で、HTTP も型も通る。
**画面を押して着地を確認するまでは直ったと言えない。**

⚠️ `/profile/edit` のタブは **`?tab=` のみ**。ハッシュは見ていない。
   有効なキーは `ProfileEditClient` の `VALID_TABS`（basic / career / preferences /
   certs_achievements / socials_content / privacy / account）。
   `completion.ts` の `ScoreItem.tab` もこの素のキーで持つ（`#` を付けない）。

⚠️ **バナーの表示条件は「書かれない列」に依存させない。**
   いまは本文で約束している3点（名前・自己紹介・職歴）が埋まっているかから導出している。
   文言と条件が同じものを見ているので、ズレようがない。

⚠️ `ow_users.profile_setup_at` は**未使用のまま残してある**（列は消さない方針）。
   使い始めるなら、書き込む経路を同時に作ること。

---

## ⚠️★2階層マスタの `display_order` は「親ごとの相対順」（2026-09-05 確立）

**対象は `ow_roles`（職種）と `ow_industries`（業種）の2つ。同じ形なのでまとめて書く。**

`display_order` は**全体の通し番号ではなく、親の中での順序**。
したがって **`ORDER BY display_order` だけで並べると親子が混ざる。**

### ★実測（2026-09-05 / 本番）

```
ow_industries … GET /api/industries の生の並び
  IT・ソフトウェア → 電子機器・半導体 → 電機・機械 → 製造業 → 通信 → 素材・化学 → …
                     ^^^^^^^^^^^^^^^^   ^^^^^^^^^^   ^^^^^^        ^^^^^^^^^^
                     子が親より先に出て、親（製造業）が子の後ろに落ちている

ow_roles … 生の並びの先頭10件が**全部子**
  データサイエンティスト → AI・機械学習エンジニア → CEO・代表取締役 → …
```

⚠️ `ow_roles` の子には **`display_order = 0`** の行があるので、
   フラットに並べると**子が先頭に来る**。「たまたま親が先に来ている」ことも無い。

| | 親の範囲 | 子の範囲 |
|---|---|---|
| `ow_roles` | 1〜18 | **親ごとに 0〜26** |
| `ow_industries` | 1〜18 | **親ごとに 1〜4**（親を持つのは「製造業」だけ） |

### 守ること

- **業種**: `flattenIndustryOptions()`（`lib/companies/industries.ts`）か
  **`<IndustrySelectOptions>`**（`components/companies/IndustrySelectOptions.tsx`）を通す。
  ⚠️★**`GET /api/industries` の応答をそのまま並べない。**
- **職種**: `buildRoleTree()`（`lib/roles/jobRoles.ts`）で木に組んでから出す。
  `RolePicker` / `IntentCard` / `/admin/roles` はすべてこれを通している

⚠️ **通し番号に振り直さないこと。** 親の下に値を1つ足すたびに、
   その親より後ろの全行を採番し直すことになる。

⚠️ 並びが「なぜか変」に見えたら、**まず木に組んでいるかを疑う。**
   データではなく描画側の問題であることが多い。

⚠️★**祖先展開はどちら側に掛けるかが2つで逆。混同しないこと。**

  | | 展開する側 |
  |---|---|
  | **職種** | **求人側**（`expandWithAncestors`）。本人側は自分と親までしか見ない |
  | **業種** | ★**本人側**（`expandIndustryWithAncestors`）。企業の対象業界は展開しない |

  どちらも**兄弟に広げないため**の規則だが、向きが逆なので**関数を共有していない**
  （`lib/companies/industryTree.ts` の冒頭に理由がある）。
  **共通化しないこと。** 共有すると「職種と同じだから」ともう片方の規則を当ててしまう。

---

## 求人 ↔ 人の紐付けは職種を介して導出する（2026-08-10 確立）

**求人とユーザーを直接繋ぐテーブルは作らない。** 求人は職種を持ち（`ow_job_roles`）、
経歴も職種を持つ（`ow_experiences.role_category_id`）ので、職種を介せば自動で繋がる。
直接紐付けると、経歴が増えるたびに貼り直しが要る。

対象は「**その企業 × その求人職種を経験しているユーザー**」。会社横断ではない。
実体は `getJobEmployees(companyId, roleCategoryId)`。

### ⚠️ 判定は「同じ系統か」を両方向で見る

`ow_roles` は **2階層**（トップ17 / 子126。孫はいない）。

| 求人 | 本人 | 出す？ |
|---|---|---|
| 親 | 子 | ✅ |
| 子 | **親** | ✅ **2026-08-10 まで取りこぼしていた** |
| 同じ | 同じ | ✅ |
| 子 | **兄弟**（同じ親を持つ別の子） | ❌ **出さない**。別の職種なので |

⚠️ 「子の求人 × 親で登録した人」は**入力ミスではない**。
`role_category_id` には親カテゴリの UUID をそのまま入れてよい仕様で、
企業ページ側（`CurrentEmployeesSection`）は親集約に対応済みだった。
**求人ページ側だけが対応していなかった。**
**2026-08-28 実測**: 公開求人5件は**全部が子職種**、経歴24件中**10件**が親職種のまま
（2026-08-10 は公開求人18件・経歴14件中2件だった。求人は出典なし13件を取り下げたぶん減っている）。

⚠️ 兄弟を拾わないために、**求人側だけ祖先展開し、本人側は自分と親までしか見ない**。
両方を展開すると同じ親を共有する兄弟が一致してしまう。

### ⚠️ ボトルネックはコードではなくデータ（2026-08-10 実測）

判定を直しても**表示は1人のまま変わらなかった**。理由は突き合わせる材料が無いこと。

| | 件数 |
|---|---|
| `ow_experiences` | **24件 / 実ユーザーぶん13件・実人数4人**（2026-08-28 実測。2026-08-10 は14件/5人） |
| 公開求人がある企業 | 7社 |
| 経歴が1件でもある企業 | 6社 |
| **両方ある企業** | **1社だけ** |
| 実際に一致する人（延べ） | **1人** |

⚠️ さらに経歴を持つ5人は**全員 `login_only`**。未ログインと検索エンジンには誰も見えない。
広げるなら同意の設計が要る（「設定の意味を後から拡大しないこと」2026-08-04）。

### ✅ `ow_experience_roles` は配線済み（**2026-08-28 に訂正**）

⚠️★**ここは「未配線」「アプリから一度も読み書きされていない」と書いてあったが誤り。**
   `/api/jobseeker/experiences` が**読みも書きもしている**（GET で `is_primary` 降順に
   引き、POST/PUT で INSERT する）。2026-08-10 に6件だった行が **2026-08-28 に10件**に
   増えていたのは、**実際に書かれているから**だった。

経歴↔職種の多対多テーブル。**2026-08-28 実測で10行**、`role_category_id` は 24/24件。

| | |
|---|---|
| 読み | `GET /api/jobseeker/experiences`（`is_primary` 降順） |
| 書き | `POST` / `PUT`。⚠️ **職種が1つのときは書かない**（`role_category_id` と重複するだけで、「複数選んだ」と「1つだけ」を後から見分けられなくなる） |
| クライアント | ⚠️ **admin。** RLS は SELECT のポリシーしか無く、`authenticated` の INSERT は**0行で黙って落ちる**（GRANT はあるので権限エラーにもならない） |

⚠️ **`getJobEmployees` の判定はまだ `role_category_id` だけを見ている。**
   1経歴に複数職種を持つ人を求人と突き合わせたいなら、そちらを合わせること。
   ⚠️ **「未配線だから使えない」ではない。** 配線はされていて、
      **突き合わせ側が追いついていない**だけ。

---

### ⚠️★カジュアル面談の「プロフィールを共有する」チェックは撤去した（2026-08-26）

**チェックを外しても企業には全部見えていた。** `ow_casual_meetings.share_profile` は
書き込まれるだけで**どこからも読まれておらず**、企業側の面談画面は
常に氏名を出し、`/u/{userId}` を開く「プロフィール詳細」ボタンも出していた。

フォームには「チェックを外すと、**プロフィールは共有されず**、下記の入力内容のみが
企業に届きます」と書いてあった。**守れない約束を画面に出していた。**

⚠️ 実害は0件（面談申込が本番0件だったため）。**次の1件で破っていた。**

#### 判断: 選択肢を無くし、告知だけ残す

カジュアル面談は相互に人を知るための場なので、**プロフィールは常に共有する**前提にした。
匿名で申し込める形にはしない。

⚠️ **チェックボックスを戻さないこと。** 戻すなら、企業側で
   `share_profile = false` の申込の**氏名・アバター・年齢・`/u/` への導線を
   すべて落とす**実装とセットにすること。片方だけでは同じ状態に戻る。

⚠️ **告知文（何が共有されるか）は消さないこと。** 選択肢を無くした以上、
   伝える責任はむしろ大きくなる。氏名と職歴が共有されると明記してある。

⚠️ 列は残してある（`NOT NULL DEFAULT true` なので、書かなければ true が入る）。
   **DROP していない。** 新しい参照を足さないこと。

## visibility_company の適用範囲（2026-08-02 確立）

`ow_experiences.visibility_company`（`real` / `masked` / `hidden`）が**どの画面に効くか**は
画面ごとに違う。混同すると同意なき公開になる。

| 画面 | 判定に使うもの |
|---|---|
| `/career-trajectories` | `visibility_company` + `ow_career_profiles.is_published` + `ow_users.visibility` |
| `/u/[id]` | `visibility_company_profile` |
| `/companies/[id]` 現役社員・OB/OG | **`visibility_company` + `ow_users.visibility` + 企業側の `ow_company_hidden_experiences`** |

**⚠️ 2026-08-02 以前は `/companies/[id]` が `visibility_company` を見ていなかった。**
`getCompanyEmployees()` が `createAdminClient()` で RLS をバイパスし、
`ow_users.visibility` だけで判定していたため、`hidden` を選んでも企業ページには載り続けた。
（実害は0件だった。`hidden` の行が当時0件だったため）

### 原則：ユーザー側の非公開希望を常に優先する

`ow_career_profiles` の RLS が「is_published と ow_users.visibility が矛盾したら厳しい方を採用」
で設計されているのに揃える。ユーザーの非表示希望と企業側の掲載要望が衝突した場合、
**必ずユーザー側を優先する。**

### ⚠️ `is_system` は経路ごとに扱いが違う。一律に除外しないこと（2026-08-22 判断）

**`is_system` を除外しているのは `lib/people/directory.ts` だけ。** これは取りこぼしではない。

| 経路 | 扱い | 理由 |
|---|---|---|
| `directory.ts`（`/people`） | **除外する** | 起点が `ow_users`（**全登録ユーザー**）なので、システムユーザーの行が候補に入る。`archive` の `b8b30729` で `ow_company_members` 起点から変えたときに足した |
| `getCompanyEmployees` / `getPublicAmbassadorsCached` | **除外していない（冗長なので不要）** | システムユーザーは `visibility = 'private'` で**既に落ちる**。加えて `ow_experiences` も `ow_company_members` も **0件**で、社員にもアンバサダーにもなり得ない |
| feed | **除外してはいけない** | `is_system` は**投稿の主体**（企業・求人・記事の告知）。除外すると投稿が消える |

⚠️ **「揃っていないから揃える」で一律除外にしないこと。** feed が壊れる。

### ⚠️ `ow_company_admins.is_ambassador` は死にフラグ。`ow_company_members` と混同しない（2026-08-23）

`/admin/biz-accounts` に **「話せる人」トグル**があるが、これが書くのは
**`ow_company_admins.is_ambassador`** で、面談対応者の `ow_company_members` とは**別テーブル・別概念**。

⚠️ **公開側からの参照は0件**（実測）。運営がこのトグルを押しても**画面には何も起きない**。
   `CompanyEmployeeSections` の `isAmbassador` は `ow_company_members` 由来のローカル変数で、
   この列とは無関係。

⚠️ **代理承認などを作るときにここへ合流させないこと。** 名前が似ているので、
   誤って繋ぐと「押したのに出ない」が再発する。
   面談対応者の掲載可否は **`ow_company_members.is_public`** が唯一の軸。

⚠️ **「話せる人」は企業・運営向けの語。本人向けの画面とメールでは使わない**（2026-08-23 / B-1）。
   本人向けは「話を聞かれてもよいか」、訪問者向けは「話を聞けます」に統一した。
   このトグルと語が衝突していたのが、本人向けから外した理由のひとつ。

（2026-08-23 時点で `is_ambassador = true` は1件。実害は無いが、消すかどうかは別途判断）

### ⚠️★面談可は本人が決める。会社の事前承認は無い（2026-08-24 に方針変更）

**本人がマイページのトグルをONにすると、その場で企業ページに掲載される。**
LinkedIn と同じ「自己申告で即掲載・会社は後から外せる」形。

⚠️ **承認という操作はもう無い。** 画面・メール・関数名に「承認」を戻さないこと。
   `pending_company`（会社の承認待ち）という状態には**到達しない**（型には残してある）。

#### なぜやめたか（実測 2026-08-24 / 本番）

| | |
|---|---|
| `ow_company_members` | 6行 |
| **`approved_at` が入っている行** | **0件**（企業が承認した実績が一度も無い） |
| 掲載中4件のうち、その会社に管理者がいる | **1件**（3件は管理者0人の会社） |
| 有効な管理者がいる企業 | **79社中7社** |

残り72社では**承認できる人が存在しない**ので、申請しても永久に「確認待ち」になっていた。
`/people` の注記も既に「OPINIO は在籍確認を行っていません」と書いており、
「会社が在籍を確認してから掲載されます」という説明と**逆のことを言っていた**。

#### ⚠️★なりすましは3つで受ける。1つでも外すと成立しない

| # | どこで守るか |
|---|---|
| ① | **在籍として申告している会社にしか出せない**（RLS `member_self_apply` / `own_member_consent` の EXISTS） |
| ② | **企業はいつでも非掲載にできる**（`/biz/members` の公開トグル） |
| ③ | **画面に「本人の申告です。OPINIO は在籍確認を行っていません」と出す**（マイページ・企業ページ・企業の管理画面） |

⚠️ ①は RLS。**`is_public = true` にする側にだけ**在籍チェックが掛かっている
   （退職して `is_current` が false になった人が**自分で掲載を止められなくなる**ため、
   OFF にする更新は無条件で通す）。
⚠️ ③はコードで守れない。**文言を消さないこと。**

#### 状態は5つ。⚠️ `consent_at` が必須

`memberState()`（`lib/constants/companyMembers.ts`）が行から導く。

| 状態 | 条件 |
|---|---|
| `none` | 行が無い |
| `pending_user` | 招待されて**一度も同意していない**（`display_consent=false` / `consent_at` **null**） |
| **`paused`** | **本人が自分でOFFにした**（`display_consent=false` / `consent_at` **あり**） |
| `unlisted` | 本人はONだが**企業が非掲載**（`display_consent=true` / `is_public=false`） |
| `listed` | 掲載中 |

⚠️★**`guard_member_consent` は取り下げでも `consent_at` を消さない**（2026-08-24 に変更）。
   消すと `pending_user` と `paused` が同じ行に見え、自分でOFFにした人の画面に
   「会社から依頼が届いています」が出る。値の意味は「**最後に同意した日時**」。

⚠️ `paused` の行に**企業側の公開トグルを出さない**。企業が公開に戻すと
   `check_public_requires_consent` に弾かれて **23514** で必ず失敗する。戻せるのは本人だけ。

#### ⚠️★運用: 通知が届く企業は7社だけ

残り72社は、自社ページに誰が載っても**企業側は気づけない**。
事前の承認をやめた以上、**なりすましは後から見つけて外すしかない**。

| どこで気づくか | |
|---|---|
| 企業（7社） | 掲載時にメールが届く → `/biz/members` の公開トグルで外す |
| **運営（残り72社ぶん）** | **`/admin` ダッシュボードの「自己申告で掲載中 N名」→ `/admin/ambassador-requests`** |

✅ **運営の一覧が唯一の入口。見る人と頻度は 2026-09-01 に決めた。**

| | |
|---|---|
| 見る人 | **柴さん**（運営） |
| きっかけ | **`/admin` の「要対応タスク」に出たとき**。⚠️ **定期巡回にしない** |
| 頻度 | 実質**数か月に1回・数分**。⚠️ 実ユーザーは6人で、2026-07 以降**新規0件**。週次にしても見るものが無い |

⚠️ **定期巡回にしない理由を消さないこと。** 「毎週見る」と書くと守られず、
   守られていないことにも気づけなくなる（`ops_reviewed_at` が0件のまま2週間放置されたのと同じ形）。
   **要対応タスクに出るので、運営画面を開いたときに必ず目に入る。**
   ✅ ~~「確認済み」を記録する列は無い~~ → **`ow_company_members.ops_reviewed_at` がある**
      （2026-08-30 確認）。一覧は**未確認が上**に並び、「確認した／未確認に戻す」で切り替える。
      **掲載日で見分ける必要はもう無い。**

⚠️ **`is_test` を隠さない。** この一覧は検証用アカウントも出し、「検証用アカウント」と
   ラベルを付けて**区別だけ示す**（`admin/ambassador-requests/page.tsx` のコメント）。
   ⚠️★**`/admin/companies` の「要対応」とは方針が違う。** あちらは `is_test` を**除外する**
      （テスト企業を作るたびに消えない警告が積み上がるため）。**目的が違うので揃えない。**

実測（2026-08-30 / 本番）: 掲載中の面談対応者は **5名**（うち1名が `is_test`）。
`is_test` の1名は**企業ページには出ない**（`queries.ts` が
`is_test === true || visibility === "private"` で落とす。2026-08-22 に追加）。
**運営の一覧にだけ出て、求職者には出ない**——これが意図した形。

✅ **2026-09-01 に掲載中5名を全員確認した**（柴さん）。`ops_reviewed_at` が入り、
   `/admin` の要対応タスクは **8件 → 3件**。残りの3件（学校追加リクエスト）も同日に畳んだので、**0件**になった。
   ⚠️ **これが初回の運用**。2026-08-30 の時点では **`ops_reviewed_at` は本番で0件**、
      最も古い行は 2026-07-15 からONで **48日**放置されていた。

⚠️ **確認は「なりすましでないことの証明」ではない。** OPINIO は在籍確認をしていない。
   運営が見たのは **職歴の粒度**（「金融営業本部 営業第1部」「第6営業部」など部署名の具体性）と
   **企業と肩書の整合**まで。**画面の「本人の申告です」の文言を消さないこと。**

⚠️★**5社とも通知の宛先が0件**（2026-09-01 実測）。企業側の担当者がいるのは
   セールスフォースだけで、**残り3社は企業が気づける経路が無い。**
   ＝ **②（企業が外す）が効かないぶんを、この一覧が肩代わりしている。**
   宛先を増やせば運営の負担は減るが、**企業の連絡先を運営が推測して送ることになる**ので
   設計の判断が要る（未決）。

---

### 面談対応者のキャッシュと、承認・見送りの入口（2026-08-23）

**承認と見送りは [lib/companyMembers/decide.ts](src/lib/companyMembers/decide.ts) を通す。**
`publishMember` / `unlistMember` / `dismissMember` が **UPDATE・DELETE 本体と
`revalidateCompanyAmbassadors()` と本人への通知を1つの関数の内側に持っている。**

⚠️★**「行を動かす経路すべてで revalidate を呼ぶ」という運用に戻さないこと。**
   2026-08-23 まではその形（7経路で呼ぶ約束）だったが、**約束を守らせる仕組みが無い**。
   承認3経路・見送り2経路があり、新しい経路を足した人が呼び忘れる。
   書き込みを関数の内側に置いたので、**呼び出し側は状態を書き換える手段を他に持たない**
   ＝ revalidate と通知だけを落とすことが**構造上できない**。

⚠️ したがって `is_public` を直接 UPDATE したり `ow_company_members` を直接 DELETE する
   コードをルートに書かない。**decide.ts に関数を足すか、既存の関数を呼ぶ。**

⚠️ `decide.ts` を通らない経路（招待の受諾・本人による解除・企業の自己登録など）は
   **従来どおり各ルートが `revalidateCompanyAmbassadors()` を呼ぶ。**
   こちらは状態遷移ではなく行の作成・削除なので、集約の対象にしていない。

`getPublicAmbassadorsCached` はタグ付き（`companyAmbassadorsTag`）。
実測では本番でも**1回目の取得から反映される**（`x-vercel-cache: REVALIDATED`）。

⚠️ 「ページ=1 / API=0」を**1度だけ観測した。3サイクル測り直しても再現せず**、
   stale-while-revalidate の競りと推定している（**未確定**）。
   ⚠️ ただし**利用者に見える矛盾にはならない**。未ログインは数字だけ（カードが無い）、
      ログイン済みは**カードと数字が同じ応答**（`totalAmbassadorCount`）から出るため。

---

## biz/company フォームから削除した項目（2026-07-28 確定）

以下の入力フォームは `/biz/company` から削除した。**DBカラムは残す**（他の参照を壊さない）。

| 削除した入力欄 | DBカラム | 削除理由 |
|---|---|---|
| ミッション | `ow_companies.mission` | 公開ページに表示先がない |
| こんな人に向いている / 注意点 | `fit_positives` / `fit_negatives` | 公開ページに表示先がない |
| 評価制度 | `evaluation_system` | 公開ページに表示先がない |
| 月間平均残業時間 | `avg_overtime_hours` | 2026-07-28 メンテ負担削減。87社中0件のため復活させない。取材項目としてデータが集まってから再検討する |
| 有給取得率 | `paid_leave_rate` | 同上 |
| 働き方の補足説明 | `workstyle_description` | 公開ページに表示先がない |

NumbersSection（`avg_overtime_hours` / `paid_leave_rate` の表示先）は復活させない。
理由: 上記カラムが87社中0件であり、表示先を作っても空欄しか表示できない。
取材でデータが集まってから再実装を検討する。

---

## ⑥ ツール・技術スタック — 取材項目として確定（2026-07-28 記録）

`ow_company_tools` / `ow_tool_masters` は実装・スキーマ適用済み。
ただし**社内利用ツールは公開情報からは取得不可**と判明。

理由: Salesforce Japan で試みたところ、公開情報で確認できるものは
すべて「自社製品の社内利用（Salesforce / Pardot / Slack）」か
一次情報URLを示せない推測情報のみだった。

- 自社製品は `/companies/[id]` の「製品・サービス」に既出であり、
  「Salesforce社がSalesforceを使っています」は情報量ゼロ
- AWS / Google Workspace 等も一次情報URLを特定できず除外

**⑥ は取材でしか埋まらない項目。**
企業取材時に必ず「社内で実際に使っているツール・技術スタックを教えてください」
と確認し、その回答を migration で投入する運用とする。

初期データ投入（動作確認用）は株式会社Third Box で実施。
- Third Box company_id: `81cae8d8-38bf-4497-8fa1-1fbb2741239d`
- ツール一覧は柴さんから提供を受けてから migration を作成する

Salesforce Japan への暫定投入（2026-07-28 migration `20260728105851`）:
- Slack / Google カレンダー / Gmail / AWS → 公式発表・PR資料に基づく（一次情報あり）
- Salesforce / Tableau → 自社製品の社内利用（確実）
- ChatGPT / Claude / Gemini → 出典未確認の暫定値。**取材時に必ず確認・修正すること**

---

## ow_companies.phase カラムの定義（2026-07-28 確立 / 2026-09-06 に2段階へ）

phase は「企業グループとしてのステージ」を表す。
日本法人自体の上場有無ではなく、最終親会社の状態で判定する。

日本法人が外資系であることは `capital_type`（⑦資本関係）で表現する。
「日本法人は非上場」は phase の判定基準にならない。
ヴイエムウェア（親: Broadcom NYSE上場）や
ウォークミー（親: SAP NYSE上場）が `listed` のままなのはこの定義による。

### ⚠️★語彙は2段階。**唯一の出どころは [lib/constants/phase.ts](src/lib/constants/phase.ts)**

| 親 | 子 |
|---|---|
| `startup`（スタートアップ） | `seed` `series_a` `series_b` `series_c` `series_d` `unicorn` |
| `listed`（上場企業） | `listed_prime` `listed_standard` `listed_growth` `listed_overseas` |
| `non_listed`（非上場） | — |

**親も子も `phase` に入れてよい。** 絞り込みは**選んだ側を展開する**（親を選ぶと子も含む）。
⚠️ **ラウンドや市場を確認できないときは親を入れる。** それらしい段を当てはめない。
   実際、未上場と分かっても調達ラウンドが非公表の企業が4社あり `startup` で止めてある。

### ⚠️★2026-09-06 まで、語彙が噛み合わないまま4か所に割れていた

| どこ | 何が入っていたか |
|---|---|
| `lib/constants/phase.ts` | 12個・日本語（`/companies` と `/jobs` の絞り込み） |
| `lib/business/mockCompany.ts` | **8個・別の日本語**（`/biz/company` の入力欄） |
| `lib/utils/stageCfg.ts` | 30キー（企業詳細のバッジ） |
| DB の CHECK | 8個・英語 ← **唯一の正** |

**その結果 `/biz/company` の「事業ステージ」は、どれを選んでも保存できなかった。**
`ow_companies` は UPDATE が列単位 GRANT なので、**企業情報の保存が丸ごと失敗していた。**
→ いまは `phase.ts` の1系統。**`value` は DB に入る値そのもの。日本語に戻さないこと。**

### ⚠️ 「成長ステージ」のようなバケットを、個別の段と同列に並べない

以前は「成長ステージ（シード〜シリーズC）」が「シリーズB」の隣にあり、
実データでは**どちらも同じ1社**を指していた。粒度が違うものは階層で分ける。

実測（2026-09-06 / 掲載83社）: `listed` 56 ／ `unicorn` 11 ／ `startup` 5 ／
`non_listed` 5 ／ `listed_growth` 3 ／ `series_d` 2 ／ `series_b` 1。**NULL は0社。**

⚠️ **`listed` 56社の市場別内訳はまだ無い。** 52社は外資系子会社だが、
   `capital_type` から機械的に決めると推測値の投入になる（外国企業が東証に
   上場している例もある）。**企業ごとに確かめて `listed_overseas` 等へ落とすこと。**

⚠️ 出典は `ow_company_data_sources` の `field = 'phase'` に記録する（9社ぶんが入っている）。

⚠️ `business_stage` は**本番100行すべて NULL**。COMMENT で【廃止】と印を付けた。読み書きしない。

### ⚠️ `listed_exchange` は使わない。上場市場は `capital_notes` に書く（2026-08-13 確立）

**`ow_companies.listed_exchange` は描画先が1箇所も無い未使用カラム。**
`COMPANY_DETAIL_COLS` で SELECT され `detail.listedExchange` にマッピングもされているが、
**そこから先で参照している箇所が src に0件**。入れても画面には出ない。

上場市場・証券コード・ティッカーは **`capital_notes` の文中**に書く。

⚠️ **`capital_notes` の置き場所は画面上2箇所ある**（`companies/[id]/page.tsx`）。

| 条件 | どの行の subText に出るか |
|---|---|
| `parent_company_name` あり（外資系日本法人） | **「親会社」行** |
| `parent_company_name` なし（日系企業） | **「資本区分」行**（2026-08-13 追加） |

⚠️ それ以前は親会社行にしか出なかったため、**日系企業に上場・調達の一文を入れても
   どこにも出なかった**。Sansan・PKSHA・SmartHR・Ubie がこれに該当していた。

⚠️ **両方に出さないこと。** 資本区分行の subText は
   `detail.parentCompanyName ? undefined : detail.capitalNotes` で分岐している。

⚠️ **`capital_type` が空だと資本区分行ごと出ない**ので、日系企業に capital_notes を
   入れるときは `capital_type = 'japanese_independent'` も併せて入れること。

### `branch_locations` に何を入れるか（2026-08-13 確立）

**常設オフィス（支店＋サテライトオフィス）をすべて挙げる。**
イベント施設・運営施設（Sansanピックルボールコート池袋など）は**含めない**。

値は都道府県名または都市名の短い表記で持つ（画面では「・」で連結して1行に出る）。

⚠️ **出典が無いことだけを根拠に、既存の値を削除しないこと。**
   2026-08-13 に Sansan の「京都」を「`archive/171` の出典なし一括投入だから」という理由で
   落としたが、**公式の会社概要にサテライトオフィスとして載っていた**（Sansan Innovation Lab）。
   同じ会社概要には徳島・新潟のラボもあり、**落とすどころか2件足りなかった**。
   **投入元 migration に出典が無いことは、値が誤りである根拠にはならない。**

⚠️ **原因は、削除を指示した側が公式サイトを確認していなかったこと。**
   実行側は「公式サイトの確認は『指示書に無い値を自分で調べない』に従って行っていないので、
   京都拠点の記載が実在する可能性は残る」と**留保を付けて報告していた。その指摘が正しかった。**

   ⚠️ **実行側が付けた留保を軽く扱わないこと。** 「調べていないので確証がない」という
      報告は、確認すべき箇所を名指ししている。**削除の可否を決める側が裏を取る。**

---

## ⚠️ DB 関数の書き方（2026-08-20 確立。`can_send_scout` の事故から）

### ① 引数名で**どちらの空間か**を示す

`auth.uid()`（＝`auth.users.id`）と `ow_users.id` は別物なのに、
**どちらも uuid なので型では区別できない。** 取り違えても `tsc` も lint も通り、
実行時エラーも出ず、**条件が1つ静かに効かなくなるだけ**になる。

```sql
-- ✗ どちらの空間か分からない
create function can_send_scout(p_company_id uuid, p_candidate_id uuid)

-- ✓ 名前で示す
create function can_send_scout(p_company_id uuid, p_auth_user_id uuid)
create function get_public_career_steps(p_ow_user_id uuid)
```

**`p_auth_user_id` / `p_ow_user_id` を使う。**
⚠️ **新しく作る関数はこの規約に従う。既存の関数は今回は改名していない**
   （影響範囲を調べてから判断する。`docs/todo.md` に残してある）。

### ② 空間を渡し間違えたら**実行時に落とす**（`create_conversation` が手本）

```sql
-- ow_users 空間の id を受けるなら、auth.uid() と一致することを必ず確かめる
IF NOT EXISTS (
  SELECT 1 FROM ow_users WHERE id = p_ow_user_id AND auth_id = auth.uid()
) THEN
  RAISE EXCEPTION 'unauthorized: p_ow_user_id does not match auth.uid()'
    USING ERRCODE = '42501';
END IF;
```

⚠️ **①と組み合わせて初めて効く。** 名前だけでは間違いを止められないし、
   アサートだけでは「どちらを渡すのが正しいか」が読む人に伝わらない。

⚠️ SECURITY DEFINER の関数で**本人確認をこのアサートに任せている**なら、
   外すと誰でも他人のぶんを操作できる。**消さないこと。**

### ③ 1つの関数の中で**両方の空間を混ぜない**

混ざっているかは、関数の本文が参照している列の FK で判定できる。
洗い出しのクエリは `docs/todo.md`「user_id の空間取り違え」に置いてある。

⚠️ **CLAUDE.md に警告があっても防げなかった**（`can_send_scout` が1本すり抜けた）。
   **文章では防げない。** 実データで数えること。

### ★実例: `guard_member_consent` は本人を弾いている（2026-08-23 実測）

**トリガーにも同じ取り違えがある。関数だけを探しても見つからない。**

`ow_company_members` の `guard_member_consent`（BEFORE UPDATE）は
「同意を変えられるのは本人だけ」を意図しているが、比較が

```sql
if new.user_id <> auth.uid() then   -- ow_users.id  <>  auth.users.id
```

で、**空間が違うので決して一致しない**（FK で確認: `ow_company_members.user_id`
→ `ow_users.id` / `ow_user_roles.user_id` → `auth.users.id`）。
結果、**運営admin だけが通り、本人は自分の同意を変えられない。**

実測（本人のセッションで `display_consent` を true にしようとした）:

```
エラー P0003: 面談対応者の公開同意は、本人のみが変更できます
```

⚠️ **RLS は正しい**（`own_member_consent` は `user_id = auth_ow_user_id()`）。
   ポリシーを読んで「本人は書ける」と判断すると誤る。**トリガーまで見ること。**

⚠️ いま実害が出ていないのは、この分岐に到達する生きた経路が無いため。
   `POST /api/biz/ambassador/self-register` の Step 2 が唯一の呼び出し元だが、
   **Step 1 の INSERT が先に落ちる**（下記）。
   ⚠️ **本人が同意する経路を新しく作ると、その日に踏む。** 直すのは別タスク。

### ★実例: `/api/biz/ambassador/self-register` は CHECK 制約で必ず 500（2026-08-23 実測）

企業の管理者が「自分も面談対応者になる」を押すと**必ず失敗する**。

```
[ambassador self-register] insert: new row for relation "ow_company_members"
  violates check constraint "check_public_requires_consent"
```

INSERT が `display_consent: false, is_public: true` を入れようとするが、
`check_public_requires_consent` は `is_public = false OR display_consent = true` を要求する。
**RLS の「INSERT は display_consent=false のみ許可」に合わせた実装が、CHECK と矛盾している。**

⚠️ 行は残らない（INSERT ごと落ちる）ので、データは汚れていない。
⚠️ 上のトリガーの件と**別の不具合**。混同しないこと。修正は別タスク。

### ④ 関数を消す前に、**本文まで検索する**

⚠️ `has_worked_at_company` は **src からの呼び出し0件**だったが、
   **DB の中に呼び出し元が2つあった**（`guard_salary_insert` / `guard_review_insert`）。
   FK では追えない。**関数の本文を検索して初めて分かる。**

```sql
select proname from pg_proc
 where pronamespace='public'::regnamespace
   and pg_get_functiondef(oid) ~ '\m対象の関数名\M';
```

（結局その2つも死んでいた——対象の表が DROP 済みで trigger が0本だった——ので
3本まとめて落とした: `20260820180000`）

## ⚠️ Supabase の呼び出しで error を捨てない（2026-08-20 追記）

**`?? []` は権限エラーもRPCの404も「0件」に化けさせる。**
2026-08-19 に anon の 403 で、2026-08-20 に RPC の `PGRST202`（引数名違い）で
**同じ形を2回踏んだ。**

```ts
// ✗ 404 も 403 も「0件」になる
const { data } = await admin.rpc("get_blocked_companies", { candidate_id: id });
const blocks = data ?? [];

// ✓ 最低限 console.error は出す
const { data, error } = await admin.rpc("get_blocked_companies", { p_auth_user_id: id });
if (error) console.error("[scout-settings] get_blocked_companies:", error.message);
```

⚠️ **RPC は引数名が違うだけで 404 になる**（`PGRST202`）。
   関数側が `p_candidate_id` なら、呼ぶ側も `p_candidate_id` でなければ**関数が見つからない**。

⚠️ **fail-closed なら握りつぶしてよい、ではない。** `auth_is_admin` は
   失敗しても「管理者ではない」に倒れるので実害は無いが、
   **落ちていることに気づけない**のは同じ。新しく書くときは error を受ける。

→ 既存の握りつぶしの棚卸しと、段階的に直す計画は
   [docs/todo.md](docs/todo.md)「Supabase 呼び出しの error 握りつぶし」

## ⚠️ テーブル・カラム・関数を DROP するときのチェックリスト

**FK を見ただけでは足りない。PL/pgSQL の本体は Postgres が依存として追跡しない。**
関数の中で `UPDATE ow_xxx` と書いてあっても `DROP TABLE ow_xxx` は成功し、
**壊れたことはその関数を実際に呼ぶまで分からない。**

⚠️ **「DROP して `npm run build` が通った」は確認にならない。** ビルドは DB を見ない。

**SQL Editor での手動適用を禁止する。** 必ず migration ファイルを作成し `supabase db push` で適用する。
migration 適用のたびに `npm run gen:types` を実行してコミットする。

→ 関数・ビュー・ポリシーの全文検索クエリ、「参照先が実在するか」の定期突き合わせ、
   baseline とダンプ手順は [.claude/skills/db-safety/SKILL.md](.claude/skills/db-safety/SKILL.md)

## ⚠️ 「存在しない列で引いていないか」は静的に数えられる（2026-08-20 確立 / 2026-08-30 にスクリプト化）

```bash
node scripts/check-columns.mjs --self-test   # ★先にこれ。検出器が効くか確かめる
node scripts/check-columns.mjs               # src 全体
```

⚠️★**`--self-test` を先に通すこと。** `8b763db4^`（既知のバグがある版）を `git show` で
   取り出して当て、**2件とも検出できるか**を見る。**通らないうちは「0件」を信じない**（ルール⑱）。
   実際、作っている途中で `.or()` を丸ごと飛ばす変更を入れたら **2/2 → 1/2** に落ちた。
   自己テストが無ければ、そのまま「0件」と報告していた。

⚠️ **手順だけを残さない。** この検査は 2026-08-20 に本番のバグを見つけたのに
   スクリプトが無く、**次に誰も走らせられない状態**だった（`check-og.sh` と同じ理由で残す）。

実測（2026-08-30 / 586ファイル・106表）: **0件**。

**列名を1つ間違えると PostgREST は 400 を返すが、`?? 0` / `?? []` で受けている側では
「0件」として静かに素通りする。** 2026-08-20 に本番ログで19件/24時間の 400 を見つけた
（`/mypage` の未読バッジが `ow_conversations.company_user_id` と `updated_at` で数えており、
**どちらの列も存在しない**。バッジは常に 0 で、新着メッセージに気づけない状態だった）。

同じ形は**型定義と突き合わせれば機械的に見つかる**。`src/lib/supabase/types.ts` の
`Row` からテーブル→列を作り、`.from("x")` の直後にある
`.eq/.gt/.in/.or/.order/.select` の列名を照合する。

⚠️ **0件だったときは、検出器が効いていることを先に確かめる**（ルール⑱）。
   直す前のファイルを `git show <commit>^:<path>` で取り出し、
   **既知のバグを検出できるか**を見てから「0件」と言う。
   2026-08-20 はこの手順で 2/2 を再現検出できることを確かめてから本体を通した（結果0件）。

⚠️ **型の間違い（uuid の列に slug を渡す等）はこの方法では見つからない。**
   同日に見つかった「最近見た企業が常に空」（localStorage の slug を uuid として引いて 22P02）は
   **本番ログでしか気づけなかった**。静的検査とログの両方を見ること。

## 📏 件数・統計値の記載ルール

**テーブルの件数・統計値を書くときは必ず取得日を併記すること。**

```
良い例: 公開求人 74件（2026-07-15 時点）
悪い例: 公開求人 74件
```

- 理由: 削除 migration が後続セッションで実行されると件数が変わる。日付なしの数字は翌セッション以降に誤りになる。
- 対象: 求人数・企業数・ユーザー数・記事数・フィード投稿数など、変動しうるすべての数値
- `docs/` 配下のリサーチメモも同様。SQL を実行した日付を必ず記録する。

**現在の正確値（2026-07-24 service role 実測）:**
- `ow_jobs`: 20件（published 18 / draft 2）
- ⚠️ CLAUDE.md 内の「74件」はすべて 2026-07-15 時点の値。
  その後 Migration 238（medimo 削除）・239（Archi Village/freee/LayerX 削除）等により現在は 20件。

---

## ⚠️ 選択肢が決まっている値は「UI / API / DB の CHECK」を3つ揃える（2026-08-07 確立）

**2つ揃えても足りない。3つ揃える。** 1日で同じ形のバグが4件出た。

| 何を忘れたか | 症状 | 期間 |
|---|---|---|
| API の許容値が UI と違う（`experience_years`） | **全部 null**。エラーなし | 2026-07-01〜08-07 |
| 同上（`employment_type` の2値） | その2つだけ null。エラーなし | 同上 |
| **CHECK を広げ忘れた**（`degree` の小中学校卒） | 保存が 500。原因が見えない | 2026-05-30〜08-07 |
| **UI が DB と別の語彙を送る**（`remote_work_status`） | 勤務形態を選ぶと保存が落ちる | 不明〜2026-08-07 |

### 原則

1. **許容値は `src/lib/constants/` の1箇所に置く。** UI と API が同じ定数を見る。
   ⚠️ route の中に `new Set([...])` を書かない。書いた瞬間に UI と割れる
2. **DB にも CHECK を張る。** コードの検証は「これから入るもの」しか止められない。
   CHECK が無いと、綴りが1文字ずれても**エラーにならず、フィルタから静かに消える**
3. **画面に出す値と DB に入れる値が違うなら `{value, label}` で持つ。**
   日本語ラベルをそのまま送らない
4. **値を1つ足すときは3つとも足す。** どれか1つでも忘れると、
   「選べるのに保存できない」か「保存できるのに絞れない」のどちらかになる

### ⚠️ この規約の適用範囲 —— 「値の集合」の制約だけ（2026-08-27 確定）

**対象は選択肢・状態・区分のような「取りうる値の集合」の制約。**
**行数の上限のような「濃度」の制約は対象外**とし、**UI と API の2層で担保する。**

| 制約の種類 | 例 | 揃える層 |
|---|---|---|
| **値の集合** | `employment_type` の6値 / `status` の5値 / `degree` | **UI・API・DB の CHECK（3層）** |
| **濃度（件数の上限）** | `ow_user_skills` の**最大15件**（2026-08-27） | **UI・API の2層** |

濃度を DB で守ろうとすると、1スキル1行のテーブルでは CHECK では書けず
**トリガーが要る**。そこまでしない理由は2つ。

1. **破られても事故にならない。** 16件目が入っても壊れるものは無く、
   識別力が落ちるだけ（「値の集合」を破ったときの
   「静かに null になる」「フィルタから消える」とは性質が違う）。
2. **トリガーは後から読む人が気づけない隠れた挙動になる。**
   テーブル定義を読んでも分からず、`ow_company_members` の
   `guard_member_consent` のように**ポリシーだけ読んで誤る**形を増やす。

⚠️ **破られると壊れる濃度の制約が出てきたら、そのときは個別に判断する。**
   この節は「濃度は常に2層でよい」ではなく、
   **「濃度は自動的に3層の対象にはならない」**という意味。

### 弾き方

- **不正値は 400。** 黙って null や既定値に落とさない
- **空文字と不正値を区別する。** 空 → null か既定値（正しい）／不正 → 400
- 運営が自分で入力して結果が画面で見える箇所は据え置いてよいが、`console.warn` は出す

### `ow_experiences.employment_type` は3つ揃った（2026-08-26）

**DB の CHECK だけが欠けていた**（UI と API は `EMPLOYMENT_TYPES` を共有済みだった）。
`20260826090000_employment_type_check.sql` で6値 + NULL の CHECK を張った。

⚠️ **NULL は許可している。24件中18件が NULL**（唯一の入力欄が任意セレクトで、
   オンボーディングでは雇用形態を聞いていないため）。**NOT NULL にしないこと。**

実測（適用後）: 6値すべて 204 で通る / `インターン`（求人側の語彙）・`正社員 `（末尾空白）は **23514 で弾かれる**。

### 求人と経歴で雇用形態が違うこと

`careerOptions.ts` に **2つ並べて**置いてある。分けてよいが、離して置かない。

| 定数 | 用途 | 違い |
|---|---|---|
| `EMPLOYMENT_TYPES` | 経歴（本人が経験した） | 派遣社員あり / その他あり / インターンなし |
| `JOB_EMPLOYMENT_TYPES` | 求人（企業がこれから採る） | インターンあり / その他なし / 派遣社員なし |

### `ow_jobs.status` は5値（2026-08-11 に `active` を削除）

| 値 | 意味 | 使われている場所 |
|---|---|---|
| `published` | 公開中 | 公開ページの読み取りは全部これ1つ |
| `draft` | 下書き | — |
| `pending_review` | 企業が申請 → 運営が審査 | `/admin/jobs` の「審査待ち」タブ・KPI |
| `rejected` | 差し戻し | `rejection_reason` とセット |
| `private` | 運営が公開を止める | `privateJob()` |

DB の CHECK・`VALID_STATUSES`・`SETTABLE_JOB_STATUSES` の**3つとも同じ5値**。
非対称は解消済み。表示側の正規化は「知らない値と NULL は draft に化ける」だけ。

#### `active` を復活させないこと

2026-08-11 に削除した。判断の根拠は3つ。

| # | 事実 |
|---|---|
| ① | 実データ **0件** |
| ② | **`ow_jobs.status = 'active'` を書き込むコードが存在しない**（`status: "active"` の3箇所はすべて `ow_conversations` / `ow_tenant_plans`）。`SETTABLE_JOB_STATUSES` も元から除外していた |
| ③ | **published との違いを説明した記述がどこにも無い。** 見つかったのは全部「published と同じ」と言っている記述（archive/113・admin/jobs のコメント・StatusPill の "alias for published"） |

削除時は3つ同時に変えた（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。

- `.in(["published","active"])` **16箇所** → `.eq("status","published")`
- `normalizedStatus()` の `active → published` 変換を削除
- `JobStatus` 型 / `StatusPill` / `JobStatusBadge` / `JobListCard` から削除

⚠️ 実測: `update ow_jobs set status='active'` は **23514（check_violation）** で弾かれる。

⚠️ `closed` / `expired` は**あえて CHECK に入れていない**。表示側が知らないので、
入れると「DB には入るが画面で draft に化ける」状態を作る。
期限切れ遷移を有効化するときは CHECK と表示側を**同時に**広げること。

---

## ⚠️ 求人を投入するときは `source_url` を必ず埋める（2026-08-11 確立）

**埋められない求人は公開しない。**

| 列 | 意味 |
|---|---|
| `ow_jobs.source_url` | 求人原文の URL |
| `ow_jobs.source_verified_at` | 最後に原文と内容を突き合わせた日時 |

どちらも**運営の管理用で、公開ページには出さない**。
入力は `/admin/jobs/[id]` の「出典（運営用）」パネル。

### なぜこの列を足したか

**出典列が無かったために、公開求人18件の出所調査に丸一日かかった。**

`ow_jobs` に原文を指す列が1つも無く、`supabase/migrations/archive/*.sql`（299本）を
全文検索して投入元の migration を特定するしかなかった。結果:

| 出所 | 件数 | 結末 |
|---|---|---|
| `archive/147_add_sample_jobs.sql`（自ら「サンプル求人データ追加」と記載） | 13 | **実在を確認できず掲載を下ろした** |
| `archive/152_salesforce_japan_jobs.sql`（URL の記載なし） | 5 | 採用ページとの突合待ちで保留 |

勤務地は全件「東京都」、勤務形態は全件 `hybrid` で、1件ずつ調べた形跡が無かった。
列が最初からあれば、この調査は SELECT 1本で終わっていた。

⚠️ Opinio は有料職業紹介事業の許可事業者。実在しない求人の掲載は的確表示義務に関わる。
   値の精度以前の問題として扱うこと。

### 残タスクの見つけ方

`/admin/jobs` の **「出典なし（公開中）」タブ**。公開中なのに `source_url` が空の求人が出る。
2026-08-11 時点では Salesforce の5件が該当し続ける。

⚠️ **既存18件は NULL のままにしてある。** それらしい URL で埋めない。
   「出典が未確認である」という事実を消さないため
   （「値が無いことを、ある値に置き換えない」の一例）。

### ⚠️ 下書きのサンプル求人13件を published に戻さない（2026-08-13 確認）

**あれは「まだ着手していない下書き」ではない。実在確認ができず、意図的に取り下げたもの。**

| | 実測（2026-08-13） |
|---|---|
| `ow_jobs` 総数 | **20**（published 5 / draft 15） |
| 公開求人を持つ企業 | **79社中1社**（Salesforce のみ） |
| `source_url` が入っている求人 | **0件** |

対象13件は `archive/147_add_sample_jobs.sql`（自ら「**サンプル**求人データ追加」と記載）が
投入したもので、**`created_at` が13件ともミリ秒まで同一**、`published_at` は
`NOW() - INTERVAL 'N days'` で機械生成、勤務地は全件「東京都」、勤務形態は全件 `hybrid`、
**`description` は全件 NULL**。取り下げの経緯は
`20260811155028_unpublish_unsourced_sample_jobs.sql` に書いてある。

#### 守ること

1. **`source_url` が無い求人を `published` に戻さない。**
   企業の採用ページと突き合わせ、**出典を記録できたものだけ**を公開する
2. **「ページが薄く見える」「求人0件だと寂しい」は、この判断を覆す理由にならない。**
   Opinio は有料職業紹介事業の許可事業者で、実在しない求人の掲載は**的確表示義務**に関わる。
   見栄えより先に来る
3. 出典が取れたら、`status` を戻すのと**同時に** `source_url` / `source_verified_at` を埋める

⚠️ **表示条件は `status = 'published'` かつ `is_test = false` の2つだけ**（`queries.ts`）。
   `ow_jobs` に `is_published` 列は無く、`expires_at` も判定に使っていない（全件 NULL）。
   **`status` を1つ変えた瞬間に公開される。** 審査や掲載期間のゲートは無い。

### ✅ Salesforce の5件は突き合わせ済み。公開は2件に減った（2026-08-30）

**2026-08-13 の「①鮮度の確認が要る ②`source_url` は空のまま」は両方とも解消した。**

登録から **87日**経っていたので、採用ページの**日本の求人87件を5ページ全部**取得して
突き合わせ、見つからなかったものは**国フィルタを外したキーワード検索でも**確認した。

| 当方の求人 | 判定 | 対応 |
|---|---|---|
| Account Executive, MuleSoft | **JR325032**（Japan-Tokyo / 応募可 / **Posted 02 June 2026** が当方の公開日と一致） | 個別URLを `source_url` に記録して**公開維持** |
| Account Solution Engineer, Tableau | **JR332827**（タイトル完全一致） | 同上 |
| Lead Solution Engineer, Tableau | **無い** | **`private`** |
| Director, Customer Success Management（金融業界） | **無い** | **`private`** |
| Business Operations - AI Methodology & Enablement | **無い** | **`private`** |

⚠️★**似た名前を同一と見なさなかった。** 日本の Tableau 求人7件に Lead SE は無く
   （「Lead Solution Engineer - **MuleSoft**」は製品が違う）、金融CSM は
   **Director ではなく Manager**（`Customer Success Manager, Financial Service`）だった。

⚠️★**`status` は `draft` ではなく `private`。** CLAUDE.md の定義で
   `private` =「一度公開したものを運営が止めた」で、今回はまさにそれ。
   前例（`20260811155028`）が `draft` を使ったのは、あちらが**実在を確認できなかった
   サンプルデータ**で「そもそも公開すべきでなかった」から。**性質が違うので混ぜない**
   （混ぜるとあの13件と区別がつかなくなる）。

⚠️ **取り下げた3件の `source_url` は空のまま。** それらしいURLで埋めない。
   突き合わせた事実は `source_verified_at` が示す。

⚠️ **「採用ページに無い＝募集終了」と断定はできない。** 充足・保留・掲載方法の変更も
   ありうる。**出典を示せない求人を公開し続けない**方針に従って取り下げただけで、
   出典が取れた日に戻せる。

⚠️ **残す2件も本文・年収・勤務地までは突き合わせていない。** 確認したのは
   「その求人が今も募集されていること」まで。

⚠️★**求人の鮮度は今も自動では落ちない。** `expires_at` は全件 NULL、期限切れ遷移も無効。
   **定期的に人が突き合わせるしかない。** 87日放置した実績があるので、間隔を決めること。

実測（2026-08-30 適用後）: `ow_jobs` 20行 → **published 2 / private 3 / draft 15**。
「出典なし（公開中）」タブは **0件**。

---

## ⚠️ スカウトは受信側を実装済み。送信はまだ止めてある（2026-08-10）

**受信側（2026-08-10 実装）は動く。送信フラグ `SCOUT_SENDING_ENABLED` だけが未設定。**

2026-08-09 に「送れるが受け取る手段が無い」ため送信を止めた。
2026-08-10 に受信側を作ったので、**止めた理由は解消している**。
再開は環境変数に `SCOUT_SENDING_ENABLED=true` を入れるだけ（下の前提を確認してから）。

### 受信側の構成（2026-08-10）

| | 実体 |
|---|---|
| 一覧・返答画面 | `/mypage/scouts`（`page.tsx` + `ScoutsClient.tsx`） |
| 気づく手段 | `ow_notifications` の `type='scout'` → ヘッダーのベル |
| サイドバー導線 | `/mypage` の「スカウト」＋未返答バッジ |
| 返答API | 既存の `/api/jobseeker/scouts/[id]/reply` に接続（新規実装なし） |
| 通知の書き込み | `POST /api/biz/scouts` の INSERT 直後（best-effort。失敗してもスカウトは送る、ただしログは出す） |
| メール通知 | 同じ場所で `sendScoutEmail`。`email_scout_enabled` を尊重する |

⚠️ **メール通知は 2026-08-10 に追加した**（`sendScoutEmail`）。
   同日に `ow_profiles.email_scout_enabled` を作ったので、配信停止が効く。
   **判定は `sendScoutEmail` の中に置いてある。** 呼び出し側に出すと、
   経路が増えたときに片方だけ忘れる（週次メール2本で実際に起きた）。

### スキーマ（`20260810103434_scout_notifications.sql`）

`ow_notifications` は「いいね・コメント」専用だったので3点を緩めた。

| 変更 | 理由 |
|---|---|
| `post_id` を nullable | スカウトに投稿は無い |
| `actor_user_id` を nullable | スカウトの主体は企業でユーザーではない |
| `scout_id` / `actor_company_id` 追加 | どのスカウトか・どの企業か |
| `type` CHECK に `'scout'` 追加 | — |
| `ow_notifications_target_check` 追加 | **種別ごとに何がぶら下がるかを DB でも保証する** |

⚠️ 最後の CHECK が肝。これが無いと post_id も scout_id も無い通知が入り、
   受け取った人には**押しても何も起きない通知**として現れる。

### 空間の取り違えに注意（ここで2回踏みかけた）

| 列 | 空間 |
|---|---|
| `ow_scouts.candidate_id` | **auth 空間**（auth.users.id） |
| `ow_profiles.user_id` | **auth 空間**（`can_send_scout` がこれで引く） |
| `ow_notifications.recipient_user_id` | **ow_users 空間** |

⚠️ 同じ「候補者」を指すのに空間が違う。`POST /api/biz/scouts` は
   スカウトに `candidateUser.auth_id`、通知に `candidate_id`(= ow_users.id) を渡している。
   **どちらかに揃えると必ず壊れる。**

### 送信を再開する前に確認すること

⚠️ **`scout_enabled` が null の人には送れない。** `can_send_scout()` は
   null を false 扱いにする。2026-08-10 時点で **39人中 true は3人**（残り36人は null）。

⚠️ LP の FAQ は「初期設定は『受け取る』」と書いている（`LandingPage.tsx`）。
   実際は 2026-08-04 以前に登録した人が null のままで**届かない**。
   `/mypage` に未選択者向けの設定バナーがあるので、そこを通ってもらう必要がある。
   **FAQ の記述と実態のどちらを直すかを決めてから再開すること。**

⚠️ 送信の入口は2箇所ある。フラグを true にすると**両方**が同時に開く。

| 場所 | フラグ off のときの挙動 |
|---|---|
| `POST /api/biz/scouts` | **503**（最初のガード。認証より前） |
| `/biz/candidates` | 送信ボタンを出さず「スカウト準備中」表示＋案内バナー |

⚠️ **APIだけ止めるのは不十分。** ボタンが残ると企業は押せてしまい、503 を
   「失敗した」と受け取る。ページ側も同じフラグで出し分けること。

### 実測（2026-08-10、ローカル・is_test アカウント＋自社1社）

| 確認したこと | 結果 |
|---|---|
| `/mypage/scouts` にスカウトが出る | ✅ |
| ベルの通知APIが `type='scout'` を返す | ✅ `actorCompany` 付き |
| `/mypage` に未返答バッジが出る | ✅ |
| 返答（declined）で `ow_scouts.status` が変わる | ✅ DB で確認（HTTP 200 では判定しない） |
| declined では会話もメールも作られない | ✅ |
| 2回目の返答が **409** で弾かれる | ✅ |
| 0件のときの空状態 | ✅ |

⚠️ 検証用の行は全件削除し、`ow_scouts` 0件・`type='scout'` の通知 0件・
   トリガーが作った `ow_scout_quotas` の行も削除して作業前に戻したことを SELECT で確認済み。

⚠️ **`ow_scouts` への INSERT は `trg_guard_scout` が走り、
   `ow_scout_quotas.used_this_month` を +1 する。**
   検証で直接 INSERT するときは、この行の事前値を記録して戻すこと。

⚠️ `/biz/scouts`（スカウト管理）の「返信率」は
`readOrMore === 0` のとき `null` になりタブごと出ない実装なので触っていない。

---

## ⚠️ 週次メールは停止中（2026-08-07 決定）

**`/api/cron/weekly-match` と `/api/cron/weekly-jobs` は止めてある。勝手に戻さないこと。**

止め方は二重。**両方戻さないと動かない**（片方だけ戻しても送信されない）。

| # | 場所 | 状態 |
|---|---|---|
| 1 | `vercel.json` の `crons` | **空**（`{}`）。JSON にコメントが書けないので理由はここと各ルートに書いた |
| 2 | 各ルート冒頭の `isDisabled()` | `WEEKLY_EMAIL_ENABLED !== "true"` なら**認証より前に** return |

### なぜ止めたか

| # | 事実（2026-08-07 実測） |
|---|---|
| ① | weekly-match の「マッチ度 **75%**」に根拠が無い。`ow_match_scores` は0件で、**書き込むコードが src にも migration にも存在しない**（読んでいるのは weekly-match の1箇所だけ）。スコアが無いと補完経路に落ち `matchScore: 75` が**ハードコード**で入る。本文の「プロフィールに基づいて」も嘘で、プロフィールを1列も読んでいない |
| ② | **配信停止が機能していない。** `ow_profiles` / `ow_users` に opt-out の列が無い（`notify_email` `email_opt_out` `notification_settings` `unsubscribed_at` いずれも**存在しない**）。`/profile/edit` の「メール通知設定」は **localStorage 保存**で cron は読まない。本文末尾の「配信停止はマイページから設定できます」も事実と違う（設定 UI は `/mypage` に無い） |
| ③ | 宛先が **39人中 実ユーザー3人**。抽出条件が「`ow_profiles` 全件」で `is_test` もシステムユーザーも除外していない。内訳は example.com 20 / opinio.co.jp 15(全て is_test) / gmail 3 / icloud 1。**example.com の20件は必ずハードバウンスする** |
| ④ | weekly-jobs は当時0通だったが、それは過去7日の新着が0件だっただけ。**求人を1件公開した翌週から39人全員に送られ始める時限式**だった |

### ①②③ すべて解消済み（2026-08-10）

**技術的な障害は無い。再開するかどうかは製品判断。**

| # | 状態 |
|---|---|
| ① | ✅ 解消。`ow_match_scores` を読むのをやめ、希望条件から実際に算出する |
| ② | ✅ 解消。`ow_profiles.email_weekly_enabled` を作り、cron が読むようにした |
| ③ | ✅ 解消。宛先を `getWeeklyRecipients()` に集約し、除外を実装した |

再開の手順（**両方やらないと動かない**）:
1. Vercel の環境変数に `WEEKLY_EMAIL_ENABLED=true`
2. `vercel.json` の `crons` にルートを戻す

#### ① マッチング（weekly-match）

`ow_match_scores`（0件・**書き込む主体が存在しない**）を読むのをやめ、
`getJobs()` ＋ `lib/matching/scoreJob.ts` の `computeRecommendations` に置き換えた。
`/jobs` の「あなたへのおすすめ」と**同じ関数・同じデータ**を通る。

⚠️ **求人を独自に select しないこと。** `getJobs()` を使わないと
   `roleIds`（祖先まで展開済み）が付かず、職種マッチが常に外れる。

⚠️ **希望条件が1つも無い人には送らない。** 以前はそこを `matchScore: 75` で
   埋めて「あなたへのおすすめ」として送っていた
   （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
   `computeRecommendations` はしきい値未満と理由が作れないものを自分で落とすので、
   0件なら送るものが無いということ。**呼び出し側で補完しない。**

⚠️ **マッチ度の数字（%）は出さない。** 根拠のある数字を出せるようになったが、
   「マッチ度%・星評価を出さない」がこのプロダクトの方針（Hisato 思想⑦）。
   代わりに `reasonText`（なぜ選ばれたか）を文で出す。

⚠️ 理由を捏造していた `getDefaultReason()`（求人カテゴリだけから
   「SaaS営業の経験が活かせる」等を作っていた）は削除した。

実測（2026-08-10）: 週次の宛先3名は全員が希望条件を持っており、
`/jobs` の同じ経路で **5件**の実マッチが出ることを確認した。
参考として `ow_profiles` 39件のうち希望条件が入っているのは **6件**。

#### ② 配信停止（`20260810111308_email_notification_settings.sql`）

| | |
|---|---|
| 列 | `ow_profiles.email_weekly_enabled` / `email_scout_enabled`（NOT NULL DEFAULT true） |
| 保存 | `PUT /api/jobseeker/email-settings` |
| UI | `/profile/edit?tab=account`。**localStorage をやめた** |
| cron | `email_weekly_enabled = true` の人だけに送る |

⚠️ **UI の項目は実在するメールと1対1にすること。** 直す前は3項目のうち
   「新着企業」「新着記事」に対応するメールが**存在せず**、逆に実在する
   新着求人メールには項目が無かった。設定できるのに効かない／効くのに設定できない、
   の両方が同時に起きていた。

⚠️ **`=== true` で見る。`!== false` にしない。** 値が読めなかったときに
   送ってしまう向き（fail-open）にしないため。

#### ③ 宛先（`src/lib/notify/weeklyRecipients.ts`）

**weekly-jobs と weekly-match で別々に書かないこと。** 割れていたのが原因。

実測（2026-08-10、本番データ）: `ow_profiles` 39件 → 宛先 **3名**

| 除外 | 件数 | 理由 |
|---|---|---|
| `ow_users` に対応なし | **20** | アプリ上は存在しない。**必ずハードバウンスする** |
| `is_test` / システム | 16 | 社内・検証用 |
| 配信停止 | 0 | まだ誰も切っていない |

⚠️ 何人をなぜ落としたかを `console.log` と応答 JSON の両方に出している。
   **黙って減らすと「送ったつもり」になる。**

#### 配信停止リンク

⚠️ メール末尾は `/mypage` を指していたが、**そこに設定 UI は無い**。
   `unsubscribeUrl()` で `/profile/edit?tab=account` に直した。
   リンク先を変えるときは、そのタブが実在するか確かめること。

### ✅ ①（解消済み。2026-08-30 に確認）

「75%」と「プロフィールに基づいて」は**既に消えている**。
`api/cron/weekly-match/route.ts` の冒頭に「① マッチ度「75%」に根拠が無い → ✅ 解消」と
書かれており、いま残っている `75` の記述は**すべて経緯を説明するコメント**。

⚠️ **メール自体は今も停止中**（`WEEKLY_EMAIL_ENABLED` 未設定 ＋ `vercel.json` の
   `crons` が空）。再開は**両方**戻す必要がある。

⚠️ **`ow_match_scores` を作り直す必要は無い。** 希望条件
（`ow_profile_desired_roles` と `ow_profiles.desired_*`）と
[src/lib/matching/scoreJob.ts](src/lib/matching/scoreJob.ts) でその場で出せる。
事前計算テーブルは「書き込む主体が最初から存在しない」まま残っているだけ。

⚠️ ただし **2026-08-07 時点で希望条件が入っているのは39人中6人**
（職種6 / 勤務スタイル2 / 年収3 / フェーズ3 / 転職時期2）。
「スコアリングに繋げば良くなる」ではなく、**希望条件が空の人に何を送るか**を決めるのが本体。
今のコードはそこを「75%」で埋めて誤魔化していた。

⚠️ 期限切れ遷移（`status` を expired に）が weekly-jobs に同居しているが、
**実 UPDATE は元からコメントアウト**されており、`ow_jobs` 20件の `expires_at` は
**全件 NULL**（migration 257）なので該当0件。停止の影響は無い。
有効化するときは weekly-jobs に相乗りさせず**別の cron に切り出すこと**。
メールの停止と求人の寿命は別の関心事で、片方を止めるともう片方も止まる形にしない。

⚠️ **`RESEND_API_KEY` を消してメールを止めない。** `lib/notify/email.ts` 経由の
応募・面談・招待・スカウト返信（13ファイルから参照）が全部死ぬ。

---

## ⚠️ 未実装課題メモ

### ✅ カジュアル面談の個人指名は配線済み（2026-08-25 に実装 / 2026-08-30 に通知まで到達）

**この節は「未実装」と書かれたままだったので書き直した**（2026-08-30）。
`?person=` は捨てられておらず、DB にも画面にも通知にも届いている。

| 経路 | 実体 |
|---|---|
| 渡す側 | `/u/[id]` と `companies/[id]/CompanyEmployeeSections.tsx` が **`?person={ow_users.id}`** |
| 受ける側 | `casual-meeting/page.tsx` の searchParams に **`person?: string`** がある |
| 保存 | **`ow_casual_meetings.requested_user_id`**（`member_id` ではない。名前に注意） |
| 企業の画面 | `MeetingDetailPanel` が「**◯◯ さんに聞きたい**」 |
| **通知メール** | **2026-08-30 に追加**（運営向け・企業向けの両方に「指名」行） |

⚠️★**検証は API 側で必ず行う。** `POST /api/casual-meetings` が
   「**その企業に在籍中（`is_current`）** かつ **掲載中の面談対応者**（`is_public` かつ
   `display_consent`）」の2条件を確かめてから記録する。**URL の値をそのまま信じない**
   （信じると、掲載していない人・別会社の人を指名として記録できてしまう）。
⚠️ 不正な値は**黙って null に落とす**。400 で申込ごと止めない（指名は任意で、
   企業宛の申込としては成立するため）。

⚠️★**通知に足したのは「最初に届く情報」だから。** 担当者は企業側が自己アサインする
   （`action: "assign_to_me"`）ので、**最初の通知に指名が無いと別の人が付く。**
   DB と画面にだけあっても、メールが落としていれば実質伝わっていなかった。

⚠️ **指名が無いときは行ごと出さない。**「（指名なし）」とは書かない
   （指名は任意の機能で、無いことに意味がある）。

⚠️ 残っているのは**指名した人に本人へ通知が飛ばないこと**。いま届くのは企業の
   通知先（79社中7社）と運営だけで、**名指しされた本人は知らない。**
   作るなら「本人が受け取るか」の設定とセットにすること。

---

## Hisato 思想（実装済み）

1. **キャリアを考え続ける人**: 「転職活動中」フラグなし。情報収集中でも使える
2. **Users 統合設計**: `is_mentor` フラグ1つで求職者↔メンター動的発動（マイページで実証済み）
3. **スカウトしない、採用を**: 企業→求職者へのスカウト機能なし。対話から始まる設計
4. **運営の丁寧な介在**: メンター登録は個別声がけ、相談は編集部が精査してから転送
5. **モニター期配慮**: 料金表示なし、無料バッジ（MVP期間中は無料）のみ
6. **在籍企業には「止めずに知らせる」**（2026-08-29 に方針変更）:
   在籍中の企業へのカジュアル面談も**申し込める**。
   ⚠️★**以前は UI でブロックしていたが撤去した。戻さないこと。**
      判定は `ow_experiences.is_current` ＝**本人の自己申告**で、
      **退職済みなのに更新が漏れている人が申し込めずに止まっていた。**
      自己申告を根拠に入口を塞ぐのは強すぎる、という判断（柴さん）。
   ⚠️ 代わりに申込フォームの冒頭で「**プロフィールでは現在も在籍中として
      登録されています**」と伝え、職歴の更新へ導線を出す。**赤くしない・止めない。**
   ⚠️★**企業には伝えない。** 本人が更新し忘れている事実を、断りなく企業へ渡さない。
   ⚠️★**API 側には元からブロックが無い**（`POST /api/casual-meetings`）。
      画面のブロックを外した時点で、**止める仕組みは1つも無い。**
      「API が守ってくれる」と思わないこと。
7. **数値データ撤廃**: マッチ度%・星評価なし。求職者が自分で判断する
8. **position_members**: 各求人に「この職種を経験した人」を表示。snapshot思想
9. **取材時スナップショット**: 記事の `role_at_interview` + `current_status` で時制を両方表示

---

## ⚠️ ロゴ（2026-09-06 に確定）

**公式ロゴは `public/brand/` の12ファイルが原本。** シンボル（右下が斜めに欠けた四角）＋
ワードマーク **`OPINIO`**。色は **`#141414` の1色**と、その白版だけ。**それ以外の色は無い。**

⚠️★**納品時は `OPiNiO`（i が小文字）だった。2026-09-06 に全部大文字へ変更した**（柴さんの指示）。
   元のファイルは `3d671987` に残っている。字形は目分量ではなく同じ書体の寸法から作った ——
   **縦棒の幅 8.9 は P・N と同じ／上端は N の字形から読んだカムハイト／小文字の点は削除**。
   ⚠️ タグラインの「Truth to Careers」は小文字のまま。

| 何を | どこ |
|---|---|
| 原本（納品物そのまま） | **`public/brand/*.svg`**（横組み・縦組み・ワードマーク・シンボル・アプリアイコン・タグライン入り、各白版） |
| 画面で使う部品 | **[components/common/OpinioLogo.tsx](src/components/common/OpinioLogo.tsx)** |
| OG 画像で使う data URI | **[lib/brand/ogLogo.ts](src/lib/brand/ogLogo.ts)** |
| favicon / PWA アイコンの生成 | **`node scripts/gen-brand-icons.mjs`** |

### ⚠️ 画面から `public/brand/*.svg` を直接読まない

`OpinioLogo` を使う。**色は `currentColor`** なので、暗い背景では親に `color: "#fff"` を
指定するだけでよい。**`*-white.svg` を別に読み込まないこと**（読み込み経路が2つになる）。

⚠️ **`--brand-ink`（#141414）はロゴ専用。** 本文には `--ink`、主要導線には `--royal` を使う。
   UI の色として流用すると、ロゴが改訂された日に本文まで動く。

⚠️★**サイトの配色（`--royal` #002366）は変えていない。** ロゴだけが墨色で、
   ボタン・リンク・PWA の `theme_color` は従来どおり濃紺。**「ロゴが黒いから」を理由に
   `--royal` を置き換えないこと**（それはロゴの決定とは別の判断）。

### ⚠️ パスデータは3箇所にある。手で編集しない

`OpinioLogo.tsx` / `ogLogo.ts` / `gen-brand-icons.mjs` の3つが同じ形を持っている
（それぞれ currentColor・data URI・ラスタライズと用途が違い、共有できない）。
**ロゴを差し替えるときは `public/brand/` を入れ替えたうえで3つとも作り直す。**

⚠️ `OpinioLogo.tsx` の値は原本から機械的に写し、**小数を2桁に丸めた**（11.5KB → 7.5KB）。
   928×243 で描き比べて**画素差0**を確認済み。

### ⚠️ アイコンを作り直したら `public/sw.js` の `CACHE_VERSION` を上げる

画像は Service Worker が **CacheFirst + 30日 TTL** で持つ。上げないと
**既存の利用者に最大30日ふるいロゴが出続ける。** 旧キャッシュを消すのはこの値の変更だけ。

⚠️ `public/icons/pwa/generate-icons.html`（手作業の生成ページ）は**削除した**。
   旧デザイン（Speech Bubble）を焼き込んでおり、開くと古いアイコンで上書きされる。
   生成は `scripts/gen-brand-icons.mjs` に移した。

### ✅ ついでに直した「静かに壊れていた」3件

| 何が | 症状 |
|---|---|
| `layout.tsx` の `openGraph.images` | 実在しない **`/og-image.png`（本番で 404）** を指し、ファイル規約の `opengraph-image.tsx` を**上書きしていた**。＝サイト既定の OG 画像が一枚も出ていなかった |
| `opengraph-image.tsx` | その裏で **satori が `Expected <div> to have explicit "display: flex"` で落ちていた**（`<br />` で子が3つになる）。`.arrayBuffer()` に変えて初めて 500 として表に出た |
| `<link rel="mask-icon">` | **PNG を指していた。** Safari のピン留めタブは単色 SVG しか受けない＝一度も表示されていない |

⚠️ **`metadata.openGraph.images` を書かないこと。** 書くと `opengraph-image.tsx` がまた死ぬ。

⚠️ メール（`lib/notify/templates.ts`）のヘッダーは **PNG を絶対URLで**参照している。
   **SVG を貼らない**（Gmail は落とし、Outlook は描かない）。**`alt="OPINIO"` を消さない**
   ——画像をブロックする受信者にはそれが唯一のロゴになる。

---

## 技術的注意事項

### 作業ディレクトリ
- ファイルは `/Users/hisato/opinio-work/src/...` に直接書く（worktree 不要）
- dev サーバーは `/Users/hisato/opinio-work/` で `npm run dev`（launch.json の `dev`）

### ⚠️ セッションを並行させるときのルール（2026-08-12 確立）

**同じリポジトリで2つ以上のセッションを同時に動かす日は、着手前にこれを決める。**

2026-08-12 に**同じ日に2回**事故が起きた。どちらも git ではなく
**ローカル資源（ポート3000 と `.next`）の共有**が原因。

⚠️ **2026-08-15 に git 側でも起きた。** 別セッションが全体をステージして
   コミットし、進行中だった他セッションの変更ごと push した。
   ステージングと push の手順は本ドキュメントの「Git 運用方針」を参照。

| # | 事故 | 何が起きたか |
|---|---|---|
| ① | dev サーバーの二重起動 | 別セッションのサーバーに気づかず起動。`ps` の grep に引っかからないタイミングだった。全ページが 404 になり、コードを疑った |
| ② | ビルド中の `.next` 削除 | `rm -rf .next && npm run build` の最中に別セッションが dev を起動。`Cannot find module './9085.js'` で両方壊れた |

#### 決めること（3つ）

1. **dev サーバーは片方のセッションだけが起動する。**
   もう片方は `curl http://localhost:3000/...` で共有サーバーを使う。
   起動前に必ず確認する。⚠️ `ps` だけでは足りない。**ポートを見る。**

   ```bash
   lsof -nP -iTCP:3000 -sTCP:LISTEN
   ```

   ⚠️ `preview_start` が「port 3000 was in use, so port XXXXX was assigned」と
   言ったら、**それは別セッションが動かしているサイン。** 別ポートで使わず止める。

2. **`npm run build` と `rm -rf .next` は、dev を止められる側だけが実行する。**
   もう片方は次の2つで止める。**どちらも `.next` を触らない。**

   ```bash
   npx tsc --noEmit
   npx next lint --dir src
   ```

   ⚠️ 本番ビルドの通過確認が要るのは push 直前だけ。それ以外は上の2つで足りる。

3. **着手前に「触るファイル群」を宣言し、重なったら片方が待つ。**
   2026-08-12 の2セッションは**ファイル衝突0件**だったので、これで足りていた。

#### ⚠️ worktree で分ける案は採らない

- CLAUDE.md の「main に直接コミットする / worktree 作成禁止」に反する
- **`.next` が分かれてもポート3000 と本番 Supabase は共有のまま**なので、
  上の2件の事故は防げない
- **migration の衝突リスクはむしろ上がる。** 両方が別々に `db push` すると
  採番が飛び、`schema_migrations` と実体がずれる

#### 論理的な重なりはファイル名では見つからない

ファイルが別でも、**同じ前提を見ている**ことがある。2026-08-12 の実例:

| 重なり | 何が起きたか |
|---|---|
| 公開企業数 | 別セッションが検証用企業を1社追加。こちらの事後チェック（「70→61になるはず」）が 62 になった |
| 可視性の規約 | 別セッションが `lib/companies/visibility.ts` で「`is_published` を直書きするな」と決めた。こちらが作った `/admin/companies/coverage` は直書きのまま（**運営画面なので意図的に対象外**） |

⚠️ **「別セッションが変えうる数字」を事後チェックの固定値に使わないこと。**
   件数は「変更前後の差分」で検証する。

### ⚠️★`npm run build` は本番 Supabase の Auth を落とす（2026-08-23 実測）

**検証のためにビルドを回すと、その間 opinio.jp にログインできなくなる。**

⚠️ **機構の説明はこの節だけでは足りない。** 同日さらに深いダウン（約40分）が起きて
   実体が **Disk IO バジェットの枯渇**だと確定した。**再起動では直らない**など、
   この節の記述からは導けない性質がある。**下の「実体は『負荷』ではなく〜」を必ず併せて読むこと。**
   なお 2026-08-23 に MICRO へ上げ、事前生成も 79→12 に絞ったので、
   **この節が書かれた当時よりビルドの危険度は下がっている**（無くなってはいない）。

prerender は掲載中の企業ページなどを一気に生成し、**1ページごとに本番 Supabase へ
問い合わせる**。実測（2026-08-23 / UTC）:

| 何が | 実測値 |
|---|---|
| このマシン → PostgREST | **2,204 req/分**（03:47）・**2,393 req/分**（03:52）・1,039 req/分（04:08） |
| GoTrue | Postgres に接続できず **500**：`dial tcp [::1]:5432: operation was canceled` |
| `POST /auth/v1/token?grant_type=password` | **504**（origin_time **59,993ms**＝60秒でタイムアウト） |
| `/auth/v1/health` | **72秒**かけて 504 |

⚠️ **Vercel の本番ビルドも同じ prerender を回す。** ローカルのビルドと重なると二重に叩く
   （2026-08-23 03:51 に実際に重なった）。**push のタイミングも同じ性質を持つ。**

#### ★手順（「気をつける」ではなく、これに従う）

1. **検証ビルドは最後に1回だけ。** ステップごとに回さない
2. **中間の確認は dev サーバーの未ログイン HTML で代替する。**
   「氏名が焼かれていないか」「文言が入っているか」は dev の匿名レスポンスで同じ判定ができる
   （2026-08-23 に両方で測り、結果が一致することを確認済み）
3. **prerender の実物（`.next-prod/server/app/**.html`）を見るのは push 直前の1回だけ**
4. **回す前に柴さんに一声かける。** 回している間ログインできなくなる

⚠️ `distDir` を分けても**防げない**。あれはローカルのファイル衝突の対策で、
   **本番 Supabase への負荷は dev と build で二重になる。**

#### ★「ログインできない」を見たときの切り分け（2026-08-23 確立）

**アプリのバグに見えるが、上のビルド負荷がこの形で現れる。** 実際に原因特定へ何往復もした。

| 画面に出るもの | 実体 |
|---|---|
| ボタンが「**ログイン中...**」のまま固まる | `signInWithPassword` が**60秒ハング**している最中 |
| 赤い枠に「**`{}`**」とだけ出る | **504 の空ボディ**。`@supabase/auth-js` の `_getErrorMessage` が最後に `JSON.stringify(err)` へ落ち、`{}` という**文字列**がそのままエラー文言になる |

⚠️ **`{}` を「文言の実装漏れ」と読まないこと。** 文言は正しく動いており、
   **サーバーが中身の無い応答を返している**という意味。

##### 手順（この順で見る。逆順だと空振りする）

1. **`edge_logs` で `grant_type=password` の POST が何回届いたかを数える。**
   ここが起点。**クリックした回数と合わなければ、リクエスト自体が飛んでいない／死んでいる。**

   ```sql
   select timestamp, log_attributes['request.search'] as grant,
          log_attributes['response.status_code'] as status,
          log_attributes['response.origin_time'] as origin_ms
     from logs
    where source='edge_logs' and log_attributes['request.path']='/auth/v1/token'
      and log_attributes['request.method']='POST'
      and timestamp > now() - interval 24 hour
    order by timestamp desc;
   ```

   実測（2026-08-23）: **24時間で2回だけ**。01:37 は 200（427ms・成功）、
   04:01:51 は **504（origin_time 59,993ms）**。何度クリックしても飛んでいなかった。

2. **`auth_logs` も見る。ただし504はここに出ない。**
   ゲートウェイで死ぬので **GoTrue に届かず記録が残らない**。
   ⚠️ **`auth_logs` だけ見ると「何も起きていない」ように見える。**
   ここに出るのは 500 のほう（`failed to connect to ... dial tcp [::1]:5432`）。

3. **発信元 IP ごとの req/分 を数えて、叩いている主体を特定する。**

   ```sql
   select toStartOfMinute(timestamp) as minute,
          log_attributes['request.headers.cf_connecting_ip'] as ip, count() as n
     from logs where source='edge_logs' and timestamp > now() - interval 60 minute
    group by 1,2 having n > 20 order by minute desc, n desc;
   ```

   ⚠️ **自分のグローバル IP を先に調べておく**（`curl -s https://api.ipify.org`）。
      ローカルの dev / build は**この IP で出る**。Vercel は AWS ap-northeast-1 の IP 群。

4. **`/auth/v1/health` を数回叩いて、Auth 自体の健康を見る。**
   アイドル時は **0.07秒**。1秒を超えていたら詰まっている。

   ⚠️ **★必ず `apikey` を付ける。付け忘れると「健康」と誤読する（2026-08-23 に実際に起きかけた）。**
      `apikey` が無いと **Kong が手前で 401 を返し、GoTrue にも PostgREST にも届かない。**
      **401 の速さは背後のサービスの生死と無関係。**

   ```bash
   curl -s -o /dev/null -w "%{http_code} %{time_total}\n" \
     "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
   ```

   実測（2026-08-23 06:05 UTC・データ層が**完全に無応答**だった最中に同一ホストから連続実行）:

   | | apikey あり | apikey なし |
   |---|---|---|
   | `/auth/v1/health` | **000（12秒 無応答）** | 401（0.10秒） |
   | `/rest/v1/ow_roles?limit=1` | **000（12秒 無応答）** | 401（0.08秒） |

   ⚠️ **タイムアウトが確定している PostgREST でさえ、apikey 無しなら 0.08秒で 401 を返す。**
      つまり apikey 無しの計測は**何も測っていない**。

   ⚠️ **切り分けの言い方にも注意。** この日の実体は「Auth は無事で DB だけ落ちた」ではなく、
      **「DB が飽和し、GoTrue も PostgREST も巻き込まれて無応答」**だった。
      片方だけ生きていると誤認すると、復旧判定も原因追及も外れる。

##### 判定

| 観測 | 結論 |
|---|---|
| password POST が**届いていない** or 504 | **本項のビルド負荷**。`ps aux \| grep "next build"` を見る |
| password POST が **400 invalid_credentials** | 本当に資格情報が違う |
| password POST が **200 なのに画面が進まない** | 遷移側の問題。「★フルナビゲーションで遷移する」を参照 |

⚠️ **`auth.users` を見て「BAN されていないか」から入らないこと。** 今回それは全部正常で、
   `last_sign_in_at` も更新されていた。**壊れていたのはアカウントではなく経路。**

### ⚠️★実体は「負荷」ではなく **Disk IO バジェットの枯渇** だった（2026-08-23 夕方に確定）

**上の節（ビルドが Auth を落とす）は現象としては正しいが、機構の説明が足りていない。**
同日さらに深いダウン（**約40分・完全無応答**）が起きて機構が確定したので、ここに追記する。

#### ⚠️ 「捌けなくなった」のではない。**捌き切った直後に落ちた**

| 時刻(UTC) | リクエスト | 応答 |
|---|---|---|
| 05:35〜05:40 | **2,403 / 2,307 件（5分あたり）** | **ほぼ全部 200** |
| **05:45** | — | **ここで崩壊** |
| 05:50〜06:35 | 数十件（5分あたり） | **ほぼ全部 522** |

**ピーク（＝ビルド中）は毎秒8件を 200 で返せていた。壊れたのは負荷が終わった瞬間**で、
その後**ほぼ無負荷のまま40分回復しなかった**。
「同時接続が多すぎる」でも「重いクエリがある」でもない。

#### ⚠️ 決め手は**カタログクエリの所要時間**

ダッシュボード自身の監視クエリが、この値になっていた。

| クエリ | 実測 |
|---|---|
| `SELECT setting FROM pg_settings WHERE name='max_connections'` | **11,432 ms** |
| `SELECT count(*) FROM pg_stat_activity ...` | **15,172 ms** |

**ユーザーテーブルに触らずロックも取らないクエリが11〜15秒**。
接続過多なら軽いカタログ読みは速いまま、重いクエリが原因なら他は速いまま。
**全部が一様に遅いのは、インスタンスの資源そのものが絞られている証拠。**

正体はダッシュボードのバナーにそのまま出ていた:

> **Your project is about to deplete its Disk IO Budget**
> Once exhausted, disk throughput will return to its **baseline of 5 MB/s**

#### ⚠️★**再起動では直らない**

バジェットはプロセスの状態ではなく**インフラ側の予算**なので、プロジェクトを再起動しても
戻らない。実際に再起動後7分間・18回ポーリングして**全て無応答**だった。
**「再起動したのに直らない」を、別の原因を探す理由にしないこと。**

#### 直し方（実際に効いたもの）

**コンピュートを NANO → MICRO に上げた瞬間に復旧した**（06:40 のログで 200×115 に切替）。

⚠️ **NANO → MICRO は `Free Upgrade` で時間単価が同額**（$0.01344/時）。
   メモリ 0.5GB→1GB、CPU 共有→2コア専有。**上げない理由が無い。**

効いた理由はメモリ。**DB は 25MB しかないので、1GB あれば全部バッファキャッシュに載る。**
復旧後に実クエリを `EXPLAIN (ANALYZE, BUFFERS)` した結果:

```
Execution Time: 6.598 ms
Buffers: shared hit=619 read=1     ← ディスクを1ブロックしか読んでいない
```

**ディスクを読まなければ IO バジェットは減らない。** これが本質。

#### 再発防止（同日に実施済み）

`companies/[id]` の `generateStaticParams` が掲載中の**全79社**を返しており、
1ページ10テーブル前後 ＝ **1ビルド約790クエリ**だった。これを**12社**に絞った。

⚠️ **事前生成の効果は `revalidate` の秒数しか持たない。** このページは
   `revalidate = 60` なので、デプロイ後60秒を過ぎればどのみち要求時に作り直される。
   **全件を事前生成するのは、60秒のために毎ビルド790クエリ払う取引だった。**

実測: **1ビルドあたり 約2,200件 → 約606件（-72%）・エラー0件。**

⚠️ **`generateStaticParams` 自体は消さないこと**（件数を絞るのは可）。
   2026-08-09 の実測どおり、この関数が無い動的セグメントは ISR が効かず毎回 MISS になる。
   絞った後の実測（本番）: 事前生成した企業は `PRERENDER → HIT`、
   **対象外の企業も `MISS → HIT`** で、ISR は効いている。

#### ⚠️ 次に同じ症状を見たときの手順

1. **負荷が続いているかを先に見る。** 止まっているのに遅いなら、これ
2. **カタログクエリの所要時間**を見る（`postgres_logs` の `duration:`）。
   数ミリ秒で終わるはずのものが秒単位なら資源の絞り
3. **ダッシュボードの Disk IO Budget** を見る（Observability → Database）
4. **再起動を試すのは後。** 効かない
5. 迷ったら**コンピュートを1段上げる**。MICRO までは無料

### ⚠️★performance advisor の727件を鵜呑みにしない（2026-08-23 実測）

`get_advisors(performance)` は **727件**を返す。内訳と、**このデータ規模での実際の妥当性**:

| 件数 | 種別 | 判断 |
|---|---|---|
| 371 | `multiple_permissive_policies` | 実在の負荷だが、**統合は権限の意味を変えうる**。要設計 |
| 153 | `auth_rls_initplan` | **これだけが安全で規模に依らない**。`auth.uid()` → `(select auth.uid())` |
| 137 | `unused_index` | **いま判断できない**（下記） |
| 65 | `unindexed_foreign_keys` | ⚠️ **足すな。逆効果** |

#### ⚠️ FK にインデックスを足さないこと

**このDBは既に極端に過剰インデックス。** 実測（2026-08-23）:

```
ユーザーテーブル合計 10 MB のうち、インデックスが 6 MB（60%）
インデックス 411本 / DB 全体 25 MB
```

| テーブル | 実データ | インデックス | 比 |
|---|---|---|---|
| `ow_company_admins` | **8 KB** | **112 KB** | **14倍** |
| `ow_job_applications` | **8 KB** | **104 KB** | **13倍** |
| `ow_experiences` | 32 KB | 152 KB | 5倍 |

⚠️ **20行のテーブルは Seq Scan のほうが速い。** 実際、復旧後の `EXPLAIN` でも
   `ow_jobs`(20行) と `ow_company_members`(6行) は Seq Scan で 6.6ms で終わっている。
   ここに65本足すと、**読みは速くならず、書き込みのIOだけ増える**
   ——つまり **Disk IO バジェットを削る側に効く。**

⚠️ advisor は「大きなテーブル」を前提にした一般則を出しているだけで、
   **件数を見ていない。** 提案を適用する前に必ず行数とサイズを見ること。

#### ⚠️ `unused_index` は「いま」判断できない

```sql
select stats_reset from pg_stat_database where datname = current_database();  -- null
select max(greatest(last_autoanalyze, last_analyze)) from pg_stat_user_tables; -- null
```

**統計がリセットされた直後**（2026-08-23 のコンピュート変更）で、
`idx_scan = 0` は「使われていない」ではなく**「まだ観測できていない」**。
`n_live_tup` も 0 と出るので行数も信用できない。

⚠️ **インデックスを落とすなら、統計が最低1週間たまってから。**
   ただし上の「6MB / 411本」は**サイズ由来の事実**なので、過剰であること自体は確か。
   減らす方向で検討する価値はある（足す方向ではない）。

#### まとめ

**いま手を付けてよいのは `auth_rls_initplan` の153件だけ。** ただし急ぎではない
（MICRO 化後は CPU 35% / `shared hit=619 read=1`）。着手するなら
anon / 非admin / admin の3者実測をセットで行うこと。

### ⚠️ dev サーバーは絶対に2つ同時に起動しない（2026-08-03 確立）

**起動前に必ず既存プロセスを確認し、あれば停止する。**

```bash
ps aux | grep -E "next-server|next dev" | grep -v grep
# 出てきたら親（node .../next dev）→ 子（next-server）の順に kill
```

`preview_start` が「port 3000 was in use, so port XXXXX was assigned instead」と言ったら、
**それは前のセッションの dev サーバーが生き残っているサイン**。別ポートで起動せず、先に止める。

#### ★`npm run dev` には guard が入っている（2026-08-22）。ただし穴がある

`package.json` の **`predev`** が [scripts/next-guard.sh](scripts/next-guard.sh) を呼ぶ。
既に `next dev` / `next-server` が生きていたら、**PID とコマンドラインと待ち受けポートを
名指しして中止する**（どれと衝突しているか分からないと、結局 kill -9 の総当たりになるため）。

⚠️ **これで防げるのは①（dev の二重起動）だけ。過信しないこと。**

| 防げない経路 | 理由 |
|---|---|
| **`npx next dev` を直接叩く** | npm の `pre*` フックは **`npm run dev` 経由でしか走らない**。素通りする |
| **2セッションが同時に検査する** | 数秒の窓で両方通る。実際に踏んだのは「数分間の重なり」なので実用上は足りるが、**原理的な穴は残る** |
| **`build` / `start`** | **guard の対象外**。ローカルでは `.next-prod` に出るので衝突しない（`distDir` 側で担保）。`prebuild` / `prestart` には**あえて差していない** ——`prebuild` は Vercel の `npm run build` に差さる唯一の経路で、**本番デプロイを止めうる**ため |

⚠️ **fail-open（迷ったら通す）で書いてある。** `pgrep` が無い環境、`VERCEL` / `CI`、
   `OPINIO_ALLOW_NEXT=1` のときは**素通り**する。ここで誤って止めると開発が始められない。

```bash
OPINIO_ALLOW_NEXT=1 npm run dev   # 意図的に並走させたいとき
```

実測（2026-08-22。すべて実際に走らせて確認）:

| 条件 | 結果 |
|---|---|
| dev 不在で `npm run dev` | **起動する** |
| dev 稼働中に `npm run dev` | **中止**（exit 1）。PID・コマンドライン・ポート3000 を表示 |
| `OPINIO_ALLOW_NEXT=1` / `VERCEL=1` / `CI=1` | **素通り**（dev 稼働中でも exit 0） |
| `PATH` を潰して `pgrep`/`lsof` を消す | **素通り**（exit 0・出力0バイト） |
| `pgrep` はあるが `lsof` が無い | **中止する**。ポート行だけ落ちて PID は出る |
| dev 稼働中に `npm run build` / `npm start` | **影響なし**（`predev`/`prebuild`/`prestart` とも0件・両方 200） |

#### なぜ致命的か

2つの dev サーバーが同じ `.next/cache/webpack/` に書き込むと pack ファイルが壊れ、
**古いモジュールを持つ側がリクエストに応答して「変更が反映されない」症状が出る。**

エラーの連鎖はこの順で起きる（ログに出るのは②③だが、原因は①）:

| # | ログ | 意味 |
|---|---|---|
| ① | `Caching failed for pack: ENOENT: rename '0.pack.gz_' -> '0.pack.gz'` | **これが原因。** webpack は `X.pack.gz_` に書いてから rename するが、2プロセスが競合して一時ファイルを奪い合い、pack が書かれない／途中で切れる |
| ② | `Restoring pack failed: Error: invalid code lengths set` | ①の結果。gzip 解凍失敗＝ファイル破損 |
| ③ | `Restoring pack failed: TypeError: Cannot read properties of undefined (reading 'hasStartTime')` | ①の結果。snapshot が `undefined` に化けている（`hasStartTime` は webpack `FileSystemInfo.js` の `Snapshot` のメソッド） |

#### 症状

- インライン style などの変更が反映されない（`✓ Compiled` は出るのに）
- **ソースから消したはずの変数を参照して実行時エラー**（例: `filtered is not defined`）。
  `grep` でも `tsc --noEmit` でも異常なしなので、修正済みのコードを疑ってしまう
- **間欠的**。どちらのサーバーが応答するかに依存するタイミング依存の不具合

#### 対処

`rm -rf .next && npm run dev` は**対症療法**。2つ目のサーバーが動き続ける限り再発する。
必ず**プロセスを1つに落としてから** `.next` を消すこと。

#### 誤りだった仮説（同日に否定済み）

- ~~Sentry の webpack プラグインとの干渉~~ → `next.config.mjs` は
  `isDev ? nextConfig : withSentryConfig(...)` で **dev では Sentry を適用していない**
- ~~Node v26.5.0 と Next 14.2.35 の非互換~~ → ENOENT-on-rename は明確に競合の痕跡。単一プロセスでは起きない

### ⚠️ dev サーバー稼働中に `.next` を触る他のコマンドを打たない（2026-08-03 確立 / 2026-08-13 拡張）

**上の「dev 二重起動」とは別の事象。症状が似ているので混同しないこと。**

#### ★2026-08-22: 出力先を分けたので、この節の②③④は起きなくなった

**ローカルの `build` / `start` は `.next-prod` を使う**（`next.config.mjs` の `distDir`）。
`dev` だけが `.next` を使うので、**dev と build/start は物理的に衝突しない。**

| 何が | どこへ出るか |
|---|---|
| `npm run dev`（ローカル） | **`.next`** |
| `npm run build` / `npx next start`（ローカル） | **`.next-prod`** |
| **Vercel（本番）** | **`.next`（既定のまま。分岐に入らない）** |

⚠️ **Vercel では絶対に変えないこと。** `distDir` を条件分岐にすると出力トレースと
   噛み合わない箇所がある。`VERCEL` / `CI` があるときは分岐しない実装になっている。

⚠️ **これで防げるのは②③④だけ。①（dev の二重起動）は防げない**
   ——両方とも `.next` を使うため。①は**必ずポートで確認する**（下記）。

実測（2026-08-22 / いずれも再現しないことを確認）:

| # | 試したこと | 結果 |
|---|---|---|
| ② | dev 稼働中に `npm run build` | build 成功・**dev は 200 のまま**（`Cannot find module` 0件） |
| ③ | dev 稼働中に `npx next start -p 3100` | **両方 200**。3000=`.next` / 3100=`.next-prod` で共存 |
| ④ | build の直後に dev を起動 | **ハイドレート成功**（チャンク404なし・クライアント側の描画も動く） |

#### ⚠️ 対象は `npm run build` だけではない（2026-08-13 追記）

**⚠️ 以下は `distDir` を分ける前（2026-08-22 より前）の状態。経緯として残す。**

**`.next` を共有するのは以下すべてだった。** どれを打っても同じ事故になった。

| コマンド | 備考 |
|---|---|
| `npm run build` | — |
| **`npx next start`** | ビルド済みの `.next` を読む。**起動しているだけで衝突していた** |
| **`.claude/launch.json` の `prod`** | 中身は `npm run build && npx next start -p 3100` |

⚠️ **ポートが違っても `.next` は共有されていた。** `prod` は3100番だが、
   `--distDir` を指定していなかったので dev（3000番）と**同じ `.next` を読み書きしていた**。
   「ポートを分けたから大丈夫」は成り立たなかった。**いまは distDir 側で分かれている。**

⚠️ launch.json の `prod` には「dev と .next を共有するので同時に起動しないこと」と
   コメントがあるが、**CLAUDE.md 側にその記述が無かった**ため、ここを読んだだけでは
   `next start` が対象だと分からなかった（2026-08-13 に実際に踏んだ）。

#### 2026-08-13 に同じ節の事故を2回起こしている

並行セッションで作業していた日。**どちらも「別のセッションが `.next` を触った」形。**

| # | 誰が何をしたか | 症状 |
|---|---|---|
| ① | 別セッションが `npm run build` を実行 | 全ページ 500（`Cannot find module './vendor-chunks/@sentry.js'`） |
| ② | 別セッションが `next start`（3100番）を起動 | 1ページだけ 500（`Cannot read properties of undefined (reading 'call')`） |

⚠️ **②は間欠的に出る。** 壊れたチャンクを最初に参照したページだけが落ち、
   再取得すると 200 に戻ることがある。**「たまたま失敗した」と流さないこと。**

→ 並行セッションでの取り決めは「セッションを並行させるときのルール」を参照。
   **`.next` を触る前に、相手の dev が止まっていることを確認する。**

#### 症状

```
Error: Cannot find module './vendor-chunks/@supabase.js'
TypeError: Cannot read properties of undefined (reading 'call')   ← webpack-runtime.js
```

dev サーバーが 500 を返すようになる。モジュール名は `@supabase.js` に限らず、
その時参照されたチャンクなら何でも出る。

#### 原因

`npm run dev` / `npm run build` / `npx next start` は**同じ `.next/` を共有する**。
dev サーバーが稼働したまま build を走らせると、build が
`.next/server/vendor-chunks/` 以下を production 用に総入れ替えするため、
dev サーバーが握っていたチャンクへの参照が解決できなくなる。
`next start` も同じ `.next` を読むので、起動中に dev が再コンパイルすると同様に壊れる。

#### 対処

```bash
ps aux | grep -E "next-server|next dev" | grep -v grep   # 稼働中の dev を確認
# 出てきたら kill してから
rm -rf .next && npm run dev
```

`rm -rf .next` だけでは足りない。**dev を止めてから消すこと**（止めずに消すと
dev が消えた先を参照し続けて同じ症状が残る）。

#### 二重起動との違い

| | dev 二重起動 | build と dev の同居（本項） |
|---|---|---|
| 何が起きるか | 2プロセスが `.next/cache/webpack/` の pack を奪い合って壊す | build が `.next/server/` を上書きする |
| 再現性 | **間欠的**。どちらのサーバーが応答するか次第 | **確実に再現する** |
| 典型ログ | `Caching failed for pack: ENOENT: rename '0.pack.gz_'` → `invalid code lengths set` | `Cannot find module './vendor-chunks/*.js'` |
| 症状 | 変更が反映されない・消したはずの変数を参照して落ちる | ページが 500 になる |
| 直し方 | プロセスを1つに落としてから `.next` 削除 | dev を止めてから `.next` 削除 |

**判別のコツ**: 「変更が反映されない」なら二重起動、
「モジュールが見つからない」なら build との同居を疑う。

⚠️ **④ build の直後に dev を起動すると、クライアントチャンクが 404 になり、
   ハイドレートせず UI が古い状態のまま見える。500 にならないので
   「実装が効いていない」ように見え、コードを疑って直しにいくことになる。
   まず `.next` を消して再起動すること。**
   （`distDir` を分けた 2026-08-22 以降は起きないはずだが、
    `.next` が別の理由で壊れたときに同じ見え方になる。症状として覚えておく）

型チェックだけしたいなら build ではなく `npx tsc --noEmit` を使えば
`.next` を触らないので dev を止めずに済む。
ESLint も `npx next lint --dir src` は `.next` を書き換えない。
`npm run build` が要るのは本番ビルドの通過確認だけ。

### ⚠️★データが薄い画面は `/dev/preview` で見る（2026-08-30 確立）

**実データが無いせいで「確認できないまま出す」ことが実際に起きた。**
2026-08-30 に求人詳細の OB・OG を作ったとき、公開求人2件とも該当0名で
**カードが出る側を一度も描画しないまま本番へ出した。**

```
npm run dev → http://localhost:3000/dev/preview
```

**実コンポーネントに固定データを渡して、0件 / 1件 / 上限ちょうど / 上限+1 /
長文 / 大量 を縦に並べて見る画面。**

| | |
|---|---|
| 実体 | [src/app/dev/preview/](src/app/dev/preview/) |
| 固定データ | `fixtures.ts`（**境界値と長文を必ず含める**） |
| 本番 | **404**。全ページ先頭で `devOnly()` を呼ぶ（`NODE_ENV` はビルドで静的置換される） |

⚠️★**この配下で DB を読まないこと。** 読むと本番データを本番の外へ出す経路になる。

⚠️★**固定幅の箱に入れて並べないこと。** メディアクエリは**ビューポート幅**を見るので、
   固定幅のコンテナでは発火しない。縦に積んで**ブラウザ自体をリサイズ**する。

⚠️ **セクションを `page.tsx` のローカル関数で書かない。** preview から import できない。
   部品にすること（`JobEmployeesSection` は 2026-08-30 にそのために切り出した）。

⚠️ 新しいセクションを作ったら **`/dev/preview` の索引（`page.tsx` の `ITEMS`）にも足す。**
   足さないと誰も見に来ない。

#### なぜ DB にデータを入れる方法を採らなかったか

| | |
|---|---|
| **dev と本番が同じ DB** | 「dev だけにデータを入れる」ができない。入れた瞬間に公開される |
| **`is_test` は 46箇所で無条件に除外** | `is_published` と違い**dev 緩和が無い**ので、検証データを入れても求職者側に出ない |
| **モックは型定義にしか使われていない** | `mockJobData` などはデータ源として死んでいる |

⚠️ `is_test` を dev だけ通す案は**採らなかった**（46箇所を触ることになり、
   1箇所でも本番側に漏らすと検証データが公開される）。

#### ⚠️ 実データがどれだけ薄いか（2026-08-30 実測 / 本番）

フィード投稿 170 ／ 掲載企業 79 ／ 記事 16 ／ 主要製品あり 17社 ／
**実ユーザー 6（職歴あり 4）／ 面談対応者 5 ／ 導入事例あり 3社 ／
公開求人 2 ／ 福利厚生あり 2社 ／ ツールあり 1社**。

**企業詳細の中身はほぼ Salesforce 1社しか埋まっていない。**
⚠️ 数字は増えるので、**書くときは必ず日付を添える。**

---

### ⚠️ 画面まわりの計測は、測り方を間違えると逆の結論が出る

- **速度の前後比較**: 対照を取る / 中央値で見る / 同条件で測る / HTTP status を必ず一緒に取る。
  1日で4回、測り方が原因で誤った結論を出しかけた。
- **フォント**: next/font は可変フォントなので**ウェイトを減らしても1バイトも減らない**。
  重さの正体はサブセット数（和文は124分割）。
- **横はみ出し**: `document.documentElement.scrollWidth` で測ると見逃す。
  途中の `overflow: hidden` が隠すため。各要素が親の `clientWidth` を超えていないかで見る。
- **インライン style と CSS の優先順位**: レスポンシブで変えたい値
  （`fontSize` / `padding` / `display` / `flexDirection` / `width`）をインラインに書かない。
  `!important` で殴らない。
- **`min-height` は `height` に勝つ。** 自分でサイズを決めるボタンには `.btn-fixed-size` を付ける。
- **★`/u/{uuid}` は 308 で username に正規化される。** `curl` には **`-L` が要る**。
  2026-08-23 に付け忘れ、**リダイレクト本文を数えて「CTAが出ない」と誤判定しかけた**
  （4名とも0件に見えた。`-L` を付けたら正しい値が出た）。
- **★dev のコンパイル中に取得すると部分応答が返る。** 同じページが **26KB** と **89KB** で返り、
  短いほうには目的の要素が入っていなかった（2026-08-23 に2回踏んだ）。
  **サイズが極端に違うときは取り直す。**

→ 各項目の計測スクリプトと実測値は [.claude/rules/ui-debugging.md](.claude/rules/ui-debugging.md)
   （`.tsx` / `.jsx` / `.css` を扱うとき自動で読み込まれる）

### ⚠️ Supabase Auth の呼び出しは「中断」だけでは止まらない（2026-08-20 実証）

**`AbortController` で中断しても、`@supabase/auth-js` は再試行ループに入って約28秒かかる。**

`fetch.js` は **fetch の失敗をすべて `AuthRetryableFetchError` に変換**する
（「fetch failed, likely due to a network or CORS error」）。**AbortError もここに入る。**
`_refreshAccessToken` はそれを再試行対象と見なし、200 / 400 / 800 … と
**`AUTO_REFRESH_TICK_DURATION_MS = 30秒`** まで回し続ける。
中断済みの signal を使い回すので、1回ごとに即失敗して即座に次を積む。

| | middleware が返るまで |
|---|---|
| 中断（abort）だけ | **27.9秒** |
| 期限（`Promise.race`）＋中断 | **2.5秒** |

⚠️ **Vercel の middleware 上限は25秒。** つまり中断だけを掛けた状態は、
   詰まったときに**必ず 504 になる**。2026-08-20 の実測で、期限切れトークンのまま
   公開ページへ同時10本 → **6本が 504**。

→ **中断はソケットを閉じるために残し、返る時刻は `Promise.race` で決める。**
   実体は [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts)。

### ⚠️ 429 は「未ログイン」に化ける。突然ログアウトの正体（2026-08-20）

`@supabase/auth-js` の `NETWORK_ERROR_CODES` は **500〜530 だけ**で、
**429 は再試行対象に入っていない**。即エラーになり `user = null` で返るため、
middleware はそれを「未ログイン」と読んで `/auth` へ飛ばす。

本番ログの実例（2026-08-19 18:36:30〜34）:
`POST /auth/v1/token?grant_type=refresh_token` が **5秒間に21本、全部 429**。
すべて Vercel Edge Functions（＝middleware）由来。
アクセストークンが切れた状態で、ページ本体＋プリフェッチ＋API が同時に飛ぶと起きる。

⚠️ **GoTrue 自体は同時リフレッシュに強い**（実測: 同じトークンで同時20本 → 全部 200・0.8秒。
   15秒後の再利用も 200）。**競合そのものは原因ではない。** 効いているのは IP 単位の上限。

→ **一時的な失敗（429 / 5xx / 上限超過）だけ、250ms 後に1回だけ引き直す。**
   「そもそもログインしていない」で引き直さないこと（未ログインの全員に待ちを作る）。

⚠️ **`?? []` や `user = null` に倒す設計は、この種の失敗を全部「未ログイン」「0件」に見せる。**
   CLAUDE.md「★403 は『0件』として静かに素通りする」と同じ根。

### ⚠️ 認証の判定はページではなく middleware に置く（ソフト200）

`loading.tsx` を持つページで `redirect()` すると、**Suspense 境界の内側**で起きるため
**HTTP は 200 のままシェルが流れる**。

2026-08-20 の実測: 未ログインで `/mypage` `/mypage/settings` `/mypage/scouts`
`/mypage/conversations` `/mypage/bookmarks` が**すべて 200・66KB**を返していた。
2026-08-05 に casual-meeting / apply で踏んだのと**同じ形**。

→ 認証が要るパスは `src/middleware.ts` の `needsAuth` に足す。**ページ側の redirect だけに頼らない。**

### ⚠️★「5xx が原理的に出ない箇所」を3つ知っておく（2026-08-25 確立）

**共通する形は「ヘッダや戻り値が先に確定し、実処理が後から走る構造」。**
この形の箇所では、**失敗がステータスコードに現れない。**
だから **「エラーが出ていない」を正常の根拠にできない。**

| # | 場所 | どう化けるか |
|---|---|---|
| ① | `loading.tsx` を持つページの `redirect()` / `notFound()` | Suspense の内側なので**200 でシェルだけ流れる**（上節） |
| ② | supabase-js の呼び出し（`error` を戻り値で返す） | `?? []` で受けると **403 も 404 も「0件」**になる。`try/catch` では捕まらない |
| ③ | **`next/og` の `ImageResponse`** | **200 かつ空ボディ**になる（下記） |

#### ③ の機構（2026-08-25 に実物で確認）

Next 14 の `ImageResponse`（`node_modules/next/dist/server/og/image-response.js`）は
**コンストラクタで `Response` のヘッダ（200 / `image/png`）を確定し、
実際の描画は `ReadableStream` の `start()` の中で後から走る。**
描画が例外を投げてもヘッダは送出済みなので、**5xx にできず空ボディの 200 になる。**

⚠️ **実害: 1年3か月、誰も気づかなかった。** 2026-05-23 の初回実装（`e8129eae`）から
   バッジ付きの OG 画像が**1枚も生成されていなかった**（企業詳細84 / 求人詳細5 / 記事詳細16 = **105枚**）。
   原因はバッジ pill の **`width: "fit-content"`** で、satori の下の Yoga が
   `Invalid value fit-content for setWidth` を投げていた
   （Yoga の width は数値・パーセント・`auto` しか取らない）。

→ 対処は `await .arrayBuffer()` で**描き切ってから** `Response` を作ること。
   実体と3段階の縮退（通常 → バッジ抜き → 500）は
   [src/app/api/og/route.tsx](src/app/api/og/route.tsx)。

⚠️ **catch で無地の画像を返して終わりにしないこと。** 「静かに壊れている」状態に戻る。

#### この形を見つけたときの確かめ方

**status ではなく、返ってきた中身で判定する。**

| 対象 | 見るもの |
|---|---|
| 画像 | **バイト数**とマジックバイト（`89504e47`）。→ `./scripts/check-og.sh` |
| ページ | `<title>` と実HTMLの長さ、**あるはずの文字列が入っているか**（肯定形で） |
| クエリ | **行数**（`.select()` の戻り行。`mutate.ts` のヘルパー） |

⚠️ **OGP は壊れても誰も気づかない。** 手順を `scripts/check-og.sh` に残してある。
   OG 画像の見た目やパラメータを変えたら、これを1回流すこと。


### ⚠️ 「サイトが遅い」の実体は3層ある（2026-08-13 本番実測）

**遅さの正体はクエリではなかった。** Supabase の各クエリは実測 60〜110ms
（東京同士。Vercel も `hnd1`）で、ページを重くしていたのは別の3つ。

| 層 | 実体 | 実測 |
|---|---|---|
| ① **コールドスタート** | ISR キャッシュに載っている `/` 以外は全部サーバー関数を起動する | `/people` 2.68 → 0.82 → 0.66 → 0.50秒。`/companies` 3.39 → 1.27 → 0.37秒 ⚠️**この数字は 2026-08-30 に再現しなくなった。下の①を読むこと** |
| ② **middleware の認証往復** | `updateSession()` の `getUser()` が毎リクエスト Supabase Auth へ出ていた | `/`（ISRヒット）で 未ログイン 0.10秒 → **ログイン中 0.23〜0.27秒** |
| ③ **描画後のクライアント往復** | 遷移のたびに `getUser()` + `ow_profiles`。加えてヘッダーが `ow_users` を2回 | 「表示はされたのにまだ重い」の正体 |

②③ は 2026-08-13 に対処済み（下記）。
**① は未対処だが、⚠️ 2026-08-30 の実測では再現しない**（下の①を読むこと）。

⚠️ **TTFB で判断しないこと。** App Router はストリーミングするので、
   サーバーが遅くても TTFB は速いまま出る。`/companies` は
   **ttfb=0.3秒 / total=3.5秒** だった。**`time_total` を見ること。**

⚠️ **「初回だけ遅い」を環境ノイズとして捨てないこと。** 低トラフィックのページは
   利用者にとって**毎回が初回**（＝コールドスタート）になる。
   前後比較のときだけ warm にして測り、体感の話をするときは初回の値で語る。

#### 対処済み（②③）

| # | 場所 | 変更 |
|---|---|---|
| ② | `lib/supabase/middleware.ts` / `middleware.ts` | `updateSession(request, { verifyUser: needsAuth })`。公開ページは `getSession()`（期限内なら往復しない）に切り替え。**実測 60〜250ms → 2〜3ms** |
| ③ | `components/jobseeker/OnboardingGuard.tsx` | `getUser()` → `getSession()`、`onboarding_completed=true` を sessionStorage に記憶。**遷移あたりの Supabase 往復 2 → 0** |
| ③ | `components/jobseeker/JobseekerHeader.tsx` | `getSession()` と `onAuthStateChange` が同じ `ow_users` を2回引いていたのを1回に |
| ③ | `components/companies/CompanyAdminDndOverlay.tsx` | 未ログインなら `auth_is_admin` RPC を投げない（全訪問者が 230ms 負担していた） |

⚠️ **`verifyUser` は `needsAuth` と必ず同じ値にすること。**
   `getSession()` は署名を検証しないので、middleware の
   `needsAuth && !sessionUser` に渡る user は検証済みでなければならない。
   詳細は `lib/supabase/middleware.ts` の JSDoc。

⚠️ **StrictMode の二重実行を「直っていない」と誤読しないこと。**
   dev では effect が2回走るため、1回に減らした修正でも回数は2のまま出る。
   A/B（ガードを外して比較）で確かめること。

#### ① コールドスタートについて（⚠️ 2026-08-30 に再現しなくなった。着手前に必ず測り直す）

⚠️★**上の表の「3.39秒」は 2026-08-13 の値で、いま再現しない。**
   その後に入った2つの変更が効いている可能性が高い:
     * **コンピュートを NANO → MICRO** に上げた（2026-08-23。DB 25MB が全部
       バッファキャッシュに載り、`shared hit=619 read=1` になった）
     * **`generateStaticParams` を 79社 → 12社**に絞った（同日。1ビルド約2,200件 → 約606件）

**実測（2026-08-30 / 本番 opinio.jp / `time_total` / 30秒間隔で8回）:**

| | 2026-08-13 の記録 | **2026-08-30 実測** |
|---|---|---|
| `/companies` | 3.39 → 1.27 → 0.37秒 | **0.27〜0.54秒**（中央値 約0.31） |
| `/jobs` | — | **0.15〜0.25秒** |
| `/`（ISR HIT） | 0.10秒 | 0.07〜0.15秒（変わらず） |

⚠️★**「直った」と書かないこと。** 30秒の間隔では**関数がアイドルに落ちない**ので、
   これは**warm の値**であって**コールドスタートを測ったことにならない**。
   低トラフィックのこのサイトでは、夜間など**本当に空いた後の初回**は別の値になりうる。
   **真に測るなら、数時間アクセスが無かった直後の1発目を取ること。**

⚠️★**したがって、ISR 化・サーバーコンポーネント移行の大改修に着手する前に、
   まずここを測り直す。** 2026-08-13 の数字を根拠に着手すると、
   **既に解消しているかもしれない問題のために2ページを作り直す**ことになる。
   （2026-08-30 に実際に着手しかけて、測ったらこの状態だった。）

⚠️ 下に書いてある「ISR 化を試して戻した」経緯は**今も有効**。やるなら読むこと。

`/` だけが `x-vercel-cache: HIT` で常時 0.10秒。それ以外は `MISS` かつ
`cache-control: private, no-cache, no-store`。原因は2つ。

- `/companies` … `searchParams` を読むため App Router の仕様で動的レンダリングになる
- `/jobs` … `export const dynamic = "force-dynamic"`（「あなたへのおすすめ」のため）

##### ⚠️ `/jobs` の ISR 化は試して戻した（2026-08-13）。`revalidate` を足すだけでは SEO を壊す

パーソナライズを `GET /api/jobseeker/recommendations` に切り出して
`export const revalidate = 300` にしたが、**静的HTMLに求人が1件も入らなかった。**

`JobsClient` が `useSearchParams()` を使っており、Next 14 は静的生成時に
**最も近い Suspense 境界の fallback（スケルトン）を出力して打ち切る。**
求人データは RSC ペイロードには載るのでハイドレート後は出るが、
**クローラと初回描画が見るHTMLは空**になる。

| | 実HTML（script除去後） | 求人タイトル | 求人リンク |
|---|---|---|---|
| 動的（現行） | 73,088文字 | あり | 5件 |
| ISR（試作） | **11,526文字** | **なし** | **0件** |

⚠️ **ビルドは成功し、ルート表も `ƒ` → `○ (Static)` に変わる。** 型検査もlintも通る。
   **HTMLの中身を見るまで気づけない。** 静的化したら必ず
   「script を除いた実HTMLに、あるはずのデータが入っているか」を肯定形で確かめること。

   ⚠️ **prerender された実物を直接見るのが一番確実**（配信されるのはこのファイルそのもの）。
      ⚠️ **置き場所は 2026-08-22 に変わった。** ローカルの build は `.next-prod` に出る。

      ```bash
      npm run build
      grep -c '出てはいけない文字列' .next-prod/server/app/companies/salesforce.html
      ```

      `login_only` の面談対応者が未ログインに漏れていた件（2026-08-22）は、
      この方法で**氏名0件・user_id 0件**まで確かめている。
      ⚠️ dev サーバーの HTML でも代用できるが、**本番が配るのは prerender された方**。

ISR にしたいなら、先に**一覧の描画をサーバーコンポーネントへ移し**、
`useSearchParams()` に依存する絞り込みだけをクライアントに残す必要がある。
`/companies` も同じ理由（searchParams）なので、対処すると決めたら2ページ共通の作業になる。

⚠️ **鮮度は論点ではなかった。** `getJobs` が既に `unstable_cache`（revalidate 300）で
   最大5分古く、公開の即時反映は `admin/jobs/actions.ts` の
   `revalidatePath("/jobs")` が担保している。ISR にしても鮮度は落ちない。

##### 「あなたへのおすすめ」の切り出しは残してある（動的のままでも効く）

ISR は戻したが、パーソナライズの API 切り出しは有効。
`getDesiredRoles` が `createNoStoreAdminClient`（＝**毎回必ずネットワーク**）なので、
サーバー描画の直列段に乗っていると重い。

A/B（ローカル本番ビルド・中央値11回・未ログインを対照）:

| | ログイン中 | 未ログイン（対照） |
|---|---|---|
| 切り出し前 | **0.393秒** | 0.027秒 |
| 切り出し後 | **0.017秒** | 0.017秒 |

⚠️ **未ログインでは API を叩かないこと。** `getSession()`（ネットワークに出ない）で
   先に判定する。無条件に fetch すると、ログアウト中の訪問者に不要な関数起動を作る。

### Git 運用方針（2026-05-03 確定 / 2026-08-15 に並行セッション対策を追記）
- main ブランチに直接コミットする（worktree 作成禁止）
- worktree が既に存在する場合は、`git worktree remove` で削除してから作業を開始する
- 削除手順は引き継ぎ書 v6 §5 および本ドキュメントの「Git 運用方針」を参照
- `git rebase` / `git reset --hard` / `git commit --amend`（既存コミット対象）は使わない。
  **既に push 済みのコミットに対しては force push を含めて行わない**
- **push は柴さんの明示的な「OK push して」を待つ。自分の判断で push しない。**
  他セッションの未検証の作業がリモートに出るため、ここは特に厳守する

- **★`git push` はブランチ上の全コミットを送る（2026-08-22 に実際に起きた）。**
  **並行セッションがいる状態で main にコミットを置くと、
  自分が push しなくても相手の push で出ていく。**
  実例: 保留のつもりでローカルに置いた `b79ea94a` が、別セッションの `git push` に載って
  origin へ出た。こちらが `git push` したときには既に `Everything up-to-date` だった。

  ⚠️ **したがって「push 前に止まる」＝「コミットを作らずに止める」。**
     報告して待つあいだは**作業ツリーのまま**にしておくこと。

  ⚠️ **作業ブランチに逃がす手は使えない。** 全セッションが
     **同じ作業ディレクトリ（`/Users/hisato/opinio-work`）を共有している**ので、
     ブランチを切り替えると**相手のセッションごと切り替わる**。
     （worktree で分ける案を採らない理由は「セッションを並行させるときのルール」を参照）

  ⚠️ 作業ツリーに置いておく以上、**相手が `git add -A` すると巻き込まれる**。
     だから「ステージはファイルパスを列挙する」が両側で守られている必要がある。

  ⚠️ **★自分のコミットの下に他セッションのコミットが入っていたときの扱い（2026-08-23）。**
     - **ドキュメント・コメントのみの変更** → そのまま一緒に push してよい
     - **コードまたは migration を含む** → **push せず、内容を報告して確認を取る**

     混ざること自体は避けられない（push はブランチ上の全コミットを送る）が、
     **自分が検証していないコードを本番に出すかどうかは、その場で判断しない。**

  ⚠️ **★承認前は commit しない（2026-08-23 に運用を変更）。**
     **「コミットは分ける／push 前に報告」は、コミットを作れと言っているのと同じ**で、
     作った時点で相手の push に載る。**止める余地が無い。**
     実際に `b79ea94a`（2026-08-22）と A-3 の3本（2026-08-23）の**2回**起きた。

     - **承認前は commit しない。作業ツリーのまま報告する。**
     - 承認をもらってから、**分割コミット → push を一続きで**やる。
     - 分割の設計（何本に分けるか、どのファイルがどれに入るか）は、
       **コミットを作らずに報告だけする。**

     これで「作ったが出したくない」という状態自体が生まれなくなる。

  ⚠️ **★承認を待つあいだは「ステージ」もしない（2026-08-23 に追加）。**
     **`git add` した時点で、相手の `git commit` に拾われる。**
     コミットを作らなくても、**インデックスに置いた時点で相手のものになる。**

     実際に起きたこと（2026-08-23）: `git add CLAUDE.md` の直後に別セッションが
     コミットし、**ステージ済みだった CLAUDE.md ごと**拾っていった。結果、73行の
     変更が **`docs/todo.md` のことしか言っていないメッセージのコミット**
     （`95b85035`）で push された。**内容は無傷だったが、既に push 済みなので
     rebase / amend では直せない**（このドキュメントの禁止事項）。

     2026-08-15（本ドキュメントの「実際に起きたこと」）と同じ形で、**これが3回目**。

     #### 手順
     - **`git add` は commit の直前にまとめて行う。**
     - **承認待ちのあいだは作業ツリーに置いたままにする**（ステージしない）。

     ⚠️ **これで安全になるわけではない。** 作業ツリーに置いていても、
        **相手が `git add -A` / `git add .` を使えば拾われる。**
        **完全には防げない。** 減らせるのは「自分がインデックスに置いたせいで
        拾われる」ぶんだけで、**残りは両側が「ステージはファイルパスを列挙する」を
        守っているかに依存している。**

  ⚠️ **★「ステージしない」でも防げない残りがある。防げるのは "同じファイルに触らない" だけ（2026-08-23）。**

     **同じ作業ディレクトリを共有している以上、index も作業ツリーも1つしかない。**
     したがって次の2方向がある。**上のルール（ステージしない）で減らせるのは①だけ。**

     | | 何が起きるか | 上のルールで防げるか |
     |---|---|---|
     | ① | 相手がステージした物を、**自分の commit が拾う** | **減らせる**（自分が add した瞬間を作らない） |
     | ② | 自分が作業ツリーに置いた変更を、**相手の commit が拾う** | **防げない**。相手がそのファイルを `git add` すれば、自分の行も一緒に入る |

     ②は同日に実際に起きた。`companies/[id]/page.tsx` を両セッションが触っており、
     こちらが承認待ちで置いていた求人セクションの変更が、別セッションの
     **`815a5972 fix(ui): トップへ戻るボタンが固定CTAバーに重なっていた`** に丸ごと入って
     push された。**相手は自分のファイルをパス指定で add しており、ルールは守っている。**
     それでも起きる。**②はファイルを共有している限り原理的に避けられない。**

     #### したがって、守るのはここ

     1. **着手前に `git status` を見る。自分の変更でない差分があるファイルには触らない。**
        触る必要があるなら、**先に相手が出し終わるのを待つ**。
        （従来の「触るファイル群を宣言する」を、**実行前の確認**として具体化したもの）
     2. **`git add` の直後に `git diff --cached --name-only` を読む。**
        自分が列挙していないパスが出たら、**コミットせず報告する**（①はこれで止まる）。
     3. **承認待ちの時間を短くする。** ②が起きる窓は「検証が終わってから commit するまで」。
        報告には**触っているファイル名を必ず書く**（相手がそこを避けられる）。

     ⚠️ **完全に消したいなら、並行させないこと。** ①②とも原因は
        「1つの index と1つの作業ツリーを2人で使っている」ことで、
        worktree で分ける案は**採らない**と決めてある（本節の上を参照）。

  ⚠️ **★migration の適用も同じ軸で分ける（2026-08-23）。**
     **追加のみ**（列・テーブル・インデックスの追加）→ **先行適用してよい。**
       古いコードは新しい列を知らないだけで壊れない。
     **削除・変更を含む**（列や制約の削除、NOT NULL の追加、ポリシーの差し替え）
       → **承認まで待ち、コードのデプロイと同時に出す。**
       先に当てると「**コードは古いのに列が無い**」が起きる。

     ⚠️ A-3 の `approved_at` は追加のみだったので、DB が先行しても実害は無かった。
        **削除側で同じことをしないこと。**

### ⚠️ デプロイの確認は `/api/health` の commit で行う（2026-08-15 確立）

**完了条件は「Vercel が Ready になった」ではない。**
Ready は「そのデプロイが出来上がった」であって、
**本番の別名（opinio.jp）がそのデプロイを指しているとは限らない。**

```bash
curl -s https://opinio.jp/api/health
```

返ってきた `commit` が **push したコミットの先頭8桁と一致したら完了**。

```json
{"commit":"241682d1","builtAt":"2026-08-15T00:45:12.345Z"}
```

⚠️ **`vercel inspect --json` は使えない。** `meta.githubCommitSha` を返さない
   （実測 2026-08-15。返るキーは aliases / builds / contextName / createdAt /
   id / name / readyState / target / url のみ）。

⚠️ **時刻と順序からの推定を「照合した」と書かない。** 「push の直後に作られた
   デプロイが Ready だから、たぶんそれ」は照合ではない。

⚠️ `commit` が `null` のときはローカル実行（`VERCEL_GIT_COMMIT_SHA` が無い）。
   本番で null が返るならビルド環境変数の設定を疑う。

実体は [src/app/api/health/route.ts](src/app/api/health/route.ts)。
**返すのはコミットの先頭8桁とビルド時刻だけ**で、環境変数の中身は出さない。


#### ⚠️ ステージングはファイルパスを列挙する（2026-08-15 確立）

**`git add -A` / `git add .` / `git commit -am` は禁止。**
**自分がこのセッションで編集したファイルパスを列挙して `git add <path> ...` する。**

⚠️ **同じ作業ディレクトリで別セッションが同時に動いている前提で作業すること。**

コミット前に2つ確認する。

| 確認 | 見つかったら |
|---|---|
| `git status` | **自分が触っていないファイルがステージ／未ステージにあれば、コミットせず柴さんに報告して指示を待つ** |
| `git log --oneline -3` | セッション開始時の HEAD から動いていたら、**その旨を報告してから進める** |

##### 実際に起きたこと（2026-08-15）

別セッションが全体をステージしてコミットし、そのまま push した。
`docs(rules): 画面を操作して確かめるときの手順を3つ足す` という
**ドキュメント1本のはずのコミット（`56ce46ae`）に、進行中だった `/u/[id]` の
改修5ファイルが丸ごと入って origin/main に出た。**

⚠️ **内容が壊れていなくても、メッセージと実体が食い違った履歴は元に戻せない。**
   既に push 済みなので rebase / amend でも直せない（上の禁止事項）。
   **防げるのはコミット前の確認だけ。**

## 🔧 将来の改善課題

### name 表示の二重経路問題（一部解決 2026-04-27）

**現状（2026-04-27 16:20 時点）:**
- データ修正で柴久人の表示は統一済み（ow_users.name = '柴久人' に UPDATE 実施）
- ただし**根本的な設計問題は未解決**

**問題の構造（2026-04-27 調査結果）:**
- ヘッダー（`src/lib/business/dashboard.ts:146`）: `auth.users.raw_user_meta_data.name` を参照
- TeamMembers（`src/lib/business/team.ts`）: `ow_users.name` を参照
- 両者が常に一致する保証なし
- migration 032 の backfill が `ON CONFLICT (auth_id) DO NOTHING` のため、既存ユーザーは自動同期されない

**今後ユーザー追加時の懸念:**
- 新規ユーザーが auth metadata の name を変更しても、ow_users.name に反映されない
- 採用担当者が複数人いる企業で、一部メンバーだけ古い名前が表示される事故が起きうる

**根本解決の方針案（後日実装、Phase 5 級）:**

| 案 | 方法 | 難易度 | 影響範囲 |
|---|---|---|---|
| A | データ修正 (Quick Fix) ✅ 適用済み | ⭐ | 個別ユーザー対応 |
| B | getTenantContext で ow_users.name 取得し、ヘッダーも統一 | ⭐⭐ | dashboard.ts:146 |
| C | ow_users 更新 trigger で auth metadata と同期 | ⭐⭐⭐ | 新規 migration |
| D | ow_users にプロフィール編集 UI を提供 | ⭐⭐⭐ | /biz/profile 新規 or /biz/auth 拡張、Phase 5 のスコープ |

**推奨アプローチ（後日実装時）:**
- Phase 5 で D を実装し、その際に B も同時に修正
- C はトリガー設計が複雑なため避ける

### 軽い改善
- **ActivityList: autosave 連発による重複行** → 5 分以内の同一 type + actor の更新は 1 件にまとめるか、「公開する」ボタン時のみ INSERT する設計へ変更

### Phase 5 で実装が必要な ActivityList 残り 5 イベント
- `casual_meeting_applied`: 候補者側申込フロー（ow_threads → ow_casual_meetings 移行）
- `offer_sent`: ow_offers テーブル + API 実装
- `message_sent` / `message_received`: 候補者向けメッセージ機能
- `candidate_status_changed`: 候補者ステータス管理機能
- **各機能実装時に `insertActivity()` を追加するだけで dashboard に自動表示される**

---

