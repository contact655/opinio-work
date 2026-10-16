import { test } from "node:test";
import assert from "node:assert/strict";
import { domainFitStatus, reasonText, groupLabel, FIT_LIKED_MIN, FIT_DISLIKED_MAX, SAME_DOMAIN_LIKED_POINTS, SIGNAL_WEIGHTS } from "./weights.ts";

test("しきい値と点数", () => {
  assert.equal(FIT_LIKED_MIN, 7);
  assert.equal(FIT_DISLIKED_MAX, 3);
  assert.equal(SAME_DOMAIN_LIKED_POINTS, 40);
  assert.equal(SIGNAL_WEIGHTS.same_domain, 30);
});

test("1社でも7以上なら liked（低い会社が混ざっていても）", () => {
  assert.equal(domainFitStatus([7]), "liked");
  assert.equal(domainFitStatus([2, 10]), "liked");
  assert.equal(domainFitStatus([null, 8]), "liked");
});

test("すべて回答済みで、すべて3以下なら disliked", () => {
  assert.equal(domainFitStatus([3]), "disliked");
  assert.equal(domainFitStatus([0, 2]), "disliked");
});

test("未回答が混ざる・4〜6・空は neutral（決めつけない）", () => {
  assert.equal(domainFitStatus([]), "neutral");
  assert.equal(domainFitStatus([null]), "neutral");
  assert.equal(domainFitStatus([2, null]), "neutral");
  assert.equal(domainFitStatus([4]), "neutral");
  assert.equal(domainFitStatus([6, 3]), "neutral");
});

test("理由文と見出し: liked のときだけ「合っていたと答えた会社」", () => {
  const d = { key: "same_domain", domainName: "HR Tech", fromCurrent: false };
  assert.equal(reasonText({ ...d, liked: true }), "合っていたと答えた会社と同じHR Tech領域です");
  assert.equal(groupLabel({ ...d, liked: true }), "合っていたと答えた会社と同じHR Tech領域");
  assert.equal(reasonText(d), "前職と同じHR Tech領域の会社です");
  assert.equal(reasonText({ ...d, fromCurrent: true, liked: false }), "いまの勤務先と同じHR Tech領域の会社です");
});
