# フェーズ0：利用者のAIが OPINIO に接続する仕組み（MCP）と ATS 連携（2026-10-15 調査）

調査のみ。コード・DB・設定・外部サービスは変えていない。ATS は公式の公開ページだけを読んだ（ログインなし）。

前提（変えない）: OPINIO 側で AI を動かさない ／ 外部 AI は「読む・探す・提案する」まで、相手に届く操作は OPINIO の画面で本人が押す ／
求職者の「AIだけが見る層」は企業側 AI に渡さない ／ 企業 AI が見られるのは求職者が許可した項目だけ ／ 画面は AI を使わない人のために残す。

---

## A. 外に出すデータの棚卸し

### A-1. 求職者が自分の AI から取得してよい候補

| データ | 置き場所 | いまの取得口 | 再利用できる関数か |
|---|---|---|---|
| 自分のプロフィール | `ow_users`（name・headline・about_me・location・social_links・username 等） | `mypage/page.tsx:62` がページ内で直接 select | ❌ ページ内に直書き |
| 職歴・学歴・実績・資格・スキル等 | `ow_experiences`（列は `lib/experiences/columns.ts`）・`ow_user_educations`・`ow_user_achievements`・`ow_user_awards`・`ow_user_certifications`・`ow_user_languages`・`ow_user_skills`・`ow_user_media_appearances`・`ow_user_content_links` | 同上 133〜193行 | ❌ 同上 |
| 希望条件 | `ow_profiles.desired_*`・`career_stance`、`ow_profile_desired_roles` | 同上 197行 | ❌（⚠️ `ow_profiles.user_id` は **auth 空間**） |
| あなたに合う会社（順位と理由） | 導出（材料は職歴・希望・ブロック・反応・事業領域・求人・面談対応者・担当者） | **`buildForYou(owUserId)`**（`lib/forYou/rank.ts:76`、server-only・admin） | ✅ |
| 届いた提案と段 | `ow_proposals`（運営専用表） | `mypage/proposals/page.tsx:49-60` が直接 ／ 段は `proposalPhase()` | △ 判定は関数、取得は直書き |
| 自分の「話を聞いてみたい」 | `ow_for_you_reactions`（本人 SELECT 可） | 書き込みは `reactForYou`（`lib/forYou/react.ts:32`） | 読みは直書き |
| 企業の公開情報 | `ow_companies` ほか | `getCompanyBySlugOrId`（`queries.ts:1030`）・`searchCompanies`（`lib/search/companies.ts:110`） | ✅ |
| 求人 | `ow_jobs` | `getJobs`（`queries.ts:1387`、300秒キャッシュ）・`getJobBySlugOrId` | ✅（公開条件 `PUBLIC_JOB_MATCH`） |
| 話を聞ける人（面談OK） | `ow_company_members`＋`ow_users` | `getPublicAmbassadorsCached`（`queries.ts:2359`、300秒） | ✅ |
| 相性のものさし | `ow_fit_axis_answers` | `loadFitAxes`（`lib/fitAxes/load.ts`） | ✅（★企業側には出さない層） |

### A-2. 企業が自社の AI から取得してよい候補

| データ | 取得口 |
|---|---|
| 自社に「話を聞いてみたい」と答えた求職者 | **`lib/evidence/companyProposals.ts` だけ**（`listCompanyProposals` ほか。`scripts/check-proposal-reads.mjs` が直接読みを0件に保つ）。下段の一覧からの興味は `ow_for_you_reactions` ＋会話（`openReason.ts`） |
| 自社の企業情報・求人 | `fetchCompanyForTenant`（`lib/business/company.ts:450`）／ `/api/biz/*` |
| 公開を許可した求職者の検索 | `loadCompanyCandidates`（`lib/business/candidates/load.ts:46`、admin・上限500）→ `can_send_scout_many` / `can_send_company_approach_many` → `filterCandidates` / `sortCandidates`。1人の可否は `canSeeCandidate`（`lib/auth/companyAccess.ts:104`）・`getCandidateProfileForCompany` |

⚠️ 候補者検索は**画面のためのサーバー処理**で、年齢・性別・最終利用はスイッチ（`ageFilter.ts` / `genderDisplay.ts` / `activity.ts`）で出し分けている。外部に出すなら同じスイッチを通す。

### A-3. 公開範囲の判定 —— 集約されているもの／散っているもの

**関数に寄せてあるもの**
- 企業: `filterListedCompanies` / `filterVisibleCompanies(Strict)`（`lib/companies/visibility.ts`。25ファイルが使う）
- 求人: `PUBLIC_JOB_MATCH`（26箇所。sitemap だけ未移行）
- 登録済みの人: `isRegisteredUser`（`lib/users/registered.ts`）
- 企業から届くか: `isReachableByCompanies`（TS）＝ SQL `can_send_scout()` 条件1の写し（**二重管理**）
- 企業との会話: `openReason.ts` ／ DM: `contactGate.ts`
- 企業側の提案: `companyProposals.ts`

**散っているもの（外部接続の前に寄せる必要がある）**
1. **`is_test` / `is_system` / `visibility` の除外**: 40ファイル超にインライン（`queries.ts` 13・`forYou/rank.ts` 7・`approaches/server.ts` 4 ほか）。`registered.ts` 自身が「集約していない」と書いている。
2. **「閲覧者が検証用なら検証用データも見せる」分岐**が複数（`rank.ts`・`jobListingStateFor`・`companyLinkStateFor`・`fitAxesEnabledFor`・`testViewer.ts`）。
3. **企業の掲載条件の直書き**: `forYou/rank.ts:120-123`・`businessDomainsCached.ts:56`・`admin/aiFill/load.ts:40`（運営用は対象外でよい）（2026-10-16 廃止）。
4. **求職者本人のデータの取得**が `mypage/page.tsx` と `mypage/proposals/page.tsx` にページ直書き。外部から同じものを返すには、先に「本人のプロフィールを返す関数」「本人の提案一覧を返す関数」を切り出す必要がある。
5. `ow_experiences.visibility_company`（real/masked/hidden）の扱いが画面ごとに違う（CLAUDE.md「visibility_company の適用範囲」）。

→ ★**MCP 側で条件を書き直さないこと。** 段階1の前に、上の1・4を「1関数」に寄せ、MCP はそれを呼ぶだけにする。

### A-4. 外に出してはいけないもの

| 区分 | 中身 |
|---|---|
| 運営専用の表（RLS 有効・ポリシー0 or REVOKE） | `ow_transitions`・`ow_proposals`・`ow_proposal_declines`・`ow_company_data_sources`・`ow_company_field_changes`（2026-10-16 廃止）・`ow_company_creations`・`ow_approach_*`・`ow_candidate_notes`・`ow_candidate_tracking`・`ow_company_approaches`・`ow_company_member_reports`・`ow_company_proposal_settings`・`ow_company_slack_*`・`ow_meetings`・`ow_message_reports`・`ow_message_request_declines`・`ow_user_blocks`・`ow_search_logs` ほか |
| `ow_users` | `email`・`birth_date`（年齢はスイッチ経由の数だけ）・`family_name` 等（authenticated にも SELECT なし）・`gender`（企業へは表示文字のみ、絞り込み不可）・`phone`・`last_active_at`（企業へは帯だけ）・`is_test`・`is_system`・`auth_id` |
| `ow_experiences` | `salary_*`・`rank`・`department(_id)`・`turning_point`・`exit_reason`・`learnings`・`join_reasons`・`join_reason_primary`・`leave_reasons`（anon 不可の14列） |
| `ow_companies` 内部 | `draft_data`・`notification_emails`・`listing_requested_at`・`is_approved`・`is_test`・社内メモ |
| ★「AIだけが見る層」（本人の AI にだけ、企業側には絶対に出さない） | 相性のものさし（`ow_fit_axis_answers`）・希望年収（`desired_salary_*`）・`career_stance`・本人の反応（`ow_for_you_reactions.signals` / `rank_at` / `reason`） |

---

## B. 認証と権限

### B-1. いまの仕組み
- Supabase Auth ＋ `@supabase/ssr` の **Cookie セッションだけ**。API キー・個人用トークン・OAuth サーバー・「連携アプリ」の表は**無い**。Bearer は cron の `CRON_SECRET` だけ。
- 読み取りの多くは `createAdminClient`（service_role）で、**RLS ではなく関数の中の条件**で見せる範囲を決めている。→ 外部接続でも「誰として呼ばれたか」を確定させてから既存関数に渡す形が必要。

### B-2. 認証方式の候補

| 案 | 中身 | 難しさ |
|---|---|---|
| **① OAuth 2.1（MCP 仕様の標準）** | 利用者が自分の AI から「OPINIO に接続」→ OPINIO のログイン画面 → 同意 → AI にアクセストークン | 中〜大。**Supabase Auth が OAuth の「発行側（認可サーバー）」として使えるかは未確認**（要調査・本調査では確認できず）。使えなければ認可エンドポイント・同意画面・トークン発行・失効を自前で持つ |
| ② 個人用アクセストークン（本人が画面で発行して AI に貼る） | `/mypage/settings` に「接続用のキー」を発行・一覧・取り消し | 小〜中。ChatGPT のコネクタ等は OAuth 前提のものがあり、**対応できる AI が限られる** |
| ③ 読み取り専用・公開データだけ（認証なし） | 企業・求人・面談OKの人の公開情報のみ | 小。ただし「自分に合う会社」は出せない |

推奨: **段階1は①を目標に、まず③（公開データ）＋②（本人キー）で始めて利用を確かめる**。①は Supabase の対応状況を調べてから決める。

### B-3. 企業の担当者として接続する場合
- `getCompanyContext(supabase, authUserId, cookieCompanyId?)`（`lib/business/company.ts:365`）は**引数で受けるので Cookie に依存しない**。会社の指定を「トークンに紐づく会社」に置き換えれば流用できる。
- ⚠️ `getTenantContext`（`dashboard.ts:95`）は `cookies()` 必須・redirect する。外部接続では使えない。
- 権限は `requireCompanyAction` / `canSeeCandidate` をそのまま通す。

### B-4. 接続の一覧・取り消し
- 新しい表（例 `ow_ai_connections`：利用者 or 企業・発行日時・最終利用・取り消し日時・スコープ）。**本人は SELECT と取り消しだけ、発行と照合はサーバーだけ**。
- 画面: 求職者は `/mypage/settings`、企業は `/biz/settings` に「接続中のAI」。

### B-5. 操作履歴
- 既存の `ow_activities` は**企業に見える表**なので不向き。
- 新しい表（例 `ow_ai_access_logs`：接続ID・道具名・対象の種類と id・件数・日時）。**`ow_company_field_changes` と同じ形（RLS 有効・ポリシー0・REVOKE）**（2026-10-16 廃止。形の例としてだけ読む）。本人向けには「いつ・何を読んだか」の要約だけを画面で見せる。

---

## C. MCP サーバーの置き場所

### C-1. Next.js（Vercel）の中か、別に立てるか

| | Next の中（`/api/mcp`） | 別に立てる |
|---|---|---|
| 既存関数の再利用 | ✅ そのまま import（`server-only` も効く） | ❌ 共有パッケージ化が要る |
| 判定の二重管理 | 起きにくい | ★起きやすい（A-3 の散在が別リポジトリに複製される） |
| 注意 | middleware の matcher が全パスを通る（`/api/mcp` で Cookie 前提の処理を走らせない除外が要る）／CSP は応答には効かない／**SSE のルートは今無い**（MCP の Streamable HTTP は通常の POST 応答でも成り立つ） | 運用対象が増える |

推奨: **Next の中**。理由は判定を1か所に保てるため。

### C-2. 最初に出す道具（読み取り専用・求職者）と呼ぶ関数
→ 下の「段階1」を参照。

### C-3. 呼び出し回数の上限
- `lib/rateLimit.ts`（Upstash Redis・東京、`id` を渡せば利用者単位）が使える。⚠️ **環境変数が無い・障害時はインスタンスごとのメモリで数える fail-open**。外部接続では**fail-closed（数えられないなら断る）にした別の入口**が要る。
- 単位: 接続（トークン）ごと＋利用者ごと＋企業ごと。日次の上限も持つ。

### C-4. ★本番 Supabase への負荷
- 2026-08-23 に、短時間の大量アクセスの直後に **Disk IO バジェットが枯渇して約40分無応答**になった（再起動では戻らず MICRO で回復）。外部 AI の機械的な連続呼び出しは**同じ形を作りうる**。
- 受けられるもの: `getJobs`・面談OKの人・写真等は `unstable_cache`（300秒）で受けられる。
- 受けられないもの: `getCompanyBySlugOrId`・`getJobBySlugOrId`・`getCompanyEmployees` は**キャッシュなし**。★**`buildForYou` は呼ぶたびに10表前後を読む**（キャッシュなし）。
- → 段階1の条件: **①回数制限は fail-closed ②`buildForYou` は利用者ごとに短時間キャッシュ ③企業詳細はキャッシュ済みの経路を使う ④1回の応答の件数に上限**。

---

## D. ATS 連携（公式の公開情報のみ・確認日 2026-10-15）

### D-1. ATS ごとの連携可否

| ATS | 公開API | 認証 | 求人の取得 | 変更通知（Webhook） | 申請・提携 | 出典 |
|---|---|---|---|---|---|---|
| **HERP Hire** | あり（読み書き） | 管理者が発行する API キー（Bearer・スコープ付き・1テナント毎分100回） | あり（`/v1/requisitions`：名前・説明・年収・勤務地・雇用形態・`careerPageStatus`・`isArchived`・URL・`updatedAt`） | 公式文書に定義なし（取りに行く形） | 申請フォーム＋追加規約。**対象は有料プラン** | https://help.herp.cloud/ja/articles/HERP-Hire-API-86ba917e ／ https://public-api.herp.cloud/hire/public/doc |
| **HRMOS採用** | **提供決定のみ・未提供**（2026-08-31 告知）。予定は選考・応募者の読み取りと評価の書き込み。**求人の取得は予定に無い** | 確認できず | 確認できず（予定に無し） | 確認できず | 確認できず | https://hrmos.co/info/news/20260831-2/ |
| ジョブカン採用管理 | 確認できず | — | 確認できず | 確認できず | — | https://ats.jobcan.ne.jp/ |
| sonar ATS | HRTech 事業者向けのみ（「公開求人取得」API あり、項目は非公開） | 記載なし | あり（項目は確認できず） | 記載なし | 必要。**新規の連携開発の申込みは受付停止中**と明記 | https://sonar-developers.snar.jp/ |
| talentio | あり（読み書き） | 管理画面で発行するアクセストークン（Bearer・毎時5,000回） | あり（名前・職務内容・賃金・勤務地・`active`・`updatedAt`。**雇用形態と URL は記載なし**） | 記載なし | プラン条件は確認できず | https://developers.talentio.com/ |
| 参考: Greenhouse | あり（公開求人は認証不要） | GET は不要 | あり（公開中のみ） | このページでは確認できず | 不要 | https://docs.greenhouse.io/job-board.html |
| 参考: Lever | あり | GET の例にキー無し | あり（公開中のみ） | 確認できず | 不要 | https://github.com/lever/postings-api |

求人媒体として OPINIO が加わる窓口: sonar は受付停止中、HRMOS の媒体連携は RoboRobo（オープンアソシエイツ）との協業・有料オプション（https://hrmos.co/info/news/20220801-2/）、他は**確認できず**。

### D-2. `ow_jobs` と ATS の項目の対応（HERP Hire を基準）

| OPINIO | HERP Hire | talentio |
|---|---|---|
| `title` | `name` | `name` |
| `description` | `summary` ほか | `details.defaultFields.workDetail` |
| `required_skills` / `preferred_skills` | 必須・歓迎スキル（文） | 確認できず |
| `salary_min` / `salary_max` | `salary`（形式の確認が要る） | `salary` |
| 勤務地 | `location` | `workPlaces` |
| `employment_type` | `formOfEmployment`（語彙の対応表が要る） | ❌ |
| `status` | `careerPageStatus`（published/unlisted/private）＋`isArchived` | `active` |
| `source_url` | `careerPageUrl` | ❌ |
| `source_verified_at` | `updatedAt`（取得日時で埋める） | `updatedAt` |
| 職種（`ow_job_roles`） | ❌（対応づけは OPINIO 側） | 職種（OPINIO のマスタと突き合わせが要る） |

企業情報（`ow_companies`）を取れる ATS は**確認できず**。

### D-3. 連携求人と手入力求人が重なったとき（案）
- `ow_jobs` に「出所」（例 `origin`: `manual` / `herp` / `talentio`）と ATS 側の ID を持たせる。**同じ ATS の ID は1行**。
- 上書きの向き: **ATS 由来の行は ATS が正**（OPINIO で編集させない、または編集したら連携を外す）。手入力の行は ATS で上書きしない。
- 重複の疑い（同じ会社・似たタイトル）は自動で統合せず、運営か企業に確認させる。

### D-4. 終了・非公開の即時反映
- 公式の Webhook は**どの ATS にも確認できず**。→ **定期取得で差分を見る**（ATS 側で `unlisted` / `private` / `isArchived` / `active=false` になった、または一覧から消えた → OPINIO 側を `private` に）。
- 間隔の目安と負荷: HERP は毎分100回／テナントの上限。企業数が少ないうちは1時間に1回で足りる。
- ⚠️ 取得に失敗したときに「消えた」と判定しない（取得失敗と募集終了を分ける）。

### D-5. 既存の資産で動作確認できるか
- **HERP Hire フリープラン**: 公式ヘルプの対象プランは「有料プラン」だけ。**フリープランでは API を使えない可能性が高い**（フリープランの中身自体は公式で確認できず）。
- **HRMOS（メドレーのアカウント）**: 求人を取る API が公式に無いので、**連携の動作確認には使えない**。また他社のアカウントであり、OPINIO の検証に使うべきではない。

---

## E. 運営による下書きとの関係

### E-1. 「運営が作成・企業未確認」を区別できるか
- 現状は**区別する列・状態が無い**。
  - `ow_company_field_changes`（`via='ai_paste'`）から「運営が入れた」は推定できる（2026-10-16 廃止）。
  - ただし**企業がその後に確認・上書きしたかは記録されない**（`/biz/company` の公開＝`applyDraft` は履歴に書かない）。
  - `ow_company_data_sources.source_kind` に `company_input` はあるが、実際の用例は自社の1行だけ。field の CHECK も広がっていない（pending）。
- ★「AIで埋める」は**本番列へ直接 UPDATE**する（下書きを経由しない）（2026-10-16 廃止）。

案: 項目ごとの「最新の出所」を `ow_company_data_sources` に一本化し、`source_kind` に `operator_ai`（運営がAIで作成）を足す。企業が確認・公開したら `company_input` に置き換える。表示側は「OPINIO 運営が公開情報から作成（企業未確認）」と出し分ける。
- 前提: field の CHECK を広げる（pending の migration）と、`applyDraft` が出所を書く経路を足す。

### E-2. 企業の担当者が確認・引き継ぐ画面
- 置き場所: `/biz/company`（`CompanyEditClient.tsx`）の上部に「運営が入れた項目（未確認 N件）」。
- 確認したら出所を `company_input` に、直したら通常の下書き→公開に乗せる。
- 書き込みは既存の `PATCH /api/biz/company`（`applyDraft`）に「確認だけ」の動作を足す形。

---

## 段階1（求職者の AI の読み取りのみ）の道具の候補

| 道具 | 返すもの | 呼ぶ関数 | 先に要ること |
|---|---|---|---|
| `search_companies` | 掲載企業の一覧（名前・事業・顧客の業界・規模・公開URL） | `searchCompanies` | なし（公開データ） |
| `get_company` | 企業の公開情報 | `getCompanyBySlugOrId` ＋ `filterVisibleCompaniesStrict` | キャッシュ経路 |
| `search_jobs` / `get_job` | 公開求人 | `getJobs` / `getJobBySlugOrId`（`PUBLIC_JOB_MATCH`） | なし |
| `list_people_to_talk` | 会社ごとの面談OKの人（公開してよい項目だけ） | `getPublicAmbassadorsCached` | 未ログイン向けとログイン向けの出し分けを関数に寄せる |
| `get_my_profile` | 本人のプロフィールと職歴 | ★新設（`mypage/page.tsx` から切り出す） | 切り出し |
| `get_companies_for_me` | 合う順の一覧と理由（本人だけ） | `buildForYou` | 利用者ごとの短時間キャッシュ |
| `get_my_proposals` | 届いた提案と段・自分の「話を聞いてみたい」 | ★新設（`proposalPhase` を通す） | 切り出し |
| `get_my_fit_axes` | 相性のものさし（本人だけ） | `loadFitAxes` | ポリシー改定後 |

⚠️ 「話を聞いてみたい」を押す道具は**作らない**。返すのは OPINIO の該当画面の URL まで。

---

## ★決めたこと（2026-10-15 / 柴さんの判断）

**外部接続（MCP）と ATS 連携は、今は実装しない。** 次の方針だけ決めて残す。

| 論点 | 決めたこと |
|---|---|
| 認証 | 段階1は**認証なしの公開データ**（企業・求人・面談OKの人）。**本人のデータは OAuth を想定**（本人が発行する鍵の案は採らない） |
| 企業の AI に出す求職者 | **「話を聞いてみたい」と答えた人だけ**。候補者の検索には広げない |
| ATS 連携 | **HERP Hire の有料プランの企業と取引が決まってから**着手する |
| 着手の前に | **公開範囲の判定を1か所に寄せる**（A-3 の「散っているもの」1・4。is_test / is_system / visibility の除外と、本人のプロフィール・提案一覧の取得関数） |

⚠️ OAuth は Supabase Auth が認可サーバーとして使えるかを**着手時に確かめる**（本調査では確認できず）。
