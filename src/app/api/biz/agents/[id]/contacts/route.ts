import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

// POST /api/biz/agents/[id]/contacts — add contact
// Body: { name, email, isPrimary? }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  let body: { name: string; email: string; isPrimary?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!name || name.length > 100) return NextResponse.json({ error: "担当者名は1〜100字で入力してください" }, { status: 400 });
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });

  const admin = createAdminClient();

  // Verify agency belongs to company
  const { data: agency } = await admin
    .from("ow_agent_agencies")
    .select("id")
    .eq("id", params.id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await admin
    .from("ow_agent_contacts")
    .insert({
      agency_id: params.id,
      name,
      email,
      is_primary: body.isPrimary ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 201 });
}

// DELETE /api/biz/agents/[id]/contacts — remove contact
// Body: { contactId }
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  let body: { contactId: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 });

  const admin = createAdminClient();

  // Verify agency belongs to company
  const { data: agency } = await admin
    .from("ow_agent_agencies")
    .select("id")
    .eq("id", params.id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await admin
    .from("ow_agent_contacts")
    .delete()
    .eq("id", body.contactId)
    .eq("agency_id", params.id);

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
