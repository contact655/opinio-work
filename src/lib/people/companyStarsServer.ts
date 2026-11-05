import { createAdminClient } from "@/lib/supabase/admin";
import { countStarringCompanies, type StarCompany, type StarStaff } from "./companyStars";

/**
 * ★本人を ☆「気になる」にしている会社の数（2026-11-06）。数え方は companyStars.ts。
 * ⚠️ `ow_candidate_stars` は本人に読ませていない（RLS: その会社の担当者だけ）。admin クライアントで読み、
 *    `.eq("candidate_user_id", 本人)` を外さないこと。返すのは数だけ。
 * ⚠️ 取得に失敗したら null（0 に倒すと「どこからも気にされていない」と嘘になる）。
 */
export async function getStarringCompanyCount(owUserId: string, viewerIsTest: boolean): Promise<number | null> {
  const db = createAdminClient();
  const { data: stars, error } = await db.from("ow_candidate_stars").select("company_id").eq("candidate_user_id", owUserId);
  if (error) {
    console.error("[companyStars] stars:", error.message);
    return null;
  }
  const ids = Array.from(new Set((stars ?? []).map((s) => s.company_id as string)));
  if (ids.length === 0) return 0;
  const [cRes, sRes] = await Promise.all([
    db.from("ow_companies").select("id, is_test, suspended_at").in("id", ids),
    db.from("ow_company_admins").select("company_id, permission, is_active").in("company_id", ids),
  ]);
  if (cRes.error || sRes.error) {
    console.error("[companyStars] companies/admins:", cRes.error?.message ?? sRes.error?.message);
    return null;
  }
  return countStarringCompanies(
    stars as { company_id: string }[],
    (cRes.data ?? []) as StarCompany[],
    (sRes.data ?? []) as StarStaff[],
    viewerIsTest,
  );
}
