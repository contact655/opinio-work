"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useBookmarkState,
  invalidateBookmarks,
  type BookmarkTargetType,
} from "@/lib/bookmarks/useBookmarkState";

/**
 * 汎用ブックマークボタン
 * target_type: "company" | "job" | "mentor" | "article"
 *
 * ⚠️ `initialBookmarked` / `isAuthenticated` は**任意**（2026-08-09）。
 *
 *    渡す   … 呼び出し側が既に一覧を持っている場合（`/jobs` の JobsClient）。
 *             二重取得にならない。
 *    渡さない … 詳細ページなど。ボタンが自分で取りに行く。
 *             サーバーで引くとページが動的化して ISR が効かなくなるため、
 *             **詳細ページでは渡さないこと。**
 */
export function BookmarkButton({
  targetType,
  targetId,
  label,
  initialBookmarked,
  isAuthenticated,
  variant = "icon-only",
}: {
  targetType: BookmarkTargetType;
  targetId: string;
  label: string;
  initialBookmarked?: boolean;
  isAuthenticated?: boolean;
  /** "icon-only": 星アイコンのみ（40×40px）、"with-text": テキスト付きボタン */
  variant?: "icon-only" | "with-text";
}) {
  // props で渡されていないときだけ自分で取る
  const selfManaged = initialBookmarked === undefined || isAuthenticated === undefined;
  const fetched = useBookmarkState(targetType, targetId);

  const [bookmarked, setBookmarked] = useState(initialBookmarked ?? false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 自前取得のときは、取れた時点で反映する
  useEffect(() => {
    if (selfManaged && fetched.ready) setBookmarked(fetched.bookmarked);
  }, [selfManaged, fetched.ready, fetched.bookmarked]);

  // props 経由のときは、親の値の変化に追従する（従来どおり）
  useEffect(() => {
    if (!selfManaged && initialBookmarked !== undefined) setBookmarked(initialBookmarked);
  }, [selfManaged, initialBookmarked]);

  const authed = selfManaged ? fetched.authenticated : !!isAuthenticated;

  const toggle = async () => {
    if (selfManaged && !fetched.ready) return; // 取得前は状態が確定しないので待つ
    if (!authed) {
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
      else invalidateBookmarks(targetType);
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
