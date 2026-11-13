/**
 * Next Manager の定数・入力の検証のテスト。 node --test src/lib/nextManager/nextManager.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MATCH_RESULTS, HIRING_NOTE_MAX, MATCH_MEMO_MAX, matchResultLabel, parseMatchPatch, parseHiringInput,
  hiringForText, privateMessageNote, isIsoDate,
} from "./constants.ts";

const U = "11111111-2222-3333-4444-555555555555";

test("結果の値は migration の CHECK と同じ", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261113090000_next_manager.sql", import.meta.url), "utf8");
  const m = sql.match(/result in \(([^)]*)\)/);
  assert.ok(m, "CHECK が見つからない");
  const inSql = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  assert.deepEqual(inSql, MATCH_RESULTS.map((r) => r.value));
  assert.ok(sql.includes(`between 1 and ${HIRING_NOTE_MAX}`));
  assert.ok(sql.includes(`<= ${MATCH_MEMO_MAX}`));
});

test("未入力は「面談前」", () => {
  assert.equal(matchResultLabel(null), "面談前");
  assert.equal(matchResultLabel("hired"), "入社");
  assert.equal(matchResultLabel("unknown"), "面談前");
});

test("記録の入力: 無いキーは変えない・空は消す・不正はエラー", () => {
  assert.deepEqual(parseMatchPatch({}), { ok: true, patch: {} });
  assert.deepEqual(parseMatchPatch({ result: "", memo: "  " }), { ok: true, patch: { result: null, memo: null } });
  assert.deepEqual(parseMatchPatch({ metOn: "2026-11-10", jobId: U }), { ok: true, patch: { metOn: "2026-11-10", jobId: U } });
  assert.equal(parseMatchPatch({ result: "maybe" }).ok, false);
  assert.equal(parseMatchPatch({ metOn: "2026-02-30" }).ok, false);
  assert.equal(parseMatchPatch({ jobId: "x" }).ok, false);
  assert.equal(parseMatchPatch({ memo: "あ".repeat(MATCH_MEMO_MAX + 1) }).ok, false);
});

test("本文に当たるキーを受け取らない（記録に本文を写さない）", () => {
  const r = parseMatchPatch({ body: "本文", messages: ["x"], memo: "メモ" });
  assert.deepEqual(r, { ok: true, patch: { memo: "メモ" } });
});

test("採用中の入力", () => {
  assert.deepEqual(parseHiringInput({ companyId: U, isHiring: true, note: " フィールドセールス・2名 " }),
    { ok: true, companyId: U, isHiring: true, note: "フィールドセールス・2名", jobId: null });
  assert.equal(parseHiringInput({ companyId: U, isHiring: "yes" }).ok, false);
  assert.equal(parseHiringInput({ companyId: "x", isHiring: true }).ok, false);
  assert.equal(parseHiringInput({ companyId: U, isHiring: true, note: "あ".repeat(HIRING_NOTE_MAX + 1) }).ok, false);
});

test("表示の文", () => {
  assert.equal(hiringForText({ note: null, jobTitle: null }), null);
  assert.equal(hiringForText({ note: "2名", jobTitle: "フィールドセールス" }), "フィールドセールス（2名）");
  assert.equal(privateMessageNote("山本", "田中"), "メッセージは山本さんと田中さんの2人だけのものです。会社には共有されません。");
  assert.ok(isIsoDate("2026-11-13"));
});
