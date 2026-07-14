import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

// GET /api/biz/hidden-experiences — 自社の非表示 experience_id 一覧
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("ow_company_hidden_experiences")
    .select("experience_id")
    .eq("company_id", ctx.companyId);

  return NextResponse.json({ hiddenIds: (data ?? []).map((r: any) => r.experience_id as string) });
}

// POST /api/biz/hidden-experiences — 社員を企業ページから非表示にする
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  let body: { experience_id: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { experience_id } = body;
  if (!experience_id) return NextResponse.json({ error: "experience_id required" }, { status: 400 });

  const admin = createAdminClient();

  // 最重要: experience が自社 company_id に属するか検証
  const { data: exp } = await admin
    .from("ow_experiences")
    .select("id, company_id")
    .eq("id", experience_id)
    .maybeSingle();

  if (!exp) return NextResponse.json({ error: "Experience not found" }, { status: 404 });
  if (exp.company_id !== ctx.companyId) {
    return NextResponse.json({ error: "この経歴は自社に属していません" }, { status: 403 });
  }

  // 自社の company_admin レコードを取得して hidden_by に設定
  const { data: adminRecord } = await admin
    .from("ow_company_admins")
    .select("id")
    .eq("user_id", ctx.owUserId)
    .eq("company_id", ctx.companyId)
    .eq("is_active", true)
    .maybeSingle();

  const { error } = await admin
    .from("ow_company_hidden_experiences")
    .insert({
      company_id: ctx.companyId,
      experience_id,
      hidden_by: adminRecord?.id ?? null,
    });

  if (error && error.code !== "23505") { // 23505 = unique violation (already hidden)
    console.error("[POST /api/biz/hidden-experiences]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/biz/hidden-experiences?experience_id=<uuid> — 非表示を解除
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  const experience_id = req.nextUrl.searchParams.get("experience_id");
  if (!experience_id) return NextResponse.json({ error: "experience_id required" }, { status: 400 });

  const admin = createAdminClient();

  // 自社レコードのみ削除（company_id でスコープ制限）
  const { error } = await admin
    .from("ow_company_hidden_experiences")
    .delete()
    .eq("company_id", ctx.companyId)
    .eq("experience_id", experience_id);

  if (error) {
    console.error("[DELETE /api/biz/hidden-experiences]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
