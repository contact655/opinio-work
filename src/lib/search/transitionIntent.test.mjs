import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTransition, industryTermsFor } from "./transitionIntent.ts";

const IT = "it-id";
const IND = [
  { id: IT, name: "IT・インターネット", terms: industryTermsFor("IT・インターネット") },
  { id: "fin-id", name: "金融", terms: industryTermsFor("金融") },
  { id: "mk-id", name: "メーカー", terms: industryTermsFor("メーカー") },
];
const SF = { companyId: "sf", label: "Salesforce" };

/** 社名・職種・外資の位置を手で与えて読む（interpretQuery と同じ形） */
function parse(q, { company, role, foreign, moves = true } = {}) {
  const companies = [];
  const roles = [];
  const consumed = [];
  if (company) {
    const i = q.indexOf(company);
    companies.push({ span: { start: i, end: i + company.length }, ...SF });
    consumed.push({ start: i, end: i + company.length });
  }
  if (role) {
    const i = q.indexOf(role.word);
    roles.push({ span: { start: i, end: i + role.word.length }, roleIds: role.ids, label: role.label, index: 0 });
    consumed.push({ start: i, end: i + role.word.length });
  }
  let f = null;
  if (foreign) {
    const i = q.indexOf(foreign);
    f = { span: { start: i, end: i + foreign.length }, isForeign: true, index: 1 };
    consumed.push(f.span);
  }
  return parseTransition({ normalized: q, companies, roles, foreign: f, industries: IND, itIndustryId: IT, consumed, moves });
}

test("「出た」「出身」「から転職」「元」は同じ left（その会社の職歴が全部終わっている人）", () => {
  for (const q of ["salesforceを出た人", "salesforce出身の人", "salesforceから転職した人", "salesforceから来た人", "元salesforceの人", "salesforceを辞めた人"]) {
    const r = parse(q, { company: "salesforce" });
    assert.equal(r.intent?.kind, "left", q);
    assert.equal(r.intent.label, "Salesforceを出た人", q);
  }
});

test("社名だけなら移動にしない", () => {
  assert.equal(parse("salesforceの人", { company: "salesforce" }).intent, null);
});

test("「入った人の前職」は prevOf（検索では出さず企業ページへ案内）", () => {
  const r = parse("salesforceに入った人の前職", { company: "salesforce" });
  assert.equal(r.intent?.kind, "prevOf");
});

test("「出て事業会社のカスタマーサクセスに行った」は行き先つきの left。職種の条件は行き先に吸い込む", () => {
  const r = parse("salesforceを出て事業会社のカスタマーサクセスに行った人", {
    company: "salesforce", role: { word: "カスタマーサクセス", ids: ["cs"], label: "カスタマーサクセス" },
  });
  assert.equal(r.intent?.kind, "left");
  assert.deepEqual(r.intent.to, { industryId: IT, industryLabel: "IT・インターネット", notIndustry: true, roleIds: ["cs"], roleLabel: "カスタマーサクセス" });
  assert.deepEqual(r.absorbedConditionIndexes, [0]);
});

test("「IT以外から来た人」は 移る前＝IT以外 の move", () => {
  const r = parse("it以外から来た人");
  assert.equal(r.intent?.kind, "move");
  assert.deepEqual(r.intent.from, { industryId: IT, industryLabel: "IT・インターネット", notIndustry: true });
  assert.equal(r.intent.to, undefined);
});

test("「未経験から」は後ろの言葉で決める：職種なら職種の未経験、業界・外資なら業界の未経験", () => {
  const role = parse("未経験から営業", { role: { word: "営業", ids: ["sales"], label: "営業" } });
  assert.equal(role.intent?.firstTime, "role");
  const ind = parse("未経験から外資itに入った人", { foreign: "外資" });
  assert.equal(ind.intent?.firstTime, "industry");
  assert.equal(ind.intent.to.foreign, true);
  assert.equal(ind.intent.to.industryId, IT);
  /* 「未経験から」だけでは何の未経験か決まらないので読まない */
  assert.equal(parse("未経験からの人").intent, null);
});

test("年齢は読まずに読めなかった語として返す。「異業界に移った」は業界をまたいだ移動", () => {
  const r = parse("30歳を過ぎて異業界に移った人");
  assert.equal(r.intent?.kind, "move");
  assert.equal(r.intent.crossIndustry, true);
  assert.deepEqual(r.ageSpans, [{ start: 0, end: 7 }]);
});

test("業界の語は移動の文の中でだけ読む（「金融の人」は移動にしない）", () => {
  assert.equal(parse("金融の人").intent, null);
});

test("英字の「it」は単語の途中で拾わない", () => {
  assert.equal(parse("digitから来た人").intent, null);
});

test("moves=false のときは会社を指定しない移動を読まない", () => {
  assert.equal(parse("it以外から来た人", { moves: false }).intent, null);
  assert.equal(parse("salesforceを出た人", { company: "salesforce", moves: false }).intent?.kind, "left");
});
