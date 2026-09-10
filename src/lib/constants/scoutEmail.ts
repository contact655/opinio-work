/**
 * スカウトの通知メールの送信結果（2026-09-10）。
 *
 * ── ★何のためにあるか ──────────────────────────────────────────────────────
 * 解禁前の確認で、**送信結果がどこにも残っていない**ことが分かった。
 * `notify()` が例外を飲み、`sendEmail()` は Resend の error を console に出すだけ、
 * さらに `sendScoutEmail` の catch が受ける——**3重に握り潰していた。**
 * 企業には常に `{ok:true}` が返るので、**届いていなくても「送信しました」と出る。**
 *
 * ⚠️★**`ow_scouts.status`（スカウトそのものの状態）と混ぜないこと。** 別の軸。
 *
 * ⚠️★**DB の CHECK（`ow_scouts_email_status_check`）と同じ5値。**
 *    片方だけ増やすと「保存できるのに絞れない」か「選べるのに保存できない」になる
 *    （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
 */
export const SCOUT_EMAIL_STATUSES = [
  "pending",
  "sent",
  "skipped",
  "failed",
  "mocked",
] as const;

export type ScoutEmailStatus = (typeof SCOUT_EMAIL_STATUSES)[number];

/**
 * ★**`skipped` を失敗に数えないこと。** 本人が「スカウトのお知らせ」を切っているだけで、
 * **アプリ内通知は届いている**（`ow_notifications` の INSERT は配信停止を見ない）。
 * 正常な結果。
 *
 * ⚠️ `pending` も失敗ではない。まだ試していない、または送信処理まで到達していない。
 */
export const SCOUT_EMAIL_UNDELIVERED: readonly ScoutEmailStatus[] = ["failed", "mocked"];

export function isScoutEmailUndelivered(s: string | null | undefined): boolean {
  return s != null && (SCOUT_EMAIL_UNDELIVERED as readonly string[]).includes(s);
}

/**
 * 企業側（`/biz/scouts`）に出す一文。
 *
 * ⚠️★**括弧の中を消さないこと。** 無いと企業は「候補者に何も届いていない」と読み、
 *    `/biz/candidates` から二重に送ろうとする。**実際には届いている。**
 *
 * ⚠️★**`skipped` にこの文言を出さないこと。** あれは本人がメール通知を切っている
 *    という**本人の設定**で、企業に知らせるものではない。出すと、本人が企業に
 *    開示していない設定が企業側に伝わることになる。
 */
export const SCOUT_EMAIL_UNDELIVERED_NOTICE =
  "本人にメールでは通知できませんでした（アプリ内には届いています）";
