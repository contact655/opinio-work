import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // admin チェック（auth_is_admin RPC — ow_user_roles.role='admin' で判定）
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const [userResult, expResult, companiesResult] = await Promise.all([
    admin.from("ow_users").select("id, name, email").eq("id", params.userId).maybeSingle(),
    admin
      .from("ow_experiences")
      .select("id, company_id, company_text, company_anonymized, role_title, started_at, ended_at, is_current, ow_companies(name)")
      .eq("user_id", params.userId)
      .order("started_at", { ascending: false }),
    admin
      .from("ow_companies")
      .select("id, name, is_published")
      .order("name", { ascending: true }),
  ]);

  const experiences = (expResult.data ?? []).map((e) => ({
    id: e.id,
    company_id: e.company_id,
    company_text: e.company_text,
    company_anonymized: e.company_anonymized,
    role_title: e.role_title,
    started_at: e.started_at,
    ended_at: e.ended_at,
    is_current: e.is_current,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    linked_company_name: (e.ow_companies as any)?.name ?? null,
  }));

  return NextResponse.json({
    user: userResult.data,
    experiences,
    companies: companiesResult.data ?? [],
  });
}
