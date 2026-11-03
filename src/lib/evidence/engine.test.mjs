/**
 * 根拠エンジンのユニットテスト。
 *
 *     node --test src/lib/evidence/engine.test.mjs
 *
 * ── ★なぜ `.mjs` なのか（2026-09-18）────────────────────────────────────────
 * このリポジトリには**テストランナーが1つも無い**（jest / vitest とも未導入）。
 * Node v26 は `.ts` を素で実行できるので、**依存を1つも足さずに**テストが書ける。
 *
 * ただし `.ts` のテストファイルから `./engine.ts` を import すると、
 * `tsc --noEmit` が **TS5097（allowImportingTsExtensions が必要）** で落ちる。
 * 拡張子を外すと今度は素の Node が解決できない（ERR_MODULE_NOT_FOUND）。
 *   → **`.mjs` なら両方を満たす。** tsconfig の `include` は `.ts` と `.tsx` の
 *     2つだけなので tsc はこのファイルを見ず、Node は `./engine.ts` を
 *     型ストリップして読める。**tsconfig を触らずに済む**のが決め手。
 *
 * ⚠️ 代償として**このファイル自体は型検査されない。** 引数の形を変えたら、
 *    ここも手で直すこと（tsc は教えてくれない）。
 *
 * ⚠️★**テストランナーを新しく入れないこと。** 入れると devDependencies と
 *    設定ファイルが増え、このファイルの存在理由が消える。
 *
 * ── ★このテストが唯一の品質保証である理由 ───────────────────────────────────
 * 実データは **n=1 が最大**（2026-09-18 実測 / docs/phase0-9screens-20260918.md）。
 * **n>=3 の分岐は本番のデータでは一度も踏めない。** ここで踏まないなら、
 * どこでも踏めない。
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidence,
  buildCounterEvidence,
  isProposable,
  sortByEvidenceCount,
  MIN_EVIDENCE_FOR_PROPOSAL,
} from "./engine.ts";
import { MIN_AGGREGATE_COUNT, MIN_REASON_COUNT } from "../constants/aggregate.ts";
import { SHARED_MOTIVE_TEXT } from "./fit.ts";

/** ★本番と同じしきい値（`MIN_AGGREGATE_COUNT`。2026-10-26 に 3 → 5）。定数をそのまま使う */
const OPTS = { minAggregate: MIN_AGGREGATE_COUNT, minReason: MIN_REASON_COUNT };
test("★下限は5人（2026-10-26 / フェーズ1a-3）", () => {
  assert.equal(MIN_AGGREGATE_COUNT, 5);
});
/* ⚠️ かつて `audience` で文面を出し分けていたが、**スナップショットは1つしか
      保存できない**ので企業側に「あなたと同じ」が出ていた。いまは人称を持たない。 */
const BIZ = OPTS;

const EMPTY_FACTS = {
  companyName: "テスト株式会社",
  samePath: null,
  sharedMotive: null,
  preference: null,
};

// ── same_path: n = 0 / 1 / 2 / 3 / 5 ────────────────────────────────────────

test("same_path n=0 … 根拠にしない（「0人が移っています」を出さない）", () => {
  const ev = buildEvidence(
    { ...EMPTY_FACTS, samePath: { n: 0, fromRoleName: "営業", fromIndustryName: null } },
    OPTS,
  );
  assert.equal(ev.length, 0);
});

for (const n of [1, 2, 3, 4]) {
  test(`same_path n=${n} … ★下限未満は根拠ごと出さない`, () => {
    const ev = buildEvidence(
      { ...EMPTY_FACTS, samePath: { n, fromRoleName: "営業", fromIndustryName: "IT・ソフトウェア" } },
      OPTS,
    );
    assert.equal(ev.length, 0);
  });
}

for (const n of [5, 8]) {
  test(`same_path n=${n} … 件数を出す`, () => {
    const ev = buildEvidence(
      { ...EMPTY_FACTS, samePath: { n, fromRoleName: "営業", fromIndustryName: "IT・ソフトウェア" } },
      OPTS,
    );
    assert.equal(ev.length, 1);
    assert.equal(ev[0].kind, "same_path");
    assert.equal(ev[0].n, n);
    assert.match(ev[0].label, new RegExp(`${n}人が移っています`));
    assert.match(ev[0].label, /IT・ソフトウェアの営業/);
    // ★same_path に比率は無い
    assert.equal(ev[0].k, undefined);
  });
}

test("same_path … 職種も業種も解決できなくても件数は出す（既定値で埋めない）", () => {
  const ev = buildEvidence(
    { ...EMPTY_FACTS, samePath: { n: 5, fromRoleName: null, fromIndustryName: null } },
    OPTS,
  );
  assert.equal(ev.length, 1);
  assert.match(ev[0].label, /5人が移っています/);
  // 「他社」「不明」などで埋めていないこと
  assert.doesNotMatch(ev[0].label, /不明|他社|未設定/);
});

// ── shared_motive: ★2026-11-02 から「10人以上・上位3つに入る」だけ。人数も文も保存しない ─────

test("★決め手の下限は10人（MIN_REASON_COUNT）", () => {
  assert.equal(MIN_REASON_COUNT, 10);
});

for (const n of [0, 1, 5, 9]) {
  test(`shared_motive n=${n} … ★下限（10人）未満は根拠ごと出さない`, () => {
    const ev = buildEvidence({ ...EMPTY_FACTS, sharedMotive: { n, matched: true } }, OPTS);
    assert.equal(ev.length, 0);
  });
}

for (const n of [10, 30]) {
  test(`shared_motive n=${n} … ★人数・割合・文を持たない`, () => {
    const ev = buildEvidence({ ...EMPTY_FACTS, sharedMotive: { n, matched: true } }, OPTS);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].kind, "shared_motive");
    assert.equal(ev[0].n, 0);
    assert.equal(ev[0].k, undefined);
    assert.equal(ev[0].label, undefined);
    assert.doesNotMatch(JSON.stringify(ev[0]), new RegExp(`${n}`));
  });
}

test("shared_motive … 上位3つに入っていなければ根拠にしない", () => {
  const ev = buildEvidence({ ...EMPTY_FACTS, sharedMotive: { n: 20, matched: false } }, OPTS);
  assert.equal(ev.length, 0);
});

test("shared_motive の表示は固定の文だけ（保存済みの古い文があっても置き換える）", () => {
  const old = { kind: "shared_motive", n: 5, k: 2, label: "入社の決め手を答えた 5人のうち 2人が「裁量の大きさ」を挙げています" };
  assert.equal(evidenceText(old, "candidate"), SHARED_MOTIVE_TEXT);
  assert.equal(evidenceText(old, "company"), "");
  assert.doesNotMatch(SHARED_MOTIVE_TEXT, /[0-9０-９]|人のうち|割|%|％|「/);
});

/* ⚠️ talkable（話を聞ける人の数）は 2026-10-16 に撤去した（面談OKの撤去） */

// ── preference_match ────────────────────────────────────────────────────────

test("preference_match … 一致0件なら根拠にしない", () => {
  assert.equal(buildEvidence({ ...EMPTY_FACTS, preference: { matchedLabels: [] } }, OPTS).length, 0);
});

test("preference_match … n は人数ではなく一致した条件の数", () => {
  const ev = buildEvidence(
    { ...EMPTY_FACTS, preference: { matchedLabels: ["希望職種", "希望フェーズ", "年収"] } },
    OPTS,
  );
  assert.equal(ev[0].n, 3);
  /* ⚠️★2026-09-21 に文言を変えた。matchCompanyPreference が返すのは
        「一致した項目」で、文ではない。「希望条件と ◯◯ が一致しています」に
        埋めると**二重の文**になり、実際に画面へ
        「希望条件と 希望フェーズ（listed）にマッチ が一致しています」と出ていた。 */
  assert.equal(ev[0].label, "希望職種・希望フェーズ・年収に合っています");
});

// ── ★②と⑨で変わるのは文面だけ ─────────────────────────────────────────────

test("★★ラベルに人称を入れない（②と⑨で同じスナップショットを共有するため）", () => {
  /* ⚠️ この不変条件が破れると、②で作った文が⑨にそのまま出て
        **企業の画面に「あなたと同じ職種から」**と表示される（2026-09-18 に実際に起きた）。
        `ow_proposals.evidence` は1つしか保存できないので、
        **人称を入れた時点で必ずどちらかが間違う。** */
  const facts = {
    companyName: "テスト株式会社",
    samePath: { n: 5, fromRoleName: "営業", fromIndustryName: "IT・ソフトウェア" },
    sharedMotive: { n: 10, matched: true },
    preference: { matchedLabels: ["年収"] },
  };
  for (const e of buildEvidence(facts, OPTS)) {
    assert.doesNotMatch(e.label ?? "", /あなた|この方|御社|貴社/, `人称が入っている: ${e.label}`);
  }
});

test("同じ事実からは同じ根拠が出る（呼び出し側で結果が変わらない）", () => {
  const facts = {
    ...EMPTY_FACTS,
    samePath: { n: 5, fromRoleName: "営業", fromIndustryName: null },
    preference: { matchedLabels: ["年収"] },
  };
  assert.deepEqual(buildEvidence(facts, OPTS), buildEvidence(facts, BIZ));
});

// ── 並び順 ──────────────────────────────────────────────────────────────────

test("根拠は kind の優先順（same_path → shared_motive → preference）", () => {
  const ev = buildEvidence(
    {
      ...EMPTY_FACTS,
      preference: { matchedLabels: ["年収"] },
      sharedMotive: { n: 10, matched: true },
      samePath: { n: 5, fromRoleName: "営業", fromIndustryName: null },
    },
    OPTS,
  );
  assert.deepEqual(ev.map((e) => e.kind), [
    "same_path", "shared_motive", "preference_match",
  ]);
});

test("sortByEvidenceCount … 根拠の本数が多い順、同数は社名で安定", () => {
  const mk = (companyName, count) => ({
    companyName,
    evidence: Array.from({ length: count }, () => ({ kind: "preference_match", n: 1, label: "", sourceQuery: "" })),
  });
  const sorted = sortByEvidenceCount([mk("B社", 2), mk("C社", 4), mk("A社", 2)]);
  assert.deepEqual(sorted.map((r) => r.companyName), ["C社", "A社", "B社"]);
});

// ── isProposable ────────────────────────────────────────────────────────────

test("isProposable … 根拠2件未満は提案に出さない", () => {
  const mk = (count) =>
    Array.from({ length: count }, () => ({ kind: "preference_match", n: 1, label: "", sourceQuery: "" }));
  assert.equal(MIN_EVIDENCE_FOR_PROPOSAL, 2);
  assert.equal(isProposable(mk(0)), false);
  assert.equal(isProposable(mk(1)), false);
  assert.equal(isProposable(mk(2)), true);
  assert.equal(isProposable(mk(5)), true);
});

// ── 反証（必ず1件以上）──────────────────────────────────────────────────────

test("★反証が1件も計算できなければ unknown を返す（省略しない）", () => {
  const ce = buildCounterEvidence({ shortTenure: null, salaryGap: null, workStyleGap: null }, OPTS);
  assert.equal(ce.length, 1);
  assert.equal(ce[0].kind, "unknown");
  assert.match(ce[0].label, /確かめていません/);
});

test("★測ったが該当0件でも unknown になる（0件は反証ではない）", () => {
  const ce = buildCounterEvidence(
    {
      shortTenure: { n: 0, total: 8 },
      salaryGap: { jobMin: 600, jobMax: 900, wantMin: 700, wantMax: 800 },
      workStyleGap: { actual: "hybrid", wanted: ["hybrid"] },
    },
    OPTS,
  );
  assert.equal(ce.length, 1);
  assert.equal(ce[0].kind, "unknown");
});

for (const [total, n] of [[1, 1], [2, 2], [4, 3]]) {
  test(`short_tenure total=${total} … ★下限未満は出さない（unknown になる）`, () => {
    const ce = buildCounterEvidence(
      { shortTenure: { n, total }, salaryGap: null, workStyleGap: null },
      OPTS,
    );
    assert.equal(ce.length, 1);
    assert.equal(ce[0].kind, "unknown");
  });
}

for (const [total, n] of [[5, 1], [8, 3]]) {
  test(`short_tenure total=${total} … 比率を出す`, () => {
    const ce = buildCounterEvidence(
      { shortTenure: { n, total }, salaryGap: null, workStyleGap: null },
      OPTS,
    );
    assert.match(ce[0].label, new RegExp(`${total}人のうち ${n}人`));
  });
}

test("salary_gap … 提示上限が希望下限に届かない", () => {
  const ce = buildCounterEvidence(
    { shortTenure: null, salaryGap: { jobMin: 400, jobMax: 600, wantMin: 800, wantMax: null }, workStyleGap: null },
    OPTS,
  );
  assert.equal(ce[0].kind, "salary_gap");
  assert.match(ce[0].label, /600万円.*800万円/);
});

test("salary_gap … 希望上限を超えている場合も出す", () => {
  const ce = buildCounterEvidence(
    { shortTenure: null, salaryGap: { jobMin: 1200, jobMax: null, wantMin: null, wantMax: 800 }, workStyleGap: null },
    OPTS,
  );
  assert.equal(ce[0].kind, "salary_gap");
});

test("salary_gap … 片側が null なら判定しない（推測で埋めない）", () => {
  const ce = buildCounterEvidence(
    { shortTenure: null, salaryGap: { jobMin: null, jobMax: null, wantMin: 800, wantMax: null }, workStyleGap: null },
    OPTS,
  );
  assert.equal(ce[0].kind, "unknown");
});

test("work_style_gap … 希望と違うときだけ出す", () => {
  const hit = buildCounterEvidence(
    { shortTenure: null, salaryGap: null, workStyleGap: { actual: "原則出社", wanted: ["フルリモート"] } },
    OPTS,
  );
  assert.equal(hit[0].kind, "work_style_gap");

  const miss = buildCounterEvidence(
    { shortTenure: null, salaryGap: null, workStyleGap: { actual: "hybrid", wanted: ["hybrid", "full_remote"] } },
    OPTS,
  );
  assert.equal(miss[0].kind, "unknown");
});

test("反証は複数あればすべて返す", () => {
  const ce = buildCounterEvidence(
    {
      shortTenure: { n: 3, total: 5 },
      salaryGap: { jobMin: 400, jobMax: 600, wantMin: 800, wantMax: null },
      workStyleGap: { actual: "原則出社", wanted: ["フルリモート"] },
    },
    OPTS,
  );
  assert.equal(ce.length, 3);
  assert.deepEqual(ce.map((c) => c.kind), ["short_tenure", "salary_gap", "work_style_gap"]);
});

// ── ★年齢を扱わない（方針の担保）────────────────────────────────────────────

test("★反証の種類に年齢が無い（型にも文字列にも出さない）", () => {
  const cases = [
    { shortTenure: null, salaryGap: null, workStyleGap: null },
    { shortTenure: { n: 3, total: 5 }, salaryGap: null, workStyleGap: null },
  ];
  for (const f of cases) {
    for (const c of buildCounterEvidence(f, BIZ)) {
      assert.doesNotMatch(c.label, /年齢|歳|年代/, "反証に年齢を出さない");
      assert.notEqual(c.kind, "age_gap");
    }
  }
});

// ── ★接点の3種類（2026-10-10）────────────────────────────────────────────────
import { evidenceText, fitText } from "./fit.ts";

const JOB = { kind: "job_role", jobId: "j1", jobTitle: "AE", months: 40 };
const ROLE = { kind: "company_role", companyJobRoleId: "r1", roleName: "IS", departments: ["営業本部"], byExperience: true, byDesired: false };
const TARGET = { kind: "target_industry", industryId: "i1", industryName: "建設" };
const DOMAIN = { kind: "business_domain", domainIds: ["d1"], domainNames: ["CRM・営業支援"] };

test("★業界の経験だけでは提案にならない（顧客の業界でも事業領域でも1件）", () => {
  const ev = buildEvidence({ ...EMPTY_FACTS, fit: { jobRole: null, companyRole: null, industry: TARGET } }, OPTS);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kind, "industry_experience");
  assert.equal(isProposable(ev), false);
});

test("★業界の経験＋ほかの根拠1つで提案になる", () => {
  const ev = buildEvidence({ ...EMPTY_FACTS, preference: { matchedLabels: ["年収"] }, fit: { jobRole: null, companyRole: null, industry: DOMAIN } }, OPTS);
  assert.equal(isProposable(ev), true);
  assert.deepEqual(ev.map((e) => e.kind), ["preference_match", "industry_experience"]);
});

test("★求人の職種＋部門と職種は種類ごとに1件で、2件そろえば提案になる", () => {
  const ev = buildEvidence({ ...EMPTY_FACTS, fit: { jobRole: JOB, companyRole: ROLE, industry: null } }, OPTS);
  assert.deepEqual(ev.map((e) => e.kind), ["job_role", "company_role"]);
  assert.equal(isProposable(ev), true);
});

test("★接点の根拠は文を保存しない（事実だけ）。人称は表示するときに付く", () => {
  const ev = buildEvidence({ ...EMPTY_FACTS, fit: { jobRole: JOB, companyRole: ROLE, industry: TARGET } }, OPTS);
  for (const e of ev) {
    assert.equal(e.label, undefined, "label を保存しない");
    assert.ok(e.fact);
    assert.doesNotMatch(evidenceText(e, "company"), /あなた/);
    assert.doesNotMatch(evidenceText(e, "candidate"), /貴社/);
  }
  assert.equal(fitText(JOB, "company"), "求人『AE』と同じ職種の経験があります（経験3年）");
  assert.equal(fitText(JOB, "candidate"), "あなたの経験と同じ職種の求人『AE』があります（あなたの経験：3年）");
});

test("★既存の種類の文は変わらない（label をそのまま出す）", () => {
  const ev = buildEvidence({ ...EMPTY_FACTS, preference: { matchedLabels: ["年収"] } }, OPTS);
  assert.equal(evidenceText(ev[0], "company"), "年収に合っています");
  assert.equal(evidenceText(ev[0], "candidate"), "年収に合っています");
});

// ── ★具体的な文（2026-10-12）──────────────────────────────────────────────────
test("★経験年数を満たす求人は、何年・何を求めているかまで書く", () => {
  const f = { kind: "job_role", jobId: "j1", jobTitle: "FS", months: 62, requiredYears: 3, roleName: "フィールドセールス" };
  assert.equal(fitText(f, "company"), "フィールドセールスを5年経験（求人『FS』の求める経験：3年以上）");
  assert.doesNotMatch(fitText(f, "candidate"), /貴社/);
});

test("★部門と職種は、候補者側の職種名と会社側の職種名を並べる", () => {
  const f = { kind: "company_role", companyJobRoleId: "r1", roleName: "フィールドセールス", departments: ["営業部"],
    byExperience: false, byDesired: true, desiredRoleName: "フィールドセールス", standardRoleName: "フィールドセールス" };
  assert.equal(fitText(f, "company"), "関心のある職種『フィールドセールス』が、営業部の職種『フィールドセールス』と一致");
  /* 親子で合ったときは「一致」と言わない */
  const parent = { ...f, desiredRoleName: "営業" };
  assert.equal(fitText(parent, "company"), "関心のある職種『営業』が、営業部の職種『フィールドセールス』と同じ系統の職種です");
  assert.doesNotMatch(fitText(f, "candidate"), /貴社/);
});

test("★名前を持たない古い事実は、従来の文のまま", () => {
  assert.equal(fitText(ROLE, "company"), "部門『営業本部』の職種と、経験職種が合っています");
  assert.equal(fitText(JOB, "company"), "求人『AE』と同じ職種の経験があります（経験3年）");
});
