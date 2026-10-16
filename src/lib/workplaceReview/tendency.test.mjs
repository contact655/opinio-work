import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTendency, axisValueLabel, FIT_GAP_MIN } from "./tendency.ts";

/* 軸は DB のマスタ（migration 20261016190000）と同じ文言にしてある */
const AXES = [
  { key: "work_style", name: "仕事の進め方", leftText: "決まったやり方に沿って進める", rightText: "やり方は自分で決める", leftHeadlineJoin: "決まったやり方に沿って進め", leftHeadlineEnd: "決まったやり方に沿って進める", rightHeadlineJoin: "やり方を任され", rightHeadlineEnd: "やり方を任される" },
  { key: "onboarding", name: "立ち上がり", leftText: "自分で調べて覚える", rightText: "研修・先輩が教えてくれる", leftHeadlineJoin: "自分で調べて覚えていき", leftHeadlineEnd: "自分で調べて覚えていく", rightHeadlineJoin: "研修や先輩に教わりながら覚えられ", rightHeadlineEnd: "研修や先輩に教わりながら覚えられる" },
  { key: "evaluation", name: "評価", leftText: "成果の数字で見られる", rightText: "行動やプロセスも見られる", leftHeadlineJoin: "成果の数字で評価され", leftHeadlineEnd: "成果の数字で評価される", rightHeadlineJoin: "行動やプロセスも評価され", rightHeadlineEnd: "行動やプロセスも評価される" },
  { key: "decision", name: "決め方", leftText: "上が決めて降りてくる", rightText: "現場で話し合って決める", leftHeadlineJoin: "上が決めて進め", leftHeadlineEnd: "上が決めて進める", rightHeadlineJoin: "現場で話し合って決め", rightHeadlineEnd: "現場で話し合って決める" },
  { key: "change", name: "変化", leftText: "方針や組織はあまり変わらない", rightText: "方針や組織がよく変わる", leftHeadlineJoin: "方針や組織が落ち着いていて", leftHeadlineEnd: "方針や組織が落ち着いている", rightHeadlineJoin: "方針や組織がよく変わり", rightHeadlineEnd: "方針や組織がよく変わる" },
  { key: "closeness", name: "人との距離感", leftText: "仕事上の付き合いが中心", rightText: "仕事以外でも関わる", leftHeadlineJoin: "仕事上の付き合いが中心で", leftHeadlineEnd: "仕事上の付き合いが中心の", rightHeadlineJoin: "仕事以外でも関わりがあり", rightHeadlineEnd: "仕事以外でも関わりがある" },
];
const r = (id, name, fitScore, axes, updatedAt = "2026-10-16T00:00:00Z") => ({ experienceId: id, companyName: name, fitScore, axes, updatedAt });

test("対象0件: ①だけ・②未回答のレビューは対象にならない", () => {
  assert.deepEqual(computeTendency([], AXES), { kind: "none" });
  assert.deepEqual(computeTendency([r("a", "A社", 8, {}), r("b", "B社", 2, {})], AXES), { kind: "none" });
  /* マスタに無い軸だけの回答も数えない */
  assert.deepEqual(computeTendency([r("a", "A社", 8, { unknown_axis: 4 })], AXES), { kind: "none" });
});

test("対象1件: その会社の②の要約だけ（答えた軸だけ・並び順はマスタの順）", () => {
  const t = computeTendency([r("a", "SmartHR", 8, { decision: 4, work_style: 3 }), r("b", "前職", 4, {})], AXES);
  assert.equal(t.kind, "single");
  assert.deepEqual(t.company, { name: "SmartHR", fitScore: 8 });
  assert.deepEqual(t.summary.map((s) => [s.key, s.label]), [
    ["work_style", "やり方は自分で決める（やや）"],
    ["decision", "現場で話し合って決める（かなり）"],
  ]);
});

test("対象2件以上・差が小さい: フィット度の差が3未満なら傾向を出さない", () => {
  const t = computeTendency([r("a", "A社", 7, { work_style: 4 }), r("b", "B社", 5, { work_style: 0 })], AXES);
  assert.equal(FIT_GAP_MIN, 3);
  assert.deepEqual(t, { kind: "small_gap", high: { name: "A社", fitScore: 7 }, low: { name: "B社", fitScore: 5 } });
});

test("対象2件以上・差が大きい: 高フィット側の言い回しを最大2つつなぐ", () => {
  const t = computeTendency([
    r("hi", "SmartHR", 8, { work_style: 4, decision: 3, evaluation: 2, change: 1, closeness: 2 }),
    r("mid", "中間社", 6, { work_style: 2 }),
    r("lo", "前職", 4, { work_style: 0, decision: 1, evaluation: 1, change: 1, onboarding: 3 }),
  ], AXES);
  assert.equal(t.kind, "compare");
  assert.deepEqual(t.high, { name: "SmartHR", fitScore: 8 });
  assert.deepEqual(t.low, { name: "前職", fitScore: 4 });
  /* 差: work_style 4 / decision 2 / evaluation 1 / change 0。onboarding・closeness は片方だけなので出さない */
  assert.deepEqual(t.axes.map((a) => [a.key, a.diff, a.level]), [
    ["work_style", 4, "large"], ["evaluation", 1, "small"], ["decision", 2, "large"], ["change", 0, "none"],
  ]);
  assert.equal(t.headline, "やり方を任され、現場で話し合って決める職場で、満足度が高くなりやすいタイプです。");
});

test("差が大きい: 高フィット側が左なら左の言い回しを使う。3つ以上あっても見出しは2つまで", () => {
  const t = computeTendency([
    r("hi", "A社", 9, { work_style: 0, onboarding: 0, change: 0 }),
    r("lo", "B社", 2, { work_style: 4, onboarding: 3, change: 2 }),
  ], AXES);
  assert.equal(t.headline, "決まったやり方に沿って進め、自分で調べて覚えていく職場で、満足度が高くなりやすいタイプです。");
});

test("差が大きい軸が1つだけなら、言い切る形で終える", () => {
  const t = computeTendency([r("hi", "A社", 9, { decision: 4, work_style: 2 }), r("lo", "B社", 3, { decision: 1, work_style: 3 })], AXES);
  assert.equal(t.headline, "現場で話し合って決める職場で、満足度が高くなりやすいタイプです。");
});

test("差が大きい軸が無ければ見出しは null", () => {
  const t = computeTendency([r("hi", "A社", 9, { work_style: 2 }), r("lo", "B社", 3, { work_style: 3 })], AXES);
  assert.equal(t.kind, "compare");
  assert.equal(t.headline, null);
});

test("真ん中は「どちらとも」", () => {
  assert.equal(axisValueLabel(AXES[0], 2), "どちらとも");
  assert.equal(axisValueLabel(AXES[0], 1), "決まったやり方に沿って進める（やや）");
});
