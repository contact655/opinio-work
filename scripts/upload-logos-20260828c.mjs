/**
 * upload-logos-20260828c.mjs
 *
 * **実寸が小さいロゴ6社**の差し替え（2026-08-28）。docs/todo.md「企業ロゴの残作業 ①」。
 * 先行する2バッチ（`upload-logos-20260828.mjs` / `...b.mjs`）は
 * **OGP画像がロゴになっていた企業**が対象で、こちらは**別の集合**。
 *
 * ── ★DB は触らない（migration も要らない）─────────────────────────────────
 * 3社とも `ow_companies.logo_url` は既に
 * `.../companies/logos/{id}/logo.png` を指している。**同じキーに上書きする**ので
 * URL は変わらない。実測でこのオブジェクトの応答は `cache-control: no-cache`
 * なので、上書きした瞬間に反映される（`?v=` のようなキャッシュ回避は不要）。
 *
 * ── ★機械判定を通っても採らなかったもの（目視で落とした）──────────────────
 * ⚠️ **Ubie**: iTunes の公開APIで publisher が `Ubie, Inc.` の 512x512 が取れたが、
 *    中身は**製品アプリ「ユビー 医療AIパートナー」のアイコン**（キャラクター＋文字）で
 *    企業ロゴではない。公式サイトの apple-touch-icon は **70x70**（＝現行と同一）、
 *    Wikimedia は横長のワードマークしか無い。**調達できていない。**
 * ⚠️ **アリスタネットワークス**: 公式サイトが **406** を返しスクレイプできない。
 *    favicon は 32x32、Wikimedia は横長（1115x175）。iTunes に出るのは
 *    **CloudVision Installer**（製品）のアイコン。**調達できていない。**
 * ⚠️ **ブラックライン**: 公式サイトのインライン SVG は取れたが `fill="#fff"`
 *    （暗い背景用）で、白地に置くと**見えない**。現行ロゴは金 (244,184,10) と黒の
 *    2色構成で、公式SVGは単色1パス。**色と配置を推測することになるので採らない。**
 *
 * → **「公式サイトから 512x512 が取れた」を採用の根拠にしないこと。**
 *    クアルコムに React のロゴを入れかけた 2026-08-28 の1件と同じ形。
 *
 * ── 実行 ────────────────────────────────────────────────────────────────────
 *   node scripts/upload-logos-20260828c.mjs
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

/** ⚠️ 対象は id で明示列挙する（全社一括の更新をしない）。`before` は差し替え前の実寸。 */
const TARGETS = [
  { id: 'cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16', name: 'Slack Japan株式会社', before: '35x34',
    // 公式CDN。**透過の**カラーマーク。`slack_hash_256.png` は紫地のアプリアイコンなので採らない
    src: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png' },   // 400x400 透過
  { id: 'f4a6aa23-3775-4548-981b-156e416ef6f6', name: 'パロアルトネットワークス株式会社', before: '57x57',
    // 公式サイトの favicon セット（`<link rel="icon" sizes="192x192">`）
    src: 'https://www.paloaltonetworks.jp/etc/clientlibs/pan/img/favicons2020/android-chrome-192x192.png' }, // 192x192 透過
  /* ★HP は公式のグローバルナビが配っている SVG を 512px にラスタライズした。
        出典: https://www.hp.com/content/dam/sites/worldwide/dems/global_nav_icons/hp-logo.svg
        （`scripts/assets/logos-20260828c/hp-source.svg` に原本を置いてある）
     ⚠️ この SVG は `<style>` ブロックではなく **path の style 属性**に
        `fill:#0096d6` を持つので、qlmanage でも色が乗る（ミラクルで踏んだ罠の逆）。
     ⚠️ 現行の 32x32 は濃い紺だが、**公式の HP Blue は #0096d6**。色が変わって見えるのは
        差し替えが正しいから。 */
  { id: 'c32027b9-cfbd-4a70-bf4c-464e42790db4', name: '株式会社日本HP', before: '32x32',
    file: 'scripts/assets/logos-20260828c/hp.png' },                                            // 512x512 透過
];

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' };
const MIN_PX = 150;      // ★短辺の下限。96px 枠の 2x をまかなう（b バッチと同じ根拠）
const MAX_RATIO = 1.6;   // ★OGP画像（1.91）を確実に弾く

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
  const ratio = w / h;
  if (ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) {
    console.error(`✗ ${t.name}: ${w}x${h}（比${ratio.toFixed(2)}）。中止`); ng++; continue;
  }
  if (Math.min(w, h) < MIN_PX) {
    console.error(`✗ ${t.name}: 短辺 ${Math.min(w, h)}px は ${MIN_PX}px 未満。中止`); ng++; continue;
  }

  /* ★差し替えなので、上書きする先が**実在すること**を先に確かめる。
        新しいキーを作ってしまうと DB の logo_url が古いファイルを指したままになる。 */
  const key = `companies/logos/${t.id}/logo.png`;
  const { data: row, error: qErr } = await supabase
    .from('ow_companies').select('logo_url').eq('id', t.id).single();
  if (qErr) { console.error(`✗ ${t.name}: DB 取得失敗 ${qErr.message}`); ng++; continue; }
  if (!row?.logo_url?.endsWith(`/${key.split('/').slice(-2).join('/')}`)) {
    console.error(`✗ ${t.name}: logo_url が想定と違う（${row?.logo_url}）。中止`); ng++; continue;
  }

  const { error } = await supabase.storage.from('ow-uploads').upload(key, buf, {
    contentType: 'image/png', upsert: true,
  });
  if (error) { console.error(`✗ ${t.name}: ${error.message}`); ng++; continue; }
  console.log(`✓ ${t.name}  ${t.before} → ${w}x${h}  ${buf.length}bytes\n  ${row.logo_url}`);
  ok++;
}
console.log(`\n成功 ${ok} / 失敗 ${ng}`);
console.log('⚠️ 確認は DB の logo_url を実際に取得して寸法を測ること（Storage のキーを組み立てない）。');
process.exit(ng ? 1 : 0);
