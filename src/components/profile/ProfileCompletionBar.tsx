"use client";

/**
 * ⚠️ 計算そのものは src/lib/profile/completion.ts に移した（2026-08-04）。
 *    /people がサーバー側で同じ基準を使うため。ここは表示だけ。
 *    既存の import を壊さないよう calcCompletion / CompletionInput は再エクスポートする。
 */
export type { CompletionInput, ScoreItem } from "@/lib/profile/completion";
export { calcCompletion } from "@/lib/profile/completion";

import { calcCompletion as calcCompletionImpl, type CompletionInput as CompletionInputT, type ScoreItem } from "@/lib/profile/completion";

function nextAction(items: ScoreItem[]): ScoreItem | null {
  // Priority order: weight desc, then first not done
  const undone = items.filter((it) => !it.done);
  if (!undone.length) return null;
  return undone.sort((a, b) => b.weight - a.weight)[0];
}

export function ProfileCompletionBar({
  data,
  onTabChange,
  mode = "edit",
}: {
  data: CompletionInputT;
  onTabChange?: (tab: string) => void;
  mode?: "edit" | "mypage";
}) {
  const { score, items } = calcCompletionImpl(data);
  const next = nextAction(items);

  const color =
    score >= 80 ? "var(--success)" :
    score >= 50 ? "var(--royal)" :
    "var(--warm)";

  return (
    <div style={{
      background: "var(--bg-tint)",
      border: "1px solid var(--line-soft)",
      borderRadius: 12,
      padding: "14px 18px",
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

      {/* Next action hint */}
      {next && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>次: </span>
          {onTabChange ? (
            <button
              onClick={() => onTabChange(next.tab.replace("#", ""))}
              style={{
                fontSize: 12, fontWeight: 600, color: "var(--royal)",
                background: "none", border: "none", padding: 0, cursor: "pointer",
                textDecoration: "underline", textUnderlineOffset: 2,
              }}
            >
              {next.hint} →
            </button>
          ) : (
            <a
              href={`/profile/edit${next.tab}`}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              {next.hint} →
            </a>
          )}
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
