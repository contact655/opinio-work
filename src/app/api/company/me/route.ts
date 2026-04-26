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
      // 採用情報
      annual_hire_count: body.annual_hire_count || null,
      mid_career_ratio: body.mid_career_ratio ? parseInt(body.mid_career_ratio) : null,
      avg_tenure: body.avg_tenure || null,
      // 選考情報
      avg_selection_weeks: body.avg_selection_weeks ? parseInt(body.avg_selection_weeks) : null,
      selection_count: body.selection_count ? parseInt(body.selection_count) : null,
      selection_flow: body.selection_flow || null,
      // 評価・報酬
      has_stock_option: body.has_stock_option ?? false,
      has_incentive: body.has_incentive ?? false,
      incentive_detail: body.incentive_detail || null,
      bonus_times: body.bonus_times ? parseInt(body.bonus_times) : null,
      salary_raise_frequency: body.salary_raise_frequency || null,
      evaluation_system: body.evaluation_system || null,
      // 組織・カルチャー
      female_manager_ratio: body.female_manager_ratio ? parseInt(body.female_manager_ratio) : null,
      maternity_leave_female: body.maternity_leave_female ? parseInt(body.maternity_leave_female) : null,
      maternity_leave_male: body.maternity_leave_male ? parseInt(body.maternity_leave_male) : null,
      top_down_ratio: body.top_down_ratio != null ? parseInt(body.top_down_ratio) : null,
      official_language: body.official_language || null,
      // v2: 基本情報
      engineer_ratio: body.engineer_ratio || null,
      funding_stage: body.funding_stage || null,
      arr_scale: body.arr_scale || null,
      ceo_name: body.ceo_name || null,
      office_count: body.office_count || null,
      // v2: 働き方
      flex_time: body.flex_time ?? null,
      core_time: body.core_time || null,
      office_days_per_week: body.office_days_per_week || null,
      annual_holiday_days: body.annual_holiday_days ? parseInt(body.annual_holiday_days) : null,
      side_job_ok: body.side_job_ok ?? null,
      // v2: 報酬・評価
      salary_review_times: body.salary_review_times ? parseInt(body.salary_review_times) : null,
      evaluation_cycle: body.evaluation_cycle || null,
      // v2: 成長・キャリア
      has_book_allowance: body.has_book_allowance ?? null,
      has_internal_transfer: body.has_internal_transfer ?? null,
      avg_tenure_years: body.avg_tenure_years || null,
      turnover_rate: body.turnover_rate || null,
      // v2: 組織・多様性
      female_ratio: body.female_ratio || null,
      management_style: body.management_style || null,
      one_on_one_freq: body.one_on_one_freq || null,
      // v2: 福利厚生
      childcare_leave_rate: body.childcare_leave_rate || null,
      has_housing_allowance: body.has_housing_allowance ?? null,
      has_meal_allowance: body.has_meal_allowance ?? null,
      has_learning_support: body.has_learning_support ?? null,
      has_health_support: body.has_health_support ?? null,
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
