/**
 * 話す人の立場と話せる量のテスト。 node --test src/lib/constants/talk.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TALK_STANCES, TALK_CAPACITIES, DEFAULT_TALK_CAPACITY, TALK_REQUEST_EXPIRE_DAYS,
  parseTalkSettings, talkAcceptsRequest, startOfMonthJst, isTalkRequestExpired, talkStanceLabel,
} from "./talk.ts";

test("選択肢は立場3つ・量3つで、初期値は「今は話せない」", () => {
  assert.deepEqual(TALK_STANCES.map((s) => s.value), ["recruiter", "referral", "personal"]);
  assert.deepEqual(TALK_CAPACITIES.map((c) => c.value), ["none", "monthly_one", "active"]);
  assert.equal(DEFAULT_TALK_CAPACITY, "none");
});

test("★選択肢は migration の CHECK と同じ", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261103100000_talk_settings.sql", import.meta.url), "utf8");
  assert.match(sql, /stance in \('recruiter', 'referral', 'personal'\)/);
  assert.match(sql, /capacity in \('none', 'monthly_one', 'active'\)/);
});

test("今は話せない人は受け付けない・月1件は今月1件目まで・積極的にはいつでも", () => {
  assert.equal(talkAcceptsRequest({ capacity: "none", receivedThisMonth: 0 }), false);
  assert.equal(talkAcceptsRequest({ capacity: "monthly_one", receivedThisMonth: 0 }), true);
  assert.equal(talkAcceptsRequest({ capacity: "monthly_one", receivedThisMonth: 1 }), false);
  assert.equal(talkAcceptsRequest({ capacity: "active", receivedThisMonth: 9 }), true);
});

test("月の初めは日本時間の1日0時", () => {
  // 日本時間 2026-11-01 08:59（UTC 10-31 23:59）は 11月
  assert.equal(startOfMonthJst(new Date("2026-10-31T23:59:00Z")).toISOString(), "2026-10-31T15:00:00.000Z");
  // 日本時間 2026-10-31 23:59（UTC 10-31 14:59）は 10月
  assert.equal(startOfMonthJst(new Date("2026-10-31T14:59:00Z")).toISOString(), "2026-09-30T15:00:00.000Z");
});

test("14日たった依頼だけが自動で辞退になる", () => {
  assert.equal(TALK_REQUEST_EXPIRE_DAYS, 14);
  const now = new Date("2026-11-15T00:00:00Z");
  assert.equal(isTalkRequestExpired("2026-11-01T00:00:00Z", now), true);
  assert.equal(isTalkRequestExpired("2026-11-01T00:00:01Z", now), false);
});

test("保存の検証: 話せるなら立場が要る・採用担当なら会社が要る・不正値は弾く", () => {
  assert.deepEqual(parseTalkSettings({ capacity: "none" }), { ok: true, value: { stance: null, stanceCompanyId: null, capacity: "none" } });
  assert.equal(parseTalkSettings({ capacity: "active" }).ok, false);
  assert.equal(parseTalkSettings({ capacity: "active", stance: "recruiter" }).ok, false);
  assert.deepEqual(parseTalkSettings({ capacity: "monthly_one", stance: "personal", stanceCompanyId: "x" }),
    { ok: true, value: { stance: "personal", stanceCompanyId: null, capacity: "monthly_one" } });
  assert.equal(parseTalkSettings({ capacity: "weekly", stance: "personal" }).ok, false);
  assert.equal(parseTalkSettings({ capacity: "active", stance: "boss" }).ok, false);
});

test("立場の名前: 採用担当は会社名を添える", () => {
  assert.equal(talkStanceLabel("recruiter", "Salesforce"), "採用担当（Salesforce）");
  assert.equal(talkStanceLabel("referral", "Salesforce"), "紹介制度のある社員");
  assert.equal(talkStanceLabel(null), null);
});
