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
  {
    value: "salary",
    label: "年収高い順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    value: "employees",
    label: "社員数順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    value: "disclosure",
    label: "開示充実順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
    ),
  },
];

export function GridSortBar({ totalCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "newest";
  const currentView = searchParams.get("view") ?? "card";

  const setSort = (s: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (s === "newest") p.delete("sort");
    else p.set("sort", s);
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

      <div className="sort-bar-row" style={{
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
        <div className="sort-bar-left" style={{ alignItems: "center", gap: 8, minWidth: 0 }}>
          {/* ⚠️ display はインラインで書かないこと。
                 インラインスタイルはメディアクエリより強く、
                 狭幅で隠す指定（.sort-bar-label { display:none }）が効かなくなる。 */}
          <div className="sort-bar-label" style={{
            alignItems: "center", gap: 5,
            color: "var(--ink-soft)", fontSize: 12, fontWeight: 600,
            flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M7 12h10M11 18h2"/>
            </svg>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>並び替え</span>
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
