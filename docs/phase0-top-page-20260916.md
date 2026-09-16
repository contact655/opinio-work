# フェーズ0 調査 — トップページ（opinio.jp /）の改修

作成: 2026-09-16 / 変更は一切行っていない（調査のみ）
実測はすべて **dev サーバー（localhost:3000）＋ 本番 Supabase**。
⚠️ dev と本番は **同じ DB** を見ている。件数はこの日付のもの。

---

## 結論を先に（フェーズ1の判断に直結するもの）

| # | 何が分かったか |
|---|---|
| ★1 | **ヒーロー見出し案「その会社の人が、どこから来て、どこへ行ったか。」は、いま出せない。** 未ログインで経歴に到達できる画面は**1つも無い**（`/u/` `/people` は middleware で 307）。前職が特定できる在籍者を持つ掲載企業は **3社・各1名**で、**3人以上いる企業は0社**。→ 差し替えず、判断を仰ぐ（指示どおり） |
| ★2 | **先頭カードの社名が空なのは `ow_companies.brand_name = ''`（空文字）**。`brand_name ?? name` は空文字を拾う。該当は **株式会社Opinio 1社だけ**。データ側ではなくコード側（LP だけが `brand_name` を見ている）を直すのが筋 |
| ★3 | **LP は社名も phase ラベルも自前実装で、サイトの他画面と揃っていない。** `/companies` `/search` `/companies/[id]` は `companyDisplayName()`（`name_en` 起点）を通るのに、LP だけ `brand_name ?? name`。phase も `lib/constants/phase.ts` があるのに LP 内に**5つ目の独自テーブル**を持ち、`startup` など5値が抜けて生値が出ている |
| ★4 | **DATA セクションの「事業内容・組織体制・働き方まで揃えています」は、ほぼ事実でない。** 掲載22社のうち 組織体制 **1社** / 働き方（`remote_work_status`）**1社** / 福利厚生 **1社** |
| ★5 | **FAQ・最終CTAの「新しい求人が出たときに通知を受け取れる」は事実でない。** 週次メールは二重に停止中（`vercel.json` の `crons` が `{}` ／ `WEEKLY_EMAIL_ENABLED` 未設定）。`ow_notifications` の種別にも求人は無い（`like` / `comment` / `scout` / `message` の4つだけ） |
| ★6 | **「比べられます」を支える画面が無い。** `/mypage/bookmarks` は保存済みカードの一覧で、比較UIではない |
| ★7 | **在籍者向け案の3項目のうち2つが今は成り立たない。** 「会社名を伏せて載せられる」は**入力欄ごと畳んだ後**（2026-09-15）、「『話してもよい』を選んだときだけ声がかかる」は **DM に何のゲートも無い**（ログインしていれば誰でも送れる） |
| ★8 | **指示で挙がった検索例文4つは、いずれもチップに使えない。** 代替案を6つ実測して用意した（0-7） |

---

## 0-1. トップページの構成

### ファイル

| ファイル | 行数 | 役割 | データ取得 |
|---|---|---|---|
| [src/app/(jobseeker)/page.tsx](src/app/(jobseeker)/page.tsx) | 288 | サーバー。取得と整形 | `createAdminClient()` 直 ＋ `getBusinessDomainFacets()` ＋ `pickLpCompanies()` |
| [src/app/(jobseeker)/LandingPage.tsx](src/app/(jobseeker)/LandingPage.tsx) | 668 | 描画本体（**サーバーコンポーネント**） | 受け取るだけ |
| [src/app/(jobseeker)/HeroSearch.tsx](src/app/(jobseeker)/HeroSearch.tsx) | 135 | `"use client"`。検索窓 | なし |
| [src/app/(jobseeker)/FinalCta.tsx](src/app/(jobseeker)/FinalCta.tsx) | 100 | `"use client"`。最終CTA（ログイン状態で出し分け） | `supabase.auth.getSession()`（クライアント） |
| [src/lib/lp/pickCompanies.ts](src/lib/lp/pickCompanies.ts) | 98 | ピックアップ企業の選定 | admin |
| [src/components/jobseeker/JobseekerFooter.tsx](src/components/jobseeker/JobseekerFooter.tsx) | 164 | フッター（全ページ） | `getBusinessDomainFacets()` |
| `ProductShot.tsx`(84) / `lpGuestMembers.ts`(81) | — | **どちらも現在 LP から未参照**（`CAREER_SHOT = null` / `SHOW_PEOPLE_BAND = false`） | — |

### キャッシュ

| | |
|---|---|
| `page.tsx` | **`export const revalidate = 300`（ISR）**。`dynamic` の宣言は無い |
| `getBusinessDomainFacets()` | `unstable_cache` / `revalidate: 300` / tag `business-domains` |
| `getBusinessDomainOptions()` | `unstable_cache` / `revalidate: 3600` / 同 tag |
| `pickLpCompanies` / 求人 / 出身校 / 件数 | **キャッシュ無し**（ISR の 300秒に従う） |
| 最終CTA | クライアント判定なので ISR を壊さない（`page.tsx` に `cookies()` を持ち込まない設計） |

⚠️ **`page.tsx` に `auth.getUser()` を足さないこと。** 足した瞬間に全リクエストが動的になる。

### HeroSearch の遷移先

**`/search?q=` のまま**（`HeroSearch.tsx:submit`）。空送信のときだけ `/companies` に飛ばす（1ホップ省くため）。

---

## 0-2. トップに出ている数字（実測 2026-09-16・未ログイン）

| どこ | いま出ている値 |
|---|---|
| 業種タイル（11個） | AI・データ **4** / クラウドインフラ **4** / 開発者ツール **2** / セキュリティ **3** / CRM・営業支援 **4** / コラボレーション **3** / プロジェクト管理 **3** / 経理・財務 **1** / 法務・契約 **1** / HR・人材 **2** / マーケティング **3** |
| ピックアップ企業の見出し右 | **「22社すべて見る →」** |
| 企業カードの下段 | 記事 1 / 記事 1 / 記事 2 / 記事 1・求人 2 …（**12枚中5枚だけ**。残り7枚は行ごと出ていない） |
| 募集中の求人の見出し右 | **「2件すべて見る →」** |
| 求人カード | 900〜1,800万円 / 800〜1,300万円（年収。数量ではない） |
| **`generateMetadata` の description** | **「掲載企業22社・求人2件。」** ← 画面には出ないが**検索結果とSNSシェアに出る** |

⚠️ **0 は既に出ていない。** カードの `facts` は `.filter((m) => m.n > 0)` 済みで、2項目とも0なら行ごと消える。
   指示の「『記事 0』は出さない」は**すでに満たされている**（実HTMLで確認）。

⚠️ 出身校ファセット（「人から探す」）は**閾値未達で非表示**（5校以上かつ実人数10名以上）。
   数字はここには出ていない。

---

## 0-3. ピックアップ企業

### 選定ロジック（`pickLpCompanies`）

1. 公開求人 or 公開記事を1件以上持つ掲載企業を **`updated_at DESC`** で最大12社
2. 埋まらなければ、残りの掲載企業を **`updated_at DESC`** で補充

⚠️ 実態は「**最近さわった順**」。条件①に当たるのは **5社だけ**で、**12枠中7枠が②の補充**。
   `pickCompanies.ts` 自身が「在庫が増えたら安定した基準に変えること」と書いている。

### ★先頭カードの社名が出ない原因 — `brand_name` が**空文字**

```
株式会社Opinio   brand_name = ''   ← NULL ではない
```

LP は `name: c.brand_name ?? c.name`（`page.tsx`）。**`??` は空文字を拾わない**ので `""` がそのまま表示名になる。

⚠️ **該当は Opinio 1社だけ**（掲載22社を確認）。ただし `updated_at` が最新なので**必ず先頭に出る**。
⚠️ `/companies` と `/search` では「Opinio」と正しく出ている ——**あちらは `brand_name` を見ていない**から。

### ★表記ゆれの原因 — LP だけが別のルールを使っている

| どこ | 表示名の作り方 |
|---|---|
| `/companies` 一覧・`/companies/[id]` の h1・`/search` | **`companyDisplayName(name, name_en)`**（[lib/companies/displayName.ts](src/lib/companies/displayName.ts)）。`name_en` から法人格と末尾 " Japan" を落とす |
| **LP** | **`brand_name ?? name`** |

`displayName.ts` の冒頭には「**新しく企業名を表示する箇所を作るときは、必ずここを通すこと**」と書いてある。
**LP はそれを通っていない唯一の画面。**

12社の実測（現状 → `companyDisplayName` を通した場合）:

| name | brand_name | name_en | **いまLPに出る** | **通した場合** |
|---|---|---|---|---|
| 株式会社Opinio | `''` | Opinio Inc. | **（空）** | Opinio |
| HubSpot Japan株式会社 | HubSpot | HubSpot Japan | HubSpot | HubSpot |
| Sansan株式会社 | null | Sansan | **Sansan株式会社** | Sansan |
| 株式会社SmartHR | null | SmartHR | **株式会社SmartHR** | SmartHR |
| 株式会社セールスフォース・ジャパン | Salesforce | Salesforce Japan Co., Ltd. | Salesforce | Salesforce |
| Databricks Japan株式会社 | null | Databricks Japan | **Databricks Japan株式会社** | Databricks |
| 日本ヒューレット・パッカード合同会社 | HPE | HPE Japan | HPE | HPE |
| Notion Labs Japan合同会社 | null | Notion Japan | **Notion Labs Japan合同会社** | Notion |
| OpenAI Japan合同会社 | null | OpenAI Japan | **OpenAI Japan合同会社** | OpenAI |
| Datadog Japan株式会社 | Datadog | Datadog Japan | Datadog | Datadog |
| 伊藤忠テクノソリューションズ株式会社 | CTC | ITOCHU Techno-Solutions Corporation | **CTC** | **ITOCHU Techno-Solutions** |
| ServiceNow Japan合同会社 | null | ServiceNow Japan | **ServiceNow Japan合同会社** | ServiceNow |

⚠️ **1社だけ結果が変わる: 伊藤忠テクノソリューションズ。** `/companies` では現在
   「ITOCHU Techno-Solutions」と出ており、**LP の「CTC」のほうが浮いている**。
   揃えるなら `/companies` 側に合わせるのが自然（フェーズ1で判断が要る唯一の企業）。

⚠️ **`brand_name` を一括で埋める案は採らない。** `deriveBrandName()` のコメントどおり
   「日本ヒューレット・パッカード」のような使えない値が入る。**LP の読み先を変えるほうが安全。**

### ★フェーズのラベル — LP に5つ目の独自テーブルがある

`LandingPage.tsx:PHASE_LABEL` は9キーしか持たず、**`startup` / `listed_prime` / `listed_standard` /
`listed_growth` / `listed_overseas` の5つが欠けている**。`phaseText()` は未知の値を**生のまま返す**ので、
株式会社Opinio が **「HR・人材 ／ startup」** と出ている。

| 出どころ | 状態 |
|---|---|
| **正** = [lib/constants/phase.ts](src/lib/constants/phase.ts) の `PHASE_OPTIONS` / `phaseLabel()` | 13値（親3＋子10）。`phaseLabel()` は**未知の値に null を返す** |
| [lib/utils/stageCfg.ts](src/lib/utils/stageCfg.ts) | 2026-09-06 に独自テーブル（30キー）を捨てて `phase.ts` に寄せ済み |
| **`LandingPage.tsx` の `PHASE_LABEL`** | ★**寄せ忘れ。ここだけ残っている** |

DB の CHECK（`ow_companies_phase_check`）が取りうる値は `phase.ts` と1対1。
掲載22社の実データ: `listed` 14 / `unicorn` 5 / `non_listed` 2 / `startup` 1。

⚠️ `phaseLabel()` に差し替えると **`startup` は「スタートアップ」**になる。
⚠️ 未知の値は `phaseLabel()` が null を返すので、いまの「生値が出る」挙動は自動的に消える。

### 各カードの記事数・求人数（実数）

| 表示名 | 主の事業領域 | phase | 記事 | 求人 |
|---|---|---|---|---|
| （空）＝ Opinio | HR・人材 | startup | 1 | 0 |
| HubSpot | CRM・営業支援 | listed | 1 | 0 |
| Sansan株式会社 | CRM・営業支援 | listed | 1 | 0 |
| 株式会社SmartHR | HR・人材 | unicorn | 2 | 0 |
| Salesforce | CRM・営業支援 | listed | 1 | **2** |
| Databricks Japan株式会社 | AI・データ | unicorn | 0 | 0 |
| HPE | クラウドインフラ | listed | 0 | 0 |
| Notion Labs Japan合同会社 | コラボレーション | unicorn | 0 | 0 |
| OpenAI Japan合同会社 | AI・データ | unicorn | 0 | 0 |
| Datadog | クラウドインフラ | listed | 0 | 0 |
| CTC | クラウドインフラ | non_listed | 0 | 0 |
| ServiceNow Japan合同会社 | クラウドインフラ | listed | 0 | 0 |

⚠️ **小さいが実在する不整合**: 求人の tally（`page.tsx`）は
   `.eq("status","published")` **だけ**で、`is_test` を見ていない。
   総件数（`jobCountP`）と選定（`pickLpCompanies`）は `is_test=false` を付けている。
   **いま `published` かつ `is_test=true` の求人は0件**なので実害は無いが、条件が割れている。

---

## 0-4. 募集セクション

| | |
|---|---|
| 公開中の求人 | **2件**（`status='published'` かつ `is_test=false`） |
| どの企業か | **2件とも 株式会社セールスフォース・ジャパン** |
| 内訳 | Account Executive, MuleSoft（900〜1,800万円）／ Account Solution Engineer, Tableau（800〜1,300万円） |
| `ow_jobs` 全体 | 20件（`draft` 18 / `private` 3 / `published` 2）… ⚠️ 合計23。`ow_jobs` は23行ある |

⚠️ **この2件は 2026-08-30 に採用ページと突き合わせ済み**（CLAUDE.md）。取り下げた3件が `private`。
⚠️ 掲載22社のうち**求人を持つのは1社だけ**。「N件すべて見る」を出すと、その事実が最初に伝わる。

---

## 0-5. 主張の裏取り

判定: **事実** / **一部事実** / **事実でない**

### DATA セクション

| 文 | 判定 | 根拠 |
|---|---|---|
| 「掲載企業の情報は web から自動で集めたものではなく、OPINIO が作成・編集しています」 | **事実** | クローラ・スクレイパは存在しない（`open-graph-scraper` はユーザーが貼ったURLの OGP 取得用で、企業データには使われていない）。企業データは migration で人が投入。出典表 `ow_company_data_sources` は 登記42 / 公式サイト34 / 不明5 / 企業入力1 |
| 「事業内容・組織体制・働き方まで揃えています」 | ★**ほぼ事実でない** | 掲載22社のうち `description` **22** ／ `org_teams`（組織体制）**1** ／ `benefits` **1** ／ `remote_work_status`（働き方）**1** ／ `culture_description` 2 ／ `main_products` 10 ／ `customer_cases` 3 ／ `headquarters_address` 21 |
| 「求人の有無にかかわらず企業ページを作っています。いま募集がない会社も、事業や組織を先に調べておけます」 | **事実**（後半は上と同じ弱さ） | 掲載22社中、求人があるのは1社。「事業」は全社ある。「**組織**」は1社 |
| 「どこから来て、どこへ行ったか。社員のキャリアがデータとして残っているので、**企業単位でも職種単位でも辿れます**」 | ★**事実でない（未ログイン）／一部事実（ログイン後）** | 未ログイン: `/u/` `/people` `/people/role/*` はすべて **307**。企業ページの社員セクションは API が `{"authenticated":false,"current":[],"alumni":[],"hiddenCurrentCount":2,…}` を返し**件数だけ**。ログイン後でも「**どこから来たか**」を企業単位・職種単位で見る画面は存在しない（個人の `/u/[id]` の年表を1人ずつ見るだけ）。「どこへ行ったか」は企業ページの OB・OG がそれに当たる |

### FAQ

| 文 | 判定 | 根拠 |
|---|---|---|
| 「企業情報・求人・記事はすべて登録なしで読めます」 | **事実** | 未ログインの実測: `/` `/companies` `/companies/salesforce` `/jobs` `/articles` `/feed` `/search` すべて **200**。`/people` `/u/*` は 307（この文は人に触れていないので嘘ではない） |
| 「登録は、気になる企業を**保存**したり」 | **事実** | `ow_bookmarks` ／ `/mypage/bookmarks` が実在 |
| 「（登録は）**新しい求人が出たときに通知を受け取る**ためのものです」 | ★**事実でない** | `vercel.json` の `crons` が `{}`／`WEEKLY_EMAIL_ENABLED` 未設定で `weekly-jobs` は認証前に return。`ow_notifications_type_check` は `like`/`comment`/`scout`/`message` の4値で、**求人の種別が無い**。企業フォローにも通知経路が無い |
| 「登録しただけでは届きません。…『今は考えていない』を選ぶと、企業の候補者検索にあなたは表示されません」 | **事実** | `/biz/candidates` は `career_stance is not null` かつ `<> 'no_contact'` で母集合を作る（`page.tsx:186`）。`can_send_scout()` の条件1と同じ |
| 「なお、企業からのスカウト送信は現在準備中です」 | **事実** | `isScoutSendingEnabled()` に連動。`SCOUT_SENDING_ENABLED` 未設定 |
| 「営業電話はありません」 | **事実** | 電話番号を企業に渡す経路が無い（`phone` の読み手は本人と運営のみ） |
| 「IT業界に絞ったうえで、OPINIO が選定した企業を掲載しています」 | **事実** | 掲載22社とも `industry_id` = IT・ソフトウェア |
| 「web上の情報を自動で集めたものではありません」 | **事実** | 上と同じ |
| 「求職者側の費用は一切かかりません」 | **事実** | 利用規約 第3条1項「本サービスの利用は無料です」／第14条3項「有料とする変更は行いません」 |

### 最終CTA

| 文 | 判定 | 根拠 |
|---|---|---|
| 「登録すると、気になる企業を保存して**比べられます**」 | **一部事実** | 保存は事実。**比較画面は存在しない**（`/mypage/bookmarks` は240px幅カードのグリッド一覧。並べて比べる機能は無い）。なお `/companies` の分割ビュー（`?selected=`・1280px以上）は**未ログインでも使える**ので、「比べる」は登録の理由になっていない |
| 「新しい求人が出たときの通知も受け取れます」 | ★**事実でない** | FAQ と同じ |
| （ログイン済み）「保存した企業は、いつでも見返せます」 | **事実** | — |
| （ログイン済み）「新しい求人が出たら、条件に合うものをお知らせします」 | ★**事実でない** | `weekly-match` も停止中 |

### ヒーロー

| 文 | 判定 | 根拠 |
|---|---|---|
| 「確かめてから、動く。」 | 主張ではない | — |
| 「IT業界の企業・求人・**そこで働く人の経歴まで**。」 | **一部事実** | 経歴データは存在する（`ow_experiences` 37行）が、**未ログインでは1行も見えない**。LP のコメント自身が「未ログインで到達できる経歴は現状ゼロ」「可視性の整理が済んだら見直すこと」と書いている |

### フッター

| 文 | 判定 | 根拠 |
|---|---|---|
| 「IT企業の求人と人を探せるプラットフォーム。」 | **一部事実** | 「人を探せる」のは**ログイン後だけ**（`/people` は 307） |
| 「企業/求人/人の情報が、ここに揃っています。」 | ★**一部事実〜事実でない** | 企業22社・求人2件・**登録ユーザー9人**（うち職歴あり4人相当）。「揃っています」は在庫の主張として強すぎる |

### メタデータ（画面外だが最も露出する）

| 文 | 判定 |
|---|---|
| 「IT業界の企業情報と求人を、ひとつの場所に。掲載企業22社・求人2件。登録なしで全て読めます。完全無料・営業電話なし。」 | **事実**。ただし**件数がそのまま検索結果に出る**ので、1-1で件数を消すならここも同じ判断の対象 |

### 看板の言葉の食い違い（指示の項目7）

| どこ | 言葉 |
|---|---|
| LP の h1 | 「確かめてから、動く。」 |
| `layout.tsx` の title | 「OPINIO \| IT業界特化のキャリアプラットフォーム」 |
| フッター下部 | 「IT業界特化のキャリアプラットフォーム」 |
| **メール4種のヘッダー・OG画像** | **「IT業界のキャリアインフラ」** |
| 「AI時代のキャリアインフラ」 | ★**リポジトリ内に0件**。社外資料だけに存在する言葉 |

⚠️ 「キャリアインフラ」は**メールと OG 画像にだけ**あり、サイト本体には1度も出てこない。

---

## 0-6. 「どこから来たか」を未ログインで見せられるか

### 未ログインで在籍者の前職を見られる画面 → **無い**

| 経路 | 未ログイン |
|---|---|
| `/u/[id]`（個人の年表） | **307**（middleware `needsAuth`） |
| `/people` `/people/role/[slug]` | **307** |
| `/companies/[id]` の社員セクション | 200 だが API が `authenticated:false` で**個票0件・件数のみ** |
| 集計画面（前職の内訳など） | ★**そもそも存在しない**（ログイン後にも無い） |

### 企業ごとの「前職の会社が特定できる在籍者」数

登録済み実ユーザー（`is_test=false` / `is_system=false` / `auth_id` あり＝**9人**）に限った実測:

| 現職の企業 | 前職が `company_id` で特定できる在籍者 |
|---|---|
| 伊藤忠テクノソリューションズ | **1名** |
| 株式会社Archi Village | 1名（※ 掲載企業ではない） |
| 海光電業株式会社 | 1名（※ 掲載企業ではない） |

★**3人以上いる企業は 0社。**

参考: 掲載22社のうち、登録済み実ユーザーの職歴がある企業は **3社だけ**。

| 企業 | 現役 | OB・OG |
|---|---|---|
| セールスフォース | 2 | 2 |
| 伊藤忠テクノソリューションズ | 1 | 0 |
| 日本ヒューレット・パッカード | 1 | 0 |

`ow_transitions`（会社が変わった隣接ペア）は **5行**。うち **3行は `auth_id IS NULL` の人**（＝本人が登録していない行。7経路で除外済み）なので、**使えるのは実質2行**。

### 可視性

登録済み実ユーザー **9人全員が `ow_users.visibility = 'login_only'`**。`public` は0人。
`ow_experiences.visibility_company` は **37行すべて `real`**。

---

## 0-7. 検索窓の例文（チップ）候補

### 指示にあった4つ — **いずれも採用できない**

| クエリ | primaryKind | 解決したチップ | 未解決 | 結果（未ログイン） | 判定 |
|---|---|---|---|---|---|
| 外資SaaSの営業は、次にどこへ行った？ | **company** | 外資系 / 営業 | SaaS | **企業3件**（HPE・Box・Salesforce） | ★**不可**。「次にどこへ行った」が完全に無視され、企業一覧が返る。問いと答えが噛み合わない |
| 人材業界からIT営業に移った人 | person | 営業 | **材業界**・IT | **人 6件**（件数＋ログイン導線） | ★**不可**。効いた条件は「営業」だけで、「人材業界から移った」は反映されていない。しかも未解決語が「**材業界**」と欠けて出る（下記） |
| CSからAEに戻った人 | person | アカウントエグゼクティブ | CS | **件数も出ない**（n < `MIN_AGGREGATE_COUNT`=3） | ★**不可**（指示どおり） |
| 30代で異業界から入った人 | person | **なし** | 異業界 | 「絞り込める条件が見つかりませんでした」 | ★**不可**（指示どおり） |

⚠️ **ついでに見つけた表示の不具合**: 「人材業界」の未解決語が **「材業界」** と出る。
   `collectUnresolved` が `KIND_MARKER_WORDS`（「人」を含む）を**出現位置すべて**伏せ字にするため、
   `findKindMarkers` 側の誤検出よけ（`HITO_BLOCK_AFTER = ["材",…]`）が効いていない。
   **判定そのものは正しい**（主対象は末尾の「人」で person）。壊れているのは表示だけ。
   → フェーズ1の対象外。別タスクとして記録する。

### 代替案（未ログインで結果が返ることを実測したもの）

| クエリ | 対象 | 実測（2026-09-16・未ログイン） |
|---|---|---|
| **AI・データの企業** | company | **企業4件**（Databricks / OpenAI / Anthropic / Salesforce） |
| **外資系のセキュリティ企業** | company | **企業2件**（Okta / Zscaler） |
| **日系のHR企業** | company | **企業2件**（Opinio / SmartHR） |
| **年収800万以上の営業の募集** | job | **募集2件**（Salesforce の2件。年収チップも立つ） |
| **営業を経験した人** | person | **人6件**（件数は出る。個票はログイン後） |
| **Salesforce出身の人** | person | **人4件**（同上） |

⚠️ **「営業を経験した人」「Salesforce出身の人」は、押しても個票が出ない。**
   出るのは「条件に当てはまる方が N 人います」＋ログイン導線。
   **登録の理由を見せる導線としては筋が通る**が、「調べられます」と言って個票に着かないので、
   チップに載せるかは判断が要る。**載せるなら企業・求人のチップと混ぜて、
   全部が人検索にならないようにすること。**

⚠️ **0件になる例も実測した。チップに近い形なので注意**:
   「マーケティングの企業」→ **0件**（「マーケティング」が**職種と事業領域の両方**に解決し、
   AND で自分自身を絞る）。「クラウドインフラの外資系企業」→ **0件**（「インフラ」が
   職種 SRE/インフラ に解決する）。**チップは必ず実測してから載せること。**

⚠️★**チップの文は定数1箇所に置き、件数が動いたら確認する。** 上の件数は
   掲載企業（22社）と公開求人（2件）に直結しており、**企業を1社非掲載にすると0件になりうる**。
   「0件の選択肢を出さない」というリポジトリの原則がここにも効く。

---

## 0-8. 在籍者向け・FAQ の新文言の裏取り

| 文（案） | 判定 | 根拠 |
|---|---|---|
| 「公開する範囲は自分で決められる」 | **事実** | `ow_users.visibility` の3択（公開 / ログインユーザーのみ / 非公開）。`/mypage/settings` の `PrivacySettings` にラジオが実在。文言は [lib/constants/profileVisibility.ts](src/lib/constants/profileVisibility.ts) の1箇所 |
| 「いまの勤め先の採用担当の候補者検索には表示されない」 | **事実** | `can_send_scout()` の条件2（`company_id` 一致）と条件2b（**自由入力の社名も `normalize_company_name` で一致**）。`/biz/candidates/page.tsx:385` が `canSendResults[i] === true` で一覧そのものを絞る。⚠️ ただし「**採用担当の候補者検索**」に限った話で、その企業の**企業ページの現役社員**には出る |
| 「会社名を伏せて載せられる」 | ★**事実でない** | `visibility_company` の**入力欄は 2026-09-15 に畳んだ**。`COMPANY_VISIBILITY_OPTIONS` の参照は定義ファイル1箇所のみ（＝呼び出し0件）。実データも **37行すべて `real`** |
| 「『話してもよい』を選んだときだけ声がかかる」 | ★**事実でない** | **DM に何のゲートも無い**。`POST /api/dm/start` が見るのは `ow_users.visibility` だけ（`private` と、未ログインでの `login_only` を弾くのみ）。`/u/[id]` の「メッセージ」ボタンは**ログイン済みの非オーナー全員**に出る。`career_stance` も面談対応可も参照していない |
| 「個人の方は無料」 | **事実** | 利用規約 第3条1項・第14条3項。決済実装そのものが無い（`/admin/plans` に「決済は実装していない」） |

### 「声がかかる」経路の実態（3つあり、ゲートがそれぞれ違う）

| 経路 | ゲート | いまの状態 |
|---|---|---|
| **スカウト**（企業→本人） | `career_stance` が未設定でも `no_contact` でもない ＋ 在籍企業でない ＋ 手動ブロック ＋ 勧奨禁止期間 ＋ **有料プラン** ＋ **env フラグ** | **1通も送れない**（`SCOUT_SENDING_ENABLED` 未設定・有料プラン0社） |
| **カジュアル面談**（本人指名） | 本人が面談対応者として掲載中（`ow_company_members.display_consent` かつ `is_public`）＋ 企業が受付中 | 掲載中の面談対応者は5名 |
| ★**DM**（個人→個人） | **`visibility` だけ**。ログインしていれば誰でも送れる | **無制限** |

参考: 登録済み実ユーザー8人の `career_stance` は open 3 / active 2 / researching 1 / no_contact 1 / 未設定 1。

→ 在籍者向けの3項目を書くなら、**成り立つのは①公開範囲 ②勤め先の候補者検索に出ない の2つだけ**。
   3つ目は「話すかどうかも自分で決められる」ではなく、**DM にゲートを足す**か、
   **スカウトと面談に限定した書き方**にするかの判断が要る。

---

## フェーズ2 向けのメモ（今回は作らない）

| 作りたいもの | いまのデータで出せるか | 何件たまれば出せるか |
|---|---|---|
| ヒーロー右の「キャリアの移動」路線図 | ★**出せない** | `ow_transitions` は5行、うち登録済みユーザーは**2行**。同じ出発点（職種×業界）から3件以上の移動が要るなら、**同系統で最低15〜20行**は要る |
| 企業の「この会社の人は、どこから来たか」帯グラフ | ★**出せない** | 前職が特定できる在籍者が3人以上いる企業が**0社**。1社出すのに **3名**、意味のある帯にするなら 5名 |
| 「経歴を3項目入れると、同じ経歴の人が次に選んだ会社が見える」 | ★**出せない** | 同上。加えて `MIN_AGGREGATE_COUNT = 3` を満たす職種×企業の組が要る |
| トップの「話を聞ける人」セクション | 個票は**出せない**（全員 `login_only`） | 件数だけなら今も出せる（掲載中の面談対応者5名）。個票を出すなら `visibility = public` の同意設計から |
| 0件検索からの「載せてほしい会社をリクエスト」 | **代替は既にある** | `ow_search_logs` が **38件**（2026-08-29〜2026-09-16。うち `result_count = 0` が **18件**）。⚠️ 今日の調査で14件を自分で足しているので、**実利用者ぶんは24件程度**。まず**このログを運営が読む導線**を作るほうが先 |

---

## フェーズ1に着手する前に判断が要るもの

1. ★**ヒーロー見出し「その会社の人が、どこから来て、どこへ行ったか。」を使うか。**
   0-6 のとおり未ログインで辿れる画面が1つも無く、データも足りない。**現時点では嘘になる。**
2. ★**伊藤忠テクノソリューションズの表示名。** LP を `companyDisplayName()` に寄せると
   「CTC」→「ITOCHU Techno-Solutions」になる（`/companies` と一致する）。
3. ★**在籍者向けの3つ目の項目。** 「話すかどうかも自分で決められる」は DM が素通しなので書けない。
   書き換えるか、DM にゲートを足すか。
4. **`generateMetadata` の「掲載企業22社・求人2件。」を残すか。** 画面から件数を消しても、
   Google の検索結果には出続ける。
5. **募集セクションを閾値で隠すと、トップから `/jobs` への導線が消える。**
   フッターとヘッダーには残るが、LP 本文からは無くなる。

---

## 付録: 実測に使ったコマンド

```bash
# 未ログインの実HTMLをテキストに落として読む（script/style を除去）
curl -s "http://localhost:3000/" | python3 /tmp/txt.py /dev/stdin

# 検索の結果（チップ・未解決語・件数）
curl -s "http://localhost:3000/search?q=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("AI・データの企業"))')"

# 公開到達性
for p in "/" "/companies" "/jobs" "/articles" "/feed" "/people" "/u/xxxx"; do
  curl -s -o /dev/null -w "$p %{http_code}\n" "http://localhost:3000$p"; done
```

⚠️ **`npm run build` は回していない**（本番 Supabase の Auth を落とすため）。
   確認はすべて dev の未ログイン応答と SQL の実測で行った。
