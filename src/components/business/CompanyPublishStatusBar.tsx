"use client";

type Props = {
  hasDraftChanges: boolean;
  draftSections?: string;  // 「基本情報・オフィス写真」など
};

export function CompanyPublishStatusBar({ hasDraftChanges, draftSections }: Props) {
  if (hasDraftChanges) {
    return (
      <div style={{
        background: "var(--warm-soft)",
        border: "1px solid #FDE68A",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          width: 28,
          height: 28,
          background: "var(--warm)",
          color: "#fff",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#B45309", marginBottom: 2 }}>
            未公開の変更があります
          </div>
          <div style={{ fontSize: 11, color: "#78350F", lineHeight: 1.6 }}>
            {draftSections
              ? `${draftSections}に下書き変更があります。`
              : "下書き変更があります。"
            }
            「変更を公開する」ボタンで求職者に反映されます。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--success-soft)",
      border: "1px solid #A7F3D0",
      borderRadius: 10,
      padding: "12px 16px",
      marginBottom: 22,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <div style={{
        width: 28,
        height: 28,
        background: "var(--success)",
        color: "#fff",
        borderRadius: 7,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 2 }}>
          最新の情報が公開されています
        </div>
        <div style={{ fontSize: 11, color: "#065F46", lineHeight: 1.6 }}>
          求職者側に表示されている情報は最新の状態です。
        </div>
      </div>
    </div>
  );
}
