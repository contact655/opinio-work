import "server-only";
import { companyDisplayName } from "@/lib/companies/displayName";
import { TEST_JOB_LISTED_NOTE } from "@/lib/jobs/publicJobs";
import { getOwnCompanyId } from "@/lib/companies/ownCompany";
import { listIncomingApproaches } from "@/lib/approaches/server";
import type { IncomingApproachView } from "@/components/approaches/incomingApproachView";

/**
 * ★求職者に届いている、まだ返信していない企業からのメッセージを画面用の形にする（2026-10-11）。
 *   /mypage/conversations の「未返信」が使う（旧 /mypage/approaches はここへ 301 転送）。
 * ⚠️ 何を出すかは `listIncomingApproaches`（まだ答えていない・30日以内・いま見せてよい企業）。ここで条件を足さない。
 * ⚠️★理由と本文は返信前でも全文見せる（2026-10-09 / 柴さんの判断）。
 * 取得に失敗したら null（0件と区別する）。
 */
export async function loadIncomingApproachViews(owUserId: string): Promise<IncomingApproachView[] | null> {
  const list = await listIncomingApproaches(owUserId);
  if (list === null) return null;
  /* ★運営会社（2026-10-10）。⚠️ null（見つからない）は「運営会社でない」に倒す */
  const ownCompanyId = await getOwnCompanyId();
  return list.map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    reason: a.reason,
    body: a.body,
    senderName: a.senderName,
    senderRole: a.senderRole,
    companyName: companyDisplayName(a.company.name, a.company.nameEn).displayName,
    /* ★見ている人と会社がどちらも検証用なら、社名は文字だけ（企業ページは開かない。`companyLinkStateFor`） */
    companyHref: a.company.linkState === "open" ? `/companies/${a.company.slug ?? a.company.id}` : null,
    isOwnCompany: ownCompanyId !== null && a.company.id === ownCompanyId,
    logoUrl: a.company.logoUrl,
    logoLetter: a.company.logoLetter,
    logoGradient: a.company.logoGradient,
    job: a.job ? {
      title: a.job.title,
      href: a.job.state === "open" ? `/jobs/${a.job.slug ?? a.job.id}` : null,
      /* ★見ている人と企業がどちらも検証用なら、掲載中として扱う（リンクはしない。`jobListingStateFor`） */
      note: a.job.state === "open_test" ? TEST_JOB_LISTED_NOTE : null,
    } : null,
  }));
}
