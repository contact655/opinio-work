export const CATEGORY_META: Record<
  string,
  { label: string; bg: string; color: string; emoji: string }
> = {
  all:       { label: "すべて",           bg: "var(--royal)",       color: "#fff",            emoji: "📋" },
  event:     { label: "イベント",         bg: "var(--purple-soft)", color: "var(--purple)",   emoji: "📅" },
  hiring:    { label: "採用情報",         bg: "#FEE2E2",            color: "#DC2626",          emoji: "💼" },
  culture:   { label: "カルチャー",       bg: "var(--royal-50)",    color: "var(--royal)",    emoji: "🏢" },
  interview: { label: "社員インタビュー", bg: "var(--warm-soft)",   color: "#92400E",          emoji: "🎙" },
  product:   { label: "プロダクト",       bg: "var(--success-soft)", color: "var(--success)", emoji: "🚀" },
  other:     { label: "その他",           bg: "var(--line-soft)",   color: "var(--ink-mute)", emoji: "📌" },
};
