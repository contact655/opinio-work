import { test } from "node:test";
import assert from "node:assert/strict";
import { countStarringCompanies } from "./companyStars.ts";

const co = (id, o = {}) => ({ id, is_test: false, suspended_at: null, ...o });
const admin = (company_id, o = {}) => ({ company_id, permission: "admin", is_active: true, ...o });

test("会社に1つの印を1社として数える", () => {
  assert.equal(countStarringCompanies([{ company_id: "a" }, { company_id: "b" }], [co("a"), co("b")], [admin("a"), admin("b")], false), 2);
});

test("同じ会社の印が重なっても1社", () => {
  assert.equal(countStarringCompanies([{ company_id: "a" }, { company_id: "a" }], [co("a")], [admin("a"), admin("a")], false), 1);
});

test("停止中の会社は数えない", () => {
  assert.equal(countStarringCompanies([{ company_id: "a" }], [co("a", { suspended_at: "2026-11-01" })], [admin("a")], false), 0);
});

test("検証用かどうかが食い違う会社は数えない（両方向）", () => {
  assert.equal(countStarringCompanies([{ company_id: "a" }], [co("a", { is_test: true })], [admin("a")], false), 0);
  assert.equal(countStarringCompanies([{ company_id: "a" }], [co("a")], [admin("a")], true), 0);
  assert.equal(countStarringCompanies([{ company_id: "a" }], [co("a", { is_test: true })], [admin("a")], true), 1);
});

test("☆を付けられる担当者がいない会社は数えない", () => {
  assert.equal(countStarringCompanies([{ company_id: "a" }], [co("a")], [admin("a", { is_active: false })], false), 0);
  assert.equal(countStarringCompanies([{ company_id: "a" }], [co("a")], [admin("a", { permission: "viewer" })], false), 0);
  assert.equal(countStarringCompanies([{ company_id: "a" }], [co("a")], [admin("a", { permission: "recruiter" })], false), 1);
  assert.equal(countStarringCompanies([{ company_id: "a" }], [co("a")], [admin("a", { permission: "member" })], false), 1);
});

test("会社が引けない印は数えない", () => {
  assert.equal(countStarringCompanies([{ company_id: "x" }], [], [admin("x")], false), 0);
});
