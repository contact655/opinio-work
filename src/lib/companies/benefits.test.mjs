import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBenefits, serializeBenefits, hasInvalidBenefitCategory, groupBenefitsByCategory, benefitCategoryOf, workstyleBoxKeyOf, BENEFIT_CATEGORIES } from "./benefits.ts";

test("カテゴリは7つで、この順番", () => {
  assert.deepEqual(BENEFIT_CATEGORIES.map((c) => c.key), ["money", "time_off", "workstyle", "learning", "health", "family", "other"]);
  assert.deepEqual(BENEFIT_CATEGORIES.map((c) => c.label), ["お金・報酬", "休み", "働き方・環境", "学び・成長", "健康・保険", "家族・育児", "その他"]);
});

test("読み込みと保存でカテゴリを落とさない。7つ以外は持たせない", () => {
  const raw = [{ name: "A", category: "money" }, { name: "B", detail: "x", category: "family" }, { name: "C", category: "bogus" }, { name: "D" }];
  const n = normalizeBenefits(raw);
  assert.deepEqual(n, [{ name: "A", category: "money" }, { name: "B", detail: "x", category: "family" }, { name: "C" }, { name: "D" }]);
  assert.deepEqual(serializeBenefits(n), n);
  assert.deepEqual(serializeBenefits([{ name: "E", category: "nope" }]), [{ name: "E" }]);
});

test("カテゴリが無い項目は「その他」", () => {
  assert.equal(benefitCategoryOf({}), "other");
  assert.deepEqual(groupBenefitsByCategory([{ name: "X" }, { name: "Y", category: "money" }]).map((g) => [g.key, g.items.length]), [["money", 1], ["other", 1]]);
});

test("保存の確認：7つ以外の category があれば不正。無いのは不正にしない", () => {
  assert.equal(hasInvalidBenefitCategory([{ name: "A", category: "money" }, { name: "B" }]), false);
  assert.equal(hasInvalidBenefitCategory([{ name: "A", category: "salary" }]), true);
  assert.equal(hasInvalidBenefitCategory([{ name: "A", category: 1 }]), true);
  assert.equal(hasInvalidBenefitCategory(null), false);
});

test("働き方の枠の対応（働き方・環境の項目にだけ使う）", () => {
  assert.equal(workstyleBoxKeyOf("フレックスタイム制"), "time");
  assert.equal(workstyleBoxKeyOf("リモートワーク可"), "remote");
  assert.equal(workstyleBoxKeyOf("副業可"), null);
});
