"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likeCount: number;
  isLiked: boolean;
  isOwner: boolean;
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
}

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const TRUNCATE = 200;
  const isTruncatable = post.content.length > TRUNCATE;
  const displayContent = isTruncatable && !expanded
    ? post.content.slice(0, TRUNCATE) + "…"
    : post.content;

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    // Optimistic update
    setLiked((v) => !v);
    setLikeCount((c) => liked ? c - 1 : c + 1);

    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) {
      // Revert on error
      setLiked((v) => !v);
      setLikeCount((c) => liked ? c + 1 : c - 1);
    }
    setLiking(false);
  }

  async function handleDelete() {
    if (!confirm("この投稿を削除しますか？")) return;
    setDeleting(true);
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    setDeleting(false);
    router.refresh();
  }

  return (
    <div style={{
      padding: "16px",
      borderRadius: 10,
      background: "#fff",
      border: "1px solid var(--line)",
      boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
    }}>
      {/* 画像 */}
      {post.image_url && (
        <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.image_url} alt="" style={{ width: "100%", objectFit: "cover", maxHeight: 240 }} />
        </div>
      )}

      {/* 本文 */}
      <p style={{
        fontSize: 14, color: "var(--ink)", lineHeight: 1.8, margin: "0 0 10px",
        whiteSpace: "pre-wrap",
      }}>
        {displayContent}
      </p>
      {isTruncatable && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--royal)", fontSize: 12, fontWeight: 600, padding: 0,
            marginBottom: 10, fontFamily: "inherit",
          }}
        >
          {expanded ? "折りたたむ ▲" : "もっと見る ▼"}
        </button>
      )}

      {/* フッター */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* いいね */}
        <button
          onClick={handleLike}
          disabled={liking}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: liked ? "#FEE2E2" : "var(--bg-tint)",
            border: `1.5px solid ${liked ? "#FECACA" : "var(--line)"}`,
            borderRadius: 100, padding: "4px 12px",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            color: liked ? "var(--error)" : "var(--ink-mute)",
            transition: "all 0.15s", fontFamily: "inherit",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24"
            fill={liked ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {likeCount > 0 ? likeCount : "いいね"}
        </button>

        {/* 投稿時間 */}
        <span style={{
          fontSize: 12, fontWeight: 500, color: "var(--ink-mute)",
          fontFamily: "Inter, sans-serif",
          flex: 1,
        }}>
          {relativeTime(post.created_at)}
        </span>

        {/* 削除（オーナーのみ） */}
        {post.isOwner && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--ink-mute)", fontSize: 12, fontWeight: 500,
              padding: "4px 8px", borderRadius: 6,
              fontFamily: "inherit",
              opacity: deleting ? 0.5 : 1,
            }}
          >
            {deleting ? "削除中…" : "削除"}
          </button>
        )}
      </div>
    </div>
  );
}
