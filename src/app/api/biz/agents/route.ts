import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";

// GET /api/biz/agents — list agencies for company
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  const { fetchAgenciesForCompany } = await import("@/lib/business/agents");
  const agencies = await fetchAgenciesForCompany(ctx.companyId);
  return NextResponse.json({ agencies });
}

// POST /api/biz/agents — create agency
// Body: { agencyName, memo? }
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  let body: { agencyName: string; memo?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.agencyName?.trim()) {
    return NextResponse.json({ error: "エージェント会社名は必須です" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_agent_agencies")
    .insert({
      company_id: ctx.companyId,
      agency_name: body.agencyName.trim(),
      memo: body.memo?.trim() || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agency: data }, { status: 201 });
}
