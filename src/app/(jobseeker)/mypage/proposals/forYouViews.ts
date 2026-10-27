import { companyLinkStateFor } from "@/lib/companies/linkState";
import { groupLabel } from "@/lib/forYou/weights";
import type { buildForYou } from "@/lib/forYou/rank";
import type { ForYouView } from "./ForYouSection";

/**
 * ★「あなたに合う会社」の行（ForYouView）を作る。マイページの「あなたに合う会社」とホームが同じ関数を使う（2026-10-27）。
 * ⚠️ 上段の提案に出ている会社は除く（excludeIds）。順位は除いたあとで振り直す（1位が欠けた形にしない）
 */
export function toForYouViews(
  forYou: Awaited<ReturnType<typeof buildForYou>>,
  viewerIsTest: boolean,
  excludeIds: ReadonlySet<string> = new Set(),
): ForYouView[] {
  if (!forYou.ok) return [];
  return forYou.companies
    .filter((c) => !excludeIds.has(c.id))
    .map((c, i) => ({
      id: c.id,
      rank: i + 1,
      name: c.name,
      /* ★見ている人と会社がどちらも検証用なら文字だけ（企業ページは検証用の会社を誰にも開かない） */
      href: companyLinkStateFor({ isTest: c.isTest, isPublished: c.isPublished }, { viewerIsTest }) === "open"
        ? `/companies/${c.slug ?? c.id}` : null,
      tagline: c.tagline,
      logoUrl: c.logoUrl,
      reasons: c.reasons,
      /* ★1番目の理由で束ねる見出し（無ければ「その他の掲載企業」へ） */
      groupLabel: c.signals[0] ? groupLabel(c.signals[0].detail) : null,
      hasOpenJobs: c.hasOpenJobs,
      phaseLabel: c.phaseLabel,
      cautions: c.cautions,
      hasResponder: c.hasResponder,
      reaction: c.reaction?.reaction ?? null,
      conversationId: c.reaction?.conversationId ?? null,
      interested: !!c.reaction?.interestedAt,
      interestStatus: (c.reaction?.interestStatus as ForYouView["interestStatus"]) ?? null,
    }));
}
