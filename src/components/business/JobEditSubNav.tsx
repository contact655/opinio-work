"use client";

export type EditSection = {
  id: string;
  label: string;
  isComplete?: boolean;
  showStatus?: boolean;
};

/**
 * 「推奨項目」の1つ。**公開の条件ではない。**
 *
 * ⚠️★**`completionPercent` に混ぜないこと。** 混ぜると、既に公開中の求人の％が
 *    その日いきなり下がる（公開中2件は3項目とも空なので 100% → 77% になる）。
 *    企業から見れば「何もしていないのに減った」であり、直す動機にならない。
 */
export type RecommendedItem = {
  key: string;
  label: string;
  /** クリックで開くセクション（`EditSection.id`） */
  sectionId: string;
  filled: boolean;
};

type Props = {
  sections: EditSection[];
  activeSection: string;
  onSectionClick: (id: string) => void;
  completionPercent: number;
  recommended?: RecommendedItem[];
};

export function JobEditSubNav({
  sections,
  activeSection,
  onSectionClick,
  recommended = [],
  completionPercent,
}: Props) {
  return (
    <aside style={{
      background: "var(--bg-tint)",
      borderRight: "1px solid var(--line)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ヘッド */}
      <div style={{
        padding: "20px 20px 16px",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 16, fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 4,
        }}>
          求人を編集
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          編集すると下書きに保存されます。「公開申請」で運営審査（2-3営業日）後に公開されます。
        </div>
      </div>

      {/* セクションナビ */}
      <nav style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
        {sections.map((s) => {
          const isActive = s.id === activeSection;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSectionClick(s.id)}
              style={{
                padding: "9px 20px",
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--royal)" : "var(--ink-soft)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderLeft: `3px solid ${isActive ? "var(--royal)" : "transparent"}`,
                justifyContent: "space-between",
                transition: "all 0.15s",
                background: isActive ? "#fff" : "transparent",
                border: "none",
                fontFamily: "inherit",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span>{s.label}</span>
              {s.showStatus && (
                <span style={{
                  fontFamily: "var(--font-inter), var(--font-noto)",
                  fontSize: 10, fontWeight: 600,
                  flexShrink: 0,
                  color: s.isComplete ? "var(--success-ink)" : "var(--warm-ink)",
                }}>
                  {s.isComplete ? "✓" : "未入力"}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 進捗バー */}
      <div style={{
        margin: 16,
        padding: 14,
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 10,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: "var(--ink)",
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
        }}>
          <span>入力進捗</span>
          <span style={{ color: "var(--royal)" }}>{completionPercent}%</span>
        </div>
        <div style={{
          height: 5,
          background: "var(--bg-tint)",
          borderRadius: 100,
          overflow: "hidden",
          marginBottom: 8,
        }}>
          <div style={{
            height: "100%",
            width: `${completionPercent}%`,
            background: "linear-gradient(to right, var(--royal), var(--accent))",
            borderRadius: 100,
            transition: "width 0.3s ease",
          }} />
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          全項目を入力すると、公開申請がスムーズに進みます。
        </div>
      </div>

      {/*
        推奨項目（2026-09-02 追加）

        ⚠️★**上の入力進捗とは別枠にしてある。** 必須ではないので、
           未入力を「未入力」と赤や黄で咎めない。黄色は「注意・未完了・待ち」の色で、
           任意の項目に使うと**やらないと駄目に見える**（ui-conventions「色の役割」）。
        ⚠️ 済 / 未済は**色ではなく記号と濃さ**で示す。同じ画面に上のセクション一覧
           （✓ / 未入力）があるので、色で二重に意味を作らない。
        ⚠️★ここに項目を足したら、**求人詳細に表示先があること**を必ず確かめること。
           表示先の無い項目を勧めると「入力させたのに出ない」になる。
      */}
      {recommended.length > 0 && (
        <div style={{
          marginTop: 12, padding: "14px 16px",
          background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            fontSize: 11, fontWeight: 700, color: "var(--ink)", marginBottom: 4,
          }}>
            <span>推奨項目（任意）</span>
            <span style={{ color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
              {recommended.filter((r) => r.filled).length} / {recommended.length}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.6, marginBottom: 10 }}>
            公開の条件ではありません。書くと、候補者が応募するかどうかを判断しやすくなります。
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {recommended.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onSectionClick(r.sectionId)}
                title={r.filled ? `${r.label}（入力済み）` : `${r.label} を書く`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 11, fontWeight: 600, padding: "4px 10px",
                  borderRadius: 100, cursor: "pointer",
                  border: r.filled ? "1px solid var(--royal-100, #dce5f7)" : "1px solid var(--line)",
                  background: r.filled ? "var(--royal-50)" : "var(--line-soft)",
                  color: r.filled ? "var(--royal)" : "var(--ink-mute)",
                }}
              >
                <span aria-hidden="true">{r.filled ? "✓" : "＋"}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
