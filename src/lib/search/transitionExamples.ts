import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/paging";
import { filterListedCompanies } from "@/lib/companies/visibility";
import { companyDisplayName } from "@/lib/companies/displayName";
import { getRoleTree } from "@/lib/supabase/queries";
import { expandWithAncestors } from "@/lib/roles/jobRoles";
import { AGGREGATE_USER_COLUMNS, isAggregatableUser, type AggregateUser } from "@/lib/aggregate/population";
import { MIN_CAREER_FACT_COUNT } from "@/lib/constants/aggregate";
import { interpretQuery } from "./interpretQuery";
import { matchTransition, type MatchExp } from "./transitionMatch";

/**
 * ★「こんな探し方もできます」の移動の例文（2026-10-27 / 柴さんの指示）。**いまのデータで当てはまる人がいる文だけ**を返す。
 *
 *   「〈会社〉を出た人」 … 掲載企業ごとに、その会社を出た人（集計に入れてよい人）が3人以上いる会社だけ
 *   「IT以外から来た人」「異業界に移った人」「未経験から営業」 … 当てはまる人が3人以上いるものだけ
 *
 * ⚠️ 下限は MIN_CAREER_FACT_COUNT（3人）。動き方の集計が出る人数と同じにする（押して集計が何も出ない例文を出さない）
 * ⚠️ 文は実際に interpretQuery で読み直し、狙いどおりに読めたものだけ返す（読めない文を例に出さない）
 * ⚠️ 1時間キャッシュ。例文は件数がわずかに変わっても困らない
 */
const GENERIC_CANDIDATES = ["IT以外から来た人", "異業界に移った人", "未経験から営業"] as const;
const MAX_COMPANY_EXAMPLES = 2;

export const getTransitionExamples = unstable_cache(
  async (): Promise<string[]> => {
    const db = createAdminClient();
    const [userRes, expRes, coRes, indRes, listedRes, tree] = await Promise.all([
      fetchAllRows((f, t) => db.from("ow_users").select(`id, email, ${AGGREGATE_USER_COLUMNS}`).order("id").range(f, t), "examples users"),
      fetchAllRows((f, t) => db.from("ow_experiences")
        .select("id, user_id, company_id, company_text, visibility_company, started_at, ended_at, is_current, role_category_id")
        .order("id").range(f, t), "examples exps"),
      fetchAllRows((f, t) => db.from("ow_companies").select("id, industry_id, is_foreign").order("id").range(f, t), "examples companies"),
      db.from("ow_industries").select("id, parent_id"),
      filterListedCompanies(db.from("ow_companies").select("id, name, name_en")),
      getRoleTree(),
    ]);
    for (const [label, r] of Object.entries({ userRes, expRes, coRes, indRes, listedRes })) {
      if (r.error) { console.error(`[transitionExamples] ${label}:`, r.error); return []; }
    }
    const users = new Map(((userRes.data ?? []) as unknown as (AggregateUser & { id: string })[]).filter((u) => isAggregatableUser(u)).map((u) => [u.id, u]));
    const parentOf = new Map(((indRes.data ?? []) as { id: string; parent_id: string | null }[]).map((r) => [r.id, r.parent_id ?? r.id]));
    const companyOf = new Map(((coRes.data ?? []) as { id: string; industry_id: string | null; is_foreign: boolean | null }[]).map((c) => [c.id, c]));

    type Exp = { id: string; user_id: string; company_id: string | null; company_text: string | null; visibility_company: string | null; started_at: string | null; ended_at: string | null; is_current: boolean | null; role_category_id: string | null };
    const byUser = new Map<string, Exp[]>();
    for (const e of (expRes.data ?? []) as Exp[]) {
      if (!users.has(e.user_id) || !e.started_at) continue;
      byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);
    }
    const toMatch = (e: Exp): MatchExp => {
      const real = e.visibility_company === "real";
      const c = real && e.company_id ? companyOf.get(e.company_id) : undefined;
      return {
        id: e.id,
        key: real ? (e.company_id ?? (e.company_text?.trim().toLowerCase() || `anon:${e.id}`)) : `masked:${e.id}`,
        companyId: real ? e.company_id : null,
        startedAt: e.started_at as string,
        endedAt: e.ended_at,
        isCurrent: e.is_current === true,
        industryParentId: c?.industry_id ? parentOf.get(c.industry_id) ?? null : null,
        isForeign: c ? c.is_foreign : null,
        roleIds: expandWithAncestors(tree, e.role_category_id ? [e.role_category_id] : []),
      };
    };

    const out: string[] = [];
    /* 「〈会社〉を出た人」：その会社の職歴（会社名を出してよいもの）が全部終わっている人が3人以上 */
    const companyRows = ((listedRes.data ?? []) as { id: string; name: string; name_en: string | null }[])
      .map((c) => {
        let alumni = 0;
        for (const exps of Array.from(byUser.values())) {
          const here = exps.filter((e) => e.company_id === c.id && e.visibility_company === "real");
          if (here.length > 0 && here.every((e) => e.is_current !== true)) alumni++;
        }
        return { ...c, alumni };
      })
      .filter((c) => c.alumni >= MIN_CAREER_FACT_COUNT)
      .sort((a, b) => b.alumni - a.alumni);
    for (const c of companyRows) {
      if (out.length >= MAX_COMPANY_EXAMPLES) break;
      const phrase = `${companyDisplayName(c.name, c.name_en).displayName}を出た人`;
      const r = await interpretQuery(phrase);
      if (r.transition?.kind === "left" && r.transition.companyId === c.id) out.push(phrase);
    }
    /* 会社を指定しない移動：当てはまる人が3人以上 */
    for (const phrase of GENERIC_CANDIDATES) {
      const r = await interpretQuery(phrase);
      if (r.transition?.kind !== "move") continue;
      let n = 0;
      for (const exps of Array.from(byUser.values())) if (matchTransition(exps.map(toMatch), r.transition)) n++;
      if (n >= MIN_CAREER_FACT_COUNT) out.push(phrase);
    }
    return out;
  },
  ["search-transition-examples-v1"],
  { revalidate: 3600 },
);
