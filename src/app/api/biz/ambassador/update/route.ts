import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { NextRequest, NextResponse } from "next/server";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";
import { approveMember, unlistMember } from "@/lib/companyMembers/decide";

export const dynamic = "force-dynamic";

// PATCH /api/biz/ambassador/update
// Body: { member_id: string; is_public?: boolean; role_title?: string }
export async function PATCH(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "管理者のみ操作できます" }, { status: 403 });
  }

  let body: { member_id?: string; is_public?: boolean; role_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { member_id, is_public, role_title } = body;
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

  /* ── 役職の変更は状態遷移ではないので、ここで直接あてる ─────────────── */
  if (role_title !== undefined) {
    const { error } = await admin
      .from("ow_company_members")
      .update({ role_title: role_title.trim() || null })
      .eq("id", member_id)
      .eq("company_id", ctx.tenantId);
    if (error) {
      console.error("[ambassador update] role_title:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    // ⚠️ 企業ページの面談対応者は unstable_cache 越し。捨てないと最大60秒ズレる
    revalidateCompanyAmbassadors(ctx.tenantId);
  }

  /* ── 公開状態は lib/companyMembers/decide.ts が引き受ける ────────────────
     ⚠️ ここで `is_public` を直接 UPDATE しないこと。初回承認かどうかの判定と
        本人への通知が decide.ts の内側にあり、直接書くと**通知だけが落ちる**。
     ⚠️ 承認と再掲載の区別も decide.ts が持つ（往復でメールを飛ばさないため）。 */
  if (is_public !== undefined) {
    const result = is_public
      ? await approveMember(member_id, ctx.tenantId)
      : await unlistMember(member_id, ctx.tenantId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, notified: result.notified });
  }

  return NextResponse.json({ ok: true });
}
