#!/usr/bin/env node
/**
 * TS の `normalizeCompanyName()` と DB の `normalize_company_name()` が
 * **同じ結果を返すか**を突き合わせる。
 *
 *   node scripts/check-name-normalize.mjs --self-test   ★先にこれ
 *   node scripts/check-name-normalize.mjs
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * 企業検索は `ow_companies.search_key`（DB が正規化）に対して、
 * TS が正規化した検索語で `ilike` する。**規則が割れると検索が静かに外れる**
 * （エラーにならず「0件」に見えるだけ）。
 *
 * ⚠️★`--self-test` を先に通すこと。わざと崩した実装を当てて、
 *    **検出器が実際に落ちること**を確かめてから本番の照合を信じる
 *    （.claude/rules/ui-debugging.md ⑱ / check-columns.mjs と同じ作法）。
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TS_FILE = path.join(ROOT, "src/lib/companies/normalizeName.ts");

/**
 * TS 実装を素の JS として読み込む。
 * ⚠️★**自前で型注釈を剥がさない。** 以前は正規表現で削っていて、
 *    実装に手を入れるたびに**照合スクリプトの側が壊れた**（2026-10-01 に踏んだ）。
 *    リポジトリに入っている `typescript` で普通にトランスパイルする。
 */
async function loadTs(source) {
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return await import("data:text/javascript," + encodeURIComponent(js));
}

function env() {
  const e = Object.fromEntries(
    fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return e;
}

/** 入力の揺れの見本。⚠️ 実際に外れていたものを必ず含めること */
const SAMPLES = [
  "セールスフォース", "せーるすふぉーす", "ｾｰﾙｽﾌｫｰｽ", "ＳＡＬＥＳＦＯＲＣＥ",
  "セールスフォースジャパン", "株式会社セールスフォース・ジャパン",
  "ヒューレット・パッカード", "ひゅーれっとぱっかーど", "日本ヒューレット・パッカード合同会社",
  "ぴぼっと", "ピヴォット", "PIVOT株式会社", "Ｐｉｖｏｔ",
  "まいなび", "Mynavi Corporation", "㈱テスト", "（株）テスト", "有限会社テスト",
  "Datadog Japan合同会社", "Notion Labs Japan合同会社", "KnowBe4 Japan合同会社",
  "ＡＢＣ－１２３", "A B C", "コーヒー", "こーひー", "ｳﾞｧｲｵﾚｯﾄ", "ヴァイオレット",
  "Salesforce, Inc.", "Acme Co., Ltd.", "Acme LLC", "一般社団法人テスト",
  "", "   ", "株式会社", "・・・",
];

async function main() {
  const selfTest = process.argv.includes("--self-test");
  const e = env();
  const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY);

  let source = fs.readFileSync(TS_FILE, "utf8");
  if (selfTest) {
    // ★わざと崩す: 長音「ー」を落とす集合に足す（CLAUDE.md が禁じている改変）
    const before = source;
    source = source.replace("‐‑‒–—―−－-]/;", "‐‑‒–—―−－\u30FC-]/;");
    if (source === before) { console.error("自己テストの改変が当たらなかった（STRIP_CHARS の字面が変わった？）"); process.exit(1); }
  }
  const mod = await loadTs(source);
  const normalizeTs = mod.normalizeCompanyName;
  const normalizeWithMap = mod.normalizeWithMap;

  // 実データ（社名・英語名・ブランド名・別名）＋ 見本
  const { data: rows, error } = await db.from("ow_companies").select("name, name_en, brand_name, slug, search_aliases");
  if (error) { console.error("企業の取得に失敗:", error.message); process.exit(1); }
  const inputs = new Set(SAMPLES);
  for (const r of rows ?? []) for (const v of [r.name, r.name_en, r.brand_name, r.slug, r.search_aliases]) if (v) inputs.add(v);
  const list = [...inputs];

  const mismatches = [];
  for (const q of list) {
    const { data: sql, error: e2 } = await db.rpc("normalize_company_name", { p_name: q });
    if (e2) { console.error("RPC 失敗:", e2.message); process.exit(1); }
    const ts = normalizeTs(q);
    if ((sql ?? null) !== (ts ?? null)) mismatches.push({ q, sql: sql ?? "(null)", ts: ts ?? "(null)" });
    /* ⚠️ 強調に使う `normalizeWithMap` が、値としても同じであること */
    const mapped = normalizeWithMap(q).value || null;
    if (mapped !== (ts ?? null)) mismatches.push({ q, sql: `withMap=[${mapped}]`, ts: ts ?? "(null)" });
  }

  console.log(`照合 ${list.length} 件（実データ ${list.length - SAMPLES.length} ＋ 見本 ${SAMPLES.length}）`);
  if (mismatches.length === 0) {
    if (selfTest) { console.error("★自己テストが素通りした。検出器が効いていない"); process.exit(1); }
    console.log("食い違い: 0 件");
    return;
  }
  console.log(`食い違い: ${mismatches.length} 件`);
  for (const m of mismatches.slice(0, 12)) console.log(`  [${m.q}]  SQL=[${m.sql}]  TS=[${m.ts}]`);
  if (selfTest) { console.log("\n★自己テストは落ちるのが正常。検出器は効いている。"); return; }
  process.exit(1);
}
main();
