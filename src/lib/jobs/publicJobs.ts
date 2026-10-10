/**
 * ★求職者に出してよい求人の条件（2026-10-09）。**公開側の求人クエリはすべてここを通す。**
 *
 * ```ts
 * db.from("ow_jobs").select("id, title").match(PUBLIC_JOB_MATCH)
 * ```
 *
 * | 条件 | 意味 |
 * |---|---|
 * | `status = 'published'` | 運営が公開した求人 |
 * | `is_test = false` | 検証用の求人ではない。★**企業が検証用でないことも含む**（下） |
 *
 * ⚠️★**「企業が is_test でない」はこの `is_test = false` に含まれている。**
 *    DB のトリガー（`20261009090000`）が「企業が is_test なら求人も is_test」を保証する
 *    ——作成・更新時に引き継ぎ（`/biz`・運営・今後の経路すべて）、企業が検証用になった
 *    ときにも伝える。だから求人の列だけで判定できる。
 *    ⚠️ 2026-10-09 まではこの保証が無く、検証用企業が作った求人を運営が公開すると
 *       公開側にそのまま出る形だった（実データは0件）。
 * ⚠️★**呼び出し側に `.eq("status", "published").eq("is_test", false)` を書き戻さないこと。**
 *    26箇所に同じ条件が散っていたのをここに寄せた。条件を足す日に1箇所で済ませるため。
 * ⚠️ 企業ページの公開・掲載（`is_published` / `listing_status`）は別の軸。
 *    それは `lib/companies/visibility.ts` のヘルパーで見る。
 * ⚠️ クライアントコンポーネントからも読むので、ここにサーバー専用のものを置かない。
 */
export const PUBLIC_JOB_MATCH = { status: "published", is_test: false } as const;

/**
 * ★求職者の画面で、ある求人を「掲載中」と扱うか（2026-10-11 / 柴さんの指示）。
 *   open      … 誰に対しても掲載中（`PUBLIC_JOB_MATCH` と同じ条件）。求人ページへリンクしてよい
 *   open_test … **見ている人と企業がどちらも検証用**のときの検証用の求人。掲載中として扱う。
 *               ⚠️★求人ページ（`/jobs/[id]`）へはリンクしない。あのページは ISR で全員に同じ HTML を配るので、
 *                  検証用の求人を見せる形にできない（`PUBLIC_JOB_MATCH` で 404 になる）。
 *   closed    … 掲載を終了した（またはこの人には見せない）
 * ⚠️ 読み取りの決まり（`auth_is_test_user()`。20261011030000）と同じ考え方。実在の利用者には open_test を返さない。
 */
export type JobListingState = "open" | "open_test" | "closed";
export function jobListingStateFor(
  job: { status: string | null; is_test: boolean | null },
  ctx: { viewerIsTest: boolean; companyIsTest: boolean },
): JobListingState {
  if (job.status !== "published") return "closed";
  if (job.is_test !== true) return "open";
  return ctx.viewerIsTest && ctx.companyIsTest ? "open_test" : "closed";
}
/** open_test のときに求人名の横に添える一言 */
export const TEST_JOB_LISTED_NOTE = "掲載中（検証用の求人のため、求人ページは開きません）";
