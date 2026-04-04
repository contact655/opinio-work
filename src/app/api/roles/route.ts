import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET: ユーザーのロール一覧を取得
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ roles: [], profile: null, companies: [] }, { status: 401 });
  }

  const [rolesResult, profileResult, companiesResult] = await Promise.all([
    supabase.from("ow_user_roles").select("role").eq("user_id", user.id),
    supabase.from("ow_profiles").select("id, name").eq("user_id", user.id).maybeSingle(),
    supabase.from("ow_companies").select("id, name, status").eq("user_id", user.id),
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

  const { error } = await supabase
    .from("ow_user_roles")
    .upsert(
      { user_id: user.id, role },
      { onConflict: "user_id,role" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
