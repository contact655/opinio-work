import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { notify } from "@/lib/notify/email";
import { ambassadorInviteTemplate } from "@/lib/notify/templates";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/biz/ambassador/invite
// Body: { user_id: string; role_title: string }
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "管理者のみ操作できます" }, { status: 403 });
  }

  let body: { user_id?: string; role_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user_id, role_title } = body;
  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  if (!role_title || typeof role_title !== "string" || role_title.trim().length === 0) {
    return NextResponse.json({ error: "role_title required" }, { status: 400 });
  }

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  // 既に登録済みかチェック
  const { data: existing } = await adminSupabase
    .from("ow_company_members")
    .select("id, display_consent")
    .eq("company_id", ctx.tenantId)
    .eq("user_id", user_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "この社員はすでに面談対応者に登録されています", id: existing.id },
      { status: 409 }
    );
  }

  // auth.users.id を取得（invited_by 用）
  const { data: { user: authUser } } = await supabase.auth.getUser();

  // INSERT
  const { data: member, error } = await adminSupabase
    .from("ow_company_members")
    .insert({
      company_id: ctx.tenantId,
      user_id,
      display_consent: false,
      is_public: false,
      role_title: role_title.trim(),
      invited_at: new Date().toISOString(),
      invited_by: authUser?.id ?? null,
    })
    .select("id, invite_token")
    .single();

  if (error) {
    console.error("[ambassador invite] insert error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 招待対象のメールアドレスと名前を取得
  const { data: owUser } = await adminSupabase
    .from("ow_users")
    .select("name, email, auth_id")
    .eq("id", user_id)
    .maybeSingle();

  // auth.users からメールを取得
  let email: string | null = owUser?.email ?? null;
  if (!email && owUser?.auth_id) {
    const { data: authData } = await adminSupabase.auth.admin.getUserById(owUser.auth_id);
    email = authData?.user?.email ?? null;
  }

  if (email) {
    await notify(
      ambassadorInviteTemplate({
        to: email,
        userName: owUser?.name ?? "ユーザー",
        companyName: ctx.tenantName,
        roleTitle: role_title.trim(),
        token: member.invite_token,
      })
    );
  }

  return NextResponse.json({ id: member.id, invite_token: member.invite_token });
}
