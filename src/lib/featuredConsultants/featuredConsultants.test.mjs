/**
 * 相談可能なユーザーの判定・入力の確かめのテスト。 node --test src/lib/featuredConsultants/featuredConsultants.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONSULTANT_CONSENT_METHODS, ROUTE_CONSENT_METHODS, ROUTE_TALK_TAGS, consultantBlockers, parseConsultantSelfInput } from "../constants/careerRoutes.ts";

const ok = {
  visibility: "login_only", authId: "a", isTest: false, isSystem: false,
  isListed: true, stoppedAt: null, consentConfirmedAt: "2026-11-12T01:00:00Z", consentMethod: "self",
};

test("本人がオン・同意あり・登録済み・検証用でないなら載る（ログインユーザーのみでよい）", () => {
  assert.deepEqual(consultantBlockers(ok), []);
  assert.deepEqual(consultantBlockers({ ...ok, visibility: "public" }), []);
  assert.deepEqual(consultantBlockers({ ...ok, consentMethod: "line" }), [], "運営が確かめた同意でもよい");
});

test("どれか1つ欠けたら載せない（運営が止めている・本人がオフを含む）", () => {
  for (const [k, v] of [
    ["visibility", "private"], ["isListed", false], ["stoppedAt", "2026-11-12T02:00:00Z"], ["consentConfirmedAt", null],
    ["consentMethod", null], ["consentMethod", "phone"], ["authId", null], ["isTest", true], ["isSystem", true],
  ]) {
    assert.ok(consultantBlockers({ ...ok, [k]: v }).length > 0, k);
  }
});

test("値が取れない（undefined）は出さない側に倒す（止めているかは undefined なら止めていない）", () => {
  for (const k of Object.keys(ok)) {
    if (k === "stoppedAt") continue;
    assert.ok(consultantBlockers({ ...ok, [k]: undefined }).length > 0, k);
  }
});

test("本人の設定の入力", () => {
  assert.equal(parseConsultantSelfInput({}).ok, false, "オン・オフは必須");
  assert.equal(parseConsultantSelfInput({ listed: "yes" }).ok, false);
  assert.equal(parseConsultantSelfInput({ listed: true, talkTags: ["xxx"] }).ok, false);
  assert.equal(parseConsultantSelfInput({ listed: true, message: "あ".repeat(201) }).ok, false);
  assert.deepEqual(parseConsultantSelfInput({ listed: true, talkTags: ["resume", "interview"], message: " よろしく " }),
    { ok: true, value: { listed: true, talkTags: ["interview", "resume"], message: "よろしく" } });
  assert.deepEqual(parseConsultantSelfInput({ listed: false }), { ok: true, value: { listed: false, talkTags: [], message: null } });
});

test("同意の方法は転職ルートの4つ＋self。転職ルートの選択肢には self を足していない", () => {
  assert.deepEqual(CONSULTANT_CONSENT_METHODS.map((m) => m.value), [...ROUTE_CONSENT_METHODS.map((m) => m.value), "self"]);
  assert.ok(!ROUTE_CONSENT_METHODS.some((m) => m.value === "self"));
});

test("選択肢が migration の CHECK と同じ（話せること・同意の方法）", () => {
  const base = readFileSync(new URL("../../../supabase/migrations/20261112090000_featured_consultants.sql", import.meta.url), "utf8");
  const tags = base.match(/talk_tags <@ array\[([\s\S]*?)\]::text\[\]/);
  assert.ok(tags, "talk_tags の CHECK が見つからない");
  assert.deepEqual(Array.from(tags[1].matchAll(/'([a-z_]+)'/g)).map((x) => x[1]), ROUTE_TALK_TAGS.map((t) => t.value));
  const self = readFileSync(new URL("../../../supabase/migrations/20261112130000_consultants_self_service.sql", import.meta.url), "utf8");
  const m = self.match(/add constraint ow_featured_consultants_consent_method_check\s+check \(consent_method is null or consent_method in \(([^)]*)\)\)/);
  assert.ok(m, "consent_method の新しい CHECK が見つからない");
  assert.deepEqual(Array.from(m[1].matchAll(/'([a-z_]+)'/g)).map((x) => x[1]), CONSULTANT_CONSENT_METHODS.map((t) => t.value));
});
