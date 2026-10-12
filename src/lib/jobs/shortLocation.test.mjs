import { test } from "node:test";
import assert from "node:assert/strict";
import { shortLocation } from "./shortLocation.ts";

test("番地・建物名を落として都道府県＋市区町村まで", () => {
  assert.equal(shortLocation("東京都港区虎ノ門1-2-3 ○○ビル5F"), "東京都港区");
  assert.equal(shortLocation("大阪府大阪市北区梅田2-4-9"), "大阪府大阪市北区");
  assert.equal(shortLocation("神奈川県横浜市西区みなとみらい"), "神奈川県横浜市西区");
  assert.equal(shortLocation("北海道札幌市中央区北1条"), "北海道札幌市中央区");
  assert.equal(shortLocation("京都府京都市下京区"), "京都府京都市下京区");
  assert.equal(shortLocation("東京都"), "東京都");
});

test("読めないものは数字の手前まで／空は null", () => {
  assert.equal(shortLocation("フルリモート"), "フルリモート");
  assert.equal(shortLocation(""), null);
  assert.equal(shortLocation(null), null);
});
