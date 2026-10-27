/**
 * ホームの「はじめにやること」（homeChecklist.ts）。npm test
 * ⚠️ 候補者を探すへの入口（2026-10-28）: 許可済みは「探して送る」、それ以外は「利用を依頼する」、停止中は出さない。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildHomeChecklist } from "./homeChecklist.ts";

const base = { listed: true, companyMissing: 0, totalJobs: 0, publishedJobs: 0, nearestDraft: null, roles: 0, employees: 0, acceptingCasualMeetings: false };
const scoutItem = (scout) => buildHomeChecklist({ ...base, scout }).find((i) => i.key === "candidateSearch");

test("候補者を探す: 許可済みで未送信なら「探して送る」が未完了でいちばん上", () => {
  const items = buildHomeChecklist({ ...base, scout: { state: "granted", suspended: false, everSent: false } });
  assert.equal(items[0].key, "candidateSearch");
  assert.equal(items[0].label, "候補者を探して、最初のメッセージを送る");
  assert.equal(items[0].done, false);
  assert.equal(items[0].href, "/biz/candidates");
});
test("候補者を探す: 一度でも送れば済み・取れなければ未完了", () => {
  assert.equal(scoutItem({ state: "granted", suspended: false, everSent: true }).done, true);
  assert.equal(scoutItem({ state: "granted", suspended: false, everSent: null }).done, false);
});
test("候補者を探す: 未許可・取り消し・依頼中は「利用を依頼する」", () => {
  for (const state of ["none", "revoked", "requested"]) {
    const it = scoutItem({ state, suspended: false, everSent: null });
    assert.equal(it.label, "スカウト機能の利用を依頼する");
    assert.equal(it.done, false);
  }
  assert.match(scoutItem({ state: "requested", suspended: false, everSent: null }).hint, /依頼を受け付けました/);
});
test("候補者を探す: 停止中と、渡されないときは出さない", () => {
  assert.equal(scoutItem({ state: "granted", suspended: true, everSent: false }), undefined);
  assert.equal(buildHomeChecklist(base).some((i) => i.key === "candidateSearch"), false);
});
