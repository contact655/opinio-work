import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET: 企業の給与集計データを取得
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_salary_reports")
    .select("job_type, annual_salary, years_of_experience, employment_status")
    .eq("company_id", companyId)
    .eq("is_approved", true);

  if (error) return NextResponse.json({ reports: [], summary: null });

  const reports = data ?? [];
  if (reports.length === 0) return NextResponse.json({ reports: [], summary: null });

  const salaries = reports.map((r) => r.annual_salary);
  const avg = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);

  // 職種別集計
  const byJobType: Record<string, { count: number; avg: number; salaries: number[] }> = {};
  for (const r of reports) {
    if (!byJobType[r.job_type]) byJobType[r.job_type] = { count: 0, avg: 0, salaries: [] };
    byJobType[r.job_type].salaries.push(r.annual_salary);
    byJobType[r.job_type].count++;
  }
  for (const jt of Object.keys(byJobType)) {
    const s = byJobType[jt].salaries;
    byJobType[jt].avg = Math.round(s.reduce((a, b) => a + b, 0) / s.length);
  }

  return NextResponse.json({
    summary: { avg, min, max, count: reports.length },
    byJobType,
  });
}

// POST: 給与報告を投稿
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!owUser) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const body = await req.json();
  const { company_id, job_type, years_of_experience, annual_salary, employment_status } = body;

  if (!company_id || !job_type || !annual_salary || !employment_status) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const { error } = await supabase.from("ow_salary_reports").insert({
    company_id,
    user_id: owUser.id,
    job_type,
    years_of_experience: years_of_experience ?? null,
    annual_salary,
    employment_status,
    is_approved: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
