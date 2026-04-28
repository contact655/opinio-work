import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/profile — 求職者プロフィール基本情報の更新
export async function PUT(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 許可フィールドのみ（auth_id, id 等は変更不可）
  const allowed = ["name", "avatar_color", "cover_color", "about_me", "age_range", "location", "social_links", "visibility"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("ow_users")
    .update(patch)
    .eq("auth_id", user.id);

  if (error) {
    console.error("[PUT /api/jobseeker/profile]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
