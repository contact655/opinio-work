"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LinkPreviewCard } from "@/components/feed/LinkPreviewCard";
import type { SidebarFollow, SidebarJob, SidebarMentor } from "./page";

// ─── 型定義 ──────────────────────────────────────────────────────────────────

type PostUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  avatar_url: string | null;
  is_system?: boolean;
  roleTitle?: string | null;
  company?: string | null;
};

type RefCompany = { id: string; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
type RefJob = { id: string; title: string; salary_min: number | null; salary_max: number | null; work_style: string | null } | null;
type RefArticle = { id: string; slug: string; title: string } | null;

type PostItem = {
  id: string;
  content: string;
  post_type: string;
  image_url: string | null;
  created_at: string;
  user: PostUser;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  link_url: string | null;
  link_title: string | null;
  link_image_url: string | null;
  link_description: string | null;
  link_domain: string | null;
  event_title: string | null;
  event_starts_at: string | null;
  event_location: string | null;
  ref_company?: RefCompany;
  ref_job?: RefJob;
  ref_article?: RefArticle;
};

type CommentItem = {
  id: string;
  content: string;
  created_at: string;
  user: PostUser;
};

type Props = {
  initialPosts: PostItem[];
  myUserId: string | null;
  myName: string | null;
  myAvatarColor: string | null;
  myAvatarUrl: string | null;
  myLikedPostIds: string[];
  sidebarFollows: SidebarFollow[];
  sidebarSavedJobs: SidebarJob[];
  sidebarMentors: SidebarMentor[];
};

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}日前`;
  return new Date(iso).toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
}

function nameInitial(name: string | null): string {
  if (!name) return "?";
  // 日本語名: 最初の1文字
  return name.charAt(0);
}

// ─── アバターコンポーネント ────────────────────────────────────────────────────

function Avatar({
  user,
  size = 40,
}: {
  user: PostUser | { name: string | null; avatar_color: string | null; avatar_url: string | null };
  size?: number;
}) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name ?? ""}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  const gradient =
    user.avatar_color ?? "linear-gradient(135deg, var(--royal), var(--accent))";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
    >
      {nameInitial(user.name ?? null)}
    </div>
  );
}

// ─── PostComposer ─────────────────────────────────────────────────────────────

function PostComposer({
  myUserId,
  myName,
  myAvatarColor,
  myAvatarUrl,
  onPostCreated,
}: {
  myUserId: string;
  myName: string | null;
  myAvatarColor: string | null;
  myAvatarUrl: string | null;
  onPostCreated: (post: PostItem) => void;
}) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // リンクプレビュー
  type OgpPreview = { linkUrl: string; linkTitle: string | null; linkImageUrl: string | null; linkDescription: string | null; linkDomain: string | null };
  const [ogpPreview, setOgpPreview] = useState<OgpPreview | null>(null);
  const [ogpFetching, setOgpFetching] = useState(false);
  const ogpFetchedUrl = useRef<string | null>(null);

  // 本文からhttpsのURLを1つ抽出
  function extractFirstUrl(text: string): string | null {
    const m = /https?:\/\/[^\s　、。！？」）\]>）」』"'>]+/.exec(text);
    return m?.[0] ?? null;
  }

  const MAX_CHARS = 1000;
  const remaining = MAX_CHARS - content.length;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // プレビュー
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Supabase Storage へアップロード
    setUploading(true);
    setError(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `posts/${myUserId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ow-uploads")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage
        .from("ow-uploads")
        .getPublicUrl(path);
      setImageUrl(pub.publicUrl);
    } catch (err) {
      setError("画像のアップロードに失敗しました");
      setImagePreview(null);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    setError(null);

    // OGP取得（best-effort: 失敗しても投稿を続行）
    let linkPayload: {
      link_url: string | null;
      link_title: string | null;
      link_image_url: string | null;
      link_description: string | null;
      link_domain: string | null;
    } = { link_url: null, link_title: null, link_image_url: null, link_description: null, link_domain: null };

    // 既にプレビュー取得済みならそれを使う、なければ投稿時に取得
    const detectedUrl = extractFirstUrl(content.trim());
    if (detectedUrl) {
      const preview = ogpPreview && ogpPreview.linkUrl === detectedUrl ? ogpPreview : null;
      if (preview) {
        linkPayload = {
          link_url: preview.linkUrl,
          link_title: preview.linkTitle,
          link_image_url: preview.linkImageUrl,
          link_description: preview.linkDescription,
          link_domain: preview.linkDomain,
        };
      } else {
        // 先読みされていない場合は投稿ボタン押下時に取得
        try {
          setOgpFetching(true);
          const ogRes = await fetch("/api/jobseeker/ogp-fetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: detectedUrl }),
          });
          if (ogRes.ok) {
            const ogData = await ogRes.json();
            let domain: string | null = null;
            try { domain = new URL(detectedUrl).hostname; } catch { /* ignore */ }
            linkPayload = {
              link_url: detectedUrl,
              link_title: ogData.og_title ?? null,
              link_image_url: ogData.og_image_url ?? null,
              link_description: null,
              link_domain: domain,
            };
          }
        } catch {
          // OGP取得失敗は無視。link系はnullで投稿
        } finally {
          setOgpFetching(false);
        }
      }
    }

    try {
      const res = await fetch("/api/jobseeker/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), image_url: imageUrl, ...linkPayload }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message ?? "投稿に失敗しました");
      }
      const { post } = await res.json();
      onPostCreated({
        ...post,
        user: { id: myUserId, name: myName ?? "自分", avatar_color: myAvatarColor, avatar_url: myAvatarUrl },
        like_count: 0,
        comment_count: 0,
        liked_by_me: false,
        link_url: linkPayload.link_url,
        link_title: linkPayload.link_title,
        link_image_url: linkPayload.link_image_url,
        link_description: linkPayload.link_description,
        link_domain: linkPayload.link_domain,
      });
      setContent("");
      setImageUrl(null);
      setImagePreview(null);
      setOgpPreview(null);
      ogpFetchedUrl.current = null;
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setPosting(false);
    }
  };

  // テキストエリア onChange 時にURLを検出して先読み（デバウンス600ms）
  const ogpDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (ogpDebounceRef.current) clearTimeout(ogpDebounceRef.current);
    ogpDebounceRef.current = setTimeout(async () => {
      const url = extractFirstUrl(val);
      if (!url || url === ogpFetchedUrl.current) return;
      ogpFetchedUrl.current = url;
      setOgpFetching(true);
      setOgpPreview(null);
      try {
        const res = await fetch("/api/jobseeker/ogp-fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (res.ok) {
          const data = await res.json();
          let domain: string | null = null;
          try { domain = new URL(url).hostname; } catch { /* ignore */ }
          setOgpPreview({
            linkUrl: url,
            linkTitle: data.og_title ?? null,
            linkImageUrl: data.og_image_url ?? null,
            linkDescription: null,
            linkDomain: domain,
          });
        }
      } catch { /* silent */ } finally {
        setOgpFetching(false);
      }
    }, 600);
  };

  return (
    <div
      style={{
        background: "#fff",
        border: focused
          ? "1.5px solid var(--accent)"
          : "1.5px solid var(--line)",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 16,
        boxShadow: focused
          ? "0 0 0 3px rgba(59,95,217,0.08)"
          : "0 1px 4px rgba(15,23,42,0.06)",
        transition: "box-shadow 0.2s, border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar
          user={{ name: myName, avatar_color: myAvatarColor, avatar_url: myAvatarUrl }}
          size={40}
        />
        <div style={{ flex: 1 }}>
          <textarea
            value={content}
            onChange={handleContentChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="今日のキャリアの気づきをシェアしよう…"
            maxLength={MAX_CHARS}
            rows={3}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              resize: "vertical",
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 15,
              color: "var(--ink)",
              background: "transparent",
              lineHeight: 1.7,
              boxSizing: "border-box",
              minHeight: 80,
            }}
          />

          {/* リンクプレビュー（OGP先読み） */}
          {ogpFetching && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mute)" }}>
              🔗 リンク情報を取得中…
            </div>
          )}
          {ogpPreview && !ogpFetching && (
            <div style={{ marginTop: 10 }}>
              <LinkPreviewCard
                linkUrl={ogpPreview.linkUrl}
                linkTitle={ogpPreview.linkTitle}
                linkImageUrl={ogpPreview.linkImageUrl}
                linkDescription={ogpPreview.linkDescription}
                linkDomain={ogpPreview.linkDomain}
              />
            </div>
          )}

          {/* 画像プレビュー */}
          {imagePreview && (
            <div style={{ position: "relative", marginTop: 12 }}>
              <img
                src={imagePreview}
                alt="preview"
                style={{
                  width: "100%",
                  maxHeight: 240,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                }}
              />
              <button
                onClick={handleRemoveImage}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(15,23,42,0.6)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
              {uploading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(255,255,255,0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    fontFamily: '"Noto Sans JP", sans-serif',
                    fontSize: 13,
                    color: "var(--ink-soft)",
                  }}
                >
                  アップロード中…
                </div>
              )}
            </div>
          )}

          {error && (
            <p
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "var(--error)",
                fontFamily: '"Noto Sans JP", sans-serif',
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
              gap: 8,
            }}
          >
            {/* 画像添付 */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="画像を添付"
              style={{
                background: "none",
                border: "none",
                cursor: uploading ? "not-allowed" : "pointer",
                padding: "6px 10px",
                borderRadius: 8,
                color: "var(--ink-soft)",
                fontSize: 18,
                transition: "background 0.15s",
                opacity: uploading ? 0.5 : 1,
              }}
            >
              📷
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* 文字数カウンター */}
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  color: remaining < 50 ? "var(--error)" : "var(--ink-mute)",
                }}
              >
                残り {remaining}
              </span>
              {/* 投稿ボタン */}
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || posting || uploading}
                style={{
                  background:
                    content.trim() && !posting && !uploading
                      ? "var(--royal)"
                      : "var(--line)",
                  color:
                    content.trim() && !posting && !uploading
                      ? "#fff"
                      : "var(--ink-mute)",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 20px",
                  fontFamily: '"Noto Sans JP", sans-serif',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor:
                    content.trim() && !posting && !uploading
                      ? "pointer"
                      : "not-allowed",
                  transition: "background 0.2s, color 0.2s",
                }}
              >
                {posting ? "投稿中…" : "投稿する"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CommentSection ───────────────────────────────────────────────────────────

function CommentSection({
  postId,
  myUserId,
  myName,
  myAvatarColor,
  myAvatarUrl,
  onCommentCountChange,
}: {
  postId: string;
  myUserId: string | null;
  myName: string | null;
  myAvatarColor: string | null;
  myAvatarUrl: string | null;
  onCommentCountChange: (delta: number) => void;
}) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初回展開時にコメント取得
  const loadComments = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/jobseeker/posts/${postId}/comments`);
      if (!res.ok) throw new Error();
      const { comments: data } = await res.json();
      setComments(data ?? []);
      setLoaded(true);
    } catch {
      setError("コメントの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [postId, loaded]);

  // 展開時に自動ロード
  useEffect(() => {
    loadComments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || submitting || !myUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobseeker/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message ?? "コメントの送信に失敗しました");
      }
      const { comment } = await res.json();
      setComments((prev) => [
        ...prev,
        {
          ...comment,
          user: {
            id: myUserId,
            name: myName ?? "自分",
            avatar_color: myAvatarColor,
            avatar_url: myAvatarUrl,
          },
        },
      ]);
      onCommentCountChange(1);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "コメントの送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(
        `/api/jobseeker/posts/${postId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentCountChange(-1);
    } catch {
      // best-effort
    }
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--line)",
        marginTop: 12,
        paddingTop: 16,
      }}
    >
      {loading && (
        <p
          style={{
            fontFamily: '"Noto Sans JP", sans-serif',
            fontSize: 13,
            color: "var(--ink-mute)",
            marginBottom: 12,
          }}
        >
          読み込み中…
        </p>
      )}

      {/* コメント一覧 */}
      {comments.map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 14,
            alignItems: "flex-start",
          }}
        >
          <Avatar user={c.user} size={32} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                background: "var(--bg-tint)",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Link
                  href={`/u/${c.user.id}`}
                  style={{
                    fontFamily: '"Noto Sans JP", sans-serif',
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--royal)",
                    textDecoration: "none",
                  }}
                >
                  {c.user.name}
                </Link>
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 11,
                    color: "var(--ink-mute)",
                  }}
                >
                  {relativeTime(c.created_at)}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: '"Noto Sans JP", sans-serif',
                  fontSize: 14,
                  color: "var(--ink)",
                  lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {c.content}
              </p>
            </div>
            {myUserId && c.user.id === myUserId && (
              <button
                onClick={() => handleDeleteComment(c.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--ink-mute)",
                  marginTop: 4,
                  padding: "2px 4px",
                  fontFamily: '"Noto Sans JP", sans-serif',
                }}
              >
                削除
              </button>
            )}
          </div>
        </div>
      ))}

      {error && (
        <p
          style={{
            fontSize: 13,
            color: "var(--error)",
            fontFamily: '"Noto Sans JP", sans-serif',
            marginBottom: 8,
          }}
        >
          {error}
        </p>
      )}

      {/* コメント入力欄（ログイン済みのみ） */}
      {myUserId ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <Avatar
            user={{ name: myName, avatar_color: myAvatarColor, avatar_url: myAvatarUrl }}
            size={32}
          />
          <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="コメントを書く…"
              maxLength={300}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              style={{
                flex: 1,
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "10px 14px",
                fontFamily: '"Noto Sans JP", sans-serif',
                fontSize: 14,
                color: "var(--ink)",
                background: "var(--bg-tint)",
                outline: "none",
                resize: "none",
                lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || submitting}
              style={{
                background: input.trim() && !submitting ? "var(--royal)" : "var(--line)",
                color: input.trim() && !submitting ? "#fff" : "var(--ink-mute)",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontFamily: '"Noto Sans JP", sans-serif',
                fontWeight: 700,
                fontSize: 13,
                cursor: input.trim() && !submitting ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
                transition: "background 0.2s",
              }}
            >
              {submitting ? "送信中" : "送信"}
            </button>
          </div>
        </div>
      ) : (
        <p
          style={{
            fontFamily: '"Noto Sans JP", sans-serif',
            fontSize: 13,
            color: "var(--ink-mute)",
          }}
        >
          <Link href="/auth?next=/feed" style={{ color: "var(--accent)" }}>
            ログイン
          </Link>
          するとコメントできます
        </p>
      )}
    </div>
  );
}

// ─── FeedSidebar ──────────────────────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: "16px 18px",
  marginBottom: 12,
  boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
};

const PANEL_TITLE_STYLE: React.CSSProperties = {
  fontFamily: '"Noto Sans JP", sans-serif',
  fontSize: 12,
  fontWeight: 700,
  color: "var(--ink-mute)",
  letterSpacing: "0.05em",
  marginBottom: 12,
  textTransform: "uppercase" as const,
};

const MORE_LINK_STYLE: React.CSSProperties = {
  display: "block",
  marginTop: 10,
  fontSize: 12,
  color: "var(--royal)",
  fontFamily: '"Noto Sans JP", sans-serif',
  fontWeight: 600,
  textDecoration: "none",
};

function formatSalary(min: number | null, max: number | null): string {
  const hasMn = min != null && min > 0;
  const hasMx = max != null && max > 0;
  if (!hasMn && !hasMx) return "応相談";
  if (hasMn && hasMx) return `${min}〜${max}万円`;
  if (hasMn) return `${min}万円〜`;
  return `〜${max}万円`;
}

function FeedSidebar({
  follows,
  savedJobs,
  mentors,
}: {
  follows: SidebarFollow[];
  savedJobs: SidebarJob[];
  mentors: SidebarMentor[];
}) {
  return (
    <div style={{ width: 260, flexShrink: 0 }}>
      {/* (a) フォロー中の企業 */}
      {follows.length > 0 && (
        <div style={PANEL_STYLE}>
          <p style={PANEL_TITLE_STYLE}>フォロー中の企業</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {follows.map((co) => (
              <Link
                key={co.id}
                href={`/companies/${co.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                    background: co.logo_gradient ?? "linear-gradient(135deg, #001233, #002366)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "Inter, sans-serif",
                    overflow: "hidden",
                  }}
                >
                  {co.logo_url
                    ? <img src={co.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (co.logo_letter ?? (co.brand_name ?? co.name).charAt(0))}
                </div>
                <span style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {co.brand_name ?? co.name}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/companies" style={MORE_LINK_STYLE}>企業一覧を見る →</Link>
        </div>
      )}

      {/* (b) 気になる求人 */}
      {savedJobs.length > 0 && (
        <div style={PANEL_STYLE}>
          <p style={PANEL_TITLE_STYLE}>気になる求人</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {savedJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                style={{ display: "flex", flexDirection: "column", gap: 2, textDecoration: "none" }}
              >
                <span style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.title}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {job.companyName && (
                    <span style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 11, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {job.companyName}
                    </span>
                  )}
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "var(--success)", fontWeight: 600, flexShrink: 0 }}>
                    {formatSalary(job.salary_min, job.salary_max)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/jobs" style={MORE_LINK_STYLE}>求人一覧を見る →</Link>
        </div>
      )}

      {/* (c) 面談OKな人 */}
      {mentors.length > 0 && (
        <div style={PANEL_STYLE}>
          <p style={PANEL_TITLE_STYLE}>面談OKな人</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mentors.map((m) => (
              <Link
                key={m.id}
                href={`/mentors/${m.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
              >
                {m.photo_url ? (
                  <img src={m.photo_url} alt={m.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: m.avatar_color ?? "linear-gradient(135deg, var(--royal), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "Inter, sans-serif", flexShrink: 0 }}>
                    {(m.name ?? "?").charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name}
                  </div>
                  {(m.current_role || m.current_company) && (
                    <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 11, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[m.current_role, m.current_company].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <Link href="/mentors" style={MORE_LINK_STYLE}>先輩一覧を見る →</Link>
        </div>
      )}
    </div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  myUserId,
  myName,
  myAvatarColor,
  myAvatarUrl,
  onDelete,
  onLikeToggle,
}: {
  post: PostItem;
  myUserId: string | null;
  myName: string | null;
  myAvatarColor: string | null;
  myAvatarUrl: string | null;
  onDelete: (id: string) => void;
  onLikeToggle: (id: string, liked: boolean, delta: number) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();

  const isOwner = myUserId !== null && !post.user.is_system && post.user.id === myUserId;

  const handleLike = async () => {
    if (!myUserId) { router.push("/auth?next=/feed"); return; }
    if (liking) return;
    const wasLiked = post.liked_by_me;
    setLiking(true);
    // 楽観的更新
    onLikeToggle(post.id, !wasLiked, wasLiked ? -1 : 1);
    try {
      const method = wasLiked ? "DELETE" : "POST";
      const res = await fetch(`/api/jobseeker/posts/${post.id}/likes`, { method });
      if (!res.ok) {
        // ロールバック
        onLikeToggle(post.id, wasLiked, wasLiked ? 1 : -1);
      }
    } catch {
      onLikeToggle(post.id, wasLiked, wasLiked ? 1 : -1);
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/jobseeker/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) onDelete(post.id);
    } catch {
      // best-effort
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 10,
        boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
      }}
    >
      {/* ヘッダー: アバター + 名前 + 時刻 + 削除 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* アバター: システム(企業)=角丸正方形, 個人=円形 */}
          {post.user.is_system ? (
            <div
              style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: post.user.avatar_color ?? "linear-gradient(135deg, var(--royal), var(--accent))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 18,
                overflow: "hidden",
              }}
            >
              {post.user.avatar_url
                ? <img src={post.user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : nameInitial(post.user.name)}
            </div>
          ) : (
            <Link href={`/u/${post.user.id}`}>
              <Avatar user={post.user} size={44} />
            </Link>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {post.user.is_system ? (
                <span style={{ fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 15, color: "var(--royal)" }}>
                  {post.user.name}
                </span>
              ) : (
                <Link
                  href={`/u/${post.user.id}`}
                  style={{ fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 15, color: "var(--ink)", textDecoration: "none" }}
                >
                  {post.user.name}
                </Link>
              )}
              {/* バッジ */}
              {post.user.is_system && (
                <span style={{ fontSize: 10, fontFamily: "Inter, sans-serif", fontWeight: 700, color: "var(--royal)", background: "var(--royal-50)", border: "1px solid var(--royal-100)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.03em" }}>
                  企業
                </span>
              )}
              {!post.user.is_system && post.post_type === "mentor_post" && (
                <span style={{ fontSize: 10, fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", border: "1px solid #a7f3d0", borderRadius: 4, padding: "1px 5px" }}>
                  面談OK
                </span>
              )}
            </div>
            {!post.user.is_system && (post.user.roleTitle || post.user.company) && (
              <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                {[post.user.roleTitle, post.user.company].filter(Boolean).join(" · ")}
              </div>
            )}
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginTop: 2, display: "block" }}>
              {relativeTime(post.created_at)}
            </span>
          </div>
        </div>

        {/* 自分の投稿: 削除ボタン */}
        {isOwner && (
          <div>
            {confirmDelete ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-soft)",
                    fontFamily: '"Noto Sans JP", sans-serif',
                  }}
                >
                  削除しますか？
                </span>
                <button
                  onClick={handleDelete}
                  style={{
                    background: "var(--error)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: '"Noto Sans JP", sans-serif',
                  }}
                >
                  削除
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    background: "var(--line)",
                    color: "var(--ink-soft)",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: '"Noto Sans JP", sans-serif',
                  }}
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="削除"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-mute)",
                  fontSize: 18,
                  padding: "4px 8px",
                  borderRadius: 6,
                  lineHeight: 1,
                }}
              >
                ···
              </button>
            )}
          </div>
        )}
      </div>

      {/* 本文 */}
      <p
        style={{
          margin: "0 0 10px",
          fontFamily: '"Noto Sans JP", sans-serif',
          fontSize: 15,
          color: "var(--ink)",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {post.content}
      </p>

      {/* システム投稿: リッチカード */}
      {post.post_type === "company_joined" && post.ref_company && (
        <Link
          href={`/companies/${post.ref_company.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--royal-50)",
            border: "1px solid var(--royal-100)",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 12,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: post.ref_company.logo_gradient ?? "linear-gradient(135deg, #001233, #002366)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              fontFamily: "Inter, sans-serif",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {post.ref_company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.ref_company.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              (post.ref_company.logo_letter ?? (post.ref_company.brand_name ?? post.ref_company.name).charAt(0))
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 14, color: "var(--royal)" }}>
              {post.ref_company.brand_name ?? post.ref_company.name}
            </div>
            <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
              企業ページを見る →
            </div>
          </div>
        </Link>
      )}

      {post.post_type === "job_posted" && post.ref_job && (
        <Link
          href={`/jobs/${post.ref_job.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--success-soft)",
            border: "1px solid #a7f3d0",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 12,
            textDecoration: "none",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
              {post.ref_job.title}
            </div>
            {(() => {
              const mn = post.ref_job.salary_min;
              const mx = post.ref_job.salary_max;
              const hasMn = mn != null && mn > 0;
              const hasMx = mx != null && mx > 0;
              return hasMn || hasMx ? (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--success)", fontWeight: 600, marginTop: 3 }}>
                  {hasMn && hasMx ? `${mn}〜${mx}万円` : hasMn ? `${mn}万円〜` : `〜${mx}万円`}
                </div>
              ) : (
                <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 12, color: "var(--ink-mute)", marginTop: 3 }}>応相談</div>
              );
            })()}
          </div>
          <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 12, color: "var(--success)", fontWeight: 600, flexShrink: 0 }}>
            求人を見る →
          </div>
        </Link>
      )}

      {post.post_type === "article_published" && post.ref_article && (
        <Link
          href={`/articles/${post.ref_article.slug}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--warm-soft)",
            border: "1px solid #fde68a",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 12,
            textDecoration: "none",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {post.ref_article.title}
            </div>
            <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
              取材記事を読む →
            </div>
          </div>
        </Link>
      )}

      {/* イベントカード */}
      {post.post_type === "event" && post.event_title && (
        <div
          style={{
            background: "var(--purple-soft)",
            border: "1px solid #ddd6fe",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>📅</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 14, color: "var(--purple)" }}>
                {post.event_title}
              </div>
              {post.event_starts_at && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
                  🕐 {new Date(post.event_starts_at).toLocaleString("ja-JP", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              {post.event_location && (
                <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                  📍 {post.event_location}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* メンター投稿: カジュアル面談CTA */}
      {post.post_type === "mentor_post" && !post.user.is_system && (
        <div
          style={{
            background: "var(--success-soft)",
            border: "1px solid #a7f3d0",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 13, color: "var(--success)" }}>
            {post.user.name}さんに話を聞いてみる
          </span>
          <Link
            href={`/u/${post.user.id}`}
            style={{
              fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 12,
              color: "var(--success)", background: "#fff", border: "1px solid #a7f3d0",
              borderRadius: 6, padding: "5px 12px", textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            プロフィールを見る →
          </Link>
        </div>
      )}

      {/* 画像 */}
      {post.image_url && (
        <div style={{ marginBottom: 14 }}>
          <img
            src={post.image_url}
            alt=""
            style={{
              width: "100%",
              maxHeight: 400,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid var(--line)",
            }}
          />
        </div>
      )}

      {/* リンクプレビュー */}
      {post.link_url && (
        <div style={{ marginBottom: 14 }}>
          <LinkPreviewCard
            linkUrl={post.link_url}
            linkTitle={post.link_title}
            linkImageUrl={post.link_image_url}
            linkDescription={post.link_description}
            linkDomain={post.link_domain}
          />
        </div>
      )}

      {/* フッター: いいね + コメント */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingTop: 8,
          borderTop: "1px solid var(--line)",
        }}
      >
        {/* いいねボタン — 未ログイン時は /auth へ誘導 */}
        <button
          onClick={handleLike}
          disabled={liking}
          title={myUserId ? (post.liked_by_me ? "いいねを解除" : "いいね") : "ログインしていいね"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 10px",
            borderRadius: 8,
            color: post.liked_by_me ? "var(--error)" : "var(--ink-soft)",
            fontFamily: '"Noto Sans JP", sans-serif',
            fontSize: 14,
            fontWeight: post.liked_by_me ? 700 : 400,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tint)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "none";
          }}
        >
          <span style={{ fontSize: 16 }}>{post.liked_by_me ? "❤️" : "🤍"}</span>
          <span>{post.like_count}</span>
        </button>

        {/* コメントボタン */}
        <button
          onClick={() => setShowComments((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: showComments ? "var(--royal-50)" : "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 10px",
            borderRadius: 8,
            color: showComments ? "var(--royal)" : "var(--ink-soft)",
            fontFamily: '"Noto Sans JP", sans-serif',
            fontSize: 14,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!showComments)
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--bg-tint)";
          }}
          onMouseLeave={(e) => {
            if (!showComments)
              (e.currentTarget as HTMLButtonElement).style.background = "none";
          }}
        >
          <span style={{ fontSize: 16 }}>💬</span>
          <span>{commentCount}</span>
        </button>
      </div>

      {/* コメント欄 */}
      {showComments && (
        <CommentSection
          postId={post.id}
          myUserId={myUserId}
          myName={myName}
          myAvatarColor={myAvatarColor}
          myAvatarUrl={myAvatarUrl}
          onCommentCountChange={(delta) => setCommentCount((c) => c + delta)}
        />
      )}
    </div>
  );
}

// ─── FeedClient（メイン） ─────────────────────────────────────────────────────

type Tab = "all" | "followed";

export default function FeedClient({
  initialPosts,
  myUserId,
  myName,
  myAvatarColor,
  myAvatarUrl,
  myLikedPostIds: _myLikedPostIds,
  sidebarFollows,
  sidebarSavedJobs,
  sidebarMentors,
}: Props) {
  const [tab, setTab] = useState<Tab>("all");
  // レスポンシブ: 768px 以上でサイドバーを表示
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length > 0);

  // フォロー中タブの状態
  const [followedPosts, setFollowedPosts] = useState<PostItem[] | null>(null); // null = 未ロード
  const [followedLoading, setFollowedLoading] = useState(false);
  const [followedHasMore, setFollowedHasMore] = useState(false);

  const activePosts = tab === "all" ? posts : (followedPosts ?? []);

  const loadFollowed = useCallback(async () => {
    if (followedPosts !== null || followedLoading) return;
    setFollowedLoading(true);
    try {
      const res = await fetch("/api/jobseeker/posts?tab=followed&limit=20");
      if (!res.ok) return;
      const { posts: data } = await res.json();
      setFollowedPosts(data ?? []);
      setFollowedHasMore((data ?? []).length >= 20);
    } catch {
      setFollowedPosts([]);
    } finally {
      setFollowedLoading(false);
    }
  }, [followedPosts, followedLoading]);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === "followed" && followedPosts === null) loadFollowed();
  };

  const handlePostCreated = useCallback((newPost: PostItem) => {
    setPosts((prev) => [newPost, ...prev]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleLikeToggle = useCallback(
    (id: string, liked: boolean, delta: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, liked_by_me: liked, like_count: p.like_count + delta }
            : p
        )
      );
    },
    []
  );

  const handleLoadMore = async () => {
    if (tab === "followed") {
      if (loadingMore || !followedHasMore || !followedPosts?.length) return;
      const oldest = followedPosts[followedPosts.length - 1];
      setLoadingMore(true);
      try {
        const res = await fetch(`/api/jobseeker/posts?tab=followed&limit=20&before=${encodeURIComponent(oldest.created_at)}`);
        if (!res.ok) return;
        const { posts: more } = await res.json();
        if (!more || more.length === 0) { setFollowedHasMore(false); return; }
        setFollowedPosts((prev) => [...(prev ?? []), ...more]);
        if (more.length < 20) setFollowedHasMore(false);
      } catch { /* best-effort */ } finally { setLoadingMore(false); }
      return;
    }
    if (loadingMore || !hasMore) return;
    const oldest = posts[posts.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/jobseeker/posts?limit=20&before=${encodeURIComponent(oldest.created_at)}`);
      if (!res.ok) return;
      const { posts: more } = await res.json();
      if (!more || more.length === 0) { setHasMore(false); return; }
      setPosts((prev) => [...prev, ...more]);
      if (more.length < 20) setHasMore(false);
    } catch {
      // best-effort
    } finally {
      setLoadingMore(false);
    }
  };

  const showLoadMore = tab === "all" ? (hasMore && posts.length > 0) : (followedHasMore && (followedPosts ?? []).length > 0);

  const hasSidebar = sidebarFollows.length > 0 || sidebarSavedJobs.length > 0 || sidebarMentors.length > 0;
  const showSidebar = isDesktop && hasSidebar;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 64px", display: "flex", gap: 24, alignItems: "flex-start" }}>
      {/* 中央フィードカラム */}
      <div style={{ flex: 1, minWidth: 0 }}>
      {/* ページタイトル */}
      <h1
        style={{
          fontFamily: '"Noto Serif JP", serif',
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink)",
          marginBottom: 12,
        }}
      >
        投稿
      </h1>

      {/* タブ */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--line)",
          marginBottom: 16,
          gap: 0,
        }}
      >
        {(["all", "followed"] as const).map((t) => {
          const label = t === "all" ? "すべて" : "フォロー中";
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              style={{
                background: "none",
                border: "none",
                borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
                padding: "8px 18px",
                fontFamily: '"Noto Sans JP", sans-serif',
                fontSize: 14,
                fontWeight: active ? 700 : 400,
                color: active ? "var(--royal)" : "var(--ink-soft)",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 投稿コンポーザー */}
      {myUserId && (
        <PostComposer
          myUserId={myUserId}
          myName={myName}
          myAvatarColor={myAvatarColor}
          myAvatarUrl={myAvatarUrl}
          onPostCreated={handlePostCreated}
        />
      )}

      {/* 未ログイン時の誘導 */}
      {!myUserId && (
        <div
          style={{
            background: "var(--royal-50)",
            border: "1px solid var(--royal-100,#dce5f7)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <p style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: 14, color: "var(--royal)", margin: 0 }}>
            ログインすると投稿・いいね・コメントができます
          </p>
          <Link
            href="/auth"
            style={{
              background: "var(--royal)", color: "#fff", borderRadius: 8,
              padding: "8px 16px", fontFamily: '"Noto Sans JP", sans-serif',
              fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            ログイン
          </Link>
        </div>
      )}

      {/* 投稿リスト */}
      {tab === "followed" && followedLoading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-mute)", fontFamily: '"Noto Sans JP", sans-serif', fontSize: 14 }}>
          読み込み中…
        </div>
      ) : tab === "followed" && followedPosts !== null && followedPosts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 0", color: "var(--ink-mute)", fontFamily: '"Noto Sans JP", sans-serif' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏢</div>
          <p style={{ fontSize: 15, margin: 0, fontWeight: 700, color: "var(--ink-soft)" }}>フォロー中の企業がありません</p>
          <p style={{ fontSize: 13, marginTop: 6, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            企業ページの「フォロー」ボタンを押すと<br />その企業の投稿がここに流れます
          </p>
        </div>
      ) : activePosts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-mute)", fontFamily: '"Noto Sans JP", sans-serif' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <p style={{ fontSize: 15, margin: 0 }}>まだ投稿がありません</p>
          {myUserId && (
            <p style={{ fontSize: 13, marginTop: 6, color: "var(--ink-soft)" }}>
              最初の投稿をシェアしてみましょう
            </p>
          )}
        </div>
      ) : (
        activePosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            myUserId={myUserId}
            myName={myName}
            myAvatarColor={myAvatarColor}
            myAvatarUrl={myAvatarUrl}
            onDelete={handleDelete}
            onLikeToggle={handleLikeToggle}
          />
        ))
      )}

      {/* もっと見るボタン */}
      {showLoadMore && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
              padding: "12px 32px", fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 14, fontWeight: 700,
              color: loadingMore ? "var(--ink-mute)" : "var(--royal)",
              cursor: loadingMore ? "not-allowed" : "pointer",
              boxShadow: "0 1px 4px rgba(15,23,42,0.06)", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (!loadingMore) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tint)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
          >
            {loadingMore ? "読み込み中…" : "もっと見る"}
          </button>
        </div>
      )}
      </div>{/* /中央フィードカラム */}

      {/* 右サイドバー */}
      {showSidebar && (
        <div style={{ position: "sticky", top: 80 }}>
          <FeedSidebar
            follows={sidebarFollows}
            savedJobs={sidebarSavedJobs}
            mentors={sidebarMentors}
          />
        </div>
      )}
    </div>
  );
}
