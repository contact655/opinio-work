"use client";

import { useState } from "react";

export default function BookmarkButton({ companyName }: { companyName: string }) {
  const [bookmarked, setBookmarked] = useState(false);

  return (
    <button
      onClick={() => setBookmarked(!bookmarked)}
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
        cursor: "pointer",
        fontSize: 18,
        transition: "all 0.2s",
      }}
    >
      {bookmarked ? "★" : "☆"}
    </button>
  );
}
