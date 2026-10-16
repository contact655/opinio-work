"use client";

import { useState } from "react";
import { ExperienceReasonModal, type LoadedReasonAnswers } from "@/components/profile/editor/ExperienceReasonModal";
import { EMPTY_REASON_ANSWERS_V2 } from "@/lib/constants/careerReasons";

/**
 * ★「この会社について」モーダルのバリエーション（2026-10-16）。
 * ⚠️ DB を読まない・書かない（`preload` と `onSaveOverride` を渡している）。
 */
const CASES: { key: string; label: string; companyName: string; remaining: number; preload: LoadedReasonAnswers }[] = [
  {
    key: "empty", label: "未回答（何も選んでいない）", companyName: "株式会社セールスフォース・ジャパン", remaining: 0,
    preload: { anchorId: "x", version: null, canLeave: false, answers: EMPTY_REASON_ANSWERS_V2 },
  },
  {
    key: "one", label: "1つだけ選んだ（自動でいちばん）", companyName: "株式会社SmartHR", remaining: 2,
    preload: { anchorId: "x", version: null, canLeave: false, answers: { ...EMPTY_REASON_ANSWERS_V2, expectations: ["skills"], primary: "skills" } },
  },
  {
    key: "three", label: "3つ選んで、いちばんが未選択（次へを押せない）", companyName: "株式会社SmartHR", remaining: 2,
    preload: { anchorId: "x", version: null, canLeave: false, answers: { ...EMPTY_REASON_ANSWERS_V2, expectations: ["customer", "next_career", "management"], primary: null } },
  },
  {
    key: "legacy", label: "旧形式の回答がある会社（答え直し）", companyName: "Box Japan", remaining: 1,
    preload: { anchorId: "x", version: 1, canLeave: true, answers: { ...EMPTY_REASON_ANSWERS_V2, expectations: ["salary", "position", "people"], primary: "salary", leaveReasons: ["growth"] } },
  },
  {
    key: "step2", label: "ステップ2（「タイミング・個人の事情」を含む3つ）", companyName: "株式会社SmartHR", remaining: 0,
    preload: { anchorId: "x", version: null, canLeave: false, answers: { ...EMPTY_REASON_ANSWERS_V2, expectations: ["salary", "culture", "personal"], primary: "culture" } },
  },
  {
    key: "long", label: "長い社名", companyName: "株式会社セールスフォース・ジャパン・ホールディングス・インターナショナル", remaining: 0,
    preload: { anchorId: "x", version: null, canLeave: false, answers: EMPTY_REASON_ANSWERS_V2 },
  },
];

export function ReasonModalDemo() {
  const [open, setOpen] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const c = CASES.find((x) => x.key === open);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {CASES.map((x) => (
        <button
          key={x.key}
          type="button"
          data-case={x.key}
          onClick={() => { setNonce((n) => n + 1); setOpen(x.key); }}
          style={{ padding: "8px 14px", border: "1px solid var(--line)", borderRadius: 999, background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}
        >
          {x.label}
        </button>
      ))}
      {c && (
        <ExperienceReasonModal
          key={`${c.key}-${nonce}`}
          open
          experienceId="00000000-0000-0000-0000-000000000000"
          companyName={c.companyName}
          remaining={c.remaining}
          onNext={c.remaining > 0 ? () => setOpen(null) : null}
          onSaved={() => {}}
          onClose={() => setOpen(null)}
          preload={c.preload}
          /* 送る内容を控える（DB には書かない）。確認用に window に置く */
          onSaveOverride={async (a) => { (window as unknown as { __reasonPayload?: unknown }).__reasonPayload = a; return true; }}
        />
      )}
    </div>
  );
}
