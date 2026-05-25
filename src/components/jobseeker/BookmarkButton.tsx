"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 汎用ブックマークボタン
 * target_type: "company" | "job" | "mentor" | "article"
 */
export function BookmarkButton({
  targetType,
  targetId,
  label,
  initialBookmarked,
  isAuthenticated,
  variant = "icon-only",
}: {
  targetType: "company" | "job" | "mentor" | "article";
  targetId: string;
  label: string;
  initialBookmarked: boolean;
  isAuthenticated: boolean;
  /** "icon-only": 星アイコンのみ（40×40px）、"with-text": テキスト付きボタン */
  variant?: "icon-only" | "with-text";
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      if (!res.ok) setBookmarked(!next);
    } catch {
      setBookmarked(!next);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "with-text") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        style={{
          width: "100%",
          padding: "11px 0",
          background: bookmarked ? "var(--warm-soft)" : "var(--bg-tint)",
          color: bookmarked ? "#B45309" : "var(--ink-soft)",
          border: `1px solid ${bookmarked ? "var(--warm)" : "var(--line)"}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.2s",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarked ? "#B45309" : "none"} stroke="currentColor" strokeWidth={2.5}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {bookmarked ? "ブックマーク済み" : label}
      </button>
    );
  }

  // icon-only variant
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={bookmarked ? "ブックマーク済み" : label}
      aria-label={bookmarked ? "ブックマーク済み" : label}
      aria-pressed={bookmarked}
      style={{
        width: 40,
        height: 40,
        border: `1px solid ${bookmarked ? "var(--warm)" : "var(--line)"}`,
        background: bookmarked ? "var(--warm-soft)" : "#fff",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: bookmarked ? "var(--warm)" : "var(--ink-soft)",
        cursor: loading ? "default" : "pointer",
        fontSize: 18,
        transition: "all 0.2s",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {bookmarked ? "★" : "☆"}
    </button>
  );
}
