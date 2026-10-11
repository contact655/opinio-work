/**
 * 求人の状態（画面の呼び方）の対応（jobState.ts）。npm test
 * ⚠️ DB の値は増やしていない。画面の3つ（下書き／公開中／停止中）への寄せ方がずれると、
 *    タブの件数・⋯メニュー（再開する／再開を依頼する）・運営画面の呼び方が割れる。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { jobState, jobStateTab, JOB_STATE_LABEL } from "./jobState.ts";

const cases = [
  [{ status: "draft" }, "draft", "draft", "下書き"],
  [{ status: null }, "draft", "draft", "下書き"],
  [{ status: "published" }, "published", "published", "公開中"],
  [{ status: "private", stoppedAt: null }, "stopped_self", "stopped", "停止中（自社で停止）"],
  [{ status: "private", stoppedAt: "2026-10-12T00:00:00Z" }, "stopped_ops", "stopped", "停止中（運営が停止）"],
  [{ status: "pending_review", stoppedAt: "2026-10-12T00:00:00Z" }, "reopen_requested", "stopped", "停止中（運営が停止・再開を依頼済み）"],
  [{ status: "rejected" }, "stopped_ops", "stopped", "停止中（運営が停止）"],
];
for (const [input, state, tab, label] of cases) {
  test(`${JSON.stringify(input)} → ${label}`, () => {
    const s = jobState(input);
    assert.equal(s, state);
    assert.equal(jobStateTab(s), tab);
    assert.equal(JOB_STATE_LABEL[s], label);
  });
}
