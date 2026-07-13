import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DELETE /api/biz/ambassador/revoke
// Body: { member_id: string }
export async function DELETE(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "管理者のみ操作できます" }, { status: 403 });
  }

  let body: { member_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { member_id } = body;
  if (!member_id) return NextResponse.json({ error: "member_id required" }, { status: 400 });

  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from("ow_company_members")
    .delete()
    .eq("id", member_id)
    .eq("company_id", ctx.tenantId);

  if (error) {
    console.error("[ambassador revoke] delete error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
