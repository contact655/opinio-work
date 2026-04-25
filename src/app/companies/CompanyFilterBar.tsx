"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { INDUSTRIES, PHASES, EMPLOYEE_RANGES } from "./mockCompanies";

// ─── Design tokens ───
const ROYAL = "#002366";
const LINE = "#E2E8F0";
const INK_SOFT = "#475569";
const INK_MUTE = "#94A3B8";

// ─── Dropdown ────────────────────────────────────────────────────────────────

function Dropdown({
  label,
  param: _param,  // intentionally unused; kept for API consistency
  options,
  value,
  onSelect,
}: {
  label: string;
  param: string;
  options: string[];
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
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px",
          border: `1.5px solid ${hasValue ? ROYAL : LINE}`,
          borderRadius: 100,
          background: hasValue ? "var(--royal-50)" : "#fff",
          color: hasValue ? ROYAL : INK_SOFT,
          fontSize: 13, fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {value ?? label}
        {hasValue && (
          <span style={{
            background: ROYAL, color: "#fff", fontSize: 10, fontWeight: 700,
            padding: "1px 5px", borderRadius: 100, lineHeight: 1.4,
          }}>✓</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12,
          boxShadow: "0 12px 36px rgba(15,23,42,0.12)",
          padding: 16, minWidth: 240, maxHeight: 320, overflowY: "auto",
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {/* Clear option */}
            {hasValue && (
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
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
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
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

export default function CompanyFilterBar({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const industry = searchParams.get("industry");
  const phase = searchParams.get("phase");
  const employees = searchParams.get("employees");
  const meeting = searchParams.get("meeting");
  const sort = searchParams.get("sort") ?? "updated";

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  const hasAnyFilter = !!(industry || phase || employees || meeting);

  return (
    <div style={{
      position: "sticky", top: 64, zIndex: 50,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${LINE}`,
    }}>
      <div
        style={{ maxWidth: 1280, margin: "0 auto" }}
        className="px-5 md:px-12"
      >
        <div style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

          {/* Quick filter: 面談受付中 */}
          <button
            onClick={() => updateParam("meeting", meeting === "1" ? null : "1")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 100, fontSize: 13, fontWeight: 500,
              border: `1.5px solid ${meeting === "1" ? ROYAL : LINE}`,
              background: meeting === "1" ? ROYAL : "#fff",
              color: meeting === "1" ? "#fff" : INK_SOFT,
              cursor: "pointer",
            }}
          >
            {meeting === "1" && (
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: meeting === "1" ? "#6EE7B7" : "var(--success)",
                flexShrink: 0,
              }} />
            )}
            面談受付中
          </button>

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: LINE, flexShrink: 0 }} />

          {/* Dropdown filters */}
          <Dropdown
            label="業種"
            param="industry"
            options={INDUSTRIES}
            value={industry}
            onSelect={(v) => updateParam("industry", v)}
          />
          <Dropdown
            label="事業ステージ"
            param="phase"
            options={PHASES}
            value={phase}
            onSelect={(v) => updateParam("phase", v)}
          />
          <Dropdown
            label="従業員数"
            param="employees"
            options={EMPLOYEE_RANGES.map((r) => r.label)}
            value={employees}
            onSelect={(v) => updateParam("employees", v)}
          />

          {/* Clear all */}
          {hasAnyFilter && (
            <button
              onClick={() => router.push(pathname)}
              style={{
                padding: "8px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                border: "none", background: "none", color: INK_MUTE,
                cursor: "pointer", textDecoration: "underline",
              }}
            >
              すべてクリア
            </button>
          )}

          {/* Spacer + result count + sort */}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: INK_MUTE, whiteSpace: "nowrap" }}>
            <strong style={{ color: ROYAL, fontSize: 15 }}>{total}</strong> 社
          </span>
          <select
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value === "updated" ? null : e.target.value)}
            style={{
              padding: "7px 12px", border: `1px solid ${LINE}`, borderRadius: 8,
              background: "#fff", fontSize: 13, color: INK_SOFT, cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="updated">新着順</option>
            <option value="employees">従業員数順</option>
          </select>
        </div>
      </div>
    </div>
  );
}
