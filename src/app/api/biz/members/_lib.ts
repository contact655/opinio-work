import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

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
 * - 別会社に既に所属中 → { ok: false, status: 409, code: "USER_ALREADY_BELONGS_TO_OTHER_COMPANY" }
 */
export async function addExistingUserToCompany(params: {
  supabase: SupabaseClient;
  targetUser: { id: string; name: string; email: string; auth_id: string };
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

    const roleResult = await upsertCompanyRole(targetUser.auth_id, companyId);
    if (!roleResult.ok) return roleResult;

    return {
      ok: true,
      member: { id: existing.id, name: targetUser.name, email: targetUser.email, permission },
      recovered: true,
    };
  }

  const roleResult = await upsertCompanyRole(targetUser.auth_id, companyId);
  if (!roleResult.ok) return roleResult;

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

/**
 * ow_user_roles に role='company', tenant_id=companyId を INSERT する。
 * 「1 ユーザー = 1 社」がプロダクト方針なので、既に別会社で role='company' を持つ場合は 409 で弾く。
 *
 * NOTE (M-4 commit 2.5): ow_user_roles INSERT を追加して biz アクセス権を付与する。
 * 「1 ユーザー = 1 社」がプロダクト方針（複数社管理は別アカウントで対応）。
 * 既に他会社で role='company' を持つユーザーを別会社に追加しようとしたら 409 で弾く。
 * 将来 getTenantContext() を ow_company_admins ベースに移行する際に、
 * この ow_user_roles INSERT も削除予定（同じ TODO は company/register/route.ts:111 にもあり）。
 */
async function upsertCompanyRole(
  authId: string,
  companyId: string,
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const admin = createAdminClient();

  // ow_user_roles_own_insert は auth.uid() = user_id のみ許可のため service_role 必須
  const { data: existing } = await admin
    .from("ow_user_roles")
    .select("id, tenant_id")
    .eq("user_id", authId)
    .eq("role", "company")
    .maybeSingle();

  if (existing) {
    if (existing.tenant_id === companyId) {
      // (b) 同社 → 冪等。何もしない
      return { ok: true };
    }
    // (c) 別会社 → 「1 ユーザー = 1 社」違反
    return {
      ok: false,
      status: 409,
      code: "USER_ALREADY_BELONGS_TO_OTHER_COMPANY",
      message: "このユーザーは既に別の会社に所属しています。1 ユーザーは 1 社のみ所属できます",
    };
  }

  // (a) 未登録 → INSERT
  const { error } = await admin
    .from("ow_user_roles")
    .insert({ user_id: authId, role: "company", tenant_id: companyId });

  if (error) {
    console.error("[members _lib upsertCompanyRole]", error.message);
    return { ok: false, status: 500, code: "DB_ERROR", message: error.message };
  }

  return { ok: true };
}
