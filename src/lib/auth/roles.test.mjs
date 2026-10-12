import { test } from "node:test";
import assert from "node:assert/strict";
import { can, toCompanyRole, PERMISSIONS, DB_LEVEL_ROLES, COMPANY_ROLES, PROVISIONAL_ADMIN_ONLY } from "./roles.ts";

test("旧値 member は採用担当として読む。知らない値は null（何もできない）", () => {
  assert.equal(toCompanyRole("member"), "recruiter");
  assert.equal(toCompanyRole("admin"), "admin");
  assert.equal(toCompanyRole("owner"), null);
  assert.equal(can(null, "dashboard.view"), false);
});

test("柴さんの表どおり", () => {
  // 管理者だけ
  for (const a of ["members.manage", "company.basic", "integrations.manage", "plan.view"]) {
    assert.deepEqual(COMPANY_ROLES.filter((r) => can(r, a)), ["admin"], a);
  }
  // 採用担当
  for (const a of ["candidates.search", "messages.use", "proposals.use", "selection.edit", "candidates.notes", "meetings.manage",
                   "jobs.edit", "company.page", "stories.edit", "employees.manage", "materials.edit", "analytics.view"]) {
    assert.ok(can("recruiter", a), a);
  }
  // 面接官: 候補者を探す・メッセージ・求人や企業ページは触れない
  for (const a of ["candidates.search", "candidates.viewProfile", "messages.use", "jobs.edit", "jobs.view", "company.page", "selection.view"]) {
    assert.equal(can("interviewer", a), false, a);
  }
  assert.ok(can("interviewer", "selection.viewAssigned"));
  assert.ok(can("interviewer", "candidate.noteAssigned"));
  // 閲覧のみ: 見るだけ。書き込みとメッセージは一切できない
  for (const a of ["selection.view", "candidates.viewProfile", "jobs.view", "analytics.view"]) assert.ok(can("viewer", a), a);
  for (const [a, roles] of Object.entries(PERMISSIONS)) {
    if (/\.(edit|use|manage|notes|search|assignInterviewers|page|basic|listingRequest|manageAll|noteAssigned)$/.test(a)) {
      assert.equal(roles.includes("viewer"), false, `閲覧のみが書き込める: ${a}`);
    }
  }
});

test("ひとまず管理者だけにした操作は、本当に管理者だけ", () => {
  for (const a of PROVISIONAL_ADMIN_ONLY) assert.deepEqual(PERMISSIONS[a], ["admin"], a);
});

test("DB の段（auth_company_can）は、アプリの操作と同じ役割の集合", () => {
  const same = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());
  same(DB_LEVEL_ROLES.view, PERMISSIONS["selection.view"]);
  same(DB_LEVEL_ROLES.work, PERMISSIONS["selection.edit"]);
  same(DB_LEVEL_ROLES.work, PERMISSIONS["jobs.edit"]);
  same(DB_LEVEL_ROLES.admin, PERMISSIONS["members.manage"]);
  same(DB_LEVEL_ROLES.member, COMPANY_ROLES);
});
