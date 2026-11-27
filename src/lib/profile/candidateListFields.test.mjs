import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANDIDATE_LIST_FIELDS, CANDIDATE_LIST_NUDGE_STANCES, STANCE_STALE_DAYS, buildCandidateListNudge,
} from "./candidateListFields.ts";
import { CAREER_STANCES } from "../constants/careerPreferences.ts";

const NOW = new Date("2026-11-27T00:00:00Z");
const FULL = {
  hasAvatar: true, hasCurrentExperience: true, hasCurrentRoleAndCompany: true,
  careerStance: "active", careerStanceUpdatedAt: "2026-11-20T00:00:00Z",
  location: "東京都", desiredRoleCount: 1,
};

test("積極的で写真と居住地が空なら、その2項目だけが並ぶ", () => {
  const n = buildCandidateListNudge({ ...FULL, hasAvatar: false, location: null }, NOW);
  assert.deepEqual(n?.missing.map((m) => m.key), ["photo", "location"]);
  assert.deepEqual(n?.missing.map((m) => m.label), ["写真", "居住地"]);
  assert.equal(n?.stanceStale, false);
});

test("「今は考えていない」と未設定には出さない", () => {
  assert.equal(buildCandidateListNudge({ ...FULL, hasAvatar: false, careerStance: "no_contact" }, NOW), null);
  assert.equal(buildCandidateListNudge({ ...FULL, hasAvatar: false, careerStance: null }, NOW), null);
});

test("すべて埋まっていれば出さない（意向が古くても出さない）", () => {
  assert.equal(buildCandidateListNudge(FULL, NOW), null);
  assert.equal(buildCandidateListNudge({ ...FULL, careerStanceUpdatedAt: "2025-01-01T00:00:00Z" }, NOW), null);
});

test("意向の更新日が90日より前・記録が無いときは更新の1行を足す", () => {
  const base = { ...FULL, hasAvatar: false };
  assert.equal(buildCandidateListNudge({ ...base, careerStanceUpdatedAt: "2026-08-28T00:00:00Z" }, NOW)?.stanceStale, true);
  assert.equal(buildCandidateListNudge({ ...base, careerStanceUpdatedAt: "2026-08-30T00:00:00Z" }, NOW)?.stanceStale, false);
  assert.equal(buildCandidateListNudge({ ...base, careerStanceUpdatedAt: null }, NOW)?.stanceStale, true);
});

test("職歴: 現職が無ければ追加へ、現職があって社内での呼び方が無ければ職歴の欄へ", () => {
  const noExp = buildCandidateListNudge({ ...FULL, hasCurrentExperience: false, hasCurrentRoleAndCompany: false }, NOW);
  assert.equal(noExp?.missing.find((m) => m.key === "experience")?.href, "/mypage?add=career");
  const noTitle = buildCandidateListNudge({ ...FULL, hasCurrentRoleAndCompany: false }, NOW);
  assert.equal(noTitle?.missing.find((m) => m.key === "experience")?.href, "/mypage?focus=experience");
});

test("項目は5つ・並びは 写真 → 職歴 → 意向 → 居住地 → 希望する職種", () => {
  assert.deepEqual(CANDIDATE_LIST_FIELDS.map((f) => f.label), ["写真", "職歴（職種と会社名）", "転職への意向", "居住地", "希望する職種"]);
});

test("対象の意向は CAREER_STANCES の『今は考えていない』以外と一致する", () => {
  const all = CAREER_STANCES.map((o) => o.value).filter((v) => v !== "no_contact");
  assert.deepEqual([...CANDIDATE_LIST_NUDGE_STANCES].sort(), [...all].sort());
});

test("90日は企業の絞り込み『意向を更新した時期』のいちばん長い帯と同じ", () => {
  const src = readFileSync(new URL("../business/candidates/model.ts", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("export const STANCE_FRESHNESS_BANDS"));
  const days = [...block.slice(0, block.indexOf("] as const")).matchAll(/days:\s*(\d+)/g)].map((m) => Number(m[1]));
  assert.equal(Math.max(...days), STANCE_STALE_DAYS);
});
