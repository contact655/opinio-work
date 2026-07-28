import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/business/dashboard";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const patch: { name?: string; display_order?: number } = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.display_order !== undefined) patch.display_order = Number(body.display_order);

  const supabase = createClient();
  const { error } = await supabase
    .from("ow_company_departments")
    .update(patch)
    .eq("id", params.id)
    .eq("company_id", ctx.tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  // 子部門も含めて論理削除（deleted_at をセット）
  const { data: allDepts } = await supabase
    .from("ow_company_departments")
    .select("id, parent_id")
    .eq("company_id", ctx.tenantId)
    .is("deleted_at", null);

  const toDelete: string[] = [];
  function collect(id: string) {
    toDelete.push(id);
    (allDepts ?? []).filter((d) => d.parent_id === id).forEach((c) => collect(c.id));
  }
  collect(params.id);

  const { error } = await supabase
    .from("ow_company_departments")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", toDelete)
    .eq("company_id", ctx.tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
