import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

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

type RawPost = {
  id: string;
  content: string;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  link_image_url: string | null;
  link_description: string | null;
  link_domain: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

// GET /api/jobseeker/posts — フィード取得
// クエリパラメータ:
//   limit  (default 20)
//   before (ISO日時, cursor pagination)
//   user_id (特定ユーザーの投稿だけ取得)
export async function GET(req: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);

  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10), 1), 50);
  const before = searchParams.get("before");
  const userId = searchParams.get("user_id");

  // ログイン確認（オプション）
  const { data: { user } } = await supabase.auth.getUser();
  let myOwUserId: string | null = null;
  if (user) {
    myOwUserId = await resolveOwUserId(supabase, user.id);
  }

  let query = supabase
    .from("ow_posts")
    .select(`
      id, content, image_url, link_url, link_title, link_image_url, link_description, link_domain, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/jobseeker/posts]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const posts = (data ?? []) as unknown as RawPost[];

  // liked_by_me: ログイン済みの場合のみ取得
  let likedPostIds = new Set<string>();
  if (myOwUserId && posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const { data: likedRows } = await supabase
      .from("ow_post_likes")
      .select("post_id")
      .eq("user_id", myOwUserId)
      .in("post_id", postIds);
    likedPostIds = new Set((likedRows ?? []).map((r: { post_id: string }) => r.post_id));
  }

  // Filter by visibility: private users' posts are hidden for all callers;
  // login_only users' posts are hidden for unauthenticated callers
  const visiblePosts = posts.filter((p) => {
    const v = p.user?.visibility;
    if (v === "private") return false;
    if (v === "login_only" && !myOwUserId) return false;
    return true;
  });

  // 現職情報を別クエリで取得
  const adminSupabase = createAdminClient();
  const userIds = Array.from(new Set(visiblePosts.map((p) => p.user?.id).filter(Boolean) as string[]));
  const expByUser = new Map<string, { roleTitle: string | null; company: string | null }>();
  if (userIds.length > 0) {
    const { data: exps } = await adminSupabase
      .from("ow_experiences")
      .select("user_id, role_title, company_text, company_anonymized")
      .in("user_id", userIds)
      .eq("is_current", true);
    for (const exp of exps ?? []) {
      if (!expByUser.has(exp.user_id)) {
        expByUser.set(exp.user_id, {
          roleTitle: exp.role_title ?? null,
          company: exp.company_text || exp.company_anonymized || null,
        });
      }
    }
  }

  const result = visiblePosts.map((p) => {
    const exp = p.user ? expByUser.get(p.user.id) : undefined;
    return {
      id: p.id,
      content: p.content,
      image_url: p.image_url,
      link_url: p.link_url,
      link_title: p.link_title,
      link_image_url: p.link_image_url,
      link_description: p.link_description,
      link_domain: p.link_domain,
      created_at: p.created_at,
      user: p.user
        ? { id: p.user.id, name: p.user.name, avatar_color: p.user.avatar_color, avatar_url: p.user.avatar_url, roleTitle: exp?.roleTitle ?? null, company: exp?.company ?? null }
        : { id: "", name: "不明", avatar_color: null, avatar_url: null, roleTitle: null, company: null },
      like_count: p.likes?.[0]?.count ?? 0,
      comment_count: p.comments?.[0]?.count ?? 0,
      liked_by_me: likedPostIds.has(p.id),
    };
  });

  return NextResponse.json({ posts: result });
}

// POST /api/jobseeker/posts — 投稿作成
export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit(req, { limit: 30, windowSec: 3600, prefix: "post" });
  if (!allowed) return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再試行してください。" }, { status: 429 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: {
    content?: unknown;
    image_url?: unknown;
    link_url?: unknown;
    link_title?: unknown;
    link_image_url?: unknown;
    link_description?: unknown;
    link_domain?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length < 1) {
    return NextResponse.json({ error: "CONTENT_REQUIRED", message: "本文を入力してください" }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: "CONTENT_TOO_LONG", message: "本文は1000文字以内で入力してください" }, { status: 400 });
  }

  const image_url_raw = typeof body.image_url === "string" && body.image_url.trim().length > 0
    ? body.image_url.trim()
    : null;
  if (image_url_raw && !/^https:\/\//i.test(image_url_raw)) {
    return NextResponse.json({ error: "image_url must use HTTPS" }, { status: 400 });
  }
  const image_url = image_url_raw;

  // リンクプレビューフィールド（httpsのみ許可）
  const link_url_raw = typeof body.link_url === "string" && body.link_url.trim().length > 0
    ? body.link_url.trim()
    : null;
  if (link_url_raw && !/^https?:\/\//i.test(link_url_raw)) {
    return NextResponse.json({ error: "link_url must use HTTPS" }, { status: 400 });
  }
  const link_url = link_url_raw;
  const link_title = typeof body.link_title === "string" && body.link_title.trim().length > 0
    ? body.link_title.slice(0, 500)
    : null;
  const link_image_url_raw = typeof body.link_image_url === "string" && body.link_image_url.trim().length > 0
    ? body.link_image_url.trim()
    : null;
  const link_image_url = link_image_url_raw && /^https?:\/\//i.test(link_image_url_raw) ? link_image_url_raw : null;
  const link_description = typeof body.link_description === "string" && body.link_description.trim().length > 0
    ? body.link_description.slice(0, 500)
    : null;
  const link_domain = typeof body.link_domain === "string" && body.link_domain.trim().length > 0
    ? body.link_domain.slice(0, 253)
    : null;

  const { data: inserted, error } = await supabase
    .from("ow_posts")
    .insert({ user_id: owUserId, content, image_url, link_url, link_title, link_image_url, link_description, link_domain })
    .select(`
      id, content, image_url, link_url, link_title, link_image_url, link_description, link_domain, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url)
    `)
    .single();

  if (error) {
    console.error("[POST /api/jobseeker/posts]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    post: {
      ...(inserted as unknown as Record<string, unknown>),
      like_count: 0,
      comment_count: 0,
      liked_by_me: false,
    },
  }, { status: 201 });
}
