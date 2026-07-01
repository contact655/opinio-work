import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PUT /api/jobseeker/experiences/[id] — 職歴更新（RLS が本人チェック）
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const VALID_VISIBILITY = new Set(["real", "masked", "hidden"]);
  const VALID_EMPLOYMENT = new Set(["正社員", "契約社員", "業務委託", "アルバイト", "インターン", "その他"]);
  function safeSalary(v: unknown): number | null {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100000) return null;
    return Math.floor(v);
  }

  const hasCompanyId = !!body.company_id;
  const hasCompanyText = !!body.company_text;
  const hasCompanyAnon = !!body.company_anonymized;
  if ([hasCompanyId, hasCompanyText, hasCompanyAnon].filter(Boolean).length !== 1) {
    return NextResponse.json(
      { error: "Exactly one of company_id / company_text / company_anonymized required" },
      { status: 400 }
    );
  }

  if (!body.role_category_id || !body.started_at) {
    return NextResponse.json({ error: "role_category_id and started_at required" }, { status: 400 });
  }

  const roleId = UUID_RE.test(body.role_category_id as string) ? (body.role_category_id as string) : null;
  if (!roleId) {
    return NextResponse.json({ error: "Invalid role_category_id" }, { status: 400 });
  }

  const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!DATE_RE.test(body.started_at as string)) {
    return NextResponse.json({ error: "started_at は YYYY-MM 形式で入力してください" }, { status: 400 });
  }
  if (body.ended_at && !DATE_RE.test(body.ended_at as string)) {
    return NextResponse.json({ error: "ended_at は YYYY-MM 形式で入力してください" }, { status: 400 });
  }
  if (hasCompanyId && !UUID_RE.test(body.company_id as string)) {
    return NextResponse.json({ error: "Invalid company_id" }, { status: 400 });
  }

  // ow_users.id を解決して所有者フィルターに使う
  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  function s(v: unknown, max: number): string | null {
    return typeof v === "string" ? v.slice(0, max) || null : null;
  }

  const { data: updated, error } = await supabase
    .from("ow_experiences")
    .update({
      company_id: hasCompanyId ? (body.company_id as string) : null,
      company_text: hasCompanyText ? s(body.company_text, 200) : null,
      company_anonymized: hasCompanyAnon ? s(body.company_anonymized, 200) : null,
      role_category_id: roleId,
      role_title: s(body.role_title, 100),
      department: s(body.department, 100),
      rank: s(body.rank, 100),
      salary_base: safeSalary(body.salary_base),
      salary_bonus: safeSalary(body.salary_bonus),
      salary_stock: safeSalary(body.salary_stock),
      started_at: `${body.started_at}-01`,
      ended_at: body.ended_at ? `${body.ended_at}-01` : null,
      is_current: (body.is_current as boolean | undefined) ?? false,
      description: s(body.description, 5000),
      join_reason: s(body.join_reason, 2000),
      employment_type: VALID_EMPLOYMENT.has(body.employment_type as string) ? body.employment_type : null,
      salary_man: safeSalary(body.salary_man),
      visibility_company: VALID_VISIBILITY.has(body.visibility_company as string) ? body.visibility_company : "real",
      visibility_company_profile: VALID_VISIBILITY.has(body.visibility_company_profile as string) ? body.visibility_company_profile : "real",
      visibility_salary: (body.visibility_salary as boolean | undefined) ?? false,
      visibility_reason: (body.visibility_reason as boolean | undefined) ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("user_id", owUser.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[PUT /api/jobseeker/experiences/:id]", error.message);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

// DELETE /api/jobseeker/experiences/[id] — 職歴削除（RLS + 明示的な所有者チェック）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await supabase
    .from("ow_experiences")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUser.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/experiences/:id]", error.message);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
