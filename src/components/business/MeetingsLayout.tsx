type Props = {
  listPanel: React.ReactNode;
  detailPanel: React.ReactNode;
};

export function MeetingsLayout({ listPanel, detailPanel }: Props) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "360px 1fr",
      height: "calc(100vh - 57px)",
      overflow: "hidden",
    }}>
      {/* Middle: list panel */}
      <div style={{
        borderRight: "1px solid var(--line)",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        {listPanel}
      </div>

      {/* Right: detail panel */}
      <div style={{
        background: "var(--bg-tint)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        {detailPanel}
      </div>
    </div>
  );
}
