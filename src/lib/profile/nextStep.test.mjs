import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickProfileNextStep, homeProfileNextStep, parseProfileFocus, profileNextStepHref,
  PROFILE_NEXT_STEP_SIDEBAR_LABEL, PROFILE_NEXT_STEP_SHORT_LABEL,
} from "./nextStep.ts";
import { CAREER_NEXT_STEP_LABEL } from "../home/homeState.ts";

const FULL = { experienceCount: 2, hasAvatar: true, hasAboutMe: true, hasHeadline: true, educationCount: 1, freeTextEducationCount: 0 };

test("判定の順番は 職歴 → 写真 → 学歴 → 学校を一覧から → 肩書き → 自己紹介", () => {
  const empty = { experienceCount: 0, hasAvatar: false, hasAboutMe: false, hasHeadline: false, educationCount: 0, freeTextEducationCount: 0 };
  assert.equal(pickProfileNextStep(empty), "career");
  assert.equal(pickProfileNextStep({ ...empty, experienceCount: 1 }), "photo");
  assert.equal(pickProfileNextStep({ ...FULL, hasAvatar: false, educationCount: 0 }), "photo");
  assert.equal(pickProfileNextStep({ ...FULL, educationCount: 0, hasHeadline: false }), "education");
  assert.equal(pickProfileNextStep({ ...FULL, freeTextEducationCount: 1, hasHeadline: false }), "school");
  assert.equal(pickProfileNextStep({ ...FULL, hasHeadline: false, hasAboutMe: false }), "headline");
  assert.equal(pickProfileNextStep({ ...FULL, hasAboutMe: false }), "about");
  assert.equal(pickProfileNextStep(FULL), null);
});

test("ホームの左のカード: 職歴0件と全部埋まっているときは出さない", () => {
  assert.equal(homeProfileNextStep("career"), null);
  assert.equal(homeProfileNextStep(null), null);
  assert.deepEqual(homeProfileNextStep("photo"), { label: "写真を追加する", href: "/mypage?focus=photo" });
  for (const k of ["photo", "education", "school", "headline", "about"]) {
    const s = homeProfileNextStep(k);
    assert.equal(s.label, PROFILE_NEXT_STEP_SHORT_LABEL[k]);
    assert.equal(parseProfileFocus(new URL(s.href, "http://x").searchParams.get("focus")), k);
  }
});

test("?focus= は知らない値を null にする", () => {
  assert.equal(parseProfileFocus("career"), null);
  assert.equal(parseProfileFocus("birth"), null);
  assert.equal(parseProfileFocus(undefined), null);
  assert.equal(profileNextStepHref("about"), "/mypage?focus=about");
});

test("/people の箱の職歴の文言はホームの定数と同じ", () => {
  assert.equal(PROFILE_NEXT_STEP_SIDEBAR_LABEL.career, CAREER_NEXT_STEP_LABEL);
});
