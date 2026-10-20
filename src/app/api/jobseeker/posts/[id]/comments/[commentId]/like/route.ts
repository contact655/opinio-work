import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

/**
 * POST / DELETE /api/jobseeker/posts/[id]/comments/[commentId]/like — コメント（返信を含む）へのいいね（2026-10-20）
 *
 * 投稿へのいいね（../../likes）と同じ形。書き込みはセッションのクライアント（RLS で自分の行だけ）。
 * ⚠️ コメントがその投稿のものかを確かめる（別の投稿の id を混ぜて押せないように）。
 * ⚠️ 投稿者が private の投稿には押せない（投稿のいいねと同じ）。
 * 通知は best-effort（いいね自体は成功させる）。自分のコメントへのいいねは送らない。未読の同じ通知があれば重ねない。
 */
async function context(postId: string, commentId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if (!UUID_RE.test(postId) || !UUID_RE.test(commentId)) {
    return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) } as const;
  }
  const { data: me } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) } as const;

  const { data: comment, error: cErr } = await supabase
    .from("ow_post_comments")
    .select("id, post_id, user_id, post:ow_posts!post_id(user:ow_users!user_id(visibility))")
    .eq("id", commentId).maybeSingle();
  if (cErr) console.error("[comment like] comment:", cErr.message);
  const vis = (comment?.post as unknown as { user: { visibility: string | null } | null } | null)?.user?.visibility;
  if (!comment || comment.post_id !== postId || vis === "private") {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  }
  return { supabase, myId: me.id as string, authorId: comment.user_id as string } as const;
}

export async function POST(_req: Request, { params }: { params: { id: string; commentId: string } }) {
  const ctx = await context(params.id, params.commentId);
  if ("error" in ctx) return ctx.error;

  const { error } = await ctx.supabase
    .from("ow_post_comment_likes")
    .upsert({ comment_id: params.commentId, user_id: ctx.myId }, { onConflict: "comment_id,user_id", ignoreDuplicates: true });
  if (error) {
    console.error("[POST comment like]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (ctx.authorId !== ctx.myId) {
    try {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from("ow_notifications").select("id")
        .eq("recipient_user_id", ctx.authorId).eq("actor_user_id", ctx.myId)
        .eq("type", "comment_like").eq("comment_id", params.commentId).eq("is_read", false)
        .maybeSingle();
      if (!existing) {
        const { error: nErr } = await admin.from("ow_notifications").insert({
          recipient_user_id: ctx.authorId,
          actor_user_id: ctx.myId,
          type: "comment_like",
          post_id: params.id,
          comment_id: params.commentId,
        });
        if (nErr) console.error("[comment like notify]", nErr.message);
      }
    } catch (e) {
      console.error("[comment like notify]", e);
    }
  }
  return NextResponse.json({ liked: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; commentId: string } }) {
  const ctx = await context(params.id, params.commentId);
  if ("error" in ctx) return ctx.error;

  const { error } = await ctx.supabase
    .from("ow_post_comment_likes").delete()
    .eq("comment_id", params.commentId).eq("user_id", ctx.myId);
  if (error) {
    console.error("[DELETE comment like]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  /* ★いいねを外したら、そのいいねの通知も消す（2026-10-21。投稿のいいねと同じ。柴さんの指示）。
     ⚠️ 消すのは「この人が・このコメントに付けた」いいね通知だけ。best-effort（失敗はログ）。 */
  const { error: notifErr } = await createAdminClient()
    .from("ow_notifications").delete()
    .eq("type", "comment_like").eq("actor_user_id", ctx.myId).eq("comment_id", params.commentId);
  if (notifErr) console.error("[comment like unnotify]", notifErr.message);
  return NextResponse.json({ liked: false });
}
