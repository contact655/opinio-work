"use client";

import { useState } from "react";
import { CareerTurnModal, type LoadedCareerTurn } from "@/components/profile/editor/CareerTurnModal";
import { DECISIVE_REASON_LABELS, NEXT_PRIORITY_LABELS, FIT_GOOD_MIN, FIT_BAD_MAX, EMPTY_TURN_ANSWERS } from "@/lib/careerTurns/constants";
import { buildCareerTurnTendency, type TendencyTurn } from "@/lib/careerTurns/tendency";
import { EMPTY_TURN_DETAIL } from "@/lib/careerTurns/detail";
import { AXES } from "../reason-modal/Demo";

/**
 * ★転機の3問のバリエーション（2026-10-27 / フェーズ1c）。⚠️ DB を読まない・書かない（preload と onSaveOverride）。
 *   保存すると、下の「前の会社の回答」と合わせて本番と同じ関数で傾向を作る。
 */
const L = { reason: (k: string) => DECISIVE_REASON_LABELS[k] ?? k, priority: (k: string) => NEXT_PRIORITY_LABELS[k] ?? k, goodMin: FIT_GOOD_MIN, badMax: FIT_BAD_MAX };
const PAST: TendencyTurn = { companyName: "前職の株式会社サンプル", isFirst: true, decisiveReasons: ["skills", "people"], nextPriority: "deepen_expertise", fitAfterYear: 5 };

const VARIANTS: { label: string; companyName: string; withPast: boolean; preload: LoadedCareerTurn }[] = [
  { label: "2社目以降・1年以上（3問すべて）", companyName: "株式会社セールスフォース・ジャパン", withPast: true,
    preload: { anchorId: "p1", isFirst: false, canAskFit: true, status: "none", answers: EMPTY_TURN_ANSWERS, hasStoredAnswers: false, detail: EMPTY_TURN_DETAIL, axes: AXES } },
  { label: "最初の会社（Q2 が「社会に出るとき」）", companyName: "株式会社サンプル", withPast: false,
    preload: { anchorId: "p2", isFirst: true, canAskFit: true, status: "none", answers: EMPTY_TURN_ANSWERS, hasStoredAnswers: false, detail: EMPTY_TURN_DETAIL, axes: AXES } },
  { label: "入社1年未満（Q3 を出さない）", companyName: "株式会社ことし入った会社", withPast: true,
    preload: { anchorId: "p3", isFirst: false, canAskFit: false, status: "none", answers: EMPTY_TURN_ANSWERS, hasStoredAnswers: false, detail: EMPTY_TURN_DETAIL, axes: AXES } },
  { label: "旧の決め手を写した会社（答え直し）", companyName: "株式会社以前答えた会社", withPast: false,
    preload: { anchorId: "p4", isFirst: false, canAskFit: true, status: "legacy", answers: { decisiveReasons: ["skills", "salary", "evaluation"], nextPriority: null, fitAfterYear: null }, hasStoredAnswers: true, detail: { axes: { work_style: 3 }, facts: { overtime: 1, office: null, english: null }, memo: "以前に書いたメモ" }, axes: AXES } },
];

export function CareerTurnDemo() {
  const [open, setOpen] = useState<number | null>(null);
  const v = open === null ? null : VARIANTS[open];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {VARIANTS.map((x, i) => (
        <button key={x.label} type="button" onClick={() => setOpen(i)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontSize: 13 }}>
          {x.label}
        </button>
      ))}
      {v && (
        <CareerTurnModal
          key={open}
          open
          experienceId={v.preload.anchorId}
          companyName={v.companyName}
          nextCompanyName="株式会社つぎの会社"
          onNext={() => setOpen(null)}
          onSaved={() => undefined}
          onClose={() => setOpen(null)}
          preload={v.preload}
          onSaveOverride={async (a) => ({
            ok: true,
            tendency: a ? buildCareerTurnTendency([...(v.withPast ? [PAST] : []), { companyName: v.companyName, isFirst: v.preload.isFirst, ...a }], L) : [],
          })}
        />
      )}
    </div>
  );
}
