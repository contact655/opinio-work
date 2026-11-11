/**
 * 転職ルートの判定・入力の確かめのテスト。 node --test src/lib/careerRoutes/careerRoutes.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ROUTE_TALK_TAGS, hostBlockers, isHostListable, parseHostInput, parseRouteInput, routeConsultNote, sortRouteTalkTags,
} from "../constants/careerRoutes.ts";

const ok = {
  visibility: "public", authId: "a", isTest: false, isSystem: false,
  acceptingConsult: true, isListed: true, approvedAt: "2026-11-11T00:00:00Z", routePublished: true,
};

test("3つの条件と公開面の条件がそろえば出せる", () => {
  assert.equal(isHostListable(ok), true);
  assert.deepEqual(hostBlockers(ok), []);
});

test("どれか1つ欠けたら出さない", () => {
  for (const [k, v] of [
    ["visibility", "login_only"], ["acceptingConsult", false], ["isListed", false], ["approvedAt", null],
    ["routePublished", false], ["authId", null], ["isTest", true], ["isSystem", true],
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
  assert.equal(parseHostInput({ talkTags: ["xxx"], acceptingConsult: true }).ok, false);
  assert.equal(parseHostInput({ message: "あ".repeat(201), acceptingConsult: true }).ok, false);
  assert.equal(parseHostInput({ movedYear: "20", acceptingConsult: true }).ok, false);
  assert.equal(parseHostInput({ acceptingConsult: "yes" }).ok, false);
  const r = parseHostInput({ movedYear: "2023", talkTags: ["resume", "interview"], message: "  よろしく ", acceptingConsult: true });
  assert.deepEqual(r, { ok: true, value: { movedYear: 2023, talkTags: ["interview", "resume"], message: "よろしく", acceptingConsult: true } });
  assert.deepEqual(parseHostInput({ movedYear: "", message: "", acceptingConsult: false }), { ok: true, value: { movedYear: null, talkTags: [], message: null, acceptingConsult: false } });
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
