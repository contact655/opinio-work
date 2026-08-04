"use client";

import { useState } from "react";

type Props = {
  linkUrl: string;
  linkTitle: string | null;
  linkImageUrl: string | null;
  linkDescription: string | null;
  linkDomain: string | null;
};

export function LinkPreviewCard({
  linkUrl,
  linkTitle,
  linkImageUrl,
  linkDescription,
  linkDomain,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const showImage = linkImageUrl && !imgError;
  const displayDomain = linkDomain ?? (() => {
    try { return new URL(linkUrl).hostname; } catch { return linkUrl; }
  })();

  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          display: "flex",
          border: "1px solid var(--line)",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
          transition: "box-shadow 0.15s, border-color 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,35,102,0.08)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--royal-100)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
        }}
      >
        {/* サムネイル */}
        {showImage && (
          <div style={{ flexShrink: 0, width: 120 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={linkImageUrl}
              alt=""
              onError={() => setImgError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {/* テキスト */}
        <div
          style={{
            flex: 1,
            padding: "10px 14px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 4,
          }}
        >
          {/* ドメイン */}
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12, fontWeight: 500,
              color: "var(--ink-mute)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            🔗 {displayDomain}
          </div>

          {/* タイトル */}
          {linkTitle && (
            <div
              style={{
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontSize: 13,
                fontWeight: 700,
                color: "var(--ink)",
                lineHeight: 1.45,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {linkTitle}
            </div>
          )}

          {/* 説明（あれば） */}
          {linkDescription && (
            <div
              style={{
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontSize: 12, fontWeight: 500,
                color: "var(--ink-soft)",
                lineHeight: 1.5,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {linkDescription}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
