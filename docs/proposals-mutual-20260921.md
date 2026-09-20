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
| ★**`proposalStage()` の使用箇所** | **0件**。`mutual` になっても**何も起きない** |
| ★**`/proposals` への導線** | **0**。`middleware.ts` の認証判定に名前が出るだけ。`/mypage` のサイドバーにも無い |
| ★**提案の通知** | **0**。`ow_notifications_type_check` は `like` / `comment` / `scout` / `message` の4値で、`proposal` が無い |
| 提案から会話・面談を作る経路 | **0件** |

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

## 4. ★実装の前に決着が要る1件 — `create_conversation` が企業側からは通らない

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

⚠️ A を当てたら **anon / 非admin / admin の3者で実測する**（CLAUDE.md）。
「求職者本人以外が他人の会話を作れる」向きに広げていないことを確かめること。

### 開始メッセージを入れるか

`notifyNewMessage` は `senderOwUserId` を要求し、**その人には通知しない。**
＝ 会話を作るだけでは**どちらにも通知が飛ばない。**

- メッセージを入れないなら、③用の通知を別に用意する
- メッセージを入れるなら**送信者を誰にするか**を決める
  ⚠️ `sender_participant_id` を null で入れないこと（送信者不明の行になる。scout reply のコメント）
- ⚠️ 企業側は RPC では participant にならない（RPC が作るのは候補者だけ）。
  企業は `/biz/conversations` で見て `join` する既存の形でよいか要確認

---

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
