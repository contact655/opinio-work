import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/posts — 投稿作成
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = (body.content ?? "").trim();
  if (!content || content.length > 1000) {
    return NextResponse.json({ error: "本文は1〜1000文字で入力してください" }, { status: 400 });
  }

  // auth_id → ow_users.id
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("ow_posts")
    .insert({ user_id: owUser.id, content, image_url: body.image_url ?? null })
    .select("id, content, image_url, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
