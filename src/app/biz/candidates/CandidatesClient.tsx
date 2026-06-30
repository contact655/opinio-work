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
  "linear-gradient(135deg, var(--royal), #3B5FD9)",
  "linear-gradient(135deg, var(--success), #10b981)",
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

export default function CandidatesClient({ candidates }: { candidates: Candidate[] }) {
  const [q, setQ] = useState("");
  const [workStyle, setWorkStyle] = useState("");
  const [jobType, setJobType] = useState("");
  const [phase, setPhase] = useState("");
  const [transferTiming, setTransferTiming] = useState("");
  const [_mentorOnly] = useState(false);

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

    return list;
  }, [candidates, q, workStyle, jobType, phase, transferTiming]);

  const activeFilterCount = [workStyle, jobType, phase, transferTiming].filter(Boolean).length;

  function clearAllFilters() {
    setWorkStyle(""); setJobType(""); setPhase(""); setTransferTiming("");
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
                type="button"
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
            id="candidates-job-type"
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
            id="candidates-work-style"
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
          {/* Result count + clear */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span aria-live="polite" aria-atomic="true" style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
              <strong style={{ color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>{filtered.length}</strong>
              {" "}件
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
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
              type="button"
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
              type="button"
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
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>{c.location}
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
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>{c.desiredPhase.join("・")}
                    </span>
                  )}
                </div>

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
