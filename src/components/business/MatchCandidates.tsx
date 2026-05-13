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
        fontFamily: "var(--font-noto-serif)",
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
      </div>

      {candidates.length === 0 ? (
        <div style={{
          padding: "32px 0",
          textAlign: "center",
          color: "var(--ink-mute)",
          fontSize: 13,
        }}>
          マッチ候補者は現在表示されていません
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
