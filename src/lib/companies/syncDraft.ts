/**
 * ★運営が本番の列を書き換えたとき、企業の下書き（ow_companies.draft_data）の同じキーもそろえる（2026-10-29）。
 *
 * なぜ: 企業の編集画面（/biz/company）は下書きを読み戻し、「公開する」で下書きを本番の列へ展開する
 * （lib/companies/applyDraft.ts）。運営が本番の列だけを変えると、
 *   ・企業の編集画面には古い下書きの値が出る
 *   ・企業が別の項目を直して「公開する」を押した瞬間に、古い下書きの値で本番が上書きされる
 * 2026-10-29 に COIN のカジュアル面談の受付で見つけた（下書きに false が残っていた）。
 *
 * ⚠️ 下書きに**そのキーがあるときだけ**書き換える。無いキーは足さない（下書きの形を変えない）。
 * ⚠️ 下書きが無い（null）企業では何もしない。
 * ⚠️ いまは面談の受付（accepting_casual_meetings）だけが呼ぶ。運営の企業詳細の保存（PUT）が書くほかの列も
 *    同じ問題を持つが、範囲を広げる判断はまだしていない。
 *
 * @returns 書き込みに渡す draft_data（変える必要が無ければ undefined。undefined のキーは送られない）
 */
export function draftWithPatch(
  draft: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return undefined;
  const d = draft as Record<string, unknown>;
  const keys = Object.keys(patch).filter((k) => Object.prototype.hasOwnProperty.call(d, k) && d[k] !== patch[k]);
  if (keys.length === 0) return undefined;
  const next = { ...d };
  for (const k of keys) next[k] = patch[k];
  return next;
}
