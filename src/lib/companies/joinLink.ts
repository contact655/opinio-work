import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";

/**
 * ★会社ごとの招待リンク（/join/<slug>。2026-10-12 / 柴さんの指示）。
 *   リンクを開くとクッキーに会社を覚え、オンボーディングの「お勤め先」（既にアカウントがある人は職歴の追加）に
 *   その会社を入れた状態で始める。**保存は本人がする（自動では保存しない）。**
 * ⚠️ 検証用と実アカウントの区別は今のまま: 会社と利用者の is_test が一致するときだけ入れる。
 * ⚠️ 登録した人の記録（ow_company_invite_signups）は運営画面の件数だけ。企業には出さない。
 */
export const JOIN_COOKIE = "opinio_join_company";
export const JOIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function joinPath(company: { slug: string | null; id: string }): string {
  return `/join/${encodeURIComponent(company.slug ?? company.id)}`;
}

/** slug か id から会社を引く（存在しない・ページ非公開でも、会社の行があればよい） */
export async function findJoinCompany(slugOrId: string): Promise<{ id: string } | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const { data, error } = await createAdminClient().from("ow_companies").select("id")
    .eq(isUUID ? "id" : "slug", slugOrId).limit(1);
  if (error) { console.error("[joinLink] find:", error.message); return null; }
  return data?.[0] ? { id: data[0].id as string } : null;
}

/**
 * クッキーの会社を、この利用者の「お勤め先」に入れてよい形で返す。is_test が合わなければ null。
 * 形は `CompanyLookupResult`（id / name / isListed）に合わせる（CompanyPicker がそのまま受け取れる）。
 */
export async function resolveJoinCompany(companyId: string | undefined | null, viewerIsTest: boolean): Promise<{ id: string; name: string; isListed: boolean } | null> {
  if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) return null;
  const { data: c, error } = await createAdminClient().from("ow_companies")
    .select("id, name, name_en, is_test, listing_status").eq("id", companyId).maybeSingle();
  if (error) { console.error("[joinLink] resolve:", error.message); return null; }
  if (!c || (c.is_test === true) !== viewerIsTest) return null;
  return { id: c.id as string, name: companyDisplayName(c.name as string, c.name_en as string | null).displayName, isListed: c.listing_status === "listed" };
}

/** 招待リンクから登録した人を記録する（1人1社1行・何度呼んでも増えない）。失敗しても画面は止めない */
export async function recordJoinSignup(companyId: string, owUserId: string): Promise<void> {
  const { error } = await createAdminClient().from("ow_company_invite_signups")
    .upsert({ company_id: companyId, ow_user_id: owUserId }, { onConflict: "company_id,ow_user_id", ignoreDuplicates: true });
  if (error) console.error("[joinLink] record:", error.message);
}

/** 運営画面用: 会社 id → 招待から登録した人数 */
export async function countJoinSignups(): Promise<Map<string, number> | null> {
  const { data, error } = await createAdminClient().from("ow_company_invite_signups").select("company_id");
  if (error) { console.error("[joinLink] count:", error.message); return null; }
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(r.company_id as string, (m.get(r.company_id as string) ?? 0) + 1);
  return m;
}
