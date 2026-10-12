import { can } from "@/lib/auth/roles";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mutateMany, mutateOne } from "@/lib/supabase/mutate";
import { getTenantContext } from "@/lib/business/dashboard";
import { validateMove, type OrgNodeLike } from "@/lib/business/orgTree";
import { lookupStandardRole } from "@/lib/business/standardRole";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  /* ★書き込みは管理者だけ（2026-09-22）。DB の RLS（auth_company_can(…, 'admin')）も同じ条件で、
        それまではメンバーが押すと RLS の英語のエラーがそのまま画面に出ていた。
        ⚠️ ここで先に日本語の 403 を返す。RLS は外さない（二重に守る） */
  if (!can(ctx.currentPermission, "organization.manage")) {
    return NextResponse.json({ error: "部門・職種の編集は管理者だけができます" }, { status: 403 });
  }

  const body = await req.json();
  const patch: { name?: string; standard_role_id?: string | null; display_order?: number; parent_id?: string | null } = {};
  /* ★標準の職種は外せない（2026-10-12）。選ぶ・選び直すだけ。
        ⚠️ 名前だけ・並べ替えだけの PATCH は standard_role_id を送らないので、未選択の古い行も動かせる */
  let standardName: string | null = null;
  if (body.standard_role_id !== undefined) {
    const standard = await lookupStandardRole(body.standard_role_id);
    if (!standard) return NextResponse.json({ error: "標準の職種を選んでください" }, { status: 400 });
    patch.standard_role_id = standard.id;
    standardName = standard.name;
  }
  if (body.name !== undefined) {
    const typed = String(body.name).trim();
    /* 呼び方を空にしたら標準の職種名で表示する。標準の職種が分からないときは空で上書きしない */
    if (typed) patch.name = typed;
    else if (standardName) patch.name = standardName;
    else return NextResponse.json({ error: "職種名を入力してください" }, { status: 400 });
  }
  if (body.display_order !== undefined) patch.display_order = Number(body.display_order);

  const supabase = createClient();

  /* ★親の付け替え（2026-09-20）。⚠️★**部門（/api/biz/departments/[id]）と同じ関数**
        （`validateMove`）を通す。片方だけ条件を足さないこと。
     ⚠️ ここで動かすのは**自社職種の親子**。`standard_role_id`（OPINIO のマスタ）とは別物。 */
  if (body.parent_id !== undefined) {
    const newParentId = typeof body.parent_id === "string" && body.parent_id ? body.parent_id : null;
    const { data: rows, error: treeErr } = await supabase
      .from("ow_company_job_roles")
      .select("id, parent_id")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null);
    if (treeErr) {
      console.error("[PATCH /api/biz/job-roles/[id]] tree", treeErr.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    const reason = validateMove(params.id, newParentId, (rows ?? []) as OrgNodeLike[], "職種");
    if (reason) return NextResponse.json({ error: reason }, { status: 400 });
    patch.parent_id = newParentId;
  }

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
  /* ★書き込みは管理者だけ（2026-09-22）。DB の RLS（auth_company_can(…, 'admin')）も同じ条件で、
        それまではメンバーが押すと RLS の英語のエラーがそのまま画面に出ていた。
        ⚠️ ここで先に日本語の 403 を返す。RLS は外さない（二重に守る） */
  if (!can(ctx.currentPermission, "organization.manage")) {
    return NextResponse.json({ error: "部門・職種の編集は管理者だけができます" }, { status: 403 });
  }

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
