import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interestCountBand, trendItems, isPendingStillValid, isNoReplyDue, interestConfirmText,
  INTEREST_NOTE_MAX, INTEREST_PENDING_VALID_DAYS, INTEREST_NO_REPLY_DAYS,
} from "./constants.ts";

const DAY = 24 * 3600_000;

test("人数の幅は 1〜4 ／ 5〜9 ／ 10以上。0 は出さない（実数は企業に伝えない）", () => {
  assert.equal(interestCountBand(0), null);
  assert.equal(interestCountBand(1), "1〜4人");
  assert.equal(interestCountBand(4), "1〜4人");
  assert.equal(interestCountBand(5), "5〜9人");
  assert.equal(interestCountBand(9), "5〜9人");
  assert.equal(interestCountBand(10), "10人以上");
});

test("傾向は3人以上の項目だけ。多い順", () => {
  assert.deepEqual(trendItems({ "IT・インターネット": 5, "金融": 2, "メーカー": 3 }), [
    { label: "IT・インターネット", count: 5 }, { label: "メーカー", count: 3 },
  ]);
  assert.deepEqual(trendItems({ "金融": 2 }), []);
});

test("担当者の登録待ちは 90日以内なら届け、過ぎたら届けない", () => {
  const now = Date.parse("2026-10-27T00:00:00Z");
  assert.equal(INTEREST_PENDING_VALID_DAYS, 90);
  assert.ok(isPendingStillValid(new Date(now - 89 * DAY).toISOString(), now));
  assert.ok(isPendingStillValid(new Date(now - 90 * DAY).toISOString(), now));
  assert.equal(isPendingStillValid(new Date(now - 91 * DAY).toISOString(), now), false);
  assert.equal(isPendingStillValid("壊れた値", now), false);
});

test("届けてから 14日で返事なし", () => {
  const now = Date.parse("2026-10-27T00:00:00Z");
  assert.equal(INTEREST_NO_REPLY_DAYS, 14);
  assert.equal(isNoReplyDue(new Date(now - 13 * DAY).toISOString(), now), false);
  assert.ok(isNoReplyDue(new Date(now - 14 * DAY).toISOString(), now));
});

test("確認の文言は担当者の有無で変わり、どちらも名前とプロフィールが届くことを書く", () => {
  const a = interestConfirmText("A社", true).body.join("");
  const b = interestConfirmText("A社", false).body.join("");
  assert.ok(a.includes("名前とプロフィールが届きます"));
  assert.ok(b.includes("担当者がOPINIOに登録したら"));
  assert.ok(b.includes("それまでは届きません"));
  assert.equal(INTEREST_NOTE_MAX, 200);
});
