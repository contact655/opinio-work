import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { MAX_ORG_DEPTH, wouldExceedDepth, type OrgNodeLike } from "@/lib/business/orgTree";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_company_job_roles")
    .select("id, parent_id, name, standard_role_id, display_order")
    .eq("company_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobRoles: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
