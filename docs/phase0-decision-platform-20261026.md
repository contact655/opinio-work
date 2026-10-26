# フェーズ0調査：「決める」サービスへの作り変え（2026-10-26）

**読み取りだけで調べた。** コード・DB・設定・git には何も変更を加えていない。DB は SELECT だけ（本番 `xtutnecqeamftygufxco`）。本番の公開ページは curl で読んだだけ。

**実ユーザーの数え方**: `ow_users.is_test is not true and is_system is not true and auth_id is not null and email not like '%@seed.internal'`
→ 全 **101人** から **44人**（除外は is_test 55・is_system 1・auth_id なし 2・`@seed.internal` 0）。

⚠️ この条件だと `contact+52@opinio.co.jp`（10/17 作成）と `contact+53@`（10/20 作成）の2人が `is_test = false` のまま残り、44人に入る。どちらも株式会社Opinio の現職。CLAUDE.md の「取り残し」と同じ形に見えるが、意図して残しているかは未確認。「鈴木 太郎」（`is_test=false`）も検証用の疑いがあるが断定していない（D-13 を参照）。

---

## 0. 想定と違っていたこと・怖いこと（先に読む）

1. ★**実在の利用者（大塚悠貴さん・`is_test=false`）に、株式会社Opinio から本文「テスト」のメッセージリクエスト（企業から）が未返信のまま残っている。**
   - 2026-10-17 作成。送ったのは柴さんの個人アカウント。DB で確認した。
   - `ow_company_message_email_sends` に送信の記録がある。メールを送ろうとしたことは確定しているが、実際に届いたかは未確認（Resend のログは見ていない）。ベルの通知も未読で残っている。
2. ★**入社後レビュー（いまのモーダル）に答えた実ユーザーは0人。** 実データがあるのは旧形式だけ（入社の決め手 19職歴・10人／退職理由 7職歴・6人／ギャップ 107行）。
3. ★**統計利用の停止（`ow_users.statistics_opt_out`）を見ている集計が1つも無い。**
   - 列のコメントは「集計では必ず `statistics_opt_out = false` を付けること（規約第13条の4第5項）」と言っている。しかし src も DB 関数も参照0件。
   - 提案の根拠 `shared_motive` は、この列を見ずに他人の決め手を集計している。停止を申し出た人は現在0人なので、実害はまだ出ていない。
4. ★**提案の根拠 `shared_motive` は、在籍者が1人でも決め手を出す。**
   - n<3 のときは割合を伏せ、「入社の決め手として「X」を挙げた人がいます」と出す（`lib/evidence/engine.ts:215-224`）。n=1 なら特定の1人の回答がそのまま読める。
   - evidence は企業側にも渡る。企業の画面に出るかは未確認。
5. ★**在籍期間のずれは2人いる。** 木村雅樹さん（表示「6ヶ月」、正しくは約3年9ヶ月）に加えて、木村勇人さん（表示「4年9ヶ月」、正しくは約5年11ヶ月）。
   - 原因は `getCompanyEmployees` が1人につき「最新の1レコード」しか残さないこと。
   - さらに企業ページの `calcTenure` とプロフィールの `formatDuration` で、終了月の数え方が1ヶ月食い違っている。
6. **「話を聞いてみたい」が企業に届いた実績は0件。**
   - `ow_proposals` は**表ごと0行**。提案は担当者がいる企業にしか作られず、その条件に合う企業が無い。
   - 掲載22社のうち実在の担当者がいるのは自社（Opinio。担当者は柴さんの個人アカウント）だけで、自社は一覧から外れる。そのため**一覧の21社すべてで、押した結果は運営へのメールだけ**になる。
7. **職歴が無い人の「合う会社」は英字のアルファベット順**（Accenture → Anthropic → …）。点数が全部0になり、表示名順に並ぶ。実際に押された「アクセンチュア」は rank=1・理由なしだった。
8. **フィードの「新しく掲載された企業」に出るのは、非掲載の企業と古い投稿。**
   - `isCompanyPostAlive` は掲載状態（listing_status）を見ない。PKSHA・Ubie など非掲載の企業が出る。生きている company_joined 76件のうち56件が非掲載の企業のもの。
   - 最新の投稿も 6/09。最新の掲載企業（アクセンチュア 10/04・CTC）は migration で入れたため、投稿そのものが無い。
   - 見出しの「N社」は掲載中の22社を数えているので、中身と合っていない。
9. **フィードに実ユーザーの投稿は過去0件。** 直近30日に実ユーザーに見えた新しい投稿は company_joined の1件だけ。
10. **人の流れの材料はセールスフォース1社にしか無い。** 5人以上いる企業は1社（現役6・OB4）。職歴がある33人のうち22人は職歴が1件だけ。
11. **在籍企業の除外は過去の在籍も含むが、`get_blocked_companies()` は現職だけ。**
    - 「あなたに合う会社」と設定画面の「ブロック中の企業」は後者を使っている。そのため、判定（過去の在籍も含む）と表示・並び（現職だけ）がずれている。
    - グループ会社は手入力の `parent_company_name` を1段たどるだけ。日系の親会社は2件しか入っていない。
12. **公開中のプライバシーポリシー 5-1 は、企業に提供する場合を「次の場合に限り」と3つ挙げている。**
    - 提案や「合う会社」の「話を聞いてみたい」（会話を作り、氏名とプロフィールを企業に渡す）はどれにも書かれていない。
    - 文案 `docs/pending/privacy-20260921-根拠つき提案.md` はまだ適用されていない。
13. **社員を招待するとき、相手が既存ユーザーだと同意もメールも無しで即座に担当者になる**（`/api/biz/members/invite` → `addExistingUserToCompany`）。
14. 並行作業：未適用の `supabase/pending/20261023090000_company_contact_without_stance.sql` と、それを前提にした作業ツリーの `generate.ts` / `load.ts` がある。**適用とデプロイの順番に注意が要る。** 本番は今のところ「出さない」側にずれているので、安全側。

---

## 1. 結論の表

| # | 機能 | 判定 | 根拠 | 懸念 |
|---|---|---|---|---|
| A1 | 職歴ごとの入社後レビュー | **改修** | `ow_workplace_reviews`(+axes/tags)、`lib/workplaceReview/*`、`ExperienceReasonModal.tsx` | 実ユーザーの回答0。RLS は `company_id` と職歴の会社の一致を見ていない |
| A2 | 決め手・退職理由 | **改修**（旧データを活かす） | `ow_experiences.join_reasons/primary/leave_reasons`、`ow_experience_leave_reasons`、`careerReasons.ts` | 入力 UI が無い（API だけ）。★は任意（2つ以上選んだ18職歴のうち9職歴が★なし） |
| A3 | Q1 決め手（3つまで） | **既存を流用**（旧 `join_reasons`） | DB の CHECK `array_length<=3` | 語彙が v2（15値）と旧（12値）で割れている |
| A3 | Q2 次の会社に求めたこと（1つ） | **新規** | 該当する列なし | `join_reason_primary` と取り違えやすい |
| A3 | Q3 入社1年後のフィット（5段階） | **改修 or 新規** | `fit_score` は 0〜10 で、時点の指定が無い | forYou の 7以上 / 3以下 の閾値が尺度に依存している |
| A4 | 非公開・同意・削除 | **新規**（同意・停止・削除） | `statistics_opt_out` は参照0、レビュー削除の API なし | 規約の約束が実装されていない |
| A5 | 5人以上で集計（k匿名） | **改修** | `MIN_AGGREGATE_COUNT = 3`（`lib/constants/aggregate.ts:32`）を約10か所が使っている | shared_motive の n=1 が下限をすり抜ける |
| A6 | 在籍期間の集計 | **改修（バグ）** | `queries.ts:1839-1971`、`CompanyEmployeeSections.tsx:378-397` | 2人の表示がずれている。終了月の数え方の±1 |
| B7 | ログイン後の着地 | **既存** | `redirects.ts:95 DEFAULT_AFTER_LOGIN="/feed"` | /feed の中身がほぼ告知だけ。経路ごとに着地がばらばら |
| B8 | 合う会社の提案 | **改修** | `lib/forYou/rank.ts`、`weights.ts`、`react.ts`、`notifyOps.ts` | 職歴なしは英字順。企業に届く経路が実質0社 |
| B9 | 検索「◯◯を出た／来た／前職」 | **改修**（条件の型を足す） | `interpretQuery.ts:103-116`（向きの型が無い）、`runSearch.ts:651-720` | 前職は `destinationsForUsers` では作れず、`buildMoves` の流用が要る |
| B10 | 話を聞ける人 | **新規 or 見送り**（面談OKは撤去済み） | `ow_company_members` は参照0、DM の `request_topic` | 撤去の理由（話を聞かれる側にインセンティブが無い）が解けていない |
| C11 | 企業ページ「人の流れ」 | **新規**（材料は薄い） | `lib/evidence/transitions.ts buildMoves`、`ow_transitions` 20行 | 5人以上は1社だけ。前職を取れるのは31% |
| C12 | 企業ページの表示 | **改修** | `CompanyDetailPage.tsx`（取材記事・募集が0件でも空の箱を出す）、`FeedClient.tsx:2347-2388`、`visibility.ts:63-71` | 更新情報に6/3の日付。「今週更新」が8〜14日前にも出る。フィードと一覧が食い違っている |
| D13 | 双方合意の紹介 | **既存（経路）だが運用で止まっている** | `introduce.ts`、`respond.ts`、`openReason.ts` | 外部の掲載企業に実在の担当者0社。連絡先の列もほぼ空。規約 5-1 |
| D14 | 社員招待 | **既存（担当者の招待）／招待した社員を在籍者として出す仕組みは無い** | `/api/biz/members/invite`、`accept` | 既存ユーザーは同意なしで即追加。`ow_company_members` は死んでいる |
| D15 | 課金 | **既存（全機能を無料で開放中）** | `plans.ts:93-122`（free と paid が同じ）、`ow_company_plans` paid/active 0 | 根拠にしている規約の条文が未公開 |
| E16 | AI 貼り戻し・ATS・Slack・MCP | 貼り戻し=**既存の手本あり** ／ Slack=**既存（0社）** ／ ATS・MCP=**新規（見送り決定済み）** | `mypage/proposals/axes/AxesClient.tsx`、`lib/notify/slack.ts`、`docs/phase0-mcp-ats-20261015.md` | AI の SDK も環境変数も無い |
| F17 | 在籍企業・グループに出さない | **既存（主な経路で効いている）／改修**（ずれの解消） | `can_contact_without_stance()`、`contactGate.ts`、`openReason.ts`、`load.ts` | forYou と設定画面は現職だけを見ている。グループ判定は手入力1段。受け取らない企業の設定が一覧と提案に効いていない |

---

## A. データの土台

### A1. 入社後レビュー

**表の定義**（pg_catalog で実測）

- `ow_workplace_reviews`
  - 列: id / user_id（ow_users に CASCADE）/ experience_id（UNIQUE、CASCADE）/ company_id（SET NULL）/ fit_score / gap_job / gap_pay / gap_growth / gap_culture / overtime / office / english / memo / status / created_at / updated_at
  - CHECK: fit_score は 0〜10、gap_* は 0〜2、overtime・office・english は 0〜3、memo は1〜80字、status は required_done / complete。`required_check` で fit_score と gap の4つを必須にしている
  - RLS は操作ごと（authenticated）で、`user_id = auth_ow_user_id()`。insert と update は「本人の職歴であること」も確認する
  - GRANT: authenticated に S/I/U/D、anon はなし
- `ow_workplace_review_axes`
  - (review_id, axis_key) が主キー。value は 0〜4。RLS は親の行の EXISTS で本人に限る
- `ow_workplace_review_tags`: axes と同じ形
- マスタ `ow_review_axes` / `ow_review_fit_tags`: authenticated が `is_active` の行だけ読める
- 旧 reason_version=2 の6表: RLS 有効・ポリシー0本・service_role だけ
- `ow_experience_gaps`: authenticated に S/I/U/D、RLS で本人の職歴に限る

**いま聞いている設問**（`lib/workplaceReview/constants.ts` とマスタ）

- ①（必須）
  - 「この会社は、あなたに合っていましたか？」0〜10
  - 「入社前の期待と比べて、実際はどうでしたか？」仕事内容／年収・待遇／成長の機会／人間関係・カルチャー × 下回った／期待どおり／上回った
- ②「実際はどちら寄りでしたか？」6軸 × 5段階
  - 仕事の進め方（決まったやり方 ⇔ 自分で決める）
  - 立ち上がり（自分で調べる ⇔ 研修・先輩が教える）
  - 評価（成果の数字 ⇔ 行動やプロセス）
  - 決め方（上が決める ⇔ 現場で話し合う）
  - 変化（あまり変わらない ⇔ よく変わる）
  - 人との距離感（仕事上中心 ⇔ 仕事以外でも）
- ③（任意）
  - 残業: 10h未満／10〜20h／20〜40h／40h以上
  - 出社: フルリモート／週1〜2／週3〜4／ほぼ毎日
  - 英語: 使わない／読み書きのみ／会議で使う／日常的に話す
  - 「どんな人に合う会社だと思いますか？」8タグ: 自分で考えて動ける／変化を楽しめる／数字で評価されたい／じっくり育ちたい／チームで動きたい／専門性を深めたい／幅広く経験したい／仕組みを作るのが好き
  - 「入る前に知りたかったこと」80字まで
  - 「この会社を離れた理由は？」終了した会社だけ・3つまで・`LEAVE_REASONS` の13値（保存先は `ow_experience_leave_reasons`）
- ④ 本人の傾向（`tendency.ts`）

**件数**（全体 → 実ユーザー）

| 項目 | 全体 | 実 |
|---|---|---|
| ow_workplace_reviews 行 / 回答者 | 2 / 1 | **0 / 0** |
| review_axes / review_tags | 12 / 2 | 0 / 0 |
| 旧 join_reasons（空でない職歴） | 25 | **19（10人）** |
| join_reason_primary | 10 | 10 |
| 旧 leave_reasons（列） | 7 | **7（6人）** |
| ow_experience_gaps 行 | 114 | **107（19職歴・10人）** |
| ow_experience_leave_reasons | 2 | 0 |
| v2 ow_experience_reviews | 26 | 20（全部 reason_version=1。version=2 は実0） |
| v2 expectations / gap_shifts / notes / modal_closes | 3/0/0/0 | 0 |

⚠️ CLAUDE.md の「gaps 1件」（09-15）は古い数字。いまの実ユーザー分は107行。

**回答を読んでいる箇所**

- 入社後レビュー
  - `lib/workplaceReview/server.ts`（本人の分）
  - `api/jobseeker/experiences/[id]/review/route.ts`（GET/PUT）
  - `lib/forYou/rank.ts:95,189` → `weights.ts domainFitStatus`（本人の fit_score だけ）
  - `lib/admin/realFunnel.ts:58`（件数）
  - `lib/experiences/reasonAnswers.ts`
- 旧 join_reasons
  - `lib/evidence/fetch.ts:102,117,176,263-283`（**他人の決め手を集計 → shared_motive**）
  - `lib/evidence/materials.ts:58,85`
  - `lib/admin/evidenceGaps.ts:100,139,219`
  - `mypage/proposals/axes/page.tsx:39`
  - experiences の route と `toStint.ts`（本人の編集用）
- `ow_experience_gaps`: `mypage/page.tsx:380`、experiences の route（本人）
- `ow_transitions`: cron だけ（製品の画面は読まない）

### A2. 決め手・退職理由

- 定義は `lib/constants/careerReasons.ts`
  - `JOIN_REASONS` 12値、`LEAVE_REASONS` 13値、`REASON_MAX = 3`、`GAP_AXES` 6値
  - v2 の `EXPECTATIONS` は15値
- 入力
  - 旧の決め手・退職理由の入力 UI は**もう無い**（2026-09-12 に職歴モーダルから外れた）。API は今も `parseReasonFields` で受け付ける（`experiences/route.ts:327`、`[id]/route.ts:123`）
  - 退職理由だけは、入社後レビューの③から `ow_experience_leave_reasons` に書く
- 「3つまで」
  - UI と API: `parseSlugArray`（careerReasons.ts:513）
  - DB: `ow_experiences_join_reasons_check` / `leave_reasons_check`（`array_length <= 3`）
  - ⚠️ `ow_experience_leave_reasons` の表は件数を縛っていない
- 「★（primary）」
  - DB は「primary は join_reasons の中の値」だけを確認していて、必須ではない
  - 実データでは、2つ以上選んだ18職歴のうち**9職歴が★なし**
- 旧 join_reasons の内訳（実ユーザー）
  - 選んだ数: 1つ 1職歴 / 2つ 4職歴 / 3つ 14職歴
  - 値: skills 10 / salary 7 / autonomy・job_content・people・position 各5 / stability・work_style 各4 / culture 3 / evaluation・growth・personal 各1

### A3. 新しい3問との差分

| 新しい問い | 既存 | 判定 |
|---|---|---|
| Q1 決め手（3つまで） | 旧 `join_reasons`（12値・3つまで・実19職歴）／v2 `ow_experience_expectations`（15値・実0） | 旧の列で形は足りる。v2 には customer / next_career / management が増えている。どちらの語彙に寄せるかを決める必要がある |
| Q2 次の会社に求めたこと（1つ） | **なし**。`join_reason_primary` は「その会社の」一番の決め手。`ow_profiles.desired_*` は条件で、理由の語彙ではない | **新しい列か表が要る** |
| Q3 入社1年後に合っていたか（5段階） | `ow_workplace_reviews.fit_score`（0〜10・時点なし・必須） | 尺度と時点が違う。読み替えるなら forYou の閾値（7以上 / 3以下、`weights.ts`）も直す |

**既存の退職理由データの扱い**（実データは旧の列 7職歴・6人、新しい表は実0）

- **(a) 残す**: 影響なし。`server.ts` の `loadLeaveReasons` は「新しい表 → 無ければ旧の列」の順で読む
- **(b) 移す**（旧の列 → `ow_experience_leave_reasons`、または Q2 に読み替え）
  - 13値の語彙は同じなので機械的に移せる。読む箇所は `server.ts` だけ
  - ⚠️ 「辞めた理由」を「次に求めたこと」に読み替えるのは**意味が違うので推測の投入になる**
- **(c) 捨てる**: 本人のモーダルの初期値だけに影響し、集計には使っていない。ただし6人分は戻せなくなる

※ join_reasons を動かす場合は、shared_motive（`fetch.ts` / `engine.ts`）、`materials.ts`、`evidenceGaps.ts`、`proposals/axes`、DB の CHECK に波及する。

### A4. 誰に見えるか・同意・削除

| 対象 | anon | authenticated | 実際に読む経路 |
|---|---|---|---|
| ow_workplace_reviews / axes / tags | ✗ | ✓（RLS で本人だけ） | 本人の分・forYou（本人）・運営は件数だけ |
| ow_experiences.join_reasons ほか | ✗ | SELECT ✗ / UPDATE ✓ | admin クライアント。**evidence が他人の分を集計して、求職者と企業に根拠として出す** |
| ow_experience_gaps | ✗ | ✓（本人だけ） | 本人だけ |
| v2 の6表・ow_transitions | ✗ | ✗ | admin のみ |

- 同意
  - 表示への同意を持つのは `ow_experience_notes.display_consent*` だけ（v2 のひとこと用・実0件）
  - 入社後レビューと旧の理由には**同意の列が無い**
- 統計利用の停止: `ow_users.statistics_opt_out` は存在するが、**参照0件**（`auth/page.tsx:721` のコメントに「未配線」とある）。true の実ユーザーは0人
- 削除
  - 入社後レビューには**削除の API も UI も無い**（route は GET/PUT だけ）
  - 職歴を消せば CASCADE で消え、集計からも外れる
  - 旧の join_reasons を個別に消すには、API に空配列を送るしかない（UI は無い）
- ⚠️ `ow_workplace_reviews` の RLS は `company_id` が職歴の会社と一致するかを見ていない。本人は PostgREST から任意の company_id で書ける。会社ごとに集計し始めたら、値を汚される余地になる

### A5. 人数の下限

| 下限 | 場所 |
|---|---|
| `MIN_AGGREGATE_COUNT = 3` | `lib/constants/aggregate.ts:32` |
| 同上を使う箇所 | `evidence/engine.ts:215,283`、`evidence/fetch.ts:62`、`search/page.tsx:370,540,614,953`、`search/runSearch.ts:159,511`、`search/destinations.ts:47`、`admin/evidenceGaps.ts:157-165`、`forYou/weights.ts:20` |
| `MIN_COMPANIES_PER_BLOCK = 2` | `companies/industryMatchText.ts:52`（社数の下限） |
| LP の学校ファセット | `(jobseeker)/page.tsx:323-324`（5校・10人） |
| 構成バー（匿名化ではない） | `CompanyEmployeeSections.tsx:305,590`（3名以上） |

- 入社後レビューや退職理由を集計する処理は、まだ存在しない
- ⚠️ `engine.ts:215-224` は n<3 でも「挙げた人がいます」と出すので、**下限を回り込んでいる**

### A6. 在籍期間のバグ

**計算している箇所**

| 場所 | 単位 | 終了月の扱い |
|---|---|---|
| 企業ページの OB カード `CompanyEmployeeSections.tsx:378-397 calcTenure` | **レコード単位**（1人1行） | 補正なし |
| その元 `queries.ts:1839-1847`（OB を ended_at の新しい順に並べる）→ `:1922-1928 dedupeByUser`（最新の1行だけ残す）→ `:1971` | **最新ロールだけ** | — |
| プロフィール `MergedTimeline.tsx:449 companyTenure` ＋ `:497 groupSameCompanyEntries` → `lib/profile/tenure.ts:21-41 formatDuration` | **会社単位**（連続した同じ会社をまとめる） | +1ヶ月 |
| 右欄 `PanelProfileView.tsx:60-64` | レコード単位 | +1 |
| `/biz/candidates` 現職の在籍期間 `CandidatePreview.tsx:439-446` | 現職の1レコード | — |
| 自動スキル `autoSkills.ts:84-120` | 単純に足す（重なりは二重に数える。承知のうえ） | — |

**本番でずれている人**（実ユーザー・同じ会社に複数のレコードを持つ人は全3人）

| 人 | 会社 | レコード | 企業ページの表示 | 会社単位の期間 |
|---|---|---|---|---|
| 木村雅樹 | セールスフォース | 2021-11〜2024-12 / 2025-01〜2025-07 | **在籍6ヶ月** | 3年9ヶ月（補正なしなら3年8ヶ月） |
| 木村勇人 | セールスフォース | 2019-02〜2020-03 / 2020-04〜2025-01 | **在籍4年9ヶ月** | 約5年11ヶ月 |
| 大塚悠貴 | 海光電業 | 2012-04〜2018-07 / 2018-07〜2020-07 / 2020-07〜現在 | 現役は期間を出さないので影響なし | — |

（生藤弘樹さんにも同じ会社のレコードが2行あるが、auth_id が null なので表示から外れている）

- 本番にある隣接・重なりの形
  - 終了日と次の開始日が同じ日（大塚さん）
  - 12-31 → 01-01（木村雅樹さん）
  - 隣の月（木村勇人さん）
- 終了日の付け方も月初18件・月末3件と混ざっている

**修正方針の案**（修正はしていない）

- **案A（最小）**: `getCompanyEmployees` で、dedupe の前にユーザーごとの「最初の開始」と「最後の終了」を集めて渡す。期間は `formatDuration` に揃えて±1も解消する
  - 触るもの: `queries.ts:1883-1971`、`CompanyEmployeeSections.tsx:378-392`
  - 波及: `getJobEmployees`、`getCompanyEmployeesCached`
  - 弱点: 一度辞めて戻った人は、空白期間も在籍として数える
- **案B（プロフィールと同じ規則）**: `groupSameCompanyEntries` / `companyTenure` を `lib/profile/` に切り出し、企業ページも「連続した同じ会社のまとまり」で数える
  - 触るもの: `MergedTimeline.tsx`（移動だけ）、`queries.ts`、`CompanyEmployeeSections.tsx`
  - 利点: プロフィールと企業ページの数字が必ず一致する
  - 決めること: 戻ってきた人を「最新のまとまり」で数えるか「合計」で数えるか
- **案C（区間の和）**: 重なりを除いて月数を足す。空白は数えない
  - 最も正確。`autoSkills.ts` の二重計上の解消にも同じ関数を使える
  - 決めること: 終了月を含めるかどうか
- 共通: 職種のバッジ（いまは最新ロールだけ。「IS → AE」と出すか）と、`/biz/candidates` の「現職の在籍期間」をどう揃えるかも決める必要がある

---

## B. 求職者の体験

### B7. ログイン後の着地

- `DEFAULT_AFTER_LOGIN = "/feed"`（`redirects.ts:95`）。`afterLogin` は `/companies` と `/` を `/feed` に読み替える
- `DEFAULT_AFTER_ONBOARDING = "/mypage"`（:37）

| 経路 | 着地 |
|---|---|
| `/auth` でパスワードログイン（`page.tsx:280-282`）／ログイン済みで `/auth` を開く（:110） | next が無い・`/companies`・`/` のとき **/feed** |
| Google `/auth/callback`（:28-30 → :84-89） | オンボーディング完了済みで転職意欲も設定済みなら **/feed** |
| メール確認 `/auth/confirm`（:110、:214） | **/companies**（`afterLogin` を通らない）。⚠️ アプリにマジックリンクでのログインは無いので、通るのは確認リンクを開き直したときだけ |
| 新規登録 | `/onboarding` → **/mypage** |
| オンボーディング未完了／転職意欲が未設定 | `/onboarding*` → 完了後は **/mypage** |

**/feed の投稿件数**

| post_type | 全件 | 実ユーザー | 直近30日 | 生きているもの |
|---|---|---|---|---|
| company_joined | 81（すべてシステム） | 0 | 1 | 76（うち掲載中の企業 20） |
| job_posted | 75 | 0 | 1 | **2**（最新 06-08） |
| article_published | 12 | 0 | 0 | 12（最新 03-01） |
| user_post | 3（すべて検証用） | **0** | 3 | 実ユーザーの閲覧者には0 |

⚠️ フィードは「新しい順に20件取る → 検証用などを落とす」の順で処理している（`loadFeedProps.ts:124-129`）。そのため、実ユーザーの閲覧者には20件より少なく出る。

### B8. 合う会社の提案 /mypage/proposals

- **母集団**: 掲載中かつ公開中の企業から、自社・ブロック中・在籍中（`get_blocked_companies`＝**現職だけ**）・メッセージを受け取らない企業を除く
- **点数**（`weights.ts SIGNAL_WEIGHTS`）
  - role_opening 40: 公開求人の職種が、本人の職歴か希望職種と同じ系統
  - same_domain 30: 前の勤務先と同じ事業領域。フィット度が7以上なら40。すべて3以下なら理由にしない。主な事業領域なら +3
  - moved_from_domain 10: 本人の勤務先と同じ事業領域の会社から、この会社に移った人がいる（`buildMoves`）
  - phase_match 5: 希望フェーズが一致
  - 使っていないもの: 対象業界・入社理由・元同僚・他人のレビュー
- **同点のとき**: 点数 → シグナルの数 → 表示名（`localeCompare "ja"`）→ id
- **職歴が無いとき**: 希望職種が公開求人（2件・どちらもセールスフォース）と合うか、希望フェーズが合わない限り、全社0点になる。すると**表示名の英字順**に並ぶ（22社すべてが name_en を持っている）。理由が0件の人には `NO_REASON_PROMPT` と職歴追加へのリンクが出る
- **「話を聞いてみたい」を押したとき**
  - 上段（ow_proposals）: `respond.ts` → `introduceProposal()` が会話を作る → 企業にメール。**0行なので通らない**
  - 下段（ow_for_you_reactions、`react.ts`）: 一覧をサーバー側で作り直して、出ている会社か確かめる → upsert
    - 担当者あり: 会話を作り、企業にメール
    - **担当者なし**: ボタンの文言は「気になる」。`notifyOpsForYouInterest` が運営に1件ずつメールし、企業には届かない
    - 会話の判定が通らない: 記録だけして理由は返さない
- **実測**
  - 掲載22社のうち実在の有効な担当者がいるのは **Opinio だけ**（担当者は柴さんの個人アカウント）。セールスフォースの担当者2人はどちらも is_test
  - `ow_proposals` **0行**
  - `ow_for_you_reactions` 2行（実ユーザー2人・どちらも `later`、`interested_at` 0、`ops_notified_at` 1件＝アクセンチュア 10/22）

### B9. 検索

**「Salesforceから転職した人」が意図どおりにならない原因**

1. `interpretQuery.ts:103-116` の `Condition` に、**向き（出た・入った）を表す型が無い**
2. 「転職」が `collectUnresolved`（:958-986）で未解決として残る。画面の「点線のことばは…」は `search/page.tsx:497-501`
3. 会社の条件は「在籍したことがある」で当たる（`runSearch.ts:651-658`）。並べ替えは現役が先（:717-718）。離れた人は「〈会社〉を出た人の、いま」の枠（:712-713）に出る。`?tenure=former` で OB・OG だけに絞る仕組みはある（:720）
4. 本番の `ow_search_logs` にこのクエリの記録がある（10/26・unresolved=["転職"]・10件）。「30代で異業界から入った人」もある（unresolved=["異業界"]・0件）

**材料**（実ユーザーの職歴54行・33人）

- 会社の解決: company_id あり 47 / 自由入力だけ 7 / 匿名 0（解決率87%）
- 日付: started_at の欠損0、ended_at の欠損33（＝現職33と一致）
- 職歴が2行以上ある人 11、2社以上の人 10。隣り合う職歴で会社が変わったもの 17（うち両側ともマスタの会社 14）
- セールスフォースの例
  - 出た先: Quollio・CTC・アクセンチュア・フライル
  - 入る前: 三菱UFJモルガン・スタンレー証券・大塚製薬・みずほ証券・キーエンス
  - どれも1人ずつなので、人数は伏せる対象（3人未満）

**再利用できるか**

- `destinationsForUsers`（`destinations.ts`）は「渡された人の**いまの**職歴」を数えるだけ
  - 「出た人のいま」にはそのまま使える
  - 「入った人の前職」には使えないので、`buildMoves`（`lib/evidence/transitions.ts`）の流用が要る
- ⚠️ **企業ページは現状これを呼んでいない**（呼んでいるのは検索と学校のページだけ）

### B10. 話を聞ける人

- 面談OKは 2026-10-16 に撤去済み
  - `ow_company_members` 15行が残っているが、src からの読み書きは0件
  - `is_ambassador` / `can_casual_meeting` の列も残っている
- カジュアル面談: 全1行（検証用の人から Opinio 宛て）。実ユーザーの申込は0
- 企業からのメッセージ: 全2行（実ユーザー宛ては上の「テスト」の1件）
- 個人からのメッセージ: DM 10行（accepted 3 / pending 7）。実ユーザーどうしは2行
- 「話せるテーマ」: プロフィール側には**無い**
  - 近いのは送る側が選ぶ `request_topic` / `ask_topic`（`lib/constants/messageTopics.ts`）と、話す形の `request_format`
  - LP の `lpGuestMembers.quote` は `SHOW_PEOPLE_BAND=false` で表示されていない

---

## C. 企業ページ

### C11. 人の流れの材料

- 企業ごとの人数（実ユーザー・company_id 単位・1人1回）

| 企業 | 掲載 | 現役 | OB |
|---|---|---|---|
| セールスフォース | 掲載中 | 6 | 4 |
| 株式会社Opinio | 掲載中 | 2（★contact+52・+53） | 0 |
| 海光電業／プルデンシャル生命保険 | 非掲載 | 1 | 1 |
| SmartHR・アクセンチュア・CTC・Sansan・日本HP | 掲載中 | 1 | 0 |

  - **5人以上いる企業は1社**だけ
  - 掲載22社のうち、実ユーザーの職歴があるのは7社
  - セールスフォースの12行はすべて `login_only`。**未ログインの人には人の流れが1人も見えない**
- 前職・行き先の取れる割合（実ユーザーの職歴54件に対して）

| | 件数 | 割合 |
|---|---|---|
| 直前の職歴あり | 21 | 39% |
| 直前の会社が別の会社 | 17 | 31% |
| うち company_id あり | 16 | 30% |
| うち業界まで取れる | 16 | 30% |
| 直後の会社が別の会社 | 17 | 31% |
| うち業界まで取れる | 15 | 28% |
| 社内の異動 | 4 | — |
| うち職種が変わった | **4** | — |

  - 社内の職種変化の中身
    - セールスフォース: IS → エンタープライズセールス、IS → AE
    - 海光電業: FS → プリセールス → FS
  - 「IS→FS」のような社内の流れは、セールスフォース以外では取れない
- `ow_transitions`: 20行（日次の cron が動いている）
  - 実ユーザー17行。**auth_id が null の人の行が3行混ざっている**（`rebuild_ow_transitions()` は is_test は除くが、auth_id の null は除いていない）
  - 製品の画面は `ow_experiences` から `buildMoves` で組む。**社内の異動はどちらも数えない**ので、社内の流れを出すなら別に組む必要がある

### C12. 表示の現状

**企業ページのセクション**（`CompanyDetailPage.tsx`、ISR は300秒）

1. ヒーロー（更新バッジは30日以内のときだけ）
2. タブ（0件のタブは出さない）
3. 企業概要（常に出る）
4. つながり（0人なら出さない）
5. 社員・OB/OG（クライアントで取得）
6. 製品・導入事例（空なら出さない）
7. **募集: 0件でも空の箱を出す**（:1013-1050）
8. 福利厚生／企業資料／面談の CTA／組織体制／ツール／拠点・資本関係／企業からの投稿（いずれも空なら出さない）
9. **OPINIO 取材記事: 0件でも「まだ取材記事がありません」を出す**（:1248-1299）
10. 更新情報（company_joined 以外を最大5件。:1846-1888）
11. 末尾の CTA／採用担当者／担当者の入口

**本番 HTML で確認したこと**（未ログイン）

- 確認した7社すべてで「まだ取材記事がありません」が出る
- セールスフォースの更新情報は「**2026年6月3日** 募集を2件追加しました」（約5ヶ月前）
- `formatUpdated`（`src/app/companies/mockCompanies.ts:76`）は8〜14日前を「今週更新」と出す
- 更新バッジの元は `ow_companies.updated_at` なので、migration で値を変えただけでも日付が動く

**一覧とフィードの食い違い**

- /companies は22社で、PKSHA・Ubie は入っていない（9/14 に非掲載にした）
- フィードの流れ
  - `loadFeedProps.ts:163` → `isCompanyPostAlive`（`visibility.ts:63-71`）は is_published と is_test だけを見る
  - その結果を `FeedClient.tsx:2347 buildHomeRailItems` / `:2388` が「新しく掲載された企業」として出す
  - 見出しの N は `listedCompanyCount`（`loadFeedProps.ts:364`）
- PKSHA・Ubie が出る理由: どちらも `is_published=true`・`listing_status='draft'` で、company_joined の日付（6/09）が最も新しい
- company_joined は `admin/companies/actions.ts:175` と `api/admin/companies/[id]/route.ts:191-253` で作られる。**migration では作られない**ので、アクセンチュアと CTC には投稿が無い
- ⚠️ CLAUDE.md ⑨ には「`isCompanyPostAlive` に `listing_status` を足さない」とある（フィードに流れ続けることは承知のうえ）。ただしこれは**投稿をフィードに残す**ことについての判断で、「**新しく掲載された企業**」という見出しの枠に出すことまで想定していたかは別に判断が要る

---

## D. 企業側

### D13. 双方合意の紹介

- 担当者（`ow_company_admins`）
  - 24行、is_active 22（`user_id=null` の招待行1件を含む）
  - 有効な担当者がいる会社は14社。うち実在の担当者がいるのは4社: Opinio・Third Box（検証用の会社）・やめるラボ（draft）・株式会社エージェント（draft。担当者は「鈴木 太郎」）
  - **外部の掲載企業に実在の担当者は0社**
- `accepted_at` は2つある
  - `ow_company_admins.accepted_at`（招待の受け入れ）: 0件。招待以外の経路では書かれない
  - `ow_company_approaches.accepted_at`（＝返信した日時）: 2件中1件で、検証用どうしのもの
- 企業に何が開示されるか
  - 会話ができた時点で、氏名・アバター・お住まい・自己紹介・公開プロフィールが企業に見える（`biz/messages/[id]/page.tsx`）
  - メールアドレスと電話番号は出ない。出るのは応募のときだけ（`applications.ts:123`）
  - 会話ができる前の匿名は、`ow_proposals` を admin でしか読めないことで守っている
- 担当者がいない企業に運営が知らせる場合に要るもの
  - `notifyOps.ts` は運営に知らせるところで止まっていて、企業に送る経路は無い
  - 掲載22社の連絡先: `notification_emails` 0、`careers_url` 0、`casual_interview_url` 0、`recruiter_name` 0、`linkedin_url` 1、`url` 20。**送り先のアドレスが DB に無い**
  - 規約: 公開中のポリシー 5-1 の「次の場合に限り」、企業向け規約の「候補者の同意なく第三者に提供しない」（listing :111, :128）。担当者のいない企業は掲載規約に同意していない可能性がある（同意の状況は未確認）

### D14. 社員招待

- 動いているもの: `/biz/members` → `POST /api/biz/members/invite`
  - 未登録者には招待トークン（7日）とメールを送る → `/biz/auth/accept-invite` → `accept`（メールアドレスの一致を確認）
  - **既存ユーザーは同意なしで即座に担当者になる**
- 招待の行1件（`hshiba@third-box.jp`）は、コードが作る形（`is_active=false`）と食い違っている（`is_active=true`・`created_via=null`）。migration か手動で作られたと推測される
- 「社員を招待して在籍者として出す」仕組みは無い。`ow_company_members` は撤去済みで死んでいる

### D15. 課金

- `ow_company_plans`: free/active 93、paid/active **0**、paid/ended 1（Third Box）
- `plans.ts:93-122` の MATRIX: `candidateSearch` / `companyMaterials` / `companyApproach` が **free でも paid でも全部 true**
  - `applicantContact` は全企業に無料
  - スカウトは廃止済み（`ow_scouts` / `ow_scout_quotas` は DROP 済みと確認。`ow_scout_blocks` は残っていて0行）
  - `PAID_PLAN_MONTHLY_FEE = 80000`
- `/business/pricing` の「正式版に移る30日前までにお知らせ」と、plans.ts のコメントは、**未公開の改定文（9/29版）**を根拠にしている。公開中の掲載規約は 8/21 版のまま

---

## E. 接続

### E16. AI・ATS 連携の下地

- **貼り戻しの手本は既にある**: 「相性のものさし」（`mypage/proposals/axes/AxesClient.tsx`）
  - 流れ: 質問文を作る（`buildFitAxesPrompt`）→ AI の答えを貼る → 純粋関数で読み取る（`parseFitAxesAnswer`。テストあり）→ 本人が確認 → 確定した数字だけを保存。貼った本文はサーバーに送らない
  - `FIT_AXES_PUBLIC=false` で、いまは検証用アカウントだけが使える
- 貼り戻しを差し込める候補

| 場所 | 列 | 上限 |
|---|---|---|
| 自己紹介 | `about_me` | 2000字 |
| 肩書き | `headline` | 40字 |
| 職歴の業務内容 | `description` | 5000字 |
| 入社後レビューのメモ | memo | 80字 |

- 運営向けの「AI で企業情報を埋める」は 2026-10-16 に廃止済み
- Slack 通知: **実装済み・利用0社**
  - `lib/notify/slack.ts`、`/api/biz/slack`、`ow_company_slack_settings` / `ow_company_slack_sends`
  - 呼んでいるのは4か所（DM・面談・応募・企業からのメッセージ）
- ATS・webhook の受け口・MCP: コードは0件
- Anthropic・OpenAI: SDK も API 呼び出しも0件。環境変数も無い
- `docs/phase0-mcp-ats-20261015.md` の要点
  - **MCP と ATS は今は実装しない**（柴さんの決定）
  - 段階1は公開データだけ。本人のデータは OAuth を想定
  - 企業の AI に渡す求職者は「話を聞いてみたい」と答えた人だけ
  - ATS は HERP Hire の有料プランの企業と取引が決まってから
  - 着手の前提は「公開範囲の判定を1か所に寄せること」。Supabase Auth が OAuth の認可サーバーになれるかは未確認

---

## F. 信頼の仕組み

### F17. 在籍企業・グループ会社に出さない仕組み

**`can_send_scout`** ＝ 転職意欲 ＋ `can_contact_without_stance()`

**`can_contact_without_stance()` の条件**（本番の関数定義で確認）

1. 企業と候補者の is_test が一致する
2. グループ ＝ その企業自身 ＋ 同じ親（`parent_company_name` の正規化が一致）＋ 子 ＋ 親。**1段だけ**。`canonical_company_id` は0行で使われていない
3. 候補者の職歴の company_id がグループに含まれない（**過去の在籍も含む**）
4. 自由入力の社名が、グループの name / name_en / 親の名前 / 別名のどれとも一致しない（過去も含む）
5. 候補者がその企業の担当者でない
6. `ow_scout_blocks`（手動ブロック）に行が無い
7. `is_solicitation_blocked()` が false

見ていないもの: `visibility='private'`、`is_system`、`ow_approach_blocked_companies`（受け取らない企業の設定）

**経路ごとの確認**

| 経路 | 状態 |
|---|---|
| ① 提案の生成（`generate.ts`） | ✅ 効いている。⚠️ 受け取らない企業の設定は見ていない。:160 のコメント「現職だけ」は誤り |
| ② あなたに合う会社（`forYou/rank.ts:93-130`） | ⚠️ `get_blocked_companies`（**現職だけ**）を使う。過去の在籍企業とグループ会社が一覧に出る。押しても会話は開かず、記録だけになる（`react.ts:114-116`）。担当者がいない企業は判定なしで運営にメールが行く |
| ③ 検索 | 担当者による除外は無い。出すのは公開プロフィールの情報だけで、転職意欲は出さないので必要性は低い |
| ④ 候補者検索（`load.ts:131-140`） | ✅ 効いている（失敗したら誰も出さない）。⚠️ 受け取らない企業でも一覧には出る |
| ⑤ 企業からのメッセージ・返信・会話（`openReason.ts`）・DM（`contactGate.ts`） | ✅ 効いている。⚠️ 自社やグループ会社に応募すると、応募は届くが会話は開かない。⚠️ 担当者は同僚・元同僚に個人の DM を送れない（副作用。意図したものかは未確認） |
| ⑥ 企業ページ・`/biz/employees` | 自社の在籍者を見せること自体が目的。転職意欲・提案・興味は読んでいない |

- グループ会社は、手入力の `parent_company_name` が入っている67社だけ。ほとんどが外資の日本法人で、日系の親は2件（リクルートHD・伊藤忠商事）。孫会社と旧社名はたどれない
- 実データはすべて0行: `ow_scout_blocks` 0、`ow_approach_blocked_companies` 0、Slack 0

---

## 実装前に柴さんが決めるべき論点

1. **大塚悠貴さんに届いている「テスト」のメッセージリクエスト（企業から）をどうするか。** 取り下げる場合、本番の実データへの書き込みになるので、手順と了承が要る。あわせて `contact+52` / `+53` / 「鈴木 太郎」を is_test にするかどうか。
2. **入社後レビューの設問をどう作り変えるか。** 実データは0件なので、いまのうちなら壊さずに変えられる。Q1〜Q3 を `ow_workplace_reviews` に足すか、別の表にするか。
3. **Q1 の語彙を旧 `JOIN_REASONS`（12値・実19職歴）と v2 `EXPECTATIONS`（15値・実0件）のどちらに寄せるか。** 旧に寄せれば既存の実データがそのまま使える。
4. **Q3 の尺度。** 5段階に変えるなら、既存の `fit_score`（0〜10）と forYou の閾値（7以上 / 3以下）をどうするか。
5. **既存の退職理由データ（7職歴・6人）の扱い。** (a) 残す ／ (b) 新しい表に移す ／ (c) 捨てる。Q2 への読み替えは意味が違うので推奨しない。
6. **集計の人数下限を3人から5人に上げるか。** `MIN_AGGREGATE_COUNT` を変えると、検索・提案・学校など約10か所に一斉に効く。あわせて **shared_motive の n<3 の扱い**（いまは n=1 でも決め手を出す）。
7. **統計利用の停止（`statistics_opt_out`）を、既存の集計（shared_motive ほか）に配線するか。** 規約の約束を守るなら必要で、新しい集計を作る前に決めること。
8. **回答の同意と削除。** 入社後レビューを本人が消せるようにするか。同意の文言とその版を記録するか。プライバシーポリシーの改定が要るか（5-1「次の場合に限り」に、提案と合う会社の開示を足す件を含む）。
9. **在籍期間の修正方針。** 案A（最小）／案B（プロフィールと同じ規則・推奨）／案C（区間の和）。戻り入社の数え方、終了月を含めるか、職種バッジを「IS→AE」と出すか。
10. **検索の「◯◯を出た人／◯◯から来た人／前職」の出し方。** 他の条件と AND で組み合わせられる条件の型にするか、いまの「出た人のいま」のような別枠にするか。人数が3人未満のときの見せ方も。
11. **企業ページに「人の流れ」を出すか。** 材料がある企業はセールスフォース1社だけ。どの人数から出すか、未ログインに何を見せるか（いまは全員 login_only）。
12. **フィードの「新しく掲載された企業」を掲載中の企業だけにするか**（⑨の判断とは別の枠として）。migration で入れた企業にも company_joined を作るか。
13. **企業ページの空の箱（「まだ取材記事がありません」「現在、公開中の募集はありません」）を隠すか。** 古い更新情報と「今週更新」の文言をどう直すか。
14. **職歴が無い人の「合う会社」の並び**（いまは英字順）。何で並べるか。
15. **担当者がいない企業への「話を聞きたい人がいます」を、運営が企業に伝えるか。** 伝えるなら、連絡先をどこから得るか（DB には無い）、規約との関係、何を伝えるか（人数だけか）。
16. **在籍企業の判定を揃えるか。** `get_blocked_companies()`（現職だけ）を `can_contact_without_stance` と同じ基準（過去も・グループも）にするか。受け取らない企業の設定を候補者一覧と提案にも効かせるか。グループ会社の情報（日系の親子関係）を入れるか。
17. **社員招待で、既存ユーザーを同意なしで担当者にしている点を直すか。**
18. **未適用の pending migration（`20261023090000`）と作業ツリーの変更**を、どの順番で適用・デプロイするか（並行セッションの作業）。
