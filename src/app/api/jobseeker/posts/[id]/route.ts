import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

// GET /api/jobseeker/posts/[id] — 個別投稿取得
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let myOwUserId: string | null = null;
  if (user) {
    const { data } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
    myOwUserId = data?.id ?? null;
  }

  const adminSupabase = createAdminClient();
  const { data: raw, error } = await adminSupabase
    .from("ow_posts")
    .select(`
      id, content, image_url, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const p = raw as unknown as {
    id: string; content: string; image_url: string | null; created_at: string;
    user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
    likes: { count: number }[]; comments: { count: number }[];
  };

  if (p.user?.visibility === "private") return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 現職情報
  let roleTitle: string | null = null;
  let company: string | null = null;
  if (p.user?.id) {
    const { data: exp } = await adminSupabase
      .from("ow_experiences")
      .select("role_title, company_text, company_anonymized")
      .eq("user_id", p.user.id)
      .eq("is_current", true)
      .limit(1)
      .maybeSingle();
    if (exp) {
      roleTitle = exp.role_title ?? null;
      company = exp.company_text || exp.company_anonymized || null;
    }
  }

  let liked_by_me = false;
  if (myOwUserId) {
    const { data: like } = await adminSupabase
      .from("ow_post_likes")
      .select("post_id")
      .eq("post_id", params.id)
      .eq("user_id", myOwUserId)
      .maybeSingle();
    liked_by_me = !!like;
  }

  return NextResponse.json({
    post: {
      id: p.id, content: p.content, image_url: p.image_url, created_at: p.created_at,
      user: p.user
        ? { id: p.user.id, name: p.user.name, avatar_color: p.user.avatar_color, avatar_url: p.user.avatar_url, roleTitle, company }
        : { id: "", name: "不明", avatar_color: null, avatar_url: null, roleTitle: null, company: null },
      like_count: p.likes?.[0]?.count ?? 0,
      comment_count: p.comments?.[0]?.count ?? 0,
      liked_by_me,
    },
  });
}

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
