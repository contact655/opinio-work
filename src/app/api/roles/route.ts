import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserRolesWithData, addUserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET: ユーザーのロール一覧を取得
export async function GET() {
  const supabase = createClient();
  const result = await getUserRolesWithData(supabase);

  if (!result) {
    return NextResponse.json({ roles: [], profile: null, companies: [] }, { status: 401 });
  }

  return NextResponse.json({
    roles: result.roles,
    profile: result.profile,
    companies: result.companies,
  });
}

// POST: ロールを追加 (company ロールは ow_company_admins で管理するため不可)
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { role?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const role = typeof body.role === "string" ? body.role : null;
  if (!role || role === "company") {
    return NextResponse.json(
      { error: "company role is managed via ow_company_admins" },
      { status: 400 }
    );
  }

  // Allowlist: only "candidate" is self-assignable. "admin" must never be self-granted.
  const SELF_ASSIGNABLE_ROLES = ["candidate"];
  if (!SELF_ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const ok = await addUserRole(supabase, role as import("@/lib/roles").UserRole);
  if (!ok) {
    return NextResponse.json({ error: "Invalid role or insert failed" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
