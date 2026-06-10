"use client";

import { useState, useRef, useEffect } from "react";

export function ProfileShareButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/u/${userId}`
      : `https://opinio.jp/u/${userId}`;

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1800);
    } catch {
      /* fallback: ignore */
    }
  };

  const handleXShare = () => {
    const text = `${name}さんのキャリアプロフィール（OPINIO）`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* ─ トリガーボタン ─ */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="プロフィールをシェア"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "6px 13px",
          borderRadius: 20,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(4px)",
          color: "var(--ink-soft)",
          border: "1px solid var(--line)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "box-shadow 0.15s, background 0.15s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          fontFamily: "inherit",
        }}
      >
        {/* share icon */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        シェア
      </button>

      {/* ─ ドロップダウン ─ */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: "4px",
            zIndex: 50,
            minWidth: 170,
            animation: "fadeInUp 0.12s ease",
          }}
        >
          {/* URLコピー */}
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              padding: "9px 12px",
              borderRadius: 7,
              background: copied ? "var(--success-soft)" : "transparent",
              color: copied ? "var(--success)" : "var(--ink)",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "background 0.1s",
            }}
          >
            {copied ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            {copied ? "コピーしました！" : "リンクをコピー"}
          </button>

          {/* Xシェア */}
          <button
            type="button"
            onClick={handleXShare}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              padding: "9px 12px",
              borderRadius: 7,
              background: "transparent",
              color: "var(--ink)",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {/* X logo */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.733-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
            Xでシェア
          </button>
        </div>
      )}
    </div>
  );
}
