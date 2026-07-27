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

  const [rolesRes, aliasesRes, mergedRes] = await Promise.all([
    admin.from("ow_roles").select("id, name, slug, parent_id, level, is_active, is_it_saas, merged_into_id").order("level").order("name"),
    admin.from("ow_role_aliases").select("role_id"),
    admin.from("ow_roles").select("id, name").eq("is_active", true),
  ]);

  const roles = rolesRes.data ?? [];
  const aliases = aliasesRes.data ?? [];
  const allRoles = mergedRes.data ?? [];

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
    // merged_into_id を設定し、is_active = false に
    const { error } = await admin
      .from("ow_roles")
      .update({ merged_into_id: mergeIntoId, is_active: false })
      .eq("id", roleId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
