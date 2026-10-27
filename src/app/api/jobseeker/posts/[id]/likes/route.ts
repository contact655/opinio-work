import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { isPostVisibleTo, postRefersToTest, type PostTestRefs } from "@/lib/feed/visibility";
import { isRegisteredUser } from "@/lib/users/registered";

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

  /* ★いいねを外したら、そのいいねの通知も消す（2026-10-21 / 柴さんの指示）。
       残すと、外したあとも相手のベルに「いいねしました」が出続ける。
     ⚠️ 消すのは「この人が・この投稿に付けた」いいね通知だけ（既読かどうかは問わない）。
     ⚠️ best-effort。失敗してもいいねの解除は成功として返す（ログは出す）。 */
  const { error: notifErr } = await createAdminClient()
    .from("ow_notifications")
    .delete()
    .eq("type", "like")
    .eq("actor_user_id", owUserId)
    .eq("post_id", postId);
  if (notifErr) console.error("[likes unnotify]", notifErr.message);

  return NextResponse.json({ liked: false });
}

/**
 * GET /api/jobseeker/posts/[id]/likes — いいねした人の一覧（2026-10-21 / 柴さんの要望。LinkedIn の「リアクション」と同じ形）
 *
 * - ログインしている人だけ（人の一覧なので。/people と同じ扱い）
 * - 投稿そのものが見えない人には 404（フィードと同じ判定 `isPostVisibleTo`）
 * - 出さない人: 非公開（private）・システム・本人が登録していない行・
 *   ★検証用アカウント（見ている人が実在の利用者のとき。フィードと同じ片方向）
 *   ⚠️ 出さなかった人は `hiddenCount` に数だけ返す（いいねの数と一覧の人数が合わないと「消えた」と読まれる）
 * - 新しい順。最大 200 人（それ以上は数だけ）
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me, error: meErr } = await admin
    .from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
  if (meErr) { console.error("[GET likes] me:", meErr.message); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const viewerIsTest = me.is_test === true;

  const { data: post, error: pErr } = await admin
    .from("ow_posts_visible")
    .select("id, visibility, user:ow_users!user_id(visibility, is_test, is_system), ref_company:ow_companies!ref_company_id(is_test), ref_job:ow_jobs!ref_job_id(is_test, company:ow_companies!company_id(is_test)), ref_article:ow_articles!ref_article_id(company:ow_companies!company_id(is_test))")
    .eq("id", params.id).maybeSingle();
  if (pErr) { console.error("[GET likes] post:", pErr.message); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
  const author = (post?.user ?? null) as unknown as { visibility: string | null; is_test: boolean | null; is_system: boolean | null } | null;
  /* ★検証用の会社・求人を指す投稿は、実在の人には「無い」と同じに扱う（2026-10-27。lib/feed/visibility.ts） */
  const refersToTest = post ? postRefersToTest(post as unknown as PostTestRefs) : false;
  if (!post || !isPostVisibleTo({ postVisibility: post.visibility as string | null, author, refersToTest }, true, viewerIsTest)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const LIMIT = 200;
  const { data: rows, error: lErr, count } = await admin
    .from("ow_post_likes")
    .select("user_id, created_at, liker:ow_users!user_id(id, name, username, headline, avatar_url, avatar_color, visibility, is_test, is_system, auth_id)", { count: "exact" })
    .eq("post_id", params.id)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (lErr) { console.error("[GET likes] likes:", lErr.message); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }

  type Liker = { id: string; name: string; username: string | null; headline: string | null; avatar_url: string | null; avatar_color: string | null; visibility: string | null; is_test: boolean | null; is_system: boolean | null; auth_id: string | null };
  const shown = (rows ?? [])
    .map((r) => (Array.isArray(r.liker) ? r.liker[0] : r.liker) as unknown as Liker | null)
    .filter((u): u is Liker => !!u
      && isRegisteredUser(u)
      && u.is_system !== true
      && u.visibility !== "private"
      && (viewerIsTest || u.is_test !== true));

  /* 自分がフォローしている人（ボタンの初期表示） */
  const ids = shown.map((u) => u.id).filter((id) => id !== me.id);
  const following = new Set<string>();
  /* ★自分をフォローしている人（ボタンが「つながり」になる。2026-10-21） */
  const followers = new Set<string>();
  if (ids.length > 0) {
    const [out, inc] = await Promise.all([
      admin.from("ow_user_follows").select("target_user_id").eq("follower_user_id", me.id).in("target_user_id", ids),
      admin.from("ow_user_follows").select("follower_user_id").eq("target_user_id", me.id).in("follower_user_id", ids),
    ]);
    if (out.error) console.error("[GET likes] follows:", out.error.message);
    if (inc.error) console.error("[GET likes] followers:", inc.error.message);
    for (const x of out.data ?? []) following.add(x.target_user_id as string);
    for (const x of inc.data ?? []) followers.add(x.follower_user_id as string);
  }

  const total = count ?? shown.length;
  return NextResponse.json({
    total,
    hiddenCount: Math.max(0, total - shown.length),
    likers: shown.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      headline: u.headline,
      avatarUrl: u.avatar_url,
      avatarColor: u.avatar_color,
      isMe: u.id === me.id,
      followed: following.has(u.id),
      followsMe: followers.has(u.id),
    })),
  });
}

