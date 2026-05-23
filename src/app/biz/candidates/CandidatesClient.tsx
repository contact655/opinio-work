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

export default function CandidatesClient({ candidates }: { candidates: Candidate[] }) {
  const [q, setQ] = useState("");
  const [workStyle, setWorkStyle] = useState("");
  const [jobType, setJobType] = useState("");

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
    if (workStyle) list = list.filter((c) => c.workStyle === workStyle);
    if (jobType)   list = list.filter((c) => c.jobType === jobType);
    return list;
  }, [candidates, q, workStyle, jobType]);

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
        display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center",
        background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・職種・会社・地域で検索..."
          style={{
            flex: "1 1 220px", height: 36, padding: "0 12px",
            border: "1px solid var(--line)", borderRadius: 8,
            fontSize: 13, outline: "none", fontFamily: "inherit", color: "var(--ink)",
          }}
        />
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          style={{
            height: 36, padding: "0 10px",
            border: "1px solid var(--line)", borderRadius: 8,
            fontSize: 13, color: "var(--ink-soft)", background: "#fff",
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
          onChange={(e) => setWorkStyle(e.target.value)}
          style={{
            height: 36, padding: "0 10px",
            border: "1px solid var(--line)", borderRadius: 8,
            fontSize: 13, color: "var(--ink-soft)", background: "#fff",
            outline: "none", fontFamily: "inherit",
          }}
        >
          <option value="">勤務スタイル（全て）</option>
          {Object.entries(WORK_STYLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
          <strong style={{ color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>{filtered.length}</strong>
          {" "}件
        </span>
      </div>

      {/* Candidates grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "72px 0", background: "#fff",
          borderRadius: 16, border: "1px solid var(--line)",
        }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🔍</div>
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
        💡 <strong>OPINIO の採用思想：</strong>
        スカウトではなく「来てもらう」採用。企業情報・求人・カジュアル面談を充実させることで、
        求職者が自発的に接触してくる設計です。
        求職者へのダイレクトメッセージは現在提供していません。
      </div>
    </div>
  );
}
