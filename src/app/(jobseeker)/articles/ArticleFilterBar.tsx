"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import { ARTICLE_TYPES } from "@/app/articles/mockArticleData";

const LINE = "var(--line)";
const INK_SOFT = "var(--ink-soft)";
const INK_MUTE = "var(--ink-mute)";

export default function ArticleFilterBar({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type") ?? "all";
  const currentSort = searchParams.get("sort") ?? "latest";
  const currentQ    = searchParams.get("q") ?? "";

  const [localQ, setLocalQ] = useState(currentQ);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "all" || value === "latest") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  const handleQueryChange = useCallback((val: string) => {
    setLocalQ(val);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (val.trim()) params.set("q", val.trim());
      else params.delete("q");
      router.push(`${pathname}?${params.toString()}`);
    }, 400);
  }, [searchParams, pathname, router]);

  return (
    <div style={{
      position: "sticky", top: 64, zIndex: 50,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${LINE}`,
    }}>
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
        <div style={{ padding: "10px 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>

          {/* Keyword search */}
          <div style={{ position: "relative", minWidth: 160, flex: "0 1 200px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK_MUTE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="タイトル・企業名で検索"
              value={localQ}
              onChange={(e) => handleQueryChange(e.target.value)}
              aria-label="記事を検索"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "7px 28px 7px 30px",
                border: `1.5px solid ${localQ ? "var(--royal)" : LINE}`,
                borderRadius: 100,
                fontSize: 12.5, color: "var(--ink)",
                background: "#fff", outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
            />
            {localQ && (
              <button
                onClick={() => handleQueryChange("")}
                aria-label="検索をクリア"
                style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: INK_MUTE, fontSize: 14, lineHeight: 1, padding: 0 }}
              >×</button>
            )}
          </div>

          {/* Type filter pills */}
          {ARTICLE_TYPES.map(({ value, label }) => {
            const active = currentType === value;
            return (
              <button
                key={value}
                onClick={() => updateParam("type", value === "all" ? null : value)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 500,
                  border: active ? "1.5px solid var(--royal)" : `1.5px solid ${LINE}`,
                  background: active ? "var(--royal)" : "#fff",
                  color: active ? "#fff" : INK_SOFT,
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {label}
                {active && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Count */}
          <span style={{ fontSize: 13, color: INK_MUTE, whiteSpace: "nowrap" }}>
            <strong style={{ color: "var(--royal)", fontSize: 15, fontFamily: "Inter, sans-serif" }}>{total}</strong> 本
          </span>

          {/* Sort */}
          <select
            value={currentSort}
            onChange={(e) => updateParam("sort", e.target.value === "latest" ? null : e.target.value)}
            style={{
              padding: "7px 12px", border: `1px solid ${LINE}`, borderRadius: 8,
              background: "#fff", fontSize: 13, color: INK_SOFT, cursor: "pointer", outline: "none",
            }}
          >
            <option value="latest">新着順</option>
            <option value="popular">読了時間順</option>
          </select>
        </div>
      </div>
    </div>
  );
}
