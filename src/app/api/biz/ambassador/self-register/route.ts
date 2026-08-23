import { createClient } from "@/lib/supabase/server";
import { mutateOne } from "@/lib/supabase/mutate";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { NextRequest, NextResponse } from "next/server";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

// POST /api/biz/ambassador/self-register
// Body: { role_title: string }
// 管理者が自分自身を面談対応者として登録
// RLS対応: INSERT は display_consent=false → UPDATEで本人として true に変更
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

  // Step 1: adminSupabase で display_consent=false として INSERT（RLS INSERT制約を満たす）
  const { data: member, error: insertError } = await adminSupabase
    .from("ow_company_members")
    .insert({
      company_id: ctx.tenantId,
      user_id: ctx.currentOwnId,
      display_consent: false,   // RLS: INSERT は false のみ許可
      is_public: true,
      role_title: role_title.trim(),
      invited_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[ambassador self-register] insert:", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Step 2: 本人として UPDATE（own_member_consent ポリシーで許可。トリガーが consent_at を自動セット）
  const supabase = createClient();
  /* ⚠️ 同意の記録が0行だと「申請した」のに記録が無い状態になる。必ず行数を見る */
  const updateRes = await mutateOne(
    supabase.from("ow_company_members").update({ display_consent: true }).eq("id", member.id),
    "ambassador self-register 同意",
  );
  const updateError = updateRes.ok ? null : { message: updateRes.error };

  if (updateError) {
    console.error("[ambassador self-register] consent update:", updateError.message);
    // INSERT は成功しているので承認待ち状態として返す
    return NextResponse.json({ id: member.id, consented: false, error: updateError.message }, { status: 500 });
  }

  revalidateCompanyAmbassadors(ctx.tenantId);
  return NextResponse.json({ id: member.id, consented: true });
}
