"use client";
import { useRouter, useSearchParams } from "next/navigation";

type Props = { totalCount: number };

export function GridSortBar({ totalCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "newest";

  const setSort = (s: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (s === "newest") p.delete("sort");
    else p.set("sort", s);
    router.push(`/companies?${p.toString()}`);
  };

  const options = [
    { value: "newest",    label: "新着順",       icon: "✦" },
    { value: "jobs",      label: "求人あり優先",  icon: "💼" },
    { value: "employees", label: "社員数多い順",  icon: "👥" },
    { value: "phase",     label: "フェーズ順",    icon: "📈" },
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 16,
      background: "#fff", borderRadius: 10,
      border: "1px solid var(--line)",
      padding: "8px 14px",
      boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
    }}>
      {/* 件数表示 */}
      <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2} strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "Inter, sans-serif" }}>{totalCount}</strong>社
      </span>

      {/* ソートボタン群 */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--ink-mute)", marginRight: 4, fontWeight: 500 }}>並び替え</span>
        {options.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setSort(o.value)}
              style={{
                padding: "5px 14px", borderRadius: 100,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: "1px solid",
                background: active ? "var(--royal)" : "#f1f5f9",
                color: active ? "#fff" : "var(--ink-soft)",
                borderColor: active ? "var(--royal)" : "transparent",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              {active && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="6"/>
                </svg>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
