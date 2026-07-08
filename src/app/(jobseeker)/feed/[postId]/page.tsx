import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RawPost = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: { postId: string } }): Promise<Metadata> {
  if (!UUID_RE.test(params.postId)) return { title: "投稿 | OPINIO" };

  const adminSupabase = createAdminClient();
  const { data: raw } = await adminSupabase
    .from("ow_posts")
    .select("content, user:ow_users!user_id(name)")
    .eq("id", params.postId)
    .maybeSingle();

  if (!raw) return { title: "投稿 | OPINIO" };
  const p = raw as unknown as { content: string; user: { name: string } | null };
  const excerpt = p.content.slice(0, 50) + (p.content.length > 50 ? "…" : "");
  const authorName = p.user?.name ?? "ユーザー";
  return {
    title: `${authorName}: ${excerpt} | OPINIO`,
    description: p.content.slice(0, 120),
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default async function FeedPostPage({ params }: { params: { postId: string } }) {
  if (!UUID_RE.test(params.postId)) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=/feed/${params.postId}`);

  const adminSupabase = createAdminClient();
  const { data: raw } = await adminSupabase
    .from("ow_posts")
    .select(`
      id, content, image_url, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `)
    .eq("id", params.postId)
    .maybeSingle();

  if (!raw) notFound();
  const p = raw as unknown as RawPost;
  if (p.user?.visibility === "private") notFound();

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

  const likeCount = p.likes?.[0]?.count ?? 0;
  const commentCount = p.comments?.[0]?.count ?? 0;
  const avatarColor = p.user?.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)";

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 16px 64px" }}>
      {/* 戻るリンク */}
      <Link
        href="/feed"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "var(--ink-soft)",
          textDecoration: "none",
          fontSize: 14,
          fontFamily: '"Noto Sans JP", sans-serif',
          marginBottom: 20,
        }}
      >
        ← フィードに戻る
      </Link>

      {/* 投稿カード */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <Link href={`/u/${p.user?.id ?? ""}`} style={{ flexShrink: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: p.user?.avatar_url ? undefined : avatarColor,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {p.user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (p.user?.name ?? "?")[0]
              )}
            </div>
          </Link>
          <div>
            <Link
              href={`/u/${p.user?.id ?? ""}`}
              style={{ fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 15, color: "var(--ink)", textDecoration: "none" }}
            >
              {p.user?.name ?? "不明"}
            </Link>
            {(roleTitle || company) && (
              <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                {[roleTitle, company].filter(Boolean).join(" · ")}
              </div>
            )}
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
              {formatDate(p.created_at)}
            </div>
          </div>
        </div>

        {/* 本文 */}
        <p
          style={{
            margin: "0 0 14px",
            fontFamily: '"Noto Sans JP", sans-serif',
            fontSize: 15,
            color: "var(--ink)",
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {p.content}
        </p>

        {/* 画像 */}
        {p.image_url && (
          <div style={{ marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image_url}
              alt=""
              style={{ width: "100%", maxHeight: 400, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }}
            />
          </div>
        )}

        {/* フッター: いいね・コメント数 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
            fontFamily: '"Noto Sans JP", sans-serif',
            fontSize: 14,
            color: "var(--ink-soft)",
          }}
        >
          <span>❤️ {likeCount}</span>
          <span>💬 {commentCount}</span>
          <Link
            href="/feed"
            style={{ marginLeft: "auto", color: "var(--royal)", textDecoration: "none", fontSize: 14 }}
          >
            フィードで返信する →
          </Link>
        </div>
      </div>
    </div>
  );
}
