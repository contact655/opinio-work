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
