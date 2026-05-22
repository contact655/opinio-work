"use client";

import { useState, useMemo } from "react";

type Candidate = {
  id: string;
  name: string;
  location: string | null;
  isMentor: boolean;
  currentRole: string | null;
  currentCompany: string | null;
  workStyle: string | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  onboardingCompleted: boolean;
  createdAt: string;
};

const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート希望",
  hybrid: "ハイブリッド",
  on_site: "出社希望",
  flexible: "柔軟",
};

export default function CandidatesClient({ candidates }: { candidates: Candidate[] }) {
  const [q, setQ] = useState("");
  const [workStyle, setWorkStyle] = useState("");

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
    if (workStyle) {
      list = list.filter((c) => c.workStyle === workStyle);
    }
    return list;
  }, [candidates, q, workStyle]);

  const initialChar = (name: string) => name.trim().charAt(0) || "?";

  return (
    <div style={{ padding: "32px 40px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
          求職者を探す
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          公開プロフィールを設定している求職者が表示されます。
          <span style={{ marginLeft: 8, color: "#94a3b8" }}>
            ※ 直接スカウトはできません。カジュアル面談への申込を待つ設計です
          </span>
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center",
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 18px",
      }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・職種・会社・地域で検索..."
          style={{
            flex: "1 1 220px", height: 36, padding: "0 12px",
            border: "1px solid #e2e8f0", borderRadius: 8,
            fontSize: 13, outline: "none", fontFamily: "inherit",
          }}
        />
        <select
          value={workStyle}
          onChange={(e) => setWorkStyle(e.target.value)}
          style={{
            height: 36, padding: "0 12px",
            border: "1px solid #e2e8f0", borderRadius: 8,
            fontSize: 13, color: "#475569", background: "#fff",
            outline: "none", fontFamily: "inherit",
          }}
        >
          <option value="">勤務スタイル（全て）</option>
          {Object.entries(WORK_STYLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>
          <strong style={{ color: "#002366", fontFamily: "Inter, sans-serif" }}>{filtered.length}</strong>
          {" "}件
        </span>
      </div>

      {/* Candidates grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "64px 0", background: "#fff",
          borderRadius: 16, border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
            条件に合う求職者が見つかりませんでした
          </p>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>
            {candidates.length === 0
              ? "現在、公開プロフィールを設定している求職者はいません"
              : "フィルター条件を変えてみてください"}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((c) => (
            <div key={c.id} style={{
              background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: 12, padding: "18px 20px",
              transition: "box-shadow 0.15s, transform 0.15s",
            }}>
              {/* Avatar + name */}
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #002366, #3B5FD9)",
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 16, fontWeight: 700,
                }}>
                  {initialChar(c.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {c.name}
                    </span>
                    {c.isMentor && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        background: "#F3E8FF", color: "#7C3AED", border: "1px solid #E9D5FF",
                      }}>
                        メンター
                      </span>
                    )}
                  </div>
                  {(c.currentRole || c.currentCompany) && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {[c.currentRole, c.currentCompany].filter(Boolean).join(" @ ")}
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {c.location && (
                  <span style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 100,
                    background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569",
                  }}>
                    📍 {c.location}
                  </span>
                )}
                {c.workStyle && (
                  <span style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 100,
                    background: "#eff3fc", border: "1px solid #dce5f7", color: "#3B5FD9",
                    fontWeight: 600,
                  }}>
                    {WORK_STYLE_LABELS[c.workStyle] ?? c.workStyle}
                  </span>
                )}
              </div>

              {/* Salary */}
              {(c.desiredSalaryMin || c.desiredSalaryMax) && (
                <div style={{ fontSize: 12, color: "#059669", fontWeight: 700, marginBottom: 12 }}>
                  希望年収：
                  {c.desiredSalaryMin && c.desiredSalaryMax
                    ? `¥${c.desiredSalaryMin}〜${c.desiredSalaryMax}万円`
                    : c.desiredSalaryMin
                    ? `¥${c.desiredSalaryMin}万円〜`
                    : `〜¥${c.desiredSalaryMax}万円`}
                </div>
              )}

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 100,
                  background: c.onboardingCompleted ? "#ecfdf5" : "#f8fafc",
                  color: c.onboardingCompleted ? "#059669" : "#94a3b8",
                  border: `1px solid ${c.onboardingCompleted ? "#a7f3d0" : "#e2e8f0"}`,
                  fontWeight: 600,
                }}>
                  {c.onboardingCompleted ? "プロフィール設定済み" : "設定中"}
                </span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>
                  {new Date(c.createdAt).toLocaleDateString("ja-JP")}登録
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note */}
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
