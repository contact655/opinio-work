/**
 * 「行き先」（/paths）の集計のテスト。 node --test src/lib/paths/paths.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  computePaths, pathCards, normalizeStart, widenStart, widerWithRows, hasAnyRow, PATHS_CARD_LIMIT,
} from "./compute.ts";

const side = (o = {}) => ({
  companyId: "co-a", companyName: "A社", roleTopId: "sales", industryTopId: "it", usable: true,
  startedAt: "2020-04", isCurrent: false, ...o,
});
const move = (userId, from = {}, to = {}, o = {}) => ({
  userId, from: side(from), to: side({ companyId: "co-b", companyName: "B社", industryTopId: "finance", startedAt: "2023-04", isCurrent: true, ...to }),
  aggregatable: true, cardable: true, ...o,
});
const SALES = { roleId: "sales", industryId: null, companyId: null };
const people = (n, to = {}, o = {}) => Array.from({ length: n }, (_, i) => move(`u${i}`, {}, to, o));

test("★5人以上で集計が出る。4人なら行も人数も出さない", () => {
  const five = computePaths(people(5), SALES, 5);
  assert.equal(five.moverCount, 5);
  assert.deepEqual(five.company, [{ id: "co-b", count: 5 }]);
  assert.deepEqual(five.industry, [{ id: "finance", count: 5 }]);
  const four = computePaths(people(4), SALES, 5);
  assert.deepEqual(four, { moverCount: null, company: [], role: [], industry: [] });
});

test("★各行は5人以上だけ。5人未満の行は「その他」にもまとめない", () => {
  const moves = [...people(5), move("x1", {}, { companyId: "co-c" }), move("x2", {}, { companyId: "co-c" })];
  const s = computePaths(moves, SALES, 5);
  assert.equal(s.moverCount, 7);
  assert.deepEqual(s.company, [{ id: "co-b", count: 5 }], "co-c（2人）は出ない");
  assert.ok(!JSON.stringify(s).includes("その他"));
});

test("★同じ人が何度移っても各行で1人と数える", () => {
  const moves = [...people(4), move("u0", { startedAt: "2015-04" }, { startedAt: "2018-04" })];
  assert.equal(computePaths(moves, SALES, 5).moverCount, null, "延べ5件でも4人");
});

test("★集計の母数は aggregatable の人だけ（統計利用を止めた人などは数えない）", () => {
  const moves = [...people(4), move("opt", {}, {}, { aggregatable: false })];
  assert.equal(computePaths(moves, SALES, 5).moverCount, null);
});

test("★外す職歴（検証用の会社・エージェント・会社名を出さない職歴）は移動の単位で外す", () => {
  const moves = [...people(4), move("agent", {}, { usable: false })];
  assert.equal(computePaths(moves, SALES, 5).moverCount, null, "行き先が使えない移動は数えない");
  const moves2 = [...people(4), move("agent2", { usable: false })];
  assert.equal(computePaths(moves2, SALES, 5).moverCount, null, "前が使えない移動も数えない");
});

test("★集計の出力に人を特定する値（user_id）を入れない", () => {
  const s = computePaths(people(6), SALES, 5);
  assert.ok(!JSON.stringify(s).match(/"u\d"/), "user_id が入っていない");
  assert.deepEqual(Object.keys(s).sort(), ["company", "industry", "moverCount", "role"]);
});

test("起点: 会社と業界は同時に持たない（会社を残す）・何も無ければ null", () => {
  assert.deepEqual(normalizeStart({ roleId: "r", industryId: "i", companyId: "c" }), { roleId: "r", industryId: null, companyId: "c" });
  assert.equal(normalizeStart({}), null);
  assert.deepEqual(normalizeStart({ industryId: "i" }), { roleId: null, industryId: "i", companyId: null });
});

test("起点: 職種×業界・職種×会社で絞れる", () => {
  const moves = [...people(5), ...Array.from({ length: 5 }, (_, i) => move(`m${i}`, { industryTopId: "maker" }))];
  assert.equal(computePaths(moves, { roleId: "sales", industryId: "it", companyId: null }, 5).moverCount, 5);
  assert.equal(computePaths(moves, { roleId: "sales", industryId: null, companyId: "co-a" }, 5).moverCount, 10);
  assert.equal(computePaths(moves, { roleId: "eng", industryId: null, companyId: null }, 5).moverCount, null);
});

test("★個人カード: cardable の人だけ・1人1件（いちばん新しい移動）・自分は出さない・上限あり", () => {
  const moves = [
    move("a", {}, { startedAt: "2021-01" }),
    move("a", {}, { startedAt: "2024-01" }),
    move("b", {}, {}, { cardable: false }),
    move("me"),
    move("c", { usable: false }),
  ];
  const cards = pathCards(moves, SALES, { excludeUserId: "me" });
  assert.deepEqual(cards.map((c) => [c.userId, c.to.startedAt]), [["a", "2024-01"]]);
  assert.equal(pathCards(people(40), SALES, { excludeUserId: null }).length, PATHS_CARD_LIMIT);
});

test("★個人カードは集計の下限と関係なく出る（ログイン中だけ使う）", () => {
  assert.equal(computePaths(people(2), SALES, 5).moverCount, null);
  assert.equal(pathCards(people(2), SALES, { excludeUserId: null }).length, 2);
});

test("一段広げる: 職種×会社→職種／業界×職種、会社→業界、職種×業界→職種／業界、単独の職種・業界は広げない", () => {
  const ind = (c) => (c === "co-a" ? "it" : null);
  assert.deepEqual(widenStart({ roleId: "sales", industryId: null, companyId: "co-a" }, ind), [
    { roleId: "sales", industryId: null, companyId: null }, { roleId: "sales", industryId: "it", companyId: null },
  ]);
  assert.deepEqual(widenStart({ roleId: null, industryId: null, companyId: "co-a" }, ind), [{ roleId: null, industryId: "it", companyId: null }]);
  assert.deepEqual(widenStart({ roleId: "sales", industryId: "it", companyId: null }, ind), [
    { roleId: "sales", industryId: null, companyId: null }, { roleId: null, industryId: "it", companyId: null },
  ]);
  assert.deepEqual(widenStart(SALES, ind), []);
  assert.deepEqual(widenStart({ roleId: null, industryId: "it", companyId: null }, ind), []);
});

test("一段広げる: 集計の行が出る候補だけを返す", () => {
  const moves = [...people(5, {}, {}), move("z", { roleTopId: "eng" })];
  const ind = () => "it";
  const wider = widerWithRows(moves, { roleId: "sales", industryId: null, companyId: "co-x" }, 5, ind);
  assert.deepEqual(wider, [{ roleId: "sales", industryId: null, companyId: null }, { roleId: "sales", industryId: "it", companyId: null }]);
  assert.ok(wider.every((s) => hasAnyRow(computePaths(moves, s, 5))));
});

test("★決め手の回答を読まない（compute と server に回答の表・列の名前が無い）", () => {
  for (const f of ["./compute.ts", "./server.ts"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.doesNotMatch(src, /ow_join_decisions|ow_career_turns|join_reasons|join_reason_primary|ow_workplace_reviews|loadPopulationCached/, f);
  }
});
