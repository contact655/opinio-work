"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * LP ヒーローの検索。Intent Modes（企業／求人）は検索スコープそのもので、
 * モードを切り替えても入力中のクエリは保持したまま遷移先だけが変わる。
 * LP は入口に徹し、絞り込みの本体は遷移先の一覧ページが担う。
 */
type Mode = "companies" | "jobs";

const MODES: { key: Mode; label: string; placeholder: string; path: string }[] = [
  { key: "companies", label: "企業を調べる", placeholder: "会社名・業種で探す", path: "/companies" },
  { key: "jobs",      label: "求人を探す",   placeholder: "職種・キーワードで探す", path: "/jobs" },
];

export function HeroSearch({ navy, line, muted }: { navy: string; line: string; muted: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("companies"); // 既定は「企業を調べる」
  const [q, setQ] = useState("");

  const active = MODES.find((m) => m.key === mode)!;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `${active.path}?q=${encodeURIComponent(query)}` : active.path);
  }

  return (
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 720 }}>
      {/* Intent Modes — 検索欄の上に置き、スコープを先に選ばせる */}
      <div role="tablist" aria-label="検索の対象" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {MODES.map((m) => {
          const on = m.key === mode;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setMode(m.key)}
              style={{
                padding: "8px 18px",
                borderRadius: "10px 10px 0 0",
                border: `1px solid ${on ? line : "transparent"}`,
                borderBottom: "none",
                background: on ? "#fff" : "transparent",
                color: on ? navy : muted,
                fontSize: 14,
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: "#fff",
          border: `1px solid ${line}`,
          borderRadius: 12,
          boxShadow: "0 8px 28px rgba(14,33,72,.08)",
          overflow: "hidden",
        }}
      >
        <span style={{ display: "grid", placeItems: "center", padding: "0 4px 0 18px", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" style={{ display: "block", color: muted }}>
            <circle cx="10.6" cy="10.6" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M15.4 15.4L20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={active.placeholder}
          aria-label={active.placeholder}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            padding: "18px 12px",
            fontSize: 16,
            fontFamily: "inherit",
            color: "inherit",
            background: "transparent",
          }}
        />
        <button
          type="submit"
          style={{
            flexShrink: 0,
            margin: 6,
            padding: "0 26px",
            borderRadius: 8,
            border: "none",
            background: navy,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          検索
        </button>
      </div>
    </form>
  );
}
