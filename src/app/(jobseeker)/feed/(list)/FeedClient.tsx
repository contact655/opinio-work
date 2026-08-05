"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LinkPreviewCard } from "@/components/feed/LinkPreviewCard";
import { FollowUserButton } from "../../u/[id]/FollowUserButton";
import type { SidebarFollow, SidebarUserFollow, SidebarJob, SidebarMentor } from "./page";

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

type RefCompany = { id: string; slug?: string | null; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null; // slug already included
type RefJob = { id: string; slug?: string | null; title: string; salary_min: number | null; salary_max: number | null; work_style: string | null } | null;
type RefArticle = { id: string; slug: string; title: string } | null;

type LikerUser = { id: string; name: string; avatar_color: string | null; avatar_url: string | null };

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
  top_likers?: LikerUser[];
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
  myRoleTitle?: string | null;
  myCompany?: string | null;
  myLikedPostIds: string[];
  sidebarFollows: SidebarFollow[];
  sidebarUserFollows: SidebarUserFollow[];
  sidebarSavedJobs: SidebarJob[];
  sidebarMentors: SidebarMentor[];
  hiddenMembersCount: number;
  /** 閲覧者が既にフォローしている ow_users.id。右レールのフォローボタンの初期状態に使う */
  followedUserIds: string[];
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

// ─── CharCountRing ────────────────────────────────────────────────────────────

function CharCountRing({ remaining, max }: { remaining: number; max: number }) {
  const used = max - remaining;
  const pct = Math.min(used / max, 1);
  const r = 10;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct);
  const isNear = remaining < 100;
  const isOver = remaining < 0;
  const strokeColor = isOver ? "var(--error)" : isNear ? "#f59e0b" : "var(--royal)";

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, flexShrink: 0 }}>
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="14" cy="14" r={r} fill="none" stroke="var(--line)" strokeWidth="2.5" />
        <circle
          cx="14" cy="14" r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.15s, stroke 0.15s" }}
        />
      </svg>
      {isNear && (
        <span style={{
          position: "absolute",
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          color: isOver ? "var(--error)" : "#f59e0b",
          lineHeight: 1,
        }}>
          {remaining}
        </span>
      )}
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
  const [expanded, setExpanded] = useState(false);
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
    } catch {
      setError("画像のアップロードに失敗しました");
      setImagePreview(null);
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

  // コンパクト表示（クリックで展開）
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#fff", border: "1.5px solid var(--line)",
          borderRadius: 14, padding: "12px 16px", cursor: "pointer",
          marginBottom: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(59,95,217,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(15,23,42,0.06)";
        }}
      >
        <Avatar user={{ name: myName, avatar_color: myAvatarColor, avatar_url: myAvatarUrl }} size={38} />
        <div style={{
          flex: 1, color: "var(--ink-mute)", fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          fontSize: 14, border: "1px solid var(--line)", borderRadius: 100,
          padding: "9px 18px", background: "var(--bg-tint)",
        }}>
          今日のキャリアの気づきをシェアしよう…
        </div>
      </div>
    );
  }

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
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
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
                    fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              }}
            >
              {error}
            </p>
          )}

          {/* 投稿タイプボタン行 */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 13px",
                borderRadius: 20,
                border: `1px solid ${imagePreview ? "var(--royal-100)" : "var(--line)"}`,
                background: imagePreview ? "var(--royal-50)" : "#fff",
                color: imagePreview ? "var(--royal)" : "var(--ink-soft)",
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontSize: 12, fontWeight: 600,
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.6 : 1,
                transition: "all 0.15s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              {uploading ? "アップロード中…" : "写真"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 10,
              gap: 8,
            }}
          >

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* 文字数カウンター: 円形プログレスリング */}
              <CharCountRing remaining={remaining} max={MAX_CHARS} />
              {/* 投稿ボタン */}
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || posting || uploading}
                style={{
                  background: "var(--royal)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 20px",
                  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                  fontWeight: 500,
                  fontSize: 14,
                  cursor:
                    content.trim() && !posting && !uploading
                      ? "pointer"
                      : "not-allowed",
                  opacity:
                    content.trim() && !posting && !uploading ? 1 : 0.4,
                  transition: "opacity 0.2s",
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
            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                    fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                    fontSize: 12, fontWeight: 500,
                    color: "var(--ink-mute)",
                  }}
                >
                  {relativeTime(c.created_at)}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                  fontSize: 12, fontWeight: 500,
                  color: "var(--ink-mute)",
                  marginTop: 4,
                  padding: "2px 4px",
                  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  color: "var(--ink-soft)",
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: "1px solid var(--line-soft, #f1f5f9)",
};

const MORE_LINK_STYLE: React.CSSProperties = {
  display: "block",
  marginTop: 10,
  fontSize: 12,
  color: "var(--ink-soft)",
  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
  fontWeight: 500,
  textDecoration: "none",
};

function formatSalary(min: number | null, max: number | null): string {
  const hasMn = min != null && min > 0;
  const hasMx = max != null && max > 0;
  const fmt = (v: number) => v.toLocaleString("ja-JP");
  if (!hasMn && !hasMx) return "応相談";
  if (hasMn && hasMx) return `${fmt(min!)}〜${fmt(max!)}万円`;
  if (hasMn) return `${fmt(min!)}万円〜`;
  return `〜${fmt(max!)}万円`;
}

// ─── 左カラム: ミニプロフィール + ナビ ────────────────────────────────────────

function FeedLeftPanel({
  myUserId,
  myName,
  myAvatarColor,
  myAvatarUrl,
  myRoleTitle,
  myCompany,
}: {
  myUserId: string | null;
  myName: string | null;
  myAvatarColor: string | null;
  myAvatarUrl: string | null;
  myRoleTitle?: string | null;
  myCompany?: string | null;
}) {
  const NAV_ITEMS = [
    {
      href: "/mypage",
      label: "マイページ",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      href: "/mypage/bookmarks",
      label: "保存した投稿",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      href: "/feed?tab=followed",
      label: "フォロー中",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
  ];

  const tagline = myRoleTitle ?? myCompany ?? null;

  return (
    <div style={{ width: 320, flexShrink: 0 }}>
      {/* ミニプロフィールカード */}
      <div style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 10,
        boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
      }}>
        {/* カバー帯 */}
        <div style={{
          height: 44,
          background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
        }} />
        {/* アバター + 名前 */}
        <div style={{ padding: "0 14px 14px", textAlign: "center" }}>
          <div style={{ marginTop: -20, display: "flex", justifyContent: "center" }}>
            <div style={{ border: "2.5px solid #fff", borderRadius: "50%", display: "inline-block" }}>
              <Avatar
                user={{ name: myName, avatar_color: myAvatarColor, avatar_url: myAvatarUrl }}
                size={36}
              />
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
            fontWeight: 500,
            fontSize: 14,
            color: "var(--ink)",
            marginTop: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {myName ?? "ゲスト"}
          </div>
          {tagline && (
            <div style={{
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontSize: 12, fontWeight: 500,
              color: "var(--ink-soft)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {tagline}
            </div>
          )}
          {myUserId && (
            <Link
              href={`/u/${myUserId}`}
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 12,
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontWeight: 600,
                color: "var(--royal)",
                textDecoration: "none",
                padding: "4px 12px",
                border: "1px solid var(--royal-100)",
                borderRadius: 100,
                background: "var(--royal-50)",
              }}
            >
              プロフィールを見る
            </Link>
          )}
          {!myUserId && (
            <Link
              href="/auth"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 12,
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontWeight: 600,
                color: "#fff",
                textDecoration: "none",
                padding: "4px 12px",
                borderRadius: 100,
                background: "var(--royal)",
              }}
            >
              ログイン
            </Link>
          )}
        </div>
      </div>

      {/* ナビカード */}
      <div style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
      }}>
        {NAV_ITEMS.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "10px 14px",
              textDecoration: "none",
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontSize: 13,
              color: "var(--ink-soft)",
              borderBottom: i < NAV_ITEMS.length - 1 ? "1px solid var(--line)" : "none",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)";
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "";
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)";
            }}
          >
            <span style={{ color: "var(--ink-mute)", flexShrink: 0 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── フォロー中サマリーパネル ──────────────────────────────────────────────────

// ─── 右サイドバー ─────────────────────────────────────────────────────────────

/**
 * 右サイドバー。
 *
 * ⚠️ フォロー中は「企業」と「ユーザー」を1つのパネルにまとめてある（2026-08-04）。
 *    以前はユーザー分が中央カラムの FollowSummaryPanel にあり、
 *    「フォロー中」タブを開いたときしか出なかったので、
 *    既定タブでは存在自体に気づけなかった。
 *    企業フォローは API もボタンも揃っているのに 0行で、導線の弱さが原因と見て
 *    ユーザーフォローは同じ轍を踏まないよう常時見える場所に置いている。
 */
function FeedSidebar({
  follows,
  userFollows,
  savedJobs,
  mentors,
  hiddenMembersCount,
  myUserId,
  followedUserIds,
}: {
  follows: SidebarFollow[];
  userFollows: SidebarUserFollow[];
  savedJobs: SidebarJob[];
  mentors: SidebarMentor[];
  hiddenMembersCount: number;
  /** ow_users.id。未ログインは null */
  myUserId: string | null;
  /** 閲覧者が既にフォローしている ow_users.id */
  followedUserIds: string[];
}) {
  const EMPTY_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
    fontSize: 12,
    color: "var(--ink-mute)",
    margin: "4px 0 8px",
    lineHeight: 1.6,
  };

  return (
    <div style={{ width: 340, flexShrink: 0 }}>
      {/* (a) フォロー中の企業 */}
      <div style={PANEL_STYLE}>
        <p style={{ ...PANEL_TITLE_STYLE, marginTop: 0 }}>フォロー中の企業</p>
        {follows.length === 0 ? (
          <p style={EMPTY_STYLE}>企業をフォローすると<br />ここに表示されます</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {follows.map((co) => (
              <Link
                key={co.id}
                href={`/companies/${co.slug ?? co.id}`}
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
                <span style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {co.brand_name ?? co.name}
                </span>
              </Link>
            ))}
          </div>
        )}
        <Link href="/companies" style={MORE_LINK_STYLE}>企業一覧を見る →</Link>

        {/* ユーザー。企業と同じパネルに置く。見出しで区切るだけにして、
            パネルを分けない（フォローという1つの関心事なので） */}
        <div style={{ height: 1, background: "var(--line-soft)", margin: "14px 0 12px" }} />
        <p style={{ ...PANEL_TITLE_STYLE, marginTop: 0 }}>フォロー中のユーザー</p>
        {userFollows.length === 0 ? (
          <p style={EMPTY_STYLE}>プロフィールからフォローすると<br />ここに表示されます</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {userFollows.map((u) => (
              <Link
                key={u.id}
                href={`/u/${u.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: u.avatar_color ?? "linear-gradient(135deg, #001233, #002366)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "Inter, sans-serif",
                    overflow: "hidden",
                  }}
                >
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : u.name.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.name}
                  </div>
                  {(u.role_title || u.company_name) && (
                    <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[u.role_title, u.company_name].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        <Link href="/people" style={MORE_LINK_STYLE}>ユーザー一覧を見る →</Link>
      </div>

      {/* (b) 気になる求人 */}
      <div style={PANEL_STYLE}>
        <p style={PANEL_TITLE_STYLE}>気になる募集</p>
        {savedJobs.length === 0 ? (
          <p style={EMPTY_STYLE}>求人を保存すると<br />ここに表示されます</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {savedJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.slug ?? job.id}`}
                style={{ display: "flex", flexDirection: "column", gap: 2, textDecoration: "none" }}
              >
                <span style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.title}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {job.companyName && (
                    <span style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {job.companyName}
                    </span>
                  )}
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--success)", fontWeight: 600, flexShrink: 0 }}>
                    {formatSalary(job.salary_min, job.salary_max)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Link href="/jobs" style={MORE_LINK_STYLE}>求人一覧を見る →</Link>
      </div>

      {/* (c) 面談OKな人 */}
      <div style={PANEL_STYLE}>
        <p style={PANEL_TITLE_STYLE}>面談OKな人</p>
        {mentors.length === 0 ? (
          hiddenMembersCount > 0 ? (
            <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
              <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, lineHeight: 1.6 }}>
                ログインすると{hiddenMembersCount}名のプロフィールが見られます
              </div>
              <a href="/auth" style={{ display: "inline-block", padding: "7px 18px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                ログイン / 会員登録 →
              </a>
            </div>
          ) : (
            <p style={EMPTY_STYLE}>まだ登録がありません</p>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mentors.map((m) => (
              // ⚠️ 行全体を Link で包まないこと。中にフォローボタン（button）を置くため。
              //    a の中に button を入れると不正な HTML になり、クリックが両方に飛ぶ。
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* ⚠️ 遷移先は /u/[id]。2026-08-05 まで /mentors/{id} を指していたが、
                    /mentors は next.config.mjs で /people へ 301 されるため、
                    誰を押しても一覧に飛んで個人に辿り着けなかった。 */}
                <Link
                  href={`/u/${m.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flex: 1, minWidth: 0 }}
                >
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: m.avatar_color ?? "linear-gradient(135deg, var(--royal), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "Inter, sans-serif", flexShrink: 0 }}>
                      {(m.name ?? "?").charAt(0)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </div>
                    {(m.current_role || m.current_company) && (
                      <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[m.current_role, m.current_company].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </Link>
                {/* 自分自身には出さない（API も 400 で弾くが、押せるボタンを出さないのが先） */}
                {m.id !== myUserId && (
                  <FollowUserButton
                    targetUserId={m.id}
                    initialFollowed={followedUserIds.includes(m.id)}
                    isAuthenticated={myUserId !== null}
                    compact
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {/* /mentors は /people への 308 リダイレクト。行き先に合わせた文言にする（2026-08-04） */}
        <Link href="/people" style={MORE_LINK_STYLE}>ユーザー一覧を見る →</Link>
      </div>
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
  showDivider = false,
}: {
  post: PostItem;
  myUserId: string | null;
  myName: string | null;
  myAvatarColor: string | null;
  myAvatarUrl: string | null;
  onDelete: (id: string) => void;
  onLikeToggle: (id: string, liked: boolean, delta: number) => void;
  showDivider?: boolean;
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

  const isSystemPost = post.user.is_system;
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/feed`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        padding: "18px 20px",
        borderBottom: showDivider ? "1px solid var(--line-soft, #f1f5f9)" : "none",
        background: isSystemPost ? "#f7f9ff" : "#fff",
        transition: "background 0.12s",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = isSystemPost ? "#eef2fc" : "#fafbfc";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = isSystemPost ? "#f7f9ff" : "#fff";
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
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* アバター: システム(企業)=角丸正方形, 個人=円形 */}
          {post.user.is_system ? (
            <div
              style={{
                width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                background: post.user.avatar_color ?? "linear-gradient(135deg, var(--royal), var(--accent))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15,
                overflow: "hidden",
              }}
            >
              {post.user.avatar_url
                ? <img src={post.user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : nameInitial(post.user.name)}
            </div>
          ) : (
            <Link href={`/u/${post.user.id}`} style={{ flexShrink: 0 }}>
              <Avatar user={post.user} size={38} />
            </Link>
          )}
          <div>
            {/* 名前行: 名前 + バッジ + ・日付(インライン) */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              {post.user.is_system ? (
                <span style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 15, color: "var(--royal)" }}>
                  {post.user.name}
                </span>
              ) : (
                <Link
                  href={`/u/${post.user.id}`}
                  style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 15, color: "var(--ink)", textDecoration: "none" }}
                >
                  {post.user.name}
                </Link>
              )}
              {/* バッジ */}
              {post.user.is_system && (
                <span style={{ fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 700, color: "var(--royal)", background: "var(--royal-50)", border: "1px solid var(--royal-100)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.03em" }}>
                  企業
                </span>
              )}
              {!post.user.is_system && post.post_type === "mentor_post" && (
                <span style={{ fontSize: 12, fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", border: "1px solid #a7f3d0", borderRadius: 4, padding: "1px 5px" }}>
                  面談OK
                </span>
              )}
              {/* 日付インライン */}
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                · {relativeTime(post.created_at)}
              </span>
            </div>
            {/* 役職タグライン: roleTitle があれば役職、なければ会社名 */}
            {!post.user.is_system && (post.user.roleTitle || post.user.company) && (
              <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, color: "var(--ink-soft)", marginTop: 1 }}>
                {post.user.roleTitle ?? post.user.company}
              </div>
            )}
          </div>
        </div>

        {/* 自分の投稿: 削除ボタン */}
        {isOwner && (
          <div>
            {confirmDelete ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 12, fontWeight: 500,
                    color: "var(--ink-soft)",
                    fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                    fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                    fontSize: 12, fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
          margin: "0 0 14px",
          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          fontSize: 15,
          color: "var(--ink)",
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {post.content}
      </p>

      {/* システム投稿: リッチカード */}
      {post.post_type === "company_joined" && post.ref_company && (
        <Link
          href={`/companies/${post.ref_company.slug ?? post.ref_company.id}`}
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
            <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 14, color: "var(--royal)" }}>
              {post.ref_company.brand_name ?? post.ref_company.name}
            </div>
            <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 2 }}>
              企業ページを見る →
            </div>
          </div>
        </Link>
      )}

      {post.post_type === "job_posted" && post.ref_job && (
        <Link
          href={`/jobs/${post.ref_job.slug ?? post.ref_job.id}`}
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
          {/* 会社ロゴ / ブリーフケースアイコン */}
          {post.ref_company ? (
            <div style={{
              width: 38, height: 38, borderRadius: 8, flexShrink: 0,
              background: post.ref_company.logo_gradient ?? "linear-gradient(135deg, #001233, #002366)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "Inter, sans-serif",
              overflow: "hidden",
            }}>
              {post.ref_company.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={post.ref_company.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (post.ref_company.logo_letter ?? post.ref_company.name.charAt(0))}
            </div>
          ) : (
            <div style={{
              width: 38, height: 38, borderRadius: 8, flexShrink: 0,
              background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 3 }}>応相談</div>
              );
            })()}
          </div>
          <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, color: "var(--success)", fontWeight: 600, flexShrink: 0 }}>
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
            <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {post.ref_article.title}
            </div>
            <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 2 }}>
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
              <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 14, color: "var(--purple)" }}>
                {post.event_title}
              </div>
              {post.event_starts_at && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 4 }}>
                  🕐 {new Date(post.event_starts_at).toLocaleString("ja-JP", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              {post.event_location && (
                <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 2 }}>
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
          <span style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, color: "var(--success)" }}>
            {post.user.name}さんに話を聞いてみる
          </span>
          <Link
            href={`/u/${post.user.id}`}
            style={{
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 12,
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

      {/* フッター: いいね + コメント + ブックマーク */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingTop: 12,
          borderTop: "1px solid var(--line-soft, #f1f5f9)",
          marginTop: 4,
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
            padding: "6px 12px",
            borderRadius: 8,
            color: post.liked_by_me ? "var(--error)" : "var(--ink-soft)",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: post.liked_by_me ? 700 : 500,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = post.liked_by_me ? "#fff0f0" : "var(--bg-tint)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "none";
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={post.liked_by_me ? "currentColor" : "none"} stroke="currentColor" strokeWidth={post.liked_by_me ? 1.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>いいね{post.like_count > 0 ? ` ${post.like_count}` : ""}</span>
        </button>

        {/* リアクションしたユーザーのアバター (1件以上のとき) */}
        {post.like_count > 0 && post.top_likers && post.top_likers.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", marginLeft: 2 }}>
            {post.top_likers.slice(0, 3).map((liker, i) => (
              <div
                key={liker.id}
                title={liker.name}
                style={{
                  width: 20, height: 20, borderRadius: "50%",
                  marginLeft: i === 0 ? 0 : -6,
                  border: "1.5px solid #fff",
                  zIndex: 3 - i,
                  position: "relative",
                  background: liker.avatar_color ?? "linear-gradient(135deg, var(--royal), var(--accent))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 12, fontFamily: "Inter, sans-serif",
                  overflow: "hidden", flexShrink: 0,
                }}
              >
                {liker.avatar_url
                  ? <img src={liker.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : nameInitial(liker.name)}
              </div>
            ))}
            {post.like_count > 3 && (
              <span style={{ marginLeft: 5, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                +{post.like_count - 3}
              </span>
            )}
          </div>
        )}

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
            padding: "6px 12px",
            borderRadius: 8,
            color: showComments ? "var(--royal)" : "var(--ink-soft)",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!showComments)
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tint)";
          }}
          onMouseLeave={(e) => {
            if (!showComments)
              (e.currentTarget as HTMLButtonElement).style.background = "none";
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>コメント{commentCount > 0 ? ` ${commentCount}` : ""}</span>
        </button>

        {/* シェアボタン + ブックマークボタン (右端) */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
          <button
            onClick={handleShare}
            title="リンクをコピー"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "none", border: "none", cursor: "pointer",
              padding: "6px 10px", borderRadius: 8,
              color: copied ? "var(--royal)" : "var(--ink-mute)",
              fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500,
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tint)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
            <span>{copied ? "コピー済み" : "シェア"}</span>
          </button>
          <button
            title="保存"
            style={{
              display: "flex", alignItems: "center",
              background: "none", border: "none", cursor: "pointer",
              padding: "6px 8px", borderRadius: 6,
              color: "var(--ink-mute)",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tint)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-mute)";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
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
  myRoleTitle,
  myCompany,
  myLikedPostIds: _myLikedPostIds,
  sidebarFollows,
  sidebarUserFollows,
  sidebarSavedJobs,
  sidebarMentors,
  hiddenMembersCount,
  followedUserIds,
}: Props) {
  const [tab, setTab] = useState<Tab>("all");
  // レスポンシブ: ≥768px で右サイドバー表示、≥1024px で左カラムも表示
  const [isDesktop, setIsDesktop] = useState(false);
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsDesktop(window.innerWidth >= 768);
      setIsWide(window.innerWidth >= 1024);
    };
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

  const handleLoadMore = useCallback(async () => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loadingMore, hasMore, followedHasMore, followedPosts, posts]);

  const showLoadMore = tab === "all" ? (hasMore && posts.length > 0) : (followedHasMore && (followedPosts ?? []).length > 0);

  // 無限スクロール: センチネル要素が画面内に入ったら自動ロード
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && showLoadMore && !loadingMore) {
          handleLoadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showLoadMore, loadingMore, handleLoadMore]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px 64px", display: "flex", gap: 24, alignItems: "flex-start" }}>

      {/* 左カラム: ミニプロフィール + ナビ (≥1024px) */}
      {isWide && (
        <div style={{ position: "sticky", top: 80, flexShrink: 0 }}>
          <FeedLeftPanel
            myUserId={myUserId}
            myName={myName}
            myAvatarColor={myAvatarColor}
            myAvatarUrl={myAvatarUrl}
            myRoleTitle={myRoleTitle}
            myCompany={myCompany}
          />
        </div>
      )}

      {/* 中央フィードカラム */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
          <p style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 14, color: "var(--royal)", margin: 0 }}>
            ログインすると投稿・いいね・コメントができます
          </p>
          <Link
            href="/auth"
            style={{
              background: "var(--royal)", color: "#fff", borderRadius: 8,
              padding: "8px 16px", fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            ログイン
          </Link>
        </div>
      )}

      {/* 投稿リスト */}
      {tab === "followed" && followedLoading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-mute)", fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 14 }}>
          読み込み中…
        </div>
      ) : tab === "followed" && followedPosts !== null && followedPosts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ink-mute)", fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif' }}>
          <p style={{ fontSize: 14, margin: 0, color: "var(--ink-soft)" }}>フォロー中の投稿はまだありません</p>
        </div>
      ) : activePosts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-mute)", fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <p style={{ fontSize: 15, margin: 0 }}>まだ投稿がありません</p>
          {myUserId && (
            <p style={{ fontSize: 13, marginTop: 6, color: "var(--ink-soft)" }}>
              最初の投稿をシェアしてみましょう
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          {activePosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              myUserId={myUserId}
              myName={myName}
              myAvatarColor={myAvatarColor}
              myAvatarUrl={myAvatarUrl}
              onDelete={handleDelete}
              onLikeToggle={handleLikeToggle}
              showDivider={index < activePosts.length - 1}
            />
          ))}
        </div>
      )}

      {/* 無限スクロール: センチネル + ローディング表示 */}
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--ink-mute)", fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
      )}
      {!showLoadMore && (activePosts.length > 0) && (
        <div style={{ textAlign: "center", padding: "16px 0 8px", color: "var(--ink-mute)", fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, fontWeight: 500 }}>
          すべての投稿を読み込みました
        </div>
      )}
      </div>{/* /中央フィードカラム */}

      {/* 右サイドバー (≥768px) */}
      {isDesktop && (
        <div style={{ position: "sticky", top: 80, flexShrink: 0 }}>
          <FeedSidebar
            follows={sidebarFollows}
            userFollows={sidebarUserFollows}
            savedJobs={sidebarSavedJobs}
            mentors={sidebarMentors}
            hiddenMembersCount={hiddenMembersCount}
            myUserId={myUserId}
            followedUserIds={followedUserIds}
          />
        </div>
      )}
    </div>
  );
}
