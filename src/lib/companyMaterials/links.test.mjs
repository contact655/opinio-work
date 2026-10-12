import { test } from "node:test";
import assert from "node:assert/strict";
import { materialLinkKind, parseMaterialUrlLines } from "./links.ts";

test("URL の形で種類を見分ける", () => {
  assert.equal(materialLinkKind("https://drive.google.com/file/d/abc/view"), "gdrive");
  assert.equal(materialLinkKind("https://drive.google.com/drive/folders/abc"), "gdrive");
  assert.equal(materialLinkKind("https://docs.google.com/document/d/abc/edit"), "gdoc");
  assert.equal(materialLinkKind("https://docs.google.com/presentation/d/abc/edit"), "gslides");
  assert.equal(materialLinkKind("https://docs.google.com/spreadsheets/d/abc/edit"), "gsheets");
  assert.equal(materialLinkKind("https://docs.google.com/forms/d/e/abc/viewform"), "gforms");
  assert.equal(materialLinkKind("https://forms.gle/abc"), "gforms");
  assert.equal(materialLinkKind("https://www.notion.so/team/Page-123"), "notion");
  assert.equal(materialLinkKind("https://acme.notion.site/Page-123"), "notion");
  assert.equal(materialLinkKind("https://www.youtube.com/watch?v=x"), "youtube");
  assert.equal(materialLinkKind("https://youtu.be/x"), "youtube");
  assert.equal(materialLinkKind("https://example.com/recruit"), "other");
  assert.equal(materialLinkKind("https://notion.so.evil.example.com/"), "other");
  assert.equal(materialLinkKind("not a url"), "other");
});

test("ドライブの mimeType があればそちらを優先する", () => {
  assert.equal(materialLinkKind("https://drive.google.com/file/d/abc", "application/vnd.google-apps.presentation"), "gslides");
  assert.equal(materialLinkKind("https://drive.google.com/file/d/abc", "application/pdf"), "gdrive");
});

test("1行1件・空行は捨てる・重複と http(s) 以外を除く", () => {
  const r = parseMaterialUrlLines(
    " https://a.example/x \n\nhttps://b.example\nftp://c.example\nhttps://a.example/x\njavascript:alert(1)\nhttps://d.example has space\nhttps://old.example\n",
    ["https://old.example"],
  );
  assert.deepEqual(r.valid, ["https://a.example/x", "https://b.example"]);
  assert.deepEqual(r.invalid, ["ftp://c.example", "javascript:alert(1)", "https://d.example has space"]);
  assert.deepEqual(r.duplicate, ["https://a.example/x", "https://old.example"]);
});
