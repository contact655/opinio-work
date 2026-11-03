#!/usr/bin/env node
/**
 * ★フォントをリポジトリに置く（2026-11-04）。next/font/google がビルドのたびに Google Fonts へ取りに行き、
 *   その通信が失敗してビルドが止まる問題（PR #11・#13 で2回）をなくすため。
 *
 * やること:
 *   1. next/font/google と同じ URL・同じ User-Agent で Google Fonts の CSS を取る
 *      （src/app/layout.tsx で使っていた指定: Inter 400〜800 ／ Noto Serif JP 400〜700・display=swap）
 *   2. CSS に出てくる woff2 を1つずつ取り、src/fonts/<フォント>/NNN.woff2 に置く
 *   3. 1ファイル＝1回の next/font/local 呼び出しにして、unicode-range も同じに付けた src/fonts/index.ts を書く
 *   4. ライセンス（SIL Open Font License 1.1）の本文を src/fonts/<フォント>/OFL.txt に置く
 *
 * ⚠️ 生成物を手で書き換えないこと。フォントや太さを変えるときはこのスクリプトの FONTS を変えて流し直す。
 * ⚠️ ネットワークが要るのはこのスクリプトを流すときだけ。ビルドは取りに行かない。
 *
 * 使い方: node scripts/gen-local-fonts.mjs
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "src/fonts");
/* next/font/google と同じ User-Agent（node_modules/next/dist/compiled/@next/font/dist/google/fetch-css-from-google-fonts.js）。
   ⚠️ 変えると Google が別の形式・別の分割で返す */
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";

const FONTS = [
  {
    key: "inter", dir: "inter", family: "Inter", weights: [400, 500, 600, 700, 800],
    exportName: "interFontFamily", ofl: "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt",
  },
  {
    key: "notoSerifJp", dir: "noto-serif-jp", family: "Noto Serif JP", weights: [400, 500, 600, 700],
    exportName: "notoSerifJpFontFamily", ofl: "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifjp/OFL.txt",
  },
];
/* next/font/google が先読みしていたのは subsets: ["latin"] の分割だけ（CSS のコメントが latin のもの） */
const PRELOAD_SUBSET = "latin";

async function get(url, as) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === "buf" ? Buffer.from(await res.arrayBuffer()) : res.text();
}

function parseFaces(css) {
  const faces = [];
  for (const m of css.matchAll(/(?:\/\*\s*([^*]+?)\s*\*\/\s*)?@font-face\s*{([^}]*)}/g)) {
    const body = m[2];
    const url = (body.match(/url\(([^)]+)\)/) || [])[1];
    const weight = Number((body.match(/font-weight:\s*(\d+)/) || [])[1]);
    const range = (body.match(/unicode-range:\s*([^;]+);/) || [])[1];
    const style = (body.match(/font-style:\s*([^;]+);/) || [])[1];
    if (!url || !range) throw new Error("url か unicode-range の無い @font-face があった");
    faces.push({ label: (m[1] || "").trim(), url, weight, range: range.trim(), style });
  }
  return faces;
}

const lines = [
  "/* eslint-disable */",
  "/**",
  " * ★生成ファイル。手で書き換えない（scripts/gen-local-fonts.mjs が書く）。",
  " *   Google Fonts が配っているのと同じファイル・同じ文字の範囲（unicode-range）を、1ファイル＝1回の next/font/local で読む。",
  " *   next/font/local は1回の呼び出しに1つの unicode-range しか付けられないため、分割の数だけ呼び出しがある。",
  " * ⚠️ 書体名は分割ごとに別になる。画面で使うのは下の export（全部をつないだ font-family。あとの分割から順に並ぶ）だけ",
  " * ⚠️ 予備の書体（Inter Fallback ／ Noto Serif JP Fallback）は globals.css に置いてある",
  " */",
  'import localFont from "next/font/local";',
  "",
];

rmSync(OUT, { recursive: true, force: true });
for (const f of FONTS) {
  const url = `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, "+")}:wght@${f.weights.join(";")}&display=swap`;
  const faces = parseFaces(await get(url));
  /* 同じファイルが太さの数だけ出てくる（1ファイルで全部の太さを出せる可変フォント）。ファイルごとにまとめる */
  const byUrl = new Map();
  for (const x of faces) {
    const cur = byUrl.get(x.url) ?? { ...x, weights: new Set() };
    if (cur.range !== x.range || cur.style !== x.style) throw new Error(`同じファイルで範囲か字形が違う: ${x.url}`);
    cur.weights.add(x.weight);
    byUrl.set(x.url, cur);
  }
  const chunks = [...byUrl.values()];
  for (const c of chunks) {
    if (c.weights.size !== f.weights.length) throw new Error(`${f.family}: 全部の太さを持たないファイルがある（${[...c.weights]}）`);
  }
  mkdirSync(join(OUT, f.dir), { recursive: true });
  writeFileSync(join(OUT, f.dir, "OFL.txt"), await get(f.ofl));
  const names = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const file = `${String(i).padStart(3, "0")}.woff2`;
    writeFileSync(join(OUT, f.dir, file), await get(c.url, "buf"));
    const name = `${f.key}${String(i).padStart(3, "0")}`;
    names.push(name);
    const preload = c.label === PRELOAD_SUBSET;
    lines.push(
      `const ${name} = localFont({ src: "./${f.dir}/${file}", weight: "${f.weights[0]} ${f.weights.at(-1)}", style: "${c.style}", display: "swap", preload: ${preload}, adjustFontFallback: false, declarations: [{ prop: "unicode-range", value: "${c.range}" }] });`,
    );
  }
  lines.push(
    "",
    `/** ${f.family}（${chunks.length}分割・太さ ${f.weights[0]}〜${f.weights.at(-1)}）。末尾に予備の書体を付けるのは layout.tsx */`,
    /* ⚠️★逆順につなぐ。Google の CSS では分割どうしの文字範囲が一部重なっており（Inter 37文字・Noto Serif JP 424文字）、
          1つの書体の中では「あとに書かれた @font-face」が先に試される（CSS Fonts の規則）。
          書体を並べたときは「先に書いた書体」が先に試されるので、同じ結果にするには逆にする。
          順番どおりにつなぐと、重なった文字のために別の分割を余分に取りに行く（企業ページで1本多く落ちていた） */
    `export const ${f.exportName} = [${[...names].reverse().map((n) => `${n}.style.fontFamily`).join(", ")}].join(", ");`,
    "",
  );
  console.log(`${f.family}: ${chunks.length} ファイル（先読み ${chunks.filter((c) => c.label === PRELOAD_SUBSET).length}）`);
}
writeFileSync(join(OUT, "index.ts"), lines.join("\n"));
console.log("src/fonts/index.ts を書きました");
