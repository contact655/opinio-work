"use client";

import { useState, useMemo } from "react";
import { TrajectoryCardClient, type CardData } from "./TrajectoryCardClient";

// ── Role filter chip definitions ──────────────────────────────────────────────

const ROLE_FILTERS = [
  { label: "営業・AE", keywords: ["Account Executive", "営業", "Sales", "アカウント"] },
  { label: "マーケ",   keywords: ["マーケティング", "Marketing", "マーケ"] },
  { label: "CS",       keywords: ["カスタマーサクセス", "Customer Success", "CS"] },
  { label: "PM",       keywords: ["プロダクト", "Product Manager", "PM"] },
  { label: "エンジニア", keywords: ["エンジニア", "Engineer", "Developer", "CTO", "VPoE", "SRE"] },
  { label: "コンサル", keywords: ["コンサル", "Consultant", "コンサルタント"] },
];

function matchesRole(card: CardData, keywords: string[]): boolean {
  const haystack = [card.headline, ...card.steps.map((s) => s.role_title)]
    .filter(Boolean)
    .join(" ");
  return keywords.some((kw) => haystack.includes(kw));
}

function getSalaryDiffVal(curve: number[]): number | null {
  if (curve.length < 2) return null;
  return curve[curve.length - 1] - curve[0];
}

// ── TrajectoryPageClient ───────────────────────────────────────────────────────

export function TrajectoryPageClient({ cards }: { cards: CardData[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  // ⑤ ソート機能追加
  const [sort, setSort] = useState<"default" | "salary_desc" | "exp_desc">("default");

  // ④ 各フィルターの件数計算
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rf of ROLE_FILTERS) {
      counts[rf.label] = cards.filter((c) => matchesRole(c, rf.keywords)).length;
    }
    return counts;
  }, [cards]);

  const filtered = useMemo(() => {
    let result = cards.filter((card) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [
          card.headline,
          ...card.steps.map((s) => s.role_title),
          ...card.steps.map((s) => s.company_text),
          ...card.steps.map((s) => s.company_anonymized),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (roleFilter) {
        const def = ROLE_FILTERS.find((r) => r.label === roleFilter);
        if (def && !matchesRole(card, def.keywords)) return false;
      }
      return true;
    });

    // ⑤ ソート
    if (sort === "salary_desc") {
      result = [...result].sort((a, b) => {
        const da = getSalaryDiffVal(a.salaryCurve) ?? -Infinity;
        const db = getSalaryDiffVal(b.salaryCurve) ?? -Infinity;
        return db - da;
      });
    } else if (sort === "exp_desc") {
      result = [...result].sort((a, b) =>
        (b.yearsOfExperience ?? 0) - (a.yearsOfExperience ?? 0)
      );
    }

    return result;
  }, [cards, search, roleFilter, sort]);

  // ── Styles ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <style>{`
        .trajectory-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }
        .trajectory-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (max-width: 900px) {
          .trajectory-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .trajectory-grid { grid-template-columns: minmax(0, 1fr); }
        }
        .role-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 6px 12px; border-radius: 100px;
          font-size: 12px; font-weight: 700;
          cursor: pointer; border: 1.5px solid var(--line);
          background: #fff; color: var(--ink-soft);
          transition: all 0.12s; white-space: nowrap;
        }
        .role-chip.active {
          background: var(--royal); color: #fff; border-color: var(--royal);
        }
        .role-chip:not(.active):hover:not(:disabled) {
          border-color: var(--royal-100); color: var(--royal); background: var(--royal-50);
        }
        .role-chip:disabled {
          opacity: 0.35; cursor: not-allowed;
        }
        .role-chip-count {
          font-size: 10px; font-weight: 800;
          background: rgba(0,0,0,0.08); border-radius: 100px;
          padding: 1px 5px; line-height: 1.4;
        }
        .role-chip.active .role-chip-count {
          background: rgba(255,255,255,0.25);
        }
        .traj-search-input {
          border: 1.5px solid var(--line); border-radius: 10px;
          padding: 8px 14px 8px 36px; font-size: 13px;
          background: #fff; color: var(--ink); outline: none;
          width: 200px; transition: border-color 0.12s;
        }
        .traj-search-input:focus { border-color: var(--royal); }
        .traj-sort-select {
          border: 1.5px solid var(--line); border-radius: 10px;
          padding: 8px 12px; font-size: 12px; font-weight: 600;
          background: #fff; color: var(--ink-soft); outline: none;
          cursor: pointer; transition: border-color 0.12s;
          appearance: none; -webkit-appearance: none;
          padding-right: 28px;
        }
        .traj-sort-select:focus { border-color: var(--royal); }
        .stats-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 28px;
        }
        .stat-card {
          background: #fff; border: 1px solid var(--line);
          border-radius: 14px; padding: 18px 20px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .stat-num {
          font-size: 26px; font-weight: 900;
          color: var(--ink); font-family: 'Inter', sans-serif; line-height: 1;
        }
        .stat-num-success {
          font-size: 24px; font-weight: 900;
          color: var(--success); font-family: 'Inter', sans-serif; line-height: 1;
        }
        .stat-label { font-size: 11px; font-weight: 600; color: var(--ink-mute); margin-top: 2px; }
        .stat-sub { font-size: 11px; color: var(--ink-mute); }
        .view-seg {
          display: flex; border: 1.5px solid var(--line);
          border-radius: 10px; overflow: hidden; background: #fff;
        }
        .view-seg-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; font-size: 12px; font-weight: 700;
          cursor: pointer; border: none; background: transparent;
          color: var(--ink-mute); transition: background 0.12s, color 0.12s;
          border-right: 1.5px solid var(--line);
        }
        .view-seg-btn:last-child { border-right: none; }
        .view-seg-btn.active {
          background: var(--royal); color: #fff;
        }
        @media (max-width: 640px) {
          .stats-strip { grid-template-columns: 1fr; }
          .traj-search-input { width: 140px; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>

        {/* ── フィルター + ソート + ビュー切替 ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 20,
        }}>
          {/* 左：検索 + 職種チップ */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* 検索ボックス */}
            <div style={{ position: "relative" }}>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--ink-mute)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="traj-search-input"
                type="text"
                placeholder="職種・会社名で検索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* ④ 職種フィルターチップ（件数バッジ付き） */}
            <button
              className={`role-chip${roleFilter === null ? " active" : ""}`}
              onClick={() => setRoleFilter(null)}
            >
              すべて
              <span className="role-chip-count">{cards.length}</span>
            </button>
            {ROLE_FILTERS.map((rf) => {
              const count = roleCounts[rf.label] ?? 0;
              return (
                <button
                  key={rf.label}
                  className={`role-chip${roleFilter === rf.label ? " active" : ""}`}
                  onClick={() => setRoleFilter(roleFilter === rf.label ? null : rf.label)}
                  disabled={count === 0}
                >
                  {rf.label}
                  <span className="role-chip-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* 右：ソート + ビュー切替 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {filtered.length < cards.length && (
              <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>
                {filtered.length}件表示
              </span>
            )}

            {/* ⑤ ソートセレクト */}
            <div style={{ position: "relative" }}>
              <select
                className="traj-sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as "default" | "salary_desc" | "exp_desc")}
              >
                <option value="default">掲載順</option>
                <option value="salary_desc">年収増加額が多い順</option>
                <option value="exp_desc">社会人歴が長い順</option>
              </select>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="var(--ink-mute)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

          </div>
        </div>

        {/* ── カード一覧 ── */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              該当する軌跡が見つかりません
            </div>
            <button
              onClick={() => { setSearch(""); setRoleFilter(null); }}
              style={{
                marginTop: 12, padding: "8px 20px", borderRadius: 100,
                background: "var(--royal)", color: "#fff",
                border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
              }}
            >
              フィルターをリセット
            </button>
          </div>
        ) : (
          <div className="trajectory-list">
            {filtered.map((card) => (
              <TrajectoryCardClient key={card.userId} card={card} listMode={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
