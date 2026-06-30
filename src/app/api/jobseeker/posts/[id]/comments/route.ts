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

// GET /api/jobseeker/posts/[id]/comments — コメント一覧（認証不要）
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const postId = params.id;

  // 投稿者の visibility をチェック（private は非公開）
  const { data: { user } } = await supabase.auth.getUser();
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
    if (visibility === "login_only" && !user) {
      return NextResponse.json({ comments: [] });
    }
  }

  const { data, error } = await supabase
    .from("ow_post_comments")
    .select(`
      id, content, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url)
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[GET /api/jobseeker/posts/[id]/comments]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ comments: data ?? [] });
}

// POST /api/jobseeker/posts/[id]/comments — コメント追加
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const postId = params.id;

  let body: { content?: unknown };
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

  const { data: inserted, error } = await supabase
    .from("ow_post_comments")
    .insert({ post_id: postId, user_id: owUserId, content })
    .select(`
      id, content, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url)
    `)
    .single();

  if (error) {
    console.error("[POST /api/jobseeker/posts/[id]/comments]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ comment: inserted }, { status: 201 });
}
