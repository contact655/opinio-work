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

// ── TrajectoryPageClient ───────────────────────────────────────────────────────

export function TrajectoryPageClient({ cards }: { cards: CardData[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  // ⑤ ソート機能追加
  const [sort, setSort] = useState<"default" | "transition" | "exp_desc">("default");

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
    if (sort === "transition") {
      result = [...result].sort((a, b) => {
        const aHas = a.steps.filter((s) => s.role_title).length >= 2 ? 1 : 0;
        const bHas = b.steps.filter((s) => s.role_title).length >= 2 ? 1 : 0;
        return bHas - aHas;
      });
    } else if (sort === "exp_desc") {
      result = [...result].sort((a, b) =>
        (b.yearsOfExperience ?? 0) - (a.yearsOfExperience ?? 0)
      );
    }

    return result;
  }, [cards, search, roleFilter, sort]);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* ── Sticky フィルターバー（企業ページと同パターン） ── */}
      <div style={{
        position: "sticky", top: 60, zIndex: 50,
        background: "#fff",
        borderBottom: "1px solid var(--line)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        padding: "var(--space-2) 0",
      }} className="px-5 md:px-12">
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* ── ページタイトル ── */}
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, letterSpacing: "-0.01em" }}>
            キャリア軌跡
          </h1>

          {/* ── 行1: 検索バー + 職種チップ ── */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
            {/* 検索ボックス */}
            <div style={{ position: "relative", flex: "0 0 200px" }}>
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

          {/* ── 行2: 並び替え（左）+ 件数（右）── */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", fontWeight: 500, marginRight: 4 }}>
              並び替え:
            </span>
            {([
              { value: "default",    label: "掲載順" },
              { value: "transition", label: "職種変遷あり優先" },
              { value: "exp_desc",   label: "社会人歴が長い順" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSort(opt.value)}
                aria-pressed={sort === opt.value}
                style={{
                  height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12,
                  fontWeight: sort === opt.value ? 700 : 500,
                  border: `1px solid ${sort === opt.value ? "var(--royal)" : "var(--line)"}`,
                  background: sort === opt.value ? "var(--royal)" : "#fff",
                  color: sort === opt.value ? "#fff" : "var(--ink-mute)",
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {filtered.length}件
            </span>
          </div>

        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>

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
