"use client";

import { useState, useEffect } from "react";

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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
      <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, flexShrink: 0 }}>シェア：</span>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? "コピー済み" : "URLをコピー"}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: 8,
          background: copied ? "var(--success-soft)" : "var(--bg-tint)",
          color: copied ? "var(--success)" : "var(--ink-mute)",
          border: `1px solid ${copied ? "#A7F3D0" : "var(--line)"}`,
          cursor: "pointer", transition: "all 0.2s",
        }}
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        )}
      </button>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="X でシェア"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: 8,
          background: "#000", color: "#fff", textDecoration: "none",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.263 5.632 5.9-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>
    </div>
  );
}
