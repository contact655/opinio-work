# フェーズ0調査: 経歴入力から企業マスタを作れるようにする

**調査日**: 2026-09-04
**やったこと**: SELECT と grep とコード読みのみ。**書き込み・実装なし。**

⚠️ 件数はすべて 2026-09-04 時点の実測値。

---

## 0. 要約

| # | 分かったこと |
|---|---|
| ① | **通っていないのは「入口」だけ。** 作成 API（`POST /api/biz/companies`）は完成しており、`industry_id` も受け取る。**経歴入力からその API を呼ぶ画面が無い**（`source: 'user'` の定義がコメントにあり「その入口はまだ存在しない」と明記されている） |
| ② | ★**フェーズ2で入れたゼネコン6社は、求職者の企業ピッカーに出てこない。** ピッカーが叩く `/api/companies/search` は `filterListedCompanies`（掲載中のみ）で絞るため、`draft` の6社は**1件も返らない**（実測） |
| ③ | `industry_id` は **API が受け取り、任意**。現在 NULL の企業は **0社/100社** |
| ④ | 重複は**検出するが止めない**（設計どおり）。ただし `normalize_company_name` は**カナ・かな・半角カナに未対応** |
| ⑤ | 運営が「利用者が作った非公開企業」を探す**専用の入口は無い**（`/admin/companies` のタブは engagement_status の4つだけ） |
| ⑥ | 軸2は `scope = NULL` で生まれるが、**`/admin` の「未確認 N社」は増えない**（あのバナーは `listing_status = 'listed'` だけを数える） |

---

## A. 現在どこまで通っているか

### A-1. 企業を作れる経路 → **1つだけ**

`src` 全体で `ow_companies` に INSERT するコードは **`POST /api/biz/companies` の1箇所のみ**
（`ow_companies` に触れるファイルは93箇所あるが、INSERT はここだけ）。

⚠️ 同 API のコメントに、**未実装の入口が名指しで書いてある**:

```
 *   biz_self … この API から作られたもの
 *   user     … 経歴入力フローからの作成（**その入口はまだ存在しない**）
```

→ **`source: 'user'` は語彙として用意済みで、呼ぶ画面だけが無い。**

### A-2. 作成 API が書く列

| 列 | 入る値 |
|---|---|
| `name` | **必須**（200字以内） |
| `brand_name` | 空なら社名から法人格を落とした既定値 |
| `description` / `employee_count` / `url` / `logo_url` / `name_en` | 任意 |
| **`industry_id`** | **任意。受け取る。**マスタに実在しなければ **400**（黙って NULL に落とさない） |
| `industry`(text) | **書かない**（2026-08-25 に廃止列として閉じた） |
| `status` | `'draft'` |
| **`is_published`** | **`false`** |
| **`listing_status`** | **`'draft'`**（★DB既定は `'listed'` だが、明示的に上書きしている） |
| `is_approved` | **書いていない** → DB既定（`false`） |
| `source` | **`'biz_self'`** |
| `slug` | 導出できなければ **NULL**（日本語社名をローマ字に機械変換しない） |
| `normalized_name` | 書かない（トリガーが `name` から計算） |

副作用: `ow_company_admins` に作成者を `permission: 'admin'` で追加 ／ `ow_company_plans` を1本 ／ 運営へメール通知。

実測: `source = 'biz_self'` の企業は **3社**
（合同会社やめるラボ・株式会社TYU・株式会社ゼクイース。**3社とも業種が入っており、3社とも `draft`**）。

### A-3. UI の入口のガード → **求職者アカウントでも到達できる**

`BizLayout` の `MEMBERSHIP_EXEMPT` に **`/biz/companies/add`** が入っているので、
企業に所属していないログインユーザーでも `/biz/companies/add/new` に入れる。
API 側も**ロール判定を意図的に入れていない**（2026-08-12 の決定。理由もコメントに明記）。

⚠️ ただし**求職者向けの導線としては使えない。** あの画面は `/biz` のシェル（BUSINESS ヘッダー）で、
「所属企業を登録する」という企業側の文脈。**経歴入力から飛ばす先ではない。**

### A-4. 経歴側の2経路

| 経路 | 実体 | 結果 |
|---|---|---|
| マスタから選ぶ | `/api/companies/search` のサジェスト → `company_id` | ✅ 業界に繋がる |
| 自由入力 | 「**「◯◯」をこの名前のまま入力する**」→ `company_text` | ❌ 業界に繋がらない |

該当箇所:
- オンボーディング: `src/app/onboarding/OnboardingClient.tsx:1153`
- 経歴エディタ: `src/components/profile/CareerHistoryEditor.tsx:748`
  （確定後の説明文: 「OPINIO 未掲載の企業として、この名前のまま記録します（企業ページには紐づきません）」）

⚠️ **文言は正直**。実装と食い違っているわけではない。**足りないのは3つ目の選択肢**
（「この会社を OPINIO に登録する」）。

---

## B. 重複が起きる条件

### B-1. `/api/companies/search` の絞り込み → **掲載中のみ**

`filterListedCompanies` を通す＝ **`is_published = true` かつ `listing_status = 'listed'` かつ `is_test = false`**。
コメントにも「**サジェストはディレクトリの軸。`listing_status='draft'` は出さない**」と明記。

**★実測（2026-09-04 / dev）**

| クエリ | 結果 |
|---|---|
| `鹿島` | **0件** |
| `大林` | **0件** |
| `高砂` | **0件** |
| `アンドパッド` | 1件 |
| `スパイダー` | 1件 |
| `セールスフォース` | 1件 |

⚠️★**フェーズ2で入れたゼネコン6社は、いまのところ誰も職歴で選べない。**
   「建設出身者が `company_id` で繋がるように」という投入の目的が、**まだ達成されていない。**

⚠️ 検出器の注意: 最初 `companies` というキー名で読んで**全件0と誤読しかけた**（正しくは `results`）。
   セールスフォース（掲載中）まで0件になったので気づけた。**0件を報告する前に、当たるはずの語で確かめること。**

### B-2. `find_companies_by_normalized_name` の権限

**EXECUTE は `service_role` と `postgres` だけ。** `authenticated` / `anon` には無い。
→ **API 経由（admin クライアント）でしか呼べない。** 作成 API はこれを使って重複を検出している。

### B-3. 「非公開企業と同じ名前」で作成したとき（コードを読んだ挙動）

1. `find_companies_by_normalized_name` が**非公開企業も含めて**一致行を返す（RPC は掲載状態で絞らない）
2. ⚠️ **一致しても作成は止まらない**（2026-08-12 の決定。`force_create` も廃止済み）
3. 作成後、運営へのメールの件名が **`[OPINIO] [重複の疑い]`** になり、本文に既存企業への
   `/admin/companies/{id}` リンクが並ぶ

→ **重複行は作られる。気づけるのは運営のメールだけ。**
   ⚠️ 利用者側には「同じ名前が既にある」と**見えない**（サジェストが掲載中しか返さないため）。

### B-4. `normalize_company_name` の未対応が効くケース

正規化がやること: 全角英数→半角 / 小文字化 / 空白・中点・ハイフン等の除去 /
法人格（前後）の除去 / 英語の法人格接尾辞（inc, ltd, corp…）の除去。

**実測（2026-09-04）**

| 入力 | 正規化後 | 判定 |
|---|---|---|
| `鹿島建設株式会社` | `鹿島建設` | ✅ 一致する |
| `鹿島建設` | `鹿島建設` | ✅ |
| **`カジマ建設`** | `カジマ建設` | ❌ **別物になる** |
| **`かじま建設`** | `かじま建設` | ❌ **別物になる** |
| `株式会社大林組` / `大林組` / `（株）大林組` | `大林組` | ✅ 3つとも一致 |
| **`ｵｵﾊﾞﾔｼｸﾞﾐ`**（半角カナ） | `ｵｵﾊﾞﾔｼｸﾞﾐ` | ❌ **別物** |
| `スパイダープラス株式会社` / `スパイダープラス` | `スパイダープラス` | ✅ |
| **`SPIDERPLUS`** | `spiderplus` | ❌ **カナ表記とは一致しない** |
| `株式会社アンドパッド` | `アンドパッド` | — |
| **`ANDPAD`** | `andpad` | ❌ **カナ表記とは一致しない** |

**効く場面**: ⚠️ **和名とカナ／英字が併記される会社**（ANDPAD / SPIDERPLUS）と、
**半角カナで入力する人**。ゼネコンは漢字表記が安定しているので、実は**カナ問題は建設より SaaS で効く。**

---

## C. 業種（industry_id）をどうするか ★最重要

### C-1〜C-3. 現状

| | |
|---|---|
| API が `industry_id` を受け取るか | **受け取る**（任意。不正値は400） |
| `ow_companies.industry_id` | **NULL 可・既定値なし** |
| `industry_id` が NULL の企業 | **0社 / 100社**（掲載中も非掲載も0） |

⚠️ **必須化は作成時ではなく公開時**という設計になっている（`checkPublishable`）。
   作成時に必須化すると登録の摩擦が増えるため（オンボーディングで業種を必須にしないのと同じ判断）。

### C-4. ★22件は素人が選べる粒度か

有効な22件（`display_order` 順）:

```
IT・ソフトウェア / インターネット・Webサービス / 電子機器・半導体 / 通信 /
電機・機械 / 素材・化学 / エネルギー・インフラ / 食品・飲料 / 飲食・外食 /
商社・卸売 / 小売・流通 / 金融・保険 / 不動産 / 建設 / 運輸・物流 /
医療・ヘルスケア / 教育 / 人材サービス / コンサルティング /
メディア・広告・エンタメ / 公共・団体 / その他サービス
```

**評価**

| 観点 | 判定 |
|---|---|
| 自分の勤務先を選べるか | ⚠️ **大半は1タップで選べる**。「建設」「金融・保険」「医療・ヘルスケア」「教育」は迷わない |
| 迷う組み合わせ | ⚠️ **3組ある** —— ①`IT・ソフトウェア` と `インターネット・Webサービス`（SaaS企業の人はどちら？）②`商社・卸売` と `小売・流通` ③`電機・機械` と `電子機器・半導体` |
| 見つけにくい | ⚠️ **製造業の人**。「製造業」という語が無いので、`電機・機械` / `素材・化学` / `食品・飲料` を自分で選び分ける必要がある（クアルコムを未確認にしたのと同じ穴） |
| 件数 | 22件は**スクロールなしでは収まらない**（オンボーディングの職種は親18件をチップで出している。同じ形なら2〜3行） |

**結論（案）**: ⚠️ **22件をそのまま出すのは、素人には1〜2秒の迷いを生む。**
ただし**入力量としては1タップ**で、職種選択（親18件）と同じ重さ。**致命的ではない。**

⚠️★**それより重い問題は「迷う3組」で、どちらを選んでも業界マッチの結果が変わること。**
   例: SaaS企業の人が `インターネット・Webサービス` を選ぶと、
   対象業界が `IT・ソフトウェア` の企業（ゲインサイト・Opinio）と**マッチしない。**

---

## D. 運営レビューの要否

### D-1. 利用者が作った非公開企業を運営が見つける手段 → **専用の入口は無い**

`/admin/companies` のタブは **`すべて` / `契約済み` / `ドメイン認証済` / `未認証`**（`engagement_status`）の4つだけ。
**`source` でも `listing_status` でも絞れない。**

→ いまは **運営メールのリンクから個別に開く**か、一覧を目視するしかない。

### D-2. 運営通知

| | |
|---|---|
| 宛先 | `ADMIN_EMAIL`（既定 `contact@opinio.co.jp`） |
| 件名 | 重複候補があれば **`[OPINIO] [重複の疑い] …`**、無ければ `[OPINIO] …` |
| 本文 | 作成された企業の情報 ＋ **重複候補の一覧（`/admin/companies/{id}` へのリンク）** |

⚠️ コメントに「**重複に気づける経路はこの通知だけなので、必ず載せる**」と明記されている。

### D-3. 放置された企業が求職者側に漏れないか → **漏れない**

| 面 | 出るか |
|---|---|
| `/companies` 一覧・facet | ❌ `filterListedCompanies` が落とす |
| sitemap | ❌ 同上 |
| 企業詳細 `/companies/{slug}` | ❌ **404**（本番で鹿島建設が404であることを 2026-09-04 に実測） |
| ヘッダー検索サジェスト | ❌ 実測0件 |
| **経歴の企業ピッカー** | ❌ **出ない**（B-1。★これは長所ではなく、今回の問題そのもの） |

---

## E. 影響範囲

### E-1. 企業が増えて壊れうる面 → **draft のままなら影響なし**

作成される企業は `is_published = false` / `listing_status = 'draft'` なので、
`/companies` の件数・facet・sitemap・企業詳細のいずれにも出ない（D-3 の実測）。

⚠️ 影響が出るのは **運営が掲載に切り替えたとき**。そのときは公開ゲート（業種＋主の事業領域）を通る。

⚠️ `get_blocked_companies`（スカウトの在籍企業ブロック）は
`/api/jobseeker/scout-settings` から admin クライアントで呼ばれる。
**在籍企業が増えればブロック対象も増える**が、これは**意図した挙動**（在籍先からスカウトを受けない）。

### E-2. ★軸2（対象業界）との関係 → **バナーは増えない**

利用者が作った企業は `target_industry_scope = NULL`（未確認）で生まれる。

⚠️ ただし `/admin/companies` の「**対象業界 未確認 N社**」は
**`listing_status === 'listed'` かつ `is_test !== true`** だけを数えているので、
**draft の企業はカウントされない。** バナーが増え続ける形にはならない。

→ **運営が掲載に切り替えた時点で初めて未確認に加算される。** これは正しい振る舞い
（掲載していない企業の対象業界を調べる意味は無い）。

---

## F. 実装フェーズで最初に決めるべき論点（3つ）

1. ★**ピッカーに `draft` の企業を出すか。** 出さないと、いま入れたゼネコン6社は永久に選べない。
   出すなら「掲載中」と「未掲載（マスタにはある）」を**画面で区別する**必要がある
   （`filterListedCompanies` を緩めるのではなく、**別のエンドポイント**にするのが安全）。
2. ★**業種を利用者に選ばせるか。** 選ばせないと `industry_id` が NULL で生まれ、
   **業界マッチに繋がらない**（`company_id` で繋がっても意味が無い）。
   選ばせるなら「迷う3組」をどうするか（統合する / 説明を足す / 後で運営が直す前提にする）。
3. **重複をどこまで許すか。** いまは「検出するが止めない」。利用者側に候補を見せない設計なので、
   ピッカーに draft を出すなら**重複の作られ方自体が変わる**（既存が見えるので選んでもらえる）。

---

## G. フェーズ1で決めた宿題（2026-09-04 追記）

### G-1. ★カナ正規化（案B）は今回やらない。ただし**効くのは建設ではなく SaaS**

`normalize_company_name`（B-4）は**カナ↔英字を揃えない**ので、
`ANDPAD` と `アンドパッド` は**別の会社として通る**。

⚠️★**この穴は建設テック企業のためのものだと読み違えないこと。**
今回ゼネコン6社を投入したのでその文脈で出てきた話だが、**実際に効くのは SaaS のほう**。

| | なぜ |
|---|---|
| **ゼネコン・伝統的な日本企業** | 正式名称が**漢字**（鹿島建設 / 大林組 / 高砂熱学工業）。**カナ表記の揺れが起きにくい** |
| **★SaaS・スタートアップ** | **英字の正式名称にカナの通称が並走する**（ANDPAD / アンドパッド、SmartHR / スマートHR、Sansan / サンサン）。**ここで割れる** |

⚠️ したがって、この対処を「建設テックを入れたついで」の位置づけにすると、
**優先度を取り違える。** 掲載企業83社の大半が SaaS である以上、
**重複が起きるとしたら SaaS 側**。

⚠️ 今回は `search_aliases` を lookup の検索対象に入れてあるので、
**別名を1件ずつ手で入れれば個別には救える**（アンドパッドは実測で引ける）。
正規化はその手作業を無くすためのもので、**急ぎではないが、企業作成の入口を作る日には要る**
（作成前の重複チェックがこの関数を通るため）。

### G-2. ★業種の2階層化（製造業）は**統合では解決しない**

**「電機・機械」「電子機器・半導体」「素材・化学」はあるのに、`製造業` が無い。**
自分の勤務先が「精密機器メーカー」の人は、どれを選べばよいか決められない。

⚠️★**統合で潰さないこと。** 3つを1つにすると、
**いま正しく選べている人の粒度まで落ちる**（半導体と化学が同じ箱になる）。

必要なのは**2階層 ＋ 祖先展開**。`ow_roles`（職種）が既に採っている形と同じ。

| | |
|---|---|
| 親 | `製造業`（選んでよい。子まで降りなくてよい） |
| 子 | 電機・機械 / 電子機器・半導体 / 素材・化学 |
| 突合 | **求人↔人の職種と同じく、親↔子の両方向で一致させる**（CLAUDE.md「判定は『同じ系統か』を両方向で見る」） |

⚠️ 兄弟は拾わない。`ow_roles` 側で確立した規則（**片側だけ祖先展開する**）をそのまま使う。

⚠️ **軸2（対象業界）にも同じ階層が必要になる。**「製造業向け」と言う企業と、
「半導体メーカー向け」と言う企業がどちらも存在する。
**業種と対象業界は同じ `ow_industries` を語彙にしている**ので、階層を入れるなら両方に効く。

⚠️ **今回のフェーズ1では触らない。** 統合（インターネット・Web → IT・ソフトウェア）は
「2つの値が同じものを指していた」という**語彙の重複**の話で、こちらは**粒度**の話。別の作業。

---

## H. フェーズ2で実装したこと（2026-09-05）

### H-1. 作成は `POST /api/jobseeker/companies`（新設）

⚠️★**`POST /api/biz/companies` は使い回さなかった。** あちらは企業を作るだけでなく
**呼んだ人をその企業の担当者にする**（`ow_company_admins` に `permission='admin'` を INSERT）。
入ると `getCompanyContext` が非 null を返すので、**元勤務先を登録した求職者に /biz の
サイドバーが出て、その会社の情報を編集でき、応募・面談の通知の宛先にもなる。**

| 触るもの | `/api/biz/companies` | **`/api/jobseeker/companies`** |
|---|---|---|
| `ow_companies` | 作る | **作る** |
| `ow_company_admins` | **作る** | **作らない** |
| `ow_company_plans` | **作る** | **作らない** |
| `biz_current_company_id` Cookie | **セットする** | **セットしない** |

実測（2026-09-05 / is_test アカウントで1社作成）:
`ow_companies` 100→101、**`ow_company_admins` 14→14 / `ow_company_plans` 88→88 で変化なし**。
`/biz/dashboard` の企業切替にも出ず、Cookie も上書きされなかった（既存の所属企業のまま）。

⚠️ **このルートに `ow_company_admins` / `ow_company_plans` / Cookie を触るコードを足さないこと。**

### H-2. ★取らなかった項目 —— 運営が後から埋める前提

聞くのは **会社名と業種の2つだけ**。**URL・従業員数・所在地・説明文は取らない。**

2026-09-02 に「職務経歴書をそのまま入力させるのは負荷が高いのでは」という指摘が出ており、
ここは**職歴を書いている途中に挟まる画面**なので、項目を増やすと入力が止まる。

⚠️ したがって、利用者が作った企業は**名前・ブランド名・業種しか入っていない**。
   残りは運営が `/admin/companies/[id]` で埋める。
   **見つけ方は `/admin/companies` の「利用者が作成」タブ**（`source='user'` かつ未掲載）。

⚠️ **業種だけは必須にした。** この入口は業界マッチのために作るので、
   業種が無いと `ow_industries` を介した対象業界との突合に乗らず、
   作っても `company_text` と同じ結果になる。
   （`/api/biz/companies` は業種が任意。**入口ごとに条件が違ってよい**——
    あちらは公開時に `checkPublishable` が要求する。）

### H-3. ★`company_text`（自由入力）の道は残した

**消していない。** ただし**順序を入れ替え、登録を先・大きく**、自由入力を後ろ・小さくした。

判断の根拠は「失敗したときのコストが非対称」であること:

| | 取り消せるか |
|---|---|
| **企業作成** | **取り消せない。** マスタに行が残り、消せるのは運営だけ |
| **自由入力** | 本人の職歴の中で完結する。間違えても他の誰にも影響しない |

⚠️ 実ユーザーの自由入力は **0件**（2026-09-05 実測）。**消しても実害は測れない**が、
   逃げ道を塞ぐのは**実際に増えてからでよい**（2026-09-05 / 柴さんの判断）。

#### ★件数を見るクエリ（増えたかどうかはこれで判断する）

```sql
-- 実ユーザーの職歴のうち、マスタに繋がっていないもの（＝自由入力）
select
  count(*) filter (where e.company_id is not null)                          as マスタ,
  count(*) filter (where e.company_id is null and e.company_text is not null) as 自由入力,
  count(*) filter (where e.company_anonymized)                              as 匿名,
  count(*)                                                                  as 合計
from ow_experiences e
join ow_users u on u.id = e.user_id
where coalesce(u.is_test, false) = false and coalesce(u.is_system, false) = false;
```

実測（2026-09-05）: 実ユーザー15件 → マスタ 15 / 自由入力 **0** / 匿名 0
（全26件では自由入力5件だが、**5件とも `is_test` アカウント**）。

### H-4. 業種の説明文は `ow_industries.description`（列）

**UI 側の定数にしなかった。** 業種マスタはこの2週間で2回動いており
（不動産・建設の分割 / インターネット・Web の統合）、別ファイルに置くと
**値を足したときに追従を忘れる**。同じ migration の同じ VALUES に並べれば忘れられない。

⚠️ `/admin` に業種マスタの CRUD 画面は**無い**（`ow_industries` を UPDATE / INSERT する
   src コードは0件。`/admin/roles` と `/admin/schools` にはあるが industries には無い）。
   **列を足しても入力欄は要らない。**

⚠️ **説明は5件だけ。残り16件には付けない。** 全部に付けると、
   説明の要らない業種にも書くことになり、迷う組が埋もれる。

| 業種 | 説明 |
|---|---|
| 電機・機械 | 機械・電機・自動車・精密機器などの製造 |
| 素材・化学 | 化学・素材・金属などの製造 |
| 食品・飲料 | 食品・飲料の製造 |
| 商社・卸売 | メーカーと小売の間に立ち、仕入れて売る（総合商社・専門商社・卸） |
| 小売・流通 | 消費者に直接売る（店舗・EC・チェーン） |

⚠️★**製造3値のどれかを「受け皿」にしない**（2026-09-05 / 柴さんの判断）。
   「電機・機械＝メーカー全般」とする案は**採らなかった** ——
   化学メーカーの人が「電機・機械」を選んでしまい、**2階層化しても
   『電機・機械』のまま固定されて移し直せない。** 互いに排他だと分かる説明を
   3つとも付けて、最初から正しい箱に入れてもらう。

⚠️ **説明は「製造業が無い」ことを解決していない。** 精密機器メーカーの人は
   「電機・機械」に辿り着けるが、**「製造業」という上位の箱は今も無い**。
   → G-2 の宿題。★`ow_industries` には **`parent_id` が既にある**ので、
   **列追加なしで2階層にできる**（見積もりは思ったより軽い）。次のタスク候補。

⚠️ `/biz` の企業登録フォームには説明を出していない（`fetchIndustryOptions` は
   `description` を返すようになったので、出すなら描画を足すだけ）。
   **今回の依頼の範囲外なので触っていない。**

### H-5. 重複は「作る前に照会し、選ばなければ作る」

`GET /api/jobseeker/companies?name=` が DB の `normalize_company_name()` で照会する。

⚠️★**`/api/companies/lookup` では代われない。** あちらは名前の**部分一致**（ILIKE）なので、
   「（株）鹿島建設」と打った人に「鹿島建設株式会社」を出せない。実測でも lookup は0件、
   こちらは1件返した。

⚠️ 返す列は **id / name / isListed の3つだけ**（lookup と同じ条件）。
   RPC は `listing_status` を返さないので、掲載中かどうかは引き直している
   （`is_published` だけでは `isListed` にならない）。

⚠️ **候補が出ても作成を止めない。** 同名の別会社は実在する。

### H-6. 検証（2026-09-05 / is_test アカウント・dev）

| 確認したこと | 結果 |
|---|---|
| ピッカーに無い会社名で作成できる | ✅ 「検証建設工業株式会社」を作成 |
| 作られた行のフラグ | `source='user'` / `status='draft'` / `is_published=false` / `listing_status='draft'` / `is_approved=false` / `industry_id`=建設 |
| slug | **null**（日本語社名なので導出しない） |
| 副作用が無いこと | `ow_company_admins` 14→14 / `ow_company_plans` 88→88 / `/biz` の企業切替に出ない |
| 業種の選択肢 | **21件**、説明つきは**5件のみ** |
| 「もしかしてこれ？」 | 「（株）鹿島建設」→ **鹿島建設株式会社** を候補に出す |
| `/companies`・`/jobs`・`?industry=`・sitemap・`/api/companies/search` | **すべて0件**（漏れなし） |
| 企業詳細 | dev は 200（**dev 例外**）。★同じ状態の企業で**本番は 404** を確認（鹿島建設 / opinio.jp） |
| `/mypage` の業界マッチ | ✅ 「建設の経験が活きる会社」に**アンドパッド / スパイダープラス / ダンドリワーク / フォトラクション**の4社 |
| `/admin/companies` | 「利用者が作成」タブに **1** |
| 後片付け | 企業・職歴とも削除し、5テーブルの件数が作業前と一致することを確認 |

⚠️★**dev の 200 を「漏れている」と読まないこと。** `filterVisibleCompanies` は
   **dev では絞らない**（非公開企業の詳細を確認できるようにするための例外）。
   本番の挙動は、**同じ状態の既存企業**（`is_published=false` / `listing_status='draft'` の
   ゼネコン）で確かめる —— 実測 **404**、一覧・sitemap にも0件。

### H-7. ついでに直した文言の矛盾

経歴編集で未掲載の企業を選ぶと、チップに「**OPINIOに未掲載**」と出ているすぐ下に
「**OPINIOに掲載中の企業と連携します**」が出ていた（2026-09-04 に未掲載も選べるように
した時点で矛盾していた）。**「OPINIOの企業と連携します」**に変えた。

⚠️ 既存レコードを開いた直後は掲載状態が分からない（候補から選んでいないので
   `selectedMeta` が無い）。**どちらの場合も正しい言い方**にしてある。

---

## I. ★語彙のドリフト —— CHECK の無い列挙列で必ず起きる（2026-09-05）

### I-1. 実際に起きていたこと（`ow_companies.source`）

この列は 2026-05-18（`archive/104`）に **`source text`（制約なし）** として足された。
104 のコメントは語彙を宣言していた —— `admin_seed` / `self_serve` / `NULL`。

**3年半後（2026-09-05 / 100社）の実測:**

```
migration 79 / NULL 9 / manual 8 / biz_self 3 / admin_seed 1
  ★宣言にあった self_serve … 0件
  ★宣言に無い migration と manual … 87件
```

**宣言が0件で、宣言に無い値が大多数。** これは**誰かが間違えたのではなく、
CHECK の無い列挙列で必ず起きる形**。DB は何も言わず、コードも定数を持たないので、
**気づくには数えるしかない。**

→ 2026-09-05 に CHECK と [`src/lib/constants/companySource.ts`](../src/lib/constants/companySource.ts) を
   同じ migration で入れた（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。

⚠️ **`NOT NULL` にはしていない。** NULL 9件は「どの入口から来たか分からない」という
   事実で、`created_at` から推測して埋めると**推測値の投入**になる。

### I-2. 同じ形の列を洗い出した（★対処は今回しない）

**条件**: `ow_*` の text 列 ／ CHECK 制約も enum 型も無い ／ 名前が列挙っぽい
（`status` `_type` `category` `stage` `level` `source` `scope` `visibility` `permission` ほか）
／ 実データが1行以上ある。

```sql
-- ⚠️★`query_to_xml` の根要素は <row>。`/r/` と書くと**0件になる**（一度これで空を見た）。
--    ルール⑱「grep が 0件のときは、検索が効いていることを先に確かめる」と同じ形。
WITH cols AS (
  SELECT c.relname AS tbl, a.attname AS col
  FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
  WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
    AND c.relname LIKE 'ow!_%' ESCAPE '!'
    AND a.attnum>0 AND NOT a.attisdropped
    AND format_type(a.atttypid, NULL)='text'
    AND a.attname ~ '(status|_type|type$|category|stage|level|kind|source|format|style|frequency|freq|scope|state|visibility|permission|plan|tier|gender|role$|target$)'
), checked AS (
  SELECT c.relname AS tbl, a.attname AS col
  FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
  JOIN unnest(con.conkey) k(attnum) ON true
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum
  WHERE con.contype='c' AND c.relnamespace='public'::regnamespace
), cand AS (
  SELECT cols.tbl, cols.col FROM cols
  LEFT JOIN checked ON checked.tbl=cols.tbl AND checked.col=cols.col
  WHERE checked.col IS NULL
)
SELECT tbl, col,
       (xpath('/row/n/text()', x))[1]::text::int AS rows_total,
       (xpath('/row/d/text()', x))[1]::text::int AS distinct_vals,
       (xpath('/row/v/text()', x))[1]::text      AS sample_values
FROM (SELECT tbl, col, query_to_xml(format(
  'select count(*) as n, count(distinct %I) as d, coalesce(string_agg(distinct %I, '' | '' order by %I),''(すべてNULL)'') as v from public.%I',
  col, col, col, tbl), false, true, '') AS x FROM cand) s
WHERE (xpath('/row/n/text()', x))[1]::text::int > 0
ORDER BY (xpath('/row/d/text()', x))[1]::text::int DESC, tbl, col;
```

#### 実測（2026-09-05）— ★列挙とみなせるもの

| テーブル | 列 | 実データの値 |
|---|---|---|
| **`ow_companies`** | **`status`** | `active` / `draft` / `pending` |
| **`ow_companies`** | `funding_stage` | `listed` / `seed` / `series_b` |
| **`ow_posts`** | **`post_type`** | `article_published` / `company_joined` / `job_posted` |
| **`ow_activities`** | `type` | `company_info_updated` / `job_updated` / `offer_sent` |
| **`ow_activities`** | `target_type` | `company` / `job` / `job_application` |
| **`ow_profiles`** | `desired_work_style` | `flexible` / `full_remote` |
| **`ow_terms_agreements`** | `terms_type` | `business` / `listing` |
| **`ow_jobs`** | `work_style` | `hybrid`（23件すべて） |
| **`ow_company_posts`** | `category` | `interview` |
| `ow_page_views` | `page_type` | 9値 |
| `ow_contact_submissions` | `action_type` | 7値 |

⚠️ **`ow_companies.status` が筆頭。** `ow_jobs.status` には CHECK があるのに、
   **企業側には無い**。しかも `active` / `draft` / `pending` の3値が実在し、
   意味を説明した記述がどこにも無い（`ow_jobs` の `active` を削除したときと同じ形）。

⚠️ **全部が対処対象ではない。** `ow_page_views.page_type` と
   `ow_contact_submissions.action_type` は**ログの記録**なので、
   増える値を CHECK で止めると記録が落ちる（止めたい対象ではない）。

⚠️ **偽陽性がある。** 名前で拾っているので、`ow_jobs.source_url`（URL）・
   `ow_company_external_links.source_name`（媒体名）・`ow_profiles.job_type`（自由記述）
   のような**列挙でないもの**も混ざる。**distinct が少ない＝列挙とは限らない。**

⚠️ **NULL だらけの列も出る**（`autonomy_level` `business_stage` `management_style` ほか）。
   値が1つも無いので語彙が推定できない。**先に「使うのか」を決めること。**

### I-3. ★見つけたときの直し方（`source` でやったこと）

1. **既存の値を数える。** 語彙を「宣言」から取らない ——**実データから取る**
2. **CHECK を張る前に、語彙に無い値が0件であることをアサートする**（migration の中で）
3. **同じ migration で定数ファイルを作る**（UI と API がそれを見る）
4. **NULL は残す。** 埋めると推測値の投入になる
5. **列の COMMENT に「値を足すときは CHECK と定数の両方」と書く**
