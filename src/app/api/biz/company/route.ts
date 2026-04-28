import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { transformFormToDb, getCompanyContext } from "@/lib/business/company";
import { insertActivity } from "@/lib/business/activities";
import type { BizCompany } from "@/lib/business/mockCompany";

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

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  const { companyId, owUserId } = ctx;

  const record = transformFormToDb(body as BizCompany);

  const { error } = await supabase
    .from("ow_companies")
    .update(record)
    .eq("id", companyId);

  if (error) {
    console.error("[company PUT]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await insertActivity(supabase, {
    company_id: companyId,
    actor_user_id: owUserId,
    type: "company_info_updated",
    description: "企業情報を更新しました",
    target_type: "company",
    target_id: companyId,
  });

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

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  const { companyId } = ctx;

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
