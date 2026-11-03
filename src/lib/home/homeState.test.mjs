import { test } from "node:test";
import assert from "node:assert/strict";
import { leftNextStepWhileCareerPrompt, CAREER_NEXT_STEP_LABEL, careerBannerHiddenUntil, isCareerBannerHidden, CAREER_BANNER_HIDE_DAYS, HOME_MOBILE_FOR_YOU_AFTER, HOME_MOBILE_PATHS_AFTER } from "./homeState.ts";

const DAY = 24 * 60 * 60 * 1000;

test("職歴の帯は×で閉じたら7日間出さない", () => {
  assert.equal(CAREER_BANNER_HIDE_DAYS, 7);
  const now = Date.UTC(2026, 10, 4);
  const until = careerBannerHiddenUntil(now);
  assert.equal(isCareerBannerHidden(String(until), now), true);
  assert.equal(isCareerBannerHidden(String(until), now + 7 * DAY - 1), true);
  assert.equal(isCareerBannerHidden(String(until), now + 7 * DAY), false);
});

test("記録が無い・壊れているときは出す", () => {
  assert.equal(isCareerBannerHidden(null, 0), false);
  assert.equal(isCareerBannerHidden("", 0), false);
  assert.equal(isCareerBannerHidden("abc", 0), false);
});

test("スマホで挟む位置: 合う会社は2件目と3件目の間、行き先は5件目のあと", () => {
  assert.equal(HOME_MOBILE_FOR_YOU_AFTER, 1);
  assert.equal(HOME_MOBILE_PATHS_AFTER, 4);
});

test("職歴の案内を出している間は、左の列の「職歴を追加する」を隠す（ほかの次の1件は隠さない）", () => {
  const career = { label: CAREER_NEXT_STEP_LABEL, href: "/mypage" };
  const photo = { label: "プロフィール写真を追加する", href: "/mypage" };
  assert.equal(leftNextStepWhileCareerPrompt(career, true), null);
  assert.deepEqual(leftNextStepWhileCareerPrompt(career, false), career);
  assert.deepEqual(leftNextStepWhileCareerPrompt(photo, true), photo);
  assert.equal(leftNextStepWhileCareerPrompt(null, true), null);
});
