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
  planType: string | null;
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

export function MatchCandidates({ candidates, planType }: Props) {
  return (
    <section style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "22px 26px",
    }}>
      <div style={{
        fontFamily: "'Noto Serif JP', serif",
        fontSize: 15, fontWeight: 600, color: "var(--ink)",
        display: "flex", alignItems: "baseline", gap: 8,
        marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
      }}>
        マッチ候補者
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 9, fontWeight: 700,
          color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
        }}>Match Candidates</span>
        {!planType && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: "2px 8px", borderRadius: 100,
            background: "var(--warm-soft)", color: "#92400E",
            marginLeft: 4,
          }}>有料プランのみ</span>
        )}
      </div>

      {!planType ? (
        <div style={{ position: "relative" }}>
          <div style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {candidates.slice(0, 3).map((c) => (
                <CandidateCard key={c.id} c={c} />
              ))}
            </div>
          </div>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 10,
          }}>
            <div style={{ fontSize: 28 }}>🔒</div>
            <div style={{
              fontFamily: "'Noto Serif JP', serif",
              fontSize: 14, fontWeight: 700, color: "var(--ink)",
            }}>有料プランで解放</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", maxWidth: 220, lineHeight: 1.5 }}>
              あなたの求人にマッチする候補者を確認できます
            </div>
            <a href="/biz/upgrade" style={{
              display: "inline-block", padding: "8px 20px", borderRadius: 8,
              background: "var(--royal)", color: "#fff",
              fontSize: 12, fontWeight: 700, textDecoration: "none",
            }}>
              アップグレード →
            </a>
          </div>
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
