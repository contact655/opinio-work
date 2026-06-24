"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const CATEGORIES = [
  { key: "all",       label: "すべて",           emoji: "📋" },
  { key: "event",     label: "イベント",          emoji: "📅" },
  { key: "hiring",    label: "採用情報",          emoji: "💼" },
  { key: "culture",   label: "カルチャー",        emoji: "🏢" },
  { key: "interview", label: "社員インタビュー",  emoji: "🎙" },
  { key: "product",   label: "プロダクト",        emoji: "🚀" },
  { key: "other",     label: "その他",            emoji: "📌" },
];

const LINE = "var(--line)";
const INK_MUTE = "var(--ink-mute)";

type Props = {
  currentCategory: string;
  currentQ: string;
  categoryCounts: Record<string, number>;
  total: number;
};

export default function PostsTimelineFilter({ currentCategory, currentQ, categoryCounts, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router]
  );

  return (
    <div style={{
      position: "sticky", top: 64, zIndex: 50,
      background: "#fff",
      borderBottom: `1px solid ${LINE}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "14px 20px 0" }}>

        {/* ── カテゴリチップ ── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 12, WebkitOverflowScrolling: "touch" as unknown as undefined }}>
          {CATEGORIES.map(({ key, label, emoji }) => {
            const count = categoryCounts[key] ?? 0;
            const active = currentCategory === key;
            if (key !== "all" && count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => update("category", key)}
                style={{
                  flexShrink: 0,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 13px", borderRadius: 100,
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  border: active ? "1.5px solid var(--royal)" : `1.5px solid ${LINE}`,
                  background: active ? "var(--royal)" : "#fff",
                  color: active ? "#fff" : "var(--ink-soft)",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{emoji}</span>
                {label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: active ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.07)",
                  borderRadius: 100, padding: "1px 5px",
                  fontFamily: "Inter, sans-serif",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── 検索 + 件数 ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK_MUTE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              defaultValue={currentQ}
              placeholder="タイトル・本文で検索"
              onChange={(e) => {
                const val = e.target.value;
                const timer = (e.target as HTMLInputElement & { _timer?: ReturnType<typeof setTimeout> })._timer;
                if (timer) clearTimeout(timer);
                (e.target as HTMLInputElement & { _timer?: ReturnType<typeof setTimeout> })._timer = setTimeout(() => update("q", val || null), 400);
              }}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "7px 10px 7px 32px",
                border: `1.5px solid ${currentQ ? "var(--royal)" : LINE}`,
                borderRadius: 100, fontSize: 12.5,
                color: "var(--ink)", background: "#fff", outline: "none",
                fontFamily: "inherit",
              }}
              aria-label="投稿を検索"
            />
          </div>
          <span aria-live="polite" style={{ fontSize: 12, color: INK_MUTE, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif", marginLeft: "auto" }}>
            <strong style={{ color: "var(--royal)", fontSize: 14 }}>{total}</strong> 件
          </span>
        </div>
      </div>
    </div>
  );
}
