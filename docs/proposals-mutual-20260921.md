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
| ~~★`/proposals` への導線~~ | ✅ **2026-09-21**。`/mypage/proposals` へ移し、サイドバーとモバイルのタブバーに出した。下の §4-D |
| ~~★提案の通知~~ | ✅ **2026-09-21**。`proposal` と `introduction` の2種別を足した。下の §4-D |
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

### ★通知は 2026-09-21 に足した（§4-D）

当初この節は「紹介したのに誰も気づかない」だった。**候補者側は解決した**（`introduction`）。
**企業側はナビから見に行く形**のままで、通知は出していない（理由は §4-D）。

⚠️ **紹介の失敗は best-effort でログに出すだけ。** 返答は取り消さない。
   ただし**失敗すると mutual のまま紹介されない行が残り、再試行の経路が無い**
   （両側とも答え終わっているので、もう誰も押さない）。**運営が直す導線が要る。**

## 4-C. ✅★★匿名が PostgREST から破れていた（2026-09-21 に塞いだ）

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

### ★当初の2案は**どちらも採れなかった**

| 案 | なぜ採れないか |
|---|---|
| A「`ow_proposals_select_company` だけ落とす」 | ★**`ow_proposal_declines_select_company` が道連れ**になる。あちらは `EXISTS (SELECT 1 FROM ow_proposals p …)` で親を引いており、**ポリシー式の中の副問い合わせにも RLS が掛かる**ので、企業が**自分で書いた見送り理由まで読めなくなる**（静かに0件） |
| B「`candidate_user_id` の列単位 SELECT を剥がす」 | ★**`ow_proposal_declines_select_own` がその列を参照している。** 剥がすと**候補者が自分の見送り理由を読めなくなる**（CLAUDE.md「ポリシー式は実行ユーザーの権限で評価される」） |

### ✅ 採った形 —— 設計メモどおり「読みは admin だけ」に戻す

設計メモ（[phase0-9screens-20260918.md](phase0-9screens-20260918.md) §4-4）は
**「RLS 有効 / anon・authenticated に GRANT を配らない / 読み書きは admin クライアントだけ。
本人に見せる経路を後から足すときに初めてポリシーを書く」**と書いてあった。
**実装はそこから外れて SELECT を配り、ポリシーを3本先に書いていた。** 戻した。

形は **`ow_transitions` と同じ**（RLS 有効・ポリシー0本・GRANT 無し）。
migration は `20260921230000_proposals_admin_only_read.sql`。

⚠️ **アプリは1行も壊れない。** 実測（`src` 全体）: この2表を読む**11箇所すべてが
   `createAdminClient()`**。セッションのクライアントで読んでいる箇所は**0件**。

**実測（2026-09-21 / 本番 / `is_test` の行で前後を測った）:**

| 誰が | 前 | 後 |
|---|---|---|
| **企業の管理者** → `ow_proposals` | ★**候補者IDが読めた** | ✅ **42501** |
| 本人 → `ow_proposals` | 1行 | ✅ 42501 |
| 無関係な利用者 | 0行 | ✅ 42501 |
| anon | 42501 | ✅ 42501 |
| 企業の管理者 → `ow_proposal_declines` | 自分の理由1行 | ✅ 42501 |
| 本人 → `ow_proposal_declines` | 自分の理由1行 | ✅ 42501 |
| ★**service_role（admin クライアント）** | 読める | ✅ **読めたまま** |

画面も前後で変わらない（`/mypage/proposals` と `/biz/proposals` に根拠が出て、
**企業側の HTML に候補者の氏名は出ない**）。返答 API も 200 のまま。

⚠️★**セッションのクライアントで読む経路を足す日は、ポリシーを書き直すこと。**
   落とした6本は migration の中に原文で記録してある。
   ⚠️ **そのまま戻さない。** `ow_proposal_declines` の2本は親の RLS に引っかかるので、
      **SECURITY DEFINER の関数に逃がす**か、親のポリシーと同時に設計する。

⚠️ **`ow_users` 側は変えていない。** ログインした利用者が uuid を知っていれば
   氏名を引けるのは従来どおり（`login_only` の設計）。塞いだのは
   **提案から候補者の uuid を手に入れる経路**。

## 4-D. ✅ 通知と導線（2026-09-21）

### 置き場所 —— `/proposals` を `/mypage/proposals` へ移した

⚠️★**`/mypage` 配下でないと `MypageLayout` が付かない**（各ページが自分で import する形）。
外に置いたままサイドバーからリンクすると、**押した先にサイドバーが無い**。
⚠️ 旧 URL は `middleware.ts` が **307 で転送**する（実測: ログイン済み・未ログインとも）。
   移した時点で導線もリンクも0件だったが、手元のブックマークを殺さないため。

### ★モバイルのタブバーは「スカウト」と入れ替えた（柴さんの判断）

**7項目にすると入らない。** 実測（375px / 1項目の枠 **49.6px**）:

| ラベル | 必要幅 | 余白 |
|---|---|---|
| 応募・面談 | 50.0 | **−0.4** |
| メッセージ | 50.0 | **−0.4** |
| **ブックマーク** | 59.2 | **−9.6** |

実画面で**「メッセージ」と「ブックマーク」がくっついて1語に見えた。**

⚠️★**これは 2026-08-30 に一度決着していた領域。** `MypageLayout` のコメントに
   「折り返す／『保存』に改名／項目を5つに」を**すべて不採用にした**経緯と、
   **「上げるならラベルを短くするしかない。サイズだけ変えると溢れる」**という結論がある。
   7項目目がその前提を崩した。

→ **6項目のまま、スカウトと入れ替えた。** 根拠は
   ①スカウトは `SCOUT_SENDING_ENABLED` で送信を止めていて**本番0件**
   ②ベルの通知（`type='scout'`）から `/mypage/scouts` へ飛べる。

実測（入れ替え後 / 375px）: **6項目とも枠 61.2px・はみ出し 0**・横スクロールなし。

⚠️★**スカウトを再開する日は、ここを決め直すこと。** いまモバイルからスカウトへ行く手段は
   **ベルだけ**で、未返答バッジ（`scoutsBadge`）も出ない。
⚠️ **PC のサイドバーには両方ある**（縦並びなので幅の問題が無い）。

### 通知は2種別。混ぜない

| type | いつ | 押すと | 送り主 |
|---|---|---|---|
| `proposal` | 提案が届いた（`generate.ts`） | `/mypage/proposals` | 企業 |
| `introduction` | 双方合意した（`introduce.ts`） | `/mypage/conversations/[id]` | 企業 |

⚠️★**1つで兼ねない。** 押したときの行き先が違う。
⚠️★**`notifyNewMessage` は使えない**（送信者を要求するが、紹介の会話にはメッセージが無い）。
⚠️★**`survives()` に `case` を足してある。** 既定は投稿の存在を求めるので、
   足し忘れると**その種別が丸ごと静かに消える**。
⚠️ ベルに**根拠の中身を出さない**。ヘッダーに常設なので肩越しに読まれる
   （スカウト・メッセージと同じ）。
⚠️ 「双方が会いたいと答えた」と書かない ——**相手が何を押したかは相手の情報**。
   出すのは「◯◯ と話せるようになりました」まで。

### ★企業側は「ナビだけ」。メールは出していない

`/biz` には**通知の面が1つも無い**（実測 2026-09-21: `ow_notifications` も
`NotificationBell` も `src/app/biz` からの参照0件）。
`BusinessLayout` の `NAV_ITEMS` に「提案」を足した（「候補者を探す」の隣）。

⚠️ **バッジは付けていない。** `NAV_ITEMS` が静的な定数で、件数を配る仕組みがこのレイアウトに無い。
⚠️★**メールは採らなかった。** 掲載22社のうち通知の宛先を持つのは**2社**で、
   残りは運営フォールバックで `ADMIN_EMAIL` に落ちる（＝運営に大量に届く）。
   出すなら**宛先の設計とセット**。

### 実測（2026-09-21 / localhost:3000 → 本番 DB / `is_test` のみ）

| 何を | 結果 |
|---|---|
| 旧 `/proposals` | ✅ 307 → `/mypage/proposals`（ログイン済み・未ログインとも） |
| 未ログインの `/mypage/proposals` | ✅ **307** → `/auth?next=…`（ソフト200ではない） |
| `/mypage` から `/mypage/proposals` への参照 | 2箇所（サイドバー＋タブバー） |
| `/biz/dashboard` から `/biz/proposals` への参照 | 2箇所 |
| `introduction` の通知 | ✅ 両方向とも入り、API が返した（`survives()` を通る） |
| `proposal` の通知 | ✅ 入り、API が返した |
| CHECK（`proposal_id` なし / `actor_company_id` なし） | ✅ **23514 で弾かれる** |
| CHECK（既存の `scout` を壊していないか） | ✅ `scout_id` なしは今も弾かれる |
| 未回答バッジ | ✅ サイドバーとタブバーに「1」 |

⚠️ **検証で作った行はすべて消し、4表とも作業前の件数に戻した。**

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
