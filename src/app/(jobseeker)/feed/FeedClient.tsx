"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

// ─── 型定義 ──────────────────────────────────────────────────────────────────

type PostUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  avatar_url: string | null;
  roleTitle?: string | null;
  company?: string | null;
};

type PostItem = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user: PostUser;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
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
    try {
      const res = await fetch("/api/jobseeker/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), image_url: imageUrl }),
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
      });
      setContent("");
      setImageUrl(null);
      setImagePreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setPosting(false);
    }
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
            onChange={(e) => setContent(e.target.value)}
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
          <Link href="/auth" style={{ color: "var(--accent)" }}>
            ログイン
          </Link>
          するとコメントできます
        </p>
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

  const isOwner = myUserId !== null && post.user.id === myUserId;

  const handleLike = async () => {
    if (!myUserId || liking) return;
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
          <Link href={`/u/${post.user.id}`}>
            <Avatar user={post.user} size={44} />
          </Link>
          <div>
            <Link
              href={`/u/${post.user.id}`}
              style={{
                fontFamily: '"Noto Sans JP", sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              {post.user.name}
            </Link>
            {(post.user.roleTitle || post.user.company) && (
              <div
                style={{
                  fontFamily: '"Noto Sans JP", sans-serif',
                  fontSize: 12,
                  color: "var(--ink-soft)",
                  marginTop: 2,
                }}
              >
                {[post.user.roleTitle, post.user.company].filter(Boolean).join(" · ")}
              </div>
            )}
            <Link
              href={`/feed/${post.id}`}
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                color: "var(--ink-mute)",
                marginTop: 2,
                display: "block",
                textDecoration: "none",
              }}
            >
              {relativeTime(post.created_at)}
            </Link>
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
        {/* いいねボタン */}
        <button
          onClick={handleLike}
          disabled={!myUserId || liking}
          title={myUserId ? (post.liked_by_me ? "いいねを解除" : "いいね") : "ログインしていいね"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: myUserId ? "pointer" : "default",
            padding: "4px 10px",
            borderRadius: 8,
            color: post.liked_by_me ? "var(--error)" : "var(--ink-soft)",
            fontFamily: '"Noto Sans JP", sans-serif',
            fontSize: 14,
            fontWeight: post.liked_by_me ? 700 : 400,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (myUserId)
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--bg-tint)";
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

export default function FeedClient({
  initialPosts,
  myUserId,
  myName,
  myAvatarColor,
  myAvatarUrl,
  // myLikedPostIds は initialPosts に liked_by_me として既に組み込まれているため直接参照しない
  myLikedPostIds: _myLikedPostIds,
}: Props) {
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length === 20);

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
    if (loadingMore || !hasMore) return;
    const oldest = posts[posts.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/jobseeker/posts?limit=20&before=${encodeURIComponent(oldest.created_at)}`
      );
      if (!res.ok) return;
      const { posts: more } = await res.json();
      if (!more || more.length === 0) {
        setHasMore(false);
        return;
      }
      // liked_by_me は API が返す値をそのまま使う
      setPosts((prev) => [...prev, ...more]);
      if (more.length < 20) setHasMore(false);
    } catch {
      // best-effort
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "24px 16px 64px",
      }}
    >
      {/* ページタイトル */}
      <h1
        style={{
          fontFamily: '"Noto Serif JP", serif',
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink)",
          marginBottom: 16,
        }}
      >
        投稿
      </h1>

      {/* 投稿コンポーザー（ログイン済みのみ） */}
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
          <p
            style={{
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 14,
              color: "var(--royal)",
              margin: 0,
            }}
          >
            ログインすると投稿・いいね・コメントができます
          </p>
          <Link
            href="/auth"
            style={{
              background: "var(--royal)",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 16px",
              fontFamily: '"Noto Sans JP", sans-serif',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            ログイン
          </Link>
        </div>
      )}

      {/* 投稿リスト */}
      {posts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 0",
            color: "var(--ink-mute)",
            fontFamily: '"Noto Sans JP", sans-serif',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <p style={{ fontSize: 15, margin: 0 }}>まだ投稿がありません</p>
          {myUserId && (
            <p style={{ fontSize: 13, marginTop: 6, color: "var(--ink-soft)" }}>
              最初の投稿をシェアしてみましょう
            </p>
          )}
        </div>
      ) : (
        posts.map((post) => (
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
      {hasMore && posts.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "12px 32px",
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 14,
              fontWeight: 700,
              color: loadingMore ? "var(--ink-mute)" : "var(--royal)",
              cursor: loadingMore ? "not-allowed" : "pointer",
              boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!loadingMore)
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--bg-tint)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
            }}
          >
            {loadingMore ? "読み込み中…" : "もっと見る"}
          </button>
        </div>
      )}
    </div>
  );
}
