"use client";

import type { CompanySectionId } from "@/lib/business/mockCompany";

export type CompanySubNavSection = {
  id: CompanySectionId;
  label: string;
  showStatus: boolean;
  hasDraft?: boolean;
};

type Props = {
  sections: CompanySubNavSection[];
  activeSection: string;
  onSectionClick: (id: string) => void;
  completionPercent: number;
  lastPublishedAt?: string;
  lastPublishedAgo?: string;
  onViewPublicPage?: () => void;
};

export function CompanyEditSubNav({
  sections,
  activeSection,
  onSectionClick,
  completionPercent,
  lastPublishedAt,
  lastPublishedAgo,
  onViewPublicPage,
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
          fontSize: 16,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 4,
        }}>
          企業情報
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          編集すると下書きに保存されます。「公開する」で求職者側に反映されます。
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
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--royal)" : "var(--ink-soft)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderLeft: `3px solid ${isActive ? "var(--royal)" : "transparent"}`,
                borderTop: "none",
                borderRight: "none",
                borderBottom: "none",
                justifyContent: "space-between",
                transition: "all 0.15s",
                background: isActive ? "#fff" : "transparent",
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
              {s.showStatus && s.hasDraft && (
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--warm)",
                  background: "var(--warm-soft)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}>
                  下書きあり
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 公開情報カード */}
      {lastPublishedAt && (
        <div style={{
          margin: "0 16px 12px",
          padding: 14,
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            最終公開
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 4 }}>
            {lastPublishedAt} に公開
          </div>
          {lastPublishedAgo && (
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10,
              color: "var(--ink-mute)",
              marginBottom: 8,
            }}>
              {lastPublishedAgo}
            </div>
          )}
          <button
            type="button"
            onClick={onViewPublicPage}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal-100)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--royal-50)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            公開ページを見る
          </button>
        </div>
      )}

      {/* 進捗バー */}
      <div style={{
        margin: "0 16px 16px",
        padding: 14,
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 10,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--ink)",
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
          全項目を入力すると、公開がスムーズに進みます。
        </div>
      </div>
    </aside>
  );
}
