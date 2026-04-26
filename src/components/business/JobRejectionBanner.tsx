type Props = {
  reason: string;
  date?: string;
  reviewer?: string;
};

export function JobRejectionBanner({ reason, date, reviewer }: Props) {
  return (
    <div style={{
      background: "linear-gradient(135deg, var(--error-soft) 0%, #fff 100%)",
      border: "1.5px solid #FCA5A5",
      borderRadius: 14,
      padding: "22px 26px",
      marginBottom: 24,
      display: "flex",
      gap: 16,
    }}>
      <div style={{
        width: 40, height: 40,
        background: "var(--error)",
        color: "#fff",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10, fontWeight: 700,
          color: "var(--error)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}>
          運営から差し戻しがありました
        </div>
        <div style={{
          fontFamily: "'Noto Serif JP', serif",
          fontSize: 16, fontWeight: 600,
          color: "#7F1D1D",
          marginBottom: 10,
        }}>
          内容を修正して再申請してください
        </div>
        <div style={{
          fontSize: 13,
          color: "#7F1D1D",
          lineHeight: 1.8,
          padding: "12px 14px",
          background: "#fff",
          border: "1px solid #FECACA",
          borderRadius: 8,
          marginBottom: 8,
        }}>
          {reason}
        </div>
        {(date || reviewer) && (
          <div style={{ fontSize: 11, color: "#991B1B" }}>
            {date}{reviewer ? ` · ${reviewer}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
