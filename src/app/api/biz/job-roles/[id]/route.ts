import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/business/dashboard";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.standard_role_id !== undefined) patch.standard_role_id = body.standard_role_id;
  if (body.display_order !== undefined) patch.display_order = body.display_order;

  const supabase = createClient();
  const { error } = await supabase
    .from("ow_company_job_roles")
    .update(patch)
    .eq("id", params.id)
    .eq("company_id", ctx.tenantId)
    .is("deleted_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  const { error } = await supabase
    .from("ow_company_job_roles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("company_id", ctx.tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
