"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function BookmarkButton({ jobId }: { jobId: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const bookmarkingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    // Check initial bookmark state
    fetch(`/api/bookmarks?target_type=job`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.bookmarks) {
          const ids = new Set(data.bookmarks.map((b: { target_id: string }) => b.target_id));
          setBookmarked(ids.has(jobId));
        }
      })
      .catch(() => {});
  }, [jobId]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmarkingRef.current) return;
    bookmarkingRef.current = true;
    setLoading(true);
    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const res = await fetch("/api/bookmarks", {
        method: prev ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "job", target_id: jobId }),
      });
      if (res.status === 401) {
        setBookmarked(prev);
        router.push(`/auth?next=/jobs/${jobId}`);
        return;
      }
      if (!res.ok) setBookmarked(prev);
    } catch {
      setBookmarked(prev);
    } finally {
      setLoading(false);
      bookmarkingRef.current = false;
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={bookmarked ? "気になりを解除" : "気になる"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: 9,
        border: `1.5px solid ${bookmarked ? "#FBCFE8" : "var(--line)"}`,
        background: bookmarked ? "#FFF0F7" : "#fff",
        color: bookmarked ? "#E11D6B" : "var(--ink-mute)",
        cursor: loading ? "default" : "pointer",
        flexShrink: 0,
        transition: "all 0.18s",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
