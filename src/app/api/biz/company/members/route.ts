import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import type { CompanyMember } from "@/lib/business/photos";

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
    const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
    if (!ctx) return Response.json({ error: "Company not found" }, { status: 404 });

    const { companyId } = ctx;
    const admin = createAdminClient();

    // Source 1: Company admins
    const { data: adminRows } = await admin
      .from("ow_company_admins")
      .select("user_id")
      .eq("company_id", companyId);

    // Source 2: Current employees via ow_experiences
    const { data: expRows } = await admin
      .from("ow_experiences")
      .select("user_id, role_title")
      .eq("company_id", companyId)
      .eq("is_current", true);

    // Build role map and unique user ID list
    const roleByUserId = new Map<string, string | null>();
    (expRows ?? []).forEach((e: { user_id: string; role_title: string | null }) => {
      if (e.user_id) roleByUserId.set(e.user_id, e.role_title ?? null);
    });

    const combined = [
      ...(adminRows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean),
      ...Array.from(roleByUserId.keys()),
    ];
    const allUserIds = Array.from(new Set(combined));

    if (allUserIds.length === 0) {
      return Response.json({ members: [] });
    }

    const { data: users } = await admin
      .from("ow_users")
      .select("id, name")
      .in("id", allUserIds);

    const members: CompanyMember[] = (users ?? []).map((u: { id: string; name: string | null }) => ({
      userId: u.id,
      name: u.name ?? "名前未設定",
      roleTitle: roleByUserId.get(u.id) ?? null,
    }));

    return Response.json({ members });
  } catch (e) {
    console.error("[GET /api/biz/company/members]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
