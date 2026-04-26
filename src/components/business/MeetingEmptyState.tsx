type Props = {
  isSearch?: boolean;
};

export function MeetingEmptyState({ isSearch }: Props) {
  return (
    <div style={{
      padding: "48px 20px",
      textAlign: "center",
      color: "var(--ink-mute)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
    }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
        {isSearch ? "検索結果がありません" : "該当する申込はありません"}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>
        {isSearch
          ? "別のキーワードで検索してみてください"
          : "ステータスを切り替えて確認してください"}
      </div>
    </div>
  );
}
