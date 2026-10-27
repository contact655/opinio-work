import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interestCountBand, trendItems, isNoReplyDue, interestConfirmText, interestStatusText,
  INTEREST_NOTE_MAX, INTEREST_NO_REPLY_DAYS, INTEREST_STATUSES, INTEREST_NOTICE_TEXT,
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

test("担当者の登録待ち・期限切れの状態は無い（後から届ける形はやめた）", () => {
  assert.deepEqual([...INTEREST_STATUSES], ["delivered", "replied", "no_reply"]);
});

test("届けてから 14日で返事なし", () => {
  const now = Date.parse("2026-10-27T00:00:00Z");
  assert.equal(INTEREST_NO_REPLY_DAYS, 14);
  assert.equal(isNoReplyDue(new Date(now - 13 * DAY).toISOString(), now), false);
  assert.ok(isNoReplyDue(new Date(now - 14 * DAY).toISOString(), now));
});

test("確認の文言は名前とプロフィールが届くことを書く", () => {
  const a = interestConfirmText("A社").body.join("");
  assert.ok(a.includes("A社に、あなたの名前とプロフィールが届きます"));
  assert.ok(a.includes("企業からメッセージが届くことがあります"));
  assert.equal(INTEREST_NOTE_MAX, 200);
});

test("保存した会社の知らせは、名前が届くとも、会社がいなかったとも書かない", () => {
  const s = INTEREST_NOTICE_TEXT.savedReady("A社");
  assert.equal(s, "保存したA社に、「話を聞いてみたい」を送れるようになりました。");
  for (const ng of ["参加", "担当者", "登録", "プロフィールが届"]) assert.ok(!s.includes(ng), ng);
  assert.equal(interestStatusText("delivered", "A社"), "A社に届けました。");
});
