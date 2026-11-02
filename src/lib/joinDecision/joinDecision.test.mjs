/**
 * 入社の決め手（1問）のテスト。 node --test src/lib/joinDecision/joinDecision.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  JOIN_DECISION_GROUPS, JOIN_DECISION_OPTIONS, JOIN_DECISION_MAX, JOIN_DECISION_VERSION,
  parseJoinDecision, isCountableAnswer, promptKind, shuffledGroups, topReasons,
} from "./constants.ts";
import { MIN_REASON_COUNT } from "../constants/aggregate.ts";

test("選択肢は14個・4つのまとまり・v1", () => {
  assert.equal(JOIN_DECISION_OPTIONS.length, 14);
  assert.deepEqual(JOIN_DECISION_GROUPS.map((g) => g.options.length), [5, 3, 3, 3]);
  assert.equal(new Set(JOIN_DECISION_OPTIONS.map((o) => o.value)).size, 14);
  assert.equal(JOIN_DECISION_VERSION, 1);
});

test("★選択肢は migration の CHECK と同じ", async () => {
  const fs = await import("node:fs");
  const sql = fs.readFileSync(new URL("../../../supabase/migrations/20261102090000_join_decisions.sql", import.meta.url), "utf8");
  const m = /reasons <@ array\[([\s\S]*?)\]::text\[\]/.exec(sql);
  assert.ok(m);
  const keys = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  assert.deepEqual(keys.sort(), JOIN_DECISION_OPTIONS.map((o) => o.value).sort());
});

test("3つまで・不正値は弾く・並びは選択肢の順", () => {
  assert.deepEqual(parseJoinDecision(["salary", "position"]), { ok: true, value: ["position", "salary"] });
  assert.equal(parseJoinDecision(["a"]).ok, false);
  assert.equal(parseJoinDecision([]).ok, false);
  assert.equal(parseJoinDecision(["position", "skills", "salary", "growth"]).ok, false);
  assert.equal(JOIN_DECISION_MAX, 3);
});

test("集計に数えるのは入社日から3か月以内に答えた回答だけ", () => {
  assert.equal(isCountableAnswer("2026-04-30T00:00:00Z", "2026-02-01"), true);
  assert.equal(isCountableAnswer("2026-05-02T00:00:00Z", "2026-02-01"), false);
  assert.equal(isCountableAnswer(null, "2026-02-01"), false);
  assert.equal(isCountableAnswer("2026-03-01T00:00:00Z", null), false);
});

test("スキップした人には30日後に1回だけ", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  assert.equal(promptKind({ status: "none", skippedAt: null, reshownAt: null }, now), "first");
  assert.equal(promptKind({ status: "answered", skippedAt: null, reshownAt: null }, now), null);
  assert.equal(promptKind({ status: "skipped", skippedAt: "2026-10-10T00:00:00Z", reshownAt: null }, now), null);
  assert.equal(promptKind({ status: "skipped", skippedAt: "2026-10-01T00:00:00Z", reshownAt: null }, now), "reshow");
  assert.equal(promptKind({ status: "skipped", skippedAt: "2026-09-01T00:00:00Z", reshownAt: "2026-10-01T00:00:00Z" }, now), null);
});

test("まとまりの並びは入れ替わるが、中身は同じ", () => {
  const seq = [0.1, 0.9, 0.5];
  let i = 0;
  const g = shuffledGroups(() => seq[i++ % seq.length]);
  assert.deepEqual(g.map((x) => x.key).sort(), JOIN_DECISION_GROUPS.map((x) => x.key).sort());
  assert.deepEqual(g.find((x) => x.key === "work"), JOIN_DECISION_GROUPS[0]);
});

test("★上位3つは10人未満なら出さない・人数を返さない", () => {
  assert.equal(MIN_REASON_COUNT, 10);
  const nine = Array.from({ length: 9 }, () => ["salary"]);
  assert.equal(topReasons(nine, MIN_REASON_COUNT), null);
  const ten = [...nine, ["position", "salary"]];
  const top = topReasons(ten, MIN_REASON_COUNT);
  assert.deepEqual(top, ["salary", "position"]);
  assert.ok(top.every((x) => typeof x === "string"));
});

test("同数は選択肢の並びで決まる（毎回同じ）", () => {
  const rs = Array.from({ length: 10 }, (_, k) => (k % 2 ? ["work_hours", "referral"] : ["referral", "position"]));
  assert.deepEqual(topReasons(rs, 10), ["referral", "position", "work_hours"]);
});
