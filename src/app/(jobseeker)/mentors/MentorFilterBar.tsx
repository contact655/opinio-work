"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { MENTOR_DEPTS, MENTOR_INDUSTRIES, MENTOR_THEMES } from "./mockMentorData";

// ─── Theme pills (quick-filter shortcuts) ─────────────────────────────────────

const THEME_PILLS = [
  { label: "すべて", value: null },
  { label: "SaaS営業", value: "SaaS営業" },
  { label: "カスタマーサクセス", value: "カスタマーサクセス" },
  { label: "プロダクトマネージャー", value: "プロダクトマネージャー" },
  { label: "マーケティング", value: "マーケティング" },
  { label: "外資IT", value: "外資IT" },
  { label: "転職相談全般", value: "転職・転職活動" },
];

const ROYAL = "var(--royal)";
const LINE = "var(--line)";
const INK_SOFT = "var(--ink-soft)";
const INK_MUTE = "var(--ink-mute)";

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown({ label, options, paramKey: _paramKey, value, onSelect }: {
  label: string;
  options: string[];
  paramKey: string;
  value: string | null;
  onSelect: (val: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const hasValue = !!value;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={value ? `${label}: ${value}（変更）` : `${label}で絞り込む`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px",
          border: `1.5px solid ${hasValue ? ROYAL : LINE}`,
          borderRadius: 100,
          background: hasValue ? "var(--royal-50)" : "#fff",
          color: hasValue ? ROYAL : INK_SOFT,
          fontSize: 13, fontWeight: 500,
          cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        {value ?? label}
        {hasValue && (
          <span style={{
            background: ROYAL, color: "#fff", fontSize: 10, fontWeight: 700,
            padding: "1px 5px", borderRadius: 100, lineHeight: 1.4,
          }}>✓</span>
        )}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12,
          boxShadow: "0 12px 36px rgba(15,23,42,0.12)",
          padding: 14, minWidth: 220, maxHeight: 300, overflowY: "auto",
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {hasValue && (
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${LINE}`, background: "var(--bg-tint)",
                  color: INK_MUTE, cursor: "pointer",
                }}
              >
                クリア
              </button>
            )}
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onSelect(opt); setOpen(false); }}
                style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${value === opt ? ROYAL : LINE}`,
                  background: value === opt ? ROYAL : "#fff",
                  color: value === opt ? "#fff" : INK_SOFT,
                  cursor: "pointer",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MentorFilterBar({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dept     = searchParams.get("dept");
  const industry = searchParams.get("industry");
  const theme    = searchParams.get("theme");
  const sort     = searchParams.get("sort") ?? "default";
  const q        = searchParams.get("q") ?? "";

  const [localQ, setLocalQ] = useState(q);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
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

  const hasAnyFilter = !!(dept || industry || theme || q);

  return (
    <div style={{
      position: "sticky", top: 64, zIndex: 50,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${LINE}`,
    }}>
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
        <div style={{ padding: "11px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

          {/* Keyword search */}
          <div style={{ position: "relative", minWidth: 180, flex: "0 1 220px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK_MUTE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="名前・会社名・テーマ"
              value={localQ}
              onChange={(e) => handleQueryChange(e.target.value)}
              aria-label="メンターを検索"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "8px 32px 8px 33px",
                border: `1.5px solid ${localQ ? ROYAL : LINE}`,
                borderRadius: 100,
                fontSize: 13, color: "var(--ink)",
                background: "#fff", outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
            />
            {localQ && (
              <button
                onClick={() => handleQueryChange("")}
                aria-label="検索をクリア"
                style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: INK_MUTE, fontSize: 14, lineHeight: 1, padding: 0 }}
              >×</button>
            )}
          </div>

          <Dropdown
            label="職種"
            options={MENTOR_DEPTS}
            paramKey="dept"
            value={dept}
            onSelect={(v) => updateParam("dept", v)}
          />
          <Dropdown
            label="業種"
            options={MENTOR_INDUSTRIES}
            paramKey="industry"
            value={industry}
            onSelect={(v) => updateParam("industry", v)}
          />
          <Dropdown
            label="相談テーマ"
            options={MENTOR_THEMES}
            paramKey="theme"
            value={theme}
            onSelect={(v) => updateParam("theme", v)}
          />

          {hasAnyFilter && (
            <button
              onClick={() => { setLocalQ(""); router.push(pathname); }}
              style={{
                padding: "8px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                border: "none", background: "none", color: INK_MUTE,
                cursor: "pointer", textDecoration: "underline",
              }}
            >
              すべてクリア
            </button>
          )}

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 13, color: INK_MUTE, whiteSpace: "nowrap" }}>
            <strong style={{ color: ROYAL, fontSize: 15, fontFamily: "Inter, sans-serif" }}>{total}</strong> 名
          </span>

          {/* Sort toggle: default ↔ success_count */}
          <button
            onClick={() => updateParam("sort", sort === "sessions" ? null : "sessions")}
            aria-pressed={sort === "sessions"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "7px 13px", borderRadius: 100, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${sort === "sessions" ? ROYAL : LINE}`,
              background: sort === "sessions" ? "var(--royal-50)" : "#fff",
              color: sort === "sessions" ? ROYAL : INK_MUTE,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            相談実績順
          </button>
        </div>

        {/* ── Theme pill quick-filter row ─────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          overflowX: "auto", paddingBottom: 10,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        } as React.CSSProperties}
          className="mentor-theme-pills"
        >
          {THEME_PILLS.map(({ label, value }) => {
            const isActive = value === null ? !theme : theme === value;
            return (
              <button
                key={label}
                onClick={() => updateParam("theme", value)}
                aria-pressed={isActive}
                style={{
                  flexShrink: 0,
                  padding: "6px 16px",
                  borderRadius: 100,
                  fontSize: 12.5, fontWeight: isActive ? 700 : 500,
                  border: `1.5px solid ${isActive ? ROYAL : "var(--royal-100)"}`,
                  background: isActive ? ROYAL : "#fff",
                  color: isActive ? "#fff" : ROYAL,
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
