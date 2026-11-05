/**
 * 「メッセージ」ボタンの出し分けのテスト。 node --test src/lib/constants/messageButton.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { messageButtonVisible } from "./messageButton.ts";

const base = { isSelf: false, targetVisible: true, viewerIsTest: false, targetIsTest: false, blockedByViewer: false };

test("ふつうの相手には出す（相手の設定は見ない）", () => {
  assert.equal(messageButtonVisible(base), true);
  assert.equal(messageButtonVisible({ ...base, viewerIsTest: null }), true, "未ログインは実在の人として扱う");
});

test("自分・見られない人・自分がブロックした相手には出さない", () => {
  assert.equal(messageButtonVisible({ ...base, isSelf: true }), false);
  assert.equal(messageButtonVisible({ ...base, targetVisible: false }), false);
  assert.equal(messageButtonVisible({ ...base, blockedByViewer: true }), false);
});

test("検証用と実在の組み合わせには出さない", () => {
  assert.equal(messageButtonVisible({ ...base, viewerIsTest: true }), false);
  assert.equal(messageButtonVisible({ ...base, targetIsTest: true }), false);
  assert.equal(messageButtonVisible({ ...base, viewerIsTest: true, targetIsTest: true }), true);
  assert.equal(messageButtonVisible({ ...base, viewerIsTest: null, targetIsTest: true }), false);
});
