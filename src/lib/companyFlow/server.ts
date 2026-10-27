import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows, inChunks } from "@/lib/supabase/paging";
import { AGGREGATE_USER_COLUMNS, isAggregatableUser, type AggregateUser } from "@/lib/aggregate/population";
import { MIN_AGGREGATE_COUNT, MIN_CAREER_FACT_COUNT } from "@/lib/constants/aggregate";
import { DECISIVE_REASON_LABELS, FIT_GOOD_MIN } from "@/lib/careerTurns/constants";
import { computeCompanyFlow, computeLeaverSummary, computeSimilarPaths, type CompanyFlow, type FlowExperience, type FlowTurn, type LeaverSummary, type SimilarPaths } from "./compute";

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
  const input = await loadFlowInput(companyId, { withTurns: true });
  if (!input) return null;
  return computeCompanyFlow(companyId, input.experiences, input.turns, {
    industry: input.industryName,
    role: input.roleName,
    reason: (k) => DECISIVE_REASON_LABELS[k] ?? k,
  }, { minCareerFact: MIN_CAREER_FACT_COUNT, minAnswer: MIN_AGGREGATE_COUNT, fitGoodMin: FIT_GOOD_MIN });
}

/**
 * ★検索「〈会社〉を出た人」の動き方の集計（2026-10-27）。**読み込みは「人の流れ」と同じ loadFlowInput**（母数・会社名を伏せた行の扱いが同じ）。
 * ⚠️ 下限は経歴の事実なので MIN_CAREER_FACT_COUNT（3人）
 */
export async function getCompanyLeaverSummary(companyId: string): Promise<LeaverSummary | null> {
  const input = await loadFlowInput(companyId, { withTurns: false });
  if (!input) return null;
  return computeLeaverSummary(companyId, input.experiences, { industry: input.industryName, roleTop: input.roleTopName },
    { minCareerFact: MIN_CAREER_FACT_COUNT });
}

/** ★検索用。300秒（企業ページの「人の流れ」と同じ鮮度）。⚠️ 返す形を変えたらキーの版を上げる */
export const getCompanyLeaverSummaryCached = (companyId: string) =>
  unstable_cache(() => getCompanyLeaverSummary(companyId), ["company-leavers-v1", companyId], { revalidate: 300 })();

type FlowInput = {
  experiences: FlowExperience[];
  turns: FlowTurn[];
  industryName: (id: string) => string;
  roleName: (id: string) => string;
  roleTopName: (id: string) => string;
};

/** ★「人の流れ」と検索の「出た人」が共有する読み込み。母数・会社名を伏せた行の扱いはここ1か所 */
async function loadFlowInput(companyId: string, opts: { withTurns: boolean }): Promise<FlowInput | null> {
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
    admin.from("ow_roles").select("id, name, parent_id"),
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
  const roleRows = (roleRes.data ?? []) as { id: string; name: string; parent_id: string | null }[];
  const roleName = new Map(roleRows.map((r) => [r.id, r.name]));
  const roleParent = new Map(roleRows.map((r) => [r.id, r.parent_id]));
  /* 大分類まで親を辿る（⚠️ 循環に備えて回数で切る） */
  const roleTop = (id: string): string => {
    let cur: string | null | undefined = id;
    for (let i = 0; i < 5 && cur && roleParent.get(cur); i++) cur = roleParent.get(cur);
    return (cur && roleName.get(cur)) ?? "";
  };

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
  if (opts.withTurns && hereExpIds.length > 0) {
    const tRes = await inChunks(hereExpIds, (part, from, to) => admin.from("ow_career_turns")
      .select("experience_id, user_id, decisive_reasons, fit_after_year, skipped_at")
      .in("experience_id", part).is("skipped_at", null).order("experience_id").range(from, to), "companyFlow turns");
    if (tRes.error) { console.error("[companyFlow] turns:", tRes.error); return null; }
    const allowed = new Set(userIds);
    turns = ((tRes.data ?? []) as { user_id: string; decisive_reasons: string[] | null; fit_after_year: number | null }[])
      .filter((t) => allowed.has(t.user_id))
      .map((t) => ({ decisiveReasons: t.decisive_reasons ?? [], fitAfterYear: t.fit_after_year }));
  }

  return {
    experiences,
    turns,
    industryName: (id) => industries.get(id)?.name ?? "",
    roleName: (id) => roleName.get(id) ?? "",
    roleTopName: roleTop,
  };
}

/**
 * ★企業ページ用。300秒（企業ページの revalidate と同じ。CompanyDetailPage.tsx の注記どおり、片方だけ短くしない）。
 * ⚠️ 返す形を変えたらキーの版を上げること（古い形のキャッシュが残ると項目が黙って欠ける）。
 */
export const getCompanyFlowCached = (companyId: string) =>
  unstable_cache(() => getCompanyFlow(companyId), ["company-flow-v1", companyId], { revalidate: 300 })();

/* ── ★ホーム「あなたと似た経歴の人は、こう動いています」（2026-10-27）──────────────────────── */

type Population = {
  experiences: FlowExperience[];
  /** [職歴の id, Q3] */
  fits: [string, number][];
  industries: { id: string; name: string; parent_id: string | null }[];
  roles: { id: string; name: string; parent_id: string | null }[];
};

/**
 * ★集計の母数の全職歴（isAggregatableUser を通した人だけ・会社名を出してよい行だけ業界を持つ）と、転機の Q3。
 * ⚠️ 母数の決め方は loadFlowInput と同じ（会社名を伏せた行は「別の、辿れない会社」）
 * ⚠️ 300秒キャッシュ（「人の流れ」と同じ鮮度）。返すのは配列だけ（unstable_cache は Map を保てない）
 */
const loadPopulationCached = unstable_cache(async (): Promise<Population | null> => {
  const admin = createAdminClient();
  const [userRes, expRes, indRes, roleRes] = await Promise.all([
    fetchAllRows((f, t) => admin.from("ow_users").select(`id, email, ${AGGREGATE_USER_COLUMNS}`).order("id").range(f, t), "population users"),
    fetchAllRows((f, t) => admin.from("ow_experiences")
      .select("id, user_id, company_id, visibility_company, started_at, ended_at, is_current, role_category_id, ow_companies!company_id(industry_id)")
      .order("id").range(f, t), "population exps"),
    admin.from("ow_industries").select("id, name, parent_id"),
    admin.from("ow_roles").select("id, name, parent_id"),
  ]);
  if (userRes.error || expRes.error || indRes.error || roleRes.error) {
    console.error("[companyFlow] population:", userRes.error ?? expRes.error ?? indRes.error?.message ?? roleRes.error?.message);
    return null;
  }
  const allowed = new Set(((userRes.data ?? []) as unknown as (AggregateUser & { id: string })[]).filter((u) => isAggregatableUser(u)).map((u) => u.id));
  const industries = (indRes.data ?? []) as Population["industries"];
  const roles = (roleRes.data ?? []) as Population["roles"];
  const indById = new Map(industries.map((i) => [i.id, i]));
  const roleParent = new Map(roles.map((r) => [r.id, r.parent_id]));
  type Row = { id: string; user_id: string; company_id: string | null; visibility_company: string | null; started_at: string | null; ended_at: string | null; is_current: boolean | null; role_category_id: string | null; ow_companies: { industry_id: string | null } | null };
  const experiences: FlowExperience[] = [];
  for (const r of (expRes.data ?? []) as unknown as Row[]) {
    if (!allowed.has(r.user_id) || !r.started_at) continue;
    const real = r.visibility_company === "real";
    const ind = real && r.ow_companies?.industry_id ? indById.get(r.ow_companies.industry_id) : undefined;
    experiences.push({
      id: r.id,
      userId: r.user_id,
      companyId: real ? r.company_id : `masked:${r.id}`,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      isCurrent: r.is_current === true,
      roleCategoryId: r.role_category_id,
      roleTopId: r.role_category_id ? (roleParent.get(r.role_category_id) ?? r.role_category_id) : null,
      industryParentId: ind ? (ind.parent_id ?? ind.id) : null,
    });
  }
  const expIds = experiences.map((e) => e.id as string);
  const fits: [string, number][] = [];
  if (expIds.length > 0) {
    const tRes = await inChunks(expIds, (part, from, to) => admin.from("ow_career_turns")
      .select("experience_id, user_id, fit_after_year, skipped_at")
      .in("experience_id", part).is("skipped_at", null).not("fit_after_year", "is", null).order("experience_id").range(from, to), "population turns");
    if (tRes.error) { console.error("[companyFlow] population turns:", tRes.error); return null; }
    for (const t of (tRes.data ?? []) as { experience_id: string; user_id: string; fit_after_year: number }[]) {
      if (allowed.has(t.user_id)) fits.push([t.experience_id, t.fit_after_year]);
    }
  }
  return { experiences, fits, industries, roles };
}, ["company-flow-population-v1"], { revalidate: 300 });

export type SimilarPathsResult = {
  /** 本人の直近の職歴の「職種の大分類 × 業界の大分類」（見出しの説明に使う）。決められなければ null */
  key: { roleLabel: string; industryLabel: string } | null;
  summary: SimilarPaths | null;
};

/**
 * ★本人の直近の職歴（現職があれば現職、無ければいちばん新しく始まった職歴）から「似た経歴」を決めて集計する。
 * ⚠️ 本人の職歴は本人のものなので、会社名を伏せていても業界を使う（本人にだけ出す画面）
 * ⚠️ 職種か業界が決まらなければ key も summary も null（ホームに箱を出さない）
 */
export async function getSimilarPaths(viewerOwUserId: string): Promise<SimilarPathsResult> {
  const admin = createAdminClient();
  const [pop, mine] = await Promise.all([
    loadPopulationCached(),
    admin.from("ow_experiences")
      .select("started_at, is_current, role_category_id, ow_companies!company_id(industry_id)")
      .eq("user_id", viewerOwUserId),
  ]);
  if (mine.error) console.error("[companyFlow] similar mine:", mine.error.message);
  if (!pop || mine.error) return { key: null, summary: null };
  type Mine = { started_at: string | null; is_current: boolean | null; role_category_id: string | null; ow_companies: { industry_id: string | null } | null };
  const latest = ((mine.data ?? []) as unknown as Mine[])
    .filter((e) => e.started_at)
    .sort((a, b) => Number(b.is_current === true) - Number(a.is_current === true) || (b.started_at as string).localeCompare(a.started_at as string))[0];
  if (!latest) return { key: null, summary: null };
  const indById = new Map(pop.industries.map((i) => [i.id, i]));
  const roleById = new Map(pop.roles.map((r) => [r.id, r]));
  const ind = latest.ow_companies?.industry_id ? indById.get(latest.ow_companies.industry_id) : undefined;
  const role = latest.role_category_id ? roleById.get(latest.role_category_id) : undefined;
  const indTop = ind ? indById.get(ind.parent_id ?? ind.id) : undefined;
  const roleTop = role ? roleById.get(role.parent_id ?? role.id) : undefined;
  if (!indTop || !roleTop) return { key: null, summary: null };
  const summary = computeSimilarPaths(viewerOwUserId, { roleTopId: roleTop.id, industryParentId: indTop.id }, pop.experiences, new Map(pop.fits), {
    industry: (id) => indById.get(id)?.name ?? "",
    roleTop: (id) => { const r = roleById.get(id); return (r && roleById.get(r.parent_id ?? r.id)?.name) ?? ""; },
  }, { minCareerFact: MIN_CAREER_FACT_COUNT, minAnswer: MIN_AGGREGATE_COUNT, fitGoodMin: FIT_GOOD_MIN });
  return { key: { roleLabel: roleTop.name, industryLabel: indTop.name }, summary };
}
