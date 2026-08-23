import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mutateOne, mutateMany, mutateAllowNone } from "@/lib/supabase/mutate";
import { getTenantContext } from "@/lib/business/dashboard";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const patch: { name?: string; display_order?: number } = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.display_order !== undefined) patch.display_order = Number(body.display_order);

  const supabase = createClient();
  const res = await mutateOne(
    supabase.from("ow_company_departments").update(patch)
      .eq("id", params.id).eq("company_id", ctx.tenantId),
    "departments PUT",
  );
  const error = res.ok ? null : { message: res.error };

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

  /* ⚠️ 複数件をまとめて論理削除する。0件はエラー（対象が無いか RLS 拒否） */
  const res = await mutateMany(
    supabase.from("ow_company_departments").update({ deleted_at: new Date().toISOString() })
      .in("id", toDelete).eq("company_id", ctx.tenantId),
    "departments DELETE",
  );
  const error = res.ok ? null : { message: res.error };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
