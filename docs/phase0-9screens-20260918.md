# フェーズ0調査: 根拠つきマッチング 9画面

**実測日: 2026-09-18**（DB は本番。SQL はすべて読み取りのみ。コードと migration は変更していない）

---

## 0. 先に結論

**スキーマとコードは、9画面のうち6画面ぶんが「もう書ける」状態にある。止めているのはデータで、
しかも足りないのは量ではなく種類。**

| | |
|---|---|
| ★1 | **②⑨（根拠エンジン）の根拠4本のうち、3本は SQL が書ける。返る件数が足りないだけ。** 残り1本（入社の決め手）は**書けるが実データが構造的に0**（下記 ★2） |
| ★2 | **「入社の決め手」は実ユーザーで 0件。** 全37行のうち非空は5行で、**5行とも `is_test` のアカウント**。表示経路は `is_test` を除外するので、**どの企業のページでも永久に0件**。これは「まだ埋まっていない」ではなく**入口が実質使われていない**（設問は 2026-09-12 に実装済み・[docs/reason-flow-20260912.md](reason-flow-20260912.md)） |
| ★3 | **掲載22社のうち、根拠の材料が1つでもある企業は3社。a〜c が3つとも1件以上返る企業は0社。** 在籍者2名以上の掲載企業も**0社** |
| ★4 | **`ow_transitions` は読み手が src で0件**（＝②の根拠1をそのまま載せられる空き地）。ただし**最終洗い替えが 2026-08-26 で古い**。以後13行の経歴が増えており、いま流し直すと **5 → 7行** |
| ★5 | **`/search` の「自然言語検索」に LLM は入っていない。** ルールベース（[interpretQuery.ts](../src/lib/search/interpretQuery.ts) ④）。**リポジトリに LLM の依存も API キーも無い**ので、①⑤はゼロから |
| ★6 | **⑦のテーブルはもう存在する。** `ow_post_hire_reports`（months_after 3/6/12・culture/workstyle/salary/overall の5段階・gap_from_expectation）。**読み書きするコードは0件**、0行 |
| ★7 | ★**規約と実装が食い違っている。** 求職者利用規約 第8条4項とプライバシーポリシー 5-4 は「**現在の勤務先および過去の勤務先のすべて**」を自動ブロックと書いているが、`can_send_scout()` は **`is_current` しか見ていない**。⑧（透明性と同意）は、この画面を作った瞬間にこの差を表示することになる |
| ★8 | **企業側の受け口が2社しかない。** 掲載22社のうち有効な管理者がいるのは**セールスフォースと株式会社Opinio だけ**。`notification_emails` は**0社**。⑤⑨⑥の通知は22社中20社で運営フォールバックに落ちる |

---

## A. 根拠エンジン（②⑨）

### A-0. 母集団（この節のすべての分母）

| | 件数 |
|---|---|
| `ow_users` 全体 | 48 |
| `is_test = true` | 39 |
| `is_system = true` | 1（OPINIO） |
| `auth_id IS NULL` | 2（OPINIO / 生藤 弘樹） |
| ★**実ユーザー**（`is_test=false` かつ `is_system=false` かつ `auth_id` あり） | **7** |
| ↑のうち職歴がある人 | **4** |
| `is_test=false` だけで数えた場合 | 9（うち職歴あり **5**） |
| 職歴が2社以上ある実ユーザー | **2** |
| 掲載企業（`listing_status='listed'` かつ `is_test=false`） | **22** |
| 公開求人（`status='published'` かつ `is_test=false`） | **2**（どちらもセールスフォース） |

⚠️ 除外条件は [lib/users/registered.ts](../src/lib/users/registered.ts) の `isRegisteredUser()` と
[queries.ts:1930 付近](../src/lib/supabase/queries.ts) の `isSeedRow`
（`visibility === 'private' || is_test === true || !isRegisteredUser(u)`）に揃えてある。

---

### a. ある職種・業界から、特定の企業へ移った人を数える（②根拠1／⑨根拠1）

#### 書けるか → **書ける。専用テーブルが既にある**

| | |
|---|---|
| テーブル | **`ow_transitions`**（16列・5行） |
| 結合の経路 | `ow_transitions` → `ow_users`（除外判定）／ `ow_companies`（社名）／ `ow_roles`（職種名） |
| 作る側 | `rebuild_ow_transitions()`（SECURITY DEFINER・冪等・**service_role でしか実行できない**） |
| ★読む側 | **src からの参照 0件。** 使っているのは注意書きだけ（[industryMatch.ts:18](../src/lib/companies/industryMatch.ts)、[business/page.tsx:42](../src/app/business/page.tsx)、[SeatVisual.tsx:16](../src/components/business/lp/SeatVisual.tsx)） |

```sql
select c.name to_company, t.from_industry, r.name from_role, count(distinct t.user_id) n_users
  from ow_transitions t
  join ow_users u on u.id = t.user_id
  left join ow_companies c on c.id = t.to_company_id
  left join ow_roles     r on r.id = t.from_role_category_id
 where u.is_test = false and u.is_system = false and u.auth_id is not null
 group by 1,2,3 order by n_users desc;
```

#### 実データで返る件数 → **2行。どちらも n = 1**

| to_company | from_industry | from_role | n |
|---|---|---|---|
| 伊藤忠テクノソリューションズ | IT・ソフトウェア | アカウントエグゼクティブ | **1** |
| セールスフォース・ジャパン | （自由入力のため null） | 営業 | **1** |

⚠️★**リポジトリの既存の下限は「3人」**（[runSearch.ts:111](../src/lib/search/runSearch.ts) の
`MIN_AGGREGATE_COUNT = 3`。これ未満なら件数を出さない）。
**いまの最大が n=1 なので、この規約のままでは②に数字を1つも出せない。**

⚠️★**`ow_transitions` は古い。** `built_at` が全行 **2026-08-26**、一方 `ow_experiences` の
`max(created_at)` は **2026-09-15** で、洗い替え後に**13行**増えている。
同じロジックを SELECT で再現すると **7行**（現在5行）。**cron もトリガーも無く、手動 RPC だけ。**

---

### b. 特定の企業の在籍者が挙げた「入社の決め手」を集計する（②根拠2／⑨根拠2／⑤の実態表示）

#### 書けるか → **書ける**（`ow_experiences.join_reasons text[]` を `unnest` するだけ）

| | |
|---|---|
| テーブル | `ow_experiences.join_reasons`(text[]) / `join_reason_primary`(text) / `leave_reasons`(text[]) |
| 語彙 | [lib/constants/careerReasons.ts](../src/lib/constants/careerReasons.ts)（入社12・退職13・うち11が共通スラッグ） |
| 3層のうち DB | `ow_experiences_join_reasons_check` / `..._leave_reasons_check`（配列で直書き） |
| 入口 | [ExperienceReasonModal](../src/components/profile/editor/ExperienceReasonModal.tsx)（3経路） |
| 公開可否 | `visibility_reason`(bool)。37行中 **28行が true** |

#### 実データ → **実ユーザー 0件**

| | 件数 |
|---|---|
| `join_reasons` 非空（全37行） | **5** |
| **↑のうち `is_test` のアカウント** | **5** |
| **↑のうち実ユーザー** | **0** |
| `join_reason_primary` 非NULL | **0** |
| `leave_reasons` 非空 | **0** |
| `join_reason`（旧・自由記述） | 4 |
| `ow_experience_gaps` | 1 |

⚠️★**5行のうち3行がセールスフォース**だが、`getCompanyEmployees` が `is_test` を落とすので
**画面には出ない**。＝ **「決め手」を根拠に使える企業は現時点で0社**。
これは「起こらなかった0」ではなく、**入口はあるのに実ユーザーが誰も通っていない0**。

---

### c. 特定の企業で `isTalkable()` を通る人を数える（②根拠3／③の「話す相手を選ぶ」）

#### 書けるか → **書ける**（判定は [talkable.ts:46](../src/lib/companyMembers/talkable.ts) の2条件）

① `ow_company_members` が `display_consent AND is_public`
② かつ **その企業に `is_current = true` の経歴がある**

```sql
select co.name,
       count(*) filter (where exists (
         select 1 from ow_experiences e
          where e.user_id = m.user_id and e.company_id = m.company_id and e.is_current)) as talkable
  from ow_company_members m
  join ow_users u  on u.id = m.user_id
  join ow_companies co on co.id = m.company_id
 where m.display_consent and m.is_public
 group by 1;
```

#### 実データ → **5社・各1〜2名。うち実ユーザーは4社・各1名**

| 企業 | listing_status | 公開中メンバー | talkable | うち実ユーザー |
|---|---|---|---|---|
| 伊藤忠テクノソリューションズ | listed | 1 | 1 | **1** |
| 日本ヒューレット・パッカード | listed | 1 | 1 | **1** |
| 株式会社Archi Village | **draft** | 1 | 1 | 1 |
| 海光電業 | **draft** | 1 | 1 | 1 |
| セールスフォース・ジャパン | listed | 2 | 2 | **0**（2名とも `is_test`） |

⚠️ **掲載中に限ると2社・各1名。** しかも**公開求人を持つ唯一の企業（セールスフォース）は0名**。

---

### d. 候補者の希望条件と企業の属性を突き合わせる（②⑨の並び順）

#### 書けるか → **書ける。実装が既にある**

| | |
|---|---|
| 実体 | [lib/matching/scoreJob.ts:71](../src/lib/matching/scoreJob.ts) `scoreJob()` / [:150](../src/lib/matching/scoreJob.ts) `computeRecommendations()` |
| 配点 | 職種48 / 年収30 / フェーズ24 / 勤務スタイル18 ＝ 120点満点。`MIN_SCORE = 30` / `MAX_RESULTS = 5` |
| 呼び出し元 | [GET /api/jobseeker/recommendations](../src/app/api/jobseeker/recommendations/route.ts) ／ `/api/cron/weekly-match`（停止中） |
| 出力 | **スコアは画面に出さない。`reasonText`（日本語1〜2行）を出す**（Hisato 思想⑦） |

⚠️★**これは「求人 × 希望条件」。②⑨が要る「企業 × 候補者」はまだ無い。**
`companyPhase` を渡す形なので企業側の軸（phase）は入っているが、
**事業領域・対象業界・在籍者の属性は1つも見ていない。**

#### 実データ（充填率）

**企業側（掲載22社）は埋まっている:**

| 列 | 充填 |
|---|---|
| `phase` / `industry_id` / `employee_count` / 事業領域 | **22 / 22** |
| `headquarters_address` | 21 / 22 |
| 対象業界（軸2） | **1 / 22** |
| `remote_work_status` | **1 / 22** |
| `avg_salary` | **0 / 22** |
| `accepting_casual_meetings` | **2 / 22** |

**候補者側（実ユーザー7人）は埋まっていない:**

| 項目 | 充填 |
|---|---|
| `ow_profiles` の行 | 6 / 7 |
| **希望職種**（`ow_profile_desired_roles`） | **3 / 7** |
| **希望年収** | **3 / 7** |
| **希望フェーズ** | **3 / 7** |
| **希望勤務スタイル** | **2 / 7** |
| **希望勤務地**（`desired_prefectures`） | **0 / 7** |
| `career_stance` | 5 / 7 |
| `scout_enabled = true` | 4 / 7（null 2） |
| `bio` | **0 / 7** |

⚠️ `scoreJob` は4軸すべてが空の人には理由を作れず0件を返す（それが正しい挙動）。
**希望条件を1つも持たない実ユーザーが4人いる。**

---

### A-2. 「根拠として成立する最低ライン」の実測

**掲載22社のうち:**

| 条件 | 社数 |
|---|---|
| **在籍者（表示可能）1名以上** | **2** |
| **在籍者2名以上** | **0** |
| **決め手1件以上** | **0** |
| **決め手2件以上** | **0** |
| 転職経路1件以上 | **2** |
| 話せる人1名以上 | **2** |
| ★**a・b・c が3つとも1件以上** | ★**0** |

**材料が1つでもある企業は3社だけ:**

| 企業 | 在籍 | OB | 転職経路 | 決め手 | 話せる人 | 公開求人 |
|---|---|---|---|---|---|---|
| 日本ヒューレット・パッカード | 1 | 0 | 0 | 0 | 1 | 0 |
| 伊藤忠テクノソリューションズ | 1 | 0 | 1 | 0 | 1 | 0 |
| セールスフォース・ジャパン | **0** | 1 | 1 | 0 | **0** | **2** |

⚠️★**求人がある会社には在籍者がおらず、在籍者がいる会社には求人が無い。**
②を求人起点で出そうとすると、いま出せる企業は**0社**。

**職歴が2社以上ある実ユーザー: 2人**（＝「あなたと同じ道を通った」と言える起点が2人しかない）

---

### A-3. 反証（都合の悪い事実）

| 反証 | 取れるか | 実測 |
|---|---|---|
| **在籍者の年齢分布** | ⚠️ **ほぼ取れない** | 実ユーザーで `birth_date` があるのは **3/7**。掲載企業の在籍者2人のうち生年月日があるのは**1人**。＝ 分布として出せない |
| **短期離職者の有無 / 在籍期間** | ✅ **取れる** | `started_at` は NOT NULL。`ended_at` がある行は全体14 / 実ユーザー**7**。うち**在籍1年未満は2行** |
| **求人の提示年収 vs 候補者の現年収** | ❌ **現年収は取れない** | 公開求人2件とも `salary_min` あり。だが `ow_experiences.salary_man` は**実ユーザー0件**（2026-08-06 に入力UIを撤去し `authenticated` の SELECT も剥奪済み）。**比較できるのは「希望年収」だけで、それも 3/7** |
| **勤務形態の突き合わせ** | ⚠️ **片側しか無い** | 求人側は2/2件あり。**企業側は 1/22社**、**職歴側は実ユーザー1件**、**候補者の希望は 2/7**。＝ 3者が揃う組が作れない |

⚠️★**モックの「根拠と並べて必ず1件出す」を今のデータで満たせるのは、在籍期間（短期離職）だけ。**
年齢・年収・勤務形態は**「取れない」と書くのが正しい**。
⚠️ 年齢を反証に使う場合、`/biz` 側に出すのは**年齢での絞り込みを企業に渡さない**という
既存方針（労働施策総合推進法9条・CLAUDE.md「年齢は詳細だけ」）と衝突する。**論点。**

---

## B. 提案と双方合意の記録先（③④⑨）

### B-1. 応募・面談のスキーマと状態遷移

| テーブル | 行数 | status の語彙 |
|---|---|---|
| **`ow_job_applications`**（25列・実使用） | **0** | `pending` / `reviewing` / `interview` / `accepted` / `rejected` / `hired` |
| `ow_applications`（12列・**旧**） | 0 | CHECK なし。`first_round_at` / `second_round_at` / `offer_at` / `rejected_at` を持つ |
| **`ow_casual_meetings`**（19列） | **0** | `pending` / `company_contacted` / `scheduling` / `scheduled` / `completed` / `declined` |
| `ow_scouts`（13列） | **0** | `sent` / `read` / `interested` / `declined` |
| `ow_threads`（旧） | 0 | — |

`ow_casual_meetings` の `intent`: `info_gathering` / `good_opportunity` / `within_6` / `within_3`。
**個人指名は `requested_user_id`**（API 側で「その企業に在籍中 かつ 掲載中の面談対応者」を検証）。

### B-2. 「企業が候補者を見て会いたいと答える」＝ スカウト

実装は揃っている（送信 `POST /api/biz/scouts` / 受信 `/mypage/scouts` / 通知 `ow_notifications.type='scout'` / メール）。
**止まっているゲートは3つで、いま開いていないのは3つとも:**

| # | ゲート | 現状 |
|---|---|---|
| ① | `isScoutSendingEnabled()`（`SCOUT_SENDING_ENABLED`） | **未設定 → 503** |
| ② | `canSendScout(planType)`（[scoutGate.ts:33](../src/lib/business/scoutGate.ts)） | **有料プラン0社**（`ow_company_plans` 89行が**全部 `free`/`active`**） |
| ③ | `can_send_scout(company, candidate)`（DB関数） | career_stance 未設定/`no_contact` を落とす |

**③を通る候補者母集団は 4人**（`career_stance` が `active` / `open` / `researching`）。
**うち職歴がある人は 2人。**

### B-3. 匿名で候補者を企業に見せる経路 → **無い**

[/biz/candidates/page.tsx:393](../src/app/biz/candidates/page.tsx) は
`name: (u.name as string) || "名前未設定"` で**実名をそのまま出す**。
匿名化・伏せ字の分岐は無い。

**出し分けを制御しているのは3つ:**

| 何 | どこ |
|---|---|
| `ow_users.visibility`（`login_only` / `private`） | 実データは **login_only 47 / private 1**。`public` は0人 |
| `ow_experiences.visibility_company`（`real`/`masked`/`hidden`） | ★**設定UIは 2026-09-15 に畳んだ**。実データは **37行すべて `real`** |
| `ow_company_hidden_experiences`（企業が個別に隠す） | **0行** |

⚠️★**指示にあった「可視性2列の食い違い」は、もう解消している。**
`visibility_company_profile` は 2026-09-11 に【廃止】列になり
（[timeline.ts:126](../src/lib/utils/timeline.ts)）、
**実測でも 37行すべて2列が一致、食い違い0行。**

### B-4. 見送り理由を記録する場所 → ★**無い**

全テーブルの `reason|decline|reject|feedback|memo|note` 系の列を洗った結果:

| 近いもの | 実際は |
|---|---|
| `ow_scouts.status = 'declined'` | **理由の列が無い**（status だけ） |
| `ow_job_applications.status = 'rejected'` | 理由の列が無い。`memo` は**企業の内部メモ** |
| `ow_casual_meetings.status = 'declined'` | 理由の列が無い。`company_internal_memo` は同上 |
| `ow_jobs.rejection_reason` | ★**運営が求人を差し戻す理由**。候補者の見送りではない |
| `ow_placements.resignation_reason` | 入社後の退職理由（`voluntary`/`company`/`other`） |
| `ow_experiences.leave_reasons` | 本人の退職理由。**実データ0行** |

→ **④（反応の学習ループ）が読む先は、いまどこにも無い。新設が要る。**

### B-5. 「提案」という単位のテーブル → ★**存在する。ただし死んでいる**

| テーブル | 列 | 行 | src からの参照 |
|---|---|---|---|
| **`ow_matches`** | `user_id, company_id, job_id, match_score, match_reasons[], viewed_by_company, created_at` | **0** | ★**types.ts のみ = 0件** |
| `ow_match_scores` | `user_id, company_id, overall/culture/skill/career/workstyle_score, match_reasons[]` | **0** | 注意書きのみ（「書き込む主体が最初から存在しない」） |

⚠️ `ow_matches` は **`viewed_by_company` を持っており、③の片側（企業が見た）だけは表現できる形**。
ただし「候補者が興味あり」を入れる列は無い。

#### ③のステッパーに要る状態の数

モックの4段（興味あり → 会いたい → 開示 → 話す相手）を**双方向**で表すと:

| 誰が | 段 | 必要な状態 |
|---|---|---|
| 求職者 | 興味あり / 会いたい / 見送り | 3 |
| 企業 | 興味あり / 会いたい / 見送り | 3 |
| 合意後 | 開示済み / 相手を選んだ / 面談成立 | 3 |

→ ★**最小で「両側の意思 2列 × 3値」＋「合流後の段 1列 × 3値」＝ 状態は 3×3×3 だが、
実装としては `proposer_intent` / `candidate_intent` / `stage` の3列で足りる。**
`ow_scouts.status`（4値・片方向）では表せない。

---

## C. 会話の保存先（①⑤）

### C-1. `ow_conversations` 系の全列と行数

| テーブル | 列 | 行 |
|---|---|---|
| `ow_conversations` | `id, kind, stage, company_id, mentor_user_id, candidate_user_id, status, last_message_at, created_at` | **3** |
| `ow_conversation_participants` | `id, conversation_id, user_id, role, joined_at, left_at, last_read_at` | **3** |
| `ow_conversation_messages` | `id, conversation_id, sender_participant_id, body, sent_at, edited_at, deleted_at` | **0** |

実データの内訳: `direct_message/active/active` 2件、`company/active/active` 1件。

### C-2. 「相手が人であること」を前提にした制約 → ★**ある。4つ**

| # | 制約 | 中身 |
|---|---|---|
| ① | `candidate_user_id` **NOT NULL** | 会話は必ず求職者1人に紐づく |
| ② | `ow_conversations_kind_check` | `company` / `mentor` / `editor` / `direct_message` の4値 |
| ③ | `ow_conversations_kind_consistency` | `company`→`company_id` 必須 ／ `mentor`・`direct_message`→**`mentor_user_id`（FK: ow_users）必須** ／ `editor`→**両方 NULL** |
| ④ | `ow_conversation_participants_role_check` | `candidate` / `company_admin` / `mentor` / `editor` / `operator` の5値 |

**同居できるか:**

- ✅ `kind='editor'`（`stage='active'`）は**両方 NULL が許される**ので、構造上は AI 会話を入れられる。
- ✅ `participants.user_id` は **nullable**（FK `ON DELETE SET NULL`）なので、AI を「相手のいない参加者」として置ける。
- ✅ `messages.sender_participant_id` も **nullable**。
- ❌ ただし `role` に `assistant` / `ai` が無く、**`editor`（編集部＝人）を AI の意味で使い回すことになる。**
- ❌ RLS の INSERT は**発言者が自分の participant であること**を要求するので、**AI の発言は service_role でしか書けない。**
- ❌ `body` の CHECK は 1〜8000字。**LLM の長い応答は入らないことがある。**

→ ★**論点: 同居させる（`kind='ai'` と `role='assistant'` を CHECK に足す）か、新設するか。**
`kind` を増やすと `kind_consistency` と `stage_consistency` の2つも同時に広げる必要がある
（＝ CLAUDE.md「UI / API / DB の CHECK を3つ揃える」の対象）。**ここでは決めない。**

### C-3. `/search` の自然言語検索 → ★**LLM を呼んでいない**

| | |
|---|---|
| 実体 | [lib/search/interpretQuery.ts](../src/lib/search/interpretQuery.ts)（828行）＋ [runSearch.ts](../src/lib/search/runSearch.ts)（755行） |
| 方式 | **ルールベース。** 正規化 → `KIND_MARKERS` で主対象を決める → マスタ（`ow_roles` + `ow_role_aliases` 260行 / `ow_business_domains` / `ow_companies` / `ow_skills` / `ow_languages`）へ**完全一致で解決** |
| 解決先 | 職種・事業領域・外資/日系・年収・社名・スキル・言語の7つだけ |
| 明示 | ファイル冒頭 ④「**LLM はまだ入れていない。** ここはルールベースだが、**戻り値の形（`InterpretResult`）を変えなければ中身だけ差し替えられる**」 |
| ログ | `ow_search_logs`（`query, primary_kind, conditions jsonb, unresolved[], result_count, user_id`）**44行** |

**モデル・APIキー・レート制限・タイムアウト・ストリーミング:**

| 問い | 答え |
|---|---|
| どのモデルをどこから呼んでいるか | ★**呼んでいない。** `package.json` に LLM の依存は**0件**（`anthropic` / `openai` / `ai` / `langchain` いずれも無し） |
| APIキーの管理 | ★**`.env.local` に LLM のキーが無い**（Supabase / Resend / Sentry / Cron のみ） |
| レート制限 | [lib/rateLimit.ts](../src/lib/rateLimit.ts) は**ある**（Upstash Redis、無ければプロセス内メモリにフォールバック）。使っているのは **5ルートだけ**（`business/contact` / `jobseeker/posts` / `dm/start` / `applications` / `casual-meetings`）。★**`/search` は対象外** |
| タイムアウト・失敗時の扱い | LLM が無いので該当なし。既存の方針は「`error` を握り潰さず `console.error`、画面は空で続行」 |
| ストリーミング応答 | ★**実装なし** |

⚠️★**`interpretQuery` の約束①②は、LLM を入れるときにそのまま効く制約。**
「**LLM の出力もマスタに解決してから条件にする**」（④）。
**入力文字列を DB のパターン照合に渡さない**という規約の根拠は実測済みの事故
（`'東京都' LIKE '%京都%'` が true で、掲載79社の全件が「京都の企業」として返った）。

### C-4. ①の出力先（`ow_profiles` の希望条件）

全26列のうち希望条件は `desired_salary_min` / `desired_salary_max` / `desired_work_style`(旧・単数) /
`desired_work_styles`(配列) / `desired_phase`(配列) / `desired_prefectures`(配列) /
`transfer_timing` / `career_stance` / `worry` / `bio` / `job_type` / `experience_years` / `location`。
希望職種だけ別表 `ow_profile_desired_roles`（`user_id`=**auth 空間** / `role_id` / `is_primary`、15行）。

充填率は **A-d** の表のとおり（希望職種・年収・フェーズが各3/7、勤務地0/7、bio 0/7）。

⚠️ `worry`（「いまの悩み」）は **3/7 人に値があるのに、読む画面が1つも無い**
（受け口も入力欄も 2026-08-17 に撤去済み。列とデータだけ残っている）。
**①が最初に書き戻す先の候補だが、「入力させたのに保存しない／保存したのに読まない」の
現存例なので、使うなら読み手とセットで。**

---

## D. 企業側（⑤⑨）

### D-1. `ow_jobs` の要件 → **構造化されている（配列）。ただし中身は自由記述**

| 列 | 型 | 位置づけ |
|---|---|---|
| `required_skills` | **text[]** | 企業が書く（正） |
| `preferred_skills` | **text[]** | 同上 |
| `selection_steps` | **text[]** | 同上 |
| `requirements` / `preferred` / `selection_process` / `description_markdown` | text / jsonb | ★**【廃止】列**（2026-08-26 に統合済み。読み書きしない） |
| `role_category_id` + `ow_job_roles` | uuid | ★**唯一マスタに解決されている軸** |
| `ow_job_requirements`（別表・5列） | — | **0行 / src 参照0件** |
| `ow_job_matching_tags`（別表・4列） | — | **0行 / src 参照0件** |

⚠️★**配列にはなっているが、要素は自由記述の文字列で `ow_skills` の ID に解決されていない。**
`interpretQuery` の注記がそのまま該当する ——「求人の `required_skills` は自由記述で、
標準スキルの ID と突き合わせられない」。
→ **⑨で「要件 × 候補者のスキル」を突き合わせるには、職種（`ow_job_roles`）しか使えない。**

### D-2. 公開求人の実数と要件の充填 → **2件。どちらも埋まっている**

| 求人 | required | preferred | steps | role | 年収 | 勤務形態 |
|---|---|---|---|---|---|---|
| Account Executive, MuleSoft | 4 | 6 | 6 | ✅ | 900〜1800万 | hybrid |
| Account Solution Engineer, Tableau | 7 | 7 | 6 | ✅ | 800〜1300万 | hybrid |

（`ow_jobs` 全23行 = published 2 / private 3 / draft 18。2件ともセールスフォース）

### D-3. 「この条件に合う候補者が何名」 → ★**ある。クライアント側の絞り込み**

[/biz/candidates](../src/app/biz/candidates/) が「**N件 / 全M件**」の件数バーを持つ
（[CandidatesClient.tsx:714-718](../src/app/biz/candidates/CandidatesClient.tsx)）。
絞り込みは希望勤務スタイル・希望勤務地・希望年収・**社会人年数**（★年齢ではない）。

⚠️ サーバーから**全件を渡してクライアントで絞る**形。母集団が小さいうちは問題ないが、
⑤の「8名 → 34名」のようにリアルタイムに数を動かす用途には**そのまま使える。**

**母集団の実測: 4人**（`career_stance` が設定済みかつ `no_contact` でない実ユーザー。うち職歴あり **2人**）。

### D-4. 企業アカウントと通知の宛先 → ★**掲載22社中 2社**

| | 社数 |
|---|---|
| 掲載企業 | **22** |
| 管理者行がある | **2** |
| **有効な管理者（`is_active`）がいる** | **2** |
| **`notification_emails` が設定済み** | ★**0** |
| **宛先が1件以上** | **2** |

**該当2社: 株式会社セールスフォース・ジャパン（2名）／ 株式会社Opinio（2名）。**

（`ow_company_admins` 全体: 15行 / 有効14行 / 有効な管理者がいる企業は**全体でも10社**、
うち8社は `listing_status='draft'` か `is_test`）

⚠️★**②⑨⑥の通知は、22社中20社で企業に届かない。** 運営フォールバック（`ADMIN_EMAIL`）に落ちる。
既存の記録（CLAUDE.md「掲載中の面談対応者を持つ5社のうち4社が通知の宛先0件」）と同じ形で、
**⑤⑨を作ると同じ壁に当たる。**

---

## E. 同意・規約（⑧）

### E-1. `ow_terms_agreements` → ★**企業向けだけ。求職者の同意は記録されていない**

| 列 | `id, user_id, company_id, terms_type, terms_version, agreed_at, ip_address, user_agent` |
|---|---|
| 行数 | **2** |
| 内訳 | `business/2026-08-01` 1件、`listing/2026-08-21` 1件（**どちらも company_id つき**） |
| `terms_type` の語彙 | `listing` / `placement` / `business`（旧）— [lib/constants/terms.ts:18](../src/lib/constants/terms.ts) |
| 書く経路 | **`/api/biz/terms-agreement` のみ**（grep で確認。`/api/jobseeker/*` からの INSERT は0件） |

→ ★**求職者側の同意をカバーしているものは、この表には存在しない。**
求職者利用規約への同意は**登録行為そのものに含意させている**形で、記録が残っていない。
⑧が「あなたは○年○月○日にこれに同意しました」と出すには、**新しい記録が要る。**

⚠️ [terms.ts:38](../src/lib/constants/terms.ts) の既知の穴もそのまま:
`hasAgreedTerms` は `terms_type` しか見ず**版を見ない**／`TERMS_VERSION` は**1本しか持てない**
（`listing` と `placement` が別々に改定されると表せない）。

### E-2. 規約に AI の利用目的が書かれているか → ★**書かれていない**

`content/legal/privacy-policy.md` と `terms-of-service-jobseeker.md` を全文検索した結果:

| 語 | 該当 |
|---|---|
| AI / 人工知能 / 機械学習 / プロファイリング | ★**0件** |
| 「利用目的」（第4条） | 8項「本サービスの改善、新機能の開発および利用状況の分析」まで。**AI への入力は含意されていない** |
| **7-1. 委託先および利用する外部サービス** | **Supabase / Vercel / Resend / Sentry の4社のみ**。サーバー所在地まで明記 |

⚠️★**LLM を入れると、この表に事業者を1行足すことになる。**
しかも同じ節に「**当社は、Google Analyticsその他の外部のアクセス解析ツールを一切利用していません**」
「**閲覧履歴を追跡しません**」と**強い約束**が並んでおり、①⑤の会話ログはこの文脈に真っ向から新しい
データ種別を持ち込む。**規約改定は実装より先。**

### E-3. ★規約と実装の食い違い（⑧が最初に表示することになる）

**求職者利用規約 第8条4項 と プライバシーポリシー 5-4:**

> ユーザーが職務経歴として登録した企業（**現在の勤務先および過去の勤務先のすべて**）は、
> 自動的にスカウトの送信対象から除外されます。

**実装（`can_send_scout()` の条件2・2b）は `e.is_current` しか見ていない。**

```sql
and not exists (
  select 1 from ow_experiences e join ow_users u on u.id = e.user_id
   where u.auth_id = p_candidate_id and e.is_current and e.company_id = p_company_id)
```

→ ★**過去の勤務先はブロックされていない。**

| | 件数 |
|---|---|
| 実ユーザーの「過去の勤務先」ペア | **5** |
| 対象企業 | 5社 |
| **うち掲載中** | **1社** |
| `ow_scout_blocks`（手動ブロック） | **0行** |

⚠️ いま実害が出ていないのは**スカウトが3重に止まっているから**（B-2）。
**「起きなかった0」ではなく「起こせなかった0」。** 開けた日に規約違反になる。

### E-4. 自分のデータを確認・削除する導線 → ⚠️ **確認はできる。削除・エクスポートは無い**

| | 実装 |
|---|---|
| 確認 | `/mypage`・`/mypage/settings`（`AccountSettings` / `BasicInfoSettings` / `PrivacySettings`）・`/u/[id]` |
| **アカウント削除** | ★**見つからない**（`退会` / `deleteAccount` / `delete-account` の grep が0件） |
| **エクスポート** | ★**無い** |
| 参考 | プライバシーポリシー 第10条に開示・利用停止・**第三者提供記録の開示**の権利が列挙されているが、**画面の導線は無い**（窓口対応の想定） |

### E-5. 「企業に渡る情報」と「提案にだけ使う情報」を分けられるか → ★**分けられない**

いま可視性を持っているのは**`ow_experiences` の3列だけ**:
`visibility_company`(real/masked/hidden) / `visibility_salary`(bool) / `visibility_reason`(bool)。

`ow_profiles` には可視性の列が**1つも無い**。にもかかわらず:

- `career_stance` は**企業に見えている**（`/biz/candidates` の `isActivelyLooking`）
- `worry` は**誰にも見えていない**（読み手0件）
- `desired_*` は `/biz/candidates` の絞り込みに使われている

→ ★**「同じテーブルに混在していて、出し分けは画面ごとの個別実装」という、指示が懸念していた形そのもの。**
①の会話ログを `ow_profiles` に足すと、**⑧の画面が嘘になる。**
**論点: 会話ログは別テーブルに置き、`ow_profiles` へは「本人が確認して確定させた結論」だけを
書き戻す形にするか。ここでは決めない。**

---

## F. ⑥⑦ の接続点

### ⑥ すり合わせメモ: 面談の日程と参加者を持つテーブル → ⚠️ **実質無い**

| テーブル | 日程 | 参加者 | 行 | src 参照 |
|---|---|---|---|---|
| **`ow_casual_meetings`** | ★**無い**（`preferred_format` だけ） | `user_id` / `company_id` / `assignee_user_id` / **`requested_user_id`**（指名） | **0** | あり（実使用） |
| `ow_mentor_reservations` | **`preferred_days[]` / `preferred_times[]` / `scheduled_at`** | `user_id` / `ambassador_user_id` | 0 | ★**0件**（メンター機能自体が無い） |
| `ow_meeting_feedbacks` | — | `meeting_id` / `user_id` / `rating`(1-5) / `comment` / `helpful_tags[]` | 0 | ★**0件** |

→ ★**日程を持つ列があるのは、死んでいる `ow_mentor_reservations` だけ。**
`ow_casual_meetings` は `status` に `scheduling` / `scheduled` を持つのに、**日時を入れる列が無い。**
⑥には最低でも「日時」と「両者が見られるメモ」の置き場が要る。

⚠️ `ow_meeting_feedbacks` は**⑥の片側（面談後の評価）にそのまま使える形**だが、
`rating`(1-5) は**「マッチ度%・星評価を出さない」という Hisato 思想⑦と衝突する。** 論点。

### ⑦ 入社後サーベイ: 入社を記録する場所 → ★**2つある**

| | |
|---|---|
| `ow_experiences.is_current` | **本人の自己申告。** 更新漏れがありうる（CLAUDE.md 思想6 がまさにその話） |
| ★**`ow_placements`**（17列・**0行**） | `candidate_id, company_id, job_id, **joined_at**, channel(platform/agent), annual_salary, previous_annual_salary, previous_role_id, current_role_id, previous_industry, years_of_experience, resigned_at, resignation_reason, fee_amount` |
| 書く経路 | **`/admin/placements`（運営が手入力）**。[actions.ts:9](../src/app/admin/placements/actions.ts) に insert / update / delete |
| 読む経路 | `/admin/placements` と **`/biz/candidates`（転職勧奨の禁止期間の判定）** |

★**⑦のテーブルは既に存在する: `ow_post_hire_reports`（14列・0行）**

```
user_id | company_id | months_after (CHECK: 3 / 6 / 12)
culture_match | workstyle_match | salary_match | overall_satisfaction  (各 CHECK: 1〜5)
good_points | concerns | gap_from_expectation | would_recommend | is_published
```

⚠️★**src からの参照は types.ts のみ = 読み書きするコードは0件。**
つまり**⑦は「テーブルを作る」ではなく「配線する」作業**。
⚠️ ただし**1〜5の5段階は Hisato 思想⑦（数値データ撤廃）と衝突する。**
設計当時の想定が今の方針と合っていない。**論点。**

---

## G. 権限とRLS

### G-1. 新しい保存先を足すときに、既存の構造でそのまま安全か → ⚠️ **条件つきで安全**

| 項目 | 現状 |
|---|---|
| 新しいテーブルを足す手順が CLAUDE.md にあるか | ✅ **ある。**「新しいテーブルには GRANT を必ず書く（既定では anon も authenticated も権限が付かない）」／「『誰にも読ませない』は GRANT で、『誰に読ませるか』は RLS で」／「anon は revoke / authenticated は grant / RLS で絞る」 |
| 手本になる形 | **`ow_transitions`**（RLS 有効・**ポリシー0本**・anon/authenticated に GRANT 無し・admin クライアントだけが読む）。会話ログ・転職理由・年収希望はこの形が素直 |
| 落とし穴 | ★**RLS で弾かれると 200 + 0件**（403 ではない）。`?? []` で受けると「データが無い」に化ける。**空の表では実測で遮断を証明できない**ので、ポリシーを `polroles` まで含めて読むこと |

### G-2. `USING(true)` + anon SELECT のテーブル → **13表**（2026-09-18 実測）

```
ow_articles / ow_company_culture_tags / ow_company_office_photos / ow_company_segments /
ow_company_tools / ow_job_matching_tags / ow_job_requirements / ow_job_roles /
ow_languages / ow_role_aliases / ow_roles / ow_skills / ow_tool_masters
```

⚠️ CLAUDE.md は **14表**（2026-08-27 実測）と書いている。**1表減っている**が、
どれが閉じられたかまでは追っていない。**すべてマスタ系で、個人情報を持つ表は入っていない。**

### G-3. 列単位 GRANT の現状（2026-09-18 実測）

| テーブル | 列数 | anon SELECT | auth SELECT | auth UPDATE | テーブルレベル SELECT / UPDATE |
|---|---|---|---|---|---|
| `ow_users` | 39 | **22** | **29** | **33** | ❌ / ❌ |
| `ow_experiences` | 37 | **21** | **28** | 37 | ❌ / ✅ |
| `ow_career_profiles` | 9 | **5** | **7** | 9 | ❌ / ✅ |
| `ow_company_members` | 15 | **11** | **12** | 15 | ❌ / ✅ |
| `ow_companies` | 153 | 153 | 153 | **147** | ✅ / ❌ |
| `ow_profiles` | 26 | 26 | 26 | 26 | ✅ / ✅ |
| `ow_conversations` | 9 | 0 | 9 | 9 | ✅ / ✅ |
| `ow_conversation_messages` | 7 | 0 | 7 | 7 | ✅ / ✅ |

⚠️ CLAUDE.md（2026-09-15 実測）の `ow_users` **29/38** に対し、いまは **29/39**（分母が1増えた）。
`ow_experiences` 28/37 / `ow_career_profiles` 7/9 / `ow_company_members` 12/15 は一致。

**列を足す必要が出る機能:**

| 機能 | 足す先 | 列単位 GRANT が要るか |
|---|---|---|
| ① 会話ログ | **新テーブル** | 不要（`ow_transitions` 型なら GRANT を配らない） |
| ①→ 希望条件の書き戻し | `ow_profiles` | ★**不要**（テーブルレベル。列を足せばそのまま読み書きできる） |
| ④ 見送り理由 | **新テーブル or `ow_scouts`** | `ow_scouts` は admin 経由なので不要 |
| ⑧ 同意の記録（求職者） | `ow_terms_agreements` | 現状 admin 経由のみ |
| ⑦ サーベイ | `ow_post_hire_reports`（既存） | RLS/GRANT を**新規に設計**（いま誰も読んでいない） |
| ★**本人の属性を増やす場合** | **`ow_users`** | ★**要る。`grant select (列名)` と `grant update (列名)` を同じ migration に書く** |
| ★**面談対応者に項目を増やす場合** | **`ow_company_members`** | ★**要る。`grant select (列名) ... to anon, authenticated`** |

⚠️★**`ow_companies` は UPDATE が列単位。** ⑤で企業側の要件を保存する列を足すなら、
**その列の `grant update` を同じ migration に書かないと、PATCH 全体が 403 になる。**

### G-4. 既知の不具合2件 → ★**どちらも既に直っている（CLAUDE.md が古い）**

| # | CLAUDE.md の記述 | 実測（2026-09-18） |
|---|---|---|
| ① | 「`/api/biz/ambassador/self-register` は CHECK 制約で必ず 500」 | ★**直っている。** [route.ts:91-97](../src/app/api/biz/ambassador/self-register/route.ts) は `display_consent: true, is_public: true` を入れる。修正コミットは **`330f6d20` fix(biz): 「自分も面談対応者になる」が必ず 500 になっていたのを直す**。コード内に経緯のコメントも残っている |
| ② | 「`guard_member_consent` は `auth.uid()` と `ow_users.id` を比べていて本人を弾く」 | ★**直っている。** 本番の関数定義は **`public.auth_ow_user_id()`** と比較しており、空間が揃っている。`service_role` の素通しと admin 例外も入っている |

⚠️★**「この2件はセットで直す必要がある」という記録も、もう有効でない。**
**CLAUDE.md の該当2節（「★実例:」で始まる2つ）は、実態と食い違ったまま残っている。**

---

## 2. 9画面ごとの三分類

### ① キャリアAI（会話でのヒアリング）

| | |
|---|---|
| **既にあるもの** | 会話の器（`ow_conversations` 系・RLS 完備）／ レート制限の仕組み（[rateLimit.ts](../src/lib/rateLimit.ts)）／ 出力先の列（`ow_profiles` の `desired_*`）／ `ow_search_logs`(44行) という「解釈した条件を jsonb で残す」前例 |
| **足りないもの** | ★**LLM そのもの**（依存もキーもゼロ）／ ストリーミング／ AI 会話を表せる `kind`・`role` の語彙／ `body` の 8000字上限／ プライバシーポリシーの委託先と利用目的 |
| **判断が要る論点** | (a) `ow_conversations` に同居させるか新設か（`kind_consistency` / `stage_consistency` / `role_check` の3つを同時に広げることになる） (b) 会話ログを `ow_profiles` と**同じ表に置かない**か（⑧が嘘になる） (c) 委託先が増えることの規約改定 (d) `worry` という「読み手のない既存列」を使うか捨てるか |

### ② 根拠つきのフィット提案

| | |
|---|---|
| **既にあるもの** | ★**根拠1の専用テーブル `ow_transitions`（読み手0件＝空き地）**／ 根拠3の判定 `isTalkable()`／ 並び順の `scoreJob()`／ 最も近い既存画面 [industryMatch.ts](../src/lib/companies/industryMatch.ts)（「◯◯の経験が活きる会社」） |
| **足りないもの** | ★**データ。** 根拠1は最大 n=1（既存の下限は3）／ 根拠2は実ユーザー0件／ a〜c が揃う企業は0社／ `ow_transitions` の自動洗い替え |
| **判断が要る論点** | (a) `MIN_AGGREGATE_COUNT = 3` を②でも守るか（守ると今日は何も出ない） (b) 出せる根拠が1本しか無いとき「根拠つき」と名乗るか (c) `ow_transitions` の洗い替えを cron にするか |

### ③ 双方合意の紹介フロー

| | |
|---|---|
| **既にあるもの** | スカウトの往復一式（送信・受信・通知・メール・返答）／ `ow_casual_meetings` の6段 status と**個人指名 `requested_user_id`**（API 側で在籍と掲載を検証）／ `ow_matches.viewed_by_company`（片側だけ） |
| **足りないもの** | ★**「提案」の単位。** `ow_scouts.status` は4値・片方向で、双方の意思を表せない／ 段階的開示の状態 |
| **判断が要る論点** | (a) 死んでいる `ow_matches` を起こすか新設するか (b) 最小の状態は `proposer_intent` / `candidate_intent` / `stage` の3列で足りるか (c) ★**スカウト解禁の3ゲートより先に③を作るか後にするか**（有料プラン0社・規約改定日 2026-09-27） |

### ④ 反応の学習ループ

| | |
|---|---|
| **既にあるもの** | `ow_search_logs`（条件と result_count を残す前例）／ `ow_scouts.status='declined'` という「見送った事実」 |
| **足りないもの** | ★**見送り理由の置き場が全テーブルに無い**（B-4）／ 学習の対象になる母数（スカウト0件・応募0件・面談0件） |
| **判断が要る論点** | (a) ★**そもそも今は学習するイベントが1件も無い。**④は③が動いてからでないと空回りする (b) 見送り理由を選択肢にするなら、`careerReasons.ts` と同じ「3層（UI/API/CHECK）を揃える」の対象になる |

### ⑤ 要件ヒアリングと、在籍者の実態とのズレ

| | |
|---|---|
| **既にあるもの** | ★**件数バー「N件 / 全M件」が `/biz/candidates` に既にある**（⑤の「8名→34名」はこの形）／ 求人の要件が配列で構造化済み／ `ow_company_departments`(29行) `ow_company_employee_categories`(5行) |
| **足りないもの** | ★**候補者母集団が4人**（職歴ありは2人）／ 要件の要素が `ow_skills` に解決されていない（突き合わせられるのは職種だけ）／ 企業側の会話の器 |
| **判断が要る論点** | (a) ★**「在籍者の実態」を出せる掲載企業は2社（各1名）。1名を「実態」と呼ぶか** (b) 要件をマスタに解決させる（＝企業の入力を選択式にする）か、自由記述のまま LLM に解決させるか |

### ⑥ 面談前のすり合わせメモ

| | |
|---|---|
| **既にあるもの** | `ow_casual_meetings`（`intent` / `interest_reason` / `questions` / `assignee_user_id` / `conversation_id`）／ `ow_meeting_feedbacks`(0行・参照0件) |
| **足りないもの** | ★**日時の列**（`scheduling` / `scheduled` という status はあるのに日時が入らない）／ 両者が見られるメモの置き場／ **通知が届く企業が2社しかない** |
| **判断が要る論点** | (a) `ow_meeting_feedbacks` の `rating`(1-5) は**思想⑦（数値データ撤廃）と衝突する**。起こすか捨てるか (b) 日程調整を自前で持つか外部カレンダーに逃がすか |

### ⑦ 入社後の納得度サーベイ

| | |
|---|---|
| **既にあるもの** | ★**`ow_post_hire_reports` が設計どおりの形で既に存在**（3/6/12か月・4軸・`gap_from_expectation` / `would_recommend` / `is_published`）／ 入社の記録 `ow_placements`（`/admin/placements` から手入力できる） |
| **足りないもの** | ★**配線が丸ごと**（読み書き0件）／ 入社の実データ0件／ 送信のきっかけ（cron は**全部止まっている**: `vercel.json` の `crons` が空） |
| **判断が要る論点** | (a) ★**1〜5の5段階は思想⑦と衝突する。**テーブルの設計当時の想定が今の方針と合っていない (b) 入社の正を `ow_placements`（運営入力）にするか `is_current`（自己申告）にするか (c) `is_published` があるので**公開前提の設計**だが、誰に見せるか未定 |

### ⑧ 透明性と同意

| | |
|---|---|
| **既にあるもの** | `ow_terms_agreements` の器（ip_address / user_agent まで持つ）／ `ow_experiences` の可視性3列／ プライバシーポリシーが**かなり踏み込んで書かれている**（委託先のサーバー所在地まで） |
| **足りないもの** | ★**求職者側の同意記録が0件**（書く経路が `/api/biz/*` だけ）／ **AI の記述が規約に一切ない**／ アカウント削除・エクスポートの導線／ **「企業に渡る情報」と「提案にだけ使う情報」を分ける構造** |
| **判断が要る論点** | (a) ★★**規約と実装の食い違い（E-3）をどう扱うか。**「過去の勤務先もブロック」と書いてあるのに `is_current` しか見ていない。⑧は**この差を画面に出すことになる**。実装を規約に合わせる／規約を実装に合わせる／⑧では触れない、の3択 (b) `TERMS_VERSION` が1本しか持てない問題（`listing` と `placement` を別々に改定できない） (c) 同意の粒度（AI 会話・提案への利用・企業への開示を別々に取るか） |

### ⑨ 候補者への提案（②の裏返し）

| | |
|---|---|
| **既にあるもの** | ②と同じクエリ／ `/biz/candidates` の一覧と絞り込み／ `can_send_scout()` の4条件 |
| **足りないもの** | ★**母集団4人**／ ②と同じくデータ／ 匿名表示の経路（今は実名のみ） |
| **判断が要る論点** | (a) ★**匿名で見せるか。**今は `name` をそのまま出しており、匿名化の分岐が1つも無い (b) 反証（A-3）に年齢を使うと、**年齢での絞り込みを企業に渡さない**既存方針と衝突する |

---

## 3. 実装順の提案（依存関係つき）

```
     ┌──────────────────────────────────────────────┐
     │ 第0段: データが無いと何も検証できない          │
     └──────────────────────────────────────────────┘
        0-a  ow_transitions の洗い替えを自動化する（cron / RPC）
        0-b  「入社の決め手」を実ユーザーが答える状態にする
        0-c  企業アカウントを掲載22社に増やす（いま2社）
                    │
                    ▼
     ┌──────────────────────────────────────────────┐
     │ 第1段: ⑧（規約と同意）── ①より先              │
     └──────────────────────────────────────────────┘
        1-a  規約と実装の食い違い（E-3）を解消する
        1-b  求職者の同意を ow_terms_agreements に記録する
        1-c  AI の利用目的と委託先を規約に書く
                    │
                    ▼
     ┌──────────────────────────────────────────────┐
     │ 第2段: ②⑨（根拠エンジン）                     │
     └──────────────────────────────────────────────┘
        2-a  根拠4本を1つの関数に集約（a/b/c/d）
        2-b  「根拠が N 本未満なら出さない」の下限を決める
                    │
                    ▼
     ┌──────────────────────────────────────────────┐
     │ 第3段: ③（双方合意）                           │
     └──────────────────────────────────────────────┘
        3-a  「提案」テーブル（両側の意思 + 段）
        3-b  スカウトの3ゲートを開ける（別作業・runbook あり）
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     ④ 反応の学習         ⑥ すり合わせメモ
          │                   │
          ▼                   ▼
     ①⑤ キャリアAI       ⑦ 入社後サーベイ
```

### なぜこの順か

| 段 | 理由 |
|---|---|
| **0 が先** | ★**②⑨の SQL は今日でも書けるが、返る件数が 0〜1。**先にコードを書くと「動いているのか壊れているのか区別できない」状態で検証することになる。CLAUDE.md の「起きなかった0か、起こせなかった0かを分ける」が**まさにこの状況**。0-b は特に効く ——**決め手が0件なのは入口が無いからではなく、入口はあるのに誰も通っていないから**で、コードでは解決しない |
| **⑧ が①より先** | ★**プライバシーポリシーに AI の記述が1行も無く、委託先は4社しか挙がっていない。**LLM に会話を投げた時点で規約違反になる。加えて E-3 の食い違いは**⑧を作ると画面に出る**ので、⑧の実装前に決着が要る |
| **②⑨ が③より先** | ③のステッパーは「何を根拠に合意するか」が決まっていないと状態を設計できない。②が先に動けば、③に必要な状態（両側の意思）が実データで見える |
| **③ が④より先** | ★**④が学習する対象（見送り・返信）が今1件も無い。**③を通さないと永久に空 |
| **①⑤ が後** | ★**①の出力先（`ow_profiles` の希望条件）は②が使う。**②が先に動いていれば「①が何を聞けばよいか」が逆算できる。逆順にすると、聞いた結果の使い道が無いまま UI だけできる（`worry` 列が現にその状態） |
| **⑥⑦ は独立** | ③の後ろにぶら下がるが、②⑨とは依存しない。⑦は**テーブルが既にあるので配線だけ**で、着手コストが最も小さい |

⚠️ **0-c（企業アカウント）だけは他と並行できる。** ただし⑤⑥⑨の通知は全部ここに依存する。

---

## 4. 最小の追加で ②⑨ が動く形（設計案）

### 前提

- 根拠 a / c / d は**既存のスキーマで書ける**。b も書けるがデータが0。
- したがって**スキーマの追加は「根拠を出した記録」だけで足りる。**

### 4-1. スキーマ追加は1表だけで足りる

```
ow_proposals   -- ②⑨が「この人にこの会社を出した」記録
  id                   uuid pk
  user_id              uuid not null   -- ★ow_users 空間（列名で示す）
  company_id           uuid not null
  job_id               uuid            -- 求人起点のときだけ
  -- 根拠（出した時点のスナップショット。★後から作り直さない）
  evidence             jsonb not null  -- [{kind:'transition'|'join_reason'|'talkable'|'preference', ...}]
  counter_evidence     jsonb           -- 反証（A-3）。★null と [] を区別する
  -- 双方の意思（③のステッパー）
  candidate_intent     text            -- null / 'interested' / 'want_to_meet' / 'declined'
  company_intent       text            -- 同上
  stage                text not null   -- 'proposed' / 'mutual' / 'disclosed' / 'introduced'
  created_at, updated_at
```

**なぜ jsonb か:** 根拠の種類は増える（軸2・ツール・在籍期間…）。
種類ごとに列を足すと**「渡し忘れると黙って消える」**（`mapCompany` の第4引数と同じ形）。
⚠️ ただし**jsonb は集計に弱い**ので、④で学習するときに再検討が要る。**論点として残す。**

**なぜスナップショットか:** `ow_transitions` は洗い替えで消える（`DELETE WHERE true`）。
提案時の根拠が後から変わると、④が「何を見て断られたか」を復元できない。

### 4-2. 根拠エンジン本体は新規テーブル無しで書ける

```
src/lib/matching/evidence.ts   （新規・1ファイル）
  buildEvidence(userId, companyId): Promise<Evidence[]>
    a. ow_transitions        … 「◯◯から N 人が移っています」
    b. ow_experiences.join_reasons … 「在籍者が挙げた決め手」
    c. talkableCompanyIds()  … 「話を聞ける人が N 名います」
    d. scoreJob の企業版      … 「希望フェーズ/事業領域に合致」
  buildCounterEvidence(userId, companyId): Promise<Evidence[]>
    A-3 のうち今日取れるのは「在籍期間」だけ
```

⚠️★**②と⑨は同じ関数を呼び、`Evidence` の `label` だけを向きで変える。**
2つ書くと必ず食い違う（CLAUDE.md「同じ名前の別実装を作らないこと」）。

⚠️★**`MIN_AGGREGATE_COUNT = 3` をそのまま使うと、根拠1は今日 1本も出ない。**
→ **提案: 件数を出さずに「◯◯から移った人がいます」と書く形なら3未満でも出せるが、
それは既存の規約を曲げることになる。判断が要る。**

### 4-3. 追加しないもの（意図して）

| 足さないもの | 理由 |
|---|---|
| `ow_match_scores` の復活 | 事前計算は不要。希望条件から都度出せる（weekly-match が 2026-08-10 にそう直した） |
| スコア列（`match_score`） | 思想⑦（マッチ度%・星評価を出さない）。`ow_matches` に列があるが**使わない** |
| 根拠の種類ごとの列 | 4-1 のとおり jsonb 1本 |
| 新しい可視性の列 | ②⑨が読むのは既に `getCompanyEmployees` を通ったデータだけ、という形にする |

### 4-4. 権限

`ow_proposals` は **`ow_transitions` と同じ形**にする:
RLS 有効 / **anon・authenticated に GRANT を配らない** / 読み書きは admin クライアントだけ。
⚠️ 本人に見せる経路を後から足すときに初めてポリシーを書く。
**先に配ると「誰に読ませるか」を GRANT で書くことになり、CLAUDE.md の原則に反する。**

---

## 5. CLAUDE.md の記述と実態がずれている箇所

| # | CLAUDE.md の記述 | 実測（2026-09-18） | 重さ |
|---|---|---|---|
| ★1 | 「★実例: `guard_member_consent` は本人を弾いている（2026-08-23 実測）」 | ★**直っている。** 本番の関数は `public.auth_ow_user_id()` と比較。空間は揃っている | **大**（不具合として残っている記述） |
| ★2 | 「★実例: `/api/biz/ambassador/self-register` は CHECK 制約で必ず 500（2026-08-23 実測）」 | ★**直っている**（`330f6d20`）。`display_consent: true, is_public: true` を入れる | **大**（同上） |
| ★3 | 「この2件はセットで直す必要がある」 | **両方とも直っているので、この記述自体が無効** | 大 |
| 4 | 「実ユーザー 9人 ／ 職歴がある人 6人（2026-09-16 実測）」 | **`is_test=false` で数えて 9人 / 職歴あり 5人。** リポジトリ自身の表示規則（`isRegisteredUser` + is_test + is_system）だと **7人 / 4人**。⚠️ 職歴を持つ2アカウントが **2026-09-17 に更新され、現在 `is_test=true`**。6→5 はこれで説明がつくが、更新内容までは追えない | 中 |
| 5 | 「`USING(true)` + anon SELECT のテーブルは **14表**（2026-08-27）」 | **13表** | 小 |
| 6 | 「`ow_users` の SELECT は **29 / 38**（2026-09-15）」 | **29 / 39**（列が1つ増えた） | 小 |
| 7 | 「`ow_experiences` … 入社理由あり **5行**（2026-09-15）」 | 5行のままだが、★**5行とも `is_test` のアカウント**という点が書かれていない。**表示経路は is_test を落とすので実質0件** | 中 |
| 8 | 「`ow_transitions` … 洗い替えは手動のみ」 | ✅ 正しい。⚠️ ただし**現に古い**（最終 2026-08-26 / 以後13行増加 / 流し直すと 5→7行）という事実は書かれていない | 中 |
| 9 | 指示書の前提「可視性2列の食い違いの現状」 | ★**既に解消**（`visibility_company_profile` は 2026-09-11 に【廃止】。実測でも食い違い0行） | — |

⚠️★**1〜3 は「既知の不具合」として残っているので、次に読む人が直しに行って
「もう直っている」ことに気づくまで時間を使う。** 早めに直すのがよい。

---

## 付録: 使ったクエリの要点

- 母集団: `is_test=false and is_system=false and auth_id is not null`（`isRegisteredUser` に揃える）
- 表示可能な職歴: 上記 + `ow_users.visibility <> 'private'` + `ow_experiences.visibility_company <> 'hidden'`
  （`getCompanyEmployees` の `isSeedRow` と同じ）
- 掲載企業: `listing_status = 'listed' and coalesce(is_test,false) = false`
- `ow_transitions` の鮮度検査: `rebuild_ow_transitions()` の本体と同じ CTE を SELECT だけで再現

⚠️ **書き込みは一切していない。** `rebuild_ow_transitions()` も**呼んでいない**（SELECT で再現しただけ）。
