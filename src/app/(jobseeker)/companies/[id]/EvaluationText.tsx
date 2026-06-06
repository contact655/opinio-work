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
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: "var(--space-2)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: "var(--text-sm)",
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
