import { test } from "node:test";
import assert from "node:assert/strict";
import { homeStateOf, homeHeadline } from "./homeState.ts";

test("ホームの状態 A〜D", () => {
  assert.equal(homeStateOf({ hasExperience: false, answeredTurns: 0, hasSimilar: true }), "A");
  assert.equal(homeStateOf({ hasExperience: true, answeredTurns: 0, hasSimilar: true }), "B");
  assert.equal(homeStateOf({ hasExperience: true, answeredTurns: 1, hasSimilar: false }), "C");
  assert.equal(homeStateOf({ hasExperience: true, answeredTurns: 2, hasSimilar: true }), "D");
});

test("見出しは1年後の割合が出せるときだけ「こう感じています」", () => {
  assert.equal(homeHeadline(false), "あなたと似た経歴の人は、こう動いています。");
  assert.equal(homeHeadline(true), "あなたと似た経歴の人は、こう動いて、こう感じています。");
});
