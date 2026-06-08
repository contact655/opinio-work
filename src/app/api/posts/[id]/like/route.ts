import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/posts/[id]/like — いいねトグル（追加 or 削除）
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 既存いいねを確認
  const { data: existing } = await supabase
    .from("ow_post_likes")
    .select("id")
    .eq("post_id", params.id)
    .eq("user_id", owUser.id)
    .maybeSingle();

  if (existing) {
    // 既にいいね済み → 解除
    await supabase.from("ow_post_likes").delete().eq("id", existing.id);
    return NextResponse.json({ liked: false });
  } else {
    // 未いいね → 追加
    await supabase.from("ow_post_likes").insert({ post_id: params.id, user_id: owUser.id });
    return NextResponse.json({ liked: true });
  }
}
