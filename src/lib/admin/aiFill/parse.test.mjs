/**
 * 運営の「AIで埋める」の読み取りのテスト。  node --test src/lib/admin/aiFill/parse.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseAiFillAnswer, splitList, isNoneAnswer } from "./parse.ts";

const KEYS = ["remote_work_status", "benefits", "work_time_system", "business_domains_secondary"];

test("正しい形式は4項目すべて読める", () => {
  const { found, missing } = parseAiFillAnswer([
    "[remote_work_status] ハイブリッド（週2-3日出社） | https://example.com/careers",
    "[benefits] フレックスタイム制、書籍購入補助（年5万円まで） | https://example.com/benefits",
    "[work_time_system] フレックスタイム制（コアタイムなし） | https://example.com/work",
    "[business_domains_secondary] HR Tech、業務効率化 | https://example.com/",
  ].join("\n"), KEYS);
  assert.equal(Object.keys(found).length, 4);
  assert.equal(missing.length, 0);
  assert.deepEqual(found.remote_work_status, { raw: "ハイブリッド（週2-3日出社）", url: "https://example.com/careers", unknown: false });
});

test("崩れた形式: 全角・区切りなし・URL なし・抜け", () => {
  const { found, missing } = parseAiFillAnswer([
    "以下が回答です",
    "**【REMOTE_WORK_STATUS】 フルリモート可 （出典：https://x.jp/a）**",
    "[benefits]: 書籍補助、ジム補助",
    "work_time_system: フレックス",   // [ ] が無い → 読めない
  ].join("\n"), KEYS);
  assert.equal(found.remote_work_status.raw.startsWith("フルリモート可"), true);
  assert.equal(found.remote_work_status.url, "https://x.jp/a");
  assert.equal(found.benefits.url, null);
  assert.deepEqual(missing.sort(), ["business_domains_secondary", "work_time_system"]);
});

test("「不明」は値なし", () => {
  const { found } = parseAiFillAnswer("[work_time_system] 不明\n[benefits] 不明 | https://x.jp", KEYS);
  assert.equal(found.work_time_system.unknown, true);
  assert.equal(found.benefits.unknown, true);
  assert.equal(found.benefits.raw, "");
});

test("一覧の分割と（補足）", () => {
  assert.deepEqual(splitList("A、B（年5万円）, C"), [{ name: "A" }, { name: "B", detail: "年5万円" }, { name: "C" }]);
  assert.equal(isNoneAnswer("該当なし"), true);
});
