#!/usr/bin/env node
/**
 * ★企業側のコードが提案の表を直接読んでいないかを数える（2026-10-11）。
 *
 * 提案は「求職者が『話を聞いてみたい』と答えた行」だけを企業に見せる。その絞り込みは
 * `src/lib/evidence/companyProposals.ts` の1か所にある。企業側から表を直接引くと、
 * 未回答・見送りの行（＝誰に紹介したか）が漏れる。
 *
 *   node scripts/check-proposal-reads.mjs              # 0件なら exit 0
 *   node scripts/check-proposal-reads.mjs --self-test  # わざと1か所入れて、検出されることを確かめる
 *
 * 見る場所: src/app/biz ・ src/lib/business ・ src/app/api/biz（＋ 企業側の部品 src/components/business ・ src/lib/meetings）
 * 見るもの: `.from("ow_proposals")` / `.from("ow_proposal_declines")` と、埋め込み `ow_proposals(` / `ow_proposal_declines(`
 *   ⚠️ コメント（// と /* *\/）は落としてから照合する（注意書きに当たらないように）。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIRS = ["src/app/biz", "src/lib/business", "src/app/api/biz", "src/components/business", "src/lib/meetings"];
const PATTERNS = [
  /\.from\(\s*["'`]ow_proposal(?:s|_declines)["'`]\s*\)/,
  /["'`,\s(]ow_proposal(?:s|_declines)\s*(?:!\w+)?\s*\(/,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, pre) => pre + " ".repeat(m.length - pre.length));
}

function scan() {
  const hits = [];
  let files = 0;
  for (const d of DIRS) {
    for (const f of walk(path.join(ROOT, d))) {
      files += 1;
      const lines = stripComments(fs.readFileSync(f, "utf8")).split("\n");
      lines.forEach((l, i) => {
        if (PATTERNS.some((re) => re.test(l))) hits.push(`${path.relative(ROOT, f)}:${i + 1}: ${l.trim().slice(0, 120)}`);
      });
    }
  }
  return { hits, files };
}

if (process.argv.includes("--self-test")) {
  const probe = path.join(ROOT, "src/lib/business/__proposal_read_probe__.ts");
  fs.writeFileSync(probe, `// 自己テスト用。すぐ消す\nexport const x = (db: any) => db.from("ow_proposals").select("id");\nexport const y = (db: any) => db.from("ow_conversations").select("id, ow_proposals(id)");\n`);
  try {
    const { hits } = scan();
    const found = hits.filter((h) => h.includes("__proposal_read_probe__")).length;
    console.log(`自己テスト: 差し込んだ2か所のうち ${found} か所を検出`);
    process.exitCode = found === 2 ? 0 : 1;
  } finally {
    fs.unlinkSync(probe);
  }
  const after = scan();
  console.log(`取り除いたあと: ${after.hits.length}件（${after.files}ファイル）`);
} else {
  const { hits, files } = scan();
  console.log(`企業側のコードで提案の表を直接読んでいる箇所: ${hits.length}件（${files}ファイルを走査）`);
  for (const h of hits) console.log("  " + h);
  process.exitCode = hits.length === 0 ? 0 : 1;
}
