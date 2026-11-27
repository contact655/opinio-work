import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterListedCompanies } from "@/lib/companies/visibility";
import { companyBrandName } from "@/lib/companies/displayName";
import { PUBLIC_JOB_MATCH } from "@/lib/jobs/publicJobs";
import { respondingCompanyIds } from "@/lib/jobs/respondingJobs";

export const SIMILAR_COMPANIES_LIMIT = 3;

export type SimilarCompany = {
  id: string;
  slug: string | null;
  name: string;
  logoUrl: string | null;
  logoLetter: string | null;
  /** 主の事業領域（無ければ null） */
  domainName: string | null;
  /** 公開中で、応募に答えられる担当者がいる会社の募集の数 */
  jobCount: number;
};

/**
 * ★企業ページのサイドバー「似ている企業」（2026-11-26 / 柴さんの指示）。
 *   この会社の**主の事業領域**を持つ（主でなくてよい）、一覧に掲載中の別の会社を最大3社。
 *   並び: 採用中の募集がある会社が先 → 社名順。
 *
 * ⚠️ 掲載中の判定は filterListedCompanies（一覧と同じ）。非掲載・検証用・停止中は出さない。
 * ⚠️ 募集の数は PUBLIC_JOB_MATCH → respondingCompanyIds（企業ページの「採用中 N件」と同じ規則）。
 * ⚠️ 会社の情報だけなのでサーバーで描いてよい（人の情報は入れない）。
 * ⚠️ 取れなければ []（カードごと出さない。ページは出す）
 */
export async function getSimilarCompanies(companyId: string): Promise<SimilarCompany[]> {
  const db = createAdminClient();
  const { data: mine, error: mErr } = await db.from("ow_company_business_domains")
    .select("domain_id").eq("company_id", companyId).eq("is_primary", true).limit(1);
  if (mErr) { console.error("[similarCompanies] primary:", mErr.message); return []; }
  const domainId = (mine?.[0]?.domain_id as string | undefined) ?? null;
  if (!domainId) return [];

  const { data: links, error: lErr } = await db.from("ow_company_business_domains")
    .select("company_id").eq("domain_id", domainId).neq("company_id", companyId);
  if (lErr) { console.error("[similarCompanies] links:", lErr.message); return []; }
  const ids = Array.from(new Set((links ?? []).map((l) => l.company_id as string)));
  if (ids.length === 0) return [];

  const { data: cos, error: cErr } = await filterListedCompanies(
    db.from("ow_companies").select("id, slug, name, name_en, brand_name, logo_url, logo_letter").in("id", ids),
  );
  if (cErr) { console.error("[similarCompanies] companies:", cErr.message); return []; }
  const listed = (cos ?? []) as { id: string; slug: string | null; name: string; name_en: string | null; brand_name: string | null; logo_url: string | null; logo_letter: string | null }[];
  if (listed.length === 0) return [];
  const listedIds = listed.map((c) => c.id);

  const [{ data: prim, error: pErr }, { data: jobs, error: jErr }, responding] = await Promise.all([
    db.from("ow_company_business_domains").select("company_id, ow_business_domains(name, is_active)")
      .in("company_id", listedIds).eq("is_primary", true),
    db.from("ow_jobs").select("company_id").match(PUBLIC_JOB_MATCH).in("company_id", listedIds),
    respondingCompanyIds(listedIds, "similarCompanies"),
  ]);
  if (pErr) console.error("[similarCompanies] domains:", pErr.message);
  if (jErr) console.error("[similarCompanies] jobs:", jErr.message);

  const domainOf = new Map<string, string>();
  for (const r of prim ?? []) {
    const d = r.ow_business_domains as unknown as { name: string; is_active: boolean } | null;
    if (d && d.is_active) domainOf.set(r.company_id as string, d.name);
  }
  const jobsOf = new Map<string, number>();
  for (const j of jobs ?? []) {
    const cid = j.company_id as string;
    if (!responding.has(cid)) continue;
    jobsOf.set(cid, (jobsOf.get(cid) ?? 0) + 1);
  }

  return listed
    .map((c): SimilarCompany => ({
      id: c.id,
      slug: c.slug,
      name: companyBrandName(c),
      logoUrl: c.logo_url,
      logoLetter: c.logo_letter,
      domainName: domainOf.get(c.id) ?? null,
      jobCount: jobsOf.get(c.id) ?? 0,
    }))
    .sort((a, b) => (Number(b.jobCount > 0) - Number(a.jobCount > 0)) || a.name.localeCompare(b.name, "ja"))
    .slice(0, SIMILAR_COMPANIES_LIMIT);
}
