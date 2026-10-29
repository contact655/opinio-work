import { test } from "node:test";
import assert from "node:assert/strict";
import { shortAddress, annualHolidays, postedAgo } from "./heroFacts.ts";

test("住所を都道府県＋市区町村までに縮める", () => {
  assert.equal(shortAddress("大阪府大阪市北区堂島2-3-5 JPR堂島ウエスト2階"), "大阪府大阪市北区");
  assert.equal(shortAddress("東京都港区赤坂2-21-4"), "東京都港区");
  assert.equal(shortAddress("神奈川県横浜市西区みなとみらい2-2-1"), "神奈川県横浜市西区");
  assert.equal(shortAddress("千葉県船橋市本町1-1"), "千葉県船橋市");
  assert.equal(shortAddress("北海道札幌市中央区北1条"), "北海道札幌市中央区");
  assert.equal(shortAddress("東京都千代田区丸の内1-1-3 日本生命丸の内ガーデンタワー"), "東京都千代田区");
});

test("読み取れない書き方は元の文のまま・空は null", () => {
  assert.equal(shortAddress("フルリモート"), "フルリモート");
  assert.equal(shortAddress("東京・大阪"), "東京・大阪");
  assert.equal(shortAddress(""), null);
  assert.equal(shortAddress(null), null);
});

test("年間休日の日数だけを読む（部首の「⽇」も読む）", () => {
  assert.equal(annualHolidays("完全週休2日制（土日祝） 、年間休⽇：125⽇"), 125);
  assert.equal(annualHolidays("年間休日120日以上"), 120);
  assert.equal(annualHolidays("完全週休2日制（土日祝）"), null);
  assert.equal(annualHolidays(null), null);
});

test("掲載日を短く言う", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  assert.equal(postedAgo("2026-10-29T01:00:00Z", now), "今日");
  assert.equal(postedAgo("2026-10-26T12:00:00Z", now), "3日前");
  assert.equal(postedAgo("2026-07-29T12:00:00Z", now), "3か月前");
  assert.equal(postedAgo(null, now), null);
});
