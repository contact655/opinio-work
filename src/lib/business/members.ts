import type { SupabaseClient } from "@supabase/supabase-js";

export type MemberRecord = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  initial: string;
  gradient: string;
  role_title: string | null;
  department: string | null;
  permission: "admin" | "member";
  is_active: boolean;
  created_at: string;
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, var(--royal), var(--accent))";

type DbRow = {
  id: string;
  permission: string;
  role_title: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
  user: { id: string; name: string; email: string; avatar_color: string | null } | null;
};

export async function fetchMembersForCompany(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<MemberRecord[]> {
  try {
    const { data, error } = await supabase
      .from("ow_company_admins")
      .select("id, permission, role_title, department, is_active, created_at, user:ow_users!user_id (id, name, email, avatar_color)")
      .eq("company_id", tenantId)
      .order("permission", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[members] fetch error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => {
      const r = row as unknown as DbRow;
      const gradient = r.user?.avatar_color?.startsWith("linear-gradient")
        ? r.user.avatar_color
        : FALLBACK_GRADIENT;
      return {
        id: r.id,
        user_id: r.user?.id ?? "",
        name: r.user?.name ?? "—",
        email: r.user?.email ?? "—",
        initial: r.user?.name?.charAt(0) ?? "?",
        gradient,
        role_title: r.role_title,
        department: r.department,
        permission: r.permission === "admin" ? "admin" : "member",
        is_active: r.is_active,
        created_at: r.created_at,
      };
    });
  } catch (err) {
    console.error("[members] unexpected error:", err);
    return [];
  }
}
