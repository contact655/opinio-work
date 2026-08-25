/**
 * upload-logos-20260825.mjs
 *
 * 掲載中で favicon 経路（実寸32px）だった企業のロゴを、公式サイトの
 * apple-touch-icon から取得して Storage に入れる（2026-08-25）。
 *
 * ⚠️ 既存75社と同じ置き場・同じ命名にする:
 *      ow-uploads/companies/logos/{company_id}/logo.png
 * ⚠️ **DB は更新しない。** `logo_url` の書き換えは migration で行う
 *    （CLAUDE.md「SQL Editor での手動適用を禁止する」）。
 * ⚠️ 対象は id で明示列挙する。全社一括で走らせない。
 *
 * ── なぜこの2社だけか（2026-08-25 実測）────────────────────────────────
 *   Wikimedia には4社とも使えるロゴが無かった（富士フイルムはプリンタと建物の写真のみ）。
 *   公式サイトの正方形アセットを当たった結果:
 *     伊藤忠テクノソリューションズ  180x180 PNG  → 採用（32px から改善）
 *     富士フイルムビジネスイノベーション 256x256 PNG → 採用
 *     フライル                      36x36 PNG    → **見送り**（32px と実質同じ）
 *     PKSHA Technology              .ico に 32x32 のみ → **見送り**
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

const TARGETS = [
  {
    id: '138ff010-8671-414a-ab06-752d61f50dd7',
    name: '伊藤忠テクノソリューションズ株式会社',
    src: 'https://www.ctc-g.co.jp/apple-touch-icon.png',   // 180x180 / 実測で確認
  },
  {
    id: 'b8b7a2d4-20a8-4fe1-8651-61a6503f762e',
    name: '富士フイルムビジネスイノベーションジャパン株式会社',
    src: 'https://www.fujifilm.com/fb/themes/custom/fujifilm_com_g2/apple-touch-icon-precomposed.png', // 256x256
  },
];

for (const t of TARGETS) {
  const res = await fetch(t.src);
  if (!res.ok) { console.error(`✗ ${t.name}: 取得失敗 ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  /* ⚠️ PNG であることを確かめてから上げる。HTML のエラーページを掴んでいると
        「上がったのに表示されない」になる（実際 flyle は HTML が返っていた）。 */
  if (!(buf[0] === 0x89 && buf.slice(1, 4).toString() === 'PNG')) {
    console.error(`✗ ${t.name}: PNG ではない（${buf.slice(0, 16).toString('hex')}）`);
    continue;
  }
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const key = `companies/logos/${t.id}/logo.png`;
  const { error } = await supabase.storage.from('ow-uploads').upload(key, buf, {
    contentType: 'image/png', upsert: true,
  });
  if (error) { console.error(`✗ ${t.name}: ${error.message}`); continue; }
  const { data } = supabase.storage.from('ow-uploads').getPublicUrl(key);
  console.log(`✓ ${t.name}  ${w}x${h}  ${buf.length}bytes\n  ${data.publicUrl}`);
}
