export function EditorInvitation() {
  return (
    <div style={{
      background: "var(--purple-soft)",
      border: "1px solid #DDD6FE",
      borderRadius: 12,
      padding: "22px 26px",
      marginBottom: 4,
    }}>
      {/* Row 1: アイコン + タイトル */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: "#EDE9FE",
          border: "1px solid #DDD6FE",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          fontSize: 15,
        }}>
          ✍️
        </span>
        <p style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 15,
          fontWeight: 700,
          color: "#4C1D95",
          margin: 0,
          letterSpacing: "0.01em",
        }}>
          Opinio編集部が取材に伺います
        </p>
      </div>

      {/* Row 2: サブテキスト */}
      <p style={{
        fontSize: 13,
        color: "#5B21B6",
        lineHeight: 1.75,
        margin: "0 0 16px",
      }}>
        会社の雰囲気・文化・働き方を記事にしませんか？<br />
        求職者が「ここで働きたい」と感じるストーリーを、編集部が第三者の視点で届けます。
      </p>

      {/* Row 3: 数字強調 + CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "#7C3AED",
            lineHeight: 1,
          }}>3.2×</span>
          <span style={{ fontSize: 12, color: "#6D28D9", fontWeight: 500 }}>
            取材記事掲載後の閲覧数増加（平均）
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, flexShrink: 0 }}>
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </div>

        <a
          href="mailto:info@opinio.jp?subject=取材申込&body=取材をご希望の企業名・担当者名・ご連絡先をご記入ください。"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 18px",
            background: "#7C3AED",
            color: "#fff",
            border: "1px solid #7C3AED",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          申し込む →
        </a>
      </div>
    </div>
  );
}
