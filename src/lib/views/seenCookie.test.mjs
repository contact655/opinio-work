import { test } from "node:test";
import assert from "node:assert/strict";
import { pageKey, parseSeen, serializeSeen } from "./seenCookie.ts";

const ID = "4bcc4848-e33a-4d10-8e5f-eeff20a0ca8f";

test("種類ごとに頭の1文字が違う（ストーリーは s）", () => {
  assert.equal(pageKey("company", ID), "c4bcc4848e33a");
  assert.equal(pageKey("job", ID), "j4bcc4848e33a");
  assert.equal(pageKey("story", ID), "s4bcc4848e33a");
});

test("ストーリーの印も読み戻せる。知らない形は捨てる", () => {
  const raw = serializeSeen("20261012", ["c4bcc4848e33a", "s4bcc4848e33a", "x4bcc4848e33a"]);
  assert.deepEqual(parseSeen(raw, "20261012"), ["c4bcc4848e33a", "s4bcc4848e33a"]);
  assert.deepEqual(parseSeen(raw, "20261013"), []);
});
