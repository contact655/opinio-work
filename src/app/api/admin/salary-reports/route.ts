import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

async function requireAdmin() {
  const supabase = createClient();
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  return !!isAdmin;
}

// POST /api/admin/salary-reports  — 代理投稿（is_approved=true で直接公開）
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const {
    company_id,
    role_id,
    ote,
    annual_salary,
    base_salary,
    bonus_salary,
    incentive,
    stock_options,
    allowances,
    fixed_overtime,
    start_year_month,
    end_year_month,
    grade,
    employment_status,
    years_of_experience,
    prefecture,
    proxy_note,
  } = body as {
    company_id?: string;
    role_id?: string;
    ote?: number;
    annual_salary?: number | null;
    base_salary?: number | null;
    bonus_salary?: number | null;
    incentive?: number | null;
    stock_options?: number | null;
    allowances?: number | null;
    fixed_overtime?: number | null;
    start_year_month?: string | null;
    end_year_month?: string | null;
    grade?: string | null;
    employment_status?: string;
    years_of_experience?: number | null;
    prefecture?: string | null;
    proxy_note?: string | null;
  };

  if (!company_id || !role_id || !ote || !employment_status) {
    return NextResponse.json({ error: "company_id, role_id, ote, employment_status は必須です" }, { status: 400 });
  }
  if (!["current", "alumni"].includes(employment_status)) {
    return NextResponse.json({ error: "invalid employment_status" }, { status: 400 });
  }
  if (ote < 100 || ote > 100000) {
    return NextResponse.json({ error: "ote は万円単位で 100〜100000 の範囲で入力してください" }, { status: 400 });
  }
  if (start_year_month && !YM_RE.test(start_year_month)) {
    return NextResponse.json({ error: "start_year_month は YYYY-MM 形式で入力してください" }, { status: 400 });
  }
  if (end_year_month && !YM_RE.test(end_year_month)) {
    return NextResponse.json({ error: "end_year_month は YYYY-MM 形式で入力してください" }, { status: 400 });
  }

  const oteYen = ote * 10000;
  // annual_salary: 実支給が OTE と異なる場合のみ指定。未指定なら OTE と同値
  const annualYen = annual_salary ? annual_salary * 10000 : oteYen;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_salary_reports")
    .insert({
      company_id,
      role_id,
      user_id: null,
      ote:            oteYen,
      annual_salary:  annualYen,
      base_salary:    base_salary    ? base_salary    * 10000 : null,
      bonus_salary:   bonus_salary   ? bonus_salary   * 10000 : null,
      incentive:      incentive      ? incentive      * 10000 : null,
      stock_options:  stock_options  ? stock_options  * 10000 : null,
      allowances:     allowances     ? allowances     * 10000 : null,
      fixed_overtime: fixed_overtime ? fixed_overtime * 10000 : null,
      start_year_month: start_year_month || null,
      end_year_month:   end_year_month   || null,
      grade:            grade            || null,
      employment_status,
      years_of_experience: years_of_experience ?? null,
      prefecture: prefecture ?? null,
      proxy_note: proxy_note || null,
      is_approved: true,
      is_flagged: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[POST /api/admin/salary-reports]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
