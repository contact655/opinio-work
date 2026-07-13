import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/biz/ambassador/self-register
// Body: { role_title: string }
// 管理者が自分自身を面談対応者として登録（display_consent=true で即確定）
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { role_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { role_title } = body;
  if (!role_title || !role_title.trim()) {
    return NextResponse.json({ error: "role_title required" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // 既に登録済みかチェック
  const { data: existing } = await adminSupabase
    .from("ow_company_members")
    .select("id")
    .eq("company_id", ctx.tenantId)
    .eq("user_id", ctx.currentOwnId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_registered", id: existing.id }, { status: 409 });
  }

  const { data: member, error } = await adminSupabase
    .from("ow_company_members")
    .insert({
      company_id: ctx.tenantId,
      user_id: ctx.currentOwnId,
      display_consent: true,       // 自己申告なので即時同意
      consent_at: new Date().toISOString(),
      is_public: true,
      role_title: role_title.trim(),
      invited_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[ambassador self-register]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ id: member.id });
}
