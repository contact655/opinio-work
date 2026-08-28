/**
 * upload-logos-20260828b.mjs
 *
 * ロゴが OGP画像だった企業の差し替え・**第2バッチ**（2026-08-28）。
 * 第1バッチは `upload-logos-20260828.mjs`（7社）。
 *
 * ⚠️ 置き場と命名は既存と同じ: ow-uploads/companies/logos/{company_id}/logo.png
 * ⚠️ **DB は更新しない。** `logo_url` の書き換えは migration で行う。
 * ⚠️ 対象は id で明示列挙する。
 *
 * ── 第1バッチとの違い ──────────────────────────────────────────────────────
 * ① **Web App Manifest を見た。** 第1バッチは `<link rel="*icon*">` と定番パスしか
 *    見ていなかったが、manifest には 192/512px のアイコンが載る。
 * ② **node の fetch で取り直した。** Python の urllib が 403 / TLS エラーで
 *    落ちていたサイト（Databricks / タイミー）が node では通った。
 *    ⚠️ 「取得できない」を「アセットが無い」と結論しないこと。
 * ③ **ICO はローカルで PNG に変換して持つ。** キリバは favicon.ico しか出して
 *    いないので、PIL で変換したものを `scripts/assets/logos-20260828b/` に置いた。
 *
 * ── ★採用のしきい値を 180px → 150px に下げた ───────────────────────────────
 * 実測: `CompanyLogo` の最大表示は **96px**（`size={96}` が1箇所）。padding は
 * `px * 0.1` なので画像領域は約77px。**2x DPI で必要なのは約154px**。
 * 一覧のグリッドは 68px なので 2x でも 108px あれば足りる。
 * したがって **150px あれば最大表示でも 2x を満たす**。
 * ⚠️ 比較対象は「1280x640 の OGP バナー」で、あれは**どのサイズでも判読できない**。
 *    150px の正方形ロゴのほうが明確に良い。
 * ⚠️ **150px 未満は引き続き採らない。** Concur(96) / MongoDB(64) / Okta(57) /
 *    Braze(48) / Salesforce(32) / Workday(32) / Translead(32) / Cisco(16)。
 *
 * ── ★目視で2件を落とした（機械判定だけなら通っていた）────────────────────
 * ⚠️ **クアルコム**: `.../clientlib-react/resources/logo512.png` が 512x512 で
 *    取れたが、**中身は React のロゴ**（Create React App の既定画像）だった。
 *    そのまま入れると**他社のロゴを掲載する**ことになっていた。
 * ⚠️ **ミラクル**: SVG しか無く、`qlmanage` で 512px にラスタライズしたが
 *    **ほぼ空白の画像**になった。
 * → **寸法と形式が通っても、必ず目で見ること。**
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/** `src`（URL）か `file`（リポジトリ内のパス）のどちらかを持つ。 */
const TARGETS = [
  { id: 'ae15610d-477a-410d-b74a-54ab3e351add', name: 'Databricks Japan株式会社',
    src: 'https://www.databricks.com/en-website-assets/icons/icon-512x512.png?v=c9b9916c3b27dc51866c46b79a6e9b88' }, // 512x512（manifest 由来）
  { id: 'd6650b18-5ef2-40c9-9938-2adbad70fe2b', name: 'Zendesk株式会社',
    src: 'https://d1eipm3vz40hy0.cloudfront.net/images/logos/favicons/zendesk-icon-152.png' },                       // 152x152
  { id: '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a', name: '株式会社タイミー',
    src: 'https://corp.timee.co.jp/apple-touch-icon.png' },                                                          // 180x180
  { id: 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df', name: 'キリバ株式会社',
    file: 'scripts/assets/logos-20260828b/kyriba.png',
    origin: 'https://www.kyriba.com/favicon.ico' },                                                                  // 156x156（ICO → PNG）
  /* ★ミラクルは SVG しか無い。2026-08-28 の1回目は**ほぼ空白**になって落とした。
        原因は `<style>` の中に `path { fill: #03182F }` があり、**qlmanage が SVG 内の
        CSS を適用しない**こと（root は `fill="none"`）。fill を path に直接書いてから
        ラスタライズすると出る。さらに qlmanage は**白背景を焼き込む**ので、
        四隅から flood fill して外側だけ透明にしてある（円の内側の白い盾は残す）。 */
  { id: '355ce5c6-0412-4512-8864-1d477c97c917', name: 'ミラクル株式会社',
    file: 'scripts/assets/logos-20260828b/mirakl.png',
    origin: 'https://www.mirakl.com/media/favicons/favicon-light.svg' },                                             // SVG → 512x512 PNG
  /* ★セールスフォースだけ出典が**公式サイトではなく Wikimedia Commons**。
        公式は 32x32 の favicon しか公開しておらず、ブランドページにも無い（実測）。
        ⚠️ **ライセンスを確認して採った**: `File:Salesforce.com logo.svg` は
           **Public domain**（単純な図形・文字なので著作権の閾値を下回る扱い）。
           商標は残るが、**その企業を指すために使う**用途なので問題にならない。
        ⚠️ **Commons の検索結果をそのまま使わないこと。** 同じ検索で
           「Cisco College」「インドネシアの都市の紋章」「ISS の写真」
           「KDE のアイコンテーマ（Antu mongodb.svg）」が上位に出た。
           **別会社や第三者の描き直しが混ざる。** ファイル名と中身を必ず確認する。
        ⚠️ 比 1.43 なので**完全な正方形ではない**が、現行の OGP画像（1.91）より
           収まりがよく、背景が透過で他のカードと揃う。 */
  { id: 'c3664ef1-5571-4645-b30f-1474e7961c17', name: '株式会社セールスフォース・ジャパン',
    file: 'scripts/assets/logos-20260828b/salesforce.png',
    origin: 'https://commons.wikimedia.org/wiki/File:Salesforce.com_logo.svg' },                                     // 960x672（PD）
];

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' };
const MIN_PX = 150;      // ★短辺の下限。根拠は冒頭のコメント
const MAX_RATIO = 1.6;   // ★縦横比の上限。OGP画像は 1.91 なので確実に弾く

let ok = 0, ng = 0;
for (const t of TARGETS) {
  let buf;
  if (t.file) {
    buf = fs.readFileSync(path.resolve(process.cwd(), t.file));
  } else {
    const res = await fetch(t.src, { headers: UA });
    if (!res.ok) { console.error(`✗ ${t.name}: 取得失敗 ${res.status}`); ng++; continue; }
    buf = Buffer.from(await res.arrayBuffer());
  }

  /* ⚠️ PNG であることを確かめてから上げる。HTML のエラーページを掴んでいると
        「上がったのに表示されない」になる。 */
  if (!(buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG')) {
    console.error(`✗ ${t.name}: PNG ではない（${buf.subarray(0, 8).toString('hex')}）`); ng++; continue;
  }
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  /* ⚠️ 正方形を必須にしない。**縦横比の上限で見る。** 差し替えの目的は
        「OGP画像（1.91:1）をやめる」ことで、1.5 程度までは正方形の枠に収まる。
        ⚠️ **1.8 を超えるものは受けない**（それが OGP画像の規格そのもの）。 */
  const ratio = w / h;
  if (ratio > MAX_RATIO) { console.error(`✗ ${t.name}: ${w}x${h}（比${ratio.toFixed(2)}）は横長すぎる。中止`); ng++; continue; }
  if (ratio < 1 / MAX_RATIO) { console.error(`✗ ${t.name}: ${w}x${h} は縦長すぎる。中止`); ng++; continue; }
  /* ⚠️ 短辺で測る。横長のものを長辺で通すと、実際の解像度が足りない */
  if (Math.min(w, h) < MIN_PX) { console.error(`✗ ${t.name}: 短辺 ${Math.min(w,h)}px は ${MIN_PX}px 未満。中止`); ng++; continue; }

  const key = `companies/logos/${t.id}/logo.png`;
  const { error } = await supabase.storage.from('ow-uploads').upload(key, buf, {
    contentType: 'image/png', upsert: true,
  });
  if (error) { console.error(`✗ ${t.name}: ${error.message}`); ng++; continue; }
  const { data } = supabase.storage.from('ow-uploads').getPublicUrl(key);
  console.log(`✓ ${t.name}  ${w}x${h}  ${buf.length}bytes\n  ${data.publicUrl}`);
  ok++;
}
console.log(`\n成功 ${ok} / 失敗 ${ng}`);
process.exit(ng ? 1 : 0);
