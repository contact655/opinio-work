type Props = { planType: string | null };

export function UpgradeBanner({ planType }: Props) {
  if (planType) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
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
        ⚡
      </div>
      <div>
        <div style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 15, fontWeight: 700, color: "#fff",
          marginBottom: 4,
        }}>
          スカウト・マッチング機能を解放しませんか？
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
          有料プランにアップグレードすると、マッチ候補者へのアプローチ・詳細分析・チーム管理機能が使えます。
        </div>
      </div>
      <a
        href="/biz/upgrade"
        style={{
          display: "inline-block",
          padding: "10px 20px",
          borderRadius: 8,
          background: "#fff",
          color: "var(--royal)",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        プランを見る →
      </a>
    </div>
  );
}
