import { test } from "node:test";
import assert from "node:assert/strict";
import { peopleSearchFromPaths, pathsHref, prevCareerHref, prevParams } from "./prevCareer.ts";

const q = (s) => new URLSearchParams(s);

test("旧 /paths の条件を /people の prev_* に付け替える", () => {
  assert.equal(peopleSearchFromPaths(q("")), "");
  assert.equal(peopleSearchFromPaths(q("role=sales")), "?prev_role=sales");
  assert.equal(peopleSearchFromPaths(q("role=sales&industry=it-software")), "?prev_role=sales&prev_industry=it-software");
  assert.equal(peopleSearchFromPaths(q("industry=it-software")), "?prev_industry=it-software");
});

test("会社があれば業界は捨てる", () => {
  assert.equal(peopleSearchFromPaths(q("role=sales&industry=it-software&company=salesforce")), "?prev_role=sales&prev_company=salesforce");
});

test("/people の ?role=（いまの職種）は使わない", () => {
  assert.ok(!/[?&]role=/.test(peopleSearchFromPaths(q("role=sales"))));
});

test("知らないキーと空の値は持ち越さない", () => {
  assert.equal(peopleSearchFromPaths(q("role=&foo=1")), "");
});

const SALES_IT = { role: { slug: "sales", name: "営業" }, industry: { slug: "it", name: "IT" }, company: null };
const SALES_SF = { role: { slug: "sales", name: "営業" }, industry: null, company: { slug: "salesforce", name: "Salesforce" } };

test("未ログイン向けのリンクは /paths のキー、ログイン中向けは /people の prev_*", () => {
  assert.equal(pathsHref(SALES_IT), "/paths?role=sales&industry=it");
  assert.equal(pathsHref(SALES_SF), "/paths?role=sales&company=salesforce");
  assert.equal(prevCareerHref(SALES_IT), "/people?prev_role=sales&prev_industry=it");
  assert.equal(pathsHref({ role: null, industry: null, company: null }), "/paths");
});

test("prevParams は会社があると業界を空にする（URL から消す）", () => {
  assert.deepEqual(prevParams({ role: "sales", industry: "it", company: "sf" }), { prev_role: "sales", prev_company: "sf", prev_industry: "" });
});
