# スカウト送信の解禁に向けた調査（フェーズ0）— 2026-09-10

**本番でスカウトは1通も送っていない。フラグも変えていない。書き込み・migration・コミットもしていない。**
唯一の例外は §6 の通し確認で、**dev のみ**フラグを開け、**メール送信を抑止**したうえで実施し、
**全件削除して作業前と一致することを確認済み**（§7）。

---

## 結論を先に ── ★**フラグ1つでは送れない。ゲートは実質2つある**

`SCOUT_SENDING_ENABLED=true` にすると **API は通る**。ただし
**企業が候補者を探す画面（`/biz/candidates`）は有料プランのゲートで閉じたまま**で、
**現在 有料プランの企業は0社**（88社すべて `free`）。

⇒ **フラグだけ開けても、企業は「誰に送るか」を選べない。**
   API を直接叩けば送れるので、**「送れないから安全」ではない。**

---

## 1. 止め方の全体像

### ①フラグ（送信そのもの）

| | |
|---|---|
| 読む場所 | `src/app/api/biz/scouts/route.ts:79` |
| 判定 | `if (process.env.SCOUT_SENDING_ENABLED !== "true") return 503` |
| 位置 | **認証より前**。だから未認証 POST で本番の値を安全に判定できる（実測: **503**） |

同じ env を読んで UI を出し分けている箇所（**フラグを開けると同時に開く**）:

| 場所 | 何が変わるか |
|---|---|
| `src/app/biz/candidates/page.tsx:157` | 「スカウトを送る」ボタンの表示 |
| `src/app/biz/scouts/page.tsx:24` | スカウト履歴画面 |
| `src/app/(jobseeker)/mypage/scouts/page.tsx:100` | 求職者側の受信画面の文言 |

⚠️ 文言側にも「準備中」が残っている（**フラグと同時に消す**）:
`LandingPage.tsx` の FAQ ／ `business/pricing/page.tsx` ／ `mypage/scouts/ScoutsClient.tsx`。

### ★②有料プランのゲート（候補者を探す画面）

| | |
|---|---|
| 場所 | `src/app/biz/candidates/page.tsx:78` — `if (!canUse(ctx.planType, "candidateSearch"))` |
| 定義 | `src/lib/constants/plans.ts:77-78` — `free: { candidateSearch: false }` / `paid: { candidateSearch: true }` |
| 出どころ | `ow_company_plans.plan_type`（`lib/business/company.ts:335`） |
| **実測（2026-09-10）** | **`ow_company_plans` 88行がすべて `plan_type = 'free'`。有料は0社**（企業は103社） |

**実測（本番 / セールスフォースの管理者アカウントで `/biz/candidates` を開いた）:**

> 有料プランの機能 ／ 候補者検索は有料プランの機能です。現在は登録者を増やしている段階のため、
> ご利用は人数が揃ってからをお勧めしています。

⇒ **候補者は1人も表示されない。**
⚠️★**ただしこのゲートは画面だけ。`POST /api/biz/scouts` にプランの判定は無い。**
   `candidate_id` を知っていれば free の企業でも送れる（§6 で実証。送信元はプラン `free`）。

### ③掲載の審査ゲート

`route.ts:111` — `if (!ctx.isPublished) return 403`「運営審査が完了するまでスカウトを送信できません」。

### 止めた経緯

`route.ts:47-78` に残っている。要点は3つ:

- **受信側の画面が無かった**ため 2026-08-09 に止めた（受信側は 2026-08-10 に実装済み）
- ⚠️★**利用規約 第8条の改定（効力発生日 2026-09-27）より前に開けないこと。**
  現行の第1項は「初期設定において**受け取る**」と書いており、製品の挙動（**答えるまで届かない**）と**逆**。
  フラグを開けると規約より先に新しい挙動が動き出す。周知は 2026-08-28 開始（第24条2項の30日前）
- 未設定を無くす導線が効き始めるまで母集合は小さいまま。**開ける前に件数を数えること**

---

## 2. 送信の条件（誰が誰に送れるのか）

### DB のトリガー `trg_guard_scout` → `guard_scout_insert()`

`ow_scouts` への INSERT で3段を見る。**アプリを通さない INSERT でも効く。**

| 段 | 内容 | エラー |
|---|---|---|
| 1 | `is_solicitation_blocked(candidate_id)` | `P0001` |
| 2 | `can_send_scout(company_id, candidate_id)` | `P0001` |
| 3 | `consume_scout_quota(company_id)` | `P0002` |

### `can_send_scout()` の4条件

| # | 条件 | 何を見るか |
|---|---|---|
| 1 | **意思表示** | `ow_profiles.career_stance` が **非NULL かつ ≠ `no_contact`**。⚠️ NULL は false 扱い |
| 2 | **在籍企業（マスタ）** | `ow_experiences` に `is_current` かつ `company_id = 送信元` の行があれば**送れない** |
| 2b | **在籍企業（自由入力）** | `company_id is null` でも `normalize_company_name(company_text)` が送信元の社名と一致すれば**送れない** |
| 3 | **手動ブロック** | `ow_scout_blocks` に (candidate, company) があれば送れない。**実測 0件** |
| 4 | **転職勧奨の禁止期間** | `is_solicitation_blocked()` ＝ `ow_placements` に **`resigned_at is null` かつ `joined_at > 今日-2年`** の行があれば送れない。**実測 0件** |

⚠️ `ow_profiles.scout_enabled` は**もう見ていない**（2026-08-27／28 に `career_stance` へ付け替え済み）。

### 送信枠 `consume_scout_quota()`

1. `ow_scout_quotas` に行が無ければ**その場で作る**（DB の `DEFAULT`）
2. `period_start` が今月より前なら `used_this_month = 0` に**リセット**
3. `used_this_month < monthly_limit` なら +1 して true
4. 使い切っていても `bonus_credits > 0` なら 1 消費して true
5. どちらも無ければ false → `P0002`

| | 実測（2026-09-10） |
|---|---|
| `ow_scout_quotas` の行数 | **0件**（＝全社が「行なし」） |
| `monthly_limit` の DB 既定 | **30** |
| §6 で1通送った直後 | 行が自動生成され `used 1 / limit 30 / bonus 0 / period 2026-09-01` |

⚠️★**`?? 30` の既定値当ては 2026-08-29 に解消済み**（`ab1fba42`）。表示は
`SCOUT_MONTHLY_LIMIT_DEFAULT`（`lib/constants/scoutQuota.ts`）と
**`configured`（行が実在するか）**を分けて出す。
⚠️ この定数は **DB の `DEFAULT 30` と二重管理**。片方だけ変えると食い違う。
⚠️★**月次リセットはトリガーでも cron でもなく `consume_scout_quota()` の中だけ。**
   次に誰かが送信するまで先月の数字が残る。

### 送信側の権限・規約

| | |
|---|---|
| 権限 | `getTenantContext()`（`ow_company_admins` の有効な管理者） |
| プラン | **API には判定が無い**（画面だけ。上記②） |
| **人材紹介利用規約（`placement`）の同意** | ⚠️★**ゲートは 2026-09-05 に外された。戻さないこと**（`route.ts:95-109`）。理由は「OPINIO はあっせんを行わず**募集情報等提供**に該当する（掲載利用規約 第6条1項）。月額プランの機能を使うために**成功報酬の規約**へ同意させる形になっていた」 |
| 掲載利用規約（`listing`）の同意 | **スカウト送信の条件にはなっていない**（掲載の公開ゲート側の条件） |

⇒ **`ow_terms_agreements` の `placement` が0件でも送信は妨げられない。**
   実測: 全体で2行（`business` 1 / `listing` 1）。

---

## 3. 受け取る側に何が起きるか

| | |
|---|---|
| アプリ内通知 | `ow_notifications` に `type='scout'` を INSERT（`route.ts:188`）。ヘッダーのベルに出る |
| メール | `sendScoutEmail()`（`route.ts:221`）。**`ow_profiles.email_scout_enabled !== true` なら送らない** |
| 送信基盤 | **Resend**（`lib/notify/email.ts`。`RESEND_API_KEY`） |
| 配信停止の導線 | `/profile/edit?tab=account` の「スカウトのお知らせ」（`email_scout_enabled`） |
| 受信画面 | `/mypage/scouts` |
| 返信 | `POST /api/jobseeker/scouts/[id]/reply`。`interested` で **`ow_conversations` が作られる**（§6 で実証） |
| 受け取りを止める導線 | `/mypage` の `IntentCard` →「転職について」を **`no_contact`** にする |

### ★週次メールとの関係 ── **同じ基盤だが独立している**

| | |
|---|---|
| 週次メール（`weekly-match` / `weekly-jobs`） | **二重に停止中**: `vercel.json` の `crons` が **`{}`（空）** ＋ 各ルート冒頭の `WEEKLY_EMAIL_ENABLED !== "true"` |
| スカウトメール | `SCOUT_SENDING_ENABLED` の内側。**cron ではなく送信時に同期で送る** |

⇒ **スカウトだけ動かせる。** 週次を止めたままで問題ない。
⚠️ ただし `RESEND_API_KEY` は共有。**消すと応募・面談・招待・スカウトが全部死ぬ。**

---

## 4. 企業が見られる情報の範囲 ★重要

### `/biz/candidates` が候補者について取る列（`page.tsx:220, 281`）

```
ow_users        : id, name, location, is_mentor, created_at, auth_id
ow_experiences  : user_id, role_title, role_category_id, employment_type, started_at,
                  company_id, company_text, company_anonymized, ow_companies(name, name_en)
                  （is_current = true のみ）
ow_experiences  : user_id, started_at（全件。社会人年数の算出用）
```

**実測（本番 / セールスフォースの管理者アカウント）**: 画面は**有料プランのゲートで閉じており**、
候補者は1人も出ない。上の列は**ゲートを開けたときに出るもの**。

| 項目 | 企業に見えるか |
|---|---|
| 氏名 | **見える** |
| 現職の会社名・役職・雇用形態・入社年月 | **見える** |
| 勤務地（`ow_users.location`） | **見える** |
| 社会人年数 | **見える**（全職歴の最古 `started_at` から都度算出） |
| **生年月日・年齢** | ⚠️ **取っていない**（`page.tsx:212` に「`birth_date` は取らない」と明記。`CandidatesClient.tsx:190` にも「年齢の select や birthYear をここに戻さないこと」）✅ 方針が守られている |
| 連絡先（メール） | **取っていない**（`ow_users` の select に `email` が無い） |

### ⚠️★`visibility_company` を見ていない

`/biz/candidates` は経歴の会社名を `resolveExperienceCompanyName()` で組み立てるが、
この関数は **`visibility_company` を一切参照しない**:

```
masterDisplayName(ow_companies) ?? masterDisplayName(company) ?? company_text ?? company_anonymized
```

⇒ **本人が `masked` / `hidden` を選んでも、企業側には実名の会社名が出る。**

| | 実測（2026-09-10） |
|---|---|
| `visibility_company <> 'real'` の経歴 | **0件** |

⇒ **いま実害は無い。** ただし**誰かが `masked` / `hidden` を選んだ日に、気づかないまま出る。**
⚠️★**解禁の前に塞ぐかどうかを決めること**（`auth_id` や `?next=` と同じ「no-op だから放置」の形）。

### 求職者本人が「企業にはここまで見えている」と知る手段

**無い。** `/mypage` の `IntentCard` は「候補者検索に表示されます」までしか言っておらず、
**何が見えるかの一覧は画面のどこにも無い**（2026-09-10 実測）。
⚠️ オンボーディングの「企業ページに実名で表示されます」は**企業ページの話**で、
   **候補者検索の話ではない。**

---

## 5. 同意の状態

### 求職者側 ── 記録は無い。包括同意のみ

`ow_terms_agreements` に求職者側の行は**0件**（全体2行はどちらも企業側）。
同意は**登録行為そのもの**で取っている。登録画面（`/auth?mode=signup`）の文言は現在:

> 登録することで **利用規約** および **プライバシーポリシー** に同意したものとみなします。

⚠️★**登録画面に「企業からスカウトが届く」という説明は無い**（2026-09-09 に外した）。
   いま画面で伝えているのは:
   - `/onboarding/stance`「この答えで、**企業の採用担当から声をかけられるかどうか**が決まります」
   - LP の FAQ「登録しただけでは届きません。…**なお、企業からのスカウト送信は現在準備中です**」
   - `/mypage` の `IntentCard`「『転職について』に答えると、企業の候補者検索に表示されます。」

### ★利用規約 第8条は**現行の条文が製品と逆**

```
1. スカウトの受け取りは、登録時の初期設定において「受け取る」となります。
   当社は、登録手続の画面において、この初期設定をユーザーに明示します。
```

実際は **`career_stance` に答えるまで届かない**。
条文の冒頭に「**本条第1項から第3項は、2026年9月27日に変更されます**」とあり、
改定後の条文が製品の挙動に一致する。

⇒ ⚠️★**2026-09-27 より前に解禁すると、規約と実装が食い違ったままスカウトが動き出す。**

### 企業側

| | |
|---|---|
| 掲載利用規約（`listing`） | 掲載の公開ゲートで同意を要求。**スカウト送信の条件ではない** |
| 人材紹介利用規約（`placement`） | ⚠️ **2026-09-05 にゲートを外した。** 現在スカウト送信で同意を求めていない |

---

## 6. 通しで動くのか（dev のみ・全件削除済み）

**dev だけ `.env.local` に `SCOUT_SENDING_ENABLED=true` を足し、dev を再起動して実施。**
⚠️★**メールは送っていない。** 受信者の `email_scout_enabled` を一時的に `false` にして
`sendScoutEmail()` を早期 return させた（`route.ts:237`）。

| # | 操作 | 結果 |
|---|---|---|
| 0 | フラグ前の POST（未認証） | **503** →（フラグ後）**401**。フラグが効いていることの確認 |
| 1 | **在籍企業へ送信**（contact+27 はセールスフォース在籍） | **422 `P0001`**「この候補者にはスカウトを送信できません」✅ 在籍企業ブロックが効く |
| 2 | 別企業の人へ送信（contact+25 はアグース在籍） | **200 `{"ok":true}`** |
| 3 | `ow_scouts` | 1行（`status='sent'` / 送信元セールスフォース / `conversation_id` は null） |
| 4 | `ow_notifications` | `type='scout'` が **1行** |
| 5 | `ow_scout_quotas` | **自動生成**され `used 1 / limit 30 / bonus 0 / period 2026-09-01` |
| 6 | 受信画面 `/mypage/scouts` | **スカウトが表示される**（社名・本文とも） |
| 7 | 通知API | `type=scout` と社名を返す |
| 8 | 返信（`interested`） | **200**。`conversationId` が返り、**`ow_conversations` が作られた** |

⚠️★**送信元の企業のプランは `free`。** それでも API は通った ＝ **プランのゲートは画面だけ**。

⚠️ `candidate_id` は **`ow_users.id`**（`auth.users.id` ではない）。
   最初 `auth_id` を送って **404 `candidate not found`** になった（`route.ts:138`）。

---

## ★ フラグを true にしたら何が起きるか（起きる順）

1. `POST /api/biz/scouts` が **503 を返さなくなる**
2. `/biz/candidates` の「スカウトを送る」ボタンと `/biz/scouts`（履歴）が**表示される**
   — ただし**候補者リストは有料プランのゲートで閉じたまま**（現在 有料0社）
3. 企業が `candidate_id` を持っていれば（API 直叩き／将来プランを付けた企業）**送信できる**
4. 送信時に DB トリガーが3段を判定 → 通れば `ow_scouts` に行が立つ
5. `ow_scout_quotas` の行が**自動生成**され、月30通の枠を消費し始める
6. 受信者に**アプリ内通知**が立ち、`email_scout_enabled = true` なら**メールが飛ぶ**
   （現在 `ow_profiles` 38件中 **22件が true**）
7. 受信者が `interested` を返すと **`ow_conversations` が作られる**

### 送れる相手は現在何人か（実測 2026-09-10）

| | |
|---|---|
| `career_stance` が非NULL かつ ≠`no_contact`（全体） | **11件** |
| うち**実ユーザー**（`is_test` / `is_system` を除く） | **5人**（`active` 2 / `open` 2 / `researching` 1） |

⚠️ さらに送信元企業ごとに「在籍企業ブロック」で減る。

---

## 解禁の方式（案・実行しない）

| 案 | 中身 | 何を確認してから開けるか |
|---|---|---|
| **A. 全面解禁** | フラグを true | ⚠️ 現在 有料0社なので**画面からは誰も送れない**が、API は開く。**推奨しない**（規約改定前は特に） |
| **B. 特定の企業だけ**（推奨） | フラグを true ＋ **その企業だけ `ow_company_plans.plan_type = 'paid'`** | 相手企業を名指しで決める。⚠️ プラン列は**課金と紐づいていない**ので、無料で開ける運用になることを承知のうえ |
| **C. 送信上限を絞る** | B ＋ その企業の `ow_scout_quotas` を先に作り `monthly_limit` を小さく（例 3） | ⚠️ 行を作らないと**既定の30**が効く。**先に作ること** |

**B ＋ C の併用が最も戻しやすい**（プランを free に戻す／枠を0にする、のどちらでも止まる）。

---

## ★★解禁の前に必ず確認すること（チェックリスト）

**1通目が実在の求職者に届く。取り返しがつかない。**
⚠️ 更新: 2026-09-10（前作業①〜④のうち①②③と送信結果の記録が完了）

### ✅ 済み（コードに入っている）

- [x] **サーバー側のプランゲート** ── `POST /api/biz/scouts` に無く、`free` の企業から
      送信が通っていた。`canSendScout()` に集約し、画面と API の両方から呼ぶ
      → `lib/business/scoutGate.ts`
- [x] **`visibility_company` を企業側の画面で効かせた** ── `/biz/candidates`（表示と**絞り込みの両方**）と
      `/api/biz/company/members` → [visibility-company-biz-20260910.md](visibility-company-biz-20260910.md)
      ⚠️★**これで「masked / hidden が0件か」を毎回数える必要は無くなった。**
         0件でなくなっても実名は企業へ出ない
- [x] **メールの文面を実物で確認し、直した** ── 配信停止リンクの文言／共通レイアウト／
      名前が空のときの呼びかけ／送信者情報 → [scout-email-20260910.md](scout-email-20260910.md)
      ⚠️ **実際に受信して確認したわけではない**（テンプレートの実出力を見た）
- [x] **送信結果の記録** ── `ow_scouts` に4列＋要対応＋企業側の表示＋`RESEND_API_KEY` の送信時ガード
      → [scout-delivery-record-20260910.md](scout-delivery-record-20260910.md)
- [x] ★**「準備中」の文言をフラグに連動させた**（2026-09-10）。**手で消す作業は無くなった** ──
      「開けたら消す」は消し忘れと消しすぎの両方が起きるため。判定は
      `isScoutSendingEnabled()` の1本。⚠️ LP は ISR なので**最大5分ずれる**
- [x] ★**止め方を決めた**（軽いものから3段階）→ **[scout-runbook.md](scout-runbook.md)**
- [x] ★**1通目の宛先と確認項目を決めた**（柴さん宛・実際に開ける企業から）→ **[scout-runbook.md](scout-runbook.md)**
- [x] **`ow_scout_quotas` を先に作ると決めた。最初の1社は月5通** → [scout-runbook.md](scout-runbook.md)
      ⚠️ **作るのは「開ける企業が決まってから」。今は作らない**

### ★ 残っているもの

#### 柴さんの判断が要る

- [ ] **利用規約 第8条の改定（効力発生日 2026-09-27）が発効しているか。**
      発効前に開けると、規約（「初期設定は受け取る」）と実装（「答えるまで届かない」）が食い違ったまま動く
- [ ] **有料職業紹介の免許番号（13-ユ-316441）をメールに入れるか**（社労士に確認中）と、
      **届出の要否** → [scout-email-20260910.md](scout-email-20260910.md)
- [ ] ★**最初に開ける企業を決める。** ⚠️★**サーバー側ゲートを入れたので、
      `ow_company_plans.plan_type = 'paid'` にしない限り1通も送れない**（実測 403）。
      現在**有料は0社**。決まったら **枠（月5通）→ プラン `paid` → フラグ** の順で開ける
      （手順は [scout-runbook.md](scout-runbook.md)）
- [ ] ★**1通目を送るタイミングと宛先アドレスを指示する**（柴さん宛。CC は準備まで）

#### 作業として残っているもの

- [x] **④「企業に何が見えるか」を求職者本人に示す** ── `/mypage/settings` の「公開範囲」の
      直下に節を1つ（2026-09-10）→ [candidate-visibility-20260910.md](candidate-visibility-20260910.md)
- [ ] ★★**本人が会社名の公開範囲を設定できること**（2026-09-11 に条件として追加）
      ⚠️★**企業が候補者検索を見る状態にするのに、本人が伏せる手段を持たないのは筋が通らない。**
         入力欄は 2026-08-16 に外れており、**`masked` が0件なのは「誰も伏せたくない」ではなく
         「誰も選べない」だけだった。**
      順序は **統合 → 入力欄**（先に入力欄を作ると、統合のときに作り直しになる）
      → [visibility-company-two-columns-20260910.md](visibility-company-two-columns-20260910.md)

#### 開ける直前に数え直すもの（値が動くので、当日に測る）

- [ ] **送れる相手の人数**（本調査時点で実ユーザー**5人**）
- [ ] **`email_scout_enabled = true` の人数**（本調査時点で38件中22件。**その人たちに実際にメールが飛ぶ**）
- [ ] ★**`/api/health` の `hasResendKey` が `true` か。** false のまま開けると
      **1通も届かないのに「送信しました」と出る**（ただし本番では 503 で断るようにしてある）。
      ⚠️ **実測（2026-09-10 / 本番）: `true`。** それでも**当日にもう一度見ること**

---

## 7. 後片付け（§6 の検証データ）

| | 作業前 | 作業後 |
|---|---|---|
| `ow_scouts` | 0 | **0** |
| `ow_notifications`（全体 / `type='scout'`） | 1 / 0 | **1 / 0** |
| `ow_scout_quotas` | 0 | **0** |
| `ow_conversations` | 3 | **3** |
| `ow_conversation_messages` | 0 | **0** |
| `ow_experiences` | 29 | **29** |
| contact+25 の `email_scout_enabled` | true | **true** |
| contact+25 の `career_stance` | `researching` | **`researching`** |
| `.env.local` の `SCOUT_SENDING_ENABLED` | 無し | **無し**（バックアップから復元） |
| dev の `POST /api/biz/scouts` | 503 | **503** |

⚠️ 削除したもの: `ow_scouts` 1 / `ow_notifications(scout)` 1 / `ow_conversations` 1 /
   `ow_conversation_messages` 1 / `ow_conversation_participants` 1 / `ow_scout_quotas` 1。
⚠️ **本番のフラグは触っていない**（本番の `POST /api/biz/scouts` は今も 503）。
