/**
 * 入社後のふり返り（入社3か月・1年）のテスト。 node --test src/lib/joinCheckin/joinCheckin.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  JOIN_CHECKPOINTS, CHECKIN_CUSTOMERS, CHECKIN_GAP_KEYS, CHECKIN_FIT_MAX,
  monthsSince, canAnswerCheckpoint, dueCheckpoint, parseCheckinAnswers, latestAnsweredCheckpoint, isCheckpointKey,
} from "./constants.ts";
import { GAP_ITEMS, GAP_CHOICES, FIT_SCORE_MAX, AXIS_SCALE } from "../workplaceReview/constants.ts";

/** ★migration は適用前は pending/、適用後は migrations/ にある。どちらにあっても読む */
function readMigration() {
  for (const dir of ["pending", "migrations"]) {
    const url = new URL(`../../../supabase/${dir}/20261120090000_join_checkins.sql`, import.meta.url);
    if (fs.existsSync(url)) return fs.readFileSync(url, "utf8");
  }
  throw new Error("migration 20261120090000_join_checkins.sql が見つからない");
}

/** 日本時間の日付を作る（monthsSince は日本時間で数える） */
const jst = (s) => new Date(`${s}T12:00:00+09:00`);

test("★時点と相手の選択肢は migration の CHECK と同じ", () => {
  const sql = readMigration();
  const cp = /checkpoint in \(([^)]*)\)/.exec(sql);
  assert.ok(cp);
  assert.deepEqual([...cp[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]).sort(), JOIN_CHECKPOINTS.map((c) => c.key).sort());
  const cu = /customer in \(([^)]*)\)/.exec(sql);
  assert.ok(cu);
  assert.deepEqual([...cu[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort(), CHECKIN_CUSTOMERS.map((c) => c.value).sort());
});

test("★合っているか・入社前の話との差・軸の物差しは入社後レビューと同じ", () => {
  assert.deepEqual([...CHECKIN_GAP_KEYS], GAP_ITEMS.map((g) => g.key));
  assert.equal(GAP_CHOICES.length - 1, 2);
  assert.equal(CHECKIN_FIT_MAX, FIT_SCORE_MAX);
  assert.equal(AXIS_SCALE.length, 5);
});

test("入社からの月数（日付がまだ来ていない月は数えない・月だけなら1日）", () => {
  assert.equal(monthsSince("2026-03-20", jst("2026-06-19")), 2);
  assert.equal(monthsSince("2026-03-20", jst("2026-06-20")), 3);
  assert.equal(monthsSince("2026-03", jst("2026-06-01")), 3);
  assert.equal(monthsSince("2025-11-01", jst("2026-11-01")), 12);
  assert.equal(monthsSince(null), null);
  assert.equal(monthsSince("不明"), null);
});

test("★いま聞く時点: 在籍中・期間内・未回答だけ", () => {
  const none = {};
  /* 2か月 → まだ聞かない */
  assert.equal(dueCheckpoint({ startedAt: "2026-09-01", isCurrent: true, states: none }, jst("2026-11-20")), null);
  /* 3か月 → 3m */
  assert.equal(dueCheckpoint({ startedAt: "2026-08-01", isCurrent: true, states: none }, jst("2026-11-20")), "3m");
  /* 辞めた会社には聞かない */
  assert.equal(dueCheckpoint({ startedAt: "2026-08-01", isCurrent: false, states: none }, jst("2026-11-20")), null);
  /* 3m を答えた・答えないを押した → 聞かない */
  assert.equal(dueCheckpoint({ startedAt: "2026-08-01", isCurrent: true, states: { "3m": "answered" } }, jst("2026-11-20")), null);
  assert.equal(dueCheckpoint({ startedAt: "2026-08-01", isCurrent: true, states: { "3m": "skipped" } }, jst("2026-11-20")), null);
  /* 12か月 → 1y（3m を答えていなくても 3m はもう聞かない） */
  assert.equal(dueCheckpoint({ startedAt: "2025-11-01", isCurrent: true, states: none }, jst("2026-11-20")), "1y");
  /* 18か月を過ぎた古い職歴には聞かない */
  assert.equal(dueCheckpoint({ startedAt: "2025-01-01", isCurrent: true, states: none }, jst("2026-11-20")), null);
  /* 入社日が読めない */
  assert.equal(dueCheckpoint({ startedAt: null, isCurrent: true, states: none }, jst("2026-11-20")), null);
});

test("答えてよいか: 期間を過ぎていても月数がたっていれば答えられる", () => {
  assert.equal(canAnswerCheckpoint("3m", "2026-09-01", jst("2026-11-20")), false);
  assert.equal(canAnswerCheckpoint("3m", "2020-01-01", jst("2026-11-20")), true);
  assert.equal(canAnswerCheckpoint("1y", "2026-01-01", jst("2026-11-20")), false);
  assert.equal(isCheckpointKey("3m"), true);
  assert.equal(isCheckpointKey("6m"), false);
});

test("回答の検証: 合っているかと差の4項目は必須・軸と相手は任意・不正値は弾く", () => {
  const gaps = { gap_job: 1, gap_pay: 0, gap_growth: 2, gap_culture: 1 };
  const ok = parseCheckinAnswers({ fitScore: 7, gaps, axes: { onboarding: 4 }, customer: "smb" });
  assert.deepEqual(ok, { ok: true, value: { fitScore: 7, gaps, axes: { onboarding: 4 }, customer: "smb" } });
  assert.equal(parseCheckinAnswers({ fitScore: 7, gaps }).ok, true);
  assert.equal(parseCheckinAnswers({ gaps }).ok, false);
  assert.equal(parseCheckinAnswers({ fitScore: 11, gaps }).ok, false);
  assert.equal(parseCheckinAnswers({ fitScore: 7, gaps: { ...gaps, gap_pay: undefined } }).ok, false);
  assert.equal(parseCheckinAnswers({ fitScore: 7, gaps, axes: { onboarding: 5 } }).ok, false);
  assert.equal(parseCheckinAnswers({ fitScore: 7, gaps, axes: { "Bad-Key": 1 } }).ok, false);
  assert.equal(parseCheckinAnswers({ fitScore: 7, gaps, customer: "government" }).ok, false);
  assert.equal(parseCheckinAnswers({ fitScore: 7, gaps, customer: "" }).ok, true);
});

test("傾向には新しい時点（1年）を優先して使う", () => {
  assert.equal(latestAnsweredCheckpoint({ "3m": "answered", "1y": "answered" }), "1y");
  assert.equal(latestAnsweredCheckpoint({ "3m": "answered", "1y": "skipped" }), "3m");
  assert.equal(latestAnsweredCheckpoint({ "3m": "skipped" }), null);
});
