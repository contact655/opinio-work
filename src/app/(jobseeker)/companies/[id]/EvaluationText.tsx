"use client";

import { useState } from "react";

const THRESHOLD = 180;
const PREVIEW_SENTENCES = 2;

function extractSentences(text: string): string[] {
  return text
    .split(/。|。\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function EvaluationText({ text }: { text: string }) {
  const isLong = text.length > THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const sentences = extractSentences(text);
  const previewSentences = sentences.slice(0, PREVIEW_SENTENCES);
  const hasMore = sentences.length > PREVIEW_SENTENCES;

  return (
    <div>
      {isLong && !expanded ? (
        /* 折りたたみ時: bullet point プレビュー */
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
          {previewSentences.map((s, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{
                flexShrink: 0, marginTop: 6,
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--royal)", opacity: 0.5,
                display: "inline-block",
              }} />
              <span style={{ fontSize: "var(--text-base)", color: "var(--ink-soft)", lineHeight: 1.9 }}>
                {s}。
              </span>
            </li>
          ))}
          {hasMore && (
            <li style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 14 }}>
              <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>…他 {sentences.length - PREVIEW_SENTENCES} 項目</span>
            </li>
          )}
        </ul>
      ) : (
        /* 展開時: フルテキスト */
        <p
          style={{
            fontSize: "var(--text-base)",
            color: "var(--ink-soft)",
            lineHeight: 1.9,
            margin: 0,
          }}
        >
          {text}
        </p>
      )}
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
              続きを読む（全文）
            </>
          )}
        </button>
      )}
    </div>
  );
}
