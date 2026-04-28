import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Experience } from "@/app/(jobseeker)/profile/edit/mockProfileData";

export const dynamic = "force-dynamic";

// ow_roles.name (DB) → slug (client)
const DB_NAME_TO_SLUG: Record<string, string> = {
  "営業": "sales", "PdM / PM": "pm", "カスタマーサクセス": "cs",
  "エンジニア": "engineer", "マーケティング": "marketing", "経営・CxO": "exec", "その他": "other",
  "フィールドセールス": "field_sales", "エンタープライズ営業": "enterprise_sales",
  "インサイドセールス": "inside_sales", "SDR / BDR": "sdr_bdr",
  "プロダクトマネージャー": "product_manager", "プロダクトオーナー": "product_owner", "PMM": "pmm",
  "バックエンド": "backend", "フロントエンド": "frontend", "フルスタック": "fullstack",
  "SRE / インフラ": "sre", "iOS / Android": "ios_android",
  "CEO": "ceo", "COO": "coo", "CPO": "cpo", "CTO": "cto", "CFO": "cfo",
  "デザイナー": "designer", "事業開発": "biz_dev", "HRBP": "hrbp",
  "コーポレート": "corporate", "データサイエンティスト": "data_scientist",
};

// slug (client) → ow_roles.name (DB)
const SLUG_TO_DB_NAME: Record<string, string> = {
  sales: "営業", pm: "PdM / PM", cs: "カスタマーサクセス",
  engineer: "エンジニア", marketing: "マーケティング", exec: "経営・CxO", other: "その他",
  field_sales: "フィールドセールス", enterprise_sales: "エンタープライズ営業",
  inside_sales: "インサイドセールス", sdr_bdr: "SDR / BDR",
  product_manager: "プロダクトマネージャー", product_owner: "プロダクトオーナー", pmm: "PMM",
  backend: "バックエンド", frontend: "フロントエンド", fullstack: "フルスタック",
  sre: "SRE / インフラ", ios_android: "iOS / Android",
  ceo: "CEO", coo: "COO", cpo: "CPO", cto: "CTO", cfo: "CFO",
  designer: "デザイナー", biz_dev: "事業開発", hrbp: "HRBP",
  corporate: "コーポレート", data_scientist: "データサイエンティスト",
  // CS/Marketing children not seeded as rows → map to parent
  customer_success: "カスタマーサクセス", customer_support: "カスタマーサクセス",
  digital_mkt: "マーケティング", content_mkt: "マーケティング", event_mkt: "マーケティング",
};

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

async function resolveRoleId(
  supabase: ReturnType<typeof createClient>,
  slugOrUuid: string
): Promise<string | null> {
  if (UUID_RE.test(slugOrUuid)) return slugOrUuid;
  const dbName = SLUG_TO_DB_NAME[slugOrUuid];
  if (!dbName) return null;
  const { data } = await supabase
    .from("ow_roles")
    .select("id")
    .eq("name", dbName)
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

  const [{ data: rows, error: rowsErr }, { data: allRoles }] = await Promise.all([
    supabase
      .from("ow_experiences")
      .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description")
      .eq("user_id", owUserId)
      .order("is_current", { ascending: false })
      .order("started_at", { ascending: false }),
    supabase.from("ow_roles").select("id, name"),
  ]);

  if (rowsErr) {
    console.error("[GET /api/jobseeker/experiences]", rowsErr.message);
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  // Build UUID → slug map from DB roles
  const uuidToSlug = new Map<string, string>();
  for (const role of allRoles ?? []) {
    const slug = DB_NAME_TO_SLUG[role.name as string];
    if (slug) uuidToSlug.set(role.id as string, slug);
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

  const experiences: Experience[] = (rows ?? []).map((r) => {
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
      roleCategoryId: uuidToSlug.get(roleUuid) ?? roleUuid,
      roleTitle: r.role_title as string | undefined || undefined,
      startedAt: (r.started_at as string).slice(0, 7),
      endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
      isCurrent: r.is_current as boolean,
      description: r.description as string | undefined || undefined,
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

  const roleId = await resolveRoleId(supabase, body.role_category_id as string);
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
      started_at: `${body.started_at}-01`,
      ended_at: body.ended_at ? `${body.ended_at}-01` : null,
      is_current: (body.is_current as boolean | undefined) ?? false,
      description: (body.description as string | undefined) ?? null,
      display_order: 0,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[POST /api/jobseeker/experiences]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id as string }, { status: 201 });
}
