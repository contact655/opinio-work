"use client";
import { useRouter, useSearchParams } from "next/navigation";

type Props = { totalCount: number };

const SORT_OPTIONS = [
  {
    value: "newest",
    label: "新着順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    ),
  },
  {
    value: "jobs",
    label: "求人あり優先",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
  {
    value: "employees",
    label: "社員数多い順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    value: "phase",
    label: "フェーズ順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
];

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

  return (
    <>
      <style>{`
        .sort-btn {
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1.5px solid var(--line);
          background: #fff;
          color: var(--ink-soft);
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          font-family: "Noto Sans JP", sans-serif;
        }
        .sort-btn:hover {
          border-color: var(--royal-100);
          background: var(--royal-50);
          color: var(--royal);
        }
        .sort-btn.active {
          background: var(--royal);
          border-color: var(--royal);
          color: #fff;
          font-weight: 700;
          box-shadow: 0 3px 12px rgba(0,35,102,0.35);
          transform: scale(1.03);
        }
        .sort-scroll {
          display: flex;
          gap: 6px;
          align-items: center;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .sort-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
        background: "#fff",
        borderRadius: 12,
        border: "1px solid var(--line)",
        padding: "10px 16px",
        boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
      }}>

        {/* 左: ソートボタン群 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          {/* ソートアイコン + ラベル */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            color: "var(--ink-soft)", fontSize: 12, fontWeight: 600,
            flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M7 12h10M11 18h2"/>
            </svg>
            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>並び替え</span>
          </div>

          {/* セパレーター */}
          <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />

          {/* スクロール可能なボタン群 */}
          <div className="sort-scroll">
            {SORT_OPTIONS.map((o) => {
              const active = current === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSort(o.value)}
                  className={`sort-btn${active ? " active" : ""}`}
                >
                  {active ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ) : o.icon}
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 右: 件数 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          flexShrink: 0,
          paddingLeft: 12,
          borderLeft: "1px solid var(--line)",
        }}>
          <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
            <strong style={{
              color: "var(--ink)", fontWeight: 800,
              fontFamily: "Inter, sans-serif", fontSize: 16,
            }}>{totalCount}</strong>
            <span style={{ marginLeft: 2 }}>社</span>
          </span>
        </div>
      </div>
    </>
  );
}
