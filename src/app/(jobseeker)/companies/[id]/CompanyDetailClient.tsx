"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookmarkButton({
  companyName,
  companyId,
  initialBookmarked,
  isAuthenticated,
}: {
  companyName: string;
  companyId: string;
  initialBookmarked: boolean;
  isAuthenticated: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Optimistic update
    const next = !bookmarked;
    setBookmarked(next);
    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "company", target_id: companyId }),
      });
      if (!res.ok) setBookmarked(!next); // revert on failure
    } catch {
      setBookmarked(!next); // revert on network error
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={bookmarked ? "ブックマーク済み" : `${companyName}をブックマーク`}
      style={{
        width: 40,
        height: 40,
        border: `1px solid ${bookmarked ? "var(--royal-100)" : "var(--line)"}`,
        background: bookmarked ? "var(--royal-50)" : "#fff",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: bookmarked ? "var(--royal)" : "var(--ink-soft)",
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
