"use client";

import { useState } from "react";
import { ExperienceReasonModal, TendencyView, type LoadedWorkplaceReview } from "@/components/profile/editor/ExperienceReasonModal";
import { EMPTY_ANSWERS, type ReviewAxis } from "@/lib/workplaceReview/constants";
import { computeTendency, type TendencyReview } from "@/lib/workplaceReview/tendency";

/**
 * ★入社後レビュー（「株式会社◯◯について」）のバリエーション（2026-10-16 に作り直した）。
 * ⚠️ DB を読まない・書かない（`preload` と `onSaveOverride` を渡している）。軸とタグはマスタ（migration 20261016190000）と同じ文言。
 */
const AXES: ReviewAxis[] = [
  { key: "work_style", name: "仕事の進め方", leftText: "決まったやり方に沿って進める", rightText: "やり方は自分で決める", leftHeadlineJoin: "決まったやり方に沿って進め", leftHeadlineEnd: "決まったやり方に沿って進める", rightHeadlineJoin: "やり方を任され", rightHeadlineEnd: "やり方を任される" },
  { key: "onboarding", name: "立ち上がり", leftText: "自分で調べて覚える", rightText: "研修・先輩が教えてくれる", leftHeadlineJoin: "自分で調べて覚えていき", leftHeadlineEnd: "自分で調べて覚えていく", rightHeadlineJoin: "研修や先輩に教わりながら覚えられ", rightHeadlineEnd: "研修や先輩に教わりながら覚えられる" },
  { key: "evaluation", name: "評価", leftText: "成果の数字で見られる", rightText: "行動やプロセスも見られる", leftHeadlineJoin: "成果の数字で評価され", leftHeadlineEnd: "成果の数字で評価される", rightHeadlineJoin: "行動やプロセスも評価され", rightHeadlineEnd: "行動やプロセスも評価される" },
  { key: "decision", name: "決め方", leftText: "上が決めて降りてくる", rightText: "現場で話し合って決める", leftHeadlineJoin: "上が決めて進め", leftHeadlineEnd: "上が決めて進める", rightHeadlineJoin: "現場で話し合って決め", rightHeadlineEnd: "現場で話し合って決める" },
  { key: "change", name: "変化", leftText: "方針や組織はあまり変わらない", rightText: "方針や組織がよく変わる", leftHeadlineJoin: "方針や組織が落ち着いていて", leftHeadlineEnd: "方針や組織が落ち着いている", rightHeadlineJoin: "方針や組織がよく変わり", rightHeadlineEnd: "方針や組織がよく変わる" },
  { key: "closeness", name: "人との距離感", leftText: "仕事上の付き合いが中心", rightText: "仕事以外でも関わる", leftHeadlineJoin: "仕事上の付き合いが中心で", leftHeadlineEnd: "仕事上の付き合いが中心の", rightHeadlineJoin: "仕事以外でも関わりがあり", rightHeadlineEnd: "仕事以外でも関わりがある" },
];
const TAGS = [
  ["self_starter", "自分で考えて動ける人"], ["enjoys_change", "変化を楽しめる人"], ["numbers_driven", "数字で評価されたい人"],
  ["steady_growth", "じっくり育ちたい人"], ["team_player", "チームで動きたい人"], ["specialist", "専門性を深めたい人"],
  ["generalist", "幅広く経験したい人"], ["system_builder", "仕組みを作るのが好きな人"],
].map(([key, label]) => ({ key, label }));
const MASTERS = { axes: AXES, tags: TAGS };

const FULL_REQUIRED = { ...EMPTY_ANSWERS, fitScore: 8, gaps: { gap_job: 1, gap_pay: 0, gap_growth: 2, gap_culture: 1 } };

/** 保存したときに④で比べる「ほかの会社」 */
const PAST: TendencyReview = { experienceId: "past", companyName: "前職の株式会社サンプル", fitScore: 4, axes: { work_style: 0, decision: 1, evaluation: 2, change: 3 }, updatedAt: "2026-01-01T00:00:00Z" };

const CASES: { key: string; label: string; companyName: string; preload: LoadedWorkplaceReview; others: TendencyReview[]; next: string | null }[] = [
  { key: "empty", label: "未回答（①から）", companyName: "株式会社SmartHR", preload: { anchorId: "x", canLeave: false, status: null, answers: EMPTY_ANSWERS, masters: MASTERS }, others: [PAST], next: "株式会社サンプル" },
  { key: "resume2", label: "①まで答え済み（②から再開）", companyName: "株式会社SmartHR", preload: { anchorId: "x", canLeave: false, status: "required_done", answers: FULL_REQUIRED, masters: MASTERS }, others: [PAST], next: null },
  { key: "resume3", label: "②まで答え済み（③から再開）", companyName: "株式会社SmartHR", preload: { anchorId: "x", canLeave: false, status: "required_done", answers: { ...FULL_REQUIRED, axes: { work_style: 4, decision: 3 } }, masters: MASTERS }, others: [], next: "株式会社サンプル" },
  { key: "complete", label: "最後まで答え済み（見直し）・退職済みの会社", companyName: "株式会社SmartHR", preload: { anchorId: "x", canLeave: true, status: "complete", answers: { ...FULL_REQUIRED, axes: { work_style: 4 }, facts: { overtime: 1, office: 2, english: 0 }, tags: ["self_starter", "generalist"], memo: "最初の3ヶ月は商材理解のインプットが多い", leaveReasons: ["growth"] }, masters: MASTERS }, others: [PAST], next: null },
  { key: "long", label: "長い社名", companyName: "株式会社セールスフォース・ジャパン・ホールディングス・インターナショナル", preload: { anchorId: "x", canLeave: false, status: null, answers: EMPTY_ANSWERS, masters: MASTERS }, others: [], next: null },
];

export function ReasonModalDemo() {
  const [open, setOpen] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const c = CASES.find((x) => x.key === open);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {CASES.map((x) => (
        <button key={x.key} type="button" data-case={x.key} onClick={() => { setNonce((n) => n + 1); setOpen(x.key); }}
          style={{ padding: "8px 14px", border: "1px solid var(--line)", borderRadius: 999, background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
          {x.label}
        </button>
      ))}
      {c && (
        <ExperienceReasonModal
          key={`${c.key}-${nonce}`}
          open
          experienceId="00000000-0000-0000-0000-000000000000"
          companyName={c.companyName}
          nextCompanyName={c.next}
          onNext={c.next ? () => setOpen(null) : null}
          onSaved={() => {}}
          onClose={() => setOpen(null)}
          preload={c.preload}
          /* 送る内容を控える（DB には書かない）。④はこの会社とほかの会社（固定データ）で組む */
          onSaveOverride={async (a, complete) => {
            (window as unknown as { __reviewPayload?: unknown }).__reviewPayload = { answers: a, complete };
            const me: TendencyReview = { experienceId: "me", companyName: c.companyName, fitScore: a.fitScore, axes: a.axes, updatedAt: "2026-10-16T00:00:00Z" };
            return { ok: true, tendency: computeTendency([me, ...c.others], AXES) };
          }}
        />
      )}
    </div>
  );
}

/** ④の4パターン（開かずに並べて見る） */
export function TendencyGallery() {
  const r = (id: string, name: string, fit: number, axes: Record<string, number>): TendencyReview => ({ experienceId: id, companyName: name, fitScore: fit, axes, updatedAt: "2026-10-16T00:00:00Z" });
  const items: { label: string; t: ReturnType<typeof computeTendency> }[] = [
    { label: "対象0件", t: computeTendency([r("a", "SmartHR", 8, {})], AXES) },
    { label: "対象1件", t: computeTendency([r("a", "SmartHR", 8, { work_style: 4, decision: 3, change: 2 })], AXES) },
    { label: "2件以上・差が小さい", t: computeTendency([r("a", "SmartHR", 7, { work_style: 4 }), r("b", "前職", 5, { work_style: 0 })], AXES) },
    { label: "2件以上・差が大きい", t: computeTendency([r("a", "SmartHR", 8, { work_style: 4, decision: 4, evaluation: 2, change: 1 }), r("b", "前職", 4, { work_style: 0, decision: 1, evaluation: 1, change: 1 })], AXES) },
  ];
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {items.map((x) => (
        <div key={x.label} data-tendency-case={x.label} style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: 16, background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 10 }}>{x.label}</div>
          <TendencyView tendency={x.t} nextCompanyName={x.label === "対象1件" ? "株式会社サンプル" : null} onNext={() => {}} />
        </div>
      ))}
    </div>
  );
}
