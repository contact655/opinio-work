# OPINIO の新方針と、いまの実装・データの差分（フェーズ0調査 / 2026-11-02）

**読み取りだけで調べた。コード・migration・データは一切変えていない。**
数字はすべて 2026-11-02 に本番 DB で数えた（SELECT のみ）。

## 数え方の決めごと

| 区分 | 条件 |
|---|---|
| **実ユーザー** | `auth_id` あり・`is_test` でない・`is_system` でない・`visibility <> 'private'`・`@seed.internal` でない・`statistics_opt_out` でない（`lib/aggregate/population.ts` の `isAggregatableUser` と同じ） |
| テストデータ | 上の条件から外れる行 |
| 株式会社エージェント | デモ用の会社。`ow_companies.is_test = false`・`listing_status='draft'`・`is_published=true`。**職歴0件・求人0件・転機0件**。担当者は2人（検証用1人・実ユーザー扱いの1人。後者は職歴0件）。⇒ **以下の職歴・回答の件数には元から1件も入っていない**。ユーザー数だけ、この1人を除いて書く |

- `ow_users` 103行のうち実ユーザー **44人**（エージェントの担当者1人を除くと **43人**）
- `statistics_opt_out = true` は **0人**（そもそも本人が切り替える画面が無い。`src/app/(auth)/auth/page.tsx:721` の注記）

---

## 1. 入社の決め手・入社後レビュー

### 現状

**同じ「理由」を入れる置き場所が、世代ごとに4組ある。** いま画面から書いているのは ④ だけ。

| 世代 | 置き場所 | 画面から書くか | 実データ |
|---|---|---|---|
| ① 旧形式（2026-08〜） | `ow_experiences.join_reasons`(text[]) / `join_reason_primary`（★一番） / `leave_reasons` / `ow_experience_gaps` | **書かない** | 実ユーザー: 決め手あり **19件** ／ ★一番あり **10件** ／ 退職理由 **7件** ／ gaps **107行**（テスト: 決め手6件） |
| ② reason_version=2（2026-10-16） | `ow_experience_reviews` / `_expectations`（`is_primary`） / `_gap_shifts` / `_leave_reasons` / `_notes` / `ow_reason_modal_closes` | 書かない（`/api/jobseeker/experiences/[id]/reasons` は画面から呼ばれない） | reviews 26行（実ユーザー分17）だが `fit_score` は全件 NULL・`answered_at` ありは1件。expectations 3行・leave 2行・notes 0行 |
| ③ 入社後レビュー（2026-10-17） | `ow_workplace_reviews` / `_axes` / `_tags`、マスタ `ow_review_axes`(6軸) / `ow_review_fit_tags`(8) | 書かない（`ExperienceReasonModal` は `/dev/preview` からしか開かない。`CareerHistoryEditor.tsx:2161-2163`） | **2行・実ユーザー0** |
| ④ **転機の3問**（2026-10-27） | `ow_career_turns`（`decisive_reasons` text[] / `next_priority` / `fit_after_year` / `answered_at` / `skipped_at` / `copied_from_legacy_at` / `detail_*`）と `ow_career_turn_axes` | **書く**（`CareerTurnModal`） | 25行。実ユーザー **19行（10人・15社）**、テスト6行。**19行すべて①からの機械的な写し**（`copied_from_legacy_at` あり・`answered_at` なし）。⇒ **新しい画面で答えた実ユーザーは0人**。Q2・Q3・任意の段（axes 0行・メモ0件）も実ユーザー0件 |

**選択肢**

- いまの Q1 は15個（`src/lib/careerTurns/constants.ts:11-27`。②の `EXPECTATIONS`（`src/lib/constants/careerReasons.ts:209-226`）と同じキー・同じ並び）
  - job_content 事業・プロダクト ／ customer 顧客・業界 ／ position 職種・役割 ／ autonomy 任される範囲 ／ skills 身につくスキル ／ next_career 次のキャリアにつながる ／ management 上司・経営陣 ／ people 一緒に働く仲間 ／ culture 組織のカルチャー ／ salary 年収・待遇 ／ evaluation 評価・昇進の仕組み ／ work_style 働き方（場所・時間） ／ growth 事業の成長性 ／ stability 知名度・安定性 ／ personal タイミング・個人の事情
- ①の `JOIN_REASONS` は12個（`careerReasons.ts:106-119`）。`customer` / `next_career` / `management` が無い。`LEAVE_REASONS` は13個（`:133-147`）
- 実ユーザーの Q1 の内訳（19行・写し）: skills 10 ／ salary 7 ／ autonomy・job_content・position・people 各5 ／ stability・work_style 各4 ／ culture 3 ／ evaluation・growth・personal 各1

**新しい14個との対応**

| 新しい選択肢 | いまのキー | 対応 |
|---|---|---|
| 仕事内容に惹かれた | position（職種・役割） | 近いが同じではない |
| 事業やプロダクトに惹かれた | job_content | 一致 |
| 前職の経験が活きる | — | **無い** |
| 新しい経験やスキルが得られる | skills（＋ next_career の一部） | ほぼ一致 |
| 任される範囲が広い | autonomy | 一致 |
| 一緒に働く人や社風に惹かれた | people ＋ culture（＋ management の一部） | **2つを1つにまとめる** |
| 面接や選考の印象が良かった | — | **無い** |
| 知人や社員に誘われた | — | **無い** |
| 会社が伸びている | growth | 一致 |
| ミッションや事業の意義に共感した | — | **無い**（job_content の一部） |
| 規模や安定性、知名度 | stability | 一致 |
| 年収や待遇 | salary | 一致（evaluation は行き先が無い） |
| リモートや勤務地 | work_style | **1つを2つに分ける** |
| 働く時間や休みの取りやすさ | work_style | 同上 |
| （行き先なし） | customer / next_career / management / evaluation / personal | 新方針には無い |

⚠️ 実データへの影響: work_style の4件は、リモートと時間のどちらか分からないので機械的には移せない。evaluation と personal（各1件）は行き先が無い。

**上限・★・必須・聞く時機**

| | 実装 |
|---|---|
| 上限 | 3つ（`DECISIVE_REASON_MAX = 3`、`careerTurns/constants.ts:28`、API の検証は `:95`）。DB では縛っていない |
| ★（一番） | **④には無い**（等重み。`:10`）。①の `join_reason_primary` と②の `is_primary` には残っており、②は2つ以上選ぶと★が必須だった（`careerReasons.ts:340-374`）。①→④の写しで★は捨てた |
| 必須か | 任意。3問のどれか1つで保存できる（`CareerTurnModal.tsx:150,304-306`）。「この転機は答えない」（`skipped_at`）もある |
| 聞く時機 | **登録時（オンボーディング）には聞かない**。聞くのは ①**別の会社の職歴を足した直後**（`CareerHistoryEditor.tsx:1883-1888`。同じ会社に役割を足したときは出さない） ②職歴の行の吹き出し ③「まとめて答える」 ④ホームの状態B（`src/app/(jobseeker)/home/HomeTurnCard.tsx`、`home/page.tsx:107`） |
| Q3 | 入社月から12か月たってから（`canAskFitAfterYear`、`constants.ts:66-72`）。1年たった時点で改めて聞く仕組みは無い（`CareerTurnModal.tsx:290`） |

**「転機ごとの3問」の進み具合**

- 実装は main に入って本番に出ている（2026-10-27 / `20261027090000`・`090100`・`100000`）。未マージのブランチ・stash に関連する変更は無い（`wip/stance-b-plan` は転職意欲の別件、他のブランチは main より新しいコミットなし）
- 決めた内容は `docs/phase1c-proposal-20261027.md`
- ⚠️ 写しの19行は新しい画面を開くと「質問が新しくなりました」と出る（`answered_at` が null のため）

**回答日と入社日の差**

- `ow_experiences.started_at` は **date**、`ow_career_turns.answered_at` は timestamptz なので**差は計算できる**
- ⚠️ ただし実ユーザーの19行は `answered_at` が全部 NULL（写しのため）。①の旧形式には回答日時の列が無い（`ow_experiences.updated_at` は他の編集でも動く）。⇒ **いまある回答には「いつ答えたか」が無く、「入社3か月超の回答を外す」は今後の回答にしか当てられない**

**漏れる経路の確認**

| 経路 | 結果 |
|---|---|
| PostgREST（anon / authenticated） | `ow_experiences.join_reasons` / `join_reason_primary` / `leave_reasons` / `join_reason` / `exit_reason` は**どちらのロールにも SELECT なし**。`ow_career_turns` / `_axes` / `ow_experience_reviews` / `_expectations` / `_gap_shifts` / `_leave_reasons` / `_notes` / `ow_transitions` は**表ごと権限なし** |
| 本人だけ読める表 | `ow_workplace_reviews`（+axes/tags）と `ow_experience_gaps` は authenticated に SELECT があるが、RLS が本人の行だけ（`user_id = auth_ow_user_id()` など） |
| 企業ページの集計 | 「人の流れ」の「入社の決め手」（2章） |
| ⚠️★**提案の根拠 `shared_motive`** | `src/lib/evidence/engine.ts:209-222` が「入社の決め手を答えた n人のうち k人が『X』を挙げています」という文を作る。X は**候補者本人の決め手と在籍者の決め手が重なったもの**（`src/lib/evidence/fetch.ts:105-107,250-272`）。n は5人以上（`engine.ts:214`）だが **k は1人でも出る**。この文は `ow_proposals.evidence` に保存され、**企業側の紹介画面でも読む**（`src/lib/evidence/companyProposals.ts:42,56`）⇒ 企業から見ると「この候補者は X を決め手に挙げた」と読める形。読むのは①旧形式（④の回答は見ていない） |
| 運営画面 | `src/lib/admin/evidenceGaps.ts:101,140` が件数を数える（個人の回答は出さない） |
| 「あなたに合う会社」 | 本人のQ3（無ければ③の fit_score）だけを使い、他人の回答は使わない（`src/lib/forYou/weights.ts:17,88-103`） |

### 新方針との差分

- 足りない: 新しい14個のうち4個（前職の経験・面接の印象・誘われた・ミッション）。回答日時のある既存回答。新しい画面での実回答（0人）
- 余分: Q2・Q3・任意の段・③入社後レビュー・②v2・①の★と退職理由とギャップ（表とデータが4世代ぶん残っている）
- 矛盾: `shared_motive` が個人の決め手を k=1 から企業へ渡しうる。「個人の回答は会社にも誰にも見せない」と食い違う

### 規模感

- 選択肢の差し替え: **中**（定数＋DB の CHECK＋並び順を固定した前提の注記。旧キーの写し替えを決める必要あり）
- Q2/Q3/任意の段をやめる: **中**（モーダル・API・ホームの状態B・「合う会社」の Q3 依存）
- `shared_motive` を止める: **小〜中**（engine の1分岐と保存済み提案の扱い）
- 4世代の表の整理（DROP）: **大**（読む場所が多い。急がなければ放置でも害は無い）

---

## 2. 集計と表示

### 現状

- 企業ページで理由を集計して出すのは**「人の流れ」の「入社の決め手」だけ**（`src/app/(jobseeker)/companies/[id]/CompanyFlowSection.tsx:93-96`）。計算は `src/lib/companyFlow/compute.ts:162-165`（Q1 を答えた人が5人以上、かつ5人以上が挙げた決め手だけ・上位3つ）。同じ欄に「入って1年たったころ」（Q3）もある（`:99`）
- ⚠️ 実データ: 決め手の回答がある会社は15社、最多でもセールスフォースの2人 ⇒ **いまどの企業ページにも決め手は出ていない**
- 人数の下限は `src/lib/constants/aggregate.ts:41` の `MIN_AGGREGATE_COUNT = 5`（回答由来）と `:55` の `MIN_CAREER_FACT_COUNT = 3`（経歴由来）
- **人数を出している**: 見出しに「N人の回答から」（`CompanyFlowSection.tsx:94,99`）、各行に「N人」とバー（`:124-134`）。API `/api/jobseeker/companies/[id]/flow` も `respondents` と各行の `count` を返す（型は `compute.ts:50,60`）。未ログインには `toFlowSummary` が回答者数だけを渡す（`:182-199`）
- 更新のタイミング: リクエスト時に計算して `unstable_cache` 300秒（`src/lib/companyFlow/server.ts:142`）。ページも `revalidate = 300`（`companies/[id]/page.tsx:10`）。**バッチは無い**
- 掛け合わせ:
  - 企業ページの決め手は会社単位だけ（部門・職種との掛け合わせなし）
  - ⚠️ ホームの「似た経歴の人」（`getSimilarPaths`、`server.ts:221-247`）は**職種の大分類 × 業界の大分類**で絞った人の Q3（1年後に合っていたか）を集計している（下限5人）
  - 「人の流れ」の「社内の職種の変化」は職種で分けた経歴の集計（下限3人）
  - 提案の `shared_motive` は候補者の決め手との重なり（1章）

**下限を10人に変えるときに触る場所**

| 場所 | 内容 |
|---|---|
| `src/lib/constants/aggregate.ts:41` | 定数そのもの。これを変えると以下が全部動く |
| 定数を使っている場所 | 企業ページの人の流れ（`companyFlow/server.ts:27,246`）／検索の人数・「すべて」の合計・行き先（`search/page.tsx:370-456,596-603,686,1185`、`lib/search/runSearch.ts:221,818`、`destinations.ts:47`、`transitionExamples.ts:80,94`）／トップ（`(jobseeker)/page.tsx:316`）／提案の根拠（`lib/evidence/fetch.ts:62`）／企業の候補者画面の「人の流れ」（`lib/business/candidates/touchpoints.ts:343-345`、`companyContacts.ts:112-121`、`candidateGroups.ts:77`）／合う会社（`lib/forYou/rank.ts:269,283`）／運営画面（`lib/admin/evidenceGaps.ts:158-166,245`） |
| 文言に書いた「5人」 | `src/lib/careerTurns/constants.ts:60`（「5人以上集まったときの集計にだけ使います」）。ほかにコメント・`/dev/preview` の説明に多数 |
| テスト | `src/lib/companyFlow/companyFlow.test.mjs` ほか固定値を使うもの |
| 規約 | `content/legal` に「5人」の明記は見当たらなかった（`grep` 0件） |

⚠️ この定数は「決め手」だけでなく、検索の人数・行き先など**経歴以外の統計全部**に効く。決め手だけ10人にするなら定数を分ける必要がある。

### 新方針との差分

- 矛盾: 人数を出している（見出し・行・API）。新方針は順位のみ
- 矛盾: 更新は300秒ごと。新方針は月1回
- 足りない: 「在籍確認できた回答だけ」の絞り込み（3章）
- 余分: Q3 の集計（企業ページとホームの似た経歴）、職種×業界の掛け合わせ

### 規模感

- 下限の数字だけ変える: **小**（ただし影響が全統計に広がる。決め手だけなら定数を分けて**中**）
- 人数を消して順位だけにする: **中**（画面・API の形・テスト）
- 月1回の更新: **中〜大**（いまは都度計算。月次で固定した結果を持つ表か仕組みが要る）

---

## 3. 在籍確認

### 現状

- 求職者の勤務先メールで在籍を確かめる仕組みは**無い**
- `ow_company_domain_verifications`（email / domain / token / verified_at）が baseline にある（`supabase/migrations/20260727000000_baseline.sql:2995-3013`）が、**src からの参照0件・0行**
- 企業担当者の参加申請の審査画面がドメインの一致を参考に出すだけで、「本人である証明にはならない」と明記（`src/app/admin/company-join-requests/RequestsClient.tsx:84-94,152`）
- 画面でも「OPINIO は在籍確認をしていない」と書いている（`PeopleListClient.tsx:362,1098`、`CompanyEmployeeSections.tsx:367`）

### 新方針との差分（「在籍確認できた人だけ」で集計するのに必要なもの）

1. 企業ごとのメールドメインの対応（`ow_companies` には今ドメインの列が無い。`url` はあるが正確ではない）
2. 本人が会社のアドレスを登録し、確認メールのリンクを踏む流れ（トークン・期限・再送）
3. 確認したことの記録を**職歴ごと**に持つ（どの会社の、いつ確認したか）。退職後も「在籍していたときに確認済み」と扱うかの決め
4. 会社のアドレスそのものをどこに置き、誰が読めるか（いまの `ow_users.email` とは別。企業にも出さない前提）
5. 集計側の母数の条件（`isAggregatableUser` に「確認済み」を足す、または決め手の集計だけで絞る）
6. メール送信（`lib/notify/email.ts`）と、規約・プライバシーポリシーへの記載
7. フリーメールやドメインを共有するグループ会社の扱い

### 規模感

**大**（テーブル追加・確認の流れ・規約）

---

## 4. 投稿・フォロー・タイムライン

### 現状

- 投稿: `ow_posts`（`post_type` に CHECK なし。`20260805035958_create_ow_posts_visible.sql:23-25`）
  - 実データ: `company_joined` **81** ／ `job_posted` **77** ／ `article_published` **12** ／ `user_post` **3**（**実ユーザーの投稿は0件**）
  - 投稿できるのは**ログインした個人なら誰でも**（`src/lib/feed/canPost.ts`、RLS `20261001070000_posts_insert_any_logged_in.sql`）。作成は `src/app/api/jobseeker/posts/route.ts`（毎時30件、`visibility='login_only'` 固定 `:324,397-417`）
  - **企業名義の投稿・社員が企業として投稿する仕組みは無い**。企業関連の投稿はすべてシステムユーザー名義の自動投稿（`src/lib/feed/systemPosts.ts`。作る場所は `lib/jobs/publishServer.ts:107`、`lib/companies/listing.ts:112`、`api/admin/companies/[id]/route.ts:259`、`admin/articles/actions.ts:50`）
  - `event` は表示だけ（`FeedClient.tsx:2094`）、`mentor_post` は作る経路が無い
- フォロー: `ow_user_follows`（`follower_user_id` / `target_user_id`）6行、`ow_company_follows` 0行
  - RLS: 自分がフォローした行だけ読める（`20260828080000_policies_use_auth_ow_user_id.sql:100-104`）。`ow_company_follows` はポリシー0本。UNION の `ow_follows_v` は service_role だけ
  - **人数は他人にも見える**: `/u/[id]` のフォロワー数・フォロー数（`UserProfileContent.tsx:176-178,639`、`lib/people/followCounts.ts`。0なら出さない）
  - 一覧は本人の分だけ（`/people?rel=followers`、`/mypage/follows`）
- タイムライン（`/feed`）:
  - **フォローで絞っていない**。全員の投稿と全システム投稿を新しい順に読む（`feed/(list)/loadFeedProps.ts:132-151`、続きは `api/jobseeker/posts/route.ts:290-300`）
  - 「すべて／フォロー中」のタブは 2026-10-20 に廃止（`FeedClient.tsx:2434-2436`）
  - フォローしている人・企業の投稿を先頭に並べ替えるだけ（`FeedClient.tsx:2466-2475`、読み込み済みのページの中だけ）
  - 人の投稿が10件未満の間は、お知らせ（企業の掲載・求人・記事）を流れに混ぜる（`lib/feed/streamMode.ts:14,19`）。10件以上なら右の箱・スマホは5件おきに差し込み（`FeedClient.tsx:2480-2511`）。いまは人の投稿3件なので**混ぜる側**
  - フォロー外の人を出す差し込み: 「◯◯から次に進んだ人」（`lib/feed/careerMoves.ts`、右の列とスマホの差し込み）
  - 広告・おすすめのアルゴリズムは無い
- つながり申請: テーブル・機能とも**無い**。つながり＝相互フォロー（`src/lib/companies/connections.ts:8-11`）。企業ページの「つながり」は `show_as_connection = true` の人だけ（0人）

### 新方針との差分

- 矛盾: タイムラインがフォロー外の投稿・全企業のお知らせ・「次に進んだ人」を出している
- 足りない: 企業として投稿する主体、社員の投稿を企業ページにぶら下げる形（営業文脈の入口）
- 余分/要判断: フォロー数を他人に出している（新方針に明記なし）

### 規模感

- タイムラインをフォロー相手だけにする: **中**（取得の条件・お知らせと差し込みの扱い・空のときの画面）
- 企業名義の投稿: **大**（投稿の主体に企業を足す。`ow_posts` は `user_id` 前提・RLS・通知）

---

## 5. 話を聞ける人

### 現状

- 2026-10-16 に撤去（CLAUDE.md「面談OK（話を聞ける人）は撤去した」）。**UI だけでなくコードも外した**（`lib/companyMembers/*`・`talkable.ts`・API・メールの雛形は削除済み）
  - 残っているのは DB とわずかなコード: `ow_company_members` 15行（src からの読み書き0件）／`ow_company_admins.is_ambassador`（true 1件）・`talk_themes`／`ow_users.can_casual_meeting`・`can_talk_to_candidates`／`ow_casual_meetings.requested_user_id`
  - `src/lib/business/members.ts:15,36,88,115` が `is_ambassador` を select して型に載せている（使い道なし）。`people` の prop 名 `ambassadors`（中身は職歴から作る人の一覧）、`middleware.ts:140-142` の古い URL の転送
  - ⚠️ 10月26日の「復活は見送り」以降に追加で止めたものは見当たらない（10-16 の撤去がそのまま）
- OB/OG カード（`companies/[id]/CompanyEmployeeSections.tsx`）: 顔・名前・在籍期間・「現在：会社・役職」。CTA は汎用の「メッセージ」（`DMButton`、ログイン中・本人以外。`:102-104`）。面談OKバッジ・「◯◯さんに話を聞く」は撤去済み（`:109-111,367-368`）
- メッセージリクエスト:
  - 個人どうし（`lib/conversations/messageRequest.ts`、`lib/constants/messages.ts:37-54`）: 1日10件・返事待ち20件。**最初の1通で「聞きたいテーマ・ひとこと（100字）・話す形（メッセージ／オンライン15分／30分）」を必ず送る**（`messageRequest.ts:246-275`、`lib/constants/messageTopics.ts:16-46`）＝**聞きたいことの事前送付にあたる仕組みはある**。期限・自動見送りは無い
  - 企業から（旧声かけ、`ow_company_approaches` 2行。`lib/constants/companyApproaches.ts:54-100`）: 上限なし（月10通は 10-17、返事待ち10件と30日は 10-18 に外した）。同じ人へは返事まで追加不可・返信後180日あける・同じ理由文は30日使い回せない。**未返信の自動辞退は無い**
  - DM の会話は10本
- 立場: 「採用担当／紹介制度のある社員／個人として」を表す列は**無い**。紹介制度（referral）の列も無い。近いものは `ow_company_admins.permission`（admin / recruiter / interviewer / viewer。`20261012200000_company_roles_four.sql`）と、送る経路の違い（個人の DM か、企業名義の `ow_company_approaches` か。`UserProfileContent.tsx` 690行付近）
- 話せる量（今は話せない・月1件まで・積極的に）: **無い**
- 企業が社員に「話す役割」を付ける仕組み: **無い**。権限は `src/lib/auth/roles.ts` の `can()` 1か所。`/biz/members` は採用担当だけ（面談対応者のタブは撤去。`MembersClient.tsx:28-29`）、`/biz/employees` は一覧と詳細だけ

### 新方針との差分

- 足りない: 立場・話せる量・企業が付ける役割・未返信の自動辞退。「話を聞ける人」として人を見せる面
- あるもの: 事前送付（キャリア相談の3項目）、DM と企業名義の2つの経路

### 規模感

**大**（立場と話せる量の列、設定画面、企業側の付与、一覧での見せ方、規約。10-16 に消したものを作り直すことになる）

---

## 6. 同じ経歴の人の行き先

### 現状（2026-08 との比較）

| | 2026-08-10〜28 の記録（CLAUDE.md） | **2026-11-02** |
|---|---|---|
| 実ユーザーの職歴 | 14件（08-10）／13件（08-28） | **53件** |
| 職歴がある実ユーザー | 5人／4人 | **32人** |
| `company_id` で解決 | — | **45 / 53件（85%）** |
| 会社が変わる隣接ペア（実ユーザー） | 5行（08-20、`ow_transitions`） | **17ペア・10人**（両側とも `company_id` あり **14**） |
| `ow_transitions`（全体） | 5行 | 17行 |
| テスト分 | — | 職歴67件・ペア22 |
| `visibility_company` | — | 全件 `real` |

⚠️ 08-20 の「5行」は当時の母数（検証用アカウントを含みうる）。数え方が完全には同じでない。

- 集計の経路は**ある**:
  - 企業ページ「人の流れ」の前職・行き先・在籍・社内の職種の変化（`lib/companyFlow/compute.ts`、下限3人）。2026-10-27 時点で出るのはセールスフォースだけ（CLAUDE.md）
  - 検索の移動の言い方（「Salesforceを出た人」「IT以外から来た人」）: `lib/search/transitionIntent.ts`（読み取り）・`transitionMatch.ts`（当てはめ）・`companyFlow` の `computeLeaverSummary`・例文 `transitionExamples.ts`（3人以上当てはまる文だけ）
  - 「〈会社〉を出た人の、いま」（`lib/search/destinations.ts`）、ホームの似た経歴（`getSimilarPaths`）、フィードの「次に進んだ人」
  - 08-12 の `queries.ts` の OB/OG カードはそのまま企業ページの OB/OG 欄
- 職種→職種（B職種からC職種）は、検索の移動の文と「社内の職種の変化」で扱える。業界は大分類まで・会社名は出さない
- 遷移のフリーワード検索: 上の `transitionIntent.ts`（辞書で読む・AIなし）

### 新方針との差分

- 仕組みはほぼ揃っている。足りないのは**人数**（下限3人に届く会社が1社）

### 規模感

**小**（仕組みの追加はほぼ不要。データが増えるかどうか）

---

## 7. どの会社・部門にどんな人がいるか

### 現状

- 在籍者が出る場所:
  - 企業ページの現役・OB/OG（顔・氏名・役職名・職種・ひとこと。OB/OG は在籍期間と現在の会社）。`queries.ts:1776-1808`、除外は `:1823-1859,1947-1980`。未ログインには `visibility='public'` の人だけ（`api/jobseeker/companies/[id]/employees/route.ts:43-44`）
  - `/u/[id]`（未ログインでも「公開」の人は全部。職歴に**部署（自由記述）**・役職ランク・役職名。`MergedTimeline.tsx:313-330`）
  - `/people`（ログイン必須）、`/search` の人（未ログインは件数だけ）、`/schools/[id]`
- 公開範囲の列:
  - `ow_users.visibility`（本人が選べるのは public / login_only。新規登録の初期値は public。`/mypage/settings` の `PrivacySettings.tsx:161-216`）
  - `ow_experiences.visibility_company`: 入力欄は 2026-09-15 に撤去、全件 `real`
  - `visibility_company_profile`（統合済み）・`visibility_salary`（読み書きしない）・`visibility_reason`（入力欄なし・判定だけ残る）
  - `ow_company_hidden_experiences`（運営だけが書く）・`show_as_connection`（設定あり・0人）・`statistics_opt_out`（設定画面なし）
  - ⇒ **部署・職種・名前を別々に公開／非公開にする設定は無い**。プロフィール全体の1本だけ
- 未ログインに出るもの: 企業ページの総人数「(N名)」と「ログインすると N名…」（`CompanyEmployeeSections.tsx:294,341,572,601`）。⚠️ この N は5人未満でもそのまま出る（検索は5人未満を伏せるのと揃っていない）
- 件数の制限: 検索 `HIT_LIMIT = 24`（`runSearch.ts:194`）。`/people` は60人ずつ表示だがデータは全件クライアントへ渡る（`PeopleListClient.tsx:896`）。企業ページの社員一覧は上限なし
- レート制限（`lib/rateLimit.ts`）は投稿・DM・応募・面談・OGP だけで、**社員一覧 API・`/people`・`/u`・検索には無い**
- エクスポート・CSV: 無い
- 小さな部門: 部署単位の人数・名簿は無い。企業ページの職種構成バーは「3名以上かつ職種2種類以上」で出し、**1名の職種も「X: 1名」と出る**（`CompanyEmployeeSections.tsx:301-327`）。ただし同じ欄に名前つきで並んでいるので、新しく分かることはほぼ無い
- ⚠️ 「公開」の人は PostgREST から職歴の全行（業務内容を含む）が anon に読める（`ow_experiences_public_read`。注記 `profileVisibility.ts:19-24`）。画面では業務内容をログイン中だけにしているが、API は別

### 新方針との差分

- 新方針で明示された要件は無いが、部門単位の公開を本人が選べない・閲覧件数の制限が無い・未ログインに少人数の人数が出る、は判断の対象

### 規模感

- 未ログインの人数を下限で伏せる: **小**
- 項目ごとの公開設定: **中〜大**
- 閲覧の制限: **中**

---

## 8. ストレングスファインダー

**なし。** 列もテーブルも無い。過去の UI は削除済み（`UserProfileContent.tsx:941-942` に「`ow_users.strengths_finder` 列は存在しない」と注記）。旧 `jobs` テーブルの `personality` 列（baseline:2073）は src から使われていない。

---

## 9. 打ち出しの文言

### 現状

- 「会社を、そこで働く人から知る。」は**いまは使っていない**（`src/app/(jobseeker)/LandingPage.tsx:448` の注記に残るだけ。2026-09-20 に差し替え）
- いまの LP の見出し: 「Every Company Is Its People.」＋「会社は、働く人でできている。」（`LandingPage.tsx:466-467`）
- 同じ趣旨の文言:
  - トップの description「IT企業の事業と、在籍している方・していた方の経歴をまとめています…」（`(jobseeker)/page.tsx:56-57`）
  - `/business` の h1・title「そこで働く人が、会社を伝える。」（`src/app/business/page.tsx:75,80,253-254`）、description「社員と元社員の経歴で、どんな人が働いている会社かを伝える…」（`:81`）
- それ以外の meta:
  - サイト既定の title「OPINIO | IT業界の転職・求人情報」（`src/app/layout.tsx:41-44`）、description「…登録なしで全て読めます…」（`:54-55`）、OGP/Twitter の title「OPINIO | IT業界特化のキャリアプラットフォーム」（`:71,82`）。トップも同じ title（`(jobseeker)/page.tsx:69,72`）。`(jobseeker)/layout.tsx:47-53` にも OGP
  - OGP 画像の文字「IT業界特化の / キャリアプラットフォーム」（`src/app/opengraph-image.tsx:76-77`）
- メール（`src/lib/notify/templates.ts`）にキャッチコピーは無い
- 英語: LP の「Every Company Is Its People.」と OGP 画像の alt「OPINIO — Truth to Careers」（`opengraph-image.tsx:5`）だけ。英語版の meta は無い（locale は ja_JP）

### 新方針との差分

- 「選んだ人の理由で、会社を選ぶ」に当たる文言はどこにも無い。いまの見出しは「働く人」が主語で、理由・決め手には触れていない
- title・description・OGP の「IT業界の転職・求人情報」「キャリアプラットフォーム」は旧い言い方のまま揃っていない

### 規模感

**小**（文言だけ。ただし title・OGP・LP・/business の複数箇所をそろえる）

---

## 次の判断事項と、実装上の影響

（どちらを選ぶべきかは書いていない）

### 1. 「話を聞ける人」を復活させるか

| | 実装上の影響 |
|---|---|
| 復活させる | 10-16 に消したもの（判定・設定・企業側の付与・一覧の見せ方）を作り直すことになる。新方針の「立場」「話せる量」は以前の仕組みにも無かったので、列と設定画面を新しく足す。`ow_company_members` 15行は以前の意味（本人の申告＋掲載）で残っており、そのまま使うか作り直すかを決める必要あり。未返信の自動辞退も新設。規約にも書く |
| 復活させない | いまのまま。人に話を聞く経路は DM（テーマ・ひとこと・話す形の事前送付つき）と企業名義のメッセージだけ。DB の残り（`ow_company_members`・`is_ambassador` など）と `members.ts` の select は名残として残る |

### 2. 集計の人数下限を5人から10人にするか

| | 実装上の影響 |
|---|---|
| 10人にする | `MIN_AGGREGATE_COUNT` を変えると検索の人数・行き先・提案の根拠・企業の候補者画面・合う会社・運営画面まで一斉に変わる。決め手だけにするなら定数を分ける。`careerTurns/constants.ts:60` の「5人以上」の文言、テスト、`/dev/preview` の固定データ。いまの回答数（1社最大2人）では5人でも10人でも何も出ない |
| 5人のまま | 変更なし。新方針の「10人以上」とは食い違ったまま |

### 3. 転機ごとの3問をやめ、決め手1問に置き換えるか

| | 実装上の影響 |
|---|---|
| 置き換える | `CareerTurnModal` から Q2・Q3・任意の段を外す（`next_priority`・`fit_after_year`・`detail_*`・`ow_career_turn_axes`）。Q3 を使っている「人の流れ」の「入って1年たったころ」、ホームの似た経歴（`getSimilarPaths`）、「合う会社」の並び（`fitFromCareerTurn`）の代わりを決める。選択肢を14個に替えるなら CHECK と旧キーの写し替え（work_style の分割、people+culture の統合、行き先の無い5キー）。**新しい画面で答えた実ユーザーは0人**なので、失われる実回答は Q1 の写し19行の選択肢の読み替えだけ。回答日時（`answered_at`）を今後必ず入れる形にすれば「入社3か月超を外す」に使える |
| 3問のまま | いまのまま。新方針の「将来は入社後の結果と紐づける」は Q3 が担う形 |

### 4. 決め手の★（一番）指定をなくすか

| | 実装上の影響 |
|---|---|
| なくす | **いま画面から書いている④には★がもう無い**（2026-10-27 から等重み）。残っているのは①の `join_reason_primary`（実ユーザー10件・書く画面なし）と②の `is_primary`（同）。触るとすれば旧列を読んでいる場所（`createExperience.ts`・`toStint.ts`・`columns.ts`・`api/jobseeker/experiences/route.ts`・`reasonAnswers.ts`・`workplaceReview/server.ts`）の整理だけ |
| 残す（戻す） | ④に★を足す（列・画面・検証・集計での重みづけの決め）。新方針の「順位なし」とは逆向き |
