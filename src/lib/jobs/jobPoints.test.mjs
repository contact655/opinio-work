import { test } from "node:test";
import assert from "node:assert/strict";
import { jobPointLines, normalizeJobPoints } from "./jobPoints.ts";

test("改行で分けて3行まで・記号と空行を落とす", () => {
  assert.deepEqual(jobPointLines("・一\n\n- 二\n三\n四"), ["一", "二", "三"]);
});
test("1段落の文はそのまま1行", () => {
  assert.deepEqual(jobPointLines("顧客直で設計からお任せします"), ["顧客直で設計からお任せします"]);
});
test("空は null・1行60字まで", () => {
  assert.equal(normalizeJobPoints("  \n "), null);
  assert.equal(normalizeJobPoints(undefined), null);
  assert.equal(normalizeJobPoints("あ".repeat(70)), "あ".repeat(60));
});
