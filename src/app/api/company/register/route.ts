import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // --- 認証チェック（通常のサーバークライアントで） ---
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[company/register] no user found in session");
    return NextResponse.json(
      { error: "ログインが必要です。再度ログインしてからお試しください。" },
      { status: 401 }
    );
  }

  console.log("[company/register] authenticated user:", user.id, user.email);

  // --- DB操作は管理クライアント（RLSバイパス）で ---
  const admin = createAdminClient();
  const body = await req.json();

  if (!body.name || body.name.trim() === "") {
    return NextResponse.json(
      { error: "会社名は必須です" },
      { status: 400 }
    );
  }

  // 1. ow_companies に INSERT
  const { data: company, error: companyError } = await admin
    .from("ow_companies")
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      name_en: body.name_en || null,
      founded_at: body.founded_at || null,
      employee_count: body.employee_count || null,
      location: body.location || null,
      industry: body.industry || null,
      phase: body.phase || null,
      url: body.url || null,
      mission: body.mission || null,
      description: body.description || null,
      logo_url: body.logo_url || null,
      plan: body.plan || "free",
      status: "active",
    })
    .select("id, name")
    .single();

  if (companyError) {
    console.error("[company/register] INSERT failed:", JSON.stringify(companyError));
    return NextResponse.json(
      { error: `企業登録に失敗: ${companyError.message}` },
      { status: 500 }
    );
  }

  console.log("[company/register] company created:", company.id, company.name);

  // 2. カルチャータグを INSERT
  const tags: { tag_category: string; tag_value: string }[] = body.tags || [];
  if (tags.length > 0) {
    const { error: tagError } = await admin
      .from("ow_company_culture_tags")
      .insert(
        tags.map((t) => ({
          company_id: company.id,
          tag_category: t.tag_category,
          tag_value: t.tag_value,
        }))
      );
    if (tagError) {
      console.error("[company/register] tags INSERT failed:", tagError.message);
    }
  }

  // 3. ow_users.id を auth_id から取得して ow_company_admins に INSERT
  const { data: owUser, error: owUserError } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (owUserError || !owUser) {
    console.error("[company/register] ow_users not found for auth_id:", user.id, owUserError?.message);
    // ow_users トリガーが遅延した場合のフォールバック: warning のみ（company は作成済み）
  } else {
    const { error: adminError } = await admin
      .from("ow_company_admins")
      .insert({
        user_id: owUser.id,
        company_id: company.id,
        department: body.department || null,
        role_title: body.role_title || null,
        permission: "admin",
      });

    if (adminError && adminError.code !== "23505") {
      console.error("[company/register] ow_company_admins INSERT failed:", adminError.message);
    } else {
      console.log("[company/register] ow_company_admins created");
    }
  }

  // 4. company ロールを付与 + tenant_id を設定（dashboard の getTenantContext() が参照）
  // TODO: ow_company_admins 移行完了後に ow_user_roles INSERT は削除予定
  const { error: roleError } = await admin
    .from("ow_user_roles")
    .insert({ user_id: user.id, role: "company", tenant_id: company.id });

  if (roleError && roleError.code !== "23505") {
    console.error("[company/register] role INSERT failed:", roleError.message);
  }

  console.log("[company/register] SUCCESS");

  return NextResponse.json({
    success: true,
    company: { id: company.id, name: company.name },
  });
}
