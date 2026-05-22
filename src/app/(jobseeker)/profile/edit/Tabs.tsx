"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabItem = {
  key: string;
  label: string;
  /** Optional completion state: true = green dot, false = gray dot, undefined = no dot */
  completed?: boolean;
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {tab.label}
              {tab.completed !== undefined && (
                <span
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: tab.completed ? "var(--success)" : "var(--ink-mute)",
                    opacity: tab.completed ? 1 : 0.4,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
              )}
            </span>
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
