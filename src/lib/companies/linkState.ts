/**
 * ★求職者の画面で、会社名を企業ページへのリンクにするか（2026-10-11 / 柴さんの指示）。
 *   求人の `jobListingStateFor`（lib/jobs/publicJobs.ts）と同じ考え方。
 *
 *   open      … 企業ページへリンクしてよい
 *   open_test … **見ている人と会社がどちらも検証用**。会社はあるものとして扱う
 *               （「公開を終了しました」とは出さない）が、リンクはしない。
 *               ⚠️★企業ページ（`/companies/[id]`）は ISR で全員に同じ HTML を配るので、
 *                  検証用の会社のページは誰に対しても開けない（404）。
 *   closed    … 開けない（ページ非公開、またはこの人には見せない検証用の会社）
 *
 * ⚠️ `isPublished` を渡さない呼び出し側（声かけ・提案）は、公開の有無を見ていない
 *    これまでの扱い（リンクする）のまま。**実在の会社のリンクは変えない**。
 * ⚠️ クライアントコンポーネントからも読めるよう、ここにサーバー専用のものを置かない。
 */
export type CompanyLinkState = "open" | "open_test" | "closed";

export function companyLinkStateFor(
  company: { isTest: boolean | null | undefined; isPublished?: boolean | null },
  ctx: { viewerIsTest: boolean },
): CompanyLinkState {
  if (company.isTest === true) return ctx.viewerIsTest ? "open_test" : "closed";
  if ("isPublished" in company && company.isPublished !== true) return "closed";
  return "open";
}
