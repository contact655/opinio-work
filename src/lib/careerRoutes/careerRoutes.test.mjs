/**
 * 転職ルートの判定・入力の確かめのテスト。 node --test src/lib/careerRoutes/careerRoutes.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ROUTE_CONSENT_METHODS, ROUTE_TALK_TAGS, hostBlockers, isoToJstLocal, jstLocalToIso, isHostListable, parseHostInput, parseRouteInput, routeConsultNote, sortRouteTalkTags,
} from "../constants/careerRoutes.ts";

const ok = {
  visibility: "public", authId: "a", isTest: false, isSystem: false,
  acceptingConsult: true, isListed: true, approvedAt: "2026-11-11T00:00:00Z", routePublished: true,
  consentConfirmedAt: "2026-11-10T01:00:00Z", consentMethod: "email",
};

test("3つの条件と公開面の条件がそろえば出せる", () => {
  assert.equal(isHostListable(ok), true);
  assert.deepEqual(hostBlockers(ok), []);
});

test("どれか1つ欠けたら出さない", () => {
  for (const [k, v] of [
    ["visibility", "login_only"], ["acceptingConsult", false], ["isListed", false], ["approvedAt", null],
    ["routePublished", false], ["authId", null], ["isTest", true], ["isSystem", true],
    ["consentConfirmedAt", null], ["consentMethod", null], ["consentMethod", "phone"],
  ]) {
    assert.equal(isHostListable({ ...ok, [k]: v }), false, k);
  }
});

test("値が取れない（undefined）は出さない側に倒す", () => {
  for (const k of Object.keys(ok)) assert.equal(isHostListable({ ...ok, [k]: undefined }), false, k);
});

test("話せることは選択肢の順にそろえ、知らない値は落とす", () => {
  assert.deepEqual(sortRouteTalkTags(["english", "interview", "xxx", "interview"]), ["interview", "english"]);
});

test("経験者の入力: 不正なタグ・長すぎるひとこと・年は弾く", () => {
  const C = { consentConfirmedAt: "2026-11-10T10:00", consentMethod: "line" };
  assert.equal(parseHostInput({ talkTags: ["xxx"], acceptingConsult: true, ...C }).ok, false);
  assert.equal(parseHostInput({ message: "あ".repeat(201), acceptingConsult: true, ...C }).ok, false);
  assert.equal(parseHostInput({ movedYear: "20", acceptingConsult: true, ...C }).ok, false);
  assert.equal(parseHostInput({ acceptingConsult: "yes" }).ok, false);
  const r = parseHostInput({ movedYear: "2023", talkTags: ["resume", "interview"], message: "  よろしく ", acceptingConsult: true, ...C });
  assert.deepEqual(r, { ok: true, value: { movedYear: 2023, talkTags: ["interview", "resume"], message: "よろしく", acceptingConsult: true, consentConfirmedAt: "2026-11-10T01:00:00.000Z", consentMethod: "line" } });
  assert.deepEqual(parseHostInput({ movedYear: "", message: "", acceptingConsult: false }), { ok: true, value: { movedYear: null, talkTags: [], message: null, acceptingConsult: false, consentConfirmedAt: null, consentMethod: null } });
});

test("ルートの入力: slug の形と表示名を確かめる", () => {
  assert.equal(parseRouteInput({ slug: "HR-Sales", fromLabel: "a", toLabel: "b", isPublished: false }).ok, false);
  assert.equal(parseRouteInput({ slug: "hr--sales", fromLabel: "a", toLabel: "b", isPublished: false }).ok, false);
  assert.equal(parseRouteInput({ slug: "hr-sales", fromLabel: "", toLabel: "b", isPublished: false }).ok, false);
  assert.deepEqual(parseRouteInput({ slug: "hr-sales", fromLabel: " 人材の法人営業 ", toLabel: "外資SaaSの営業", displayOrder: "2", isPublished: true }),
    { ok: true, value: { slug: "hr-sales", fromLabel: "人材の法人営業", toLabel: "外資SaaSの営業", displayOrder: 2, isPublished: true } });
});

test("相談の下書き", () => {
  assert.equal(routeConsultNote({ fromLabel: "日系SaaS", toLabel: "外資SaaS" }), "日系SaaS→外資SaaSの転職について相談したいです");
});

test("話せることの値が migration の CHECK と同じ", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261111120000_career_routes.sql", import.meta.url), "utf8");
  const m = sql.match(/talk_tags <@ array\[([\s\S]*?)\]::text\[\]/);
  assert.ok(m, "CHECK が見つからない");
  const inSql = Array.from(m[1].matchAll(/'([a-z_]+)'/g)).map((x) => x[1]);
  assert.deepEqual(inSql, ROUTE_TALK_TAGS.map((t) => t.value));
});

test("同意の記録: 相談の受付・掲載中は日時と方法の両方が要る", () => {
  const now = new Date("2026-11-11T06:00:00Z");
  assert.equal(parseHostInput({ acceptingConsult: true }, { now }).ok, false);
  assert.equal(parseHostInput({ acceptingConsult: true, consentConfirmedAt: "2026-11-10T10:00" }, { now }).ok, false);
  assert.equal(parseHostInput({ acceptingConsult: true, consentMethod: "email" }, { now }).ok, false);
  assert.equal(parseHostInput({ acceptingConsult: false, consentMethod: "email" }, { now }).ok, false, "片方だけは受付なしでも弾く");
  assert.equal(parseHostInput({ acceptingConsult: false }, { isListed: true, now }).ok, false, "掲載中は記録を消せない");
  assert.equal(parseHostInput({ acceptingConsult: true, consentConfirmedAt: "2026-11-10T10:00", consentMethod: "phone" }, { now }).ok, false);
  assert.equal(parseHostInput({ acceptingConsult: true, consentConfirmedAt: "2026/11/10", consentMethod: "email" }, { now }).ok, false);
  assert.equal(parseHostInput({ acceptingConsult: true, consentConfirmedAt: "2026-11-12T10:00", consentMethod: "email" }, { now }).ok, false, "未来は弾く");
  assert.equal(parseHostInput({ acceptingConsult: true, consentConfirmedAt: "2026-11-10T10:00", consentMethod: "meeting" }, { now }).ok, true);
});

test("日本時間の入力欄と ISO の行き来", () => {
  assert.equal(jstLocalToIso("2026-11-11T09:30"), "2026-11-11T00:30:00.000Z");
  assert.equal(jstLocalToIso(""), null);
  assert.equal(jstLocalToIso("x"), undefined);
  assert.equal(isoToJstLocal("2026-11-11T00:30:00Z"), "2026-11-11T09:30");
  assert.equal(isoToJstLocal(null), "");
});

test("同意を確認した方法が migration の CHECK と同じ", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261111150000_route_hosts_consent.sql", import.meta.url), "utf8");
  const m = sql.match(/consent_method in \(([^)]*)\)/);
  assert.ok(m, "CHECK が見つからない");
  const inSql = Array.from(m[1].matchAll(/'([a-z_]+)'/g)).map((x) => x[1]);
  assert.deepEqual(inSql, ROUTE_CONSENT_METHODS.map((t) => t.value));
});
