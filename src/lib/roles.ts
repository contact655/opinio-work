import { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "candidate" | "company" | "admin";

/**
 * ユーザーのロール一覧を取得
 * - candidate / admin: ow_user_roles から取得
 * - company: ow_company_admins の is_active=true 行の存在で判定
 */
export async function getUserRoles(supabase: SupabaseClient): Promise<UserRole[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // candidate / admin のみ ow_user_roles から取得 (company は除外)
  const { data: legacyRoles } = await supabase
    .from("ow_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["candidate", "admin"]);

  const roles: UserRole[] = (legacyRoles ?? []).map((r: any) => r.role as UserRole);

  // company ロール判定: ow_company_admins にアクティブな所属があるか
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (owUser?.id) {
    const { data: memberships } = await supabase
      .from("ow_company_admins")
      .select("id")
      .eq("user_id", owUser.id)
      .eq("is_active", true)
      .limit(1);

    if ((memberships?.length ?? 0) > 0) {
      roles.push("company");
    }
  }

  return roles;
}

/**
 * ユーザーにロールを追加（既に存在する場合は無視）
 * company ロールは ow_company_admins で管理するため追加不可
 */
export async function addUserRole(supabase: SupabaseClient, role: UserRole): Promise<boolean> {
  if (role === "company") {
    console.warn("[addUserRole] role='company' is managed via ow_company_admins. Use /api/biz/members/invite instead.");
    return false;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("ow_user_roles")
    .insert({ user_id: user.id, role });

  // 重複エラー (23505) は正常扱い
  if (error && error.code !== "23505") {
    console.error("[addUserRole] insert error:", error);
    return false;
  }
  return true;
}

/**
 * ユーザーが特定のロールを持っているか確認
 */
export async function hasRole(supabase: SupabaseClient, role: UserRole): Promise<boolean> {
  const roles = await getUserRoles(supabase);
  return roles.includes(role);
}

/**
 * サーバーサイド：ユーザーのロール一覧と関連データを取得
 */
export async function getUserRolesWithData(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [roles, profileResult, companiesResult] = await Promise.all([
    getUserRoles(supabase),
    supabase.from("ow_profiles").select("id, name").eq("user_id", user.id).maybeSingle(),
    supabase.from("ow_companies").select("id, name, status").eq("user_id", user.id),
  ]);

  return {
    user,
    roles,
    profile: profileResult.data,
    companies: companiesResult.data || [],
  };
}
