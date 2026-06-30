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
  const allowed = ["name", "avatar_color", "cover_color", "about_me", "birth_date", "location", "future_aspirations", "social_links", "visibility", "strengths_finder", "is_open_to_work", "profile_setup_at"];
  const TEXT_LIMITS: Record<string, number> = { name: 100, about_me: 2000, future_aspirations: 2000, location: 100 };
  const VALID_VISIBILITY = new Set(["public", "login_only", "private"]);
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in body)) continue;
    const val = body[key];
    if (key === "visibility") {
      if (typeof val !== "string" || !VALID_VISIBILITY.has(val)) continue;
    }
    if (key === "social_links") {
      if (JSON.stringify(val).length > 2000) {
        return NextResponse.json({ error: "social_links が大きすぎます" }, { status: 400 });
      }
    }
    if (key === "birth_date") {
      if (typeof val === "string" && val.length > 20) continue;
    }
    const limit = TEXT_LIMITS[key];
    if (limit && typeof val === "string" && val.length > limit) {
      return NextResponse.json({ error: `${key} は${limit}字以内で入力してください` }, { status: 400 });
    }
    patch[key] = val;
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
