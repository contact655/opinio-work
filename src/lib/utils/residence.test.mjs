import { test } from "node:test";
import assert from "node:assert/strict";
import { residenceKey, parseResidence, buildResidence, PREFECTURE_REGIONS, PREFECTURES } from "./location.ts";

test("自由入力を都道府県・海外に対応づける", () => {
  assert.equal(residenceKey("東京都"), "東京都");
  assert.equal(residenceKey("東京"), "東京都");
  assert.equal(residenceKey("東京都渋谷区"), "東京都");
  assert.equal(residenceKey("京都府京都市"), "京都府");
  assert.equal(residenceKey("京都"), "京都府");
  assert.equal(residenceKey("北海道札幌市"), "北海道");
  assert.equal(residenceKey("海外"), "海外");
  assert.equal(residenceKey("海外（アメリカ）"), "海外");
  assert.equal(residenceKey("非公開"), null);
  assert.equal(residenceKey(""), null);
  assert.equal(residenceKey("どこか"), null);
});

test("入力欄の形に分けて、組み立て直せる", () => {
  assert.deepEqual(parseResidence("海外（アメリカ）"), { choice: "海外", country: "アメリカ", raw: null });
  assert.equal(buildResidence("海外", "アメリカ"), "海外（アメリカ）");
  assert.deepEqual(parseResidence("海外 シンガポール"), { choice: "海外", country: "シンガポール", raw: null });
  assert.deepEqual(parseResidence("海外"), { choice: "海外", country: "", raw: null });
  assert.equal(buildResidence("海外", " "), "海外");
  assert.equal(buildResidence("大阪府", "x"), "大阪府");
  assert.deepEqual(parseResidence("東京都渋谷区"), { choice: "東京都", country: "", raw: "東京都渋谷区" });
  assert.deepEqual(parseResidence("非公開"), { choice: "", country: "", raw: null });
  assert.deepEqual(parseResidence("どこか"), { choice: "", country: "", raw: "どこか" });
});

test("地方のまとまりは47都道府県をちょうど1回ずつ含む", () => {
  const all = PREFECTURE_REGIONS.flatMap((r) => r.prefectures);
  assert.equal(all.length, 47);
  assert.deepEqual([...all].sort(), [...PREFECTURES].sort());
});
