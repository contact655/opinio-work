/**
 * おすすめのユーザーの選び方のテスト。 node --test src/lib/people/suggest.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { pickUserSuggestions, sameRole, roleTop, isSuggestDismissActive, USER_SUGGEST_LIMIT, USER_SUGGEST_DISMISS_DAYS } from "./suggest.ts";

/* 職種: sales(大分類) ─ is(インサイドセールス)・fs(フィールドセールス) ／ eng(大分類) */
const roleParent = { sales: null, is: "sales", fs: "sales", eng: null };
const person = (id, over = {}) => ({
  id, isTest: false, roleId: null, currentCompanies: [], pastSteps: [], atExcludedCompany: false, updatedAt: "2026-11-01", ...over,
});
const base = (people, over = {}) => ({
  viewerId: "me", viewerIsTest: false,
  myRole: { roleId: "is", label: "インサイドセールス" },
  myStart: { roleTopId: "sales", industryTopId: "it", label: "営業×IT・ソフトウェア" },
  roleParent, followedUserIds: [], followedCompanyIds: [], savedJobCompanyIds: [], dismissedUserIds: [],
  people, ...over,
});

test("同じ職種は、同じもの・親と子は同じ、兄弟は別", () => {
  assert.equal(sameRole("is", "is", roleParent), true);
  assert.equal(sameRole("is", "sales", roleParent), true);
  assert.equal(sameRole("sales", "fs", roleParent), true);
  assert.equal(sameRole("is", "fs", roleParent), false);
  assert.equal(sameRole(null, "is", roleParent), false);
  assert.equal(roleTop("is", roleParent), "sales");
});

test("基準の優先: 同じ職種・同じ経歴 → フォロー中・保存した募集の会社", () => {
  const r = pickUserSuggestions(base([
    person("co", { currentCompanies: [{ companyId: "c1", nameIfShown: "サンプル社" }], updatedAt: "2026-11-03" }),
    person("role", { roleId: "sales" }),
    person("path", { pastSteps: [{ roleId: "fs", industryTopId: "it" }] }),
  ], { followedCompanyIds: ["c1"], limit: 4 }));
  assert.equal(r.length, 3);
  assert.deepEqual(r.slice(2).map((x) => x.userId), ["co"]);
  assert.deepEqual(new Set(r.slice(0, 2).map((x) => x.userId)), new Set(["role", "path"]));
  assert.equal(r.find((x) => x.userId === "role").reason, "同じ職種・インサイドセールス");
  assert.equal(r.find((x) => x.userId === "path").reason, "同じ経歴から転職・営業×IT・ソフトウェア");
  assert.equal(r.find((x) => x.userId === "co").reason, "フォロー中の会社・サンプル社");
});

test("3人まで。同じ基準の中は更新が新しい順", () => {
  const r = pickUserSuggestions(base([
    person("a", { roleId: "sales", updatedAt: "2026-10-01" }),
    person("b", { roleId: "sales", updatedAt: "2026-11-02" }),
    person("c", { roleId: "sales", updatedAt: "2026-10-15" }),
    person("d", { roleId: "sales", updatedAt: "2026-09-01" }),
  ]));
  assert.equal(USER_SUGGEST_LIMIT, 3);
  assert.deepEqual(r.map((x) => x.userId), ["b", "c", "a"]);
});

test("除くもの: 自分・フォロー中・×で外した人・テストかどうかが違う人・除外する会社に在籍中・理由の無い人", () => {
  const r = pickUserSuggestions(base([
    person("me", { roleId: "sales" }),
    person("followed", { roleId: "sales" }),
    person("dismissed", { roleId: "sales" }),
    person("test", { roleId: "sales", isTest: true }),
    person("agent", { roleId: "sales", atExcludedCompany: true }),
    person("noreason"),
    person("ok", { roleId: "sales" }),
  ], { followedUserIds: ["followed"], dismissedUserIds: ["dismissed"] }));
  assert.deepEqual(r.map((x) => x.userId), ["ok"]);
});

test("自分がテストユーザーなら、テストユーザーだけを出す", () => {
  const r = pickUserSuggestions(base([person("real", { roleId: "sales" }), person("t", { roleId: "sales", isTest: true })], { viewerIsTest: true }));
  assert.deepEqual(r.map((x) => x.userId), ["t"]);
});

test("社名を伏せた職歴（nameIfShown が null）は、会社の基準にも理由の文にも使わない", () => {
  const r = pickUserSuggestions(base([person("masked", { currentCompanies: [{ companyId: "c1", nameIfShown: null }] })], { followedCompanyIds: ["c1"], savedJobCompanyIds: ["c1"] }));
  assert.deepEqual(r, []);
});

test("保存した募集の会社", () => {
  const r = pickUserSuggestions(base([person("s", { currentCompanies: [{ companyId: "c2", nameIfShown: "保存社" }] })], { savedJobCompanyIds: ["c2"] }));
  assert.equal(r[0].reason, "保存した募集の会社・保存社");
});

test("同じ経歴は、職種の大分類と業界の大分類の両方が合うときだけ", () => {
  const r = pickUserSuggestions(base([
    person("other-industry", { pastSteps: [{ roleId: "is", industryTopId: "finance" }] }),
    person("other-role", { pastSteps: [{ roleId: "eng", industryTopId: "it" }] }),
  ], { myRole: null }));
  assert.deepEqual(r, []);
});

test("×で外した期間は30日", () => {
  const now = new Date("2026-11-30T00:00:00Z");
  assert.equal(USER_SUGGEST_DISMISS_DAYS, 30);
  assert.equal(isSuggestDismissActive("2026-11-01T00:00:01Z", now), true);
  assert.equal(isSuggestDismissActive("2026-10-31T00:00:00Z", now), false);
  assert.equal(isSuggestDismissActive("こわれた値", now), false);
});
