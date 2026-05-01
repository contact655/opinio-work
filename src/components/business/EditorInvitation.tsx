export function EditorInvitation() {
  return (
    <div style={{
      background: "linear-gradient(135deg, var(--purple) 0%, #5B21B6 100%)",
      borderRadius: 14,
      padding: "20px 24px",
      display: "grid",
      gridTemplateColumns: "48px 1fr auto",
      alignItems: "center",
      gap: 20,
      marginBottom: 4,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22,
      }}>
        ✍️
      </div>
      <div>
        <div style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 15, fontWeight: 700, color: "#fff",
          marginBottom: 4,
        }}>
          Opinio編集部が取材に伺います
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
          会社の雰囲気・文化・働き方を記事にしませんか？求職者からの閲覧数が平均 3.2倍 になります。
        </div>
      </div>
      <a
        href="/biz/editor-request"
        style={{
          display: "inline-block",
          padding: "10px 20px",
          borderRadius: 8,
          background: "#fff",
          color: "var(--purple)",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        申し込む →
      </a>
    </div>
  );
}
