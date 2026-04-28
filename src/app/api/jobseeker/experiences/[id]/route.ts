import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
  customer_success: "カスタマーサクセス", customer_support: "カスタマーサクセス",
  digital_mkt: "マーケティング", content_mkt: "マーケティング", event_mkt: "マーケティング",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// PUT /api/jobseeker/experiences/[id] — 職歴更新（RLS が本人チェック）
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const { error } = await supabase
    .from("ow_experiences")
    .update({
      company_id: hasCompanyId ? (body.company_id as string) : null,
      company_text: hasCompanyText ? (body.company_text as string) : null,
      company_anonymized: hasCompanyAnon ? (body.company_anonymized as string) : null,
      role_category_id: roleId,
      role_title: (body.role_title as string | undefined) ?? null,
      started_at: `${body.started_at}-01`,
      ended_at: body.ended_at ? `${body.ended_at}-01` : null,
      is_current: (body.is_current as boolean | undefined) ?? false,
      description: (body.description as string | undefined) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    console.error("[PUT /api/jobseeker/experiences/:id]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/jobseeker/experiences/[id] — 職歴削除（RLS が本人チェック）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_experiences")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/experiences/:id]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
