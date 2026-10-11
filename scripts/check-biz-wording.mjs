#!/usr/bin/env node
/**
 * ★企業側の画面・メール・通知・ヘルプに「提案」「紹介」が出ていないかを数える（2026-10-11 / 柴さんの指示）。
 *   「提案」→「紹介」と言い換えたあと、同日に「紹介」もやめた（人材紹介と紛らわしいため）。
 *   企業側では「OPINIO のおすすめ」「貴社に興味がある方」と書く。仕組み・URL・DB・コード内の名前は変えていない。
 *   ⚠️ 数えない語: 自己紹介・会社紹介・人材紹介（別の意味の決まった語）、提案営業（職種名）。運営の /admin は対象外。
 *
 *   node scripts/check-biz-wording.mjs              # 0件なら exit 0
 *   node scripts/check-biz-wording.mjs --self-test  # わざと1か所入れて、検出されることを確かめる
 *   node scripts/check-biz-wording.mjs --jobseeker  # 求職者側（2026-10-11。「あなたに合いそうな会社」「ご紹介」と言い換えた）
 *     ⚠️ 求職者側は運営だけが見るエラー（提案を作る処理）とサーバーのログ（console.*）を数えない
 *
 * 見る場所: src/app/biz ・ src/app/business ・ src/components/business ・ src/lib/business ・ src/app/api/biz（返すエラー文）
 *          ・企業向けのメール（src/lib/notify の企業宛て）
 * 見るもの: コメントを落としたうえで、文字列リテラル・テンプレート・JSX のテキストに入った「提案」。
 *   ⚠️ 識別子（proposal…）・import のパス・URL（/biz/proposals）は対象外（画面に出ない）。
 *   ⚠️ 求職者向けのメールは対象外（`EXCLUDE_FN` の関数の中は見ない）。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const JOBSEEKER = process.argv.includes("--jobseeker");
const DIRS = JOBSEEKER
  ? ["src/app/(jobseeker)", "src/app/onboarding", "src/components/mypage", "src/components/notifications", "src/components/profile",
     "src/components/proposals", "src/app/api/jobseeker", "src/lib/evidence", "src/lib/notify", "src/lib/mypage"]
  : ["src/app/biz", "src/app/business", "src/components/business", "src/lib/business", "src/app/api/biz", "src/lib/notify"];
/* 求職者側で数えないもの: 運営の /admin/proposals だけが受け取るエラー */
const SKIP_FILES = JOBSEEKER ? new Set(["src/lib/evidence/generate.ts"]) : new Set();
/* ★企業側は「提案」と「紹介」、求職者側は「提案」 */
const WORDS = JOBSEEKER ? ["提案"] : ["提案", "紹介"];
/* 別の意味の決まった語。⚠️ 足すときは、この機能の名前でないことを確かめてから */
const ALLOWED = /提案営業|自己紹介|会社紹介|人材紹介/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/* コメントを空白に置き換える（文字列の中の // や /* は残す） */
function stripComments(src) {
  let out = "", i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) {
      out += c;
      if (c === "\\") { out += n ?? ""; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? src.length : e + 2; out += src.slice(i, end).replace(/[^\n]/g, " "); i = end; continue; }
    /* 正規表現リテラル（/"/g など）の中の引用符で、文字列の状態がずれないようにする */
    if (c === "/" && /[(,=:[!&|?{};]\s*$|^\s*$/.test(out.slice(Math.max(0, out.lastIndexOf("\n")), out.length).slice(-40))) {
      let j = i + 1, cls = false;
      while (j < src.length && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false;
        else if (src[j] === "/" && !cls) break;
        j++;
      }
      if (src[j] === "/") { out += src.slice(i, j + 1); i = j + 1; continue; }
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    out += c; i++;
  }
  return out;
}

/* 求職者向けのメール（企業には届かない）は対象外 */
const JOBSEEKER_ONLY = new Set(["src/lib/notify/messageNotification.ts"]);

function scan() {
  const hits = [];
  let files = 0;
  for (const d of DIRS) {
    for (const f of walk(path.join(ROOT, d))) {
      const rel = path.relative(ROOT, f);
      if ((!JOBSEEKER && JOBSEEKER_ONLY.has(rel)) || SKIP_FILES.has(rel)) continue;
      files += 1;
      const lines = stripComments(fs.readFileSync(f, "utf8")).split("\n");
      lines.forEach((l, i) => {
        /* 「提案営業」は職種名（LP の経歴の例）。この機能の名前ではない */
        if (/console\.(error|warn|log)\(/.test(l)) return;
        const t = l.replace(ALLOWED, "");
        if (WORDS.some((w) => t.includes(w))) hits.push(`${rel}:${i + 1}: ${l.trim().slice(0, 140)}`);
      });
    }
  }
  return { hits, files };
}

if (process.argv.includes("--self-test")) {
  const probe = path.join(ROOT, "src/app/biz/__wording_probe__.tsx");
  fs.writeFileSync(probe, `// 提案・紹介（コメントは数えない）\nexport const P = () => <p>提案を見る</p>;\nexport const s = "紹介";\nexport const ok = "自己紹介";\n`);
  try {
    const { hits } = scan();
    const found = hits.filter((h) => h.includes("__wording_probe__")).length;
    console.log(`自己テスト: 差し込んだ2か所（コメント1か所・自己紹介1か所は除外）のうち ${found} か所を検出`);
    process.exitCode = found === 2 ? 0 : 1;
  } finally { fs.unlinkSync(probe); }
} else {
  const { hits, files } = scan();
  console.log(`${JOBSEEKER ? "求職者側" : "企業側"}で画面に出る「${WORDS.join("」「")}」: ${hits.length}件（${files}ファイル）`);
  for (const h of hits) console.log("  " + h);
  process.exitCode = hits.length === 0 ? 0 : 1;
}
