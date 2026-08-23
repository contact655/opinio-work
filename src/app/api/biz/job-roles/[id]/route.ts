import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mutateOne, mutateMany, mutateAllowNone } from "@/lib/supabase/mutate";
import { getTenantContext } from "@/lib/business/dashboard";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const patch: { name?: string; standard_role_id?: string | null; display_order?: number } = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.standard_role_id !== undefined) patch.standard_role_id = typeof body.standard_role_id === "string" ? body.standard_role_id : null;
  if (body.display_order !== undefined) patch.display_order = Number(body.display_order);

  const supabase = createClient();
  const res = await mutateOne(
    supabase.from("ow_company_job_roles").update(patch)
      .eq("id", params.id).eq("company_id", ctx.tenantId)
      .is("deleted_at", null),
    "job-roles PUT",
  );
  const error = res.ok ? null : { message: res.error };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  const res = await mutateOne(
    supabase.from("ow_company_job_roles").update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id).eq("company_id", ctx.tenantId),
    "job-roles DELETE",
  );
  const error = res.ok ? null : { message: res.error };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
