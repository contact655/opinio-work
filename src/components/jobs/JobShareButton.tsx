"use client";

import { useState, useEffect } from "react";
import type React from "react";

export function JobInlineShare({
  jobId,
  jobTitle,
  companyName,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://opinio.jp");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const shareUrl = `${origin}/jobs/${jobId}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${jobTitle} — ${companyName} | OPINIO`)}&url=${encodeURIComponent(`https://opinio.jp/jobs/${jobId}`)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  /* ★2026-11-26: ヘッダーカードのボタン行に置く形にした（「保存」の隣）。処理は前と同じ（URL をコピー／X で共有）。
        ⚠️ 高さは隣の保存ボタン（BookmarkButton の inline・36px）にそろえる */
  const btn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    minHeight: 36, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
    border: `1px solid ${copied ? "#A7F3D0" : "var(--line)"}`,
    background: copied ? "var(--success-soft)" : "var(--bg-tint)",
    color: copied ? "var(--success-ink)" : "var(--ink-soft)", cursor: "pointer",
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" onClick={handleCopy} style={btn} aria-label={copied ? "URLをコピーしました" : "この募集のURLをコピーしてシェア"}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
          {copied
            ? <polyline points="20 6 9 17 4 12"/>
            : <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></>}
        </svg>
        {copied ? "コピーしました" : "シェア"}
      </button>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="X でシェア"
        aria-label="X でシェア"
        className="btn-fixed-size"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "#000", color: "#fff", textDecoration: "none" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.263 5.632 5.9-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>
    </span>
  );
}
