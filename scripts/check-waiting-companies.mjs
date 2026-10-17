#!/usr/bin/env node
// ★「担当者のいない企業で待っている人」の集計（pickWaitingCompanies）を固定データで確かめる（2026-10-17）。
// 実データは0社なので、出る側を本番で通せない。ここが陽性対照。
//   node scripts/check-waiting-companies.mjs [--self-test]
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

let src = readFileSync(new URL("../src/lib/admin/waitingCompaniesPick.ts", import.meta.url), "utf8");
// --self-test: 「担当者がいれば外す」を壊した版で走らせ、**失敗すること**を確かめる
const SELF = process.argv.includes("--self-test");
if (SELF) {
  const before = src;
  src = src.replace("if (st && (isTest ? st.test : st.real)) continue;", "");
  if (src === before) { console.error("self-test: 置き換え対象が見つからない"); process.exit(2); }
}
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const out = join(mkdtempSync(join(tmpdir(), "wait-")), "pick.mjs");
writeFileSync(out, js);
const { pickWaitingCompanies } = await import(out);

const companies = new Map([
  ["A", { name: "A社（担当者なし）", slug: "a" }],
  ["B", { name: "B社（実在の担当者あり）", slug: "b" }],
  ["C", { name: "C社（検証用の担当者だけ）", slug: "c" }],
  ["D", { name: "D社（検証用の人だけが待つ）", slug: "d" }],
]);
const staff = new Map([["B", { real: true, test: false }], ["C", { real: false, test: true }]]);
const userIsTest = new Map([["real1", false], ["real2", false], ["test1", true]]);
const waits = [
  { companyId: "A", userId: "real1", at: "2026-10-05", kind: "applications" },
  { companyId: "A", userId: "real2", at: "2026-10-01", kind: "interested" },
  { companyId: "B", userId: "real1", at: "2026-09-01", kind: "applications" }, // 実在の担当者が答えられる → 出ない
  { companyId: "C", userId: "real1", at: "2026-10-10", kind: "meetings" },     // 実在の人には担当者なし → 出る
  { companyId: "C", userId: "test1", at: "2026-09-01", kind: "applications" }, // 検証用の人には検証用の担当者 → 数えない
  { companyId: "D", userId: "test1", at: "2026-09-02", kind: "meetings" },     // 担当者なし・検証用だけ → testOnly
];
const got = pickWaitingCompanies({ waits, userIsTest, staff, joinRequestCompanyIds: new Set(["C"]), companies });
const brief = got.map((r) => `${r.companyId}:${r.applications}/${r.meetings}/${r.interested}:${r.oldestAt}:${r.testOnly ? "test" : "real"}:${r.hasJoinRequest ? "join" : "-"}`);
const want = ["A:1/0/1:2026-10-01:real:-", "C:0/1/0:2026-10-10:real:join", "D:0/1/0:2026-09-02:test:-"];

const ok = JSON.stringify(brief) === JSON.stringify(want);
if (SELF) {
  if (ok) { console.error("self-test 失敗: 壊した版でも通ってしまった（検出器が効いていない）"); process.exit(1); }
  console.log("self-test OK: 壊した版を検出した", brief);
  process.exit(0);
}
if (!ok) { console.error("NG", { got: brief, want }); process.exit(1); }
console.log("OK", brief);
