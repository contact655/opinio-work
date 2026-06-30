import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function str(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.trim().slice(0, max) : null;
}
function safeHttpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (!t.startsWith("https://")) return null;
  return t.slice(0, 2048);
}

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      name: str(body.name, 200),
      name_en: str(body.name_en, 200),
      founded_at: body.founded_at,
      employee_count: body.employee_count,
      location: str(body.location, 200),
      industry: str(body.industry, 100),
      phase: str(body.phase, 100),
      url: safeHttpsUrl(body.url),
      mission: str(body.mission, 1000),
      description: str(body.description, 5000),
      logo_url: safeHttpsUrl(body.logo_url),
      // 採用情報
      annual_hire_count: body.annual_hire_count || null,
      mid_career_ratio: body.mid_career_ratio ? parseInt(body.mid_career_ratio as string) : null,
      avg_tenure: body.avg_tenure || null,
      // 選考情報
      avg_selection_weeks: body.avg_selection_weeks ? parseInt(body.avg_selection_weeks as string) : null,
      selection_count: body.selection_count ? parseInt(body.selection_count as string) : null,
      selection_flow: str(body.selection_flow, 2000),
      // 評価・報酬
      has_stock_option: body.has_stock_option ?? false,
      has_incentive: body.has_incentive ?? false,
      incentive_detail: str(body.incentive_detail, 500),
      bonus_times: body.bonus_times ? parseInt(body.bonus_times as string) : null,
      salary_raise_frequency: str(body.salary_raise_frequency, 200),
      evaluation_system: str(body.evaluation_system, 2000),
      // 組織・カルチャー
      female_manager_ratio: body.female_manager_ratio ? parseInt(body.female_manager_ratio as string) : null,
      maternity_leave_female: body.maternity_leave_female ? parseInt(body.maternity_leave_female as string) : null,
      maternity_leave_male: body.maternity_leave_male ? parseInt(body.maternity_leave_male as string) : null,
      top_down_ratio: body.top_down_ratio != null ? parseInt(body.top_down_ratio as string) : null,
      official_language: str(body.official_language, 100),
      // v2: 基本情報
      engineer_ratio: body.engineer_ratio || null,
      funding_stage: str(body.funding_stage, 100),
      arr_scale: str(body.arr_scale, 100),
      ceo_name: str(body.ceo_name, 200),
      office_count: body.office_count || null,
      // v2: 働き方
      flex_time: body.flex_time ?? null,
      core_time: str(body.core_time, 200),
      office_days_per_week: body.office_days_per_week || null,
      annual_holiday_days: body.annual_holiday_days ? parseInt(body.annual_holiday_days as string) : null,
      side_job_ok: body.side_job_ok ?? null,
      // v2: 報酬・評価
      salary_review_times: body.salary_review_times ? parseInt(body.salary_review_times as string) : null,
      evaluation_cycle: str(body.evaluation_cycle, 200),
      // v2: 成長・キャリア
      has_book_allowance: body.has_book_allowance ?? null,
      has_internal_transfer: body.has_internal_transfer ?? null,
      avg_tenure_years: body.avg_tenure_years || null,
      turnover_rate: body.turnover_rate || null,
      // v2: 組織・多様性
      female_ratio: body.female_ratio || null,
      management_style: str(body.management_style, 200),
      one_on_one_freq: str(body.one_on_one_freq, 200),
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // メンバーを置換
  const safeMembers = (body.members as unknown[] ?? []).slice(0, 50);
  await admin.from("ow_company_members").delete().eq("company_id", companyId);
  if (safeMembers.length > 0) {
    await admin.from("ow_company_members").insert(
      safeMembers.map((m: unknown, i: number) => {
        const member = m as Record<string, unknown>;
        return {
          company_id: companyId,
          name: str(member.name, 100),
          role: str(member.role, 100),
          background: str(member.background, 500),
          photo_url: safeHttpsUrl(member.photo_url),
          display_order: i,
        };
      })
    );
  }

  // カルチャータグを置換
  const safeTags = (body.cultureTags as unknown[] ?? []).slice(0, 50);
  await admin.from("ow_company_culture_tags").delete().eq("company_id", companyId);
  if (safeTags.length > 0) {
    await admin.from("ow_company_culture_tags").insert(
      safeTags.map((t: unknown) => {
        const tag = t as Record<string, unknown>;
        return {
          company_id: companyId,
          tag_category: str(tag.tag_category, 100),
          tag_value: str(tag.tag_value, 100),
        };
      })
    );
  }

  return NextResponse.json({ success: true });
}
