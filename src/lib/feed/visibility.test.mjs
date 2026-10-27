import { test } from "node:test";
import assert from "node:assert/strict";
import { isPostVisibleTo, postRefersToTest } from "./visibility.ts";

/* ★検証用の会社・求人を指す投稿は、検証用の人にだけ見せる（2026-10-27 / 柴さんの指示）。
   閲覧者3通り（検証用・実在・ログアウト）× 投稿2通り（検証用を指す・実在を指す）を、システム投稿と人の投稿の両方で確かめる。
   ⚠️ ログアウトは「実在の人」と同じ扱い（viewerIsTest = false） */

const SYSTEM = { visibility: "private", is_system: true, is_test: false };
const PERSON = { visibility: "login_only", is_system: false, is_test: false };

const viewers = [
  { name: "検証用の人", loggedIn: true, isTest: true },
  { name: "実在の人", loggedIn: true, isTest: false },
  { name: "ログアウト", loggedIn: false, isTest: false },
];

const testRefPosts = [
  { name: "参加しました（検証用の会社）", refs: { ref_company: { is_test: true } } },
  { name: "求人を公開しました（検証用の求人）", refs: { ref_job: { is_test: true, company: { is_test: false } } } },
  { name: "求人を公開しました（検証用の会社の求人）", refs: { ref_job: { is_test: false, company: { is_test: true } } } },
  { name: "記事を公開しました（検証用の会社の記事）", refs: { ref_article: { company: { is_test: true } } } },
];
const realRefPosts = [
  { name: "参加しました（実在の会社）", refs: { ref_company: { is_test: false } } },
  { name: "求人を公開しました（実在の求人）", refs: { ref_job: { is_test: false, company: { is_test: false } } } },
  { name: "記事を公開しました（会社の無い記事）", refs: { ref_article: { company: null } } },
];

test("postRefersToTest: 指す先のどれかが検証用なら true（種類で分けない）", () => {
  for (const p of testRefPosts) assert.equal(postRefersToTest(p.refs), true, p.name);
  for (const p of realRefPosts) assert.equal(postRefersToTest(p.refs), false, p.name);
  assert.equal(postRefersToTest({}), false, "指す先なし（人の投稿）");
});

test("システム投稿: 検証用を指すものは検証用の人だけ。実在を指すものは全員", () => {
  for (const v of viewers) {
    for (const p of testRefPosts) {
      const got = isPostVisibleTo({ postVisibility: "login_only", author: SYSTEM, refersToTest: postRefersToTest(p.refs) }, v.loggedIn, v.isTest);
      assert.equal(got, v.isTest, `${v.name} × ${p.name}`);
    }
    for (const p of realRefPosts) {
      const got = isPostVisibleTo({ postVisibility: "login_only", author: SYSTEM, refersToTest: postRefersToTest(p.refs) }, v.loggedIn, v.isTest);
      assert.equal(got, true, `${v.name} × ${p.name}`);
    }
  }
});

test("人の投稿（指す先なし）は従来どおり: ログインしている人に見える・ログアウトには login_only の人の投稿は見えない", () => {
  for (const v of viewers) {
    const got = isPostVisibleTo({ postVisibility: "login_only", author: PERSON, refersToTest: false }, v.loggedIn, v.isTest);
    assert.equal(got, v.loggedIn, v.name);
  }
});

test("検証用を指す判定は、システム投稿の素通しより先に効く", () => {
  assert.equal(isPostVisibleTo({ postVisibility: "public", author: SYSTEM, refersToTest: true }, true, false), false);
  assert.equal(isPostVisibleTo({ postVisibility: "public", author: SYSTEM, refersToTest: true }, false, false), false);
});
