import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterVisibleCompaniesStrict } from "@/lib/companies/visibility";
import { getRoleTree } from "@/lib/supabase/queries";
import { resolveExperienceCompanyLabel, EXPERIENCE_COMPANY_COLS } from "@/lib/experiences/companyName";
import { MIN_AGGREGATE_COUNT } from "@/lib/constants/aggregate";
import type { Destinations } from "./runSearch";

/**
 * ★「〈会社・学校〉を出た人の、いま」の中身（2026-10-21）。**検索結果と学校のページが同じ関数を使う。**
 *   渡した人たちの**いまの**職歴（現職・会社名を出してよいもの＝visibility_company 'real'）から、会社と職種を数える。
 * ⚠️ 1人は会社ごと・職種ごとに1回だけ数える。人数は MIN_AGGREGATE_COUNT（3）以上のときだけ出す
 * ⚠️ 会社のリンク・フォローは会社ページが開ける会社だけ（filterVisibleCompaniesStrict）
 * ⚠️ 呼ぶ側が「誰を渡すか」（離れた人・卒業生だけ）と「ログイン中か」を決める。ここでは絞らない
 */
export async function destinationsForUsers(userIds: string[]): Promise<Destinations | undefined> {
  if (userIds.length === 0) return undefined;
  const db = createAdminClient();
  const [tree, expRes] = await Promise.all([
    getRoleTree(),
    db.from("ow_experiences")
      .select(`user_id, is_current, role_category_id, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
      .in("user_id", userIds).eq("is_current", true).eq("visibility_company", "real"),
  ]);
  if (expRes.error) console.error("[destinations] ow_experiences:", expRes.error.message);
  type Row = { user_id: string; company_id: string | null; role_category_id: string | null } & Parameters<typeof resolveExperienceCompanyLabel>[0];
  const rows = (expRes.data ?? []) as unknown as Row[];

  const companies = new Map<string, Set<string>>();
  const companyIds = new Map<string, string>();
  const roles = new Map<string, Set<string>>();
  for (const e of rows) {
    const label = resolveExperienceCompanyLabel(e);
    if (label) {
      companies.set(label, (companies.get(label) ?? new Set<string>()).add(e.user_id));
      if (e.company_id && !companyIds.has(label)) companyIds.set(label, e.company_id);
    }
    const role = e.role_category_id ? tree.byId.get(e.role_category_id)?.name : null;
    if (role) roles.set(role, (roles.get(role) ?? new Set<string>()).add(e.user_id));
  }
  if (companies.size === 0 && roles.size === 0) return undefined;

  const toList = (m: Map<string, Set<string>>) =>
    Array.from(m.entries())
      .map(([label, s]) => [label, s.size] as const)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([label, n]) => ({ label, count: n >= MIN_AGGREGATE_COUNT ? n : null }));

  const ids = Array.from(new Set(companyIds.values()));
  const logos = new Map<string, { logo_url: string | null; logo_letter: string | null; logo_gradient: string | null }>();
  const hrefs = new Map<string, string>();
  const domains = new Map<string, string>();
  if (ids.length > 0) {
    const [logoRes, visRes, domRes] = await Promise.all([
      db.from("ow_companies").select("id, logo_url, logo_letter, logo_gradient").in("id", ids),
      /* ⚠️ 404 になる会社（非公開・検証用）にはリンクを付けない */
      filterVisibleCompaniesStrict(db.from("ow_companies").select("id, slug").in("id", ids)),
      db.from("ow_company_business_domains").select("company_id, ow_business_domains(name, is_active)").eq("is_primary", true).in("company_id", ids),
    ]);
    if (logoRes.error) console.error("[destinations] logos:", logoRes.error.message);
    if (visRes.error) console.error("[destinations] links:", visRes.error.message);
    if (domRes.error) console.error("[destinations] domains:", domRes.error.message);
    for (const r of (logoRes.data ?? []) as { id: string; logo_url: string | null; logo_letter: string | null; logo_gradient: string | null }[]) logos.set(r.id, r);
    for (const r of (visRes.data ?? []) as { id: string; slug: string | null }[]) hrefs.set(r.id, `/companies/${r.slug ?? r.id}`);
    for (const r of (domRes.data ?? []) as unknown as { company_id: string; ow_business_domains: { name: string; is_active: boolean } | { name: string; is_active: boolean }[] | null }[]) {
      const d = Array.isArray(r.ow_business_domains) ? r.ow_business_domains[0] : r.ow_business_domains;
      if (d?.is_active) domains.set(r.company_id, d.name);
    }
  }
  return {
    companies: toList(companies).map((c) => {
      const id = companyIds.get(c.label);
      const lg = id ? logos.get(id) : undefined;
      return {
        ...c,
        logoUrl: lg?.logo_url ?? null, logoLetter: lg?.logo_letter ?? null, logoGradient: lg?.logo_gradient ?? null,
        href: id ? hrefs.get(id) ?? null : null,
        /* ⚠️ id はページが開ける会社だけ渡す（開けない会社をフォローさせない） */
        id: id && hrefs.has(id) ? id : null,
        domain: id ? domains.get(id) ?? null : null,
      };
    }),
    roles: toList(roles),
  };
}
