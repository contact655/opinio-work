import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldAskStanceReconfirm, isStanceReconfirmHidden, stanceReconfirmHiddenUntil, stanceReconfirmAction,
  STANCE_RECONFIRM_AFTER_DAYS, STANCE_RECONFIRM_SNOOZE_DAYS,
} from "./stanceReconfirm.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 12);
const base = { onboardingCompleted: true, isTest: false, careerStance: "open", careerStanceUpdatedAt: null, nowMs: now };
const ago = (d) => new Date(now - d * DAY).toISOString();

test("90日と30日", () => {
  assert.equal(STANCE_RECONFIRM_AFTER_DAYS, 90);
  assert.equal(STANCE_RECONFIRM_SNOOZE_DAYS, 30);
});

test("日時が空なら聞く・90日たったら聞く・それより新しければ聞かない", () => {
  assert.equal(shouldAskStanceReconfirm(base), true);
  assert.equal(shouldAskStanceReconfirm({ ...base, careerStanceUpdatedAt: ago(90) }), true);
  assert.equal(shouldAskStanceReconfirm({ ...base, careerStanceUpdatedAt: ago(89) }), false);
  assert.equal(shouldAskStanceReconfirm({ ...base, careerStanceUpdatedAt: "壊れた値" }), true);
});

test("未回答・オンボーディング未完了には聞かない。検証用には聞く", () => {
  assert.equal(shouldAskStanceReconfirm({ ...base, careerStance: null }), false);
  assert.equal(shouldAskStanceReconfirm({ ...base, onboardingCompleted: false }), false);
  assert.equal(shouldAskStanceReconfirm({ ...base, isTest: true }), true);
});

test("今は考えていない人にも聞く（気持ちが変わったかを確かめるため）", () => {
  assert.equal(shouldAskStanceReconfirm({ ...base, careerStance: "no_contact" }), true);
});

test("閉じたら30日は出さない。壊れた値は出す", () => {
  const until = stanceReconfirmHiddenUntil(now);
  assert.equal(isStanceReconfirmHidden(String(until), now), true);
  assert.equal(isStanceReconfirmHidden(String(until), now + 30 * DAY - 1), true);
  assert.equal(isStanceReconfirmHidden(String(until), now + 30 * DAY), false);
  assert.equal(isStanceReconfirmHidden(null, now), false);
  assert.equal(isStanceReconfirmHidden("abc", now), false);
});

test("同じ値なら確かめただけ、違えば変更", () => {
  assert.equal(stanceReconfirmAction("open", "open"), "confirm");
  assert.equal(stanceReconfirmAction("open", "active"), "change");
});
