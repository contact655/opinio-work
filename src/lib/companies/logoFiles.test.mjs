/**
 * ロゴの後片付けで「消してよい名前」の判定（logoFiles.ts の GENERATED_LOGO_RE）。
 *     npm test
 * ⚠️★従来の固定名（logo.png など）は消さない。この判定がずれると、一括投入したロゴが消える
 *    （Storage はバックアップに含まれず、戻せない）。
 */
import test from "node:test";
import assert from "node:assert/strict";

// ⚠️ logoFiles.ts は server-only を読むので、正規表現だけを文字列で取り出して確かめる
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./logoFiles.ts", import.meta.url), "utf8");
const m = src.match(/GENERATED_LOGO_RE = \/(.+)\/;/);
const RE = new RegExp(m[1]);

for (const name of ["logo-1791737377721.png", "logo-1791737474335.jpg", "logo-1791737474335.webp", "logo-1791737474335.svg"]) {
  test(`消してよい: ${name}`, () => assert.ok(RE.test(name)));
}
for (const name of ["logo.png", "logo.jpg", "logo.svg", "1756342001234.png", "logo-old.png", "logo-123.png", "logo-1791737377721.png.bak", "other-1791737377721.png", "LOGO-1791737377721.png"]) {
  test(`消さない: ${name}`, () => assert.ok(!RE.test(name)));
}
