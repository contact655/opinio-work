import { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "candidate" | "company" | "admin";

/**
 * ユーザーのロール一覧を取得
 */
export async function getUserRoles(supabase: SupabaseClient): Promise<UserRole[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("ow_user_roles")
    .select("role")
    .eq("user_id", user.id);

  return (data || []).map((r: any) => r.role as UserRole);
}

/**
 * ユーザーにロールを追加（既に存在する場合は無視）
 */
export async function addUserRole(supabase: SupabaseClient, role: UserRole): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // upsert ではなく insert を使い、重複時は無視する
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

  const [rolesResult, profileResult, companiesResult] = await Promise.all([
    supabase.from("ow_user_roles").select("role").eq("user_id", user.id),
    supabase.from("ow_profiles").select("id, name").eq("user_id", user.id).maybeSingle(),
    supabase.from("ow_companies").select("id, name, status").eq("user_id", user.id),
  ]);

  const roles = (rolesResult.data || []).map((r: any) => r.role as UserRole);

  return {
    user,
    roles,
    profile: profileResult.data,
    companies: companiesResult.data || [],
  };
}
