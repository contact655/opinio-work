import { test } from "node:test";
import assert from "node:assert/strict";
import { isHeadingLine, formatJobBody } from "./jobBody.ts";

test("短い「■」の行と【…】の行だけを見出しにする", () => {
  assert.equal(isHeadingLine("■ このポジションについて"), true);
  assert.equal(isHeadingLine("■ 評価・年収・働き方"), true);
  assert.equal(isHeadingLine("【必須】"), true);
  assert.equal(isHeadingLine("■受託案件の運用に関する顧客マネジメント■電力業界"), false);
  assert.equal(isHeadingLine("【業務概要】■アグリゲーター営業"), false);
  assert.equal(isHeadingLine("■"), false);
  assert.equal(isHeadingLine("Salesforce開発案件において、"), false);
});

test("見出し・箇条書き・強制改行に整える", () => {
  const src = "■ このポジションについて\nSalesforce開発案件において、\n一気通貫で担当します。\n\n■ 業務内容\n・要件定義\n・実装\n　テストまで\n本文";
  assert.equal(
    formatJobBody(src),
    [
      "## ■ このポジションについて",
      "",
      "Salesforce開発案件において、  ",
      "一気通貫で担当します。",
      "",
      "## ■ 業務内容",
      "",
      "- 要件定義  ",
      "- 実装  ",
      "テストまで",
      "",
      "本文",
    ].join("\n"),
  );
});

test("見出しも「・」も無い文は改行だけを強制改行にする", () => {
  assert.equal(formatJobBody("一行目\n二行目\n\n三行目"), "一行目  \n二行目\n\n三行目");
});
