import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET: ユーザーのロール一覧を取得
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ roles: [], profile: null, companies: [] }, { status: 401 });
  }

  const admin = createAdminClient();

  const [rolesResult, profileResult, companiesResult] = await Promise.all([
    admin.from("ow_user_roles").select("role").eq("user_id", user.id),
    admin.from("ow_profiles").select("id, name").eq("user_id", user.id).maybeSingle(),
    admin.from("ow_companies").select("id, name, status").eq("user_id", user.id),
  ]);

  return NextResponse.json({
    roles: (rolesResult.data || []).map((r: any) => r.role),
    profile: profileResult.data,
    companies: companiesResult.data || [],
  });
}

// POST: ロールを追加
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = await req.json();
  if (!["candidate", "company"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("ow_user_roles")
    .insert({ user_id: user.id, role });

  // 重複エラー (23505) は正常扱い
  if (error && error.code !== "23505") {
    console.error("[roles POST] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
