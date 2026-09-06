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

  const currentView = searchParams.get("view") ?? "list";

  return (
    <div style={{
      position: "sticky", top: 60, zIndex: 30,
      background: "#fff",
      borderBottom: `1px solid ${LINE}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      padding: "20px 0 0",
    }} className="px-5 md:px-12">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 8, padding: "12px 0 14px" }}>

        {/* ── 行1: 検索バー + カテゴリタブ + [right: 表示切替] ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
          {/* Keyword search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
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
                padding: "9px 28px 9px 30px",
                border: `1.5px solid ${localQ ? "var(--royal)" : LINE}`,
                borderRadius: 100, height: 38,
                fontSize: 13, color: "var(--ink)",
                background: "#fff", outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
            />
            {localQ && (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                aria-label="検索をクリア"
                style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: INK_MUTE, fontSize: "var(--text-base)", lineHeight: 1, padding: 0 }}
              ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            )}
          </div>

          {/* Type filter pills */}
          <div role="tablist" aria-label="記事タイプで絞り込み" style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
          {ARTICLE_TYPES.map(({ value, label }) => {
            const active = currentType === value;
            return (
              <button
                type="button"
                key={value}
                role="tab"
                aria-selected={active}
                onClick={() => updateParam("type", value === "all" ? null : value)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500,
                  border: active ? "1.5px solid var(--royal)" : `1.5px solid ${LINE}`,
                  background: active ? "var(--royal-50)" : "#fff",
                  color: active ? "var(--royal)" : INK_SOFT,
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "all 0.15s", flexShrink: 0,
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
          </div>

        </div>

        {/* ── 行2: 並び順 + 表示切替 + 件数 ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}>
          <span style={{ fontSize: 12, color: INK_MUTE, whiteSpace: "nowrap", fontWeight: 500, marginRight: 4 }}>並び順:</span>
          {([
            { value: "latest",  label: "新着順" },
            { value: "popular", label: "読了時間順" },
          ] as const).map(({ value, label }) => {
            const active = currentSort === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => updateParam("sort", value === "latest" ? null : value)}
                style={{
                  height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  border: `1px solid ${active ? "var(--royal)" : LINE}`,
                  background: active ? "var(--royal)" : "#fff",
                  color: active ? "#fff" : INK_MUTE,
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}

          {/* View toggle + 件数 — 行2 右端 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
            {/* ⚠️★**表示切替は `/companies` の `GridSortBar` と同じ見た目にする**（2026-09-06）。
                   それまでは articles だけ「白い箱 + 影 + royal の文字」で、
                   企業一覧の「濃紺の塗り + 白文字」と違っていた。
                ⚠️ ボタンのスタイルは globals.css の **`.view-btn`**（企業一覧と共有）。
                   ここに padding や font-size を書き足さないこと —— 2ページでまたズレる。
                ⚠️ **ラベルは「グリッド / リスト」のまま。** 企業一覧の「一覧 / 詳細」に
                   揃えないこと —— あちらの「詳細」は情報量の多い行を指すが、
                   記事のリストは**逆に省スペースな行**で、意味が合わない。 */}
            <div style={{
              display: "flex", gap: 2,
              background: "var(--line-soft)", borderRadius: 8, padding: 2,
            }}>
              {([
                { mode: "grid", label: "グリッド", title: "グリッド表示", icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                )},
                { mode: "list", label: "リスト", title: "リスト表示", icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                  </svg>
                )},
              ] as const).map(({ mode, label, title, icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateParam("view", mode === "list" ? null : mode)}
                  className="view-btn"
                  title={title}
                  style={{
                    background: currentView === mode ? "var(--royal)" : "transparent",
                    color: currentView === mode ? "#fff" : "var(--ink-mute)",
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: "var(--line)" }} />
            <span aria-live="polite" aria-atomic="true" style={{ fontSize: 13, color: INK_MUTE, whiteSpace: "nowrap", fontWeight: 500 }}>
              <strong style={{ color: "var(--ink)", fontWeight: 800, fontSize: 16, fontFamily: "var(--font-inter), var(--font-noto)" }}>{total}</strong> 本
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
