"use client";

export type EditSection = {
  id: string;
  label: string;
  isComplete?: boolean;
  showStatus?: boolean;
};

type Props = {
  sections: EditSection[];
  activeSection: string;
  onSectionClick: (id: string) => void;
  completionPercent: number;
};

export function JobEditSubNav({
  sections,
  activeSection,
  onSectionClick,
  completionPercent,
}: Props) {
  return (
    <aside style={{
      background: "var(--bg-tint)",
      borderRight: "1px solid var(--line)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ヘッド */}
      <div style={{
        padding: "20px 20px 16px",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          fontFamily: "'Noto Serif JP', serif",
          fontSize: 16, fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 4,
        }}>
          求人を編集
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          編集すると下書きに保存されます。「公開申請」で運営審査（2-3営業日）後に公開されます。
        </div>
      </div>

      {/* セクションナビ */}
      <nav style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
        {sections.map((s) => {
          const isActive = s.id === activeSection;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSectionClick(s.id)}
              style={{
                padding: "9px 20px",
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--royal)" : "var(--ink-soft)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderLeft: `3px solid ${isActive ? "var(--royal)" : "transparent"}`,
                justifyContent: "space-between",
                transition: "all 0.15s",
                background: isActive ? "#fff" : "transparent",
                border: "none",
                fontFamily: "inherit",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span>{s.label}</span>
              {s.showStatus && (
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10, fontWeight: 600,
                  flexShrink: 0,
                  color: s.isComplete ? "var(--success)" : "var(--warm)",
                }}>
                  {s.isComplete ? "✓" : "未入力"}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 進捗バー */}
      <div style={{
        margin: 16,
        padding: 14,
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 10,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: "var(--ink)",
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
        }}>
          <span>入力進捗</span>
          <span style={{ color: "var(--royal)" }}>{completionPercent}%</span>
        </div>
        <div style={{
          height: 5,
          background: "var(--bg-tint)",
          borderRadius: 100,
          overflow: "hidden",
          marginBottom: 8,
        }}>
          <div style={{
            height: "100%",
            width: `${completionPercent}%`,
            background: "linear-gradient(to right, var(--royal), var(--accent))",
            borderRadius: 100,
            transition: "width 0.3s ease",
          }} />
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          全項目を入力すると、公開申請がスムーズに進みます。
        </div>
      </div>
    </aside>
  );
}
