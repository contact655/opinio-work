import Link from "next/link";

type Props = {
  hasFilters?: boolean;
};

export function JobsEmptyState({ hasFilters }: Props) {
  return (
    <div style={{
      padding: "60px 20px",
      textAlign: "center",
      color: "var(--ink-mute)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
    }}>
      <div style={{
        width: 64, height: 64,
        background: "var(--bg-tint)",
        color: "var(--ink-mute)",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 0 }}>
        {hasFilters ? "該当する求人がありません" : "まだ求人がありません"}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        {hasFilters
          ? "条件を変えて再度検索してみてください"
          : "最初の求人を作成して採用活動を始めましょう"}
      </div>
      {!hasFilters && (
        <Link
          href="/biz/jobs/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            background: "var(--royal)",
            color: "#fff",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            marginTop: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新規求人を作成
        </Link>
      )}
    </div>
  );
}
