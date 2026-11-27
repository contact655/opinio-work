import { test } from "node:test";
import assert from "node:assert/strict";
import { companyBrandName, companyBrandNameParts, companyLegalName } from "./displayName.ts";

test("companyBrandName: brand_name があればそれを使う", () => {
  assert.equal(companyBrandName({ name: "伊藤忠テクノソリューションズ株式会社", name_en: "ITOCHU Techno-Solutions Corporation", brand_name: "CTC" }), "CTC");
  assert.equal(companyBrandName({ name: "株式会社COIN（旧：コインタックス株式会社）", name_en: null, brand_name: "COIN（旧：コインタックス株式会社）" }), "COIN（旧：コインタックス株式会社）");
});

test("companyBrandName: brand_name が無ければ英語社名から法人格と Japan を外す", () => {
  assert.equal(companyBrandName({ name: "Okta Japan株式会社", name_en: "Okta Japan", brand_name: null }), "Okta");
  assert.equal(companyBrandName({ name: "株式会社セールスフォース・ジャパン", name_en: "Salesforce Japan Co., Ltd." }), "Salesforce");
});

test("companyBrandName: 英語社名も無ければ日本語社名から法人格を外す", () => {
  assert.equal(companyBrandName({ name: "株式会社大林組", name_en: null, brand_name: null }), "大林組");
  assert.equal(companyBrandName({ name: "株式会社", name_en: null }), "株式会社");
});

test("companyBrandName: 空・空白だけの brand_name・name_en は値なしとして扱う", () => {
  assert.equal(companyBrandName({ name: "株式会社Opinio", name_en: "", brand_name: "" }), "Opinio");
  assert.equal(companyBrandName({ name: "株式会社Opinio", name_en: "   ", brand_name: "   " }), "Opinio");
  assert.equal(companyBrandName({ name: "株式会社Opinio", name_en: null, brand_name: "　" }), "Opinio");
});

test("companyBrandNameParts: 英字の名前かどうか", () => {
  assert.deepEqual(companyBrandNameParts({ name: "伊藤忠テクノソリューションズ株式会社", brand_name: "CTC" }), { name: "CTC", isLatin: true });
  assert.deepEqual(companyBrandNameParts({ name: "Okta Japan株式会社", name_en: "Okta Japan" }), { name: "Okta", isLatin: true });
  assert.deepEqual(companyBrandNameParts({ name: "株式会社大林組" }), { name: "大林組", isLatin: false });
});

test("companyLegalName: 正式社名をそのまま返す", () => {
  assert.equal(companyLegalName({ name: "株式会社セールスフォース・ジャパン" }), "株式会社セールスフォース・ジャパン");
});
