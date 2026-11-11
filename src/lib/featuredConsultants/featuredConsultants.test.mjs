/**
 * 相談できる人の判定・入力の確かめのテスト。 node --test src/lib/featuredConsultants/featuredConsultants.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROUTE_CONSENT_METHODS, ROUTE_TALK_TAGS, consultantBlockers, parseConsultantInput } from "../constants/careerRoutes.ts";

const ok = {
  visibility: "login_only", authId: "a", isTest: false, isSystem: false,
  isListed: true, approvedAt: "2026-11-12T00:00:00Z", consentConfirmedAt: "2026-11-11T01:00:00Z", consentMethod: "meeting",
};

test("承認・同意・登録済み・検証用でないなら出せる（ログインユーザーのみでよい）", () => {
  assert.deepEqual(consultantBlockers(ok), []);
  assert.deepEqual(consultantBlockers({ ...ok, visibility: "public" }), []);
});

test("どれか1つ欠けたら出さない", () => {
  for (const [k, v] of [
    ["visibility", "private"], ["isListed", false], ["approvedAt", null], ["consentConfirmedAt", null],
    ["consentMethod", null], ["consentMethod", "phone"], ["authId", null], ["isTest", true], ["isSystem", true],
  ]) {
    assert.ok(consultantBlockers({ ...ok, [k]: v }).length > 0, k);
  }
});

test("値が取れない（undefined）は出さない側に倒す", () => {
  for (const k of Object.keys(ok)) assert.ok(consultantBlockers({ ...ok, [k]: undefined }).length > 0, k);
});

test("入力: 同意は日時と方法の両方・掲載中は消せない・未来は弾く", () => {
  const now = new Date("2026-11-12T06:00:00Z");
  assert.equal(parseConsultantInput({ consentMethod: "email" }, { now }).ok, false);
  assert.equal(parseConsultantInput({ consentConfirmedAt: "2026-11-11T10:00" }, { now }).ok, false);
  assert.equal(parseConsultantInput({}, { isListed: true, now }).ok, false);
  assert.equal(parseConsultantInput({ consentConfirmedAt: "2026-11-13T10:00", consentMethod: "email" }, { now }).ok, false);
  assert.equal(parseConsultantInput({ talkTags: ["xxx"] }, { now }).ok, false);
  assert.equal(parseConsultantInput({ message: "あ".repeat(201) }, { now }).ok, false);
  assert.equal(parseConsultantInput({ displayOrder: "1.5" }, { now }).ok, false);
  assert.deepEqual(parseConsultantInput({}, { now }), { ok: true, value: { talkTags: [], message: null, displayOrder: 0, consentConfirmedAt: null, consentMethod: null } });
  assert.deepEqual(
    parseConsultantInput({ talkTags: ["resume", "interview"], message: " よろしく ", displayOrder: "2", consentConfirmedAt: "2026-11-11T10:00", consentMethod: "line" }, { now }),
    { ok: true, value: { talkTags: ["interview", "resume"], message: "よろしく", displayOrder: 2, consentConfirmedAt: "2026-11-11T01:00:00.000Z", consentMethod: "line" } },
  );
});

test("選択肢が migration の CHECK と同じ（話せること・同意を確認した方法）", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261112090000_featured_consultants.sql", import.meta.url), "utf8");
  const tags = sql.match(/talk_tags <@ array\[([\s\S]*?)\]::text\[\]/);
  assert.ok(tags, "talk_tags の CHECK が見つからない");
  assert.deepEqual(Array.from(tags[1].matchAll(/'([a-z_]+)'/g)).map((x) => x[1]), ROUTE_TALK_TAGS.map((t) => t.value));
  const methods = sql.match(/consent_method in \(([^)]*)\)/);
  assert.ok(methods, "consent_method の CHECK が見つからない");
  assert.deepEqual(Array.from(methods[1].matchAll(/'([a-z_]+)'/g)).map((x) => x[1]), ROUTE_CONSENT_METHODS.map((t) => t.value));
});
