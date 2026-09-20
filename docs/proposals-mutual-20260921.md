# ③ 双方合意の紹介フロー — 何から作るか

**調査日: 2026-09-21**
関連: [proposals-20260918.md](proposals-20260918.md)（②⑨④の第1弾）／
[phase0-9screens-20260918.md](phase0-9screens-20260918.md)（9画面の調査・③は §B-5 と第3段）

---

## 0. 一行で

**③で新しく設計が要るのは「開示」だけ。匿名で出す前半は既にできていて、
画面は「双方が会いたいと答えたときに初めてお互いが分かります」と**既に約束している**。
残っているのはその一文の後半だけ。**

⚠️★**ただし、いまは mutual が原理的に起こせない。** 提案が0件で、`/proposals` への
導線も通知も無い。**まず「②の返答が起きる状態」を作らないと、③は検証できない。**

---

## 1. いまどうなっているか（2026-09-21 実測）

### 1-1. できているもの

| 何 | 実体 |
|---|---|
| 両側の意思を持つ列 | `ow_proposals.candidate_response` / `company_response`（`20260918180000_proposals.sql`） |
| 段の導出 | [`proposalStage()`](../src/lib/constants/proposalResponses.ts) — `proposed` / `candidate_only` / `company_only` / **`mutual`** / `closed` |
| 返答の保存（②⑨共通） | [`saveProposalResponse()`](../src/lib/evidence/respond.ts)。**2本の route はこれを呼ぶだけ** |
| ★**匿名で企業に出す**（③の前半） | [biz/proposals/page.tsx](../src/app/biz/proposals/page.tsx) が **`ow_users` を1列も select しない**。これが担保 |
| 会話を作る器 | [`create_conversation` RPC](../src/lib/conversations/createConversation.ts) ＋ `ow_conversations` / participants / messages |
| 会話が動いたときの通知 | [`notifyNewMessage()`](../src/lib/notify/messageNotification.ts)（`ow_notifications.type='message'`。2026-09-16〜） |
| 企業が会話に参加する経路 | `POST /api/biz/conversations/[id]/join` |

### 1-2. できていないもの

| 何 | 実測 |
|---|---|
| ~~★`proposalStage()` の使用箇所~~ | ✅ **2026-09-21 に配線した**（[introduce.ts](../src/lib/evidence/introduce.ts)）。下の §9 |
| ★**`/proposals` への導線** | **0**。`middleware.ts` の認証判定に名前が出るだけ。`/mypage` のサイドバーにも無い |
| ★**提案の通知** | **0**。`ow_notifications_type_check` は `like` / `comment` / `scout` / `message` の4値で、`proposal` が無い |
| ~~提案から会話・面談を作る経路~~ | ✅ **2026-09-21 に足した**（mutual → 会話1本）。下の §9 |

### 1-3. 実データ

```
ow_proposals 0 / ow_proposal_declines 0 / ow_scouts 0 / ow_casual_meetings 0 / ow_match_scores 0
ow_conversations 3（メッセージは 0 件）

実ユーザー（is_test=false / is_system=false / auth_id あり）        10 人
  ow_experiences                                                    17 件
  「入社の決め手」が1件以上ある人                                     1 人
  career_stance … researching 3 / active 2 / open 1 / no_contact 2 / 未設定 1
                  → ★提案を届けてよい母集団は 6 人

掲載企業                                                           22 社
  うち有効な企業管理者がいる                                    ★ 2 社
実企業の有料プラン                                             ★ 0 社
                （paid の行は1件あるが is_test の企業。CLAUDE.md の「0社」は今も正しい）
ow_transitions                                                     10 行（日次 cron で洗い替え）
```

⚠️ **数字は増える。書き足すときは上書きせず行を足すこと**（proposals-20260918.md §6 と同じ）。

---

## 2. 画面が既に約束していること

[ProposalsClient.tsx:69](../src/app/(jobseeker)/proposals/ProposalsClient.tsx) ／
[BizProposalsClient.tsx:64](../src/app/biz/proposals/BizProposalsClient.tsx)

> 企業にあなたの名前は渡りません。企業にも同じ提案が匿名で届いていて、
> **双方が会いたいと答えたときに初めてお互いが分かります。**

⚠️★**この後半が未実装。** 守れない約束を画面に出している状態で、
カジュアル面談の `share_profile`（チェックを外しても企業には全部見えていた）と**同じ形**。
⚠️ 実害はまだ0件（提案0件）。**次の1件で破る。**

---

## 3. 最初の一手

### 3-0. 提案が届く状態にする（③を検証可能にするための前提）

**③のコードより先。** これが無いと誰も返答しないので mutual は永久に起きない
——CLAUDE.md の言う「**起こせなかった0**」。

- `/mypage` のサイドバーに「提案」を足す（[MypageLayout.tsx:277-281](../src/app/(jobseeker)/mypage/_components/MypageLayout.tsx)）。
  未返答バッジは `scoutsBadge` と同じ形（[mypage/page.tsx:502](../src/app/(jobseeker)/mypage/page.tsx)）
- ⚠️ **置き場所を決める。** スカウトは `/mypage/scouts` なのに提案は `/proposals` で**揃っていない**
- 通知（`type='proposal'`）は**後回しでよい**。バッジで足りる。
  ⚠️★足すなら `ow_notifications_type_check` と `ow_notifications_target_check` の両方 ＋
  `GET /api/jobseeker/notifications` の **`survives()` に `case` を足す**こと。
  忘れると**その種別が丸ごと静かに消える**（CLAUDE.md の警告どおり）

### 3-a. mutual の一手 ＝ **会話を1本作る**

**紹介の器を新設しない。** `create_conversation` RPC に寄せる。

| なぜ | |
|---|---|
| 既存資産がそのまま使える | RPC が `stage` を間違えようがなく、`ow_conversations_unique_per_relation` への ON CONFLICT も持つ |
| **前例がある** | スカウトの返答が既に同じことをしている（[scouts/[id]/reply/route.ts](../src/app/api/jobseeker/scouts/[id]/reply/route.ts)） |
| 通知の配線も既にある | 会話にメッセージが入れば `notifyNewMessage` がベルに出す |

**置き場所は [`saveProposalResponse()`](../src/lib/evidence/respond.ts) の内側。**
保存後に両側を読み直し、`proposalStage()` が `mutual` を返したときだけ1回走らせる。

⚠️★**2本の respond ルートに条件を書き写さないこと。** ②⑨を1関数に集約したのと同じ理由で、
2つ書くと必ず片方だけ直る形の不具合になる。

⚠️ 冪等性: RPC 自体は冪等だが、**通知とメールは二重に出る。**
`ow_proposals` に `introduced_at`（または `conversation_id`）を**1列だけ**足して記録する。
⚠️★**これは「段」ではなく「副作用の記録」。** 段は2つの返答からの導出のままにする
（`stage` 列を足さない ——[proposalResponses.ts](../src/lib/constants/proposalResponses.ts) の注記）。

### 3-b. 開示の範囲

⚠️★**匿名側のクエリ（`biz/proposals/page.tsx`）には絶対に触らない。** 別クエリにする。

⚠️★**生の `ow_users` を admin で引かないこと。**
`visibility_company` / `ow_users.visibility` / `ow_company_hidden_experiences` を通った
既存経路（`getCompanyEmployees` 相当）を使う。
**企業向けの画面がこの可視性を見落とす不具合を、1か月で3件直している**
（[visibility-company-biz-20260910.md](visibility-company-biz-20260910.md)）。

---

## 4. ✅★`create_conversation` の素通し（2026-09-21 に解決）

⚠️★**当初この節は「企業側からは通らない ＝ 半分のケースで失敗する」と書いていた。
   実測して訂正する。実際は「両方向とも必ず失敗する」だった。**
   理由は `saveProposalResponse()` が **admin クライアント（service_role）** を使うから。
   実測（2026-09-21 / 本番）: service_role で `auth_ow_user_id()` は **null**、
   `auth_is_admin()` は **false**。＝ `auth.uid()` が誰でもないので、
   **どちらが最後に答えても** `NOT EXISTS(...)` が真になり 42501 になる。
   ⚠️ 「半分」は、scout の返答のように**利用者クライアントを渡す**設計を前提にした話。
      ③は②と⑨で共用する1関数なので、**その設計は採れない。**

### 何が問題だったか

`create_conversation` は **SECURITY DEFINER** で、冒頭でこう要求する。

```sql
IF NOT EXISTS (SELECT 1 FROM ow_users WHERE id = p_candidate_user_id AND auth_id = auth.uid())
THEN RAISE EXCEPTION 'unauthorized: ...' USING ERRCODE = '42501';
```

⚠️★**素通しの分岐が1つも無い。** したがって:

| 最後に答えたのが | 結果 |
|---|---|
| 求職者 | 通る（本人のセッション） |
| ★**企業** | **42501 で落ちる**（`auth.uid()` は企業管理者のもの） |

**mutual は「最後に答えたほう」で成立するので、半分のケースで紹介が失敗する。**
⚠️ `saveProposalResponse()` は `createAdminClient()` を使うが、
**service_role でも通らない**（`auth.uid()` が null になる）。

### 取りうる案

| # | 案 | 注意 |
|---|---|---|
| A | RPC に service_role の素通しを足す（**推奨**） | ⚠️★**`current_user = 'service_role'` は使えない。** SECURITY DEFINER の中では `current_user` が所有者に化ける（`guard_member_consent` のコメントが明言）。**`auth.role()`** を見ること。⚠️ **`DROP FUNCTION` を使わず `CREATE OR REPLACE`**（依存を落とす） |
| B | 求職者が最後のときだけ作る | ★**採らない。** 非対称で、企業が最後の組み合わせが永久に紹介されない |
| C | 自前で `ow_conversations` に INSERT | ★**採らない。** 2026-08-25 まで `stage` を間違えて**必ず500**だった経路 |

### ✅ A を採った（`20260921170000_mutual_introduction.sql`）

```sql
IF coalesce(auth.role(), '') <> 'service_role' THEN
  IF NOT EXISTS (SELECT 1 FROM ow_users WHERE id = p_candidate_user_id AND auth_id = auth.uid())
  THEN RAISE EXCEPTION ... USING ERRCODE = '42501'; END IF;
END IF;
```

⚠️★**飛ばすのは「候補者本人か」の確認だけ。** 引数の整合性チェック・`stage` の決定・
   ON CONFLICT は service_role でも**そのまま通る**。

⚠️★**`current_user` ではなく `auth.role()`。** SECURITY DEFINER の中では
   `current_user` が所有者に化ける。利用者は JWT を偽造できないので、
   authenticated から `'service_role'` にはならない。

**後退テスト（2026-09-21 実測 / 本番）:**

| 誰が | 何を | 結果 |
|---|---|---|
| 利用者（contact+01） | **他人**のぶんの会話を作る | ✅ **42501 で拒否**（`does not match auth.uid()`） |
| 利用者（contact+01） | 本人のぶんの会話を作る | ✅ 通る（既存を返す・`created=false`） |
| **anon** | 会話を作る | ✅ **42501 で拒否** |

＝ **素通しは service_role にだけ効いている。**

### 開始メッセージを入れるか

`notifyNewMessage` は `senderOwUserId` を要求し、**その人には通知しない。**
＝ 会話を作るだけでは**どちらにも通知が飛ばない。**

- メッセージを入れないなら、③用の通知を別に用意する
- メッセージを入れるなら**送信者を誰にするか**を決める
  ⚠️ `sender_participant_id` を null で入れないこと（送信者不明の行になる。scout reply のコメント）
- ⚠️ 企業側は RPC では participant にならない（RPC が作るのは候補者だけ）。
  企業は `/biz/conversations` で見て `join` する既存の形でよいか要確認

---

## 4-B. ✅ 実装したもの（2026-09-21・両方向で通した）

| 何 | 実体 |
|---|---|
| 素通し ＋ 紹介の記録2列 | `20260921170000_mutual_introduction.sql` |
| 紹介そのもの | **[lib/evidence/introduce.ts](../src/lib/evidence/introduce.ts)** の `introduceIfMutual()` |
| 呼ぶ場所 | **[respond.ts](../src/lib/evidence/respond.ts) の1箇所だけ**（見送りのときは呼ばない） |

⚠️★**route に条件を書き写していない。** ②の route と⑨の route は
`saveProposalResponse()` を呼ぶだけで、どちらが最後でも同じ経路を通る。

### 冪等性は2段で持つ

| # | どこ | 何を止めるか |
|---|---|---|
| ① | `introduced_at` が入っていたら即 return | 通知とメールの二重送信（**会話の重複は RPC 側が止める**） |
| ② | UPDATE に `.is("introduced_at", null)` | 両側の返答がほぼ同時に入ったときの競り |

### 実測（2026-09-21 / localhost:3000 → 本番 DB / `is_test` のみ）

検証用に 株式会社データプール（`is_test`）宛の提案を2件作り、実セッションで HTTP を通した。

| 向き | 返答の順 | 結果 |
|---|---|---|
| 1 | 求職者 `interested` → **企業** `want_to_meet` | ✅ `introduced_at` が入り、会話が1本できた |
| 2 | 企業 `want_to_meet` → **求職者** `interested` | ✅ 同上 |

- 会話は `kind=company` / `stage=active` / 正しい `company_id` と `candidate_user_id`
- 参加者は**候補者だけ**（企業は `/biz/conversations` から `join` する既存の形）
- 同じ返答をもう一度押しても `introduced_at` は**変わらない**
- ★**通知は0件のまま**（下記）

⚠️ **検証で作った行はすべて消し、6表とも作業前の件数に戻した**
   （提案0 / 見送り理由0 / 会話3 / 参加者3 / メッセージ0 / 通知1）。

### ★まだ無いもの ——「紹介したのに誰も気づかない」

**会話は作るが、当事者に通知が飛ばない。** `notifyNewMessage` は**送信者を要求する**ので、
メッセージが1件も無い会話では発火しない。実測でも `ow_notifications` は増えなかった。

⚠️★**いまは両者とも会話一覧を自分で開くまで気づけない。** ③を「使える」状態にするには、
   §3-0 の導線と合わせて**気づく手段**が要る。案は2つ:

| 案 | 中身 | 注意 |
|---|---|---|
| a | `ow_notifications` に `type='proposal'`（または `introduction`）を足す | ⚠️ `type_check` と `target_check` の**両方** ＋ `survives()` の `case`。忘れると種別ごと静かに消える |
| b | 開始メッセージを1件入れて `notifyNewMessage` に乗せる | ⚠️ **送信者を誰にするか**を決める必要がある。`sender_participant_id` を null で入れないこと |

⚠️ **紹介の失敗は best-effort でログに出すだけ。** 返答は取り消さない。
   ただし**失敗すると mutual のまま紹介されない行が残り、再試行の経路が無い**
   （両側とも答え終わっているので、もう誰も押さない）。**運営が直す導線が要る。**

## 4-C. ★★作業中に見つかった穴 —— 匿名が PostgREST から破れる（未修正）

**`/biz/proposals` が `ow_users` を select しないことで匿名を担保している**が、
**DB はそれを要求していない。** 企業の管理者が PostgREST を直接叩けば、
**mutual の前でも候補者の氏名に到達できる。**

```sql
-- ow_proposals の SELECT ポリシー
ow_proposals_select_company  USING (auth_is_company_admin(company_id))
-- ＋ authenticated には**テーブルレベル**の SELECT がある（列単位ではない）
```

**実測（2026-09-21 / 本番 / `is_test` の企業と候補者で1行だけ作って確認し、直後に削除）:**

| 誰が | 何を | 結果 |
|---|---|---|
| **企業の管理者** | `ow_proposals.candidate_user_id` を読む | ★**読めた** |
| **企業の管理者** | その uuid で `ow_users.name` を読む | ★**読めた**（氏名まで到達） |
| 無関係な利用者 | 同じ行を読む | ✅ 0行 |
| anon | 同じ行を読む | ✅ 42501 |

⚠️★**これは「画面は正しいのに PostgREST だけ漏れている」という、
   CLAUDE.md が繰り返し挙げている形そのもの。**

### 直し方（**未実施。判断が要る**）

`/biz/proposals` も `/proposals` も **`createAdminClient()` で読んでいる**ので、
`authenticated` 向けのポリシーは**今のところ誰も使っていない**。

| 案 | 中身 |
|---|---|
| A | **`ow_proposals_select_company` を落とす**（企業向けの読みは admin クライアントだけにする） |
| B | `candidate_user_id` の列単位 SELECT を `authenticated` から剥がす |

⚠️ A のほうが素直（「誰に読ませるか」は RLS、という原則に沿う）。
⚠️★どちらも **anon / 非admin / 企業管理者 / 本人 / 運営**で実測してから当てること。
⚠️ `ow_proposals_select_own`（本人）は残す。

## 5. 先に決めること（コードより前）

| # | 論点 | 今の状態 |
|---|---|---|
| (a) | **開示で何が渡るか**を画面に書く | 「お互いが分かります」としか書いていない。選択肢を持たせないなら告知は厚くする（`share_profile` を撤去したときの判断） |
| (b) | **見送ったら再提案できるか** | ★`ow_proposals_unique (candidate, company, job)` ＋ `on conflict do nothing` なので、**一度 closed にすると同じ組み合わせを二度と提案できない**。意図どおりか要確認 |
| (c) | **企業側の通知先** | ★**掲載22社のうち有効な管理者がいるのは2社。** 残り20社は mutual になっても気づけない |
| (d) | 規約 | ③自体は AI を使わないので⑧の改定は必須ではない。ただし「**匿名で候補者を企業に出している**」ことがプライバシーポリシーに書かれているかは確認が要る |

---

## 6. やらないこと（意図して）

| 足さないもの | 理由 |
|---|---|
| **スカウトの3ゲートを開けること**を③の前提にする | [biz/proposals/page.tsx](../src/app/biz/proposals/page.tsx) の注記どおり**③はスカウトと別系統**。「ここから送信機能を生やさないこと」 |
| `ow_matches` / `ow_match_scores` を起こす | 9画面調査 §③論点(a) への答え。**新設も復活も不要**。段は2列から導出できる |
| `stage` 列 | 2つの返答と食い違う余地ができる |
| スコア列 | 思想⑦（マッチ度%・星評価を出さない） |
| 母集団を増やすために `is_test` を実データに混ぜる | ★CLAUDE.md。mutual の再現は §7 の手順で足りる |

---

## 7. mutual を再現する手順（検証）

⚠️★**②⑨と違い、③は「データが無いから検証できない」に当たらない。**
運営が提案を作って、検証用アカウントで両側を押せば再現できる。

1. `/admin/proposals` で `is_test` の候補者ぶんの提案を作る（[generate.ts](../src/lib/evidence/generate.ts)）
2. 求職者側（`is_test`）で `/proposals` から「興味がある」
3. 企業側（`is_test` の企業の管理者）で `/biz/proposals` から「会いたい」
4. ★**3 と 2 の順を入れ替えて、もう1回通す**（§4 の 42501 はこの順でしか出ない）
5. `ow_conversations` / `ow_conversation_participants` / `ow_notifications` を SQL で確かめる

⚠️ **HTTP 200 で判定しない。** 行が増えたかを見る（CLAUDE.md）。
⚠️ 検証で入れた行は**作業前の件数に戻す**。`ow_proposals` は `on conflict do nothing` なので、
やり直すときは**先に消す**こと。
⚠️ メールを含む経路を通すなら `RESEND_API_KEY=` で起動するか、dev のままにする（`skipInDev()`）。

---

## 8. 次に触る人へ

⚠️★**`proposalStage()` は今日時点で使用箇所0件。** ③を実装するとき、
**これを使わずに新しい判定を書かないこと。**

⚠️★**「双方が会いたいと答えたときに初めてお互いが分かります」の一文を、
実装より先に消さないこと。** 消すと③が何を作る話だったか分からなくなる。
実装が追いついたときに、**何が渡るか**を書き足す形にする。
