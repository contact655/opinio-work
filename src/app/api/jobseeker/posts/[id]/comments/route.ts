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

/**
 * GET /api/jobseeker/posts/[id]/comments — コメント一覧
 *
 * ⚠️ **認証必須**（2026-08-16 に変更）。以前は認証不要だった。
 *    投稿本体（`ow_posts`）を未ログインから読めなくした（20260815140000）のに、
 *    **コメントだけ直接読めるのは筋が通らない**ため揃えた。
 *    RLS 側も `ow_post_comments_select_authenticated` で揃えている。
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const postId = params.id;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 投稿者の visibility をチェック（private は非公開）
  const { data: post } = await supabase
    .from("ow_posts")
    .select("user:ow_users!user_id(visibility)")
    .eq("id", postId)
    .maybeSingle();
  if (post) {
    const visibility = (post.user as unknown as { visibility: string | null } | null)?.visibility;
    if (visibility === "private") {
      return NextResponse.json({ comments: [] });
    }
  }

  /* ★返信（parent_comment_id）といいねの数を一緒に返す（2026-10-20）。並びは古い順のまま。
        画面は parent_comment_id が null のものを親、それ以外をその下に並べる（返信は1段だけ） */
  const { data, error } = await supabase
    .from("ow_post_comments")
    .select(`
      id, content, created_at, parent_comment_id,
      user:ow_users!user_id(id, name, avatar_color, avatar_url),
      likes:ow_post_comment_likes(count)
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[GET /api/jobseeker/posts/[id]/comments]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as {
    id: string; content: string; created_at: string; parent_comment_id: string | null;
    user: unknown; likes: { count: number }[] | null;
  }[];
  const myOwUserId = await resolveOwUserId(supabase, user.id);
  const liked = new Set<string>();
  if (myOwUserId && rows.length > 0) {
    const { data: mine, error: likeErr } = await supabase
      .from("ow_post_comment_likes").select("comment_id")
      .eq("user_id", myOwUserId).in("comment_id", rows.map((r) => r.id));
    if (likeErr) console.error("[GET comments] my comment likes:", likeErr.message);
    for (const r of mine ?? []) liked.add(r.comment_id as string);
  }

  return NextResponse.json({
    comments: rows.map((r) => ({
      id: r.id, content: r.content, created_at: r.created_at, parent_comment_id: r.parent_comment_id,
      user: r.user, like_count: r.likes?.[0]?.count ?? 0, liked_by_me: liked.has(r.id),
    })),
  });
}

// POST /api/jobseeker/posts/[id]/comments — コメント追加
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const postId = params.id;

  // 投稿者の visibility チェック（private / login_only ユーザーへのコメントを防ぐ）
  const { data: postForCheck } = await supabase
    .from("ow_posts")
    .select("user:ow_users!user_id(visibility)")
    .eq("id", postId)
    .maybeSingle();
  if (postForCheck) {
    const vis = (postForCheck.user as unknown as { visibility: string | null } | null)?.visibility;
    if (vis === "private") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: { content?: unknown; parentCommentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length < 1) {
    return NextResponse.json({ error: "CONTENT_REQUIRED", message: "コメントを入力してください" }, { status: 400 });
  }
  if (content.length > 300) {
    return NextResponse.json({ error: "CONTENT_TOO_LONG", message: "コメントは300文字以内で入力してください" }, { status: 400 });
  }

  /* ★返信（2026-10-20）。返信は1段だけ: 返信への返信は、元のコメント（親）への返信として保存する。
        ⚠️ 通知は「返信した相手のコメントを書いた人」に送る（親ではなく、押したコメントの人） */
  let parentCommentId: string | null = null;
  let replyToUserId: string | null = null;
  if (body.parentCommentId !== undefined && body.parentCommentId !== null) {
    if (typeof body.parentCommentId !== "string" || !UUID_RE.test(body.parentCommentId)) {
      return NextResponse.json({ error: "Invalid parentCommentId" }, { status: 400 });
    }
    const { data: target, error: tErr } = await supabase
      .from("ow_post_comments").select("id, post_id, parent_comment_id, user_id")
      .eq("id", body.parentCommentId).maybeSingle();
    if (tErr) console.error("[POST comments] reply target:", tErr.message);
    if (!target || target.post_id !== postId) {
      return NextResponse.json({ error: "REPLY_TARGET_NOT_FOUND", message: "返信先のコメントが見つかりません" }, { status: 404 });
    }
    parentCommentId = (target.parent_comment_id as string | null) ?? (target.id as string);
    replyToUserId = target.user_id as string;
  }

  const { data: inserted, error } = await supabase
    .from("ow_post_comments")
    .insert({ post_id: postId, user_id: owUserId, content, parent_comment_id: parentCommentId })
    .select(`
      id, content, created_at, parent_comment_id,
      user:ow_users!user_id(id, name, avatar_color, avatar_url)
    `)
    .single();

  if (error) {
    console.error("[POST /api/jobseeker/posts/[id]/comments]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 通知INSERT（best-effort: 失敗してもコメント自体は成功）
  try {
    const adminSupabase = createAdminClient();

    // 投稿の所有者を取得
    const { data: post } = await adminSupabase
      .from("ow_posts")
      .select("user_id")
      .eq("id", postId)
      .maybeSingle();

    const recipientUserId = post?.user_id ?? null;

    /* ★返信なら、返信先のコメントを書いた人に「返信」を送る（自分への返信は送らない） */
    if (replyToUserId && replyToUserId !== owUserId) {
      const { error: rErr } = await adminSupabase.from("ow_notifications").insert({
        recipient_user_id: replyToUserId,
        actor_user_id: owUserId,
        type: "reply",
        post_id: postId,
        comment_id: inserted.id,
      });
      if (rErr) console.error("[comments notify reply]", rErr.message);
    }

    // 自分の投稿への自分のコメントは通知しない。⚠️ 返信先の人と投稿者が同じなら「返信」だけ送る（2通にしない）
    if (recipientUserId && recipientUserId !== owUserId && recipientUserId !== replyToUserId) {
      await adminSupabase.from("ow_notifications").insert({
        recipient_user_id: recipientUserId,
        actor_user_id: owUserId,
        type: "comment",
        post_id: postId,
        comment_id: inserted.id,
      });
    }
  } catch (notifErr) {
    console.error("[comments notify]", notifErr);
  }

  return NextResponse.json({ comment: inserted }, { status: 201 });
}
