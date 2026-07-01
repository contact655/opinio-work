import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

async function resolveOwUserId(
  supabase: ReturnType<typeof createClient>,
  authUid: string
): Promise<string | null> {
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  return data?.id ?? null;
}

// DELETE /api/jobseeker/posts/[id] — 投稿削除（自分の投稿のみ）
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const postId = params.id;

  // 存在確認 + オーナーチェック
  const { data: post, error: fetchError } = await supabase
    .from("ow_posts")
    .select("id, user_id")
    .eq("id", postId)
    .maybeSingle();

  if (fetchError) {
    console.error("[DELETE /api/jobseeker/posts/[id]] fetch", fetchError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.user_id !== owUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("ow_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/posts/[id]]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
