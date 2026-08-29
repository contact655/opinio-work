import Link from "next/link";

type Props = {
  hasFilters?: boolean;
};

export function JobsEmptyState({ hasFilters }: Props) {
  if (hasFilters) {
    return (
      <div style={{
        padding: "60px 20px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{
          width: 56, height: 56,
          background: "var(--bg-tint)",
          color: "var(--ink-mute)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.3-4.3"/>
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          該当する求人がありません
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          条件を変えて再度検索してみてください
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: "60px 20px 72px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0,
    }}>
      {/* Illustration area */}
      <div style={{
        width: 80, height: 80,
        background: "linear-gradient(135deg, var(--royal-50) 0%, #EEF2FF 100%)",
        borderRadius: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
        boxShadow: "0 0 0 8px rgba(0,35,102,0.04)",
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
      </div>

      <div style={{
        fontSize: 18,
        fontFamily: "var(--font-noto-serif)",
        fontWeight: 600,
        color: "var(--ink)",
        marginBottom: 10,
        letterSpacing: "0.01em",
      }}>
        採用活動を始めましょう
      </div>
      <div style={{
        fontSize: 13,
        color: "var(--ink-soft)",
        lineHeight: 1.8,
        maxWidth: 360,
        marginBottom: 28,
      }}>
        求人を作成して OPINIOに掲載申請すると、運営審査（2-3 営業日）を経て公開されます。
        公開後はカジュアル面談の申込を受け付けられます。
      </div>

      <Link
        href="/biz/jobs/new"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 24px",
          background: "var(--royal)",
          color: "#fff",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          boxShadow: "0 2px 8px rgba(0,35,102,0.18)",
          transition: "all 0.15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        最初の求人を作成する
      </Link>

      {/* Step hints */}
      <div style={{
        marginTop: 40,
        display: "flex",
        gap: 24,
        justifyContent: "center",
        flexWrap: "wrap",
      }}>
        {[
          { step: "1", label: "求人を作成", desc: "職種・給与・働き方を入力" },
          { step: "2", label: "掲載申請", desc: "運営が 2-3 営業日で審査" },
          { step: "3", label: "面談を受け付け", desc: "候補者からの申込が届く" },
        ].map(({ step, label, desc }) => (
          <div key={step} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            minWidth: 100,
          }}>
            <div style={{
              width: 28, height: 28,
              borderRadius: "50%",
              background: "var(--royal-50)",
              color: "var(--royal)",
              fontFamily: "var(--font-inter), var(--font-noto)",
              fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {step}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{label}</div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center" }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
