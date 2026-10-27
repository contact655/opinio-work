import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { interestCountBand, trendItems } from "@/lib/interest/constants";
import { filterCompaniesWithRespondingStaff } from "@/lib/companies/respondingStaff";

export type InterestWaitingRow = {
  companyId: string;
  name: string;
  slug: string | null;
  isTest: boolean;
  /** 担当者がいない会社を保存している人数（会社と is_test が同じ人だけ） */
  count: number;
  firstAt: string;
  /** ★企業に伝えてよいのはこの2つだけ（人数の幅・業界と職種の大分類で3人以上の項目） */
  band: string | null;
  industries: string[];
  roles: string[];
};

/**
 * ★担当者がまだいない企業を「保存」している人（2026-10-27 / 柴さんの決定）。
 *   ow_bookmarks（target_type = 'company'）を、担当者のいない企業ごとに数える。⚠️ 企業には何も届いていない（名前も渡していない）。
 *   ⚠️ 実在の企業は実在の人だけ、検証用の企業は検証用の人だけを数える。
 * ⚠️★返すのは集計だけ。**名前・ひとことは返さない**（運営が企業に伝えてよいのは人数の幅と大分類の傾向だけ）。
 * ⚠️ 傾向は押した人の「いまの職歴」（無ければ最も新しい職歴）の業界・職種の大分類。3人以上の項目だけ。
 * ⚠️ 取得に失敗したら null（0社と出さない）。
 */
export async function loadInterestWaiting(): Promise<InterestWaitingRow[] | null> {
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("ow_bookmarks")
    .select("user_id, target_id, created_at, ow_users!inner(is_test)")
    .eq("target_type", "company");
  if (error) { console.error("[admin/interestWaiting] bookmarks:", error.message); return null; }
  const saved = (rows ?? []) as unknown as { user_id: string; target_id: string; created_at: string; ow_users: { is_test: boolean } | { is_test: boolean }[] }[];
  if (saved.length === 0) return [];
  const savedIds = Array.from(new Set(saved.map((r) => r.target_id)));
  const responders = await filterCompaniesWithRespondingStaff(savedIds);
  if (!responders) return null;
  const { data: coRows, error: coErr } = await db.from("ow_companies").select("id, is_test").in("id", savedIds.filter((id) => !responders.has(id)));
  if (coErr) { console.error("[admin/interestWaiting] companies:", coErr.message); return null; }
  const waitingTest = new Map(((coRows ?? []) as { id: string; is_test: boolean }[]).map((c) => [c.id, c.is_test === true]));
  const list = saved
    .filter((r) => {
      if (!waitingTest.has(r.target_id)) return false;
      const u = Array.isArray(r.ow_users) ? r.ow_users[0] : r.ow_users;
      return (u?.is_test === true) === waitingTest.get(r.target_id);
    })
    .map((r) => ({ user_id: r.user_id, company_id: r.target_id, created_at: r.created_at }));
  if (list.length === 0) return [];

  const companyIds = Array.from(new Set(list.map((r) => r.company_id)));
  const userIds = Array.from(new Set(list.map((r) => r.user_id)));
  const [comp, exps, roles, inds] = await Promise.all([
    db.from("ow_companies").select("id, name, name_en, slug, is_test").in("id", companyIds),
    db.from("ow_experiences").select("user_id, company_id, role_category_id, is_current, started_at").in("user_id", userIds),
    db.from("ow_roles").select("id, name, parent_id"),
    db.from("ow_industries").select("id, name, parent_id"),
  ]);
  for (const [label, r] of [["companies", comp], ["experiences", exps], ["roles", roles], ["industries", inds]] as const) {
    if (r.error) { console.error(`[admin/interestWaiting] ${label}:`, r.error.message); return null; }
  }

  // 押した人の「いまの職歴」（無ければ最も新しい職歴）
  const latest = new Map<string, { company_id: string | null; role_category_id: string | null }>();
  const sorted = ((exps.data ?? []) as { user_id: string; company_id: string | null; role_category_id: string | null; is_current: boolean | null; started_at: string | null }[])
    .slice().sort((a, b) => Number(!!b.is_current) - Number(!!a.is_current) || String(b.started_at ?? "").localeCompare(String(a.started_at ?? "")));
  for (const e of sorted) if (!latest.has(e.user_id)) latest.set(e.user_id, e);

  const expCompanyIds = Array.from(new Set(Array.from(latest.values()).map((e) => e.company_id).filter((v): v is string => !!v)));
  const { data: expComps, error: ecErr } = expCompanyIds.length
    ? await db.from("ow_companies").select("id, industry_id").in("id", expCompanyIds)
    : { data: [], error: null };
  if (ecErr) { console.error("[admin/interestWaiting] exp companies:", ecErr.message); return null; }
  const industryOfCompany = new Map(((expComps ?? []) as { id: string; industry_id: string | null }[]).map((c) => [c.id, c.industry_id]));

  const topName = (all: { id: string; name: string; parent_id: string | null }[]) => {
    const byId = new Map(all.map((x) => [x.id, x]));
    return (id: string | null | undefined) => {
      let cur = id ? byId.get(id) : undefined;
      while (cur?.parent_id && byId.get(cur.parent_id)) cur = byId.get(cur.parent_id);
      return cur?.name ?? null;
    };
  };
  const roleTop = topName((roles.data ?? []) as { id: string; name: string; parent_id: string | null }[]);
  const indTop = topName((inds.data ?? []) as { id: string; name: string; parent_id: string | null }[]);

  const byCompany = new Map<string, { users: string[]; firstAt: string }>();
  for (const r of list) {
    const g = byCompany.get(r.company_id) ?? { users: [], firstAt: r.created_at };
    g.users.push(r.user_id);
    if (r.created_at < g.firstAt) g.firstAt = r.created_at;
    byCompany.set(r.company_id, g);
  }

  const compById = new Map(((comp.data ?? []) as { id: string; name: string; name_en: string | null; slug: string | null; is_test: boolean }[]).map((c) => [c.id, c]));
  const out: InterestWaitingRow[] = [];
  for (const [companyId, g] of Array.from(byCompany.entries())) {
    const c = compById.get(companyId);
    const indCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};
    for (const u of g.users) {
      const e = latest.get(u);
      const ind = indTop(e?.company_id ? industryOfCompany.get(e.company_id) : null);
      const role = roleTop(e?.role_category_id);
      if (ind) indCounts[ind] = (indCounts[ind] ?? 0) + 1;
      if (role) roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }
    out.push({
      companyId,
      name: c ? companyDisplayName(c.name, c.name_en).displayName : "（企業が見つかりません）",
      slug: c?.slug ?? null,
      isTest: c?.is_test === true,
      count: g.users.length,
      firstAt: g.firstAt,
      band: interestCountBand(g.users.length),
      industries: trendItems(indCounts).map((t) => t.label),
      roles: trendItems(roleCounts).map((t) => t.label),
    });
  }
  // 実在の企業が上、その中は人数の多い順・最初に押された日が古い順
  return out.sort((a, b) => Number(a.isTest) - Number(b.isTest) || b.count - a.count || a.firstAt.localeCompare(b.firstAt));
}
