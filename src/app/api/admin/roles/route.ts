import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // auth_is_admin RPC — ow_user_roles.role='admin' で判定
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return null;
  return user;
}

// GET: 職種一覧 + エイリアス数
export async function GET() {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  /*
    ⚠️ 105件を1行ずつ問い合わせない（N+1）。参照側を全件1回ずつ引いて、
       メモリ上で集計する。行数はいずれも数十件規模なので取り切って問題ない。
    ⚠️ 求人は ow_jobs.role_category_id と ow_job_roles.role_id の両方に入っている。
       同じ求人を2回数えないよう、job_id の集合で重複を除いてから数えること。
  */
  const [rolesRes, aliasesRes, mergedRes, expRes, jobsRes, jobRolesRes] = await Promise.all([
    admin.from("ow_roles").select("id, name, slug, parent_id, level, is_active, is_it_saas, merged_into_id").order("level").order("name"),
    admin.from("ow_role_aliases").select("role_id"),
    admin.from("ow_roles").select("id, name").eq("is_active", true),
    admin.from("ow_experiences").select("id, role_category_id").not("role_category_id", "is", null),
    admin.from("ow_jobs").select("id, role_category_id").not("role_category_id", "is", null),
    admin.from("ow_job_roles").select("job_id, role_id"),
  ]);

  for (const [label, res] of [
    ["ow_roles", rolesRes], ["ow_role_aliases", aliasesRes],
    ["ow_experiences", expRes], ["ow_jobs", jobsRes], ["ow_job_roles", jobRolesRes],
  ] as const) {
    if (res.error) console.error(`[admin/roles GET] ${label}`, res.error.message);
  }

  const roles = rolesRes.data ?? [];
  const aliases = aliasesRes.data ?? [];
  const allRoles = mergedRes.data ?? [];

  // 職歴の使用数
  const expCountMap = new Map<string, number>();
  for (const e of expRes.data ?? []) {
    const rid = e.role_category_id as string;
    expCountMap.set(rid, (expCountMap.get(rid) ?? 0) + 1);
  }

  // 求人の使用数。⚠️ job_id の集合を持って重複を除く
  const jobSetMap = new Map<string, Set<string>>();
  const addJob = (roleId: string | null, jobId: string) => {
    if (!roleId) return;
    if (!jobSetMap.has(roleId)) jobSetMap.set(roleId, new Set());
    jobSetMap.get(roleId)!.add(jobId);
  };
  for (const j of jobsRes.data ?? []) addJob(j.role_category_id as string | null, j.id as string);
  for (const jr of jobRolesRes.data ?? []) addJob(jr.role_id as string | null, jr.job_id as string);

  // エイリアス数を集計
  const aliasCountMap = new Map<string, number>();
  for (const a of aliases) {
    aliasCountMap.set(a.role_id as string, (aliasCountMap.get(a.role_id as string) ?? 0) + 1);
  }

  // 統合先名を解決
  const roleNameMap = new Map(allRoles.map((r) => [r.id as string, r.name as string]));

  const enriched = roles.map((r) => ({
    ...r,
    alias_count: aliasCountMap.get(r.id as string) ?? 0,
    merged_into_name: r.merged_into_id ? (roleNameMap.get(r.merged_into_id as string) ?? null) : null,
    experience_count: expCountMap.get(r.id as string) ?? 0,
    job_count: jobSetMap.get(r.id as string)?.size ?? 0,
  }));

  return NextResponse.json({ roles: enriched });
}

// PATCH: 論理削除 or 統合
export async function PATCH(req: Request) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const roleId = body.roleId as string;
  const action = body.action as string;
  if (!roleId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = createAdminClient();

  if (action === "toggle_active") {
    const newValue = body.value as boolean;
    const { error } = await admin.from("ow_roles").update({ is_active: newValue }).eq("id", roleId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "merge") {
    const mergeIntoId = body.mergeIntoId as string;
    if (!mergeIntoId) return NextResponse.json({ error: "mergeIntoId required" }, { status: 400 });

    /*
      ⚠️ ここで ow_roles を直接 UPDATE しないこと（2026-08-06 に RPC へ移した）。
         それまでは merged_into_id と is_active=false を立てるだけで、
         ow_experiences / ow_jobs / ow_job_roles などの**参照を一切触っていなかった**。
         統合された職種を指したままの行が残り、無効な職種が表示され続ける。
      ⚠️ 付け替えは1トランザクションでなければならない。途中で失敗すると
         一部だけ移った状態になり、どこまで進んだか後から分からなくなる。
         そのため Postgres 関数（merge_role）に寄せている。
      ⚠️ merge_role は service_role にしか EXECUTE を与えていない。
         createAdminClient() から呼ぶこと。
    */
    const { data, error } = await admin.rpc("merge_role", {
      from_role_id: roleId,
      to_role_id: mergeIntoId,
    });
    if (error) {
      console.error("[admin/roles merge]", error.message);
      // 子職種がある / 統合先が無効 などは関数側が日本語で理由を返す
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
