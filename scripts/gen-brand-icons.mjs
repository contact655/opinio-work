#!/usr/bin/env node
/**
 * 公式ロゴ（public/brand/）から favicon と PWA アイコンを作り直す。
 *
 *   node scripts/gen-brand-icons.mjs
 *
 * ⚠️ **手作業の生成ページを置き換えたもの**（2026-09-06）。
 *    以前は `public/icons/pwa/generate-icons.html` をブラウザで開き、
 *    canvas から1枚ずつダウンロードして並べる手順だった。
 *    **そのページは旧デザイン（Speech Bubble）を焼き込んでおり、
 *    ロゴ確定後に誰かが開くと古いアイコンで上書きされる。** だから消してある。
 *
 * ⚠️ **形はここに直接書いてある**（public/brand の SVG から写した）。
 *    C2PA のメタデータが 8KB 入っていて、パースするより写したほうが確実なため。
 *    ロゴが改訂されたら public/brand を差し替え、ここの SYMBOL も更新する。
 *
 * ⚠️ アイコンを作り直したら **public/sw.js の CACHE_VERSION を必ず上げる**。
 *    画像は CacheFirst + 30日 TTL なので、上げないと既存の利用者に
 *    最大30日ふるいロゴが出続ける。
 */

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PWA = path.join(ROOT, "public/icons/pwa");
const ICONS = path.join(ROOT, "public/icons");

const INK = "#141414";
const PAPER = "#FFFFFF";

/** シンボル（1024 の箱に置いたときの位置と大きさ）。opinio-app-icon.svg と同一。 */
const SYMBOL = { x: 276.48, y: 158.72, w: 471.04, hRight: 518.14, hLeft: 706.56 };
const symbolPath = `M 0 0 L ${SYMBOL.w} 0 L ${SYMBOL.w} ${SYMBOL.hRight} L 0 ${SYMBOL.hLeft} Z`;

/** 角丸あり。ブラウザのタブ・PWA の purpose="any" 用。 */
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="229.1" fill="${INK}"/><g transform="translate(${SYMBOL.x} ${SYMBOL.y})"><path d="${symbolPath}" fill="${PAPER}"/></g></svg>`;

/*
 * maskable: OS が自前でマスク（円・角丸・雫）を掛けるので **角丸を付けず全面を塗る**。
 * シンボルは 1024 の 10〜90%（セーフゾーン）に収まるよう 0.78 倍にして中央へ。
 * ⚠️ 角丸のまま maskable に流用しない。OS のマスクと二重になって角が欠ける。
 */
const S = 0.78;
const mw = SYMBOL.w * S;
const mh = SYMBOL.hLeft * S;
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${INK}"/><g transform="translate(${(1024 - mw) / 2} ${(1024 - mh) / 2}) scale(${S})"><path d="${symbolPath}" fill="${PAPER}"/></g></svg>`;

/*
 * favicon: 16px でも潰れないよう、納品された opinio-favicon.svg と同じ
 * 「シンボル大きめ・角丸ゆるめ」の比率で描く。app icon の比率をそのまま縮めると細い。
 */
const faviconSvg = (n) => {
  const k = n / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}"><rect width="${n}" height="${n}" rx="${7 * k}" fill="${INK}"/><g transform="translate(${7.36 * k} ${3.04 * k}) scale(${k})"><path d="M 0 0 L 17.28 0 L 17.28 19.01 L 0 25.92 Z" fill="${PAPER}"/></g></svg>`;
};

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 600 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

/**
 * ICO を自分で組む（sharp は .ico を書けない）。
 * 各エントリは PNG 埋め込み。IE9+ と現行の全ブラウザが対応している。
 */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dir = entries.map(({ size, buf }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.buf)]);
}

const written = [];
const write = (p, buf) => {
  fs.writeFileSync(p, buf);
  written.push(`${path.relative(ROOT, p)}  ${buf.length}B`);
};

for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
  write(path.join(PWA, `icon-${size}.png`), await png(anySvg, size));
  write(path.join(PWA, `icon-${size}.svg`), Buffer.from(anySvg));
}
for (const size of [192, 512]) {
  write(path.join(PWA, `icon-maskable-${size}.png`), await png(maskableSvg, size));
  write(path.join(PWA, `icon-maskable-${size}.svg`), Buffer.from(maskableSvg));
}

write(path.join(ICONS, "apple-touch-icon.png"), await png(anySvg, 180));

/*
 * メール用のロゴ（白）。
 * ⚠️ **メールに SVG を貼らない。** Gmail は svg を落とし、Outlook は描かない。
 *    PNG を絶対URLで参照し、`alt="OPINIO"` で画像ブロック時に文字へ落とす。
 * ⚠️ 表示は 110×29 想定。ここは 2倍で書き出す（Retina 対応）。
 */
{
  const src = fs.readFileSync(path.join(ROOT, "public/brand/opinio-logo-horizontal-white.svg"));
  const h = 58;
  const w = Math.round((h * 463.54) / 121.2);
  write(
    path.join(ROOT, "public/brand/opinio-logo-horizontal-white@2x.png"),
    await sharp(src, { density: 900 }).resize(w, h).png({ compressionLevel: 9 }).toBuffer()
  );
}
write(path.join(ICONS, "favicon.svg"), Buffer.from(faviconSvg(32) + "\n"));

/* ⚠️ favicon.ico は public/ ではなく src/app/ に置く（Next のファイル規約）。 */
write(
  path.join(ROOT, "src/app/favicon.ico"),
  buildIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await png(faviconSvg(size), size) }))))
);

console.log(written.join("\n"));
console.log(`\n${written.length} ファイルを書き出しました。`);
console.log("⚠️ public/sw.js の CACHE_VERSION を上げること（画像は30日キャッシュされる）。");
