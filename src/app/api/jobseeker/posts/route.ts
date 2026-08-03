import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS } from "@/lib/experiences/companyName";

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

type RefCompany = { id: string; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
type RefJob = { id: string; title: string; salary_min: number | null; salary_max: number | null; work_style: string | null } | null;
type RefArticle = { id: string; slug: string; title: string } | null;

type RawPost = {
  id: string;
  content: string;
  post_type: string;
  ref_company_id: string | null;
  ref_job_id: string | null;
  ref_article_id: string | null;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  link_image_url: string | null;
  link_description: string | null;
  link_domain: string | null;
  event_title: string | null;
  event_starts_at: string | null;
  event_location: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null; is_system: boolean | null } | null;
  ref_company: RefCompany;
  ref_job: RefJob;
  ref_article: RefArticle;
  likes: { count: number }[];
  comments: { count: number }[];
};

type AdminClient = ReturnType<typeof createAdminClient>;

async function getLikedIds(admin: AdminClient, myOwUserId: string | null, posts: RawPost[]): Promise<Set<string>> {
  if (!myOwUserId || posts.length === 0) return new Set();
  const { data } = await admin
    .from("ow_post_likes")
    .select("post_id")
    .eq("user_id", myOwUserId)
    .in("post_id", posts.map((p) => p.id));
  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
}

async function getExpByUser(admin: AdminClient, posts: RawPost[]): Promise<Map<string, { roleTitle: string | null; company: string | null }>> {
  const userIds = Array.from(new Set(posts.map((p) => p.user?.id).filter(Boolean) as string[]));
  const map = new Map<string, { roleTitle: string | null; company: string | null }>();
  if (userIds.length === 0) return map;
  const { data: exps } = await admin
    .from("ow_experiences")
    .select(`user_id, role_title, ${EXPERIENCE_COMPANY_COLS}`)
    .in("user_id", userIds)
    .eq("is_current", true);
  for (const exp of exps ?? []) {
    if (!map.has(exp.user_id)) {
      map.set(exp.user_id, {
        roleTitle: exp.role_title ?? null,
        company: resolveExperienceCompanyName(exp),
      });
    }
  }
  return map;
}

function filterVisible(posts: RawPost[], myOwUserId: string | null): RawPost[] {
  return posts.filter((p) => {
    if (p.user?.is_system) return true;
    const v = p.user?.visibility;
    if (v === "private") return false;
    if (v === "login_only" && !myOwUserId) return false;
    return true;
  });
}

async function getTopLikers(
  admin: AdminClient,
  posts: RawPost[]
): Promise<Map<string, { id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]>> {
  const map = new Map<string, { id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]>();
  if (posts.length === 0) return map;
  const { data } = await admin
    .from("ow_post_likes")
    .select("post_id, user:ow_users!user_id(id, name, avatar_color, avatar_url)")
    .in("post_id", posts.map((p) => p.id))
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    const r = row as unknown as { post_id: string; user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null } };
    if (!map.has(r.post_id)) map.set(r.post_id, []);
    const arr = map.get(r.post_id)!;
    if (arr.length < 3) arr.push(r.user);
  }
  return map;
}

function formatPosts(
  posts: RawPost[],
  myOwUserId: string | null,
  likedIds: Set<string>,
  expByUser: Map<string, { roleTitle: string | null; company: string | null }>,
  topLikersMap: Map<string, { id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]> = new Map()
) {
  return filterVisible(posts, myOwUserId).map((p) => {
    const exp = p.user ? expByUser.get(p.user.id) : undefined;
    return {
      id: p.id,
      content: p.content,
      post_type: p.post_type ?? "user_post",
      image_url: p.image_url,
      link_url: p.link_url,
      link_title: p.link_title,
      link_image_url: p.link_image_url,
      link_description: p.link_description,
      link_domain: p.link_domain,
      event_title: (p as unknown as { event_title?: string | null }).event_title ?? null,
      event_starts_at: (p as unknown as { event_starts_at?: string | null }).event_starts_at ?? null,
      event_location: (p as unknown as { event_location?: string | null }).event_location ?? null,
      created_at: p.created_at,
      user: p.user
        ? { id: p.user.id, name: p.user.name, avatar_color: p.user.avatar_color, avatar_url: p.user.avatar_url, is_system: p.user.is_system ?? false, roleTitle: exp?.roleTitle ?? null, company: exp?.company ?? null }
        : { id: "", name: "不明", avatar_color: null, avatar_url: null, is_system: false, roleTitle: null, company: null },
      ref_company: p.ref_company ?? null,
      ref_job: p.ref_job ?? null,
      ref_article: p.ref_article ?? null,
      like_count: p.likes?.[0]?.count ?? 0,
      comment_count: p.comments?.[0]?.count ?? 0,
      liked_by_me: likedIds.has(p.id),
      top_likers: topLikersMap.get(p.id) ?? [],
    };
  });
}

const POST_SELECT = `
  id, content, post_type, ref_company_id, ref_job_id, ref_article_id,
  image_url, link_url, link_title, link_image_url, link_description, link_domain,
  event_title, event_starts_at, event_location, created_at,
  user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility, is_system),
  ref_company:ow_companies!ref_company_id(id, name, brand_name, logo_letter, logo_gradient, logo_url),
  ref_job:ow_jobs!ref_job_id(id, title, salary_min, salary_max, work_style),
  ref_article:ow_articles!ref_article_id(id, slug, title),
  likes:ow_post_likes(count),
  comments:ow_post_comments(count)
`;

// GET /api/jobseeker/posts — フィード取得
// クエリパラメータ:
//   limit   (default 20)
//   before  (ISO日時, cursor pagination)
//   user_id (特定ユーザーの投稿だけ取得)
//   tab     "followed" → ログインユーザーがフォローした企業の投稿のみ
export async function GET(req: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);

  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10), 1), 50);
  const before = searchParams.get("before");
  const userId = searchParams.get("user_id");
  const tab = searchParams.get("tab"); // "followed" | null

  const adminSupabase = createAdminClient();

  // ログイン確認（オプション）
  const { data: { user } } = await supabase.auth.getUser();
  let myOwUserId: string | null = null;
  if (user) {
    myOwUserId = await resolveOwUserId(supabase, user.id);
  }

  // ── フォロー中タブ ────────────────────────────────────────────────────────
  if (tab === "followed") {
    if (!myOwUserId) {
      // 未ログインは空リストを返す
      return NextResponse.json({ posts: [] });
    }

    // フォロー中企業 ID 一覧
    const { data: followRows } = await adminSupabase
      .from("ow_company_follows")
      .select("company_id")
      .eq("follower_user_id", myOwUserId);

    const followedCompanyIds = (followRows ?? []).map((r: { company_id: string }) => r.company_id);

    if (followedCompanyIds.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    // プライバシー同意済みメンバーの user_id 一覧
    const { data: memberRows } = await adminSupabase
      .from("ow_company_members")
      .select("user_id")
      .in("company_id", followedCompanyIds)
      .eq("is_public", true)
      .eq("display_consent", true);

    const consentedUserIds = (memberRows ?? []).map((r: { user_id: string }) => r.user_id);

    // (a) ref_company_id が followed OR (b) user_id が consented member
    let followedQuery = adminSupabase
      .from("ow_posts")
      .select(POST_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) followedQuery = followedQuery.lt("created_at", before);

    // OR フィルタ
    const orParts: string[] = [`ref_company_id.in.(${followedCompanyIds.join(",")})`];
    if (consentedUserIds.length > 0) {
      orParts.push(`user_id.in.(${consentedUserIds.join(",")})`);
    }
    followedQuery = followedQuery.or(orParts.join(","));

    const { data: followedData, error: followedError } = await followedQuery;
    if (followedError) {
      console.error("[GET /api/jobseeker/posts?tab=followed]", followedError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const fposts = (followedData ?? []) as unknown as RawPost[];
    const [fLiked, fExp, fTopLikers] = await Promise.all([
      getLikedIds(adminSupabase, myOwUserId, fposts),
      getExpByUser(adminSupabase, fposts),
      getTopLikers(adminSupabase, fposts),
    ]);
    return NextResponse.json({ posts: formatPosts(fposts, myOwUserId, fLiked, fExp, fTopLikers) });
  }
  // ─────────────────────────────────────────────────────────────────────────

  let query = adminSupabase
    .from("ow_posts")
    .select(POST_SELECT)
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
  const [likedIds, expByUser, topLikersMap] = await Promise.all([
    getLikedIds(adminSupabase, myOwUserId, posts),
    getExpByUser(adminSupabase, posts),
    getTopLikers(adminSupabase, posts),
  ]);

  return NextResponse.json({ posts: formatPosts(posts, myOwUserId, likedIds, expByUser, topLikersMap) });
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
