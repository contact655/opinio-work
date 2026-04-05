import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET: ログイン中ユーザーの企業情報を取得
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_companies")
    .select(
      "*, ow_company_members(*), ow_company_culture_tags(tag_category, tag_value)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[company/me GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const companies = data || [];
  return NextResponse.json({
    company: companies[0] || null,   // 後方互換: 1社目
    companies,                        // 全企業リスト
  });
}

// PUT: 企業情報を更新
export async function PUT(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const body = await req.json();
  const companyId = body.id;

  if (!companyId) {
    return NextResponse.json({ error: "Company ID required" }, { status: 400 });
  }

  // 所有者確認
  const { data: existing } = await admin
    .from("ow_companies")
    .select("id")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // 企業情報を更新
  const { error: updateError } = await admin
    .from("ow_companies")
    .update({
      name: body.name,
      name_en: body.name_en,
      founded_at: body.founded_at,
      employee_count: body.employee_count,
      location: body.location,
      industry: body.industry,
      phase: body.phase,
      url: body.url,
      mission: body.mission,
      description: body.description,
      logo_url: body.logo_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  if (updateError) {
    console.error("[company/me PUT] update error:", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // メンバーを置換
  await admin.from("ow_company_members").delete().eq("company_id", companyId);
  if (body.members && body.members.length > 0) {
    await admin.from("ow_company_members").insert(
      body.members.map((m: any, i: number) => ({
        company_id: companyId,
        name: m.name,
        role: m.role,
        background: m.background,
        photo_url: m.photo_url,
        display_order: i,
      }))
    );
  }

  // カルチャータグを置換
  await admin.from("ow_company_culture_tags").delete().eq("company_id", companyId);
  if (body.cultureTags && body.cultureTags.length > 0) {
    await admin.from("ow_company_culture_tags").insert(
      body.cultureTags.map((t: any) => ({
        company_id: companyId,
        tag_category: t.tag_category,
        tag_value: t.tag_value,
      }))
    );
  }

  return NextResponse.json({ success: true });
}
