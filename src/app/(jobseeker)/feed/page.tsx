import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import FeedClient from "./FeedClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "フィード — OPINIO" };

type RawPost = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null } | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

export default async function FeedPage() {
  const supabase = createClient();

  // 現在ログイン中のユーザーを取得
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let myUserId: string | null = null;
  let myName: string | null = null;
  let myAvatarColor: string | null = null;
  let myAvatarUrl: string | null = null;

  if (authUser) {
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id, name, avatar_color, avatar_url")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (owUser) {
      myUserId = owUser.id;
      myName = owUser.name ?? null;
      myAvatarColor = owUser.avatar_color ?? null;
      myAvatarUrl = owUser.avatar_url ?? null;
    }
  }

  // 初期投稿20件を取得
  const { data: postsRaw } = await supabase
    .from("ow_posts")
    .select(`
      id, content, image_url, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url),
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  const posts = (postsRaw ?? []) as unknown as RawPost[];

  // 自分がいいね済みの post id 一覧
  let myLikedPostIds: string[] = [];
  if (myUserId && posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const { data: likedRows } = await supabase
      .from("ow_post_likes")
      .select("post_id")
      .eq("user_id", myUserId)
      .in("post_id", postIds);
    myLikedPostIds = (likedRows ?? []).map((r: { post_id: string }) => r.post_id);
  }

  const initialPosts = posts.map((p) => ({
    id: p.id,
    content: p.content,
    image_url: p.image_url,
    created_at: p.created_at,
    user: p.user ?? { id: "", name: "不明", avatar_color: null, avatar_url: null },
    like_count: (p.likes as Array<{ count: number }>)[0]?.count ?? 0,
    comment_count: (p.comments as Array<{ count: number }>)[0]?.count ?? 0,
    liked_by_me: myLikedPostIds.includes(p.id),
  }));

  return (
    <div style={{ minHeight: "60vh", background: "var(--bg-tint)" }}>
      <FeedClient
        initialPosts={initialPosts}
        myUserId={myUserId}
        myName={myName}
        myAvatarColor={myAvatarColor}
        myAvatarUrl={myAvatarUrl}
        myLikedPostIds={myLikedPostIds}
      />
    </div>
  );
}
