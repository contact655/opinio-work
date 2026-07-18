"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export type Graduate = {
  userId: string;
  name: string;
  avatarInitial: string;
  avatarGradient: string;
  avatarUrl: string | null;
  catchphrase: string | null;
  faculty: string | null;
  degree: string | null;
  graduatedAt: string | null;
  // キャリア情報
  currentCompany: string | null;
  currentRoleTitle: string | null;
  careerSummary: string | null;
};

type Props = { graduates: Graduate[] };

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function formatGradYear(graduatedAt: string | null): string | null {
  if (!graduatedAt) return null;
  return `${graduatedAt.slice(0, 4)}年卒`;
}

function subText(g: Graduate): string {
  return [g.faculty, g.degree, formatGradYear(g.graduatedAt)].filter(Boolean).join(" · ");
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ g, size }: { g: Graduate; size: number }) {
  if (g.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={g.avatarUrl}
        alt={g.name}
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: g.avatarGradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: "#fff",
      flexShrink: 0, border: "2px solid #fff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
    }}>
      {g.avatarInitial}
    </div>
  );
}

// ─── グリッドカード（3名以上） ────────────────────────────────────────────────

function GridCard({ g }: { g: Graduate }) {
  const router = useRouter();
  const sub = subText(g);
  return (
    <div
      onClick={() => router.push(`/u/${g.userId}`)}
      className="sch-grid-card"
    >
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
        <Avatar g={g} size={68} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4, textAlign: "center" }}>
        {g.name}
      </div>

      {(g.currentRoleTitle || g.currentCompany) && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: "var(--royal)",
          marginBottom: 4, textAlign: "center", lineHeight: 1.4,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {[g.currentRoleTitle, g.currentCompany].filter(Boolean).join(" @ ")}
        </div>
      )}

      {sub && (
        <div style={{
          fontSize: 11, color: "var(--ink-soft)", marginBottom: g.careerSummary ? 5 : 8,
          textAlign: "center", lineHeight: 1.5,
        }}>
          {sub}
        </div>
      )}

      {g.careerSummary && (
        <div style={{
          fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.5,
          marginBottom: 8, textAlign: "center",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {g.careerSummary}
        </div>
      )}

      {g.catchphrase && (
        <div style={{
          fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.6,
          marginBottom: 10, textAlign: "center",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {g.catchphrase}
        </div>
      )}

      <div style={{ marginTop: "auto", width: "100%" }}>
        <Link
          href={`/u/${g.userId}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "block", textAlign: "center",
            padding: "8px 14px",
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            color: "var(--royal)", borderRadius: 9,
            fontSize: 12, fontWeight: 600, textDecoration: "none",
          }}
        >
          プロフィールを見る
        </Link>
      </div>
    </div>
  );
}

// ─── 横帯カード（1〜2名） ────────────────────────────────────────────────────

function BandCard({ g }: { g: Graduate }) {
  const router = useRouter();
  const sub = subText(g);
  return (
    <div
      onClick={() => router.push(`/u/${g.userId}`)}
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      className="sch-band-card"
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar g={g} size={72} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
          {g.name}
        </div>

        {(g.currentRoleTitle || g.currentCompany) && (
          <div style={{
            fontSize: 13, fontWeight: 600, color: "var(--royal)",
            marginBottom: 4, lineHeight: 1.4,
          }}>
            {[g.currentRoleTitle, g.currentCompany].filter(Boolean).join(" @ ")}
          </div>
        )}

        {sub && (
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: g.careerSummary ? 4 : 0 }}>
            {sub}
          </div>
        )}

        {g.careerSummary && (
          <div style={{
            fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.5,
            marginBottom: g.catchphrase ? 6 : 0,
          }}>
            {g.careerSummary}
          </div>
        )}

        {g.catchphrase && (
          <div style={{
            fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {g.catchphrase}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        <Link
          href={`/u/${g.userId}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex", alignItems: "center",
            padding: "9px 18px",
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            color: "var(--royal)", borderRadius: 9,
            fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
          }}
        >
          プロフィールを見る
        </Link>
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function SchoolGraduatesClient({ graduates }: Props) {
  return (
    <>
      <style>{`
        .sch-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1100px) { .sch-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 768px)  { .sch-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
        @media (max-width: 480px)  { .sch-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; } }

        .sch-grid-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 20px 16px 16px;
          cursor: pointer;
          transition: box-shadow 0.15s, border-color 0.15s, transform 0.1s;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sch-grid-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.09);
          border-color: var(--royal-100);
          transform: translateY(-1px);
        }

        .sch-band-stack { display: flex; flex-direction: column; gap: 12px; }
        .sch-band-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.09);
          border-color: var(--royal-100);
        }
        @media (max-width: 600px) {
          .sch-band-card {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      `}</style>

      {/* ── ヘッダー ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.05em", margin: 0 }}>
          出身者
        </h2>
        <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
          <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "Inter, sans-serif", fontSize: 16 }}>
            {graduates.length}
          </strong>
          <span style={{ marginLeft: 2 }}>名</span>
        </span>
      </div>

      {/* ── カード ── */}
      {graduates.length <= 2 ? (
        <div className="sch-band-stack">
          {graduates.map((g) => <BandCard key={g.userId} g={g} />)}
        </div>
      ) : (
        <div className="sch-grid">
          {graduates.map((g) => <GridCard key={g.userId} g={g} />)}
        </div>
      )}
    </>
  );
}
