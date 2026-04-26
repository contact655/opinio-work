type Props = {
  value: string;
  onChange: (v: string) => void;
};

export function MeetingSearchBar({ value, onChange }: Props) {
  return (
    <div style={{
      padding: "10px 20px",
      borderBottom: "1px solid var(--line)",
      position: "relative",
    }}>
      {/* 虫眼鏡アイコン */}
      <svg
        width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
        style={{
          position: "absolute", left: 30, top: "50%",
          transform: "translateY(-50%)",
          color: "var(--ink-mute)", pointerEvents: "none",
        }}
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="候補者名・求人名で検索..."
        style={{
          width: "100%",
          padding: "8px 10px 8px 30px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          fontFamily: "inherit",
          fontSize: 12,
          background: "var(--bg-tint)",
          color: "var(--ink)",
          outline: "none",
          boxSizing: "border-box",
          transition: "all 0.15s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--royal)";
          e.currentTarget.style.background = "#fff";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--line)";
          e.currentTarget.style.background = "var(--bg-tint)";
        }}
      />
    </div>
  );
}
