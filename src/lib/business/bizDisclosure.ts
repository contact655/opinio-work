/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcDisclosureScore, type BizScoreItem, type ScoreBreakdown } from "@/lib/utils/disclosureScore";
import { normalizeBenefits } from "@/lib/companies/benefits";

/**
 * ★企業ページの開示充実度（企業入力）を、企業ごとに1回で組む（2026-10-10 / 候補者探し 段4 でホームから切り出した）。
 * ⚠️★企業ホームと「声かけを書く」が同じ関数を呼ぶ。材料の取り方を2か所に書かない（数字が食い違う）。
 * ⚠️ 点数の規則は `lib/utils/disclosureScore.ts` の `calcDisclosureScore`（ここでは材料を集めるだけ）。
 * ⚠️ 取れなければ null（画面は充実度の欄を出さない）。
 */
export const BIZ_SCORE_ITEM_HREF: Record<BizScoreItem, string> = {
  tagline: "/biz/company",
  description: "/biz/company",
  photo: "/biz/company",
  benefits: "/biz/company",
  job: "/biz/jobs",
  story: "/biz/posts",
};

export async function getBizDisclosure(companyId: string): Promise<ScoreBreakdown | null> {
  const db = createAdminClient();
  const [co, photos, stories, tools, jobs] = await Promise.all([
    db.from("ow_companies").select(
      "tagline, benefits, description, culture_description, customer_cases, market_customer_size, capital_type, branch_locations, org_teams",
    ).eq("id", companyId).maybeSingle(),
    db.from("ow_company_office_photos").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    db.from("ow_company_posts").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_published", true),
    db.from("ow_company_tools").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    db.from("ow_jobs").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "published"),
  ]);
  for (const r of [co, photos, stories, tools, jobs]) {
    if (r.error) { console.error("[bizDisclosure]", r.error.message); return null; }
  }
  const f = co.data;
  if (!f) return null;
  return calcDisclosureScore({
    tagline: (f.tagline as string | null) ?? null,
    description: (f.description as string | null) ?? null,
    photoCount: photos.count ?? 0,
    benefitsCount: (normalizeBenefits(f.benefits) ?? []).length,
    hasPublishedJob: (jobs.count ?? 0) > 0,
    hasPublishedStory: (stories.count ?? 0) > 0,
    cultureDescription: (f.culture_description as string | null) ?? null,
    customerCases: Array.isArray(f.customer_cases) ? f.customer_cases : null,
    marketCustomerSize: (f.market_customer_size as string[] | null) ?? null,
    capitalType: (f.capital_type as string | null) ?? null,
    branchLocations: (f.branch_locations as string[] | null) ?? null,
    orgTeams: Array.isArray(f.org_teams) ? f.org_teams : null,
    toolCount: tools.count ?? 0,
  });
}
