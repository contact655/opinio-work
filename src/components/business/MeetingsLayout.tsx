type Props = {
  listPanel: React.ReactNode;
  detailPanel: React.ReactNode;
};

export function MeetingsLayout({ listPanel, detailPanel }: Props) {
  return (
    <div className="biz-2col" style={{
      display: "grid",
      gridTemplateColumns: "360px 1fr",
      /* ⚠️ 親（.biz-meetings-body）の残りの高さをいっぱいに使う。上にタブの行と「決まった面談」が載るので、
            画面の高さから引き算しないこと（決まった面談の高さは件数で変わる） */
      height: "100%",
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
