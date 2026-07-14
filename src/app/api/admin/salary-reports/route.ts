import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
    annual_salary,
    base_salary,
    bonus_salary,
    incentive,
    stock_options,
    employment_status,
    years_of_experience,
    prefecture,
    proxy_note,
  } = body as {
    company_id?: string;
    role_id?: string;
    annual_salary?: number;
    base_salary?: number | null;
    bonus_salary?: number | null;
    incentive?: number | null;
    stock_options?: number | null;
    employment_status?: string;
    years_of_experience?: number | null;
    prefecture?: string | null;
    proxy_note?: string | null;
  };

  if (!company_id || !role_id || !annual_salary || !employment_status) {
    return NextResponse.json({ error: "company_id, role_id, annual_salary, employment_status are required" }, { status: 400 });
  }
  if (!["current", "alumni"].includes(employment_status)) {
    return NextResponse.json({ error: "invalid employment_status" }, { status: 400 });
  }
  if (annual_salary < 100 || annual_salary > 100000) {
    return NextResponse.json({ error: "annual_salary は万円単位で 100〜100000 の範囲で入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_salary_reports")
    .insert({
      company_id,
      role_id,
      user_id: null,          // 代理投稿は user_id=NULL（proxy_note に追跡情報を記録）
      annual_salary: annual_salary * 10000,
      base_salary:   base_salary   ? base_salary   * 10000 : null,
      bonus_salary:  bonus_salary  ? bonus_salary  * 10000 : null,
      incentive:     incentive     ? incentive     * 10000 : null,
      stock_options: stock_options ? stock_options * 10000 : null,
      employment_status,
      years_of_experience: years_of_experience ?? null,
      prefecture: prefecture ?? null,
      proxy_note: proxy_note || null,
      is_approved: true,   // 代理投稿は審査不要で直接公開
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
