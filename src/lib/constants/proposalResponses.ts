/**
 * 提案への返答（②⑨）と、③の双方合意の段。
 *
 * ⚠️★**DB の CHECK（`candidate_response_check` / `company_response_check`）と
 *    同じ値にすること。** 片方だけ足すと「押せるのに保存できない」になる
 *    （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
 *
 * ⚠️★**`null` は「まだ答えていない」。「見送った」ではない。**
 *    画面でも「未回答」と出すこと。0件と同じで、**無いことを有る値に置き換えない**。
 */

/** 求職者（②）の返答 */
export const CANDIDATE_RESPONSES = ["interested", "declined"] as const;
export type CandidateResponse = (typeof CANDIDATE_RESPONSES)[number];

/** 企業（⑨）の返答 */
export const COMPANY_RESPONSES = ["want_to_meet", "declined"] as const;
export type CompanyResponse = (typeof COMPANY_RESPONSES)[number];

export const CANDIDATE_RESPONSE_LABELS: Record<CandidateResponse, string> = {
  interested: "興味がある",
  declined: "今は見送る",
};

export const COMPANY_RESPONSE_LABELS: Record<CompanyResponse, string> = {
  want_to_meet: "会いたい",
  declined: "見送る",
};

export function isCandidateResponse(v: string): v is CandidateResponse {
  return (CANDIDATE_RESPONSES as readonly string[]).includes(v);
}
export function isCompanyResponse(v: string): v is CompanyResponse {
  return (COMPANY_RESPONSES as readonly string[]).includes(v);
}

/**
 * ③の双方合意の段。**今回は状態を持つだけで、UI は作っていない。**
 *
 * ⚠️ 列は増やしていない。`candidate_response` と `company_response` から**導出**する。
 *    ★状態を別の列で持つと、2つの返答と食い違う余地ができる。
 */
export type ProposalStage = "proposed" | "candidate_only" | "company_only" | "mutual" | "closed";

export function proposalStage(
  candidate: string | null,
  company: string | null,
): ProposalStage {
  if (candidate === "declined" || company === "declined") return "closed";
  const c = candidate === "interested";
  const k = company === "want_to_meet";
  if (c && k) return "mutual";
  if (c) return "candidate_only";
  if (k) return "company_only";
  return "proposed";
}
