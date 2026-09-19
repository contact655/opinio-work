import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { MAX_ORG_DEPTH, wouldExceedDepth, type OrgNodeLike } from "@/lib/business/orgTree";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_company_departments")
    .select("id, parent_id, name, display_order")
    .eq("company_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ departments: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, parent_id, display_order } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "部門名を入力してください" }, { status: 400 });

  const supabase = createClient();

  /* ★深さの判定（2026-09-19 に 2階層 → MAX_ORG_DEPTH 階層へ）。
     ⚠️★**規則は `lib/business/orgTree.ts` の1箇所。** 職種側（/api/biz/job-roles）も
        同じ関数を通す。ここに数字や判定を書き写さないこと。
     ⚠️ 以前は「親の親が居たら400」という**2階層専用の書き方**だった。
        深さが変わるたびに書き直す形なので、木を辿る形に替えてある。
     ⚠️★**同じ会社の行だけを渡す。** 他社の行を混ぜると、他社の木の深さで
        判定してしまう（`company_id` の絞り込みを外さないこと）。 */
  if (parent_id) {
    const { data: all, error: treeErr } = await supabase
      .from("ow_company_departments")
      .select("id, parent_id")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null);
    if (treeErr) {
      console.error("[POST /api/biz/departments] tree", treeErr.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    const byId = new Map<string, OrgNodeLike>((all ?? []).map((d) => [d.id as string, d as OrgNodeLike]));
    if (!byId.has(parent_id)) {
      return NextResponse.json({ error: "親の部門が見つかりません" }, { status: 400 });
    }
    if (wouldExceedDepth(parent_id, byId)) {
      return NextResponse.json(
        { error: `部門は${MAX_ORG_DEPTH}階層までしか作成できません` },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("ow_company_departments")
    .insert({
      company_id: ctx.tenantId,
      name: name.trim(),
      parent_id: parent_id ?? null,
      display_order: display_order ?? 0,
    })
    .select("id, parent_id, name, display_order")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同じ部門名がすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ department: data });
}
