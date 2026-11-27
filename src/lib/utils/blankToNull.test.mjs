import { test } from "node:test";
import assert from "node:assert/strict";
import { blankToNull } from "./blankToNull.ts";

test("空・空白だけの文字列は null", () => {
  assert.equal(blankToNull(""), null);
  assert.equal(blankToNull("   "), null);
  assert.equal(blankToNull("\n\t "), null);
  assert.equal(blankToNull("　"), null); // 全角の空白も空として扱う（String.prototype.trim が除く）
});

test("中身のある文字列は変えない（前後の空白も残す）", () => {
  assert.equal(blankToNull("株式会社Opinio"), "株式会社Opinio");
  assert.equal(blankToNull("  見出し\n本文  "), "  見出し\n本文  ");
});

test("文字列でないものはそのまま", () => {
  assert.equal(blankToNull(null), null);
  assert.equal(blankToNull(undefined), undefined);
  assert.equal(blankToNull(0), 0);
  assert.equal(blankToNull(false), false);
  const arr = ["a"];
  assert.equal(blankToNull(arr), arr);
});
