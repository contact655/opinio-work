"use client";

import { useState } from "react";

export function ProfileShareButton({ userId, name }: { userId: string; name: string }) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined"
    ? `${window.location.origin}/u/${userId}`
    : `https://opinio.jp/u/${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleXShare = () => {
    const text = `${name}さんのキャリアプロフィール（OPINIO）`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {/* URLコピー */}
      <button
        type="button"
        onClick={handleCopy}
        title="プロフィールURLをコピー"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "7px 12px",
          background: copied ? "var(--success-soft)" : "var(--line-soft)",
          color: copied ? "var(--success)" : "var(--ink-soft)",
          border: `1px solid ${copied ? "#A7F3D0" : "var(--line)"}`,
          borderRadius: "var(--radius-md)",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          transition: "all 0.2s",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            コピーしました
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            URLをコピー
          </>
        )}
      </button>

      {/* X (Twitter) シェア */}
      <button
        type="button"
        onClick={handleXShare}
        title="X (Twitter) でシェア"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34,
          background: "var(--line-soft)",
          color: "var(--ink-soft)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          transition: "all 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#000";
          e.currentTarget.style.color = "#fff";
          e.currentTarget.style.borderColor = "#000";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--line-soft)";
          e.currentTarget.style.color = "var(--ink-soft)";
          e.currentTarget.style.borderColor = "var(--line)";
        }}
      >
        {/* X logo */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.733-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
        </svg>
      </button>
    </div>
  );
}
