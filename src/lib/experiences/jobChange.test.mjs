/**
 * 「転職しましたか？／会社名の修正ですか？」のテスト。 node --test src/lib/experiences/jobChange.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { shouldAskJobChange, nextMonthOf, currentYm, jobChangeEndError, COMPANY_CORRECTION } from "./jobChange.ts";

test("聞くのは、現職のまま会社が変わったときだけ", () => {
  assert.equal(shouldAskJobChange({ savedIsCurrent: true, draftIsCurrent: true, companyChanged: true }), true);
  assert.equal(shouldAskJobChange({ savedIsCurrent: true, draftIsCurrent: true, companyChanged: false }), false, "同じ会社");
  assert.equal(shouldAskJobChange({ savedIsCurrent: false, draftIsCurrent: false, companyChanged: true }), false, "過去の職歴");
  assert.equal(shouldAskJobChange({ savedIsCurrent: false, draftIsCurrent: true, companyChanged: true }), false, "過去の職歴を現職にしただけ");
  assert.equal(shouldAskJobChange({ savedIsCurrent: true, draftIsCurrent: false, companyChanged: true }), false, "現職を外した");
});

test("翌月（12月は翌年の1月）", () => {
  assert.equal(nextMonthOf("2026-03"), "2026-04");
  assert.equal(nextMonthOf("2026-12"), "2027-01");
  assert.equal(nextMonthOf(""), "");
  assert.equal(nextMonthOf(null), "");
});

test("今月は日本時間で数える", () => {
  assert.equal(currentYm(new Date("2026-10-31T15:30:00Z")), "2026-11");
  assert.equal(currentYm(new Date("2026-10-31T14:30:00Z")), "2026-10");
});

test("辞めた月: 入社月より前と、今月より後は受けない", () => {
  assert.equal(jobChangeEndError("2026-10", "2024-04-01", "2026-11"), null);
  assert.equal(jobChangeEndError("2024-04", "2024-04-01", "2026-11"), null, "入社した月に辞めた");
  assert.equal(jobChangeEndError("2026-11", "2024-04-01", "2026-11"), null, "今月");
  assert.match(jobChangeEndError("2024-03", "2024-04-01", "2026-11") ?? "", /入社した月より前/);
  assert.match(jobChangeEndError("2026-12", "2024-04-01", "2026-11") ?? "", /今月より後/);
  assert.match(jobChangeEndError("", "2024-04-01", "2026-11") ?? "", /選んでください/);
});

/* ⚠️ コメントを落としてから見る（注意書きの文言に当たらないように） */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const read = (rel) => strip(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

test("職歴の更新: 「修正です」なら決め手を消さない。印が無いときは現職だけ消す", () => {
  const src = read("../../app/api/jobseeker/experiences/[id]/route.ts");
  assert.match(src, /body\.company_change === COMPANY_CORRECTION/);
  assert.match(src, /select\("company_id, company_text, company_anonymized, is_current"\)/);
  assert.match(src, /if \(beforeRow\.data && beforeRow\.data\.is_current && !isCorrection && !isSameCompany\(beforeRow\.data, afterCompany\)\)/);
});

test("会社名だけの変更: 同じ扱い（修正なら消さない・印が無く現職を含むときだけ消す）", () => {
  const src = read("../../app/api/jobseeker/experiences/company/route.ts");
  assert.match(src, /body\.company_change === COMPANY_CORRECTION/);
  assert.match(src, /clearJoinDecisionForExperiences\(/);
  assert.ok(src.indexOf("clearJoinDecisionForExperiences(") > src.indexOf("if (!r.ok)"), "保存に成功したあとで消す");
  assert.equal(COMPANY_CORRECTION, "correction");
});
