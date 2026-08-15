"use client";

/**
 * ⚠️ 計算そのものは src/lib/profile/completion.ts に移した（2026-08-04）。
 *    /people がサーバー側で同じ基準を使うため。ここは表示だけ。
 *    既存の import を壊さないよう calcCompletion / CompletionInput は再エクスポートする。
 */
export type { CompletionInput, ScoreItem } from "@/lib/profile/completion";
export { calcCompletion } from "@/lib/profile/completion";

import { calcCompletion as calcCompletionImpl, type CompletionInput as CompletionInputT, type ScoreItem } from "@/lib/profile/completion";

/**
 * 次にやると効くことを**最大3つ**返す（配点の大きい順）。
 *
 * ⚠️ 呼び出し側で `slice` しない。「いくつ出すか」はこの関数の責務にする。
 *    表示箇所は2ページ（/mypage と /profile/edit）あり、片方だけ件数が変わると
 *    「同じ完成度カードなのに出る数が違う」形になる。
 */
function nextActions(items: ScoreItem[]): ScoreItem[] {
  return items
    .filter((it) => !it.done)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
}

/** 内訳の並び。完了を上（配点の大きい順）→ 未完了（配点の大きい順） */
function breakdownOrder(items: ScoreItem[]): ScoreItem[] {
  return [...items].sort((a, b) =>
    a.done === b.done ? b.weight - a.weight : a.done ? -1 : 1
  );
}

export function ProfileCompletionBar({
  data,
  onTabChange,
  mode = "edit",
}: {
  data: CompletionInputT;
  onTabChange?: (tab: string) => void;
  /** sidebar は 260px の左サイドバー用。余白を詰め、次アクション行を折り返す。 */
  mode?: "edit" | "mypage" | "sidebar";
}) {
  const { score, items } = calcCompletionImpl(data);
  const nexts = nextActions(items);
  const compact = mode === "sidebar";

  const color =
    score >= 80 ? "var(--success)" :
    score >= 50 ? "var(--royal)" :
    "var(--warm)";

  return (
    <div style={{
      background: "var(--bg-tint)",
      border: "1px solid var(--line-soft)",
      borderRadius: 12,
      padding: compact ? "12px 14px" : "14px 18px",
      marginBottom: mode === "edit" ? 16 : 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          プロフィール完成度
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "Inter, sans-serif" }}>
          {score}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, borderRadius: 9999,
        background: "var(--line)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 9999,
          width: `${score}%`,
          background: score >= 80
            ? "linear-gradient(90deg, var(--success), #34d399)"
            : score >= 50
            ? "linear-gradient(90deg, var(--royal), #3B5FD9)"
            : "linear-gradient(90deg, var(--warm), #f59e0b)",
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* ── 内訳（項目 / 取得点 / 満点）──────────────────────────────
          ⚠️ 「何点分がどこで欠けているか」を出す。%だけだと、どれを埋めれば
             どれだけ動くのかが分からず、軽い項目から埋めることになる。 */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        {breakdownOrder(items).map((it) => (
          <div
            key={it.key}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              fontSize: 12, lineHeight: 1.4,
              color: it.done ? "var(--ink-soft)" : "var(--ink-mute)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
              <span aria-hidden="true" style={{ color: it.done ? "var(--success)" : "var(--line)", flexShrink: 0 }}>
                {it.done ? "✓" : "○"}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.label}>
                {it.label}
              </span>
            </span>
            <b style={{
              fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, flexShrink: 0,
              color: it.done ? "var(--ink)" : "var(--ink-mute)",
            }}>
              {it.done ? it.weight : 0} / {it.weight}
            </b>
          </div>
        ))}
      </div>

      {/* 次にやると効くこと（最大3件・配点の大きい順） */}
      {nexts.length > 0 && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line-soft)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>次にやると効くこと</span>
          {nexts.map((it) => {
            const label = `${it.hint}（+${it.weight}%）`;
            const style = {
              fontSize: 12, fontWeight: 600, color: "var(--royal)",
              background: "none", border: "none", padding: 0, cursor: "pointer",
              textAlign: "left" as const, textDecoration: "underline", textUnderlineOffset: 2,
              // 260px のサイドバーでは1行に収まらないヒントがあるため折り返す
              lineHeight: 1.5,
            };
            return onTabChange ? (
              <button key={it.key} onClick={() => onTabChange(it.tab)} style={style}>
                → {label}
              </button>
            ) : (
              <a key={it.key} href={`/profile/edit?tab=${it.tab}`} style={style}>
                → {label}
              </a>
            );
          })}
        </div>
      )}

      {score >= 100 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
          ✓ プロフィールが完成しています！
        </div>
      )}
    </div>
  );
}
