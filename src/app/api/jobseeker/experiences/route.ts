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
    .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, department, rank, started_at, ended_at, is_current, description, join_reason, employment_type, display_order, salary_man, visibility_company, visibility_company_profile, visibility_salary, visibility_reason")
    .eq("user_id", owUserId)
    .order("is_current", { ascending: false })
    .order("started_at", { ascending: false });

  if (rowsErr) {
    console.error("[GET /api/jobseeker/experiences]", rowsErr.message);
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
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
      startedAt: (r.started_at as string).slice(0, 7),
      endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
      isCurrent: r.is_current as boolean,
      description: r.description as string | undefined || undefined,
      joinReason: r.join_reason as string | undefined || undefined,
      employmentType: r.employment_type as string | undefined || undefined,
      displayOrder: (r.display_order as number) ?? 0,
      salaryMan: r.salary_man as number | null ?? null,
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
    return NextResponse.json({ error: `Unknown role: ${body.role_category_id}` }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("ow_experiences")
    .insert({
      user_id: owUserId,
      company_id: hasCompanyId ? (body.company_id as string) : null,
      company_text: hasCompanyText ? (body.company_text as string) : null,
      company_anonymized: hasCompanyAnon ? (body.company_anonymized as string) : null,
      role_category_id: roleId,
      role_title: (body.role_title as string | undefined) ?? null,
      department: (body.department as string | undefined) ?? null,
      rank: (body.rank as string | undefined) ?? null,
      started_at: `${body.started_at}-01`,
      ended_at: body.ended_at ? `${body.ended_at}-01` : null,
      is_current: (body.is_current as boolean | undefined) ?? false,
      description: (body.description as string | undefined) ?? null,
      join_reason: (body.join_reason as string | undefined) ?? null,
      employment_type: (body.employment_type as string | undefined) ?? null,
      display_order: (body.display_order as number | undefined) ?? 0,
      salary_man: (body.salary_man as number | undefined) ?? null,
      visibility_company: (body.visibility_company as string | undefined) ?? "real",
      visibility_company_profile: (body.visibility_company_profile as string | undefined) ?? "real",
      visibility_salary: (body.visibility_salary as boolean | undefined) ?? false,
      visibility_reason: (body.visibility_reason as boolean | undefined) ?? true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[POST /api/jobseeker/experiences]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id as string }, { status: 201 });
}
