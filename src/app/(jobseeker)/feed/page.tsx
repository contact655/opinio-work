import { redirect } from "next/navigation";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FeedClient from "./FeedClient";

export const metadata: Metadata = {
  title: "投稿 | OPINIO",
  description: "IT/SaaS業界で働く人たちの投稿",
};

type RawPost = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

export default async function FeedPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/feed");
  }

  // ow_users レコードを取得
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, avatar_url")
    .eq("auth_id", user.id)
    .maybeSingle();

  const myOwUserId = owUser?.id ?? null;

  // 初期投稿を SSR でフェッチ（adminClient でコメント数・いいね数を確実に取得）
  const adminSupabase = createAdminClient();
  const { data: rawPosts } = await adminSupabase
    .from("ow_posts")
    .select(`
      id, content, image_url, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  const posts = (rawPosts ?? []) as unknown as RawPost[];

  // liked_by_me
  let likedPostIds = new Set<string>();
  if (myOwUserId && posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const { data: likedRows } = await adminSupabase
      .from("ow_post_likes")
      .select("post_id")
      .eq("user_id", myOwUserId)
      .in("post_id", postIds);
    likedPostIds = new Set((likedRows ?? []).map((r: { post_id: string }) => r.post_id));
  }

  // visibility フィルター（private は全員非表示 / login_only はログイン済みなので表示）
  const visiblePosts = posts.filter((p) => p.user?.visibility !== "private");

  // 現職情報を別クエリで取得
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

  const initialPosts = visiblePosts.map((p) => {
    const exp = p.user ? expByUser.get(p.user.id) : undefined;
    return {
      id: p.id,
      content: p.content,
      image_url: p.image_url,
      created_at: p.created_at,
      user: p.user
        ? { id: p.user.id, name: p.user.name, avatar_color: p.user.avatar_color, avatar_url: p.user.avatar_url, roleTitle: exp?.roleTitle ?? null, company: exp?.company ?? null }
        : { id: "", name: "不明", avatar_color: null, avatar_url: null, roleTitle: null, company: null },
      like_count: p.likes?.[0]?.count ?? 0,
      comment_count: p.comments?.[0]?.count ?? 0,
      liked_by_me: likedPostIds.has(p.id),
    };
  });

  return (
    <FeedClient
      initialPosts={initialPosts}
      myUserId={myOwUserId}
      myName={owUser?.name ?? null}
      myAvatarColor={owUser?.avatar_color ?? null}
      myAvatarUrl={owUser?.avatar_url ?? null}
      myLikedPostIds={Array.from(likedPostIds)}
    />
  );
}
