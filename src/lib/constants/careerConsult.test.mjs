/**
 * キャリア相談の選択肢・検証・共通点のテスト。 node --test src/lib/constants/careerConsult.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONSULT_POINTS, CONSULT_FORMATS, CONSULT_NOTE_MAX, CAREER_GENERAL_OPTION,
  parseConsultInput, readConsultPayload, consultSummary, consultAboutLabel, optionKeyForExperience,
} from "./careerConsult.ts";
import { pickCommonPoints, COMMON_POINTS_MAX } from "../consult/commonPoints.ts";
import { openRequestLimit, isCountedPending } from "./messages.ts";

const options = [
  { key: "company:c1", kind: "company", companyId: "c1", label: "Salesforce", period: "2018〜2022", experienceIds: ["e1", "e2"] },
  { key: "exp:e3", kind: "company", companyId: null, label: "株式会社テスト", period: "いま", experienceIds: ["e3"] },
  CAREER_GENERAL_OPTION,
];

test("選択肢: 特に聞きたいこと6つ・話し方2つ（会っては無い）", () => {
  assert.deepEqual(CONSULT_POINTS.map((p) => p.value), ["work_style", "salary", "rewarding", "join_reason", "job_change", "industry"]);
  assert.deepEqual(CONSULT_FORMATS.map((f) => f.value), ["message", "online_30"]);
});

test("聞きたい話は必須で、選択肢にあるものだけ", () => {
  assert.equal(parseConsultInput({}, options).ok, false);
  assert.equal(parseConsultInput({ about: "company:zzz" }, options).ok, false);
  const r = parseConsultInput({ about: "career" }, options);
  assert.equal(r.ok, true);
  assert.deepEqual(r.payload, { v: 1, about: { kind: "career" }, points: [], format: null, note: null });
});

test("会社を選ぶと、そのときの会社名と期間を残す", () => {
  const r = parseConsultInput({ about: "company:c1", points: ["salary", "work_style", "salary"], format: "online_30", note: "  伺いたいです  " }, options);
  assert.equal(r.ok, true);
  assert.deepEqual(r.payload.about, { kind: "company", companyId: "c1", companyName: "Salesforce", period: "2018〜2022" });
  assert.deepEqual(r.payload.points, ["work_style", "salary"], "重複は1つ・並びは選択肢の順");
  assert.equal(r.payload.format, "online_30");
  assert.equal(r.payload.note, "伺いたいです");
});

test("不正な値は通さない（黙って捨てない）", () => {
  assert.equal(parseConsultInput({ about: "career", points: ["meet"] }, options).ok, false);
  assert.equal(parseConsultInput({ about: "career", points: "salary" }, options).ok, false);
  assert.equal(parseConsultInput({ about: "career", format: "in_person" }, options).ok, false);
  assert.equal(parseConsultInput({ about: "career", note: "あ".repeat(CONSULT_NOTE_MAX + 1) }, options).ok, false);
  assert.equal(parseConsultInput({ about: "career", note: "あ".repeat(CONSULT_NOTE_MAX) }, options).ok, true);
});

test("保存した中身を読み直せる・壊れた行は null", () => {
  const r = parseConsultInput({ about: "exp:e3", note: "x" }, options);
  assert.deepEqual(readConsultPayload(JSON.parse(JSON.stringify(r.payload))), r.payload);
  assert.equal(readConsultPayload(null), null);
  assert.equal(readConsultPayload({ v: 2 }), null);
  assert.equal(readConsultPayload({ v: 1, about: { kind: "company" } }), null);
});

test("代わりの本文は1字以上で、ひとことを添える", () => {
  const a = parseConsultInput({ about: "career" }, options).payload;
  assert.equal(consultSummary(a), "キャリア相談：キャリア全般");
  const b = parseConsultInput({ about: "company:c1", note: "よろしくお願いします" }, options).payload;
  assert.equal(consultSummary(b), "キャリア相談：Salesforceでの経験\nよろしくお願いします");
  assert.equal(consultAboutLabel({ kind: "career" }), "キャリア全般");
});

test("「この経験について聞く」は、その職歴をまとめた選択肢を選ぶ", () => {
  assert.equal(optionKeyForExperience(options, "e2"), "company:c1");
  assert.equal(optionKeyForExperience(options, "e3"), "exp:e3");
  assert.equal(optionKeyForExperience(options, "nope"), null);
  assert.equal(optionKeyForExperience(options, null), null);
});

test("★選択肢は migration の CHECK と同じ（kind に consult・通知に career_consult）", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261105090000_career_consult_messages.sql", import.meta.url), "utf8");
  assert.match(sql, /'proposal_intro','consult'/);
  assert.match(sql, /'interest_company_joined','career_consult'/);
});

/* ── 共通点 ── */
const empty = { schools: [], companies: [], industries: [], roles: [] };

test("共通点: 同じ高校・同じ会社・同じ職種", () => {
  const viewer = { schools: [{ id: "h1", name: "朝霞西高校", type: "highschool" }], companies: [{ id: "c1", name: "Salesforce", isCurrent: false }], industries: [{ id: "it", name: "IT・ソフトウェア" }], roles: [{ id: "sales", name: "営業" }] };
  const other = { schools: [{ id: "h1", name: "朝霞西高校", type: "highschool" }], companies: [{ id: "c1", name: "Salesforce", isCurrent: true }], industries: [{ id: "it", name: "IT・ソフトウェア" }], roles: [{ id: "sales", name: "営業" }] };
  assert.deepEqual(pickCommonPoints(viewer, other).map((p) => p.label), ["同じ高校（朝霞西高校）", "同じ会社の出身（Salesforce）", "同じ職種（営業）"]);
});

test("共通点: 会社が重ならなければ同業・両方いまの会社なら「同じ会社」", () => {
  const v = { ...empty, companies: [{ id: "c1", name: "A", isCurrent: true }], industries: [{ id: "it", name: "IT・ソフトウェア" }] };
  assert.deepEqual(pickCommonPoints(v, { ...empty, companies: [{ id: "c2", name: "B", isCurrent: true }], industries: [{ id: "it", name: "IT・ソフトウェア" }] }).map((p) => p.label), ["同業（IT・ソフトウェア）"]);
  assert.deepEqual(pickCommonPoints(v, { ...empty, companies: [{ id: "c1", name: "A", isCurrent: true }], industries: [{ id: "it", name: "IT・ソフトウェア" }] }).map((p) => p.label), ["同じ会社（A）"]);
});

test("共通点: 何も重ならなければ空・多くても上限まで", () => {
  assert.deepEqual(pickCommonPoints(empty, empty), []);
  const many = { schools: [{ id: "u1", name: "U", type: "university" }, { id: "g1", name: "G", type: "graduate_school" }], companies: [{ id: "a", name: "A", isCurrent: false }, { id: "b", name: "B", isCurrent: false }], industries: [], roles: [{ id: "r", name: "R" }] };
  assert.equal(pickCommonPoints(many, many).length, COMMON_POINTS_MAX);
  assert.deepEqual(pickCommonPoints(many, many).map((p) => p.label).slice(0, 2), ["同じ大学（U）", "同じ大学院（G）"]);
});

/* ── 返事待ちの上限 ── */
test("返事待ちの上限は設定の値（1〜100）・無い／壊れていれば 5", () => {
  assert.equal(openRequestLimit(null), 5);
  assert.equal(openRequestLimit(undefined), 5);
  assert.equal(openRequestLimit("8"), 8);
  assert.equal(openRequestLimit("0"), 5);
  assert.equal(openRequestLimit("101"), 5);
  assert.equal(openRequestLimit("abc"), 5);
  assert.equal(openRequestLimit("3.5"), 5);
});

test("14日たった返事待ちは数えない", () => {
  const now = new Date("2026-11-15T00:00:00Z");
  assert.equal(isCountedPending("2026-11-02T00:00:00Z", now), true);
  assert.equal(isCountedPending("2026-11-01T00:00:00Z", now), false, "ちょうど14日前は数えない");
  assert.equal(isCountedPending("2026-10-01T00:00:00Z", now), false);
});
