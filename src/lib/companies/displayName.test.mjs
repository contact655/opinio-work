import { test } from "node:test";
import assert from "node:assert/strict";
import { brandOrName, companyDisplayName } from "./displayName.ts";

test("brandOrName: brand_name があればそれ、無ければ name", () => {
  assert.equal(brandOrName("Salesforce", "株式会社セールスフォース・ジャパン"), "Salesforce");
  assert.equal(brandOrName(null, "株式会社Opinio"), "株式会社Opinio");
  assert.equal(brandOrName(undefined, "株式会社Opinio"), "株式会社Opinio");
});

test("brandOrName: 空・空白だけの brand_name は name に戻す（社名が消えないように）", () => {
  assert.equal(brandOrName("", "株式会社Opinio"), "株式会社Opinio");
  assert.equal(brandOrName("   ", "株式会社Opinio"), "株式会社Opinio");
  assert.equal(brandOrName("　", "株式会社Opinio"), "株式会社Opinio");
});

test("brandOrName: 中身のある brand_name は変えない", () => {
  assert.equal(brandOrName("COIN（旧：コインタックス株式会社）", "株式会社COIN（旧：コインタックス株式会社）"), "COIN（旧：コインタックス株式会社）");
});

test("companyDisplayName: 空・空白だけの英語名は日本語名に戻す", () => {
  assert.equal(companyDisplayName("株式会社Opinio", "").displayName, "Opinio");
  assert.equal(companyDisplayName("株式会社Opinio", "   ").displayName, "Opinio");
  assert.equal(companyDisplayName("株式会社", null).displayName, "株式会社");
});
