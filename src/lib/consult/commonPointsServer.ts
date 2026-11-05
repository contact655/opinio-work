/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripLegalSuffix } from "@/lib/companies/displayName";
import { SEARCHABLE_SCHOOL_TYPES } from "@/lib/constants/schools";
import { pickCommonPoints, type CommonPoint, type CommonPointSide } from "@/lib/consult/commonPoints";

/**
 * ★受け取った人（viewer）から見た、送った人たち（others）との共通点（2026-11-05 / キャリア相談）。
 *
 * ⚠️★使うのはプロフィールに出ている情報だけ:
 *    学歴の学校（大学・大学院・高校。学校の一覧から選んだもの）／職歴の会社（会社名を出している職歴）／その会社の業種（大分類）／職歴の職種（大分類）。
 *    年収・生年月日・性別・入社の決め手などの本人だけの回答は読まない（select にも入れない）。
 * ⚠️ 送った人が非公開（visibility = private）なら、その人の情報は使わない（共通点を出さない）。
 * ⚠️ 見せるのは受け取った人にだけ。送った人には返さない（相手の学歴・職歴との突き合わせを送り手に渡さない）。
 * ⚠️ 取得に失敗したら空（共通点は付け足しの情報なので、相談そのものは出す）。ログは出す。
 */
export async function commonPointsFor(viewerId: string, otherIds: readonly string[]): Promise<Map<string, CommonPoint[]>> {
  const out = new Map<string, CommonPoint[]>();
  const others = Array.from(new Set(otherIds)).filter((id) => id && id !== viewerId);
  if (others.length === 0) return out;
  const ids = [viewerId, ...others];
  const db = createAdminClient();

  const [usersRes, eduRes, expRes] = await Promise.all([
    db.from("ow_users").select("id, visibility").in("id", others),
    db.from("ow_user_educations").select("user_id, ow_schools!school_id(id, name, type)").in("user_id", ids).not("school_id", "is", null),
    db.from("ow_experiences")
      .select("user_id, company_id, is_current, visibility_company, role_category_id, ow_companies!company_id(name, industry_id, is_test)")
      .in("user_id", ids),
  ]);
  if (usersRes.error || eduRes.error || expRes.error) {
    console.error("[commonPoints]", usersRes.error?.message ?? eduRes.error?.message ?? expRes.error?.message);
    return out;
  }
  const visible = new Set((usersRes.data ?? []).filter((u) => u.visibility !== "private").map((u) => u.id as string));

  type Exp = { user_id: string; company_id: string | null; is_current: boolean; visibility_company: string | null; role_category_id: string | null; ow_companies: { name: string; industry_id: string | null; is_test: boolean } | null };
  const exps = ((expRes.data ?? []) as unknown as Exp[]).filter((e) => e.visibility_company === "real");

  /* 職種・業種は大分類にそろえる（子どうしで外れないように） */
  const roleIds = Array.from(new Set(exps.map((e) => e.role_category_id).filter((x): x is string => !!x)));
  const industryIds = Array.from(new Set(exps.map((e) => e.ow_companies?.industry_id).filter((x): x is string => !!x)));
  const [rolesRes, indRes] = await Promise.all([
    roleIds.length ? db.from("ow_roles").select("id, name, parent_id").in("id", roleIds) : Promise.resolve({ data: [], error: null }),
    industryIds.length ? db.from("ow_industries").select("id, name, parent_id").in("id", industryIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (rolesRes.error || indRes.error) {
    console.error("[commonPoints] masters:", rolesRes.error?.message ?? indRes.error?.message);
    return out;
  }
  const parents = async (table: "ow_roles" | "ow_industries", rows: { id: string; name: string; parent_id: string | null }[]) => {
    const top = new Map<string, { id: string; name: string }>();
    const need = Array.from(new Set(rows.map((r) => r.parent_id).filter((x): x is string => !!x)));
    const pRes = need.length ? await db.from(table).select("id, name").in("id", need) : { data: [], error: null };
    if (pRes.error) console.error("[commonPoints] parents:", pRes.error.message);
    const pName = new Map(((pRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
    for (const r of rows) {
      if (!r.parent_id) top.set(r.id, { id: r.id, name: r.name });
      else if (pName.has(r.parent_id)) top.set(r.id, { id: r.parent_id, name: pName.get(r.parent_id)! });
    }
    return top;
  };
  const [roleTop, indTop] = await Promise.all([
    parents("ow_roles", (rolesRes.data ?? []) as { id: string; name: string; parent_id: string | null }[]),
    parents("ow_industries", (indRes.data ?? []) as { id: string; name: string; parent_id: string | null }[]),
  ]);

  const side = (userId: string): CommonPointSide => {
    const schools = new Map<string, CommonPointSide["schools"][number]>();
    for (const r of (eduRes.data ?? []) as unknown as { user_id: string; ow_schools: { id: string; name: string; type: string | null } | { id: string; name: string; type: string | null }[] | null }[]) {
      if (r.user_id !== userId) continue;
      const s = Array.isArray(r.ow_schools) ? r.ow_schools[0] : r.ow_schools;
      if (s && (SEARCHABLE_SCHOOL_TYPES as readonly string[]).includes(s.type ?? "")) {
        schools.set(s.id, { id: s.id, name: s.name, type: s.type as CommonPointSide["schools"][number]["type"] });
      }
    }
    const companies = new Map<string, CommonPointSide["companies"][number]>();
    const industries = new Map<string, { id: string; name: string }>();
    const roles = new Map<string, { id: string; name: string }>();
    for (const e of exps) {
      if (e.user_id !== userId) continue;
      if (e.company_id && e.ow_companies && !e.ow_companies.is_test) {
        const prev = companies.get(e.company_id);
        companies.set(e.company_id, { id: e.company_id, name: stripLegalSuffix(e.ow_companies.name) || e.ow_companies.name, isCurrent: (prev?.isCurrent ?? false) || e.is_current });
        const ind = e.ow_companies.industry_id ? indTop.get(e.ow_companies.industry_id) : undefined;
        if (ind) industries.set(ind.id, ind);
      }
      const role = e.role_category_id ? roleTop.get(e.role_category_id) : undefined;
      if (role) roles.set(role.id, role);
    }
    return { schools: Array.from(schools.values()), companies: Array.from(companies.values()), industries: Array.from(industries.values()), roles: Array.from(roles.values()) };
  };

  const me = side(viewerId);
  for (const id of others) {
    if (!visible.has(id)) { out.set(id, []); continue; }
    out.set(id, pickCommonPoints(me, side(id)));
  }
  return out;
}
