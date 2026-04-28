import type { SupabaseClient } from "@supabase/supabase-js";

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

    const { error } = await supabase
      .from("ow_company_admins")
      .update({ is_active: true, permission })
      .eq("id", existing.id);

    if (error) {
      console.error("[members _lib reactivate]", error.message);
      return { ok: false, status: 500, code: "DB_ERROR", message: error.message };
    }

    return {
      ok: true,
      member: { id: existing.id, name: targetUser.name, email: targetUser.email, permission },
      recovered: true,
    };
  }

  const { data: newRow, error: insertErr } = await supabase
    .from("ow_company_admins")
    .insert({ user_id: targetUser.id, company_id: companyId, permission, is_active: true })
    .select("id")
    .single();

  if (insertErr || !newRow) {
    console.error("[members _lib insert]", insertErr?.message);
    return { ok: false, status: 500, code: "DB_ERROR", message: insertErr?.message ?? "Failed" };
  }

  return {
    ok: true,
    member: { id: newRow.id, name: targetUser.name, email: targetUser.email, permission },
    recovered: false,
  };
}
