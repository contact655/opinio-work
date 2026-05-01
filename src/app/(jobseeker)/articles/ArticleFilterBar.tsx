"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { ARTICLE_TYPES, TYPE_BADGE } from "@/app/articles/mockArticleData";

const LINE = "var(--line)";
const INK_SOFT = "var(--ink-soft)";
const INK_MUTE = "var(--ink-mute)";

export default function ArticleFilterBar({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type") ?? "all";
  const currentSort = searchParams.get("sort") ?? "latest";

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "all" || value === "latest") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
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

          {/* Type filter pills */}
          {ARTICLE_TYPES.map(({ value, label }) => {
            const active = currentType === value;
            const badge = value !== "all" ? TYPE_BADGE[value] : null;
            return (
              <button
                key={value}
                onClick={() => updateParam("type", value === "all" ? null : value)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 500,
                  border: `1.5px solid ${active ? (badge?.color ?? "var(--royal)") : LINE}`,
                  background: active ? (badge?.bg ?? "var(--royal-50)") : "#fff",
                  color: active ? (badge?.color ?? "var(--royal)") : INK_SOFT,
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
