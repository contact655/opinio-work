import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows, inChunks } from "@/lib/supabase/paging";
import { AGGREGATE_USER_COLUMNS, isAggregatableUser, type AggregateUser } from "@/lib/aggregate/population";
import { MIN_AGGREGATE_COUNT, MIN_CAREER_FACT_COUNT } from "@/lib/constants/aggregate";
import { DECISIVE_REASON_LABELS, FIT_GOOD_MIN } from "@/lib/careerTurns/constants";
import { computeCompanyFlow, type CompanyFlow, type FlowExperience, type FlowTurn } from "./compute";

/**
 * ★企業ページ「人の流れ」の集計をサーバーで作る（2026-10-27 / 柴さんの決定＝案A）。
 *
 * ⚠️★企業ページに渡すのは compute.ts の CompanyFlow（数と業界・職種の名前だけ）。**個人の行をページに渡さない。**
 *    下限（経歴 3人・回答 5人）の判定もここ（compute.ts）で済ませてから返す。
 * ⚠️ 読むのは admin クライアントだけ（ow_career_turns は誰にも権限が無い・statistics_opt_out は admin でしか読めない）。
 * ⚠️ 母数は isAggregatableUser（検証用・システム・非公開・統計利用の停止・本人が登録していない・seed を外す）。
 * ⚠️ 会社名を出してよい職歴（visibility_company = 'real'）だけを、この会社の在籍として数える。
 *    前後の職歴が real でなければ、その人の前職・行き先は「辿れない」（母数から外す）。古い職歴に飛ばさない。
 */
export async function getCompanyFlow(companyId: string): Promise<CompanyFlow | null> {
  const admin = createAdminClient();

  /* ① この会社に、会社名を出してよい職歴がある人 */
  const hereRes = await fetchAllRows((from, to) => admin.from("ow_experiences")
    .select(`user_id, ow_users!user_id(${AGGREGATE_USER_COLUMNS}, email)`)
    .eq("company_id", companyId).eq("visibility_company", "real")
    .order("id").range(from, to), "companyFlow here");
  if (hereRes.error) { console.error("[companyFlow] here:", hereRes.error); return null; }
  const userIds = Array.from(new Set(((hereRes.data ?? []) as unknown as { user_id: string; ow_users: AggregateUser | null }[])
    .filter((r) => isAggregatableUser(r.ow_users)).map((r) => r.user_id)));
  if (userIds.length === 0) return null;

  /* ② その人たちの全職歴（前職・行き先を辿るため）と、業界・職種のマスタ */
  const [expRes, indRes, roleRes] = await Promise.all([
    inChunks(userIds, (part, from, to) => admin.from("ow_experiences")
      .select("id, user_id, company_id, visibility_company, started_at, ended_at, is_current, role_category_id, ow_companies!company_id(industry_id)")
      .in("user_id", part).order("id").range(from, to), "companyFlow exps"),
    admin.from("ow_industries").select("id, name, parent_id"),
    admin.from("ow_roles").select("id, name"),
  ]);
  if (expRes.error || indRes.error || roleRes.error) {
    console.error("[companyFlow] load:", expRes.error ?? indRes.error?.message ?? roleRes.error?.message);
    return null;
  }
  const industries = new Map(((indRes.data ?? []) as { id: string; name: string; parent_id: string | null }[]).map((i) => [i.id, i]));
  const parentOf = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const i = industries.get(id);
    return i ? (i.parent_id ?? i.id) : null;
  };
  const roleName = new Map(((roleRes.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));

  type Row = { id: string; user_id: string; company_id: string | null; visibility_company: string | null; started_at: string | null; ended_at: string | null; is_current: boolean | null; role_category_id: string | null; ow_companies: { industry_id: string | null } | null };
  const rows = (expRes.data ?? []) as unknown as Row[];
  const experiences: FlowExperience[] = [];
  const hereExpIds: string[] = [];
  for (const r of rows) {
    if (!r.started_at) continue;
    const real = r.visibility_company === "real";
    if (real && r.company_id === companyId) hereExpIds.push(r.id);
    experiences.push({
      userId: r.user_id,
      /* ⚠️ 会社名を伏せた行は「別の、辿れない会社」として残す（前後の判定で古い職歴に飛ばさないため） */
      companyId: real ? r.company_id : `masked:${r.id}`,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      isCurrent: r.is_current === true,
      roleCategoryId: r.role_category_id,
      industryParentId: real ? parentOf(r.ow_companies?.industry_id) : null,
    });
  }

  /* ③ この会社の転機の回答（答えないを除く）。⚠️ 母数の人だけ（user_id で絞る） */
  let turns: FlowTurn[] = [];
  if (hereExpIds.length > 0) {
    const tRes = await inChunks(hereExpIds, (part, from, to) => admin.from("ow_career_turns")
      .select("experience_id, user_id, decisive_reasons, fit_after_year, skipped_at")
      .in("experience_id", part).is("skipped_at", null).order("experience_id").range(from, to), "companyFlow turns");
    if (tRes.error) { console.error("[companyFlow] turns:", tRes.error); return null; }
    const allowed = new Set(userIds);
    turns = ((tRes.data ?? []) as { user_id: string; decisive_reasons: string[] | null; fit_after_year: number | null }[])
      .filter((t) => allowed.has(t.user_id))
      .map((t) => ({ decisiveReasons: t.decisive_reasons ?? [], fitAfterYear: t.fit_after_year }));
  }

  return computeCompanyFlow(companyId, experiences, turns, {
    industry: (id) => industries.get(id)?.name ?? "",
    role: (id) => roleName.get(id) ?? "",
    reason: (k) => DECISIVE_REASON_LABELS[k] ?? k,
  }, { minCareerFact: MIN_CAREER_FACT_COUNT, minAnswer: MIN_AGGREGATE_COUNT, fitGoodMin: FIT_GOOD_MIN });
}

/**
 * ★企業ページ用。300秒（企業ページの revalidate と同じ。CompanyDetailPage.tsx の注記どおり、片方だけ短くしない）。
 * ⚠️ 返す形を変えたらキーの版を上げること（古い形のキャッシュが残ると項目が黙って欠ける）。
 */
export const getCompanyFlowCached = (companyId: string) =>
  unstable_cache(() => getCompanyFlow(companyId), ["company-flow-v1", companyId], { revalidate: 300 })();
