import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mutateOne, mutateMany } from "@/lib/supabase/mutate";
import { getTenantContext } from "@/lib/business/dashboard";
import { validateMove, type OrgNodeLike } from "@/lib/business/orgTree";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  /* ★書き込みは管理者だけ（2026-09-22）。DB の RLS（auth_is_company_admin）も同じ条件で、
        それまではメンバーが押すと RLS の英語のエラーがそのまま画面に出ていた。
        ⚠️ ここで先に日本語の 403 を返す。RLS は外さない（二重に守る） */
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "部門・職種の編集は管理者だけができます" }, { status: 403 });
  }

  const body = await req.json();
  const patch: { name?: string; display_order?: number; parent_id?: string | null } = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.display_order !== undefined) patch.display_order = Number(body.display_order);

  const supabase = createClient();

  /* ★親の付け替え（2026-09-20）。⚠️★**判定を `validateMove` の外に書かないこと。**
        循環と深さの両方が要る（職種の PATCH と同じ関数を通している）。
     ⚠️ `parent_id` を**送ってこなければ触らない**（名前だけ直す PATCH を壊さない）。 */
  if (body.parent_id !== undefined) {
    const newParentId = typeof body.parent_id === "string" && body.parent_id ? body.parent_id : null;
    const { data: rows, error: treeErr } = await supabase
      .from("ow_company_departments")
      .select("id, parent_id")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null);
    if (treeErr) {
      console.error("[PATCH /api/biz/departments/[id]] tree", treeErr.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    const reason = validateMove(params.id, newParentId, (rows ?? []) as OrgNodeLike[], "部門");
    if (reason) return NextResponse.json({ error: reason }, { status: 400 });
    patch.parent_id = newParentId;
  }

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
  /* ★書き込みは管理者だけ（2026-09-22）。DB の RLS（auth_is_company_admin）も同じ条件で、
        それまではメンバーが押すと RLS の英語のエラーがそのまま画面に出ていた。
        ⚠️ ここで先に日本語の 403 を返す。RLS は外さない（二重に守る） */
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "部門・職種の編集は管理者だけができます" }, { status: 403 });
  }

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
