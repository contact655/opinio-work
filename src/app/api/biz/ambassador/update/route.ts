import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/biz/ambassador/update
// Body: { member_id: string; talk_themes?: string[]; is_public?: boolean; role_title?: string }
export async function PATCH(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "管理者のみ操作できます" }, { status: 403 });
  }

  let body: { member_id?: string; talk_themes?: string[]; is_public?: boolean; role_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { member_id, talk_themes, is_public, role_title } = body;
  if (!member_id) return NextResponse.json({ error: "member_id required" }, { status: 400 });

  const admin = createAdminClient();

  // 自社のメンバーであることを確認
  const { data: member } = await admin
    .from("ow_company_members")
    .select("id")
    .eq("id", member_id)
    .eq("company_id", ctx.tenantId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (talk_themes !== undefined) patch.talk_themes = talk_themes;
  if (is_public !== undefined) patch.is_public = is_public;
  if (role_title !== undefined) patch.role_title = role_title.trim() || null;

  const { error } = await admin
    .from("ow_company_members")
    .update(patch)
    .eq("id", member_id);

  if (error) {
    console.error("[ambassador update]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
