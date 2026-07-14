import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { SALARY_MIN_REPORTS_TO_DISPLAY, SALARY_STATS_MIN } from "@/lib/constants/salary";

export const dynamic = "force-dynamic";

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/salary-reports?company_id=<uuid>
// Returns approved salary aggregate for a company.
// statistics_opt_out is applied: reports from opted-out users are excluded.
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: optedOut } = await admin
    .from("ow_users")
    .select("id")
    .eq("statistics_opt_out", true);

  const optedOutIds = (optedOut ?? []).map((u: { id: string }) => u.id);

  const query = admin
    .from("ow_salary_reports")
    .select("role_id, ote, annual_salary, grade, start_year_month, end_year_month, years_of_experience, employment_status, ow_roles(id, name, parent_id)")
    .eq("company_id", companyId)
    .eq("is_approved", true);

  const { data } = optedOutIds.length > 0
    ? await query.not("user_id", "in", `(${optedOutIds.join(",")})`)
    : await query;

  const reports = data ?? [];

  if (reports.length < SALARY_STATS_MIN) {
    const rawReports = reports.map((r) => {
      const salary = ((r as any).ote ?? (r as any).annual_salary) as number | null;
      return {
        roleName: ((r as any).ow_roles as { name: string } | null)?.name ?? "不明",
        salary,
        grade: (r as any).grade as string | null,
        startYM: (r as any).start_year_month as string | null,
        endYM: (r as any).end_year_month as string | null,
      };
    }).filter((r) => r.salary != null);
    return NextResponse.json({ summary: null, byRole: [], insufficientData: reports.length > 0, rawReports });
  }

  // COALESCE(ote, annual_salary) — OTE が主フィールド、なければ annual_salary にフォールバック
  const salaries = reports
    .map((r) => ((r as any).ote ?? (r as any).annual_salary) as number | null)
    .filter((s): s is number => s != null);

  if (salaries.length === 0) {
    return NextResponse.json({ summary: null, byRole: [], insufficientData: true });
  }

  const avg = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);

  const byRoleMap: Record<string, { count: number; salaries: number[]; roleName: string }> = {};
  for (const r of reports) {
    const salary = ((r as any).ote ?? (r as any).annual_salary) as number | null;
    if (salary == null) continue;
    const roleId = (r as any).role_id as string;
    const roleName = ((r as any).ow_roles as { name: string } | null)?.name ?? "不明";
    if (!byRoleMap[roleId]) byRoleMap[roleId] = { count: 0, salaries: [], roleName };
    byRoleMap[roleId].salaries.push(salary);
    byRoleMap[roleId].count++;
  }

  const byRole = Object.entries(byRoleMap)
    .filter(([, v]) => v.count >= SALARY_MIN_REPORTS_TO_DISPLAY)
    .map(([roleId, v]) => ({
      roleId,
      roleName: v.roleName,
      count: v.count,
      avg: Math.round(v.salaries.reduce((a, b) => a + b, 0) / v.salaries.length),
    }))
    .sort((a, b) => b.avg - a.avg);

  return NextResponse.json({ summary: { avg, min, max, count: salaries.length }, byRole });
}

// POST /api/salary-reports
// Submit a salary report (pending admin approval).
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "user not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const {
    company_id,
    role_id,
    ote_man,
    start_year_month,
    end_year_month,
    grade,
    annual_salary_man,
    base_salary_man,
    bonus_salary_man,
    incentive_man,
    stock_options_man,
    allowances_man,
    fixed_overtime_man,
    years_of_experience,
    employment_status,
    prefecture,
  } = body as {
    company_id?: string;
    role_id?: string;
    ote_man?: number;
    start_year_month?: string;
    end_year_month?: string | null;
    grade?: string | null;
    annual_salary_man?: number | null;
    base_salary_man?: number | null;
    bonus_salary_man?: number | null;
    incentive_man?: number | null;
    stock_options_man?: number | null;
    allowances_man?: number | null;
    fixed_overtime_man?: number | null;
    years_of_experience?: number | null;
    employment_status?: string;
    prefecture?: string | null;
  };

  if (!company_id || !role_id || !ote_man || !start_year_month || !employment_status) {
    return NextResponse.json({ error: "company_id, role_id, ote_man, start_year_month, employment_status は必須です" }, { status: 400 });
  }
  if (!["current", "alumni"].includes(employment_status)) {
    return NextResponse.json({ error: "invalid employment_status" }, { status: 400 });
  }
  if (!YM_RE.test(start_year_month)) {
    return NextResponse.json({ error: "start_year_month は YYYY-MM 形式で入力してください" }, { status: 400 });
  }
  if (end_year_month && !YM_RE.test(end_year_month)) {
    return NextResponse.json({ error: "end_year_month は YYYY-MM 形式で入力してください" }, { status: 400 });
  }

  const ote = ote_man * 10000;
  if (ote < 1000000 || ote > 500000000) {
    return NextResponse.json({ error: "年収の値が範囲外です（100万〜50000万円）" }, { status: 400 });
  }

  // annual_salary: 実支給が OTE と異なる場合のみ入力。未入力なら OTE と同値
  const annual_salary = annual_salary_man ? annual_salary_man * 10000 : ote;
  const is_flagged = ote < 3000000 || ote > 30000000;

  const { error } = await supabase.from("ow_salary_reports").insert({
    company_id,
    user_id: owUser.id,
    role_id,
    ote,
    annual_salary,
    start_year_month,
    end_year_month: end_year_month || null,
    grade: grade || null,
    base_salary:    base_salary_man    ? base_salary_man    * 10000 : null,
    bonus_salary:   bonus_salary_man   ? bonus_salary_man   * 10000 : null,
    incentive:      incentive_man      ? incentive_man      * 10000 : null,
    stock_options:  stock_options_man  ? stock_options_man  * 10000 : null,
    allowances:     allowances_man     ? allowances_man     * 10000 : null,
    fixed_overtime: fixed_overtime_man ? fixed_overtime_man * 10000 : null,
    years_of_experience: years_of_experience ?? null,
    employment_status,
    prefecture: prefecture ?? null,
    is_approved: false,
    is_flagged,
  });

  if (error) {
    console.error("[POST /api/salary-reports]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
