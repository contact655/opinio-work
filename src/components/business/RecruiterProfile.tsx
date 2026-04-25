export type RecruiterProfileData = {
  name: string;
  initial: string;
  gradient: string;
  role: string;
  bio: string;
  isPublic: boolean;
};

type Props = { profile: RecruiterProfileData };

export function RecruiterProfile({ profile }: Props) {
  return (
    <section style={{
      background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
      border: "1px solid var(--royal-100)",
      borderRadius: 14,
      padding: "22px 26px",
    }}>
      <div style={{
        fontFamily: "'Noto Serif JP', serif",
        fontSize: 15, fontWeight: 600, color: "var(--ink)",
        display: "flex", alignItems: "baseline", gap: 8,
        marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--royal-100)",
      }}>
        採用担当者プロフィール
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 9, fontWeight: 700,
          color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
        }}>Recruiter</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: profile.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 700, color: "#fff",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,35,102,0.2)",
        }}>
          {profile.initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
            {profile.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 8 }}>
            {profile.role}
          </div>
          <div style={{
            fontSize: 12, color: "var(--ink-soft)",
            lineHeight: 1.7,
            padding: "10px 14px",
            background: "#fff",
            borderRadius: 8,
            border: "1px solid var(--royal-100)",
            marginBottom: 12,
          }}>
            {profile.bio}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: profile.isPublic ? "var(--success)" : "var(--ink-mute)",
              }} />
              <span style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>
                {profile.isPublic ? "求職者に公開中" : "非公開"}
              </span>
            </div>
            <a href="/biz/profile" style={{
              fontSize: 11, fontWeight: 700,
              color: "var(--royal)", textDecoration: "none",
            }}>
              編集 →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
