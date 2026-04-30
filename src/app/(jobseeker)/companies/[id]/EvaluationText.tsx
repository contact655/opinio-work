"use client";

import { useState } from "react";

const THRESHOLD = 180; // 文字数でトランケート判断

export default function EvaluationText({ text }: { text: string }) {
  const isLong = text.length > THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p
        style={{
          fontSize: 14,
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
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 8,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: 13,
            color: "var(--accent)",
            fontWeight: 600,
          }}
        >
          {expanded ? "閉じる ↑" : "続きを読む ↓"}
        </button>
      )}
    </div>
  );
}
