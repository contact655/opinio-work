import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCompanyFlow, hasAnyFlowItem } from "./compute.ts";

const C = "co-target";
const L = { industry: (id) => ({ maker: "メーカー", fin: "金融", it: "IT・インターネット" })[id] ?? id, role: (id) => ({ is: "インサイドセールス", ae: "アカウントエグゼクティブ" })[id] ?? id, reason: (k) => k };
const OPT = { minCareerFact: 3, minAnswer: 5, fitGoodMin: 4, now: new Date(2026, 9, 27) };
const X = (o) => ({ companyId: null, endedAt: null, isCurrent: false, roleCategoryId: null, industryParentId: null, ...o });

/** 1人分: 前職 → この会社 → 行き先 */
function person(u, { prevInd = "maker", nextInd = "it", alumni = true, roles = ["is"] } = {}) {
  const rows = [X({ userId: u, companyId: "prev-" + u, startedAt: "2015-04-01", endedAt: "2018-03-01", industryParentId: prevInd })];
  roles.forEach((r, i) => rows.push(X({ userId: u, companyId: C, startedAt: `${2018 + i}-04-01`, endedAt: alumni || i < roles.length - 1 ? `${2019 + i}-03-01` : null, isCurrent: !alumni && i === roles.length - 1, roleCategoryId: r })));
  if (alumni) rows.push(X({ userId: u, companyId: "next-" + u, startedAt: `${2019 + roles.length - 1}-04-01`, isCurrent: true, industryParentId: nextInd }));
  return rows;
}

const ALLOWED_KEYS = new Set(["people", "previous", "next", "tenure", "roleChanges", "decisiveTop", "fitAfterYear",
  "known", "byIndustry", "label", "count", "alumni", "avgMonths", "paths", "respondents", "top", "goodShare"]);

function keysDeep(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); }
  return out;
}

test("3人以上で経歴の項目が出る。業界の大分類で数える", () => {
  const exps = [...person("a", { prevInd: "maker" }), ...person("b", { prevInd: "fin" }), ...person("c", { prevInd: "maker" })];
  const f = computeCompanyFlow(C, exps, [], L, OPT);
  assert.equal(f.people, 3);
  assert.deepEqual(f.previous, { known: 3, byIndustry: [{ label: "メーカー", count: 2 }, { label: "金融", count: 1 }] });
  assert.deepEqual(f.next, { known: 3, byIndustry: [{ label: "IT・インターネット", count: 3 }] });
  assert.equal(f.tenure.alumni, 3);
  assert.equal(f.tenure.avgMonths, 12); // 2018-04〜2019-03
  assert.ok(hasAnyFlowItem(f));
});

test("2人以下の項目は null。何も出せなければ見出しごと出さない", () => {
  const f = computeCompanyFlow(C, [...person("a"), ...person("b")], [], L, OPT);
  assert.equal(f.previous, null);
  assert.equal(f.next, null);
  assert.equal(f.tenure, null);
  assert.equal(hasAnyFlowItem(f), false);
  assert.equal(computeCompanyFlow(C, [], [], L, OPT), null);
});

test("業界まで辿れない人は「不明」にせず母数から外す", () => {
  const exps = [...person("a"), ...person("b"), ...person("c", { prevInd: null })];
  const f = computeCompanyFlow(C, exps, [], L, OPT);
  assert.equal(f.previous, null); // 辿れたのは2人
  assert.equal(f.next.known, 3);
});

test("社内の職種の変化は細かい職種で数える", () => {
  const exps = ["a", "b", "c"].flatMap((u) => person(u, { roles: ["is", "ae"] }));
  const f = computeCompanyFlow(C, exps, [], L, OPT);
  assert.deepEqual(f.roleChanges, { people: 3, paths: [{ label: "インサイドセールス → アカウントエグゼクティブ", count: 3 }] });
});

test("回答の項目は5人以上で出る（4人なら出ない）", () => {
  const T = (r, fit) => ({ decisiveReasons: r, fitAfterYear: fit });
  const four = [T(["skills"], 5), T(["skills", "salary"], 4), T(["people"], 2), T(["skills"], 1)];
  assert.equal(computeCompanyFlow(C, person("a"), four, L, OPT).decisiveTop, null);
  assert.equal(computeCompanyFlow(C, person("a"), four, L, OPT).fitAfterYear, null);
  const five = [...four, T(["salary"], 4)];
  const f = computeCompanyFlow(C, person("a"), five, L, OPT);
  /* ★行ごとにも5人の下限。5人答えても、5人に届く決め手が無ければ項目ごと出さない */
  assert.equal(f.decisiveTop, null);
  assert.deepEqual(f.fitAfterYear, { respondents: 5, goodShare: 60 });
  const six = [T(["skills", "salary"], 5), T(["skills"], 4), T(["skills", "people"], 4), T(["skills"], 2), T(["skills", "salary"], 4), T(["salary"], 1)];
  assert.deepEqual(computeCompanyFlow(C, person("a"), six, L, OPT).decisiveTop, { respondents: 6, top: [{ label: "skills", count: 5 }] });
});

test("★返す形に、個人を特定できる値（user_id・会社 id・個別の期間）が入らない", () => {
  const exps = ["user-aaa", "user-bbb", "user-ccc", "user-ddd", "user-eee"].flatMap((u) => person(u, { roles: ["is", "ae"] }));
  const turns = Array.from({ length: 5 }, () => ({ decisiveReasons: ["skills"], fitAfterYear: 5 }));
  const f = computeCompanyFlow(C, exps, turns, L, OPT);
  const keys = keysDeep(f);
  for (const k of keys) assert.ok(ALLOWED_KEYS.has(k), `許可していないキー: ${k}`);
  const json = JSON.stringify(f);
  for (const bad of ["user-", "prev-", "next-", C, "2018-", "2019-", "startedAt", "endedAt", "userId"]) {
    assert.ok(!json.includes(bad), `返り値に ${bad} が含まれている`);
  }
});

test("★ログインしていない人向けの形は件数だけ（内訳・平均・割合を含まない）", async () => {
  const { toFlowSummary } = await import("./compute.ts");
  const exps = ["a", "b", "c"].flatMap((u) => person(u, { roles: ["is", "ae"] }));
  const turns = Array.from({ length: 5 }, () => ({ decisiveReasons: ["skills"], fitAfterYear: 5 }));
  const s = toFlowSummary(computeCompanyFlow(C, exps, turns, L, OPT));
  const keys = keysDeep(s);
  for (const k of ["byIndustry", "paths", "top", "avgMonths", "goodShare", "label"]) assert.ok(!keys.has(k), `件数だけの形に ${k} がある`);
  assert.deepEqual(s, { people: 3, previous: { known: 3 }, next: { known: 3 }, tenure: { alumni: 3 }, roleChanges: { people: 3 }, decisiveTop: { respondents: 5 }, fitAfterYear: { respondents: 5 } });
});

test("★検索の「出た人」の集計：OB が3人以上で出る。行き先は業界・職種の大分類。個人を特定できる値が入らない", async () => {
  const { computeLeaverSummary, toLeaverSummaryCounts } = await import("./compute.ts");
  const L2 = { industry: L.industry, roleTop: (id) => ({ is: "営業", ae: "営業" })[id] ?? "" };
  const next = (u, ind, role) => [
    X({ userId: u, companyId: C, startedAt: "2018-04-01", endedAt: "2020-03-01", roleCategoryId: "ae" }),
    X({ userId: u, companyId: "next-" + u, startedAt: "2020-04-01", isCurrent: true, industryParentId: ind, roleCategoryId: role }),
  ];
  const two = [...next("user-a", "it", "is"), ...next("user-b", "fin", "ae")];
  assert.equal(computeLeaverSummary(C, two, L2, OPT), null);
  /* 現役は数えない */
  const withCurrent = [...two, X({ userId: "user-c", companyId: C, startedAt: "2019-04-01", isCurrent: true })];
  assert.equal(computeLeaverSummary(C, withCurrent, L2, OPT), null);
  const three = [...two, ...next("user-d", "it", "is")];
  const s = computeLeaverSummary(C, three, L2, OPT);
  assert.deepEqual(s, {
    alumni: 3,
    tenure: { alumni: 3, avgMonths: 24 },
    next: { known: 3, byIndustry: [{ label: "IT・インターネット", count: 2 }, { label: "金融", count: 1 }] },
    nextRoles: { known: 3, byRole: [{ label: "営業", count: 3 }] },
  });
  const allowed = new Set(["alumni", "tenure", "avgMonths", "next", "known", "byIndustry", "label", "count", "nextRoles", "byRole"]);
  for (const k of keysDeep(s)) assert.ok(allowed.has(k), `許可していないキー: ${k}`);
  const json = JSON.stringify(s);
  for (const bad of ["user-", "next-", C, "2018-", "2020-"]) assert.ok(!json.includes(bad), `返り値に ${bad} が含まれている`);
  /* 未ログインには件数だけ */
  const counts = toLeaverSummaryCounts(s);
  assert.deepEqual(counts, { alumni: 3, tenure: { alumni: 3 }, next: { known: 3 }, nextRoles: { known: 3 } });
  for (const k of ["byIndustry", "byRole", "avgMonths", "label"]) assert.ok(!keysDeep(counts).has(k), `件数だけの形に ${k} がある`);
});

test("★学校を出た人の「いま」：業界・職種の大分類で、3人以上の項目だけ。会社名を持たない", async () => {
  const { computeCurrentDestinations } = await import("./compute.ts");
  const R = (u, ind, role) => ({ userId: u, industryParentId: ind, roleTopLabel: role });
  assert.equal(computeCurrentDestinations([R("u1", "it", "営業"), R("u2", "fin", "営業")], L.industry, 3), null);
  const d = computeCurrentDestinations([R("u1", "it", "営業"), R("u2", "fin", "営業"), R("u3", "it", null), R("u3", "it", null)], L.industry, 3);
  /* 同じ人の現職が2つあっても業界ごとに1回。職種が分かるのは2人なので職種は出さない */
  assert.deepEqual(d, { industries: { known: 3, byIndustry: [{ label: "IT・インターネット", count: 2 }, { label: "金融", count: 1 }] }, roles: null });
  assert.ok(!/u1|u2|u3|companyId|href|logo/.test(JSON.stringify(d)));
});
