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

// Dummy avatar gradients for illustration
const PREVIEW_AVATARS = [
  { initial: "A", gradient: "linear-gradient(135deg, var(--royal), #3B5FD9)" },
  { initial: "K", gradient: "linear-gradient(135deg, #7C3AED, #C4B5FD)" },
  { initial: "M", gradient: "linear-gradient(135deg, var(--success), #34D399)" },
  { initial: "T", gradient: "linear-gradient(135deg, #F59E0B, #FCD34D)" },
  { initial: "S", gradient: "linear-gradient(135deg, #DC2626, #FCA5A5)" },
];

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
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "center",
          padding: "8px 0",
        }}>
          {/* Left: text + CTA */}
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--royal-50)", color: "var(--royal)",
              borderRadius: 100, padding: "3px 10px",
              fontSize: 11, fontWeight: 700,
              marginBottom: 10,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--royal)", display: "inline-block",
              }} />
              266名が登録中
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
              IT/SaaS業界のプロフェッショナルを探しましょう
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 16 }}>
              職種・希望条件・働き方でフィルタリングして<br />
              自社にフィットする候補者を見つけられます。
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="/biz/candidates" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 18px",
                background: "var(--royal)", color: "#fff",
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: "none",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                候補者を探す
              </a>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 14px",
                background: "var(--line-soft)", color: "var(--ink-soft)",
                borderRadius: 8, fontSize: 12, fontWeight: 600,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                PdM / エンジニア / セールスなど全職種対応
              </div>
            </div>
          </div>

          {/* Right: avatar cluster preview */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            padding: "16px 20px",
            background: "var(--bg-tint)",
            border: "1px solid var(--line-soft)",
            borderRadius: 12,
          }}>
            <div style={{ display: "flex", gap: -6 }}>
              {PREVIEW_AVATARS.map((av, i) => (
                <div key={i} style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: av.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#fff",
                  border: "2px solid #fff",
                  marginLeft: i === 0 ? 0 : -8,
                  position: "relative", zIndex: PREVIEW_AVATARS.length - i,
                }}>
                  {av.initial}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
              +261名の候補者
            </div>
            <div style={{
              fontSize: 10, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.5
            }}>
              全員 visibility=public
            </div>
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
