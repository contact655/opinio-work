"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabItem = {
  key: string;
  label: string;
};

// ─── Tabs Component ───────────────────────────────────────────────────────────

export default function Tabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "2px solid var(--line)",
        marginBottom: 28,
        overflowX: "auto",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--royal)" : "var(--ink-soft)",
              background: "transparent",
              border: "none",
              borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
              marginBottom: -2,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--ink-soft)";
            }}
          >
            {tab.label}
          </button>
        );
      })}
      <style>{`
        /* スクロールバー非表示 */
        .profile-tabs::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
