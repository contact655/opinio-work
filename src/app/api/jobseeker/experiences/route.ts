import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveOwUserId(
  supabase: ReturnType<typeof createClient>,
  authUid: string
): Promise<string | null> {
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  return data?.id ?? null;
}

// GET /api/jobseeker/experiences — 自分の職歴一覧を返す
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ experiences: [] });

  const { data: rows, error: rowsErr } = await supabase
    .from("ow_experiences")
    /* ⚠️ 年収4列（salary_base / salary_bonus / salary_stock / salary_man）は SELECT しない。
          2026-08-06 に authenticated から SELECT 権限を剥奪したので、含めると
          permission denied で職歴一覧が丸ごと空になる。入力UIも既に無い。 */
    .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, department, rank, started_at, ended_at, is_current, description, join_reason, employment_type, display_order, visibility_company, visibility_company_profile, visibility_salary, visibility_reason")
    .eq("user_id", owUserId)
    .order("is_current", { ascending: false })
    .order("started_at", { ascending: false });

  if (rowsErr) {
    console.error("[GET /api/jobseeker/experiences]", rowsErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Resolve company names for master entries
  const companyIds = (rows ?? [])
    .filter((r) => r.company_id)
    .map((r) => r.company_id as string);
  const companyNameMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("ow_companies")
      .select("id, name")
      .in("id", companyIds);
    for (const c of companies ?? []) {
      companyNameMap.set(c.id as string, c.name as string);
    }
  }

  const experiences = (rows ?? []).map((r) => {
    let companyType: "master" | "custom" | "anon";
    let displayCompanyName: string;
    if (r.company_id) {
      companyType = "master";
      displayCompanyName = companyNameMap.get(r.company_id as string) ?? "不明な企業";
    } else if (r.company_text) {
      companyType = "custom";
      displayCompanyName = r.company_text as string;
    } else {
      companyType = "anon";
      displayCompanyName = (r.company_anonymized as string) ?? "非公開企業";
    }

    const roleUuid = r.role_category_id as string;
    return {
      id: r.id as string,
      companyType,
      companyId: r.company_id as string | undefined || undefined,
      companyText: r.company_text as string | undefined || undefined,
      companyAnonymized: r.company_anonymized as string | undefined || undefined,
      displayCompanyName,
      roleCategoryId: roleUuid,
      roleTitle: r.role_title as string | undefined || undefined,
      department: (r.department as string | null) ?? undefined,
      rank: (r.rank as string | null) ?? null,
      /* 年収は返さない（SELECT していない）。入力UIも権限も無い */
      startedAt: (r.started_at as string).slice(0, 7),
      endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
      isCurrent: r.is_current as boolean,
      description: r.description as string | undefined || undefined,
      joinReason: r.join_reason as string | undefined || undefined,
      employmentType: r.employment_type as string | undefined || undefined,
      displayOrder: (r.display_order as number) ?? 0,
      visibilityCompany: (r.visibility_company as "real" | "masked" | "hidden" | undefined) ?? "real",
      visibilityCompanyProfile: (r.visibility_company_profile as "real" | "masked" | "hidden" | undefined) ?? "real",
      visibilitySalary: (r.visibility_salary as boolean | undefined) ?? false,
      visibilityReason: (r.visibility_reason as boolean | undefined) ?? true,
    };
  });

  return NextResponse.json({ experiences });
}

// POST /api/jobseeker/experiences — 職歴追加
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const VALID_VISIBILITY = new Set(["real", "masked", "hidden"]);
  const VALID_EMPLOYMENT = new Set(["正社員", "契約社員", "業務委託", "アルバイト", "インターン", "その他"]);
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

  const companyText = hasCompanyText ? String(body.company_text).slice(0, 200) : null;
  const companyAnon = hasCompanyAnon ? String(body.company_anonymized).slice(0, 200) : null;
  const roleTitle  = typeof body.role_title  === "string" ? body.role_title.slice(0, 100)  : null;
  const department = typeof body.department  === "string" ? body.department.slice(0, 100)  : null;
  const description = typeof body.description === "string" ? body.description.slice(0, 5000) : null;
  const joinReason  = typeof body.join_reason  === "string" ? body.join_reason.slice(0, 5000)  : null;

  const { data: inserted, error } = await supabase
    .from("ow_experiences")
    .insert({
      user_id: owUserId,
      company_id: hasCompanyId ? (body.company_id as string) : null,
      company_text: companyText,
      company_anonymized: companyAnon,
      role_category_id: roleId,
      role_title: roleTitle,
      department,
      rank: typeof body.rank === "string" ? body.rank.slice(0, 50) : null,
      started_at: `${body.started_at}-01`,
      ended_at: body.ended_at ? `${body.ended_at}-01` : null,
      is_current: (body.is_current as boolean | undefined) ?? false,
      description,
      join_reason: joinReason,
      employment_type: VALID_EMPLOYMENT.has(body.employment_type as string) ? (body.employment_type as string) : null,
      display_order: (body.display_order as number | undefined) ?? 0,
      /* ⚠️ 年収は新規作成時も書かない。入力UIが無いので常に null になるが、
            「送られてきたら書く」形を残すと、権限を剥奪した意図と食い違う */
      visibility_company: VALID_VISIBILITY.has(body.visibility_company as string) ? (body.visibility_company as string) : "real",
      visibility_company_profile: VALID_VISIBILITY.has(body.visibility_company_profile as string) ? (body.visibility_company_profile as string) : "real",
      visibility_salary: (body.visibility_salary as boolean | undefined) ?? false,
      visibility_reason: (body.visibility_reason as boolean | undefined) ?? true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[POST /api/jobseeker/experiences]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id as string }, { status: 201 });
}
