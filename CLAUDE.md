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

⚠️ **`logo_url` はこの一覧に入れていない。** 76社すべてが
`https://logo.clearbit.com/...` を指しており、**このホストは名前解決すらしない**
（Clearbit の Logo API は終了。`clearbit.com` のルートは 200 なのでネットワーク制限ではない）。
「値はあるが表示できない」ので ✓/空欄では表せない。**別タスク。**

⚠️ **画面のロゴが出ているのは別経路のおかげ。** `components/common/CompanyLogo.tsx` が
死んだ Clearbit URL からドメインだけを抜き出し、
`https://www.google.com/s2/favicons?domain=<domain>&sz=256` にフォールバックしている。
**Salesforce だけが特別なのではなく、76社すべてがこの経路**（実測で確認）。
`lib/utils/companyLogo.ts` の `usableLogoUrl` は Clearbit を null に潰す判定で、
letter フォールバック用。両者は別の仕組みなので混同しないこと。

### ⚠️ `main_products` の書式と、説明文が表示されない件（2026-08-12 実測）

**値は `製品名（説明）` の形で統一している**（全角括弧）。既存15社すべてこの形。

⚠️ **ただし括弧内の説明はカードに表示されていない。**
   `companies/[id]/page.tsx` の `parseProductName` は `{ name, sub }` に分解するが、
   描画側は `name` しか使っておらず、**`sub` は捨てられている**。
   カードは製品名1行だけ（アイコン＋名前、`white-space: nowrap` で省略）。

⚠️ それでも括弧を外さないこと。**外すと説明文がそのまま製品名として1行に出る**
   （「SmartHR（クラウド人事労務ソフト）」が丸ごと名前になり、幅で切れる）。
   説明を出したくなったら `sub` を描画側で使うだけでよい。

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

### 出典の記録（設計メモ・まだ実装していない）

求人には `source_url` / `source_verified_at` を入れた。企業にも同じ型を入れる想定だが、
**実際に数社埋めてから形を決める**（出典の粒度は作業のやり方が決まらないと分からない）。

推奨案:

```sql
ALTER TABLE ow_companies
  ADD COLUMN source_urls text[],              -- 参照した公開情報のURL（複数可）
  ADD COLUMN source_verified_at timestamptz;  -- 最後に全体を突き合わせた日時
```

| 論点 | 判断 | 理由 |
|---|---|---|
| 列を1組か | **1組** | 求人と同じ形。運用が同じなら形も同じにする |
| 項目ごとに持つか | **持たない** | 12項目 × 2列 = 24列になる。実作業は「1社の公式サイト・IR・採用ページを一巡してまとめて埋める」なので出典と項目が1対1にならない |
| 別テーブルか | **しない** | 1出典が複数社にまたがる等の必然が無い |
| 鮮度判定 | **365日**（求人とは別のしきい値） | 設立年・資本区分・親会社はまず変わらない |

⚠️ しきい値の定数は `src/lib/constants/` に置き、画面にハードコードしない
   （`DISCLOSURE_MAX` を表示側に直書きして取り残された前例がある）。

⚠️ 既存の鮮度判定は `src/lib/profile/freshness.ts` の **`STALE_AFTER_MONTHS = 3`** だけで、
   **求職者プロフィール用**。求人にも企業にも鮮度判定はまだ無い。

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

## ⚠️ 「開示スコア」を名乗る計算が4つある（2026-08-11 整理）

**名前が似ているので、どれの話かをファイルパスと関数名で特定してから触ること。**
2026-08-11 に `avg_salary` の配点を外すとき、どれが対象かの特定に調査が必要だった。

| # | 実体 | 用途 | 満点 | `avg_salary` |
|---|---|---|---|---|
| 1 | [lib/utils/disclosureScore.ts](src/lib/utils/disclosureScore.ts) `calcDisclosureScore` | `/biz/dashboard` `/biz/company` の「開示充実度」 | 95 | **含まない** |
| 2 | [lib/search/companies.ts](src/lib/search/companies.ts) の**ローカル関数** `disclosureScore` | `/companies` の並び替え「開示充実順」 | 8（旧10） | **含んでいた → 2026-08-11 に削除** |
| 3 | [companies/(list)/page.tsx](src/app/(jobseeker)/companies/(list)/page.tsx) の `sort === "disclosure"` 分岐 | 同上（2の後段） | — | 無関係 |
| 4 | [jobs/(list)/JobsClient.tsx](src/app/(jobseeker)/jobs/(list)/JobsClient.tsx) の `sort === "disclosure"` | `/jobs` の並び替え | 7 | 無関係 |

⚠️ **CLAUDE.md 冒頭の「開示充実度スコア 取材データの実態」表と、
   メモ `project-disclosurescore-redesign`（実質35点満点問題）が指すのは 1 だけ。**

⚠️ **3 は全社同値の列で並べ替えている無意味な処理。** `reality_disclosure` は
   87社すべてが空で、入力UIも無く一度も値が入っていない。
   `Array.prototype.sort` は安定ソートなので比較が全件0のときは前段（2）の順序が保たれ、
   結果として実害は無い。**後で消す候補**（今回は触っていない）。
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

## ⚠️ migration を書くときのルール

1. **全社一括の UPDATE を禁止する。** `WHERE is_published = true` のような条件で全社を更新しない。
   **対象を id または name で明示列挙する。**
2. **一括 UPDATE の前に、同じ列を触った直近の migration を確認する。**
   打ち消していないかを確認し、**確認した旨を migration のコメントに書き残す。**
3. **推測値を投入しない。** 企業ごとに調べた値でなければ列に入れない。
   「とりあえず hybrid」「とりあえず東京都」は、後から migration 由来か企業設定かを判別できなくなる。

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
- **`ow_companies.user_id` に依存しない**（85社中2社にしか入っていない実質未使用の列）。
  企業の管理者判定は `public.auth_is_company_admin(company_id)`。
- **`auth.uid()` が返すのは `auth.users.id` で、`ow_users.id` とは別物。**
  どちらの空間かはテーブルごとに違う。ポリシーを書く前に
  [docs/user-id-spaces.md](docs/user-id-spaces.md) の表を見ること。
- **新しいテーブルには GRANT を必ず書く。** 既定では anon も authenticated も権限が付かない。
- **列単位 GRANT を剥がすと、剥奪列が select に1つでも入ったクエリが丸ごと 403 になる。**
  ページは HTTP 200 のまま中身だけが静かに空になる。
- **`ow_companies` に列を足したら、その列の GRANT を migration に必ず書く。**
  このテーブルは**テーブルレベルの UPDATE を落として列単位で配り直している**ので、
  新しい列は**生まれた時点で書き込めない**（`authenticated` から更新すると 403）。
  他のテーブルと違い「足せば使える」ではない。
  実測（2026-08-13）: テーブルレベル UPDATE **0** / 列単位 **148列**。
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
| 職種 | **トップレベルのみ**（`parent_id is null` かつ `merged_into_id is null` かつ `is_active`）。2026-08-10 時点で17件 |
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

⚠️ トップレベルは **17件**（2026-08-10 実測）。
   以前 CLAUDE.md に「9件」と書いてあったが誤り。

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
2026-08-10 時点で公開求人18件は**全部が子職種**、経歴14件中2件が親職種のまま。

⚠️ 兄弟を拾わないために、**求人側だけ祖先展開し、本人側は自分と親までしか見ない**。
両方を展開すると同じ親を共有する兄弟が一致してしまう。

### ⚠️ ボトルネックはコードではなくデータ（2026-08-10 実測）

判定を直しても**表示は1人のまま変わらなかった**。理由は突き合わせる材料が無いこと。

| | 件数 |
|---|---|
| `ow_experiences` | 14件 / **実人数5人** |
| 公開求人がある企業 | 7社 |
| 経歴が1件でもある企業 | 6社 |
| **両方ある企業** | **1社だけ** |
| 実際に一致する人（延べ） | **1人** |

⚠️ さらに経歴を持つ5人は**全員 `login_only`**。未ログインと検索エンジンには誰も見えない。
広げるなら同意の設計が要る（「設定の意味を後から拡大しないこと」2026-08-04）。

### ⚠️ `ow_experience_roles` は未配線

経歴↔職種の多対多テーブル（6件）はあるが、**`types.ts` にしか現れず
アプリから一度も読み書きされていない**。生きているのは `role_category_id`（14/14件）。
1経歴に複数職種を持たせたくなったら、ここを配線してから
`getJobEmployees` の判定も合わせること。

---

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

## ow_companies.phase カラムの定義（2026-07-28 確立）

phase は「企業グループとしてのステージ」を表す。
日本法人自体の上場有無ではなく、最終親会社の状態で判定する。

- 最終親会社が上場している → `listed`
- 最終親会社が非公開（PE買収等） → `non_listed`
- 最終親会社が未上場のユニコーン → `unicorn`

日本法人が外資系であることは `capital_type`（⑦資本関係）で表現する。
「日本法人は非上場」は phase の判定基準にならない。
ヴイエムウェア（親: Broadcom NYSE上場）や
ウォークミー（親: SAP NYSE上場）が `listed` のままなのはこの定義による。

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

⚠️ **「知らない拠点＝根拠不明」と決めつけないこと。** 2026-08-13 に Sansan の「京都」を
   「archive/171 の出典なし一括投入だから」という理由で落としたが、**公式の会社概要に
   サテライトオフィスとして載っていた**（Sansan Innovation Lab）。
   同じ会社概要には徳島・新潟のラボもあり、**落とすどころか2件足りなかった**。
   投入元 migration に出典が無いことは、値が誤りである根拠にはならない。

---

## ⚠️ テーブル・カラム・関数を DROP するときのチェックリスト

**FK を見ただけでは足りない。PL/pgSQL の本体は Postgres が依存として追跡しない。**
関数の中で `UPDATE ow_xxx` と書いてあっても `DROP TABLE ow_xxx` は成功し、
**壊れたことはその関数を実際に呼ぶまで分からない。**

⚠️ **「DROP して `npm run build` が通った」は確認にならない。** ビルドは DB を見ない。

**SQL Editor での手動適用を禁止する。** 必ず migration ファイルを作成し `supabase db push` で適用する。
migration 適用のたびに `npm run gen:types` を実行してコミットする。

→ 関数・ビュー・ポリシーの全文検索クエリ、「参照先が実在するか」の定期突き合わせ、
   baseline とダンプ手順は [.claude/skills/db-safety/SKILL.md](.claude/skills/db-safety/SKILL.md)

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

### 弾き方

- **不正値は 400。** 黙って null や既定値に落とさない
- **空文字と不正値を区別する。** 空 → null か既定値（正しい）／不正 → 400
- 運営が自分で入力して結果が画面で見える箇所は据え置いてよいが、`console.warn` は出す

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

### ①（残っているもの）

- weekly-match の「75%」と「プロフィールに基づいて」を消す

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

### カジュアル面談の個人指名機能が未実装
- 現状: 面談申込は企業宛（`company_id`）で、担当者は企業側が自己アサイン（`action: "assign_to_me"`）するのみ
- 問題: `/companies/[id]` の「生藤さんに話を聞く →」ボタンを押しても、生藤さんが対応するとは限らない
  - `member_id` を URL パラメータで渡しているが、`ow_casual_meetings` には `member_id`（指名先）を記録するカラムがない
- 将来実装: `ow_casual_meetings` に `requested_member_id UUID` を追加し、求職者が特定の社員を指名できる仕組みを作る
- 関連ファイル: `src/app/(jobseeker)/companies/[id]/casual-meeting/page.tsx`、`src/app/api/casual-meeting/route.ts`

---

## Hisato 思想（実装済み）

1. **キャリアを考え続ける人**: 「転職活動中」フラグなし。情報収集中でも使える
2. **Users 統合設計**: `is_mentor` フラグ1つで求職者↔メンター動的発動（マイページで実証済み）
3. **スカウトしない、採用を**: 企業→求職者へのスカウト機能なし。対話から始まる設計
4. **運営の丁寧な介在**: メンター登録は個別声がけ、相談は編集部が精査してから転送
5. **モニター期配慮**: 料金表示なし、無料バッジ（MVP期間中は無料）のみ
6. **在籍企業制約**: 現在在籍中の企業へのカジュアル面談申込を UI でブロック
7. **数値データ撤廃**: マッチ度%・星評価なし。求職者が自分で判断する
8. **position_members**: 各求人に「この職種を経験した人」を表示。snapshot思想
9. **取材時スナップショット**: 記事の `role_at_interview` + `current_status` で時制を両方表示

---

## 技術的注意事項

### 作業ディレクトリ
- ファイルは `/Users/hisato/opinio-work/src/...` に直接書く（worktree 不要）
- dev サーバーは `/Users/hisato/opinio-work/` で `npm run dev`（launch.json の `dev`）

### ⚠️ セッションを並行させるときのルール（2026-08-12 確立）

**同じリポジトリで2つ以上のセッションを同時に動かす日は、着手前にこれを決める。**

2026-08-12 に**同じ日に2回**事故が起きた。どちらも git ではなく
**ローカル資源（ポート3000 と `.next`）の共有**が原因。

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

### ⚠️ dev サーバーは絶対に2つ同時に起動しない（2026-08-03 確立）

**起動前に必ず既存プロセスを確認し、あれば停止する。**

```bash
ps aux | grep -E "next-server|next dev" | grep -v grep
# 出てきたら親（node .../next dev）→ 子（next-server）の順に kill
```

`preview_start` が「port 3000 was in use, so port XXXXX was assigned instead」と言ったら、
**それは前のセッションの dev サーバーが生き残っているサイン**。別ポートで起動せず、先に止める。

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

#### ⚠️ 対象は `npm run build` だけではない（2026-08-13 追記）

**`.next` を共有するのは以下すべて。** どれを打っても同じ事故になる。

| コマンド | 備考 |
|---|---|
| `npm run build` | — |
| **`npx next start`** | ビルド済みの `.next` を読む。**起動しているだけで衝突する** |
| **`.claude/launch.json` の `prod`** | 中身は `npm run build && npx next start -p 3100` |

⚠️ **ポートが違っても `.next` は共有される。** `prod` は3100番だが、
   `--distDir` を指定していないので dev（3000番）と**同じ `.next` を読み書きする**。
   「ポートを分けたから大丈夫」は成り立たない。

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

型チェックだけしたいなら build ではなく `npx tsc --noEmit` を使えば
`.next` を触らないので dev を止めずに済む。
ESLint も `npx next lint --dir src` は `.next` を書き換えない。
`npm run build` が要るのは本番ビルドの通過確認だけ。

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

→ 各項目の計測スクリプトと実測値は [.claude/rules/ui-debugging.md](.claude/rules/ui-debugging.md)
   （`.tsx` / `.jsx` / `.css` を扱うとき自動で読み込まれる）

### ⚠️ 「サイトが遅い」の実体は3層ある（2026-08-13 本番実測）

**遅さの正体はクエリではなかった。** Supabase の各クエリは実測 60〜110ms
（東京同士。Vercel も `hnd1`）で、ページを重くしていたのは別の3つ。

| 層 | 実体 | 実測 |
|---|---|---|
| ① **コールドスタート** | ISR キャッシュに載っている `/` 以外は全部サーバー関数を起動する | `/people` 2.68 → 0.82 → 0.66 → 0.50秒。`/companies` 3.39 → 1.27 → 0.37秒 |
| ② **middleware の認証往復** | `updateSession()` の `getUser()` が毎リクエスト Supabase Auth へ出ていた | `/`（ISRヒット）で 未ログイン 0.10秒 → **ログイン中 0.23〜0.27秒** |
| ③ **描画後のクライアント往復** | 遷移のたびに `getUser()` + `ow_profiles`。加えてヘッダーが `ow_users` を2回 | 「表示はされたのにまだ重い」の正体 |

②③ は 2026-08-13 に対処済み（下記）。**① は未対処。**

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

#### ① コールドスタートについて（未対処）

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

### Git 運用方針（2026-05-03 確定）
- main ブランチに直接コミットする（worktree 作成禁止）
- worktree が既に存在する場合は、`git worktree remove` で削除してから作業を開始する
- 削除手順は引き継ぎ書 v6 §5 および本ドキュメントの「Git 運用方針」を参照
- `git rebase` / `git reset --hard` / `git commit --amend`（既存コミット対象）は使わない
- push は柴さんの「OK push して」を待つ

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

