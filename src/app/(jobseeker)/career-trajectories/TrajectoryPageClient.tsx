"use client";

import { useState, useMemo } from "react";
import { TrajectoryCardClient, type CardData } from "./TrajectoryCardClient";

// ── Role filter chip definitions ──────────────────────────────────────────────

const ROLE_FILTERS = [
  { label: "営業・AE", keywords: ["Account Executive", "営業", "Sales", "アカウント"] },
  { label: "マーケ", keywords: ["マーケティング", "Marketing", "マーケ"] },
  { label: "CS", keywords: ["カスタマーサクセス", "Customer Success", "CS"] },
  { label: "PM", keywords: ["プロダクト", "Product Manager", "PM"] },
  { label: "エンジニア", keywords: ["エンジニア", "Engineer", "Developer", "CTO", "VPoE", "SRE"] },
  { label: "コンサル", keywords: ["コンサル", "Consultant", "コンサルタント"] },
];

function matchesRole(card: CardData, keywords: string[]): boolean {
  const haystack = [card.headline, ...card.steps.map((s) => s.role_title)]
    .filter(Boolean)
    .join(" ");
  return keywords.some((kw) => haystack.includes(kw));
}

// ── TrajectoryPageClient ───────────────────────────────────────────────────────

export function TrajectoryPageClient({ cards }: { cards: CardData[] }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const verifiedCount = cards.filter((c) => c.verified).length;

  const filtered = useMemo(() => {
    return cards.filter((card) => {
      // テキスト検索（職種・会社名）
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
      // 職種フィルター
      if (roleFilter) {
        const def = ROLE_FILTERS.find((r) => r.label === roleFilter);
        if (def && !matchesRole(card, def.keywords)) return false;
      }
      return true;
    });
  }, [cards, search, roleFilter]);

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
        .view-toggle-btn {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; cursor: pointer; border: 1px solid var(--line);
          transition: background 0.12s, border-color 0.12s;
        }
        .view-toggle-btn.active {
          background: var(--royal); border-color: var(--royal);
        }
        .view-toggle-btn.active svg { stroke: #fff; }
        .role-chip {
          display: inline-flex; align-items: center;
          padding: 6px 14px; border-radius: 100px;
          font-size: 12px; font-weight: 700;
          cursor: pointer; border: 1.5px solid var(--line);
          background: #fff; color: var(--ink-soft);
          transition: all 0.12s; white-space: nowrap;
        }
        .role-chip.active {
          background: var(--royal); color: #fff; border-color: var(--royal);
        }
        .role-chip:not(.active):hover {
          border-color: var(--royal-100); color: var(--royal); background: var(--royal-50);
        }
        .traj-search-input {
          border: 1.5px solid var(--line); border-radius: 10px;
          padding: 8px 14px 8px 36px; font-size: 13px;
          background: #fff; color: var(--ink); outline: none;
          width: 200px; transition: border-color 0.12s;
        }
        .traj-search-input:focus { border-color: var(--royal); }
        .stats-strip {
          display: flex; align-items: center; gap: 32px;
          background: #fff; border: 1px solid var(--line);
          border-radius: 14px; padding: 20px 28px;
          margin-bottom: 28px;
        }
        .stat-item { display: flex; flex-direction: column; gap: 2px; }
        .stat-num {
          font-size: 28px; font-weight: 900;
          color: var(--ink); font-family: 'Inter', sans-serif; line-height: 1;
        }
        .stat-label { font-size: 11px; font-weight: 600; color: var(--ink-mute); }
        .stat-divider { width: 1px; height: 36px; background: var(--line); }
        @media (max-width: 640px) {
          .stats-strip { gap: 20px; padding: 16px 20px; flex-wrap: wrap; }
          .traj-search-input { width: 140px; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* ── ページヘッダー ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10,
          }}>
            Career Trajectories
          </p>
          <h1 style={{
            fontSize: 28, fontWeight: 900, margin: "0 0 8px",
            fontFamily: "Noto Serif JP, serif", color: "var(--ink)",
          }}>
            IT / SaaS 先輩たちのキャリア軌跡
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
            転職前後の年収・職歴を匿名で公開。OPINIO編集部が実際に面談し、内容を確認しています。
          </p>
        </div>

        {/* ── Stats strip ── */}
        {cards.length > 0 && (
          <div className="stats-strip">
            <div className="stat-item">
              <span className="stat-num">{cards.length}</span>
              <span className="stat-label">名が匿名公開中</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-num">{verifiedCount}</span>
              <span className="stat-label">編集部 取材・確認済み</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-num">0円</span>
              <span className="stat-label">完全無料・登録不要</span>
            </div>
          </div>
        )}

        {/* ── フィルター + ビュー切替 ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 20,
        }}>
          {/* 左：検索 + 職種チップ */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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

            {/* 職種フィルターチップ */}
            <button
              className={`role-chip${roleFilter === null ? " active" : ""}`}
              onClick={() => setRoleFilter(null)}
            >
              すべて
            </button>
            {ROLE_FILTERS.map((rf) => (
              <button
                key={rf.label}
                className={`role-chip${roleFilter === rf.label ? " active" : ""}`}
                onClick={() => setRoleFilter(roleFilter === rf.label ? null : rf.label)}
              >
                {rf.label}
              </button>
            ))}
          </div>

          {/* 右：ビュー切替 + 件数 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {filtered.length < cards.length && (
              <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>
                {filtered.length}件表示
              </span>
            )}
            <div style={{ display: "flex", gap: 4 }}>
              {/* グリッドボタン */}
              <button
                className={`view-toggle-btn${viewMode === "grid" ? " active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="グリッド表示"
                style={{ background: viewMode === "grid" ? "var(--royal)" : "#fff" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={viewMode === "grid" ? "#fff" : "var(--ink-soft)"} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              {/* リストボタン */}
              <button
                className={`view-toggle-btn${viewMode === "list" ? " active" : ""}`}
                onClick={() => setViewMode("list")}
                title="リスト表示"
                style={{ background: viewMode === "list" ? "var(--royal)" : "#fff" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={viewMode === "list" ? "#fff" : "var(--ink-soft)"} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
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
        ) : viewMode === "grid" ? (
          <div className="trajectory-grid">
            {filtered.map((card) => (
              <TrajectoryCardClient key={card.userId} card={card} listMode={false} />
            ))}
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
