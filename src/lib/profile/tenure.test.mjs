import { test } from "node:test";
import assert from "node:assert/strict";
import { tenureMonths, formatTenure, formatDuration } from "./tenure.ts";

/* ★在籍期間（2026-10-26 / フェーズ1b・案C）。開始月と終了月を含め、重なりを除いて足す */

const NOW = new Date(2026, 9, 26); // 2026-10

test("1つの期間は開始月と終了月を含める", () => {
  assert.equal(tenureMonths([{ startedAt: "2013-04", endedAt: "2017-03" }], NOW), 48);
  assert.equal(tenureMonths([{ startedAt: "2025-01-01", endedAt: "2025-07-31" }], NOW), 7);
});

test("現職は今月まで含める", () => {
  assert.equal(tenureMonths([{ startedAt: "2026-10-01", endedAt: null }], NOW), 1);
  assert.equal(tenureMonths([{ startedAt: "2020-07-01", endedAt: null }], NOW), 76);
});

test("12-31 → 01-01 は隣の月として続ける（木村雅樹さんの形）", () => {
  assert.equal(tenureMonths([
    { startedAt: "2021-11-01", endedAt: "2024-12-31" },
    { startedAt: "2025-01-01", endedAt: "2025-07-31" },
  ], NOW), 45); // 3年9ヶ月
});

test("隣の月で始まる（木村勇人さんの形）", () => {
  assert.equal(tenureMonths([
    { startedAt: "2019-02-01", endedAt: "2020-03-01" },
    { startedAt: "2020-04-01", endedAt: "2025-01-01" },
  ], NOW), 72); // 6年
});

test("終了日と次の開始日が同じ月は1回だけ数える（大塚さんの形）", () => {
  assert.equal(tenureMonths([
    { startedAt: "2012-04-01", endedAt: "2018-07-01" },
    { startedAt: "2018-07-01", endedAt: "2020-07-01" },
    { startedAt: "2020-07-01", endedAt: null },
  ], NOW), 175); // 2012-04〜2026-10
});

test("空白の月は数えない（辞めて戻った人）", () => {
  assert.equal(tenureMonths([
    { startedAt: "2020-01", endedAt: "2020-12" },
    { startedAt: "2022-01", endedAt: "2022-06" },
  ], NOW), 18);
});

test("並び順に関係なく、包み込む期間も重ねて数えない", () => {
  assert.equal(tenureMonths([
    { startedAt: "2021-03", endedAt: "2021-05" },
    { startedAt: "2020-01", endedAt: "2022-12" },
  ], NOW), 36);
});

test("数えられない期間は落とし、何も残らなければ null", () => {
  assert.equal(tenureMonths([], NOW), null);
  assert.equal(tenureMonths([{ startedAt: null, endedAt: "2020-01" }], NOW), null);
  assert.equal(tenureMonths([{ startedAt: "2020-05", endedAt: "2020-01" }], NOW), null);
  assert.equal(tenureMonths([{ startedAt: "abc", endedAt: null }, { startedAt: "2020-01", endedAt: "2020-03" }], NOW), 3);
});

test("表示の文字列", () => {
  assert.equal(formatTenure([]), "");
  assert.equal(formatDuration("2013-04", "2017-03"), "4年");
  assert.equal(formatDuration("2021-11-01", "2024-12-31"), "3年2ヶ月");
});
