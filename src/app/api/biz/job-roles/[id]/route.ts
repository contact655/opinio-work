import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mutateMany, mutateOne } from "@/lib/supabase/mutate";
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

  /* ★★子の職種も一緒に論理削除する（2026-09-19 / 階層に変えたので必要になった）。
     ⚠️★**部門（/api/biz/departments/[id]）とまったく同じ形。** 片方だけ残すと、
        親を消したのに子が残り、**親の消えた行が画面から消えて直せなくなる**
        （`flattenTree` が孤児を拾うようにしてあるのは、この事故の保険）。
     ⚠️ DB の FK は `ON DELETE CASCADE` だが、**ここは論理削除なので効かない。**
        行を物理削除していないので、自分で辿る必要がある。 */
  const { data: allRoles, error: treeErr } = await supabase
    .from("ow_company_job_roles")
    .select("id, parent_id")
    .eq("company_id", ctx.tenantId)
    .is("deleted_at", null);
  if (treeErr) {
    console.error("[DELETE /api/biz/job-roles/[id]] tree", treeErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const toDelete: string[] = [];
  const seen = new Set<string>();
  function collect(id: string) {
    /* ⚠️ 壊れたデータ（循環）で返らなくならないように、1度見た id は辿らない。 */
    if (seen.has(id)) return;
    seen.add(id);
    toDelete.push(id);
    (allRoles ?? []).filter((r) => r.parent_id === id).forEach((c) => collect(c.id as string));
  }
  collect(params.id);

  /* ⚠️ 1件以上（本体は必ず消える）。0件はエラー＝対象が無いか RLS 拒否 */
  const res = await mutateMany(
    supabase.from("ow_company_job_roles").update({ deleted_at: new Date().toISOString() })
      .in("id", toDelete).eq("company_id", ctx.tenantId),
    "job-roles DELETE",
  );
  const error = res.ok ? null : { message: res.error };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
