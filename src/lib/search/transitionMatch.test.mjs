import { test } from "node:test";
import assert from "node:assert/strict";
import { matchTransition, summarizeMoves, toMoveSummaryCounts } from "./transitionMatch.ts";

const IT = "it", FIN = "fin", MK = "mk";
const NAME = { it: "IT・インターネット", fin: "金融", mk: "メーカー" };
let n = 0;
const E = (o) => ({ id: `e${n++}`, key: o.companyId ?? `t:${n}`, companyId: null, endedAt: null, isCurrent: false, industryParentId: null, isForeign: false, roleIds: [], ...o });

const finToIt = [
  E({ companyId: "bank", startedAt: "2015-04-01", endedAt: "2019-03-01", industryParentId: FIN, roleIds: ["sales"] }),
  E({ companyId: "saas", startedAt: "2019-04-01", isCurrent: true, industryParentId: IT, isForeign: true, roleIds: ["sales"] }),
];
const itToIt = [
  E({ companyId: "a", startedAt: "2015-04-01", endedAt: "2019-03-01", industryParentId: IT, roleIds: ["eng"] }),
  E({ companyId: "b", startedAt: "2019-04-01", isCurrent: true, industryParentId: IT, roleIds: ["sales"] }),
];
const notIT = { industryId: IT, industryLabel: "IT・インターネット", notIndustry: true };

test("「IT以外から来た」は IT 以外 → IT の移動だけ（もう片側は反対）", () => {
  const intent = { kind: "move", from: notIT, label: "" };
  assert.ok(matchTransition(finToIt, intent));
  assert.equal(matchTransition(itToIt, intent), null);
});

test("「未経験から営業」は営業の職歴が初めての移動だけ", () => {
  const intent = { kind: "move", to: { roleIds: ["sales"], roleLabel: "営業" }, firstTime: "role", label: "" };
  assert.ok(matchTransition(itToIt, intent)); // エンジニア → 営業
  assert.equal(matchTransition(finToIt, intent), null); // 前も営業
});

test("「未経験から外資IT」は IT が初めてで、移った先が外資の IT", () => {
  const intent = { kind: "move", to: { industryId: IT, industryLabel: "IT", foreign: true }, firstTime: "industry", label: "" };
  assert.ok(matchTransition(finToIt, intent));
  assert.equal(matchTransition(itToIt, intent), null);
});

test("「異業界に移った」は業界の大分類が変わった移動。業界が分からない職歴は数えない", () => {
  const intent = { kind: "move", crossIndustry: true, label: "" };
  assert.ok(matchTransition(finToIt, intent));
  assert.equal(matchTransition(itToIt, intent), null);
  const unknown = [E({ companyId: null, key: "free", startedAt: "2015-04-01", endedAt: "2018-03-01" }), finToIt[1]];
  assert.equal(matchTransition(unknown, intent), null);
});

test("同じ会社の中の異動は移動にしない", () => {
  const same = [
    E({ companyId: "x", startedAt: "2015-04-01", endedAt: "2018-03-01", industryParentId: FIN, roleIds: ["eng"] }),
    E({ companyId: "x", startedAt: "2018-04-01", isCurrent: true, industryParentId: FIN, roleIds: ["sales"] }),
  ];
  assert.equal(matchTransition(same, { kind: "move", to: { roleIds: ["sales"] }, firstTime: "role", label: "" }), null);
});

test("「Salesforceを出て事業会社に行った」は出た直後の会社が IT 以外のときだけ。在籍中は当てない", () => {
  const intent = { kind: "left", companyId: "sf", companyLabel: "Salesforce", to: notIT, label: "" };
  const toFin = [
    E({ companyId: "sf", startedAt: "2015-04-01", endedAt: "2019-03-01", industryParentId: IT }),
    E({ companyId: "bank", startedAt: "2019-04-01", isCurrent: true, industryParentId: FIN }),
  ];
  const toIt = [toFin[0], E({ companyId: "saas", startedAt: "2019-04-01", isCurrent: true, industryParentId: IT })];
  const still = [E({ companyId: "sf", startedAt: "2015-04-01", isCurrent: true, industryParentId: IT })];
  assert.ok(matchTransition(toFin, intent));
  assert.equal(matchTransition(toIt, intent), null);
  assert.equal(matchTransition(still, intent), null);
});

test("★移動の集計は業界の大分類だけで、3人未満の項目は null。個人・会社を特定できる値を含まない", () => {
  const m = (from, to) => ({ prev: E({ companyId: `co-${n}`, startedAt: "2015-04-01", industryParentId: from }), cur: E({ companyId: `co-${n}`, startedAt: "2019-04-01", industryParentId: to }) });
  assert.equal(summarizeMoves([m(FIN, IT), m(MK, IT)], (id) => NAME[id], 3), null);
  const s = summarizeMoves([m(FIN, IT), m(MK, IT), m(FIN, IT)], (id) => NAME[id], 3);
  assert.deepEqual(s, {
    people: 3,
    from: { known: 3, byIndustry: [{ label: "金融", count: 2 }, { label: "メーカー", count: 1 }] },
    to: { known: 3, byIndustry: [{ label: "IT・インターネット", count: 3 }] },
  });
  const json = JSON.stringify(s);
  for (const bad of ["co-", "e", "2015", "2019"].filter((b) => b !== "e")) assert.ok(!json.includes(bad), `返り値に ${bad}`);
  assert.ok(!/"id"|companyId|startedAt|userId/.test(json));
  /* 未ログインには件数だけ */
  assert.deepEqual(toMoveSummaryCounts(s), { people: 3, from: { known: 3 }, to: { known: 3 } });
});
