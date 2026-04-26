import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { transformFormToDb } from "@/lib/business/company";
import type { BizCompany } from "@/lib/business/mockCompany";

async function getCompanyId(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  // Primary: ow_user_roles.tenant_id（migration 035 でバックフィル済み）
  const { data: roleRow } = await supabase
    .from("ow_user_roles")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "company")
    .not("tenant_id", "is", null)
    .maybeSingle();
  if (roleRow?.tenant_id) return roleRow.tenant_id;

  // フォールバック: ow_companies.user_id（多行返却に対応するため .limit(1)）
  const { data: companies } = await supabase
    .from("ow_companies")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  return companies?.[0]?.id ?? null;
}

// PUT /api/biz/company — 全フィールド更新（自動保存トリガー）
export async function PUT(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<BizCompany>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = await getCompanyId(supabase, user.id);
  if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const record = transformFormToDb(body as BizCompany);

  const { error } = await supabase
    .from("ow_companies")
    .update(record)
    .eq("id", companyId);

  if (error) {
    console.error("[company PUT]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH /api/biz/company — is_published トグル（公開/非公開）
export async function PATCH(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { isPublished: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = await getCompanyId(supabase, user.id);
  if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ow_companies")
    .update({
      is_published: body.isPublished,
      published_at: body.isPublished ? now : undefined,
      updated_at: now,
    })
    .eq("id", companyId);

  if (error) {
    console.error("[company PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, publishedAt: body.isPublished ? now : null });
}
