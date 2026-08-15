"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabItem = {
  key: string;
  label: string;
  /** false のときだけ「未設定」ラベルを出す。true / undefined は何も出さない */
  completed?: boolean;
  /** そのタブに未保存のカードがあるか。★「未設定」とは別物。
      未設定 = まだ何も入れていない（黄）／未保存 = 入れたがまだ保存していない（青） */
  dirty?: boolean;
};

// ─── Tabs Component ───────────────────────────────────────────────────────────

export default function Tabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="プロフィール編集セクション"
      className="profile-tabs"
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "2px solid var(--line)",
        marginBottom: 28,
        // ⚠️ overflowX / flexWrap をインラインに書かないこと。
        //    幅で切り替えたい値なので、下のメディアクエリが効かなくなる。
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: "10px 18px",
              fontSize: "var(--text-sm)",
              fontWeight: active ? 700 : 500,
              color: active ? "var(--royal)" : "var(--ink-soft)",
              background: "transparent",
              border: "none",
              borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
              marginBottom: -2,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--ink-soft)";
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {tab.label}
              {/* ⚠️ ●（緑・グレー）は廃止した（2026-08-15）。
                     7タブのとき「公開設定」「アカウント」が常に緑で、
                     色が何を表すのか読めなかった。**未設定のタブにだけ言葉で出す。**
                     判定は呼び出し側の `tabCompletion` をそのまま使い、ここに条件を書かない。 */}
              {tab.dirty && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                    color: "var(--royal)", background: "var(--royal-50)",
                    border: "1px solid var(--royal-100)",
                    borderRadius: 100, padding: "3px 7px",
                    flexShrink: 0,
                  }}
                >
                  未保存
                </span>
              )}
              {tab.completed === false && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                    color: "#92400E", background: "#FEF3C7",
                    border: "1px solid #FDE68A",
                    borderRadius: 100, padding: "3px 7px",
                    flexShrink: 0,
                  }}
                >
                  未設定
                </span>
              )}
            </span>
          </button>
        );
      })}
      <style>{`
        /* モバイル: 横スクロール（縦に積むと入力欄が遠くなるため） */
        .profile-tabs { flex-wrap: nowrap; overflow-x: auto; }
        .profile-tabs::-webkit-scrollbar { display: none; }

        /* デスクトップ: 折り返す。⚠️ 3タブになったので通常は1行に収まるが、
           折り返しの指定は残す（ラベルが伸びたときに見切れないため）。 */
        @media (min-width: 768px) {
          .profile-tabs { flex-wrap: wrap; overflow-x: visible; }
        }
      `}</style>
    </div>
  );
}
