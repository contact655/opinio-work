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

import { careerNudgeTitle, careerCompanyCount, CAREER_NUDGE_PAST_HREF, CAREER_NUDGE_EDU_HREF } from "./homeState.ts";

test("前の会社・学校の案内: 見出しは足りないものに合わせ、どちらも無ければ出さない", () => {
  assert.equal(careerNudgeTitle({ pastJob: true, education: true }), "職歴と学歴を足しませんか");
  assert.equal(careerNudgeTitle({ pastJob: true, education: false }), "職歴を足しませんか");
  assert.equal(careerNudgeTitle({ pastJob: false, education: true }), "学歴を足しませんか");
  assert.equal(careerNudgeTitle({ pastJob: false, education: false }), null);
  assert.equal(careerNudgeTitle(null), null);
  assert.equal(CAREER_NUDGE_PAST_HREF, "/mypage?add=past");
  assert.equal(CAREER_NUDGE_EDU_HREF, "/mypage?add=education");
});

test("会社の数: 同じ会社の役割（異動・昇進）は1社と数え、社名だけの職歴も数える", () => {
  assert.equal(careerCompanyCount([]), 0);
  assert.equal(careerCompanyCount([{ company_id: "a", company_text: null }, { company_id: "a", company_text: null }]), 1);
  assert.equal(careerCompanyCount([{ company_id: "a", company_text: null }, { company_id: null, company_text: " 株式会社B " }]), 2);
  assert.equal(careerCompanyCount([{ company_id: null, company_text: "B" }, { company_id: null, company_text: "B" }]), 1);
  assert.equal(careerCompanyCount([{ company_id: null, company_text: null, company_anonymized: "SaaS企業" }]), 1);
});
