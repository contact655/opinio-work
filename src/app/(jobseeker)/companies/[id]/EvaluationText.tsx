"use client";

import { useState } from "react";

const THRESHOLD = 180;

export default function EvaluationText({ text }: { text: string }) {
  const isLong = text.length > THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div style={{ position: "relative" }}>
        <p
          style={{
            fontSize: "var(--text-base)",
            color: "var(--ink-soft)",
            lineHeight: 1.9,
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: expanded || !isLong ? "unset" : 3,
          } as React.CSSProperties}
        >
          {text}
        </p>
        {isLong && !expanded && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: 40,
            background: "linear-gradient(to bottom, transparent, #fff)",
            pointerEvents: "none",
          }} />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 16px",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 700,
            color: "var(--royal)",
            background: "var(--royal-50)",
            border: "1px solid var(--royal-100)",
            cursor: "pointer",
            fontFamily: "var(--font-noto-sans)",
          }}
        >
          {expanded ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              折りたたむ
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              続きを読む
            </>
          )}
        </button>
      )}
    </div>
  );
}
