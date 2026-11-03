import { test } from "node:test";
import assert from "node:assert/strict";
import { CAREER_NEXT_STEP_LABEL, CAREER_NEXT_STEP_HREF, careerBannerHiddenUntil, isCareerBannerHidden, CAREER_BANNER_HIDE_DAYS, HOME_MOBILE_FOR_YOU_AFTER, HOME_MOBILE_PATHS_AFTER, HOME_MOBILE_SUGGEST_AFTER } from "./homeState.ts";

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

test("スマホのおすすめのユーザーは、合う会社より後・行き先より前（4件目のあと）", () => {
  assert.equal(HOME_MOBILE_SUGGEST_AFTER, 3);
  assert.ok(HOME_MOBILE_SUGGEST_AFTER > HOME_MOBILE_FOR_YOU_AFTER && HOME_MOBILE_SUGGEST_AFTER < HOME_MOBILE_PATHS_AFTER);
});

test("職歴を入れる画面の行き先は1つ（ホームの左のカードと次の1件で同じ）", () => {
  assert.equal(CAREER_NEXT_STEP_HREF, "/mypage");
  assert.equal(CAREER_NEXT_STEP_LABEL, "職歴を追加する");
});
