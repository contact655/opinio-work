import type { SupabaseClient } from "@supabase/supabase-js";

// Mirrors TeamMember from TeamMembers.tsx (structural match)
// ow_company_admins.permission: 'admin' | 'member' → mapped to "admin" | "viewer"
export type DashboardTeamMember = {
  id: string;
  name: string;
  initial: string;
  gradient: string;
  role: string;
  permission: "admin" | "editor" | "viewer";
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, var(--royal), var(--accent))";

type DbAdminRow = {
  id: string;
  permission: string;
  role_title: string | null;
  user: { id: string; name: string; avatar_color: string | null } | null;
};

export async function fetchTeamMembersForDashboard(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<DashboardTeamMember[]> {
  try {
    const { data, error } = await supabase
      .from("ow_company_admins")
      .select("id, permission, role_title, user:ow_users!user_id (id, name, avatar_color)")
      .eq("company_id", tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[team] fetch error:", error.message);
      return [];
    }

    return (data ?? [] as unknown as DbAdminRow[]).map((row) => {
      const r = row as unknown as DbAdminRow;
      const gradient = r.user?.avatar_color?.startsWith("linear-gradient")
        ? r.user.avatar_color
        : FALLBACK_GRADIENT;
      const permission: DashboardTeamMember["permission"] =
        r.permission === "admin" ? "admin" : "viewer";
      return {
        id: r.id,
        name: r.user?.name ?? "—",
        initial: r.user?.name?.charAt(0) ?? "?",
        gradient,
        role: r.role_title ?? (permission === "admin" ? "管理者" : "メンバー"),
        permission,
      };
    });
  } catch (err) {
    console.error("[team] unexpected error:", err);
    return [];
  }
}
