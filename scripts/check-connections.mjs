#!/usr/bin/env node
// ★つながりの選び方（pickConnections）を固定データで確かめる（2026-10-16 / フェーズ3）。
// 実データは相互フォローが0組なので、「出る側」を本番で通せない。ここが陽性対照。
//   node scripts/check-connections.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

// TS を JS に変換して読む（typescript は既存の依存。新しく足さない）
let src = readFileSync(new URL("../src/lib/companies/connectionsPick.ts", import.meta.url), "utf8");
// --self-test: 許可の条件を外した版で走らせ、**失敗すること**を確かめる（検出器が効いているか）
const SELF = process.argv.includes("--self-test");
if (SELF) {
  const before = src;
  src = src.replace("&& input.consented.has(e.userId)", "");
  if (src === before) { console.error("self-test: 置き換え対象が見つからない"); process.exit(2); }
}
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const out = join(mkdtempSync(join(tmpdir(), "conn-")), "pick.mjs");
writeFileSync(out, js);
const { pickConnections } = await import(out);

const V = "viewer";
const cur = ["a", "b", "c", "d", "e", "a", V].map((userId) => ({ userId }));
const following = new Set(["a", "b", "c", "e"]);   // 閲覧者がフォロー
const followers = new Set(["a", "b", "d", "e"]);   // 閲覧者をフォロー（相互は a, b, e）
const consented = new Set(["a", "e", "d"]);        // 表示を許可（b は不許可）
const got = pickConnections({ current: cur, viewerOwUserId: V, following, followers, consented }).map((x) => x.userId);

const cases = [
  ["相互フォロー かつ 許可 の人だけ（a, e）", JSON.stringify(got) === JSON.stringify(["a", "e"])],
  ["片方向だけ（c: 自分→相手、d: 相手→自分）は出ない", !got.includes("c") && !got.includes("d")],
  ["相互でも許可していない人（b）は出ない", !got.includes("b")],
  ["閲覧者自身は出ない", !got.includes(V)],
  ["同じ人を2回出さない", got.filter((x) => x === "a").length === 1],
  ["誰も許可していなければ0人",
    pickConnections({ current: cur, viewerOwUserId: V, following, followers, consented: new Set() }).length === 0],
];
let ok = true;
for (const [name, pass] of cases) { console.log(`${pass ? "OK  " : "FAIL"} ${name}`); ok &&= pass; }
if (SELF) {
  console.log(ok ? "self-test 失敗: 許可の条件を外しても通ってしまった（検出器が効いていない）" : "self-test OK: 許可の条件を外すと失敗する");
  process.exit(ok ? 1 : 0);
}
console.log(ok ? "すべて通った" : "失敗あり");
process.exit(ok ? 0 : 1);
