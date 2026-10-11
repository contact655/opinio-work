/* ★サーバー専用（admin クライアント） */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★求人に付ける部門が、その会社の部門か確かめる（2026-10-12）。
 *   それまで POST / PUT /api/biz/jobs は**形（uuid）しか見ておらず**、他社の部門の id を付けられた
 *   （実際に Third Box の検証用求人に エージェントの「人材紹介事業部」が付いていて、Third Box の求人管理に他社の部門名が出ていた）。
 * ⚠️ 空・未指定は null（部門なし）。削除した部門・他社の部門・存在しない id は ok:false（400 にする。黙って null にしない）。
 */
export async function resolveOwnDepartmentId(companyId: string, raw: unknown): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, id: null };
  if (typeof raw !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return { ok: false, error: "部門の指定が正しくありません" };
  }
  const { data, error } = await createAdminClient().from("ow_company_departments")
    .select("id").eq("id", raw).eq("company_id", companyId).is("deleted_at", null).maybeSingle();
  if (error) { console.error("[jobDepartment]", error.message); return { ok: false, error: "部門を確認できませんでした。時間をおいて再度お試しください。" }; }
  if (!data) return { ok: false, error: "選んだ部門が見つかりません。部門・職種の設定を確認してください。" };
  return { ok: true, id: data.id as string };
}
