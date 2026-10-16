# フェーズ0調査: 「AIが代わりに探す・根拠付き」はどこまで実装されているか

**実測日: 2026-09-28**（DB は本番。SQL はすべて読み取りのみ ——接続が read-only で
`CREATE FUNCTION` が 25006 で弾かれたことを確認済み。コード・migration・設定は1行も変更していない）

⚠️ 件数はすべて 2026-09-28 時点。**引用する前に測り直すこと**（CLAUDE.md「件数・統計値の記載ルール」）。

---

## 1. 結論（5行）

1. **「AI」は1バイトも無い。** LLM の SDK・import・APIキー・外向き呼び出し・Edge Function が**5経路すべて0件**。
2. **「探す」は実装済みだが全部ルールベース**で、しかも**求職者→企業の提案（②）と企業→求職者の提案（⑨）は
   同じエンジンで書けており、0件生成のまま**（`ow_proposals` 0行・生成は運営の手動ボタン）。
3. **根拠は「結果データ型」に寄せる設計になっているが、実データは自己申告型でしか埋まっていない。**
   根拠4種のうち結果データ型は2種（`same_path` / `shared_motive`）だが、**最大 n=1** で
   集計下限（`MIN_AGGREGATE_COUNT = 3`）に**1件も届かない**ため、割合を1つも出せない。
4. **今日たまたま提案が2件だけ作れる状態**にある（下記 §4-B）。ただしその2件の内訳は
   **結果データ1本（1人が移った）＋ 自己申告1本（希望フェーズ）**で、しきい値 `2` をぎりぎり満たすだけ。
5. **⑦（入社後の納得度）は器だけ完成している**（`ow_post_hire_reports` 12列・**0行・src 参照0件**）。
   立ち上げ期の供給源になりうる `/admin/placements`（就職実績・`resigned_at` / `resignation_reason` を持つ）も
   **画面は生きていて 0行**。

> **一言でいえば**: 「根拠付きで探す」の**骨と器は組み終わっていて、通っている血は自己申告型だけ**。
> 結果データ型は構造として用意され、入口も開いているが、**実データが集計下限に届いていない**。

---

## 2. 9画面の対応表

判定は **完了 / 部分的 / 未着手 / 痕跡のみ**（テーブルか死んだコードだけある）。

| # | 画面 | 状態 | 根拠の種類 | 関連テーブル（行数） | 根拠（ファイル:行） |
|---|---|---|---|---|---|
| ① | キャリアAI（求職者ヒアリング） | **痕跡のみ** | — | なし | [careerAI/resolve.ts](../src/lib/careerAI/resolve.ts)（243行・**呼び出し元0件**）／ [masters.ts](../src/lib/careerAI/masters.ts) ／ [resolve.test.mjs](../src/lib/careerAI/resolve.test.mjs) |
| ② | 根拠つきフィット提案（求職者向け） | **完了（コード）／ 0件（データ）** | **結果2 + 自己申告2** | `ow_proposals` **0** | [evidence/engine.ts:159](../src/lib/evidence/engine.ts) `buildEvidence` ／ [fetch.ts:161-300](../src/lib/evidence/fetch.ts) ／ [mypage/proposals/ProposalsClient.tsx:52](../src/app/(jobseeker)/mypage/proposals/ProposalsClient.tsx) |
| ③ | 双方合意の紹介フロー | **完了** | — | `ow_proposals.introduced_at` / `conversation_id`（0） | [proposalResponses.ts:47](../src/lib/constants/proposalResponses.ts) `ProposalStage` ／ [introduce.ts](../src/lib/evidence/introduce.ts) `introduceIfMutual` |
| ④ | 反応の学習ループ | **部分的（記録のみ・学習なし）** | — | `ow_proposal_declines` **0** | 書き込みは [respond.ts:71](../src/lib/evidence/respond.ts) の**1箇所だけ。読む箇所は0件** |
| ⑤ | 企業側の要件ヒアリング | **未着手** | — | なし | `/biz/jobs/new` は素のフォーム（[page.tsx:3](../src/app/biz/jobs/new/page.tsx) → `JobEditForm`）。「ヒアリング/対話形式/チャット」は `src/app/biz` + `src/components/business` で**0行** |
| ⑥ | 面談前のすり合わせメモ | **未着手** | — | なし | src の該当4行はすべて別文脈（カジュアル面談フォームの注意書き等） |
| ⑦ | 入社後の納得度サーベイ | **痕跡のみ（器は完成）** | 結果データ型 | **`ow_post_hire_reports` 0**（12列） | `.from("ow_post_hire_reports")` の src 参照 **0件**。列: `months_after, culture_match, workstyle_match, salary_match, overall_satisfaction, good_points, concerns, gap_from_expectation, would_recommend, is_published` |
| ⑧ | 透明性と同意 | **部分的（開示あり・同意なし）** | — | — | 開示: [EvidenceList.tsx](../src/components/proposals/EvidenceList.tsx) が根拠ラベル＋**反証を必ず1件以上**出す（`kind:"unknown"`＝「確かめていない」）。同意: **「提案」が `content/legal/*.md` 8本すべてで0件**（対照: `privacy-policy.md` の「スカウト」は13件）。文案は [docs/pending/privacy-20260921-根拠つき提案.md](pending/privacy-20260921-根拠つき提案.md) に**未適用** |
| ⑨ | 企業への候補者提案 | **完了（コード）／ 0件（データ）** | **②と同一エンジン** | `ow_proposals` **0** | [biz/proposals/page.tsx:18](../src/app/biz/proposals/page.tsx)（★`ow_users` を一切 select せず匿名を担保）／ [api/biz/proposals/[id]/respond](../src/app/api/biz/proposals/[id]/respond/route.ts) |

### ③ の追加確認（指示にあった2点）

| 問い | 答え |
|---|---|
| 双方合意を記録する状態があるか | **ある。** `ow_proposals` に `candidate_response` / `company_response` / `introduced_at` / `conversation_id`。段は列で持たず **`proposalStage()` が2列から導出**（`proposed` / `candidate_only` / `company_only` / `mutual` / `closed`） |
| 合意前に氏名・企業名を伏せるか | **候補者側だけ伏せる。** 企業名は最初から出す。担保は**画面が `ow_users` を select しないこと**＋ DB 側で `ow_proposals` / `ow_proposal_declines` が **RLS 有効・ポリシー0本・anon/authenticated に GRANT 無し**（admin クライアント専用） |

### ④ の追加確認

**表示・クリックを記録するテーブルもイベントも無い。** `impression` / `viewed_at` / `clicked` / `opened_at` /
`seen_at` の src 該当9行はすべて `ops_reviewed_at`（運営の確認済みフラグ）と `reviewed_at`（企業参加申請）で、提案とは無関係。

記録されるのは**明示的な返答だけ**（`interested` / `declined` ＋ 見送り理由1つ）。
`ow_proposals_unique (candidate_user_id, company_id, job_id)` ＋ `on conflict do nothing` により
**一度出した組み合わせは二度と出ない**が、これは**抑制であって学習ではない**
（過去の見送り理由を次の生成が読む箇所が0件）。

---

## 3. LLM 呼び出し箇所の一覧

**0件。** 5つの独立な確かめ方すべてで0。

| # | 確かめ方 | 結果 |
|---|---|---|
| ① | `package.json` の依存 | AI系SDK **0**（`@anthropic-ai` / `openai` / `@ai-sdk` / `langchain` いずれも無し） |
| ② | src の import / 外部APIホスト | **0行**（`from "@anthropic-ai\|openai\|@ai-sdk\|langchain\|@google/generative\|cohere-ai\|ollama"`、`api.openai.com`、`api.anthropic.com`、`generativelanguage.googleapis`、`bedrock-runtime`、`/v1/chat/completions`、`/v1/messages`） |
| ③ | 環境変数のキー名 | **0**（`.env.local` は10キー。`ANTHROPIC\|OPENAI\|GOOGLE_AI\|GEMINI\|AZURE_OPENAI\|COHERE\|HF_` は0） |
| ④ | 外向き fetch のリテラル URL | **0**（唯一の任意URL fetch は [content-links/ogp/route.ts:59](../src/app/api/jobseeker/content-links/ogp/route.ts) の OGP 取得） |
| ⑤ | Supabase Edge Functions | **0件**（`list_edge_functions` が空） |

**陽性対照**: 同じ探し方で `resend`（実在する SDK）は `src` の5ファイル以上に当たる。

### 「AI」に見えて AI でないもの

| 場所 | 実体 |
|---|---|
| `src/lib/careerAI/` | ①の**マスタ解決だけ**を実装した純粋関数（243行）。「LLM が返した語をマスタに解決する」前処理で、**LLM を呼ぶ側が存在しない**（呼び出し元0件）。設計は [career-ai-design-20260921.md](career-ai-design-20260921.md) |
| `/search` の自然言語検索 | **ルールベース。** [interpretQuery.ts:48](../src/lib/search/interpretQuery.ts) が「④ **LLM はまだ入れていない**」と明記。戻り値の形（`InterpretResult`）を保てば中身だけ差し替えられる設計 |
| `ProductsClientsSection.tsx:55` | 製品名に `ai|ml|llm|gpt` が含まれるかの**正規表現**（アイコン選び） |

---

## 4. 提案・「あなたに合う」表示の一覧と、それぞれの算出根拠

### 4-A. 一覧

| 画面 | 表示名 | 算出方法 | 実行タイミング | **根拠の素材** |
|---|---|---|---|---|
| `/jobs` 最下部 | 「あなたへのおすすめ」 | `computeRecommendations`（[scoreJob.ts:217](../src/lib/matching/scoreJob.ts)）。重み付きスコア | 画面表示時（`GET /api/jobseeker/recommendations`） | ★**自己申告型のみ**（希望職種・希望年収・希望フェーズ・希望勤務形態 × 求人票） |
| `/mypage/applications` | 「おすすめ」 | 同上 | 画面表示時 | ★**自己申告型のみ** |
| `/mypage` | 「◯◯の経験が活きる会社」 | [industryMatch.ts](../src/lib/companies/industryMatch.ts)。職歴の業種 × 企業の対象業界（軸2）。`vertical` のみ | 画面表示時 | **属性の突き合わせ**（職歴→企業マスタの `industry_id` × 運営が入れた対象業界）。★結果データではない |
| **`/mypage/proposals`** | **「あなたへの提案」** | **[evidence/engine.ts](../src/lib/evidence/engine.ts) `buildEvidence`** | ★**運営の手動ボタン**（`/admin/proposals`。cron 無し） | ★**結果2種 + 自己申告2種**（下記 4-C） |
| **`/biz/proposals`** | 企業向けの提案 | **②と同一のスナップショット**（`ow_proposals.evidence`） | 同上 | 同上 |
| `/search` | 「なぜマッチしたか」 | [PersonHitCard.tsx:57](../src/app/(jobseeker)/search/PersonHitCard.tsx) の `matchReason` | 検索時 | 自己申告型（職歴の語との一致） |
| `weekly-match`（**停止中**） | 週1のおすすめメール | `computeRecommendations`（同じ関数） | cron（**登録なし**） | 自己申告型 |

⚠️ **文言はすべてデータから生成**されており、ハードコードの「合う理由」は見つからなかった
（`scoreJob` の `reasonParts`、`matchCompanyPreference` の返り値、`buildEvidence` の `label`）。
かつて存在した捏造フォールバック（`matchScore: 75` / `getDefaultReason()`）は削除済み。

### 4-B. ★今日、提案は何件作れるか → **2件**

`generate.ts` の母数の絞り方（掲載 → 在籍企業を除く → **有効な管理者がいる企業**）と
`buildEvidence` / `isProposable`（**根拠2本以上**）を SQL で再現した結果:

| 候補者 | 企業 | same_path | shared_motive | talkable | preference_match | 本数 | 判定 |
|---|---|---|---|---|---|---|---|
| `48b3006a` | セールスフォース | **1** | 0 | 0 | **1**（希望フェーズ） | **2** | ★**提案できる** |
| `d075adbf` | セールスフォース | **1** | 0 | 0 | **1**（希望フェーズ） | **2** | ★**提案できる** |
| `2b7a05c4` | セールスフォース / Opinio | 0 | 0 | 0 | 0 | 0 | — |
| `e826e0bd` | セールスフォース / Opinio | 0 | 0 | 0 | 0 | 0 | — |
| （全員） | 株式会社Opinio | 0 | 0 | 0 | 0 | 0 | — |

**絞り込みの内訳**（すべて実測）:

| 段 | 残る数 |
|---|---|
| 掲載企業（`listed` かつ `is_published` かつ `is_test=false`） | **21社** |
| ↑のうち**有効な管理者がいる**（`ow_company_admins.is_active`） | ★**2社**（Opinio / セールスフォース）＝ **19社が母数から落ちる** |
| 実ユーザー（`is_test` / `is_system` / `auth_id IS NULL` / `@opinio.co.jp` を除く） | **8人** |
| ↑のうち `isReachableByCompanies`（`career_stance` が設定済みかつ ≠ `no_contact`） | **4人**（未設定2 / `no_contact` 2） |
| (候補者 × 企業) の組 | **8組** → うち根拠2本以上 **2組** |

⚠️★**これは SQL による再現で、`/admin/proposals` の生成ボタンは押していない**（読み取りのみの指示のため）。
   `normPhase()`（[scoreJob.ts:59](../src/lib/matching/scoreJob.ts)）が `"上場"` と `"listed"` を
   同じ値に畳むことをコードで確認したうえで、SQL 側も同じ畳み方を入れて数えた。
   **実際に作られる保証ではない**が、「1件も作れない」ではないことは言える。

⚠️ セールスフォースの有効な管理者2人は**両方 `is_test`**。
   ＝ 提案は作れても**実在の人が「会いたい」を押す経路は無い。**

### 4-C. 根拠4種と反証4種の分類 ★これが本題

| 根拠 | 素材 | **分類** | 今日の最大 n |
|---|---|---|---|
| `same_path` | `ow_experiences` の隣接ペア（誰がどこからどこへ移ったか） | ★**結果データ型** | **1** |
| `shared_motive` | `ow_experiences.join_reasons`（在籍者の決め手 ∩ 候補者の決め手） | ★**結果データ型** | **0**（成立せず） |
| `talkable` | `ow_company_members`（面談OKの申告） | **自己申告型**（状態） | 0（対象2社にはいない） |
| `preference_match` | `ow_profiles.desired_*` × 企業/求人の属性 | **自己申告型** | 1 |

| 反証 | 素材 | 分類 |
|---|---|---|
| `short_tenure` | 在籍期間（`started_at` / `ended_at` が1年未満） | ★**結果データ型** |
| `salary_gap` | 希望年収 × 求人の提示レンジ | 自己申告型 |
| `work_style_gap` | 希望勤務形態 × 求人/企業の値 | 自己申告型 |
| `unknown` | 「確かめていない」 | ★**省略の代わりに必ず出す** |

⚠️★**設計は結果データ型を優先している**（`same_path` が並び順の先頭、`ow_transitions` を
   読まず正である `ow_experiences` から組む、`n < 3` では割合を出さない）。
   **実データが届いていないだけ。**

---

## 5. 結果データの素材の実測値（除外前 / 除外後）

「除外後」＝ `is_test=false` かつ `is_system=false` かつ `auth_id IS NOT NULL` かつ
email が `@opinio.co.jp` でない **実ユーザー8人**に紐づくもの。

### 5-1. 母集団

| | 件数 |
|---|---|
| `ow_users` 全体 | **58** |
| `is_test = true` | 47 |
| `is_system = true` | 1 |
| `auth_id IS NULL` | 2 |
| `@opinio.co.jp` のメール | 47 |
| **実ユーザー（opinio 除外前）** | **9** |
| ★**実ユーザー（opinio 除外後）** | ★**8**（gmail 6 / icloud 1 / yamerulab.jp 1） |

### 5-2. 素材

| 素材 | 除外前 | ★除外後 | 備考 |
|---|---|---|---|
| `ow_experiences` | 46 | **15** | — |
| 職歴がある実ユーザー | — | **5人** | |
| ★**職歴2社以上の実ユーザー** | — | ★**4人** | 遷移が作れる母数 |
| `ow_transitions` | 10 | **7** | ★**最終洗い替え 2026-09-18 18:00 UTC**（§6参照） |
| `join_reasons` が非空 | 8 | **3** | |
| `join_reason_primary`（決め手） | 2 | **2** | ★**1社（セールスフォース）に1件だけ** |
| `leave_reasons` が非空 | 1 | **1** | |
| `ow_experience_gaps` | 19 | **18** | ★**1人・3職歴・1社**（6軸×3）。行数が多いのは軸が6つあるため |
| `ow_post_hire_reports`（⑦） | **0** | 0 | 器のみ・src 参照0件 |
| `ow_placements`（就職実績） | **0** | 0 | 画面は生きている |
| `ow_proposals` / `ow_proposal_declines` | **0** / **0** | 0 / 0 | |
| `ow_casual_meetings` | **0** | — | 面談の成立は0件 |
| `ow_job_applications` / `ow_scouts` | **0** / **0** | — | |
| 掲載中の面談OK（実人数） | 8 | **5** | `ow_company_members` 全11行 |

### 5-3. ★集計のしきい値を満たす企業 → すべて 0社

| 集計 | しきい値 | 満たす企業 |
|---|---|---|
| 入社の決め手 | 3件 | ★**0社**（最大1件） |
| 退職理由 | 5件 | ★**0社**（最大1件） |
| `MIN_AGGREGATE_COUNT`（割合を出してよい下限） | 3人 | ★**0社**（`same_path` 最大 n=1） |

**`same_path` の全量**（掲載企業への遷移・実ユーザーのみ）——これが「結果データ」の現在の全体像:

| 移った先 | 移る前の職種 | 人数 |
|---|---|---|
| 伊藤忠テクノソリューションズ | アカウントエグゼクティブ | 1 |
| セールスフォース・ジャパン | フィールドセールス | 1 |
| セールスフォース・ジャパン | 営業 | 1 |

### 5-4. 在籍期間（定着）は計算できるか → **できるが10行だけ**

| | 件数（実ユーザー） |
|---|---|
| 職歴 | 15 |
| `started_at` あり | **15**（100%） |
| `ended_at` あり | 10 |
| 現職（`is_current`） | 5 |
| 退職済みなのに `ended_at` が無い | ★**0**（矛盾なし） |
| ★**在籍期間が確定する行** | ★**10** |
| 同一人物 × 同一企業が複数行（出戻り/役割複数） | **2** |

⚠️ 出戻り・並行在籍の扱い: `rebuild_ow_transitions()` と [transitions.ts](../src/lib/evidence/transitions.ts) は
   **`started_at, coalesce(ended_at,'9999-12-31')` で並べた隣接ペア**を取り、
   同一性キー（`company_id` → 正規化社名 → 行ごと）が**変わったときだけ**1件とする。
   ＝ 同じ会社の役割2行は遷移にならない（正しい）。**出戻りは A→B→A が2件の遷移になる**（仕様どおり）。

---

## 6. CLAUDE.md・docs との差分（★直していない。列挙のみ）

| # | 記述 | 実測（2026-09-28） |
|---|---|---|
| 1 | CLAUDE.md:3030「**2026-09-21 時点では提案が1件も作れない。それが正しい状態。**」 | ★**2件作れる**（§4-B）。`career_stance` が埋まり `same_path` が増えたため。⚠️ ただし**日付つきの記述**なので当時は正しかった可能性がある |
| 2 | CLAUDE.md:4294「入社理由あり **5行** / 退職理由 **0** / 決め手 **0** / `ow_experience_gaps` **1**」（2026-09-15） | **8行 / 1 / 2 / 19**。★とくに**ギャップが1→19**（1人が3職歴×6軸を回答） |
| 3 | CLAUDE.md:5656「（スカウトの）**現在有料は0社**」 | **1社**（株式会社Third Box・2026-09-20 作成）。⚠️ ただし **`is_test = true` かつ `listing_status = draft`** なので実企業は0社のまま |
| 4 | [industryMatch.ts:18](../src/lib/companies/industryMatch.ts) / [IndustryMatchSection.tsx:88](../src/components/mypage/IndustryMatchSection.tsx)「`ow_transitions` が**5行**しかなく」 | **10行**（実ユーザー7行）。★**判断（遷移由来の「◯人が移った」を入れない）は今も妥当**——最大 n はまだ1 |
| 5 | [transitions.ts:21](../src/lib/evidence/transitions.ts)「鮮度は `/api/cron/rebuild-transitions` が保つ」 | ★**最終洗い替えが 2026-09-18 18:00 UTC で、10日走っていない。** `built_at DEFAULT now()` かつ関数は `DELETE ... WHERE true` → `INSERT` なので、走れば必ず更新される。`vercel.json` に `0 18 * * *` で登録済み。**原因は未確認**（Vercel の実行ログを見ていない）。⚠️ **製品の画面はこの表を読まないので利用者への影響は無い** |
| 6 | docs/phase0-9screens-20260918.md:31「`ow_users` 全体 **48**」 | **58**（10日で10行増。ほぼ `is_test`） |
| 7 | docs/phase0-9screens-20260918.md ★2「決め手は実ユーザーで**0件**」 | **2件**（セールスフォース1社） |
| 8 | docs/phase0-9screens-20260918.md ★4「`ow_transitions` … いま流し直すと **5 → 7行**」 | **10行**（予測の7行を上回った） |

⚠️ 上記のうち **1・3・5 以外は「数字が古くなった」だけで、判断は変わっていない。**

---

## 7. ★調査方法の注意（次に同じ調査をする人へ）

**`grep` が1ファイルを黙って読み飛ばす。** この調査中に実際に誤った結論を出しかけた。

このセッションの `grep` は shell 関数で、**ugrep を `-I`（バイナリを飛ばす）付きで呼ぶ**。
`LC_CTYPE=C` のため**非ASCIIの密度が高いファイルが「バイナリ」と判定され、警告も出さずに0件になる。**

| | |
|---|---|
| 実害 | `src/lib/search/searchLog.ts` を「`ow_search_logs` の参照0件」と誤判定した（実際は `.from("ow_search_logs")` が存在する）|
| 盲点の大きさ | **750ファイル中1ファイル**（`import` を含むファイルで照合: 本物 614 / wrapper 613）|
| 原因 | 6KB の中に箱罫線 `─` が **114個**。先頭の見出しコメントで非ASCII率が閾値を越える |
| 対処 | **`LC_ALL=C command grep`** を使う（`command` で shell 関数を迂回）|
| 自己テスト | `LC_ALL=C command grep -rl "ow_search_logs" src --include='*.ts'` が **searchLog.ts を返すこと**を先に確かめる |

⚠️★**「0件」を報告する前に、必ず既知の当たりで検出器が効くことを確かめること**
   （`.claude/rules/ui-debugging.md` ⑱）。本レポートの0件はすべてこの自己テストを通してから数えている。

---

## 8. 次に着手するなら（判断材料。★実装はしていない）

### 候補A ——⑦の配線（器が完成しているものを繋ぐ）

| | |
|---|---|
| なぜ | `ow_post_hire_reports` は**12列すべて揃って0行・参照0件**。「結果データ型の根拠」に**直接なる唯一の空き地** |
| 作る量 | 回答画面1つ ＋ API 1本 ＋ 集計の読み手。**テーブル・CHECK・RLS は既にある**（要確認） |
| ★効く理由 | いま根拠が自己申告型に寄っているのは、**結果データの入口が「本人が職歴のついでに答える」1本しかない**ため。⑦は「入社後に聞く」という**別のタイミングの入口**を足す |
| ★止まる点 | **母数が無い。** `ow_placements` 0行・`ow_job_applications` 0行 ＝「入社した人」を1人も知らない。**誰に送るかが決まらない** |

### 候補B ——運営面談（Opinio Career）から結果データを入れる経路

| | |
|---|---|
| なぜ | ★**いま運営が「決め手・退職理由・納得度」を入れる経路が1つも無い。** `/api/admin/experiences/[id]` の PATCH は **`company_id` しか更新しない**（実測）。`join_reasons` / `leave_reasons` / `ow_experience_gaps` を書くのは `/api/jobseeker/experiences`（本人）だけ |
| 作る量 | `/admin` に既存の設問（`careerReasons.ts` の 入社12 / 退職13 ＋ 6軸のギャップ）を運営が代理入力する画面 |
| ★効く理由 | 集計下限（決め手3件・`MIN_AGGREGATE_COUNT` 3人）に届くのが**現実的に最短**。面談は既に行われていて、**データだけが OPINIO の外にある** |
| ★止まる点 | **本人の同意。** 面談で聞いた内容を本人のプロフィールに書くのは、いまの規約に根拠が無い（⑧と同じ穴）。**入力欄より先に同意の設計** |

### 候補C ——②⑨を「作れるのに作っていない」状態の解消

| | |
|---|---|
| なぜ | ★提案は**2件作れる**のに `ow_proposals` は0行。生成は運営の手動ボタンのみ |
| ★止まる点 | **押しても行き止まり。** 対象2社のうちセールスフォースの管理者2人は**両方 `is_test`**。掲載21社中**19社は有効な管理者が0人**で母数から落ちている。★**コードの問題ではなく、企業側の担当者登録の問題** |
| 判断 | 提案を出す前に**⑧（規約への「提案」の追記）が要る**——`content/legal/*.md` 8本で「提案」は**0件**。文案は `docs/pending/` に2本あり未適用 |

### ★私の見立て（1つ選ぶなら **候補B**）

A と C はどちらも**「入口はあるのに母数が無い」**で同じ壁に当たる。B だけが
**既に存在する面談という行為を、データに変える**話で、母数を自前で増やせる。
ただし**同意の設計が先**で、それは実装ではなく判断。

---

## 9. 未確認（理由つき）

| 項目 | 理由 |
|---|---|
| `rebuild-transitions` の cron が 2026-09-18 以降走っていない原因 | Vercel の実行ログを見ていない（この調査はコード・DBの読み取りに限定した）。`CRON_SECRET` 未設定なら 500、Vercel 側のプラン制約なら不発火 ——**どちらかは切り分けていない** |
| §4-B の「2件作れる」が実際に生成されるか | `/admin/proposals` の生成ボタンを押していない（書き込みになるため）。SQL による再現であり、`gatherCompanyFacts` の全分岐を再現したわけではない |
| `ow_page_views` の67行を誰が書いたか | 現在の src に書き手が**0件**。migration に anon の INSERT ポリシーを残した記述はあるが、書いていたルートは見つからなかった（削除済みと推測。**未確認**） |
| `ow_post_hire_reports` の RLS / GRANT / CHECK の現状 | ⑦の配線に必要だが、今回は行数と列構成・参照0件までしか測っていない |
| `/dev/preview/proposals` の見た目 | dev サーバーが別セッションのものなので触っていない |
