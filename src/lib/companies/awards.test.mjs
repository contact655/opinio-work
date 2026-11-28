import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAwards, sortAwards, parseHttpsUrl } from "./awards.ts";
import { parseDecks, deckDomain } from "./companyDecks.ts";

test("受賞・認定：必須項目と https", () => {
  assert.deepEqual(parseAwards([{ name: " くるみん認定 ", issuer: "厚生労働省", year: "2024", url: "" }]),
    { ok: true, items: [{ name: "くるみん認定", issuer: "厚生労働省", year: 2024, url: null }] });
  assert.equal(parseAwards([{ name: "A", issuer: "", year: "2024", url: "" }]).ok, false);
  assert.equal(parseAwards([{ name: "A", issuer: "B", year: "24", url: "" }]).ok, false);
  assert.equal(parseAwards([{ name: "A", issuer: "B", year: "2024", url: "http://x.jp" }]).ok, false);
  assert.equal(parseAwards([{ name: "A", issuer: "B", year: "2024", url: "javascript:alert(1)" }]).ok, false);
  assert.deepEqual(parseAwards([{ name: "", issuer: "", year: "", url: "" }]), { ok: true, items: [] });
});

test("受賞・認定：新しい年から順に、同じ年は入力順", () => {
  const s = sortAwards([{ year: 2020, n: "a" }, { year: 2026, n: "b" }, { year: 2020, n: "c" }]);
  assert.deepEqual(s.map((x) => x.n), ["b", "a", "c"]);
});

test("https の URL", () => {
  assert.equal(parseHttpsUrl(""), null);
  assert.equal(parseHttpsUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(parseHttpsUrl("ftp://example.com"), undefined);
});

test("会社紹介資料：3件まで・タイトルと https の URL が必須", () => {
  const ok = parseDecks([{ title: "採用ピッチ資料", url: "https://speakerdeck.com/x/y" }]);
  assert.deepEqual(ok, { ok: true, items: [{ title: "採用ピッチ資料", url: "https://speakerdeck.com/x/y" }] });
  assert.equal(parseDecks([{ title: "", url: "https://a.jp" }]).ok, false);
  assert.equal(parseDecks([{ title: "A", url: "http://a.jp" }]).ok, false);
  const four = Array.from({ length: 4 }, (_, i) => ({ title: `T${i}`, url: "https://a.jp" }));
  assert.equal(parseDecks(four).ok, false);
  assert.equal(deckDomain("https://www.speakerdeck.com/x"), "speakerdeck.com");
});
