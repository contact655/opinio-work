"use client";

import { useState } from "react";
import { JoinCheckinModal, type LoadedCheckinView } from "@/components/profile/editor/JoinCheckinModal";
import { computeTendency } from "@/lib/workplaceReview/tendency";
import type { ReviewAxis } from "@/lib/workplaceReview/constants";

/** ★軸はマスタと同じ文言（migration 20261016190000 と pending/20261120090000）。⚠️ DB を読まない・書かない（preview） */
const AXES: ReviewAxis[] = [
  { key: "work_style", name: "仕事の進め方", leftText: "決まったやり方に沿って進める", rightText: "やり方は自分で決める", leftHeadlineJoin: "決まったやり方に沿って進め", leftHeadlineEnd: "決まったやり方に沿って進める", rightHeadlineJoin: "やり方を任され", rightHeadlineEnd: "やり方を任される" },
  { key: "onboarding", name: "立ち上がり", leftText: "自分で調べて覚える", rightText: "研修・先輩が教えてくれる", leftHeadlineJoin: "自分で調べて覚えていき", leftHeadlineEnd: "自分で調べて覚えていく", rightHeadlineJoin: "研修や先輩に教わりながら覚えられ", rightHeadlineEnd: "研修や先輩に教わりながら覚えられる" },
  { key: "evaluation", name: "評価", leftText: "成果の数字で見られる", rightText: "行動やプロセスも見られる", leftHeadlineJoin: "成果の数字で評価され", leftHeadlineEnd: "成果の数字で評価される", rightHeadlineJoin: "行動やプロセスも評価され", rightHeadlineEnd: "行動やプロセスも評価される" },
  { key: "decision", name: "決め方", leftText: "上が決めて降りてくる", rightText: "現場で話し合って決める", leftHeadlineJoin: "上が方針を決め", leftHeadlineEnd: "上が方針を決める", rightHeadlineJoin: "現場で話し合って決め", rightHeadlineEnd: "現場で話し合って決める" },
  { key: "change", name: "変化", leftText: "方針や組織はあまり変わらない", rightText: "方針や組織がよく変わる", leftHeadlineJoin: "方針や組織が落ち着いていて", leftHeadlineEnd: "方針や組織が落ち着いている", rightHeadlineJoin: "方針や組織がよく変わり", rightHeadlineEnd: "方針や組織がよく変わる" },
  { key: "closeness", name: "人との距離感", leftText: "仕事上の付き合いが中心", rightText: "仕事以外でも関わる", leftHeadlineJoin: "仕事上の付き合いが中心で", leftHeadlineEnd: "仕事上の付き合いが中心の", rightHeadlineJoin: "仕事以外でも関わりがあり", rightHeadlineEnd: "仕事以外でも関わりがある" },
  { key: "manager_style", name: "上司の関わり方", leftText: "任せて、必要なときに相談する", rightText: "こまめに一緒に進めてくれる", leftHeadlineJoin: "上司に任されて動け", leftHeadlineEnd: "上司に任されて動ける", rightHeadlineJoin: "上司が伴走してくれ", rightHeadlineEnd: "上司が伴走してくれる" },
];

const base = (over: Partial<LoadedCheckinView>): LoadedCheckinView => ({
  anchorId: "p", checkpoint: "3m", status: "none", canAnswer: true, answers: null, masters: { axes: AXES }, ...over,
});

const compare = computeTendency([
  { experienceId: "a", companyName: "株式会社いまの会社", fitScore: 8, axes: { onboarding: 4, manager_style: 4, work_style: 3 }, updatedAt: "2026-11-20T00:00:00Z" },
  { experienceId: "b", companyName: "株式会社前の会社", fitScore: 3, axes: { onboarding: 0, manager_style: 0, work_style: 3 }, updatedAt: "2026-01-01T00:00:00Z" },
], AXES);
const single = computeTendency([
  { experienceId: "a", companyName: "株式会社いまの会社", fitScore: 7, axes: { onboarding: 3, manager_style: 1 }, updatedAt: "2026-11-20T00:00:00Z" },
], AXES);

const VARIANTS: { label: string; companyName: string; loaded: LoadedCheckinView; tendency: ReturnType<typeof computeTendency> | null }[] = [
  { label: "入社3か月（未回答）→ 保存すると比較の傾向", companyName: "株式会社セールスフォース・ジャパン", loaded: base({}), tendency: compare },
  { label: "入社1年（未回答）→ 保存すると1社だけの傾向", companyName: "株式会社サンプル", loaded: base({ checkpoint: "1y" }), tendency: single },
  { label: "答え済み（開き直し）", companyName: "株式会社答えた会社", tendency: compare,
    loaded: base({ status: "answered", answers: { fitScore: 6, gaps: { gap_job: 1, gap_pay: 0, gap_growth: 2, gap_culture: 1 }, axes: { onboarding: 1 }, customer: "smb" } }) },
  { label: "まだ答えられない（入社2か月）", companyName: "株式会社入ったばかり", loaded: base({ canAnswer: false }), tendency: null },
  { label: "傾向の取得に失敗", companyName: "株式会社サンプル", loaded: base({}), tendency: null },
];

export function JoinCheckinDemo() {
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
        <JoinCheckinModal key={open} open experienceId="preview" companyName={v.companyName}
          preview={{ loaded: v.loaded, tendency: v.tendency }} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
