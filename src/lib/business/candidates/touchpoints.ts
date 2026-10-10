/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleTree } from "@/lib/supabase/queries";
import type { RoleTree } from "@/lib/roles/jobRoles";
import { companyKey } from "@/lib/evidence/transitions";
import { buildIndustryTree, expandIndustryWithAncestors, type IndustryNode } from "@/lib/companies/industryTree";
import { extractPrefecture, PREFECTURES } from "@/lib/utils/location";
import { isRegisteredUser } from "@/lib/users/registered";
import type { Touchpoint, TouchpointMaterials } from "@/lib/business/candidates/model";
import { fitText, type FitFact } from "@/lib/evidence/fit";
export type { TouchpointMaterials };

/**
 * ★貴社との接点（2026-10-10 / 候補者探し 段1）。**接点はこの関数だけが作る。**
 *
 * 種類（強い順の重み）:
 *   ① job_role（5）       自社の公開中の求人の職種 × 候補者の経験職種（＋年数）
 *   ② company_role（4）   自社が登録した職種（職種マスタに紐づくもの・部門つき）× 経験職種／関心のある職種
 *   ⑤ alumni（3）         自社の現役社員（企業ページの「現役社員」の範囲）の前職 × 候補者の勤務先
 *   ④a target_industry（3）自社の「顧客の業界」× 候補者の職歴の業種（祖先まで展開）
 *   ④b business_domain（2）自社の事業領域 × 候補者の前の勤務先の事業領域
 *   ③ location（1）       自社の求人の勤務地 × 候補者の居住地
 *
 * ⚠️★使ってはいけない材料（柴さんの指示）: 声かけを受け取る範囲・受け取らない企業／転職意欲／
 *    候補者が伏せた項目（`visibility_company` が real でない職歴の会社）／is_test が一致しない人や企業。
 *    ⚠️ ここではそれらを**読みもしない**（select に入れない）。
 * ⚠️ 職種の突き合わせは「同じ」か「親子」（両方向）。兄弟は合わない。声かけの範囲の判定
 *    （`approach_company_matches_field`）と同じ規則。
 * ⚠️ 会社の同一性は提案と同じ `companyKey`（company_id、無ければ正規化した社名）。
 * ⚠️ 業種は「業界の経験が活きる会社」と同じ規則（本人側だけ祖先へ展開し、企業側は展開しない）。
 * ⚠️ 取得に失敗したら null（画面は接点の欄・印を出さない。0件と言わない）。
 */

export type TouchpointCandidateInput = {
  owUserId: string;
  isTest: boolean;
  location: string | null;
  /** 関心のある職種（本人が選んだもの・展開前） */
  desiredRoleIds: string[];
};


export type TouchpointResult = {
  byCandidate: Map<string, Touchpoint[]>;
  materials: TouchpointMaterials;
};

const WEIGHT = { job_role: 5, company_role: 4, alumni: 3, target_industry: 3, business_domain: 2, location: 1 } as const;

/** 職種が「同じ」か「親子」（両方向）。兄弟は合わない */
export function rolesRelated(tree: RoleTree, a: string, b: string): boolean {
  if (a === b) return true;
  return tree.byId.get(a)?.parentId === b || tree.byId.get(b)?.parentId === a;
}

function monthsBetween(start: string | null, end: string | null, now: Date): number {
  if (!start) return 0;
  const s = new Date(start), e = end ? new Date(end) : now;
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return 0;
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

/** 提案と同じ会社の同一性キー（`companyKey`）。⚠️ 規則を書き写さない */
function keyOf(e: Exp): string {
  return companyKey({ id: e.id, user_id: e.user_id, company_id: e.company_id, company_text: e.company_text,
    role_category_id: e.role_category_id, started_at: e.started_at ?? "", ended_at: e.ended_at, is_current: e.is_current });
}

function prefOf(loc: string | null): string | null {
  const p = extractPrefecture(loc);
  return p && (PREFECTURES as readonly string[]).includes(p) ? p : null;
}

type Exp = {
  id: string; user_id: string; company_id: string | null; company_text: string | null;
  role_category_id: string | null; started_at: string | null; ended_at: string | null;
  is_current: boolean; visibility_company: string | null;
  companyName: string | null;
};

export async function getCompanyCandidateTouchpoints(
  companyId: string,
  companyIsTest: boolean,
  candidates: TouchpointCandidateInput[],
  now: Date = new Date(),
): Promise<TouchpointResult | null> {
  const db = createAdminClient();
  const ids = Array.from(new Set(candidates.map((c) => c.owUserId)));

  // ── 自社の材料（企業ごとに1回）───────────────────────────────────────────
  const [jobsR, rolesR, linksR, deptR, targetR, domainR, empExpR, hiddenR, tree] = await Promise.all([
    /* ⚠️ 自社の求人だけ。is_test は自社と同じもの（実在の企業には実在の求人だけ） */
    /* ⚠️ 公開日の新しい順（同じ年数の求人が2件当たったとき、提案が選ぶ求人を決まった1件にするため） */
    db.from("ow_jobs").select("id, title, location, published_at, ow_job_roles(role_id)")
      .eq("company_id", companyId).eq("status", "published").eq("is_test", companyIsTest)
      .order("published_at", { ascending: false, nullsFirst: false }).order("id", { ascending: true }),
    db.from("ow_company_job_roles").select("id, name, standard_role_id")
      .eq("company_id", companyId).is("deleted_at", null).not("standard_role_id", "is", null),
    db.from("ow_company_job_role_departments").select("job_role_id, department_id").eq("company_id", companyId),
    db.from("ow_company_departments").select("id, name").eq("company_id", companyId).is("deleted_at", null),
    db.from("ow_company_target_industries").select("industry_id").eq("company_id", companyId),
    db.from("ow_company_business_domains").select("domain_id").eq("company_id", companyId),
    /* 自社の現役社員（企業ページの「現役社員」と同じ範囲: is_current・社名を伏せていない） */
    db.from("ow_experiences").select("id, user_id")
      .eq("company_id", companyId).eq("is_current", true).neq("visibility_company", "hidden"),
    db.from("ow_company_hidden_experiences").select("experience_id").eq("company_id", companyId),
    getRoleTree(),
  ]);
  for (const r of [jobsR, rolesR, linksR, deptR, targetR, domainR, empExpR, hiddenR]) {
    if (r.error) { console.error("[touchpoints] 自社の材料:", r.error.message); return null; }
  }
  const jobs = (jobsR.data ?? []).map((j) => ({
    id: j.id as string, title: (j.title as string) ?? "",
    pref: prefOf(j.location as string | null),
    roleIds: ((j.ow_job_roles as { role_id: string }[] | null) ?? []).map((x) => x.role_id),
  }));
  const deptName = new Map((deptR.data ?? []).map((d) => [d.id as string, d.name as string]));
  const deptsByRole = new Map<string, string[]>();
  for (const l of linksR.data ?? []) {
    const n = deptName.get(l.department_id as string);
    if (!n) continue;
    const arr = deptsByRole.get(l.job_role_id as string) ?? [];
    arr.push(n);
    deptsByRole.set(l.job_role_id as string, arr);
  }
  const companyRoles = (rolesR.data ?? []).map((r) => ({
    id: r.id as string, name: r.name as string, standardRoleId: r.standard_role_id as string,
    departments: deptsByRole.get(r.id as string) ?? [],
  }));
  const targetIndustryIds = new Set((targetR.data ?? []).map((r) => r.industry_id as string));
  const domainIds = new Set((domainR.data ?? []).map((r) => r.domain_id as string));

  /* 現役社員の人の条件（企業ページと同じ: 本人が登録済み・非公開でない）。⚠️ is_test は候補者ごとに突き合わせる */
  const hidden = new Set((hiddenR.data ?? []).map((h) => h.experience_id as string));
  const empExps = (empExpR.data ?? []).filter((e) => !hidden.has(e.id as string));
  const empIds = Array.from(new Set(empExps.map((e) => e.user_id as string)));

  // ── 候補者と社員の職歴（まとめて）─────────────────────────────────────────
  const allUserIds = Array.from(new Set([...ids, ...empIds]));
  const [expR, empUsersR] = await Promise.all([
    allUserIds.length
      ? db.from("ow_experiences")
          .select("id, user_id, company_id, company_text, role_category_id, started_at, ended_at, is_current, visibility_company, ow_companies!company_id(name, industry_id)")
          .in("user_id", allUserIds)
      : Promise.resolve({ data: [], error: null }),
    empIds.length
      ? db.from("ow_users").select("id, auth_id, is_test, is_system, visibility").in("id", empIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (expR.error || empUsersR.error) {
    console.error("[touchpoints] 職歴:", expR.error?.message ?? empUsersR.error?.message);
    return null;
  }
  const industryOfCompany = new Map<string, string | null>();
  const expsByUser = new Map<string, Exp[]>();
  for (const e of (expR.data ?? []) as Record<string, unknown>[]) {
    const co = e.ow_companies as { name: string | null; industry_id: string | null } | null;
    if (e.company_id) industryOfCompany.set(e.company_id as string, co?.industry_id ?? null);
    const row: Exp = {
      id: e.id as string, user_id: e.user_id as string,
      company_id: (e.company_id as string | null) ?? null, company_text: (e.company_text as string | null) ?? null,
      role_category_id: (e.role_category_id as string | null) ?? null,
      started_at: (e.started_at as string | null) ?? null, ended_at: (e.ended_at as string | null) ?? null,
      is_current: e.is_current === true, visibility_company: (e.visibility_company as string | null) ?? "real",
      companyName: (co?.name ?? (e.company_text as string | null) ?? "").trim() || null,
    };
    const arr = expsByUser.get(row.user_id) ?? [];
    arr.push(row);
    expsByUser.set(row.user_id, arr);
  }

  /* 社員: 本人が登録済み・非公開でない・運営アカウントでない。社員ごとの is_test と「前職」（自社以外・社名を出している職歴） */
  const empUsers = new Map<string, boolean>();
  for (const u of empUsersR.data ?? []) {
    if (!isRegisteredUser(u as { auth_id: string | null })) continue;
    if (u.visibility === "private" || u.is_system === true) continue;
    empUsers.set(u.id as string, u.is_test === true);
  }
  /** 前職の会社キー → 社員（is_test 別）の人数。⚠️ 社員の名前は持たない */
  const alumniByKey = new Map<string, { test: Set<string>; real: Set<string> }>();
  empUsers.forEach((isTest, uid) => {
    const keys = new Set<string>();
    for (const e of expsByUser.get(uid) ?? []) {
      if (e.company_id === companyId || e.visibility_company !== "real") continue;
      keys.add(keyOf(e));
    }
    keys.forEach((k) => {
      const b = alumniByKey.get(k) ?? { test: new Set<string>(), real: new Set<string>() };
      (isTest ? b.test : b.real).add(uid);
      alumniByKey.set(k, b);
    });
  });

  // ── 業種の木と、前の勤務先の事業領域（④）────────────────────────────────────
  const needIndustry = targetIndustryIds.size > 0;
  const needDomain = domainIds.size > 0;
  const candCompanyIds = new Set<string>();
  for (const id of ids) for (const e of expsByUser.get(id) ?? []) {
    if (e.company_id && e.company_id !== companyId && e.visibility_company === "real") candCompanyIds.add(e.company_id);
  }
  const [indR, domR, domNameR] = await Promise.all([
    needIndustry ? db.from("ow_industries").select("id, name, slug, parent_id, display_order, description").eq("is_active", true) : Promise.resolve({ data: [], error: null }),
    needDomain && candCompanyIds.size ? db.from("ow_company_business_domains").select("company_id, domain_id").in("company_id", Array.from(candCompanyIds)) : Promise.resolve({ data: [], error: null }),
    needDomain ? db.from("ow_business_domains").select("id, name").in("id", Array.from(domainIds)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (indR.error || domR.error || domNameR.error) {
    console.error("[touchpoints] 業種・事業領域:", indR.error?.message ?? domR.error?.message ?? domNameR.error?.message);
    return null;
  }
  const industryTree = buildIndustryTree((indR.data ?? []).map((r): IndustryNode => ({
    id: r.id as string, name: r.name as string, slug: r.slug as string,
    parentId: (r.parent_id as string | null) ?? null, displayOrder: (r.display_order as number | null) ?? 0,
    description: (r.description as string | null) ?? null,
  })));
  const domainsOfCompany = new Map<string, Set<string>>();
  for (const r of domR.data ?? []) {
    const s = domainsOfCompany.get(r.company_id as string) ?? new Set<string>();
    s.add(r.domain_id as string);
    domainsOfCompany.set(r.company_id as string, s);
  }
  const domainName = new Map((domNameR.data ?? []).map((d) => [d.id as string, d.name as string]));

  // ── 候補者ごと ─────────────────────────────────────────────────────────────
  const byCandidate = new Map<string, Touchpoint[]>();
  for (const c of candidates) {
    const exps = expsByUser.get(c.owUserId) ?? [];
    const out: Touchpoint[] = [];
    /* 経験職種と月数（職種は社名を伏せた職歴のものも使う ——「できること」と同じで、職種は伏せる対象ではない） */
    const monthsByRole = new Map<string, number>();
    for (const e of exps) {
      if (!e.role_category_id) continue;
      monthsByRole.set(e.role_category_id, (monthsByRole.get(e.role_category_id) ?? 0) + monthsBetween(e.started_at, e.ended_at, now));
    }
    const expRoleIds = Array.from(monthsByRole.keys());

    // ① 求人の職種
    for (const j of jobs) {
      const hit = expRoleIds.filter((r) => j.roleIds.some((jr) => rolesRelated(tree, r, jr)));
      if (hit.length === 0) continue;
      const months = Math.max(...hit.map((r) => monthsByRole.get(r) ?? 0));
      const fact: FitFact = { kind: "job_role", jobId: j.id, jobTitle: j.title, months };
      out.push({ kind: "job_role", weight: WEIGHT.job_role, ref: { type: "job", id: j.id }, fact, text: fitText(fact, "company") });
    }
    // ② 自社が登録した職種（部門）
    for (const r of companyRoles) {
      const byExp = expRoleIds.some((x) => rolesRelated(tree, x, r.standardRoleId));
      const byDesired = c.desiredRoleIds.some((x) => rolesRelated(tree, x, r.standardRoleId));
      if (!byExp && !byDesired) continue;
      const fact: FitFact = { kind: "company_role", companyJobRoleId: r.id, roleName: r.name, departments: r.departments, byExperience: byExp, byDesired };
      out.push({ kind: "company_role", weight: WEIGHT.company_role, ref: { type: "company_job_role", id: r.id }, fact, text: fitText(fact, "company") });
    }
    // ⑤ 社員とのつながり（社名を出している職歴だけ。is_test が候補者と一致する社員だけ数える）
    const seenKeys = new Set<string>();
    for (const e of exps) {
      if (e.company_id === companyId || e.visibility_company !== "real" || !e.companyName) continue;
      const k = keyOf(e);
      if (k.startsWith("anon:") || seenKeys.has(k)) continue;
      seenKeys.add(k);
      const b = alumniByKey.get(k);
      const people = b ? (c.isTest ? b.test : b.real) : undefined;
      const n = people ? Array.from(people).filter((uid) => uid !== c.owUserId).length : 0;
      if (n === 0) continue;
      out.push({ kind: "alumni", weight: WEIGHT.alumni, ref: e.company_id ? { type: "company", id: e.company_id } : null,
        text: `${e.companyName}の出身者が、貴社に${n}名在籍しています` });
    }
    // ④a 顧客の業界 × 職歴の業種（本人側だけ祖先へ展開）
    if (needIndustry) {
      const own = new Set<string>();
      for (const e of exps) {
        if (!e.company_id || e.company_id === companyId || e.visibility_company !== "real") continue;
        const ind = industryOfCompany.get(e.company_id);
        if (ind) own.add(ind);
      }
      for (const id of expandIndustryWithAncestors(industryTree, Array.from(own))) {
        if (!targetIndustryIds.has(id)) continue;
        const name = industryTree.byId.get(id)?.name;
        if (!name) continue; // ⚠️ 名前が引けない業種は出さない（「—」で埋めない）
        const fact: FitFact = { kind: "target_industry", industryId: id, industryName: name };
        out.push({ kind: "target_industry", weight: WEIGHT.target_industry, ref: { type: "industry", id }, fact, text: fitText(fact, "company") });
      }
    }
    // ④b 事業領域 × 前の勤務先の事業領域（自社以外・社名を出している職歴）
    if (needDomain) {
      const hit = new Set<string>();
      for (const e of exps) {
        if (!e.company_id || e.company_id === companyId || e.visibility_company !== "real") continue;
        domainsOfCompany.get(e.company_id)?.forEach((d) => { if (domainIds.has(d)) hit.add(d); });
      }
      const ids = Array.from(hit).filter((d) => domainName.has(d));
      if (ids.length) {
        const fact: FitFact = { kind: "business_domain", domainIds: ids, domainNames: ids.map((d) => domainName.get(d) as string) };
        out.push({ kind: "business_domain", weight: WEIGHT.business_domain, ref: { type: "business_domain", id: ids[0] }, fact, text: fitText(fact, "company") });
      }
    }
    // ③ 勤務地（同じ都道府県は1件にまとめる）
    const pref = prefOf(c.location);
    if (pref) {
      const j = jobs.find((x) => x.pref === pref);
      if (j) out.push({ kind: "location", weight: WEIGHT.location, ref: { type: "job", id: j.id },
        text: `求人の勤務地（${pref}）とお住まいが合っています` });
    }
    out.sort((a, b) => b.weight - a.weight);
    byCandidate.set(c.owUserId, out);
  }

  return {
    byCandidate,
    materials: {
      hasJobs: jobs.length > 0,
      hasCompanyRoles: companyRoles.length > 0,
      hasPublicEmployees: empUsers.size > 0,
    },
  };
}
