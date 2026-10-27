import { test } from "node:test";
import assert from "node:assert/strict";
import { announcementsInStream, HUMAN_POST_THRESHOLD_FOR_ANNOUNCEMENTS } from "./streamMode.ts";

test("人が書いた投稿が10件未満ならお知らせを真ん中に、10件以上なら箱へ（しきい値の前後）", () => {
  assert.equal(HUMAN_POST_THRESHOLD_FOR_ANNOUNCEMENTS, 10);
  assert.equal(announcementsInStream(0), true);
  assert.equal(announcementsInStream(9), true);
  assert.equal(announcementsInStream(10), false);
  assert.equal(announcementsInStream(11), false);
});

test("しきい値は引数で変えられる", () => {
  assert.equal(announcementsInStream(4, 5), true);
  assert.equal(announcementsInStream(5, 5), false);
});
