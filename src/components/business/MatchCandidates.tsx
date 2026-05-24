export type MatchCandidate = {
  id: string;
  name: string;
  initial: string;
  gradient: string;
  currentRole: string;
  currentCompany: string;
  matchReasons: string[];
  matchScore: number;
};

type Props = {
  candidates: MatchCandidate[];
};

function CandidateCard({ c }: { c: MatchCandidate }) {
  return (
    <div style={{
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "16px",
      background: "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: c.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: "#fff",
          flexShrink: 0,
        }}>
          {c.initial}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{c.name}</div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{c.currentRole} · {c.currentCompany}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {c.matchReasons.map((r) => (
          <span key={r} style={{
            fontSize: 10, fontWeight: 600,
            padding: "2px 8px", borderRadius: 100,
            background: "var(--royal-50)", color: "var(--royal)",
          }}>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MatchCandidates({ candidates }: Props) {
  return (
    <section style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "22px 26px",
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 15, fontWeight: 600, color: "var(--ink)",
          display: "flex", alignItems: "baseline", gap: 8,
        }}>
          候補者サーチ
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 9, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
          }}>Candidates</span>
        </div>
        <a href="/biz/candidates" style={{
          fontSize: 12, color: "var(--royal)", fontWeight: 600,
          textDecoration: "none",
        }}>
          すべて見る →
        </a>
      </div>

      {candidates.length === 0 ? (
        <div style={{
          padding: "24px 0",
          textAlign: "center",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "var(--royal-50)", color: "var(--royal)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
            266名の候補者が登録中
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 16, lineHeight: 1.6 }}>
            IT/SaaS業界のプロフェッショナルを<br />職種・希望条件で絞り込んで探せます
          </div>
          <a href="/biz/candidates" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px",
            background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 600,
            textDecoration: "none",
          }}>
            候補者を探す →
          </a>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {candidates.map((c) => (
            <CandidateCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}
