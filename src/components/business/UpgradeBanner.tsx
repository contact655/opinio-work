export function UpgradeBanner() {
  return (
    <div style={{
      background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
      borderRadius: 12,
      padding: "14px 20px",
      marginTop: 16,
      display: "flex",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
            color: "#F59E0B", fontFamily: "Inter, sans-serif",
            padding: "2px 8px", borderRadius: 100,
            background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
          }}>
            OPINIO 料金モデル
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.6 }}>
          掲載・利用は完全無料。採用確定時のみ 成功報酬10%。
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2, lineHeight: 1.5 }}>
          求人掲載・候補者閲覧・面談管理・メッセージ — すべて無料。採用できた時だけお支払い。
        </div>
      </div>
    </div>
  );
}
