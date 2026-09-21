import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_ORG_DEPTH, wouldExceedDepth, type OrgNodeLike } from "@/lib/business/orgTree";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  /* ★admin クライアントで読む（2026-09-22）。`ow_company_job_roles` の RLS は管理者しか通さないので、
        セッションで読むと**メンバーの求人フォームで候補が0件**になっていた。
        ⚠️ この会社に属していることは `getTenantContext` で確かめてある。`company_id` の絞り込みを外さないこと */
  const db = createAdminClient();
  const [{ data, error }, links] = await Promise.all([
    db
      .from("ow_company_job_roles")
      .select("id, parent_id, name, standard_role_id, display_order")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    /* ★所属する部門（2026-09-22）。求人フォームで、選んだ部門の職種を先に出すのに使う */
    db
      .from("ow_company_job_role_departments")
      .select("job_role_id, department_id")
      .eq("company_id", ctx.tenantId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  /* ⚠️ 紐付けが読めなくても職種の一覧は返す（候補の並びが変わらないだけ）。ログは出す */
  if (links.error) console.error("[GET /api/biz/job-roles] links", links.error.message);
  const byRole = new Map<string, string[]>();
  for (const l of links.data ?? []) byRole.set(l.job_role_id, [...(byRole.get(l.job_role_id) ?? []), l.department_id]);
  return NextResponse.json({
    jobRoles: (data ?? []).map((r) => ({ ...r, departmentIds: byRole.get(r.id) ?? [] })),
  });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  /* ★書き込みは管理者だけ（2026-09-22）。DB の RLS（auth_is_company_admin）も同じ条件で、
        それまではメンバーが押すと RLS の英語のエラーがそのまま画面に出ていた。
        ⚠️ ここで先に日本語の 403 を返す。RLS は外さない（二重に守る） */
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "部門・職種の編集は管理者だけができます" }, { status: 403 });
  }

  const { name, parent_id, standard_role_id, display_order } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "職種名を入力してください" }, { status: 400 });

  const supabase = createClient();

  /* ★職種も入れ子にできるようにした（2026-09-19 / 柴さんの指示）。
     ⚠️★**深さの規則は部門とまったく同じ**（`lib/business/orgTree.ts`）。
        人事担当者は部門から作る人も職種から作る人もいるので、
        **片方だけ深さや挙動が違う状態を作らない。**
     ⚠️★**同じ会社の行だけを渡す**（他社の木で判定しないため）。 */
  if (parent_id) {
    const { data: all, error: treeErr } = await supabase
      .from("ow_company_job_roles")
      .select("id, parent_id")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null);
    if (treeErr) {
      console.error("[POST /api/biz/job-roles] tree", treeErr.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    const byId = new Map<string, OrgNodeLike>((all ?? []).map((r) => [r.id as string, r as OrgNodeLike]));
    if (!byId.has(parent_id)) {
      return NextResponse.json({ error: "親の職種が見つかりません" }, { status: 400 });
    }
    if (wouldExceedDepth(parent_id, byId)) {
      return NextResponse.json(
        { error: `職種は${MAX_ORG_DEPTH}階層までしか作成できません` },
        { status: 400 },
      );
    }
  }
  const { data, error } = await supabase
    .from("ow_company_job_roles")
    .insert({
      company_id: ctx.tenantId,
      name: name.trim(),
      parent_id: parent_id ?? null,
      standard_role_id: standard_role_id ?? null,
      display_order: display_order ?? 0,
    })
    .select("id, parent_id, name, standard_role_id, display_order")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同じ職種名がすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ jobRole: data });
}
