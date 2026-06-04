/**
 * simple-icons のモノクロSVGをブランドカラー背景付きPNGに変換して
 * Supabase Storage にアップロードする
 *
 * 使用: node scripts/upload-brand-logos-png.mjs
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf-8');
for (const line of env.split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── ブランドカラー設定 ─────────────────────────────────────────────────────
const BRANDS = [
  // 既存（初回アップロード済み）
  { name: 'Datadog Japan株式会社',          slug: 'datadog',   bgColor: '#632CA6' },
  { name: 'DocuSign Japan株式会社',          slug: 'docusign',  bgColor: '#0C7CC0' }, // 青に変更（↓矢印っぽく見えた濃紺を修正）
  { name: 'Twilio Japan合同会社',            slug: 'twilio',    bgColor: '#F22F46' },
  // 新規追加（バッチ1）
  { name: 'Dropbox Japan株式会社',           slug: 'dropbox',   bgColor: '#0061FF' },
  { name: 'HubSpot Japan株式会社',           slug: 'hubspot',   bgColor: '#FF7A59' },
  { name: 'アトラシアン株式会社',             slug: 'atlassian', bgColor: '#0052CC' },
  { name: 'アドビ株式会社',                  slug: 'adobe',     bgColor: '#FF0000' },
  { name: 'Meta日本法人',                    slug: 'meta',      bgColor: '#1877F2' },
  { name: 'ヴイエムウェア株式会社',           slug: 'vmware',    bgColor: '#1D3557' },
  { name: 'エヌビディア合同会社',             slug: 'nvidia',    bgColor: '#76B900' },
  { name: 'アップルジャパン合同会社',         slug: 'apple',     bgColor: '#555555' },
  { name: 'Indeed Japan株式会社',            slug: 'indeed',    bgColor: '#003A9B' },
  { name: 'アカマイ・テクノロジーズ合同会社', slug: 'akamai',    bgColor: '#009BDE' },
  // 新規追加（バッチ2 — Wikimediaテキストロゴ / ロゴなし企業）
  { name: 'アマゾン ウェブ サービス ジャパン合同会社', slug: 'amazonaws',  bgColor: '#FF9900' },
  { name: 'Asana Japan株式会社',             slug: 'asana',     bgColor: '#F06A6A' },
  { name: 'Box Japan株式会社',               slug: 'box',       bgColor: '#0061D5' },
  { name: 'OpenAI Japan合同会社',            slug: 'openai',    bgColor: '#000000' },
  { name: 'フォーティネット株式会社',         slug: 'fortinet',  bgColor: '#EE3124' },
  { name: 'クラウドフレア・ジャパン株式会社', slug: 'cloudflare',bgColor: '#F38020' },
  { name: 'ウーバー・ジャパン株式会社',       slug: 'uber',      bgColor: '#000000' },
  { name: 'インテル株式会社',                slug: 'intel',     bgColor: '#0071C5' },
  { name: '日本マイクロソフト株式会社',       slug: 'microsoft', bgColor: '#737373' },
  { name: 'グーグル合同会社',                slug: 'google',    bgColor: '#4285F4' },
  { name: '日本オラクル株式会社',             slug: 'oracle',    bgColor: '#F80000' },
  { name: 'レノボ・ジャパン合同会社',         slug: 'lenovo',    bgColor: '#E2231A' },
  { name: 'クリックハウス株式会社',           slug: 'clickhouse',bgColor: '#1F1F1F' },
  { name: 'マルケト株式会社',                slug: 'marketo',   bgColor: '#5C4C9F' },
];

// ── 16進カラー → RGB ──────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// ── SVG pathデータを取得 ──────────────────────────────────────────────────
async function fetchSvgPath(slug) {
  const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const svg = await res.text();
  const match = svg.match(/<path\s+d="([^"]+)"/);
  if (!match) throw new Error('path not found');
  return match[1];
}

// ── SVG → 白アイコン PNG (400x400) ───────────────────────────────────────
async function buildLogoPng(pathD, bgColor) {
  const SIZE = 400;
  const ICON_SIZE = 220;
  const OFFSET = (SIZE - ICON_SIZE) / 2;
  const bg = hexToRgb(bgColor);

  // 1. アイコン部分のSVGを作る（白塗り、icon_size x icon_size）
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24">
  <path d="${pathD}" fill="white"/>
</svg>`;

  // 2. アイコンをPNGバッファに変換
  const iconPng = await sharp(Buffer.from(iconSvg)).png().toBuffer();

  // 3. 背景色の単色画像を作成し、アイコンをオーバーレイ
  const result = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { ...bg, alpha: 255 },
    },
  })
    .composite([{ input: iconPng, top: OFFSET, left: OFFSET }])
    .png()
    .toBuffer();

  return result;
}

// ── メイン ─────────────────────────────────────────────────────────────────
const { data: companies } = await supabase
  .from('ow_companies').select('id, name').eq('is_published', true);

let success = 0, fail = 0;

for (const brand of BRANDS) {
  const company = companies.find(c => c.name === brand.name);
  if (!company) { console.log(`⚠️  ${brand.name} — DBに見つかりません`); continue; }

  process.stdout.write(`[${brand.name}] ... `);

  try {
    const pathD  = await fetchSvgPath(brand.slug);
    const buffer = await buildLogoPng(pathD, brand.bgColor);

    const storagePath = `companies/logos/${company.id}/logo.png`;
    const { error: uploadErr } = await supabase.storage
      .from('ow-uploads')
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

    if (uploadErr) { console.log(`❌ ${uploadErr.message}`); fail++; continue; }

    const { data: { publicUrl } } = supabase.storage.from('ow-uploads').getPublicUrl(storagePath);
    await supabase.from('ow_companies').update({ logo_url: publicUrl }).eq('id', company.id);

    console.log(`✅ PNG (${Math.round(buffer.length / 1024)}KB)`);
    success++;
  } catch (e) {
    console.log(`❌ ${e.message}`);
    fail++;
  }

  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n完了: ✅ ${success} / ❌ ${fail}`);
