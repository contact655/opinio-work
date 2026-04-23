"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { JOB_DEPTS, SALARY_PRESETS, WORK_STYLES } from "./mockJobData";

const ROYAL = "#002366";
const LINE = "#E2E8F0";
const INK_SOFT = "#475569";
const INK_MUTE = "#94A3B8";

const DEPT_ICONS: Record<string, string> = {
  "PdM / PM": "📋",
  "エンジニア": "💻",
  "営業": "💼",
  "カスタマーサクセス": "🤝",
  "マーケティング": "📣",
  "デザイナー": "🎨",
  "経営 / CxO": "🏢",
  "コーポレート": "📊",
};

export default function JobFilterBar({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dept       = searchParams.get("dept");
  const salary     = searchParams.get("salary");
  const work_style = searchParams.get("work_style");
  const sort       = searchParams.get("sort") ?? "updated";

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  const clearAll = useCallback(() => router.push(pathname), [pathname, router]);

  const hasAnyFilter = !!(dept || salary || work_style);

  // Pill button for small toggles
  const Pill = ({ label, param, value }: { label: string; param: string; value: string }) => {
    const active = searchParams.get(param) === value;
    return (
      <button
        onClick={() => updateParam(param, active ? null : value)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "7px 13px", borderRadius: 100, fontSize: 12.5, fontWeight: 500,
          border: `1.5px solid ${active ? ROYAL : LINE}`,
          background: active ? ROYAL : "#fff",
          color: active ? "#fff" : INK_SOFT,
          cursor: "pointer", whiteSpace: "nowrap",
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
  };

  return (
    <div style={{
      position: "sticky", top: 64, zIndex: 50,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${LINE}`,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }} className="px-5 md:px-12">
        <div style={{ padding: "10px 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>

          {/* Dept chips */}
          {JOB_DEPTS.slice(0, 5).map((d) => (
            <Pill key={d} label={`${DEPT_ICONS[d] ?? ""} ${d}`} param="dept" value={d} />
          ))}

          <div style={{ width: 1, height: 20, background: LINE, flexShrink: 0 }} />

          {/* Work style pills */}
          {["フルリモート", "ハイブリッド"].map((ws) => (
            <Pill key={ws} label={ws} param="work_style" value={ws} />
          ))}

          <div style={{ width: 1, height: 20, background: LINE, flexShrink: 0 }} />

          {/* Salary presets */}
          {SALARY_PRESETS.filter((s) => [700, 1000, 1200].includes(s)).map((s) => (
            <Pill key={s} label={`${s}万〜`} param="salary" value={String(s)} />
          ))}

          {/* Clear all */}
          {hasAnyFilter && (
            <button
              onClick={clearAll}
              style={{
                padding: "7px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                border: "none", background: "none", color: INK_MUTE,
                cursor: "pointer", textDecoration: "underline",
              }}
            >
              すべてクリア
            </button>
          )}

          {/* Spacer + count + sort */}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: INK_MUTE, whiteSpace: "nowrap" }}>
            <strong style={{ color: ROYAL, fontSize: 15, fontFamily: "Inter, sans-serif" }}>{total}</strong> 件
          </span>
          <select
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value === "updated" ? null : e.target.value)}
            style={{
              padding: "7px 12px", border: `1px solid ${LINE}`, borderRadius: 8,
              background: "#fff", fontSize: 13, color: INK_SOFT, cursor: "pointer", outline: "none",
            }}
          >
            <option value="updated">新着順</option>
            <option value="salary">年収順</option>
          </select>
        </div>
      </div>
    </div>
  );
}
