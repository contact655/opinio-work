"use client";

import Link from "next/link";

export type FeedProfileData = {
  userId: string;
  name: string;
  avatarColor: string | null;
  avatarUrl: string | null;
  roleTitle: string | null;
  companyName: string | null;
  profileStage: 1 | 2 | 3; // 1=公開できる / 2=見つけてもらえる / 3=声がかかる
};

const STAGE_CFG = {
  1: { label: "公開できる",      color: "var(--royal)",  bg: "var(--royal-50)",  border: "var(--royal-100)", pct: 33 },
  2: { label: "見つけてもらえる", color: "#7C3AED",       bg: "#F3E8FF",          border: "#DDD6FE",          pct: 67 },
  3: { label: "声がかかる",      color: "var(--success)", bg: "var(--success-soft)", border: "#A7F3D0",       pct: 100 },
} as const;

export default function FeedProfileCard({ profile }: { profile: FeedProfileData }) {
  const cfg = STAGE_CFG[profile.profileStage];
  const initial = profile.name.charAt(0);

  return (
    <aside
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
        flexShrink: 0,
        width: 240,
      }}
    >
      {/* カバー */}
      <div
        style={{
          height: 56,
          background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        }}
      />

      {/* アバター */}
      <div style={{ padding: "0 16px", marginTop: -28 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "3px solid #fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: profile.avatarUrl
              ? undefined
              : (profile.avatarColor?.startsWith("linear-gradient") ? profile.avatarColor : "linear-gradient(135deg, #002366, #3B5FD9)"),
            flexShrink: 0,
          }}
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 20, fontFamily: "Inter, sans-serif" }}>
              {initial}
            </span>
          )}
        </div>
      </div>

      {/* 名前・肩書き */}
      <div style={{ padding: "10px 16px 0" }}>
        <div
          style={{
            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
            fontSize: 15,
            fontWeight: 800,
            color: "var(--ink)",
            lineHeight: 1.3,
          }}
        >
          {profile.name}
        </div>
        {(profile.roleTitle || profile.companyName) && (
          <div
            style={{
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontSize: 12,
              color: "var(--ink-soft)",
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {[profile.roleTitle, profile.companyName].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {/* 区切り */}
      <div style={{ height: 1, background: "var(--line-soft)", margin: "14px 0" }} />

      {/* プロフィール完成度 */}
      <div style={{ padding: "0 16px 14px" }}>
        <div
          style={{
            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-mute)",
            letterSpacing: "0.04em",
            marginBottom: 8,
          }}
        >
          プロフィール状態
        </div>
        {/* バー */}
        <div
          style={{
            height: 5,
            background: "var(--line-soft)",
            borderRadius: 100,
            overflow: "hidden",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${cfg.pct}%`,
              background: cfg.color,
              borderRadius: 100,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 100,
            padding: "3px 10px",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* 区切り */}
      <div style={{ height: 1, background: "var(--line-soft)" }} />

      {/* 導線 */}
      <div style={{ padding: "8px 0" }}>
        <Link
          href="/mypage"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            textDecoration: "none",
            borderRadius: 0,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ""; }}
        >
          <span
            style={{
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            マイページへ
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
        <Link
          href={`/u/${profile.userId}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            textDecoration: "none",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ""; }}
        >
          <span
            style={{
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: "var(--royal)",
            }}
          >
            プロフィールを見る
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
