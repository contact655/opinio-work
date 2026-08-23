import type { SupabaseClient } from "@supabase/supabase-js";
import { mutateOne } from "@/lib/supabase/mutate";

type MemberPayload = {
  id: string;
  name: string;
  email: string;
  permission: string;
};

export type AddResult =
  | { ok: true; member: MemberPayload; recovered: boolean }
  | { ok: false; status: number; code: string; message: string };

/**
 * ow_users に存在するユーザーを ow_company_admins に追加する共通ロジック。
 * M-3 (POST /api/biz/members) と M-4 invite (Case 1) の両方から呼ばれる。
 *
 * - 既にアクティブなメンバー → { ok: false, status: 409, code: "DUPLICATE" }
 * - 無効化済みメンバー → is_active=true + permission 更新、recovered: true
 * - 新規 → INSERT、recovered: false
 */
export async function addExistingUserToCompany(params: {
  supabase: SupabaseClient;
  targetUser: { id: string; name: string; email: string };
  companyId: string;
  permission: "admin" | "member";
}): Promise<AddResult> {
  const { supabase, targetUser, companyId, permission } = params;

  const { data: existing } = await supabase
    .from("ow_company_admins")
    .select("id, is_active")
    .eq("user_id", targetUser.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    if (existing.is_active) {
      return { ok: false, status: 409, code: "DUPLICATE", message: "このユーザーはすでにメンバーです" };
    }

    /* ⚠️ **0行更新を成功として扱わない**（CLAUDE.md）。招待の再有効化が
          効いていないのに「招待しました」と出るのを防ぐ。 */
    const res = await mutateOne(
      supabase.from("ow_company_admins").update({ is_active: true, permission }).eq("id", existing.id),
      "members invite 再有効化",
    );
    const error = res.ok ? null : { message: res.error };

    if (error) {
      console.error("[members _lib reactivate]", error.message);
      return { ok: false, status: 500, code: "DB_ERROR", message: "Internal server error" };
    }

    return {
      ok: true,
      member: { id: existing.id, name: targetUser.name, email: targetUser.email, permission },
      recovered: true,
    };
  }

  const { data: newRow, error: insertErr } = await supabase
    .from("ow_company_admins")
    // ⚠️ created_via は「どう作られたか」。招待を経ずに直接追加した行は admin。
    .insert({ user_id: targetUser.id, company_id: companyId, permission, is_active: true, created_via: "admin" })
    .select("id")
    .single();

  if (insertErr || !newRow) {
    console.error("[members _lib insert]", insertErr?.message);
    return { ok: false, status: 500, code: "DB_ERROR", message: "Internal server error" };
  }

  return {
    ok: true,
    member: { id: newRow.id, name: targetUser.name, email: targetUser.email, permission },
    recovered: false,
  };
}
