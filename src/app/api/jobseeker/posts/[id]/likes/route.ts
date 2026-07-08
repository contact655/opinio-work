import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

async function checkPostVisibility(
  supabase: ReturnType<typeof createClient>,
  postId: string
): Promise<boolean> {
  const { data: post } = await supabase
    .from("ow_posts")
    .select("user:ow_users!user_id(visibility)")
    .eq("id", postId)
    .maybeSingle();
  const visibility = (post?.user as unknown as { visibility: string | null } | null)?.visibility;
  return visibility !== "private";
}

// POST /api/jobseeker/posts/[id]/likes — いいね追加
export async function POST(
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

  if (!(await checkPostVisibility(supabase, postId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // UPSERT: 既にいいね済みの場合は無視
  const { error } = await supabase
    .from("ow_post_likes")
    .upsert(
      { post_id: postId, user_id: owUserId },
      { onConflict: "post_id,user_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[POST /api/jobseeker/posts/[id]/likes]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 通知INSERT（best-effort: 失敗してもいいね自体は成功）
  try {
    const adminSupabase = createAdminClient();

    // 投稿の所有者を取得
    const { data: post } = await adminSupabase
      .from("ow_posts")
      .select("user_id")
      .eq("id", postId)
      .maybeSingle();

    const recipientUserId = post?.user_id ?? null;

    // 自分の投稿への自分のいいねは通知しない
    if (recipientUserId && recipientUserId !== owUserId) {
      // 同一 actor/post/type の未読通知が既にあれば重複を作らない
      const { data: existing } = await adminSupabase
        .from("ow_notifications")
        .select("id")
        .eq("recipient_user_id", recipientUserId)
        .eq("actor_user_id", owUserId)
        .eq("type", "like")
        .eq("post_id", postId)
        .eq("is_read", false)
        .maybeSingle();

      if (!existing) {
        await adminSupabase.from("ow_notifications").insert({
          recipient_user_id: recipientUserId,
          actor_user_id: owUserId,
          type: "like",
          post_id: postId,
        });
      }
    }
  } catch (notifErr) {
    console.error("[likes notify]", notifErr);
  }

  return NextResponse.json({ liked: true });
}

// DELETE /api/jobseeker/posts/[id]/likes — いいね解除
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const postId = params.id;

  const { error } = await supabase
    .from("ow_post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/posts/[id]/likes]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ liked: false });
}
