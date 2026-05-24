"use client";

import { useState, useMemo } from "react";

type Candidate = {
  id: string;
  name: string;
  location: string | null;
  isMentor: boolean;
  currentRole: string | null;
  currentCompany: string | null;
  jobType: string | null;
  workStyle: string | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  desiredPhase: string[] | null;
  transferTiming: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
};

const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート",
  hybrid: "ハイブリッド",
  on_site: "出社希望",
  flexible: "柔軟に対応",
};

// ow_profiles.job_type stores Japanese strings matching the onboarding options
const JOB_TYPE_OPTIONS = [
  "フィールドセールス",
  "インサイドセールス",
  "カスタマーサクセス",
  "マーケティング",
  "事業開発・BizDev",
  "プロダクトマネージャー",
  "エンジニア",
  "デザイナー",
  "HR・人事",
  "財務・経理",
  "その他",
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #002366, #3B5FD9)",
  "linear-gradient(135deg, #059669, #10b981)",
  "linear-gradient(135deg, #7C3AED, #a78bfa)",
  "linear-gradient(135deg, #d97706, #f59e0b)",
  "linear-gradient(135deg, #dc2626, #f87171)",
  "linear-gradient(135deg, #0891b2, #22d3ee)",
];

function getGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

const PHASE_OPTIONS = ["シリーズA", "シリーズB", "シリーズC", "上場"];

const TRANSFER_TIMING_OPTIONS = [
  { value: "即時",       label: "即時" },
  { value: "1〜3ヶ月以内", label: "1〜3ヶ月以内" },
  { value: "半年以内",   label: "半年以内" },
  { value: "1年以内",    label: "1年以内" },
  { value: "情報収集中", label: "情報収集中" },
];

const SALARY_MIN_OPTIONS = [
  { value: 0,   label: "年収下限なし" },
  { value: 400, label: "400万円〜" },
  { value: 500, label: "500万円〜" },
  { value: 600, label: "600万円〜" },
  { value: 700, label: "700万円〜" },
  { value: 800, label: "800万円〜" },
  { value: 1000, label: "1000万円〜" },
];

export default function CandidatesClient({ candidates }: { candidates: Candidate[] }) {
  const [q, setQ] = useState("");
  const [workStyle, setWorkStyle] = useState("");
  const [jobType, setJobType] = useState("");
  const [phase, setPhase] = useState("");
  const [transferTiming, setTransferTiming] = useState("");
  const [salaryMin, setSalaryMin] = useState(0);
  const [mentorOnly, setMentorOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = candidates;
    if (q.trim()) {
      const lower = q.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.currentRole ?? "").toLowerCase().includes(lower) ||
        (c.currentCompany ?? "").toLowerCase().includes(lower) ||
        (c.location ?? "").includes(lower)
      );
    }
    if (workStyle)      list = list.filter((c) => c.workStyle === workStyle);
    if (jobType)        list = list.filter((c) => c.jobType === jobType);
    if (phase)          list = list.filter((c) => c.desiredPhase?.includes(phase));
    if (transferTiming) list = list.filter((c) => c.transferTiming === transferTiming);
    if (salaryMin > 0)  list = list.filter((c) =>
      (c.desiredSalaryMin != null && c.desiredSalaryMin >= salaryMin) ||
      (c.desiredSalaryMax != null && c.desiredSalaryMax >= salaryMin)
    );
    if (mentorOnly)     list = list.filter((c) => c.isMentor);
    return list;
  }, [candidates, q, workStyle, jobType, phase, transferTiming, salaryMin, mentorOnly]);

  const activeFilterCount = [workStyle, jobType, phase, transferTiming, salaryMin > 0, mentorOnly].filter(Boolean).length;

  function clearAllFilters() {
    setWorkStyle(""); setJobType(""); setPhase("");
    setTransferTiming(""); setSalaryMin(0); setMentorOnly(false);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
          求職者を探す
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
          公開プロフィールを設定している求職者が表示されます。
          <span style={{ marginLeft: 8, color: "var(--ink-mute)" }}>
            ※ ダイレクトスカウトはできません。カジュアル面談への申込を待つ設計です
          </span>
        </p>
      </div>

      {/* Filters */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 24,
      }}>
        {/* Row 1: search + basic selects + count */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="名前・職種・会社・地域で検索..."
              aria-label="候補者を検索"
              style={{
                width: "100%", height: 36, padding: q ? "0 32px 0 12px" : "0 12px",
                border: "1px solid var(--line)", borderRadius: 8,
                fontSize: 13, outline: "none", fontFamily: "inherit", color: "var(--ink)",
                boxSizing: "border-box",
              }}
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label="検索をクリア"
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            )}
          </div>
          <select
            value={jobType}
            aria-label="職種で絞り込み"
            onChange={(e) => setJobType(e.target.value)}
            style={{
              height: 36, padding: "0 10px",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, color: jobType ? "var(--ink)" : "var(--ink-soft)", background: "#fff",
              outline: "none", fontFamily: "inherit",
            }}
          >
            <option value="">職種（全て）</option>
            {JOB_TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            value={workStyle}
            aria-label="勤務スタイルで絞り込み"
            onChange={(e) => setWorkStyle(e.target.value)}
            style={{
              height: 36, padding: "0 10px",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, color: workStyle ? "var(--ink)" : "var(--ink-soft)", background: "#fff",
              outline: "none", fontFamily: "inherit",
            }}
          >
            <option value="">勤務スタイル（全て）</option>
            {Object.entries(WORK_STYLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={salaryMin}
            aria-label="希望年収で絞り込み"
            onChange={(e) => setSalaryMin(Number(e.target.value))}
            style={{
              height: 36, padding: "0 10px",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, color: salaryMin > 0 ? "var(--ink)" : "var(--ink-soft)", background: "#fff",
              outline: "none", fontFamily: "inherit",
            }}
          >
            {SALARY_MIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Result count + clear */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span aria-live="polite" aria-atomic="true" style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
              <strong style={{ color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>{filtered.length}</strong>
              {" "}件
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--line)", background: "#fff",
                  color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                クリア ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* Row 2: phase pills + transfer timing pills + mentor toggle */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap" }}>企業フェーズ:</span>
          {["", ...PHASE_OPTIONS].map((v) => (
            <button
              key={v || "all"}
              onClick={() => setPhase(v)}
              aria-pressed={phase === v}
              style={{
                height: 28, padding: "0 10px", borderRadius: 14,
                fontSize: 11, fontWeight: phase === v ? 700 : 400,
                border: phase === v ? "1.5px solid var(--royal)" : "1px solid var(--line)",
                background: phase === v ? "var(--royal-50)" : "#fff",
                color: phase === v ? "var(--royal)" : "var(--ink-soft)",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {v || "全て"}
            </button>
          ))}

          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap", marginLeft: 8 }}>転職時期:</span>
          {["", ...TRANSFER_TIMING_OPTIONS.map((o) => o.value)].map((v) => (
            <button
              key={v || "all"}
              onClick={() => setTransferTiming(v)}
              aria-pressed={transferTiming === v}
              style={{
                height: 28, padding: "0 10px", borderRadius: 14,
                fontSize: 11, fontWeight: transferTiming === v ? 700 : 400,
                border: transferTiming === v ? "1.5px solid var(--warm)" : "1px solid var(--line)",
                background: transferTiming === v ? "var(--warm-soft)" : "#fff",
                color: transferTiming === v ? "#92400E" : "var(--ink-soft)",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {v || "全て"}
            </button>
          ))}

          <button
            onClick={() => setMentorOnly(!mentorOnly)}
            style={{
              height: 28, padding: "0 12px", borderRadius: 14, marginLeft: 8,
              fontSize: 11, fontWeight: mentorOnly ? 700 : 400,
              border: mentorOnly ? "1.5px solid var(--purple)" : "1px solid var(--line)",
              background: mentorOnly ? "var(--purple-soft)" : "#fff",
              color: mentorOnly ? "var(--purple)" : "var(--ink-soft)",
              cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}>
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
            メンターのみ
          </button>
        </div>
      </div>

      {/* Candidates grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "72px 0", background: "#fff",
          borderRadius: 16, border: "1px solid var(--line)",
        }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
            条件に合う求職者が見つかりませんでした
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
            {candidates.length === 0
              ? "現在、公開プロフィールを設定している求職者はいません"
              : "フィルター条件を変えてみてください"}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
          {filtered.map((c) => (
            <a
              key={c.id}
              href={`/u/${c.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none", display: "block" }}
            >
              <div style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "18px 20px",
                transition: "box-shadow 0.15s, transform 0.15s",
                cursor: "pointer",
                height: "100%",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,35,102,0.10)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.transform = "none";
              }}
              >
                {/* Avatar + name */}
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: getGradient(c.id),
                    color: "#fff", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 17, fontWeight: 700,
                  }}>
                    {c.name.charAt(0) || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {c.name}
                      </span>
                      {c.isMentor && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                          background: "var(--purple-soft)", color: "var(--purple)",
                          border: "1px solid #e9d5ff",
                        }}>
                          メンター
                        </span>
                      )}
                    </div>
                    {(c.currentRole || c.currentCompany) ? (
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>
                        {[c.currentRole, c.currentCompany].filter(Boolean).join(" @ ")}
                      </div>
                    ) : c.jobType ? (
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                        {c.jobType}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                  {c.location && (
                    <span style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 100,
                      background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-soft)",
                    }}>
                      📍 {c.location}
                    </span>
                  )}
                  {c.workStyle && (
                    <span style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 100,
                      background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--accent)",
                      fontWeight: 600,
                    }}>
                      {WORK_STYLE_LABELS[c.workStyle] ?? c.workStyle}
                    </span>
                  )}
                  {c.transferTiming && (
                    <span style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 100,
                      background: "var(--warm-soft)", border: "1px solid #FDE68A", color: "#92400E",
                      fontWeight: 600,
                    }}>
                      ⏱ {c.transferTiming}
                    </span>
                  )}
                  {c.desiredPhase && c.desiredPhase.length > 0 && (
                    <span style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 100,
                      background: "var(--success-soft)", border: "1px solid #a7f3d0", color: "var(--success)",
                      fontWeight: 600,
                    }}>
                      📊 {c.desiredPhase.join("・")}
                    </span>
                  )}
                </div>

                {/* Salary */}
                {(c.desiredSalaryMin || c.desiredSalaryMax) && (
                  <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 700, marginBottom: 12 }}>
                    希望年収：
                    {c.desiredSalaryMin && c.desiredSalaryMax
                      ? `${c.desiredSalaryMin}〜${c.desiredSalaryMax}万円`
                      : c.desiredSalaryMin
                      ? `${c.desiredSalaryMin}万円〜`
                      : `〜${c.desiredSalaryMax}万円`}
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 100,
                    background: c.onboardingCompleted ? "var(--success-soft)" : "var(--bg-tint)",
                    color: c.onboardingCompleted ? "var(--success)" : "var(--ink-mute)",
                    border: `1px solid ${c.onboardingCompleted ? "#a7f3d0" : "var(--line)"}`,
                    fontWeight: 600,
                  }}>
                    {c.onboardingCompleted ? "✓ プロフィール設定済み" : "設定中"}
                  </span>
                  <span style={{
                    fontSize: 11, color: "var(--royal)", fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 3,
                  }}>
                    詳細 →
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Philosophy note */}
      <div style={{
        marginTop: 32, padding: "14px 18px", background: "#fffbeb",
        border: "1px solid #fde68a", borderRadius: 10,
        fontSize: 12, color: "#92400e", lineHeight: 1.7,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <strong>OPINIO の採用思想：</strong>
        スカウトではなく「来てもらう」採用。企業情報・求人・カジュアル面談を充実させることで、
        求職者が自発的に接触してくる設計です。
        求職者へのダイレクトメッセージは現在提供していません。
      </div>
    </div>
  );
}
