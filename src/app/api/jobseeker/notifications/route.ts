import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// GET /api/jobseeker/notifications — 通知一覧 + 未読数
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const adminSupabase = createAdminClient();

  // 通知一覧（最新20件）
  const { data: rows, error } = await adminSupabase
    .from("ow_notifications")
    .select(`
      id, type, post_id, comment_id, is_read, created_at,
      actor:ow_users!actor_user_id(id, name, avatar_color, avatar_url)
    `)
    .eq("recipient_user_id", owUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[GET /api/jobseeker/notifications]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 対象投稿の本文冒頭を別途取得。
  // ⚠️ ow_posts_visible から引くこと。通知は /feed/[postId] にリンクするが、
  //    そちらはビューに無い投稿を 404 にするため、ow_posts を引くと
  //    「押すと 404 になる通知」ができる。ここに載らなかった通知は下で丸ごと落とす。
  //    通知行そのものは消さない（表示側のフィルタだけ）。
  const postIds = Array.from(new Set((rows ?? []).map((r: { post_id: string }) => r.post_id)));
  const postPreviews = new Map<string, string>();
  if (postIds.length > 0) {
    const { data: posts, error: postErr } = await adminSupabase
      .from("ow_posts_visible")
      .select("id, content")
      .in("id", postIds);
    if (postErr) console.error("[GET /api/jobseeker/notifications] posts", postErr.message);
    for (const p of posts ?? []) {
      postPreviews.set(p.id, p.content.slice(0, 40) + (p.content.length > 40 ? "…" : ""));
    }
  }

  type RawRow = {
    id: string;
    type: string;
    post_id: string;
    comment_id: string | null;
    is_read: boolean;
    created_at: string;
    // Supabase の !fk JOIN は配列で返る
    actor: { id: string; name: string; avatar_color: string | null; avatar_url: string | null }[] | null;
  };

  // ⚠️ ビューに無い投稿（参照先が消えたもの）の通知は丸ごと落とす。
  //    リンク先の /feed/[postId] が 404 になるため。行は消さない。
  const notifications = (rows ?? [])
    .filter((r: RawRow) => postPreviews.has(r.post_id))
    .map((r: RawRow) => {
    const actorRaw = Array.isArray(r.actor) ? r.actor[0] ?? null : r.actor ?? null;
    return {
      id: r.id,
      type: r.type,
      postId: r.post_id,
      postPreview: postPreviews.get(r.post_id) ?? null,
      commentId: r.comment_id,
      isRead: r.is_read,
      createdAt: r.created_at,
      actor: actorRaw
        ? { id: actorRaw.id, name: actorRaw.name, avatarColor: actorRaw.avatar_color, avatarUrl: actorRaw.avatar_url }
        : null,
    };
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json({ notifications, unreadCount });
}

// PATCH /api/jobseeker/notifications — 全件既読
export async function PATCH() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // RLS により本人（recipient_user_id）の行のみ更新される
  const { error } = await supabase
    .from("ow_notifications")
    .update({ is_read: true })
    .eq("recipient_user_id", owUserId)
    .eq("is_read", false);

  if (error) {
    console.error("[PATCH /api/jobseeker/notifications]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
