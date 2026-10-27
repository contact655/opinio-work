/**
 * 候補者を探すの並べ方（candidateGroups.ts）。npm test
 * ⚠️ 経歴の少ない人の判定・人の流れの下限（5人）・意向が強い順。条件を変えたらここも直す。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isThinProfile, splitThinProfiles, flowLine, compareByStance, compareByUpdated, lastUpdatedAt } from "./candidateGroups.ts";

const base = { experienceCount: 2, currentRole: "営業", roleName: "法人営業", currentCompany: "A社" };

test("経歴の少ない人: 職歴0件は少ない", () => {
  assert.equal(isThinProfile({ ...base, experienceCount: 0 }), true);
});
test("経歴の少ない人: 現職の職種と会社がどちらも無いと少ない", () => {
  assert.equal(isThinProfile({ ...base, currentRole: null, roleName: null, currentCompany: null }), true);
  assert.equal(isThinProfile({ ...base, currentRole: "  ", roleName: "", currentCompany: null }), true);
});
test("経歴の少ない人: 職種だけ・会社名だけが空なら少なくない", () => {
  assert.equal(isThinProfile({ ...base, currentCompany: null }), false);
  assert.equal(isThinProfile({ ...base, currentRole: null, roleName: null }), false);
  assert.equal(isThinProfile(base), false);
});
test("経歴の少ない人: 並んだ順を保って分ける", () => {
  const list = [{ ...base, id: 1 }, { ...base, id: 2, experienceCount: 0 }, { ...base, id: 3 }, { ...base, id: 4, currentRole: null, roleName: null, currentCompany: null }];
  const { main, thin } = splitThinProfiles(list);
  assert.deepEqual(main.map((c) => c.id), [1, 3]);
  assert.deepEqual(thin.map((c) => c.id), [2, 4]);
});

test("人の流れ: 5人以上で出す・4人では出さない", () => {
  assert.equal(flowLine("株式会社A", 5, 5), "株式会社Aから御社に入社した人 5人");
  assert.equal(flowLine("株式会社A", 12, 5), "株式会社Aから御社に入社した人 12人");
  assert.equal(flowLine("株式会社A", 4, 5), null);
  assert.equal(flowLine("株式会社A", 0, 5), null);
});
test("人の流れ: 会社名が無ければ出さない", () => {
  assert.equal(flowLine(null, 9, 5), null);
});

const c = (stance, created, edited = null, stanceAt = null) => ({ careerStance: stance, createdAt: created, profileEditedAt: edited, careerStanceUpdatedAt: stanceAt });
test("意向が強い順: 積極的 → いい話なら → 情報収集中 → 未設定", () => {
  const list = [c("researching", "2026-01-01"), c(null, "2026-01-02"), c("active", "2026-01-01"), c("open", "2026-01-03")];
  assert.deepEqual([...list].sort(compareByStance).map((x) => x.careerStance), ["active", "open", "researching", null]);
});
test("意向が強い順: 同じ強さなら最近更新した人が先", () => {
  const list = [c("open", "2026-01-01", "2026-02-01"), c("open", "2026-01-01", "2026-03-01")];
  assert.deepEqual([...list].sort(compareByStance).map((x) => x.profileEditedAt), ["2026-03-01", "2026-02-01"]);
});
test("最近更新した順: 編集日・意向の更新日・登録日のうち一番新しい日で並ぶ", () => {
  const a = c("active", "2026-01-01", null, "2026-05-01");
  const b = c("active", "2026-04-01");
  assert.equal(lastUpdatedAt(a), "2026-05-01");
  assert.deepEqual([b, a].sort(compareByUpdated), [a, b]);
});
