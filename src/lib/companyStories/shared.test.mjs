import { test } from "node:test";
import assert from "node:assert/strict";
import {
  storyTemplate, canReplaceWithTemplate, storyExcerpt, storyMetaLine, storyCategoryLabel,
  storyPublishProblems, formatStoryDate,
} from "./shared.ts";

test("社員インタビューのひな形は指定の4つの見出し", () => {
  assert.equal(storyTemplate("interview"), "## 入社のきっかけ\n\n## 今の仕事\n\n## この会社の好きなところ\n\n## これから一緒に働く人へ\n");
});

test("その他にはひな形が無い", () => {
  assert.equal(storyTemplate("other"), "");
});

test("ひな形を入れてよいのは本文が空か、手を付けていないひな形のときだけ", () => {
  assert.equal(canReplaceWithTemplate(""), true);
  assert.equal(canReplaceWithTemplate("  \n "), true);
  assert.equal(canReplaceWithTemplate(storyTemplate("culture")), true);
  assert.equal(canReplaceWithTemplate(storyTemplate("culture") + "書いた"), false);
  assert.equal(canReplaceWithTemplate("書いた"), false);
});

test("一覧の1行は見出しを飛ばし、記号を落とす", () => {
  assert.equal(storyExcerpt("## 入社のきっかけ\n\n前職では**営業**をしていました。"), "前職では営業をしていました。");
  assert.equal(storyExcerpt("- [リンク](https://x) の話"), "リンク の話");
  assert.equal(storyExcerpt(storyTemplate("interview")), "");
  assert.equal(storyExcerpt("あ".repeat(100), 10), "あ".repeat(10) + "…");
});

test("知らない種類は「その他」と出す（英語の値を出さない）", () => {
  assert.equal(storyCategoryLabel("team"), "その他");
  assert.equal(storyCategoryLabel("interview"), "社員インタビュー");
});

test("日付は日本時間", () => {
  assert.equal(formatStoryDate("2026-07-27T15:30:00Z"), "7月28日");
});

test("一覧の灰色の1行", () => {
  assert.equal(storyMetaLine({ isPublished: true, publishedAt: "2026-07-27T03:00:00Z", updatedAt: "x", views: 120, hasDraft: false }), "公開中・7月27日・閲覧 120");
  assert.equal(storyMetaLine({ isPublished: true, publishedAt: "2026-07-27T03:00:00Z", updatedAt: "x", views: null, hasDraft: true }), "公開中・7月27日・未公開の変更あり");
  assert.equal(storyMetaLine({ isPublished: false, publishedAt: null, updatedAt: "2026-10-12T03:00:00Z", views: 5, hasDraft: false }), "下書き・10月12日更新");
});

test("公開に必要なもの: ひな形のままの本文は書いていない扱い", () => {
  assert.deepEqual(storyPublishProblems({ title: "t", body: storyTemplate("interview") }), ["本文を書いてください。"]);
  assert.deepEqual(storyPublishProblems({ title: " ", body: "本文" }), ["タイトルを入れてください。"]);
  assert.deepEqual(storyPublishProblems({ title: "t", body: "本文" }), []);
});
