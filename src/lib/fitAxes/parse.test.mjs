/**
 * 「相性のものさし」の貼り戻しの読み取りのテスト。
 *
 *     node --test src/lib/fitAxes/parse.test.mjs
 *
 * 守っているもの:
 *   ① 正しい形式は6軸すべて読める
 *   ② 一部が崩れていても、[key] と数字がある行は拾う。読めない軸は結果に入れない（黙って埋めない）
 *   ③ 「わからない」は値なし（null）。理由の中の数字を拾わない
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseFitAxesAnswer } from "./parse.ts";

const KEYS = ["work_style", "phase", "result", "decision", "customer", "growth"];

test("① 正しい形式は6軸すべて読める", () => {
  const r = parseFitAxesAnswer([
    "[work_style] 2: 自分で企画を立てて動いてきた",
    "[phase] 1: 立ち上げ期の経験が多い",
    "[result] 4: チームでの目標達成を重視",
    "[decision] 2: 素早く決める場面が多い",
    "[customer] 1: 現場の営業が長い",
    "[growth] 5: 専門性を深めたいと話していた",
  ].join("\n"), KEYS);
  assert.equal(Object.keys(r).length, 6);
  assert.deepEqual(r.work_style, { value: 2, reason: "自分で企画を立てて動いてきた" });
  assert.equal(r.growth.value, 5);
});

test("② 崩れた形式: 全角・余計な文・抜けた軸", () => {
  const r = parseFitAxesAnswer([
    "以下が回答です。",
    "**［WORK_STYLE］ ２ ： 自分で考えるタイプ**",
    "- 【phase】→ 3（どちらとも言えない）",
    "[result] チームで追う方です（4）",
    "decision: 2",               // [ ] が無い → 拾わない
    "[customer]: 現場",          // 数字が無い → 拾わない
    "[unknown_axis] 3: 知らない軸",
  ].join("\n"), KEYS);
  assert.equal(r.work_style.value, 2);
  assert.equal(r.phase.value, 3);
  assert.equal(r.result.value, 4);
  assert.equal("decision" in r, false);
  assert.equal("customer" in r, false);
  assert.equal("growth" in r, false);
  assert.equal(Object.keys(r).length, 3);
});

test("③ 「わからない」は値なし。理由の中の数字を拾わない", () => {
  const r = parseFitAxesAnswer([
    "[work_style] わからない: 情報が足りません（会話は3回だけ）",
    "[phase] 不明",
    "[result] 4: 2年間チームリーダーだった",
    "[growth] わかりません",
  ].join("\n"), KEYS);
  assert.deepEqual(r.work_style, { value: null, reason: "情報が足りません（会話は3回だけ）" });
  assert.equal(r.phase.value, null);
  assert.equal(r.result.value, 4);
  assert.equal(r.growth.value, null);
});

test("同じ軸が2回出たら最初の1回", () => {
  const r = parseFitAxesAnswer("[growth] 2: a\n[growth] 5: b", KEYS);
  assert.equal(r.growth.value, 2);
});

test("範囲外の数字は拾わない（0, 6, 10）", () => {
  const r = parseFitAxesAnswer("[phase] 6: x\n[result] 10: y\n[decision] 0: z", KEYS);
  assert.equal(Object.keys(r).length, 0);
});
