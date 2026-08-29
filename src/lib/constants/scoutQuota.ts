/**
 * スカウト送信枠の既定値と、行が無いときの読み方（2026-08-29）。
 *
 * ── ★行が無い企業がある。それが正常 ────────────────────────────────────────
 * `ow_scout_quotas` は**1社1行**だが、**企業を作った時点では行を作らない。**
 * 最初にスカウトを送ろうとした瞬間に `can_send_scout()` が
 * `insert ... on conflict do nothing` で作る。
 *
 * 実測（2026-08-29 / 本番）: `ow_scout_quotas` **0行** / `ow_scouts` **0件**。
 * つまり**全86社が「行なし」**。スカウトは `SCOUT_SENDING_ENABLED` 未設定で
 * 止めてあるので、これは正常な状態。
 *
 * ⚠️ したがって「30通」という表示は**嘘ではない**。行が無い企業に実際に適用される
 *    値が 30（DB の `DEFAULT 30`）だから。**ただし「運営が30に決めた」のか
 *    「まだ決めていない」のかが画面から見分けられない**ので、そこは別に示す。
 *
 * ── ⚠️★DB の DEFAULT と二重管理になっている ────────────────────────────────
 * この定数は `ow_scout_quotas.monthly_limit` の **`DEFAULT 30` と同じ値**を
 * アプリ側に持ったもの。**片方だけ変えると食い違う。**
 * 変えるときは migration とこの定数を**同じコミットで**動かすこと。
 *
 * ⚠️ **行を作るコードに `monthly_limit` を書かないこと。** 書くと DB の DEFAULT を
 *    通らなくなり、既定値を変えてもその経路だけ古い値を入れ続ける。
 *    運営が上限を明示して作るとき（`updateMonthlyLimit`）だけは書いてよい。
 */
export const SCOUT_MONTHLY_LIMIT_DEFAULT = 30;

/**
 * 「今月の使用数」。⚠️ **`period_start` を見ずに `used_this_month` を出さないこと。**
 *
 * ── ★月次リセットは自動では起きない ────────────────────────────────────────
 * `used_this_month` を 0 に戻すのは **`can_send_scout()` の中だけ**で、
 * **トリガーも cron も無い**（2026-08-29 に migration と本番の両方で確認）。
 * つまり**次に誰かが送信するまで、先月の数字が残り続ける。**
 *
 * ⚠️ `actions.ts` に「period_start は月次リセット時に DB トリガーが更新する」と
 *    書かれていたが**事実と違う**（2026-08-29 に訂正）。
 *
 * したがって画面で「今月使用」を出すときは、行の `period_start` が今月でなければ
 * **0 として扱う**。実際に次の送信時そうなるので、これが正しい値。
 */
export function usedThisMonth(
  used: number | null | undefined,
  periodStart: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!used) return 0;
  if (!periodStart) return 0;
  const m = /^(\d{4})-(\d{2})/.exec(periodStart);
  if (!m) return 0;                       // ⚠️ 読めない値は 0。推測しない
  const sameMonth =
    Number(m[1]) === now.getFullYear() && Number(m[2]) === now.getMonth() + 1;
  return sameMonth ? used : 0;
}
