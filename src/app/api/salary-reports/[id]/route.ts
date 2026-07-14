import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

async function resolveOwUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

// PATCH /api/salary-reports/[id]  — 自分の投稿を更新
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const owUserId = await resolveOwUserId();
  if (!owUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // 本人確認（user_id が一致するレコードか）
  const { data: existing, error: fetchErr } = await admin
    .from("ow_salary_reports")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.user_id !== owUserId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const {
    role_id,
    ote_man,
    start_year_month,
    end_year_month,
    grade,
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
    role_id?: string;
    ote_man?: number;
    start_year_month?: string;
    end_year_month?: string | null;
    grade?: string | null;
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

  if (start_year_month && !YM_RE.test(start_year_month)) {
    return NextResponse.json({ error: "start_year_month は YYYY-MM 形式で入力してください" }, { status: 400 });
  }
  if (end_year_month && !YM_RE.test(end_year_month)) {
    return NextResponse.json({ error: "end_year_month は YYYY-MM 形式で入力してください" }, { status: 400 });
  }
  if (ote_man !== undefined) {
    const ote = ote_man * 10000;
    if (ote < 1000000 || ote > 500000000) {
      return NextResponse.json({ error: "年収の値が範囲外です（100万〜50000万円）" }, { status: 400 });
    }
  }
  if (employment_status && !["current", "alumni"].includes(employment_status)) {
    return NextResponse.json({ error: "invalid employment_status" }, { status: 400 });
  }

  // Build update payload (only provided fields)
  const patch: Record<string, unknown> = {
    // 編集したら再審査（案B）
    is_approved: false,
    updated_at: new Date().toISOString(),
  };
  if (role_id !== undefined)            patch.role_id = role_id;
  if (ote_man !== undefined) {
    const oteYen = ote_man * 10000;
    patch.ote = oteYen;
    patch.annual_salary = oteYen;
    patch.is_flagged = oteYen < 3000000 || oteYen > 30000000;
  }
  if (start_year_month !== undefined)   patch.start_year_month = start_year_month || null;
  if (end_year_month !== undefined)     patch.end_year_month = end_year_month || null;
  if (grade !== undefined)              patch.grade = grade || null;
  if (base_salary_man !== undefined)    patch.base_salary = base_salary_man ? base_salary_man * 10000 : null;
  if (bonus_salary_man !== undefined)   patch.bonus_salary = bonus_salary_man ? bonus_salary_man * 10000 : null;
  if (incentive_man !== undefined)      patch.incentive = incentive_man ? incentive_man * 10000 : null;
  if (stock_options_man !== undefined)  patch.stock_options = stock_options_man ? stock_options_man * 10000 : null;
  if (allowances_man !== undefined)     patch.allowances = allowances_man ? allowances_man * 10000 : null;
  if (fixed_overtime_man !== undefined) patch.fixed_overtime = fixed_overtime_man ? fixed_overtime_man * 10000 : null;
  if (years_of_experience !== undefined) patch.years_of_experience = years_of_experience ?? null;
  if (employment_status !== undefined)  patch.employment_status = employment_status;
  if (prefecture !== undefined)         patch.prefecture = prefecture || null;

  const { error } = await admin
    .from("ow_salary_reports")
    .update(patch)
    .eq("id", params.id);

  if (error) {
    console.error("[PATCH /api/salary-reports/[id]]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/salary-reports/[id]  — 自分の投稿を削除
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const owUserId = await resolveOwUserId();
  if (!owUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: existing, error: fetchErr } = await admin
    .from("ow_salary_reports")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.user_id !== owUserId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("ow_salary_reports")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/salary-reports/[id]]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
