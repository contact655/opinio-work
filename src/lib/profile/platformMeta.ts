/**
 * 発信コンテンツのプラットフォーム表示と、記事タイプのラベル。
 *
 * ⚠️ **`"use client"` のファイルに置かないこと。**（2026-08-16 に踏んだ）
 *    サーバーコンポーネント（`/u/[id]/page.tsx`）が `PLATFORM_META[x].color` のように
 *    **ドットで読む**ため、クライアントモジュールから export すると
 *    `Cannot access note.color on the server. You cannot dot into a client module
 *     from a server component.` で 500 になる。
 *    定数はサーバー・クライアントどちらからも読める素のモジュールに置く。
 */

export const PLATFORM_META: Record<string, { label: string; color: string; bg: string }> = {
  youtube:      { label: "YouTube",      color: "#FF0000", bg: "#FFF0F0" },
  note:         { label: "note",         color: "#41C9B4", bg: "#F0FDFB" },
  zenn:         { label: "Zenn",         color: "#3EA8FF", bg: "#EFF8FF" },
  speakerdeck:  { label: "Speaker Deck", color: "#009287", bg: "#EEFAF8" },
  podcast:      { label: "Podcast",      color: "#8B5CF6", bg: "#F5F0FF" },
  github:       { label: "GitHub",       color: "#24292F", bg: "#F6F8FA" },
  other:        { label: "Web",          color: "var(--ink-soft)", bg: "var(--bg-tint)" },
};

/** 記事タイプ日本語ラベル */
export const ARTICLE_TYPE_LABEL: Record<string, string> = {
  employee: "社員インタビュー",
  mentor:   "メンターインタビュー",
  ceo:      "創業者インタビュー",
  report:   "取材レポート",
};
