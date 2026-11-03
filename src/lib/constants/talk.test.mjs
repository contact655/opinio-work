/**
 * 話す人の立場と話せる量のテスト。 node --test src/lib/constants/talk.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TALK_STANCES, TALK_CAPACITIES, DEFAULT_TALK_CAPACITY, TALK_REQUEST_EXPIRE_DAYS,
  parseTalkSettings, talkAcceptsRequest, startOfMonthJst, isTalkRequestExpired, talkStanceLabel,
  isInCurrentMonthJst, talkButtonVisible, talkRequestExpiryCutoff, talkCapacityShortLabel,
} from "./talk.ts";
import { recruiterCompanyIds } from "../talk/recruiter.ts";
import { can, toCompanyRole } from "../auth/roles.ts";

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

test("★月1件まで: その月に1件受けたら月末までボタンを出さず、翌月1日（日本時間0時）に戻る", () => {
  const received = "2026-11-03T03:00:00Z"; // 日本時間 11/3 12:00 に1件
  const count = (now) => [received].filter((c) => isInCurrentMonthJst(c, now)).length;
  const show = (now) => talkButtonVisible({
    isSelf: false, targetVisible: true, viewerIsTest: false, targetIsTest: false, connected: false,
    accepts: talkAcceptsRequest({ capacity: "monthly_one", receivedThisMonth: count(now) }),
  });
  assert.equal(show(new Date("2026-11-03T02:59:00Z")), true, "受ける前は出る");
  assert.equal(show(new Date("2026-11-03T03:00:00Z")), false, "受けた直後は出ない");
  assert.equal(show(new Date("2026-11-30T14:59:00Z")), false, "月末（日本時間 11/30 23:59）も出ない");
  assert.equal(show(new Date("2026-11-30T15:00:00Z")), true, "翌月1日（日本時間 12/1 0:00）に戻る");
});

test("★14日返事がなければ自動で辞退。13日目（13日と23時間59分）ではまだ辞退にならない", () => {
  const created = "2026-11-01T00:00:00Z";
  assert.equal(isTalkRequestExpired(created, new Date("2026-11-14T00:00:00Z")), false, "13日目");
  assert.equal(isTalkRequestExpired(created, new Date("2026-11-14T23:59:00Z")), false, "13日と23時間59分");
  assert.equal(isTalkRequestExpired(created, new Date("2026-11-15T00:00:00Z")), true, "14日");
});

test("★採用担当を選べるのは、有効な担当者で管理者か採用担当の会社だけ", () => {
  const canRecruit = (p) => can(toCompanyRole(p), "talk.asRecruiter");
  const rows = [
    { company_id: "a", permission: "admin", is_active: true },
    { company_id: "b", permission: "recruiter", is_active: true },
    { company_id: "c", permission: "viewer", is_active: true },
    { company_id: "d", permission: "admin", is_active: false },
    { company_id: "e", permission: "member", is_active: true }, // 旧値は採用担当として読む
    { company_id: "f", permission: "owner", is_active: true },  // 知らない値は何もできない
  ];
  assert.deepEqual(recruiterCompanyIds(rows, canRecruit), ["a", "b", "e"]);
  assert.deepEqual(recruiterCompanyIds([], canRecruit), [], "担当者でない人は0件（保存は 403）");
});

test("★ボタン: 検証用と実在のアカウントの組み合わせには出さない", () => {
  const base = { isSelf: false, targetVisible: true, connected: false, accepts: true };
  assert.equal(talkButtonVisible({ ...base, viewerIsTest: false, targetIsTest: false }), true, "実在→実在");
  assert.equal(talkButtonVisible({ ...base, viewerIsTest: true, targetIsTest: true }), true, "検証用→検証用");
  assert.equal(talkButtonVisible({ ...base, viewerIsTest: false, targetIsTest: true }), false, "実在→検証用");
  assert.equal(talkButtonVisible({ ...base, viewerIsTest: true, targetIsTest: false }), false, "検証用→実在");
  assert.equal(talkButtonVisible({ ...base, viewerIsTest: null, targetIsTest: true }), false, "未ログイン→検証用");
  assert.equal(talkButtonVisible({ ...base, viewerIsTest: null, targetIsTest: false }), true, "未ログイン→実在");
  assert.equal(talkButtonVisible({ ...base, connected: true, accepts: false, viewerIsTest: false, targetIsTest: true }), false, "つながっていても組み合わせが違えば出さない");
});

test("ボタン: 自分自身・見られない人には出さない。つながっていれば受け付けていなくても出す", () => {
  const base = { viewerIsTest: false, targetIsTest: false };
  assert.equal(talkButtonVisible({ ...base, isSelf: true, targetVisible: true, connected: true, accepts: true }), false);
  assert.equal(talkButtonVisible({ ...base, isSelf: false, targetVisible: false, connected: true, accepts: true }), false);
  assert.equal(talkButtonVisible({ ...base, isSelf: false, targetVisible: true, connected: true, accepts: false }), true);
  assert.equal(talkButtonVisible({ ...base, isSelf: false, targetVisible: true, connected: false, accepts: false }), false);
});

test("★定期実行の締め切りと isTalkRequestExpired は同じ計算（created_at <= 締め切り なら辞退）", () => {
  const now = new Date("2026-11-15T03:21:00Z");
  const cutoff = talkRequestExpiryCutoff(now);
  assert.equal(cutoff.toISOString(), new Date(now.getTime() - TALK_REQUEST_EXPIRE_DAYS * 86400000).toISOString());
  // 締め切りの前後1秒・1分・1時間・1日で、両者の判定が一致する
  for (const ms of [-86400000, -3600000, -60000, -1000, 0, 1000, 60000, 3600000, 86400000]) {
    const created = new Date(cutoff.getTime() + ms).toISOString();
    const byCron = new Date(created).getTime() <= cutoff.getTime(); // server.ts の .lte("created_at", cutoff) と同じ
    assert.equal(isTalkRequestExpired(created, now), byCron, `締め切り${ms >= 0 ? "+" : ""}${ms}ms`);
  }
});

test("★定期実行（server.ts）は締め切りを talkRequestExpiryCutoff で出し、日数の計算を書いていない", () => {
  const src = readFileSync(new URL("../talk/server.ts", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export async function expireTalkRequests"));
  assert.match(body, /const cutoff = talkRequestExpiryCutoff\(now\)\.toISOString\(\);/);
  assert.match(body, /\.eq\("status", "pending"\)\.lte\("created_at", cutoff\)/);
  assert.doesNotMatch(src, /24 \* 60 \* 60|86400|TALK_REQUEST_EXPIRE_DAYS/, "server.ts に日数の計算が残っていない");
});

test("★ホームの左のカードの短い言い方: 今は話せない＝オフ、ほかは設定画面と同じ名前", () => {
  assert.equal(talkCapacityShortLabel("none"), "オフ");
  assert.equal(talkCapacityShortLabel("monthly_one"), "月1件まで");
  assert.equal(talkCapacityShortLabel("active"), "積極的に");
});
