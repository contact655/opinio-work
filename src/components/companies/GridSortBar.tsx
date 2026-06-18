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
    label: "募集中あり優先",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
];

export function GridSortBar({ totalCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "newest";
  const currentView = searchParams.get("view") ?? "card";

  const isForeign = searchParams.get("foreign") === "1";

  const setSort = (s: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (s === "newest") p.delete("sort");
    else p.set("sort", s);
    router.push(`/companies?${p.toString()}`);
  };

  const toggleForeign = () => {
    const p = new URLSearchParams(searchParams.toString());
    // 廃止されたソートパラメータを除去（例: sort=startup, sort=phase）
    const validSorts = new Set(SORT_OPTIONS.map(o => o.value));
    const sortVal = p.get("sort");
    if (sortVal && !validSorts.has(sortVal)) p.delete("sort");
    if (isForeign) p.delete("foreign");
    else p.set("foreign", "1");
    router.push(`/companies?${p.toString()}`);
  };

  const setView = (v: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (v === "card") p.delete("view");
    else p.set("view", v);
    router.push(`/companies?${p.toString()}`);
  };

  return (
    <>
      <style suppressHydrationWarning>{`
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
        .view-btn {
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.15s;
          font-family: "Noto Sans JP", sans-serif;
          white-space: nowrap;
          border: none;
        }
        .view-btn:hover { opacity: 0.85; }
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

          <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />

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

            {/* 外資系トグル（ソートとは別軸のフィルター） */}
            <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0, margin: "0 2px" }} />
            <button
              type="button"
              onClick={toggleForeign}
              aria-pressed={isForeign}
              className="sort-btn"
              style={isForeign ? {
                background: "#0c4a6e",
                borderColor: "#0c4a6e",
                color: "#fff",
                fontWeight: 700,
                boxShadow: "0 3px 12px rgba(12,74,110,0.35)",
                transform: "scale(1.03)",
              } : {}}
            >
              🌐 外資系
            </button>
          </div>
        </div>

        {/* 右: ビュートグル + 件数 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

          {/* ビュートグル（一覧/詳細） */}
          <div style={{
            display: "flex", gap: 2,
            background: "var(--line-soft)", borderRadius: 8, padding: 2,
          }}>
            <button
              type="button"
              onClick={() => setView("card")}
              className="view-btn"
              style={{
                background: currentView === "card" ? "var(--royal)" : "transparent",
                color: currentView === "card" ? "#fff" : "var(--ink-mute)",
              }}
              title="コンパクト一覧"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              一覧
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className="view-btn"
              style={{
                background: currentView === "list" ? "var(--royal)" : "transparent",
                color: currentView === "list" ? "#fff" : "var(--ink-mute)",
              }}
              title="詳細リストビュー"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
              詳細
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: "var(--line)" }} />

          {/* 件数 */}
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
