"use client";

import { useState } from "react";
import { JoinDecisionModal, type LoadedJoinDecisionView } from "@/components/profile/editor/JoinDecisionModal";

/** ★入社の決め手（1問）のバリエーション。⚠️ DB を読まない・書かない（preview） */
const VARIANTS: { label: string; companyName: string; preload: LoadedJoinDecisionView }[] = [
  { label: "はじめて聞く（未回答）", companyName: "株式会社セールスフォース・ジャパン",
    preload: { anchorId: "p1", status: "none", reasons: [], prompt: "first" } },
  { label: "30日後の再表示（スキップ済み）", companyName: "株式会社サンプル",
    preload: { anchorId: "p2", status: "skipped", reasons: [], prompt: "reshow" } },
  { label: "答え済み（3つ選んである）", companyName: "株式会社答えた会社",
    preload: { anchorId: "p3", status: "answered", reasons: ["position", "people", "salary"], prompt: null } },
];

export function JoinDecisionDemo() {
  const [open, setOpen] = useState<number | null>(null);
  const v = open === null ? null : VARIANTS[open];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {VARIANTS.map((x, i) => (
        <button key={x.label} type="button" data-action={`open-${i}`} onClick={() => setOpen(i)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontSize: 13 }}>
          {x.label}
        </button>
      ))}
      {v && (
        <JoinDecisionModal key={open} open experienceId="preview" companyName={v.companyName} preview={v.preload} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
