/**
 * 職歴の「同じ会社か」のテスト。 node --test src/lib/experiences/companyKey.test.mjs
 * ⚠️ 入社の決め手は、職歴の会社が変わったら消す（2026-11-04）。その判定がこの規則。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { companyKey, isSameCompany } from "./companyKey.ts";

const row = (o) => ({ company_id: null, company_text: null, company_anonymized: null, ...o });

test("マスタの会社は id で見る", () => {
  assert.equal(companyKey(row({ company_id: "a" })), "id:a");
  assert.ok(isSameCompany(row({ company_id: "a" }), row({ company_id: "a" })));
  assert.ok(!isSameCompany(row({ company_id: "a" }), row({ company_id: "b" })));
});

test("手入力の会社は名前で見る（前後の空白は無視する）", () => {
  assert.ok(isSameCompany(row({ company_text: "株式会社A" }), row({ company_text: " 株式会社A " })));
  assert.ok(!isSameCompany(row({ company_text: "株式会社A" }), row({ company_text: "株式会社B" })));
});

test("手入力からマスタへ、マスタから手入力へ選び直したら別の会社", () => {
  assert.ok(!isSameCompany(row({ company_text: "株式会社A" }), row({ company_id: "a" })));
  assert.ok(!isSameCompany(row({ company_id: "a" }), row({ company_text: "株式会社A" })));
});

test("匿名企業は名前で束ねる", () => {
  assert.ok(isSameCompany(row({ company_anonymized: "SaaS企業" }), row({ company_anonymized: "SaaS企業" })));
  assert.ok(!isSameCompany(row({ company_anonymized: "SaaS企業" }), row({ company_text: "SaaS企業" })));
});

test("職歴の更新は、会社が変わったときだけ決め手を消す", () => {
  const route = fileURLToPath(new URL("../../app/api/jobseeker/experiences/[id]/route.ts", import.meta.url));
  /* ⚠️ コメントを落としてから見る（注意書きの文言に当たらないように） */
  const src = readFileSync(route, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(src, /select\("company_id, company_text, company_anonymized, is_current"\)/, "更新前の会社を3列とも読む");
  /* ★2026-11-04: 「修正です」の印があれば消さない・現職のときだけ（jobChange.test.mjs でも見ている） */
  assert.match(src, /!isSameCompany\(beforeRow\.data, afterCompany\)\)\s*\{\s*const cleared = await clearJoinDecisionForExperiences\(/,
    "会社が変わったときだけ消す");
  assert.ok(src.indexOf("clearJoinDecisionForExperiences(") > src.indexOf('if (!updated) return'), "保存に成功したあとで消す");
});
