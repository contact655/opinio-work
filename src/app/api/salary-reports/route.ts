import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { SALARY_MIN_REPORTS_TO_DISPLAY } from "@/lib/constants/salary";

export const dynamic = "force-dynamic";

// GET /api/salary-reports?company_id=<uuid>
// Returns approved salary aggregate for a company.
// statistics_opt_out is applied: reports from opted-out users are excluded.
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const admin = createAdminClient();

  // Fetch approved reports excluding statistics_opt_out users.
  // Two-step to avoid a complex join on the JS side.
  const { data: optedOut } = await admin
    .from("ow_users")
    .select("id")
    .eq("statistics_opt_out", true);

  const optedOutIds = (optedOut ?? []).map((u: { id: string }) => u.id);

  const query = admin
    .from("ow_salary_reports")
    .select("role_id, annual_salary, years_of_experience, employment_status, ow_roles(id, name, parent_id)")
    .eq("company_id", companyId)
    .eq("is_approved", true);

  const { data } = optedOutIds.length > 0
    ? await query.not("user_id", "in", `(${optedOutIds.join(",")})`)
    : await query;

  const reports = data ?? [];

  if (reports.length < SALARY_MIN_REPORTS_TO_DISPLAY) {
    return NextResponse.json({ summary: null, byRole: [], insufficientData: reports.length > 0 });
  }

  const salaries = reports.map((r) => (r as any).annual_salary as number);
  const avg = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);

  // Per-role breakdown — only show groups with >= 5 reports (k-anonymity).
  const byRoleMap: Record<string, { count: number; salaries: number[]; roleName: string }> = {};
  for (const r of reports) {
    const roleId = (r as any).role_id as string;
    const roleName = ((r as any).ow_roles as { name: string } | null)?.name ?? "不明";
    if (!byRoleMap[roleId]) byRoleMap[roleId] = { count: 0, salaries: [], roleName };
    byRoleMap[roleId].salaries.push((r as any).annual_salary as number);
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

  return NextResponse.json({ summary: { avg, min, max, count: reports.length }, byRole });
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

  const { company_id, role_id, years_of_experience, annual_salary_man, employment_status, prefecture } =
    body as {
      company_id?: string;
      role_id?: string;
      years_of_experience?: number | null;
      annual_salary_man?: number;
      employment_status?: string;
      prefecture?: string | null;
    };

  if (!company_id || !role_id || !annual_salary_man || !employment_status) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }
  if (!["current", "alumni"].includes(employment_status)) {
    return NextResponse.json({ error: "invalid employment_status" }, { status: 400 });
  }

  const annual_salary = annual_salary_man * 10000;
  if (annual_salary < 1000000 || annual_salary > 500000000) {
    return NextResponse.json({ error: "年収の値が範囲外です（100万〜50000万円）" }, { status: 400 });
  }

  // Auto-flag suspiciously low/high values for IT/SaaS context.
  const is_flagged = annual_salary < 3000000 || annual_salary > 30000000;

  const { error } = await supabase.from("ow_salary_reports").insert({
    company_id,
    user_id: owUser.id,
    role_id,
    years_of_experience: years_of_experience ?? null,
    annual_salary,
    employment_status,
    prefecture: prefecture ?? null,
    is_approved: false,
    is_flagged,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "この企業・職種の給与データはすでに投稿済みです" }, { status: 409 });
    }
    console.error("[POST /api/salary-reports]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
