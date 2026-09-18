/**
 * 隣接ペア（移った）の組み立てのテスト。
 *
 *     npm test
 *
 * ⚠️★**この関数が割れると、②⑨と /admin/evidence-gaps の数字が食い違う**
 *    （2026-09-18 に実際に食い違っていた: セールスフォースへの経路が 2 と 1）。
 *    実データは移動が数件しかないので、境界はここでしか踏めない。
 *
 * ⚠️ `.mjs` なのは engine.test.mjs と同じ理由（tsconfig を触らずに素の Node で動かす）。
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildMoves, companyKey, countMovesInto } from "./transitions.ts";

const e = (o) => ({
  id: o.id ?? Math.random().toString(36).slice(2),
  user_id: o.u ?? "u1",
  company_id: o.cid ?? null,
  company_text: o.ctext ?? null,
  role_category_id: o.role ?? null,
  started_at: o.from,
  ended_at: o.to ?? null,
  is_current: o.current ?? false,
});

// ── companyKey ──────────────────────────────────────────────────────────────

test("companyKey … マスタ紐づけは company_id", () => {
  assert.equal(companyKey(e({ id: "x", cid: "C1", from: "2020-01-01" })), "C1");
});

test("companyKey … 自由入力は正規化した社名（前後の空白と大小を無視）", () => {
  const a = companyKey(e({ id: "x", ctext: "  Acme Inc. ", from: "2020-01-01" }));
  const b = companyKey(e({ id: "y", ctext: "acme inc.", from: "2021-01-01" }));
  assert.equal(a, b, "同じ会社として扱う");
});

test("★companyKey … 社名が無ければ行ごとに別会社（まとめない）", () => {
  const a = companyKey(e({ id: "x", from: "2020-01-01" }));
  const b = companyKey(e({ id: "y", from: "2021-01-01" }));
  assert.notEqual(a, b, "固定文字列にすると移動が消える");
});

// ── buildMoves ──────────────────────────────────────────────────────────────

test("職歴1件では移動にならない", () => {
  assert.equal(buildMoves([e({ cid: "A", from: "2020-01-01" })]).length, 0);
});

test("A → B で1件", () => {
  const m = buildMoves([
    e({ cid: "A", from: "2018-04-01", to: "2020-03-31" }),
    e({ cid: "B", from: "2020-04-01", current: true }),
  ]);
  assert.equal(m.length, 1);
  assert.equal(m[0].fromCompanyId, "A");
  assert.equal(m[0].toCompanyId, "B");
  assert.equal(m[0].toIsCurrent, true);
});

test("★同じ会社での役割変更は移動にしない", () => {
  const m = buildMoves([
    e({ cid: "A", role: "r1", from: "2018-04-01", to: "2020-03-31" }),
    e({ cid: "A", role: "r2", from: "2020-04-01", current: true }),
  ]);
  assert.equal(m.length, 0);
});

test("★自由入力でも同じ社名なら移動にしない（表記ゆれを吸収）", () => {
  const m = buildMoves([
    e({ ctext: "Acme", from: "2018-04-01", to: "2020-03-31" }),
    e({ ctext: " acme ", from: "2020-04-01" }),
  ]);
  assert.equal(m.length, 0);
});

test("入力順に関係なく started_at で並べ替える", () => {
  const rows = [
    e({ cid: "C", from: "2022-01-01", current: true }),
    e({ cid: "A", from: "2018-01-01", to: "2019-12-31" }),
    e({ cid: "B", from: "2020-01-01", to: "2021-12-31" }),
  ];
  const m = buildMoves(rows);
  assert.deepEqual(m.map((x) => [x.fromCompanyId, x.toCompanyId]), [["A", "B"], ["B", "C"]]);
});

test("同じ started_at なら ended_at が早いほうを先に（NULL は最後）", () => {
  const m = buildMoves([
    e({ cid: "A", from: "2020-01-01", current: true }),        // ended_at なし → 後
    e({ cid: "B", from: "2020-01-01", to: "2020-06-30" }),     // → 先
  ]);
  assert.equal(m.length, 1);
  assert.equal(m[0].fromCompanyId, "B");
  assert.equal(m[0].toCompanyId, "A");
});

test("★別のユーザーの職歴どうしを繋がない", () => {
  const m = buildMoves([
    e({ u: "u1", cid: "A", from: "2018-01-01", to: "2019-12-31" }),
    e({ u: "u2", cid: "B", from: "2020-01-01", current: true }),
  ]);
  assert.equal(m.length, 0, "ユーザーをまたいで移動を作らない");
});

test("移る前の職種を持ち出す（移った先ではない）", () => {
  const m = buildMoves([
    e({ cid: "A", role: "sales", from: "2018-01-01", to: "2019-12-31" }),
    e({ cid: "B", role: "cs", from: "2020-01-01", current: true }),
  ]);
  assert.equal(m[0].fromRoleCategoryId, "sales");
});

// ── countMovesInto ──────────────────────────────────────────────────────────

const moves = [
  { userId: "u1", fromCompanyId: "A", fromCompanyText: null, fromRoleCategoryId: "sales", toCompanyId: "S", toIsCurrent: true },
  { userId: "u2", fromCompanyId: "A", fromCompanyText: null, fromRoleCategoryId: "sales", toCompanyId: "S", toIsCurrent: false },
  { userId: "u3", fromCompanyId: "B", fromCompanyText: null, fromRoleCategoryId: "cs",    toCompanyId: "S", toIsCurrent: false },
  { userId: "u4", fromCompanyId: "A", fromCompanyText: null, fromRoleCategoryId: "sales", toCompanyId: "X", toIsCurrent: true },
];

test("countMovesInto … 在籍中と出身者を分ける", () => {
  const r = countMovesInto(moves, "S");
  assert.deepEqual(r, { current: 1, alumni: 2, total: 3 });
});

test("countMovesInto … 別の会社は数えない", () => {
  assert.equal(countMovesInto(moves, "X").total, 1);
});

test("countMovesInto … 職種で絞れる（移る前の職種で見る）", () => {
  const r = countMovesInto(moves, "S", { onlyRoleIds: new Set(["sales"]) });
  assert.deepEqual(r, { current: 1, alumni: 1, total: 2 });
});

test("★countMovesInto … 職種が無い移動は、職種で絞ったとき数えない", () => {
  const m = [{ userId: "u9", fromCompanyId: "A", fromCompanyText: null, fromRoleCategoryId: null, toCompanyId: "S", toIsCurrent: true }];
  assert.equal(countMovesInto(m, "S").total, 1, "絞らなければ数える");
  assert.equal(countMovesInto(m, "S", { onlyRoleIds: new Set(["sales"]) }).total, 0);
});

test("★countMovesInto … 出戻り（同じ人が2回）は人数1で数える", () => {
  const m = [
    { userId: "u1", fromCompanyId: "A", fromCompanyText: null, fromRoleCategoryId: null, toCompanyId: "S", toIsCurrent: false },
    { userId: "u1", fromCompanyId: "B", fromCompanyText: null, fromRoleCategoryId: null, toCompanyId: "S", toIsCurrent: true },
  ];
  const r = countMovesInto(m, "S");
  assert.equal(r.total, 1, "件数(2)ではなく人数(1)");
  /* 在籍中と出身者の両方に同じ人が立つ。合計しないこと */
  assert.equal(r.current, 1);
  assert.equal(r.alumni, 1);
  assert.notEqual(r.current + r.alumni, r.total);
});
