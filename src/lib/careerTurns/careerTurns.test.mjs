import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DECISIVE_REASON_LABELS, NEXT_PRIORITY_LABELS, FIT_GOOD_MIN, FIT_BAD_MAX,
  canAskFitAfterYear, parseTurnAnswers, nextPriorityQuestion,
} from "./constants.ts";
import { buildCareerTurnTendency } from "./tendency.ts";

const L = { reason: (k) => DECISIVE_REASON_LABELS[k] ?? k, priority: (k) => NEXT_PRIORITY_LABELS[k] ?? k, goodMin: FIT_GOOD_MIN, badMax: FIT_BAD_MAX };
const T = (over) => ({ companyName: "A社", isFirst: false, decisiveReasons: [], nextPriority: null, fitAfterYear: null, ...over });

test("回答が無ければ空、1つでもあれば必ず1文", () => {
  assert.deepEqual(buildCareerTurnTendency([], L), []);
  assert.deepEqual(buildCareerTurnTendency([T({})], L), []);
  for (const t of [
    T({ decisiveReasons: ["skills"] }),
    T({ nextPriority: "salary" }),
    T({ nextPriority: "salary", isFirst: true }),
    T({ fitAfterYear: 5 }),
    T({ fitAfterYear: 1 }),
    T({ fitAfterYear: 3 }),
  ]) {
    const out = buildCareerTurnTendency([t], L);
    assert.ok(out.length >= 1, JSON.stringify(t));
  }
});

test("合っていた会社の決め手を文にする（指示書の例の形）", () => {
  const out = buildCareerTurnTendency([T({ companyName: "セールスフォース", decisiveReasons: ["skills", "salary"], fitAfterYear: 5 })], L);
  assert.equal(out[0], "決め手に「身につくスキル」「年収・待遇」を選んだセールスフォースで「合っていた」と答えています。");
});

test("合っていた2社に共通する決め手を先に出す", () => {
  const out = buildCareerTurnTendency([
    T({ companyName: "A社", decisiveReasons: ["skills", "people"], fitAfterYear: 4 }),
    T({ companyName: "B社", decisiveReasons: ["skills"], fitAfterYear: 5 }),
  ], L);
  assert.equal(out[0], "決め手に「身につくスキル」を選んだ会社では、2社とも「合っていた」と答えています。");
  assert.ok(out.length <= 3);
});

test("合っていなかった会社と、3（どちらともいえない）", () => {
  assert.match(buildCareerTurnTendency([T({ decisiveReasons: ["stability"], fitAfterYear: 2 })], L)[0], /「合っていなかった」/);
  assert.match(buildCareerTurnTendency([T({ fitAfterYear: 3 })], L)[0], /どちらともいえない/);
});

test("Q2 は最初の会社だけ「社会に出るとき」", () => {
  assert.match(buildCareerTurnTendency([T({ nextPriority: "deepen_expertise", isFirst: true })], L)[0], /^社会に出るときは/);
  assert.match(buildCareerTurnTendency([T({ nextPriority: "deepen_expertise" })], L)[0], /^A社に移るときは/);
  assert.equal(nextPriorityQuestion(true), "社会に出るときに、いちばん求めていたことは？");
  assert.equal(nextPriorityQuestion(false), "この会社に移るときに、いちばん求めていたことは？");
});

test("Q3 は入社月から12か月たってから", () => {
  const now = new Date(2026, 9, 27); // 2026-10
  assert.equal(canAskFitAfterYear("2025-10-01", now), true);
  assert.equal(canAskFitAfterYear("2025-11-01", now), false);
  assert.equal(canAskFitAfterYear(null, now), false);
});

test("回答の検証（不正値は弾き、並びを揃える）", () => {
  assert.deepEqual(parseTurnAnswers({ decisiveReasons: ["salary", "skills"], nextPriority: "other", fitAfterYear: 4 }),
    { ok: true, value: { decisiveReasons: ["skills", "salary"], nextPriority: "other", fitAfterYear: 4 } });
  assert.equal(parseTurnAnswers({ decisiveReasons: ["a", "b"] }).ok, false);
  assert.equal(parseTurnAnswers({ decisiveReasons: ["skills", "salary", "people", "culture"] }).ok, false);
  assert.equal(parseTurnAnswers({ nextPriority: "job_content" }).ok, false);
  assert.equal(parseTurnAnswers({ fitAfterYear: 0 }).ok, false);
  assert.equal(parseTurnAnswers({ fitAfterYear: 2.5 }).ok, false);
  assert.equal(parseTurnAnswers(null).ok, false);
});
