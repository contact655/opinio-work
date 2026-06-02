import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

// DELETE /api/jobseeker/posts/[id]/comments/[commentId] — コメント削除（自分のコメントのみ）
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: postId, commentId } = params;

  // 存在確認 + オーナーチェック
  const { data: comment, error: fetchError } = await supabase
    .from("ow_post_comments")
    .select("id, user_id, post_id")
    .eq("id", commentId)
    .eq("post_id", postId)
    .maybeSingle();

  if (fetchError) {
    console.error("[DELETE /api/jobseeker/posts/[id]/comments/[commentId]] fetch", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.user_id !== owUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("ow_post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/posts/[id]/comments/[commentId]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
