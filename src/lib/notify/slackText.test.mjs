import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidSlackWebhookUrl, maskSlackWebhookUrl, buildSlackText } from "./slackText.ts";

test("Webhook の URL は hooks.slack.com だけ", () => {
  assert.equal(isValidSlackWebhookUrl("https://hooks.slack.com/services/T000/B000/XXXXXXXX"), true);
  assert.equal(isValidSlackWebhookUrl("http://hooks.slack.com/services/T/B/X"), false);
  assert.equal(isValidSlackWebhookUrl("https://hooks.slack.com.evil.example/services/T/B/X"), false);
  assert.equal(isValidSlackWebhookUrl("https://hooks.slack.com@evil.example/services"), false);
  assert.equal(isValidSlackWebhookUrl("https://hooks.slack.com/services/T/B/X?x=1"), false);
  assert.equal(isValidSlackWebhookUrl("https://hooks.slack.com/"), false);
  assert.equal(isValidSlackWebhookUrl("https://example.com/services/T/B/X"), false);
});

test("末尾だけ見せる", () => {
  assert.equal(maskSlackWebhookUrl("https://hooks.slack.com/services/T000/B000/abcdef123456"), "https://hooks.slack.com/…123456");
});

test("名前なし・名前あり。本文は入れない", () => {
  assert.equal(buildSlackText({ kind: "reply", candidateName: null, url: "https://opinio.jp/biz/messages/x" }),
    "新しい返信が1件あります\n<https://opinio.jp/biz/messages/x|OPINIO で開く>");
  assert.equal(buildSlackText({ kind: "meeting", candidateName: null, url: "u" }).split("\n")[0], "面談の申込が1件あります");
  assert.equal(buildSlackText({ kind: "application", candidateName: null, url: "u" }).split("\n")[0], "応募が1件あります");
  assert.equal(buildSlackText({ kind: "reply", candidateName: "鈴木 鉄平", url: "u" }).split("\n")[0], "鈴木 鉄平さんから返信がありました");
  assert.equal(buildSlackText({ kind: "application", candidateName: "<b>&", url: "u" }).split("\n")[0], "&lt;b&gt;&amp;さんから応募がありました");
});
