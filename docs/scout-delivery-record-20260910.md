# スカウトの通知メールの送信結果を記録する（2026-09-10）

解禁前の作業。**フラグを開けた瞬間に効いてくるので、開ける前に必須**だった。

## 直す前に起きていたこと

| # | 事実 |
|---|---|
| ① | 握り潰しが**3重**（`notify()` が例外を飲む／`sendEmail()` は Resend の error を console に出すだけ／`sendScoutEmail` の catch） |
| ② | 企業には常に `{ok:true}`。**送れていなくても「送信しました」と出る** |
| ③ | `RESEND_API_KEY` が外れていると **mock で正常終了**し、誰にも届かないまま気づけない |
| ④ | `ow_scouts` に送信結果の列が無い。**再送も、送れたかの確認もできない** |

---

## 決めたこと

### 1. 記録先 ── `ow_scouts` に4列

`email_status` / `email_sent_at` / `email_error` / `email_provider_id`。

⚠️★**`ow_scouts` が本番0件のうちに入れた**ので `NOT NULL DEFAULT 'pending'` にできた。
「NULL は記録が無いという意味」という**曖昧さを最初から作らない**。
**行が増えてからでは同じことはできない。**

⚠️★**`status`（スカウトそのものの状態）と混ぜないこと。** 別の軸。列の COMMENT にも書いた。

⚠️ `email_provider_id`（Resend の message id）も**今回入れた**。後から問い合わせるときの
唯一の手がかりで、**後から足すほうが高くつく。**

#### 5値。⚠️ CHECK と定数を同じ migration で入れた

| 値 | 意味 | 未達に数えるか |
|---|---|---|
| `pending` | まだ試していない | ✗ |
| `sent` | Resend が受理した。⚠️ **受信・開封は意味しない** | ✗ |
| **`skipped`** | **本人がメール通知を切っている。正常** | ✗ |
| `failed` | 送れなかった | **✓** |
| `mocked` | `RESEND_API_KEY` が無く**送っていない** | **✓** |

⚠️★**`failed` は「Resend が失敗した」だけではない。**宛先が用意できなかった場合も含む
（`auth_id` が無い／`ow_users.email` が空）。**本人の設定ではない**ので `skipped` に入れない
——運営の要対応に出て直せるほうがよい。

### 2. 失敗の知らせ方

| 誰に | 何を | 出さないもの |
|---|---|---|
| **運営** | `/admin` の要対応タスク「**メールが届かなかったスカウト N件**」。**0件が正常** | — |
| **企業** | `/biz/scouts` の該当行に「**本人にメールでは通知できませんでした（アプリ内には届いています）**」 | ★**`skipped` には出さない** |
| **候補者** | **何も出さない**（アプリ内には届いているので、本人の画面に矛盾が無い） | — |

⚠️★**`skipped` を企業に出さない理由。** あれは「本人がメール通知を切っている」という
**本人の設定**で、企業に知らせるものではない。出すと、**本人が企業に開示していない設定が
企業側に伝わる**。しかもアプリ内通知は届いているので**未達ですらない。**

⚠️★**文言の括弧を消さないこと。** 無いと企業は「候補者に何も届いていない」と読み、
`/biz/candidates` から**二重に送ろうとする。**

⚠️ **運営にメールで知らせる形は採らない。** メールが落ちている状況で**同じ理由で落ちる。**

⚠️ 要対応カードに**リンクは張っていない**。一覧の画面がまだ無く、原因は
`ow_scouts.email_error` に入っている。**件数が増えるようなら一覧を作ること。**

### 3. `notify()` → `sendEmailStrict()`

成否を戻り値で受ける。`sendEmailStrict` は Resend の message id も返すようにした。

⚠️★**企業に 500 を返さない。** スカウトの行は既に入っていて**アプリ内通知も届いている**ので、
**送信自体は成功している**。500 にすると企業は再送を試み、候補者に**二重に届く。**
扱いは「送信の失敗」ではなく「**通知手段のひとつが欠けた**」。
応答は `{ ok: true, emailDelivered: boolean }`。

⚠️ `emailDelivered` が false になるのは `failed` / `mocked` だけ。**`skipped` は true 側**。

### 4. `RESEND_API_KEY` の事故は**送信時**に止める

⚠️★**起動時に落とさない。** メールと無関係なページまで巻き込んで**本番が丸ごと止まる。**
本番かつキーが無ければ、**そのスカウトだけを 503 で断る**（dev では止めない。`mocked` が正しい記録）。

`/api/health` に **`hasResendKey`**（真偽のみ・値は出さない）を足した。
⚠️★**フラグを開ける前にここを見ること。**

---

## 実測（dev / 4状態を実際に作った）

⚠️★**メールは1通も送っていない。** `sent` / `failed` は `sendEmailStrict` を
**一時的にスタブ**して Resend を呼ばずに戻り値だけ作り、`mocked` は
**`RESEND_API_KEY` を実際に外して**測った。`skipped` は送信処理の手前で返る。
⇒ **Resend への呼び出しは0回。**

送信元は **【テスト】株式会社データプール**（`is_test`）、宛先は **テスト太郎3**（`is_test`）。
⚠️ **実企業・実ユーザーは一切使っていない。**

### `ow_scouts` に何が入ったか

| 状態 | `email_status` | `email_sent_at` | `email_provider_id` | `email_error` | 応答 |
|---|---|---|---|---|---|
| sent | `sent` | **あり** | あり | null | `{ok:true, emailDelivered:true}` |
| failed | `failed` | null | null | **あり** | `{ok:true, **emailDelivered:false**}` |
| skipped | `skipped` | null | null | null | `{ok:true, **emailDelivered:true**}` |
| mocked | `mocked` | null | null | null | `{ok:true, **emailDelivered:false**}` |

### 画面（★今回の修正点）

⚠️ **RSC ペイロードが `<script>` に同じ文字列を持つので、除いてから数える。**
除かずに数えて **2件を4件と読み違えた**（CLAUDE.md「script を除いた実HTML」と同じ罠）。

| `/biz/scouts` の行 | 通知文が出るか |
|---|---|
| sent | **false** |
| failed | **true** |
| **skipped** | ★**false**（今回の修正点） |
| mocked | **true** |

`/admin`: **「メールが届かなかったスカウト 2件」**（sent と skipped は数えない）。
要対応タスクは 1件 → **3件**（＋2）。

### プランのゲートも通しで確認した

`free` のまま送ると **403「スカウトの送信は有料プランの機能です。」**
（2026-09-10 に入れたサーバー側ゲート。画面を通らない POST でも止まる）。

### 後片付け

| | 作業前 | 作業後 |
|---|---|---|
| `ow_scouts` | 0 | **0** |
| `ow_scout_quotas` | 0 | **0** |
| `ow_notifications` | 1 | **1** |
| データプールの `plan_type` | `free` | **`free`** |
| **有料プランの企業** | 0社 | **0社** |
| テスト太郎3 の `email_scout_enabled` | true | **true** |
| `.env.local` | — | **SHA-256 一致**（`6cb68ba3…`） |
| `src/lib/notify/email.ts`（スタブ） | — | **SHA-256 一致**（`ee4ad570…`） |

⚠️ 削除: `ow_scouts` 4 / `ow_notifications(scout)` 4 / `ow_scout_quotas` 1。
⚠️ 検証用スクリプト（`scripts/tmp-scout-verify.mjs`）とクッキーのファイルは**削除済み**。
⚠️ **本番のフラグは触っていない**（本番の `POST /api/biz/scouts` は今も 503）。
⚠️ 副作用として `hshiba@opinio.co.jp`（**`is_test` の運営アカウント**）の
   `auth.users.last_sign_in_at` が更新された。`/admin` を見るためのログイン。**データは変えていない。**

---

## ★`ow_scout_quotas` の作り方・0 にする方法（解禁の手順で要る）

| したいこと | やり方 |
|---|---|
| **上限を明示して作る** | `/admin/scout-quotas` の「月間上限」を保存する（`updateMonthlyLimit`） |
| **作らない** | 何もしない。⚠️ **最初の送信時に `can_send_scout()` が行を作り、`monthly_limit` は DB の既定 30** |
| **止める（0通にする）** | `/admin/scout-quotas` で `monthly_limit` を **0** にする |

⚠️★**行が無い状態で開けると、実質「30通」で開く。** 30通でよいかを決めてから開けること。
⚠️ **月次リセットはトリガーでも cron でもない**（`can_send_scout()` の中だけ）。
   表示は必ず `usedThisMonth()` を通す（`lib/constants/scoutQuota.ts`）。
